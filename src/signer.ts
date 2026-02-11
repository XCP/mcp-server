/**
 * Optional transaction signing using @scure/btc-signer and @noble libraries.
 * Only used when SIGNER_PRIVATE_KEY and SIGNER_ADDRESS env vars are set.
 */
import { Transaction, p2wpkh, p2sh, p2tr } from '@scure/btc-signer';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { createBase58check } from '@scure/base';

const base58check = createBase58check(sha256);

/** Shared options for parsing raw transactions with btc-signer. */
const TX_PARSE_OPTS = {
  allowUnknownInputs: true,
  allowUnknownOutputs: true,
  allowLegacyWitnessUtxo: true,
  disableScriptCheck: true,
} as const;

export type AddressType = 'p2pkh' | 'p2wpkh' | 'p2sh-p2wpkh' | 'p2tr';

/**
 * Detect the address type from a Bitcoin address string.
 */
export function detectAddressType(address: string): AddressType {
  if (address.startsWith('bc1q') || address.startsWith('tb1q')) {
    return 'p2wpkh';
  }
  if (address.startsWith('bc1p') || address.startsWith('tb1p')) {
    return 'p2tr';
  }
  if (address.startsWith('3') || address.startsWith('2')) {
    return 'p2sh-p2wpkh';
  }
  // Starts with 1 or m/n (testnet)
  return 'p2pkh';
}

/**
 * Decode a WIF private key to hex and compressed flag.
 * Supports both mainnet (0x80) and testnet (0xef) WIF keys.
 */
export function decodeWIF(wif: string): { privateKey: string; compressed: boolean } {
  const decoded = base58check.decode(wif);
  if (decoded[0] !== 0x80 && decoded[0] !== 0xef) {
    throw new Error('Invalid WIF version byte');
  }
  const compressed = decoded.length === 34;
  const privBytes = decoded.slice(1, 33);
  return {
    privateKey: bytesToHex(privBytes),
    compressed,
  };
}

function getPublicKey(privateKeyHex: string, compressed: boolean): Uint8Array {
  return secp256k1.getPublicKey(hexToBytes(privateKeyHex), compressed);
}

export interface SigningConfig {
  privateKeyHex: string;
  compressed: boolean;
  address: string;
  addressType: AddressType;
}

/**
 * Initialize signing config from environment variables.
 * Returns null if SIGNER_PRIVATE_KEY and SIGNER_ADDRESS are not set.
 * Logs an error and returns null if they are set but invalid.
 */
export function initSigningConfig(): SigningConfig | null {
  const wif = process.env.SIGNER_PRIVATE_KEY;
  const address = process.env.SIGNER_ADDRESS;

  if (!wif && !address) {
    return null;
  }

  if (!wif || !address) {
    console.error('Error: Both SIGNER_PRIVATE_KEY and SIGNER_ADDRESS must be set for signing. Got only one.');
    return null;
  }

  try {
    const { privateKey, compressed } = decodeWIF(wif);
    const addressType = detectAddressType(address);

    return {
      privateKeyHex: privateKey,
      compressed,
      address,
      addressType,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: Invalid SIGNER_PRIVATE_KEY: ${message}`);
    return null;
  }
}

const CNTRPRTY_PREFIX = new Uint8Array([0x43, 0x4e, 0x54, 0x52, 0x50, 0x52, 0x54, 0x59]);
const OP_RETURN = 0x6a;

/**
 * ARC4 (RC4) stream cipher — used by Counterparty to encrypt OP_RETURN data.
 * The key is the txid (hex bytes) of the first input.
 */
function arc4Decrypt(key: Uint8Array, data: Uint8Array): Uint8Array {
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;

  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
  }

  const out = new Uint8Array(data.length);
  let ii = 0;
  let jj = 0;
  for (let k = 0; k < data.length; k++) {
    ii = (ii + 1) & 0xff;
    jj = (jj + S[ii]) & 0xff;
    [S[ii], S[jj]] = [S[jj], S[ii]];
    out[k] = data[k] ^ S[(S[ii] + S[jj]) & 0xff];
  }
  return out;
}

function hasCntrprtyPrefix(data: Uint8Array): boolean {
  if (data.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (data[i] !== CNTRPRTY_PREFIX[i]) return false;
  }
  return true;
}

/**
 * Extract pushed data from an OP_RETURN script.
 */
function extractPushData(script: Uint8Array): Uint8Array | null {
  if (script.length < 2 || script[0] !== OP_RETURN) return null;

  const pushByte = script[1];
  let dataStart: number;
  let dataLen: number;

  if (pushByte === 0x4c) {
    // OP_PUSHDATA1: next byte is length
    if (script.length < 3) return null;
    dataLen = script[2];
    dataStart = 3;
  } else if (pushByte === 0x4d) {
    // OP_PUSHDATA2: next 2 bytes are length (little-endian)
    if (script.length < 4) return null;
    dataLen = script[2] | (script[3] << 8);
    dataStart = 4;
  } else if (pushByte >= 1 && pushByte <= 75) {
    dataLen = pushByte;
    dataStart = 2;
  } else {
    return null;
  }

  if (script.length < dataStart + dataLen) return null;
  return script.slice(dataStart, dataStart + dataLen);
}

/**
 * Extract and decrypt OP_RETURN data from a raw transaction hex.
 * Counterparty encrypts OP_RETURN data with ARC4 using the first input's txid.
 * Tries decryption first, then checks for an unencrypted prefix.
 * Returns the decrypted Counterparty data as hex (including CNTRPRTY prefix), or null.
 * This is done locally — no API call — so it does not trust the node.
 */
export function extractOpReturnData(rawTransactionHex: string): string | null {
  const rawTxBytes = hexToBytes(rawTransactionHex);
  const tx = Transaction.fromRaw(rawTxBytes, TX_PARSE_OPTS);

  // Get first input's txid for ARC4 decryption key
  let arc4Key: Uint8Array | null = null;
  if (tx.inputsLength > 0) {
    const firstInput = tx.getInput(0);
    if (firstInput?.txid) {
      arc4Key = typeof firstInput.txid === 'string'
        ? hexToBytes(firstInput.txid)
        : new Uint8Array(firstInput.txid);
    }
  }

  for (let i = 0; i < tx.outputsLength; i++) {
    const output = tx.getOutput(i);
    if (!output.script || output.script.length < 2) continue;
    if (output.script[0] !== OP_RETURN) continue;

    const pushData = extractPushData(output.script);
    if (!pushData || pushData.length < 8) continue;

    // Try ARC4 decryption first (standard Counterparty encoding)
    if (arc4Key) {
      const decrypted = arc4Decrypt(arc4Key, pushData);
      if (hasCntrprtyPrefix(decrypted)) {
        return bytesToHex(decrypted);
      }
    }

    // Try unencrypted (some newer transactions)
    if (hasCntrprtyPrefix(pushData)) {
      return bytesToHex(pushData);
    }
  }

  return null;
}

/**
 * Sign a raw transaction hex using the configured private key.
 */
export function signTransaction(
  rawTransactionHex: string,
  config: SigningConfig,
  inputValues?: number[],
  lockScripts?: string[],
): string {
  const privateKeyBytes = hexToBytes(config.privateKeyHex);

  try {
    const pubkeyBytes = getPublicKey(config.privateKeyHex, config.compressed);
    const isLegacy = config.addressType === 'p2pkh';

    const hasApiData = inputValues && lockScripts &&
                       inputValues.length > 0 && lockScripts.length > 0;

    if (!hasApiData) {
      throw new Error(
        'Signing requires inputs_values and lock_scripts from the compose response.'
      );
    }

    const rawTxBytes = hexToBytes(rawTransactionHex);
    const parsedTx = Transaction.fromRaw(rawTxBytes, TX_PARSE_OPTS);
    const tx = new Transaction(TX_PARSE_OPTS);

    for (let i = 0; i < parsedTx.inputsLength; i++) {
      const input = parsedTx.getInput(i);
      if (!input?.txid || input.index === undefined) {
        throw new Error(`Invalid input at index ${i}: missing txid or index`);
      }

      const inputData: Record<string, unknown> = {
        txid: input.txid,
        index: input.index,
        sequence: 0xfffffffd,
        sighashType: 0x01, // SIGHASH_ALL
      };

      inputData.witnessUtxo = {
        script: hexToBytes(lockScripts[i]),
        amount: BigInt(inputValues[i]),
      };

      // P2SH-P2WPKH needs the redeem script
      if (!isLegacy && config.addressType === 'p2sh-p2wpkh') {
        const redeemScript = p2wpkh(pubkeyBytes).script;
        if (redeemScript) {
          inputData.redeemScript = redeemScript;
        }
      }

      tx.addInput(inputData);
    }

    for (let i = 0; i < parsedTx.outputsLength; i++) {
      const output = parsedTx.getOutput(i);
      tx.addOutput({
        script: output.script,
        amount: output.amount,
      });
    }

    tx.sign(privateKeyBytes);
    tx.finalize();

    return tx.hex;
  } finally {
    privateKeyBytes.fill(0);
  }
}

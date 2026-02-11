/**
 * Optional transaction signing using @scure/btc-signer and @noble libraries.
 * Only used when SIGNER_PRIVATE_KEY and SIGNER_ADDRESS env vars are set.
 */
import { Transaction, p2pkh, p2wpkh, p2sh, p2tr } from '@scure/btc-signer';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { createBase58check } from '@scure/base';

const base58check = createBase58check(sha256);

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
 */
export function decodeWIF(wif: string): { privateKey: string; compressed: boolean } {
  const decoded = base58check.decode(wif);
  if (decoded[0] !== 0x80) {
    throw new Error('Invalid WIF version byte');
  }
  const compressed = decoded.length === 34;
  const privBytes = decoded.slice(1, 33);
  return {
    privateKey: bytesToHex(privBytes),
    compressed,
  };
}

/**
 * Get the public key from a private key hex.
 */
function getPublicKey(privateKeyHex: string, compressed: boolean): Uint8Array {
  return secp256k1.getPublicKey(hexToBytes(privateKeyHex), compressed);
}

/**
 * Create the appropriate payment script for an address type.
 */
function paymentScript(pubkeyBytes: Uint8Array, addressType: AddressType) {
  switch (addressType) {
    case 'p2pkh':
      return p2pkh(pubkeyBytes);
    case 'p2wpkh':
      return p2wpkh(pubkeyBytes);
    case 'p2sh-p2wpkh':
      return p2sh(p2wpkh(pubkeyBytes));
    case 'p2tr':
      // For taproot, use x-only pubkey (drop the prefix byte)
      return p2tr(pubkeyBytes.slice(1, 33));
    default:
      throw new Error(`Unsupported address type: ${addressType}`);
  }
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
const CNTRPRTY_PREFIX_HEX = '434e545250525459';
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

/**
 * Check if a byte array starts with the CNTRPRTY prefix.
 */
function hasCntrprtyPrefix(data: Uint8Array): boolean {
  if (data.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (data[i] !== CNTRPRTY_PREFIX[i]) return false;
  }
  return true;
}

/**
 * Extract a push data segment from an OP_RETURN script.
 * Returns the pushed data bytes, or null if parsing fails.
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
    // Direct push (1-75 bytes)
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
 * This function tries decryption first, then checks for an unencrypted prefix.
 * Returns the decrypted Counterparty data as hex (including CNTRPRTY prefix), or null.
 * This is done locally — no API call — so it does not trust the node.
 */
export function extractOpReturnData(rawTransactionHex: string): string | null {
  const rawTxBytes = hexToBytes(rawTransactionHex);
  const tx = Transaction.fromRaw(rawTxBytes, {
    allowUnknownInputs: true,
    allowUnknownOutputs: true,
    allowLegacyWitnessUtxo: true,
    disableScriptCheck: true,
  });

  // Get first input's txid for ARC4 decryption key
  let arc4Key: Uint8Array | null = null;
  if (tx.inputsLength > 0) {
    const firstInput = tx.getInput(0);
    if (firstInput?.txid) {
      // txid may be Uint8Array or hex string depending on btc-signer version
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
 * Uses API-provided input values and lock scripts when available (SegWit optimization).
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

    const rawTxBytes = hexToBytes(rawTransactionHex);
    const parsedTx = Transaction.fromRaw(rawTxBytes, {
      allowUnknownInputs: true,
      allowUnknownOutputs: true,
      allowLegacyWitnessUtxo: true,
      disableScriptCheck: true,
    });

    const tx = new Transaction({
      allowUnknownInputs: true,
      allowUnknownOutputs: true,
      allowLegacyWitnessUtxo: true,
      disableScriptCheck: true,
    });

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

      if (isLegacy) {
        // For legacy P2PKH, we need nonWitnessUtxo (full prev tx)
        // Since the MCP server doesn't have mempool access, we require API data
        if (!hasApiData) {
          throw new Error(
            'Legacy P2PKH signing requires input values and lock scripts from the compose response. ' +
            'Use compose with verbose=true to get this data.'
          );
        }
        // Use witnessUtxo even for legacy when we have API data
        // btc-signer handles this with allowLegacyWitnessUtxo
        inputData.witnessUtxo = {
          script: hexToBytes(lockScripts[i]),
          amount: BigInt(inputValues[i]),
        };
      } else if (hasApiData) {
        // SegWit with API-provided data
        inputData.witnessUtxo = {
          script: hexToBytes(lockScripts[i]),
          amount: BigInt(inputValues[i]),
        };
        if (config.addressType === 'p2sh-p2wpkh') {
          const redeemScript = p2wpkh(pubkeyBytes).script;
          if (redeemScript) {
            inputData.redeemScript = redeemScript;
          }
        }
      } else {
        throw new Error(
          'Signing requires input values and lock scripts from the compose response. ' +
          'Use compose with verbose=true to get this data.'
        );
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

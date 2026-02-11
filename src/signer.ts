/**
 * Optional transaction signing using @scure/btc-signer and @noble libraries.
 * Only used when PRIVATE_KEY and ADDRESS env vars are set.
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
 * Returns null if PRIVATE_KEY and ADDRESS are not set.
 * Logs an error and returns null if they are set but invalid.
 */
export function initSigningConfig(): SigningConfig | null {
  const wif = process.env.PRIVATE_KEY;
  const address = process.env.ADDRESS;

  if (!wif && !address) {
    return null;
  }

  if (!wif || !address) {
    console.error('Error: Both PRIVATE_KEY and ADDRESS must be set for signing. Got only one.');
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
    console.error(`Error: Invalid PRIVATE_KEY: ${message}`);
    return null;
  }
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

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { decodeWIF, detectAddressType, initSigningConfig } from './signer.js';

describe('detectAddressType', () => {
  test('detects p2wpkh from bc1q prefix', () => {
    expect(detectAddressType('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')).toBe('p2wpkh');
  });

  test('detects p2wpkh from tb1q prefix (testnet)', () => {
    expect(detectAddressType('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx')).toBe('p2wpkh');
  });

  test('detects p2tr from bc1p prefix', () => {
    expect(detectAddressType('bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297')).toBe('p2tr');
  });

  test('detects p2tr from tb1p prefix (testnet)', () => {
    expect(detectAddressType('tb1pqqqqp399et2xygdj5xreqhjjvcmzhxw4aywxecjdzew6hylgvsesf3hn0c')).toBe('p2tr');
  });

  test('detects p2sh-p2wpkh from 3 prefix', () => {
    expect(detectAddressType('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe('p2sh-p2wpkh');
  });

  test('detects p2sh-p2wpkh from 2 prefix (testnet)', () => {
    expect(detectAddressType('2N3oefVeg6stiTb5Kh3ozCRPPqGHR84nK1k')).toBe('p2sh-p2wpkh');
  });

  test('detects p2pkh from 1 prefix', () => {
    expect(detectAddressType('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe('p2pkh');
  });

  test('detects p2pkh from m prefix (testnet)', () => {
    expect(detectAddressType('mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn')).toBe('p2pkh');
  });

  test('detects p2pkh from n prefix (testnet)', () => {
    expect(detectAddressType('n1C8nsmi4sc4hMBGgVZrnhxAfS1hyEhkP8')).toBe('p2pkh');
  });
});

describe('decodeWIF', () => {
  // Well-known test vectors
  // WIF for private key 0x01 (compressed, mainnet)
  const KNOWN_WIF_COMPRESSED = 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn';
  // WIF for private key 0x01 (uncompressed, mainnet)
  const KNOWN_WIF_UNCOMPRESSED = '5HpHagT65TZzG1PH3CSu63k8DbpvD8s5ip4nEB3kEsreAnchuDf';

  test('decodes compressed WIF correctly', () => {
    const result = decodeWIF(KNOWN_WIF_COMPRESSED);
    expect(result.compressed).toBe(true);
    expect(result.privateKey).toBe('0000000000000000000000000000000000000000000000000000000000000001');
  });

  test('decodes uncompressed WIF correctly', () => {
    const result = decodeWIF(KNOWN_WIF_UNCOMPRESSED);
    expect(result.compressed).toBe(false);
    expect(result.privateKey).toBe('0000000000000000000000000000000000000000000000000000000000000001');
  });

  test('throws on invalid WIF', () => {
    expect(() => decodeWIF('notavalidwif')).toThrow();
  });
});

describe('initSigningConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  test('returns null when neither PRIVATE_KEY nor ADDRESS is set', () => {
    delete process.env.PRIVATE_KEY;
    delete process.env.ADDRESS;
    expect(initSigningConfig()).toBeNull();
  });

  test('returns null and logs error when only PRIVATE_KEY is set', () => {
    process.env.PRIVATE_KEY = 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn';
    delete process.env.ADDRESS;
    expect(initSigningConfig()).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Both PRIVATE_KEY and ADDRESS must be set')
    );
  });

  test('returns null and logs error when only ADDRESS is set', () => {
    delete process.env.PRIVATE_KEY;
    process.env.ADDRESS = 'bc1qtest';
    expect(initSigningConfig()).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Both PRIVATE_KEY and ADDRESS must be set')
    );
  });

  test('returns null and logs error for invalid WIF', () => {
    process.env.PRIVATE_KEY = 'invalid-wif-key';
    process.env.ADDRESS = 'bc1qtest';
    expect(initSigningConfig()).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid PRIVATE_KEY')
    );
  });

  test('returns config for valid WIF + p2wpkh address', () => {
    process.env.PRIVATE_KEY = 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn';
    process.env.ADDRESS = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
    const config = initSigningConfig();
    expect(config).not.toBeNull();
    expect(config!.addressType).toBe('p2wpkh');
    expect(config!.compressed).toBe(true);
    expect(config!.address).toBe('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
    expect(config!.privateKeyHex).toBe('0000000000000000000000000000000000000000000000000000000000000001');
  });

  test('returns config for valid WIF + p2tr address', () => {
    process.env.PRIVATE_KEY = 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn';
    process.env.ADDRESS = 'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297';
    const config = initSigningConfig();
    expect(config).not.toBeNull();
    expect(config!.addressType).toBe('p2tr');
  });
});

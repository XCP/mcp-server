import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { decodeWIF, detectAddressType, initSigningConfig, extractOpReturnData } from './signer.js';

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

  test('returns null when neither SIGNER_PRIVATE_KEY nor SIGNER_ADDRESS is set', () => {
    delete process.env.SIGNER_PRIVATE_KEY;
    delete process.env.SIGNER_ADDRESS;
    expect(initSigningConfig()).toBeNull();
  });

  test('returns null and logs error when only SIGNER_PRIVATE_KEY is set', () => {
    process.env.SIGNER_PRIVATE_KEY = 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn';
    delete process.env.SIGNER_ADDRESS;
    expect(initSigningConfig()).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Both SIGNER_PRIVATE_KEY and SIGNER_ADDRESS must be set')
    );
  });

  test('returns null and logs error when only SIGNER_ADDRESS is set', () => {
    delete process.env.SIGNER_PRIVATE_KEY;
    process.env.SIGNER_ADDRESS = 'bc1qtest';
    expect(initSigningConfig()).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Both SIGNER_PRIVATE_KEY and SIGNER_ADDRESS must be set')
    );
  });

  test('returns null and logs error for invalid WIF', () => {
    process.env.SIGNER_PRIVATE_KEY = 'invalid-wif-key';
    process.env.SIGNER_ADDRESS = 'bc1qtest';
    expect(initSigningConfig()).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid SIGNER_PRIVATE_KEY')
    );
  });

  test('returns config for valid WIF + p2wpkh address', () => {
    process.env.SIGNER_PRIVATE_KEY = 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn';
    process.env.SIGNER_ADDRESS = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
    const config = initSigningConfig();
    expect(config).not.toBeNull();
    expect(config!.addressType).toBe('p2wpkh');
    expect(config!.compressed).toBe(true);
    expect(config!.address).toBe('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
    expect(config!.privateKeyHex).toBe('0000000000000000000000000000000000000000000000000000000000000001');
  });

  test('returns null and logs error for P2PKH address (unsupported for signing)', () => {
    process.env.SIGNER_PRIVATE_KEY = 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn';
    process.env.SIGNER_ADDRESS = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
    expect(initSigningConfig()).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('P2PKH')
    );
  });

  test('returns config for valid WIF + p2tr address', () => {
    process.env.SIGNER_PRIVATE_KEY = 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn';
    process.env.SIGNER_ADDRESS = 'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297';
    const config = initSigningConfig();
    expect(config).not.toBeNull();
    expect(config!.addressType).toBe('p2tr');
  });
});

describe('extractOpReturnData', () => {
  // Real Counterparty enhanced send tx from regtest
  const ENHANCED_SEND_TX =
    '0200000001ba5700bc287fc2f9050f298763e1053db0ec5de5124802c62f5714b2063becf20000000000ffffffff02' +
    '0000000000000000286a26b7d869ce76c2f94b67bbb31ba031659ee146f4e6464448d6d486c3e691b4e96d96bc5ed10cfc' +
    '1019062a010000001600147dd0e88c1799b7a9d8f3fdc3b51dc748a2fa672900000000';

  // Real Counterparty dispenser tx from regtest
  const DISPENSER_TX =
    '020000000142922a5a8a296322a367a65b624df737265b3b501319dab86884e11647d0b57a0200000000ffffffff02' +
    '00000000000000002c6a2a43f74aa0cc03590e96135ac2abc01bedf81ae5c8ad1dd0418f85a194f74449c1adc1ea69040b63fda22d' +
    '2314092701000000160014e59793a6189579b19e2c9a162b169d55d0fad3c900000000';

  // Regular Bitcoin tx (no Counterparty data)
  const REGULAR_BTC_TX =
    '0200000001aad73931018bd25f84ae400b68df0817e57e3e8e36b6e66ea1b0d8f9e7a1d5e10000000000fdffffff01' +
    '10270000000000001976a9144b3518229b0d3554fe7cd3796ade632aff3069d888ac00000000';

  test('extracts CNTRPRTY data from enhanced send tx', () => {
    const data = extractOpReturnData(ENHANCED_SEND_TX);
    expect(data).not.toBeNull();
    expect(data!.startsWith('434e545250525459')).toBe(true); // CNTRPRTY prefix
  });

  test('extracts CNTRPRTY data from dispenser tx', () => {
    const data = extractOpReturnData(DISPENSER_TX);
    expect(data).not.toBeNull();
    expect(data!.startsWith('434e545250525459')).toBe(true);
  });

  test('returns null for regular Bitcoin tx without Counterparty data', () => {
    const data = extractOpReturnData(REGULAR_BTC_TX);
    expect(data).toBeNull();
  });
});

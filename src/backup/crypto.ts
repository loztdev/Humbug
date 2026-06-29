import CryptoJS from 'crypto-js';

/**
 * Pure passphrase-based encryption for backups. Kept free of native deps so the
 * round-trip is unit-testable: the caller supplies the random salt/iv (generated
 * with a secure RNG in the app layer), and these functions do only the KDF +
 * AES. Scheme: PBKDF2(SHA-256) key derivation → AES-256-CBC + PKCS7.
 */

export interface EncryptedBlob {
  v: 1;
  alg: 'AES-256-CBC';
  kdf: 'PBKDF2-SHA256';
  salt: string; // hex
  iv: string; // hex
  iterations: number;
  ct: string; // base64 ciphertext
}

export const DEFAULT_ITERATIONS = 150_000;

function deriveKey(passphrase: string, saltHex: string, iterations: number) {
  return CryptoJS.PBKDF2(passphrase, CryptoJS.enc.Hex.parse(saltHex), {
    keySize: 256 / 32,
    iterations,
    hasher: CryptoJS.algo.SHA256,
  });
}

export function encryptString(
  plaintext: string,
  passphrase: string,
  saltHex: string,
  ivHex: string,
  iterations = DEFAULT_ITERATIONS,
): EncryptedBlob {
  const key = deriveKey(passphrase, saltHex, iterations);
  const enc = CryptoJS.AES.encrypt(plaintext, key, {
    iv: CryptoJS.enc.Hex.parse(ivHex),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return {
    v: 1,
    alg: 'AES-256-CBC',
    kdf: 'PBKDF2-SHA256',
    salt: saltHex,
    iv: ivHex,
    iterations,
    ct: enc.ciphertext.toString(CryptoJS.enc.Base64),
  };
}

export function decryptString(blob: EncryptedBlob, passphrase: string): string {
  const key = deriveKey(passphrase, blob.salt, blob.iterations);
  const cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext: CryptoJS.enc.Base64.parse(blob.ct),
  });
  const dec = CryptoJS.AES.decrypt(cipherParams, key, {
    iv: CryptoJS.enc.Hex.parse(blob.iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  let text: string;
  try {
    text = dec.toString(CryptoJS.enc.Utf8);
  } catch {
    throw new Error('Wrong passphrase or corrupt backup.');
  }
  if (!text) throw new Error('Wrong passphrase or corrupt backup.');
  return text;
}

import crypto from 'crypto';
import { env } from './env.js';

function getKey() {
  const b64 = env.aes.keyBase64;
  if (!b64 || b64.trim() === '') {
    throw new Error('AES_KEY_BASE64 is not set');
  }
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) {
    throw new Error('AES_KEY_BASE64 must decode to 32 bytes (AES-256 key)');
  }
  return key;
}

/**
 * Decrypts password sent from frontend using AES-256-GCM.
 *
 * Expected format for `encryptedPassword`:
 * - String: "ivBase64.tagBase64.ciphertextBase64"
 *
 * (We use 12-byte IV on frontend; tag is 16 bytes.)
 */
export function decryptPassword(encryptedPassword) {
  if (!encryptedPassword || typeof encryptedPassword !== 'string') {
    throw new Error('encryptedPassword must be a string');
  }
  const parts = encryptedPassword.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encryptedPassword format');
  }
  const [ivB64, tagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}


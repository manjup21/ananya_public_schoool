function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function importAesKey() {
  const keyB64 = import.meta.env.VITE_AES_KEY_BASE64;
  if (!keyB64) throw new Error('VITE_AES_KEY_BASE64 is not set');
  const rawKey = base64ToBytes(keyB64);
  if (rawKey.byteLength !== 32) throw new Error('VITE_AES_KEY_BASE64 must decode to 32 bytes');
  return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt']);
}

/**
 * AES-256-GCM encrypt password for backend.
 * Returns string: "ivBase64.tagBase64.ciphertextBase64"
 */
export async function encryptPassword(plainPassword) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importAesKey();
  const enc = new TextEncoder().encode(String(plainPassword));

  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc));
  // WebCrypto returns ciphertext||tag (tag is last 16 bytes by default)
  const tag = encrypted.slice(encrypted.length - 16);
  const ciphertext = encrypted.slice(0, encrypted.length - 16);

  return `${bytesToBase64(iv)}.${bytesToBase64(tag)}.${bytesToBase64(ciphertext)}`;
}


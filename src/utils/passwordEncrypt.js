import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT = 'scan2reword-password-view';

/**
 * Derive a 32-byte key from env secret for AES-256.
 * Set PASSWORD_VIEW_SECRET in .env (min 16 chars recommended).
 */
function getKey() {
  const secret = process.env.PASSWORD_VIEW_SECRET || 'default-change-in-production';
  return crypto.scryptSync(secret, SALT, KEY_LENGTH);
}

/**
 * Encrypt plain text (reversible) so admin can view manager/staff password.
 * @param {string} plain - Plain password
 * @returns {string} Base64(IV + ciphertext), or null if plain is empty
 */
export function encryptPassword(plain) {
  if (plain == null || String(plain).trim() === '') return null;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, enc]).toString('base64');
}

/**
 * Decrypt encrypted value back to plain password.
 * @param {string} encrypted - Base64(IV + ciphertext) from encryptPassword
 * @returns {string|null} Plain password or null
 */
export function decryptPassword(encrypted) {
  if (encrypted == null || String(encrypted).trim() === '') return null;
  try {
    const key = getKey();
    const buf = Buffer.from(encrypted, 'base64');
    if (buf.length < IV_LENGTH) return null;
    const iv = buf.subarray(0, IV_LENGTH);
    const data = buf.subarray(IV_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    return decipher.update(data) + decipher.final('utf8');
  } catch {
    return null;
  }
}

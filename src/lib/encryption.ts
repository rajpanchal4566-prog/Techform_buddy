import crypto from 'crypto';

/**
 * Encrypted Document Storage at Rest
 *
 * Implements AES-256-GCM authenticated encryption for user documents stored in the database.
 * Every document is encrypted before persistence and decrypted only when requested
 * by its authenticated owner.
 */

const MAGIC_PREFIX = Buffer.from('ENC1'); // 4-byte identifier

function getEncryptionKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'techform-buddy-document-encryption-secret-key-32b';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt document buffer with AES-256-GCM.
 * Packed format: [MAGIC (4B)][IV (12B)][AuthTag (16B)][Ciphertext]
 */
export function encryptDocument(data: Buffer): Buffer {
  if (!data || data.length === 0) return data;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([MAGIC_PREFIX, iv, authTag, ciphertext]);
}

/**
 * Decrypt document buffer with AES-256-GCM.
 * Safely handles unencrypted / legacy records by inspecting the header.
 */
export function decryptDocument(encryptedData: Buffer): Buffer {
  if (!encryptedData || encryptedData.length < 32) {
    return encryptedData;
  }

  // Inspect magic prefix
  if (!encryptedData.subarray(0, 4).equals(MAGIC_PREFIX)) {
    // Legacy or unencrypted buffer
    return encryptedData;
  }

  try {
    const key = getEncryptionKey();
    const iv = encryptedData.subarray(4, 16);
    const authTag = encryptedData.subarray(16, 32);
    const ciphertext = encryptedData.subarray(32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (err) {
    console.warn('[Encryption] Failed decrypting document buffer, returning fallback:', err);
    return encryptedData;
  }
}


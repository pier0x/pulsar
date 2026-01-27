import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get the encryption key from environment or generate a deterministic one
 * In production, ENCRYPTION_SECRET should be set in environment
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET || "pulsar-default-secret-change-in-production";
  // Use scrypt to derive a proper 32-byte key from the secret
  return scryptSync(secret, "pulsar-salt", 32);
}

/**
 * Encrypt a string value (e.g., API key)
 * Returns base64-encoded string: iv:authTag:encryptedData
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encryptedData (all hex encoded)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt a string value
 * Expects base64-encoded string: iv:authTag:encryptedData
 */
export function decrypt(encryptedValue: string): string {
  const key = getEncryptionKey();
  
  const parts = encryptedValue.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted value format");
  }
  
  const [ivHex, authTagHex, encryptedData] = parts;
  
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Check if a value is encrypted (basic format check)
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 3 && 
    parts[0].length === IV_LENGTH * 2 && 
    parts[1].length === AUTH_TAG_LENGTH * 2;
}

/**
 * Safely decrypt - returns null if decryption fails
 */
export function safeDecrypt(encryptedValue: string): string | null {
  try {
    return decrypt(encryptedValue);
  } catch {
    return null;
  }
}

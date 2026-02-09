/**
 * Secure encryption/decryption utilities for sensitive data
 *
 * Uses AES-256-GCM for authenticated encryption:
 * - AES-256: Strong symmetric encryption
 * - GCM: Galois/Counter Mode provides both confidentiality and authenticity
 * - Random IV: Each encryption uses a unique initialization vector
 * - Auth Tag: Prevents tampering and ensures data integrity
 *
 * @example
 * ```typescript
 * const encrypted = encrypt('sensitive-token')
 * const decrypted = decrypt(encrypted) // Returns original value
 * ```
 */

import crypto from 'crypto'
import { createLogger } from '@/lib/logger'

const logger = createLogger('encryption')

// Encryption algorithm: AES-256-GCM (authenticated encryption)
const ALGORITHM = 'aes-256-gcm'

// IV (Initialization Vector) length: 16 bytes (128 bits) for GCM
const IV_LENGTH = 16

// Auth tag length: 16 bytes (128 bits)
const AUTH_TAG_LENGTH = 16

// Expected key length: 32 bytes (256 bits)
const KEY_LENGTH = 32

/**
 * Validates and retrieves the encryption key from environment
 * @throws {Error} If key is missing or invalid
 */
function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY

  if (!key) {
    logger.error('ENCRYPTION_KEY environment variable is not set')
    throw new Error('Encryption configuration error')
  }

  let keyBuffer: Buffer
  try {
    keyBuffer = Buffer.from(key, 'hex')
  } catch (error) {
    logger.error({ error }, 'Invalid ENCRYPTION_KEY format')
    throw new Error('Encryption configuration error')
  }

  // Validate key length
  if (keyBuffer.length !== KEY_LENGTH) {
    logger.error(
      { actual: keyBuffer.length, expected: KEY_LENGTH },
      'Invalid ENCRYPTION_KEY length'
    )
    throw new Error('Encryption configuration error')
  }

  return keyBuffer
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 *
 * Format: `iv:authTag:ciphertext` (all hex-encoded)
 *
 * @param plaintext - The string to encrypt
 * @returns Encrypted string in format `iv:authTag:ciphertext`
 * @throws {Error} If encryption fails
 *
 * @example
 * ```typescript
 * const encrypted = encrypt('my-oauth-token')
 * // Returns: "a1b2c3d4....:e5f6g7h8....:i9j0k1l2...."
 * ```
 */
export function encrypt(plaintext: string): string {
  try {
    const key = getKey()

    // Generate a random IV for this encryption
    const iv = crypto.randomBytes(IV_LENGTH)

    // Create cipher with key and IV
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    // Encrypt the plaintext
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])

    // Get authentication tag for data integrity
    const authTag = cipher.getAuthTag()

    // Return formatted encrypted string: iv:authTag:ciphertext
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
  } catch (error) {
    logger.error({ error }, 'Encryption failed')
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypts a string that was encrypted with the encrypt() function
 *
 * @param encryptedString - The encrypted string in format `iv:authTag:ciphertext`
 * @returns The original plaintext string
 * @throws {Error} If decryption fails or data has been tampered with
 *
 * @example
 * ```typescript
 * const decrypted = decrypt('a1b2c3d4....:e5f6g7h8....:i9j0k1l2....')
 * // Returns: "my-oauth-token"
 * ```
 */
export function decrypt(encryptedString: string): string {
  try {
    const key = getKey()

    // Parse the encrypted string
    const parts = encryptedString.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted string format')
    }

    const [ivHex, authTagHex, ciphertextHex] = parts

    // Validate parts exist
    if (!ivHex || !authTagHex || !ciphertextHex) {
      throw new Error('Missing encrypted string components')
    }

    // Convert from hex to buffers
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const ciphertext = Buffer.from(ciphertextHex, 'hex')

    // Validate component lengths
    if (iv.length !== IV_LENGTH) {
      throw new Error('Invalid IV length')
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error('Invalid auth tag length')
    }

    // Create decipher with key and IV
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)

    // Set auth tag for verification
    decipher.setAuthTag(authTag)

    // Decrypt and verify
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])

    return decrypted.toString('utf8')
  } catch (error) {
    // Log the error but don't expose details to caller
    logger.error({ error }, 'Decryption failed')
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Generates a secure random encryption key
 * Use this to generate a new ENCRYPTION_KEY for your .env file
 *
 * @returns A 32-byte (256-bit) hex-encoded key
 *
 * @example
 * ```typescript
 * const newKey = generateEncryptionKey()
 * console.log('ENCRYPTION_KEY=' + newKey)
 * ```
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex')
}

/**
 * Validates that the ENCRYPTION_KEY is properly configured
 * Useful for startup checks
 *
 * @returns true if valid, false otherwise
 */
export function validateEncryptionKey(): boolean {
  try {
    getKey()
    return true
  } catch {
    return false
  }
}

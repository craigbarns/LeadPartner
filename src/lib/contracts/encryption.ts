import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error('ENCRYPTION_KEY env var is required')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (base64-encoded)')
  }
  return key
}

// Layout: [iv (12)] [tag (16)] [ciphertext (n)]
export function encrypt(plaintext: string): Buffer {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext])
}

export function decrypt(payload: Buffer): string {
  if (payload.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid encrypted payload')
  }
  const iv = payload.subarray(0, IV_LENGTH)
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/**
 * Encrypt a plaintext value for storage in a Postgres `bytea` column via
 * the Supabase JS client. Returns the canonical `\xHEX` literal accepted by
 * PostgREST.
 *
 * Without this conversion the Supabase JS client would JSON-stringify the raw
 * Buffer to `{"type":"Buffer","data":[...]}`, which Postgres stores as garbage
 * and breaks decryption with "Unsupported state or unable to authenticate data".
 */
export function encryptForStorage(plaintext: string): string {
  return '\\x' + encrypt(plaintext).toString('hex')
}

/**
 * Convert any value coming back from a Postgres `bytea` column into a Buffer
 * suitable for `decrypt()`. Handles the three shapes the Supabase JS client
 * may return: native Buffer, Uint8Array, or `\xHEX` / base64 string.
 */
export function bytesFromBytea(value: string | Buffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(value)) return value
  if (value instanceof Uint8Array) return Buffer.from(value)
  if (typeof value === 'string') {
    if (value.startsWith('\\x')) return Buffer.from(value.slice(2), 'hex')
    return Buffer.from(value, 'base64')
  }
  throw new Error('Unsupported encrypted column value')
}

import { describe, it, expect, beforeAll } from 'vitest'
import { encrypt, decrypt, encryptForStorage, bytesFromBytea } from './encryption'

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU='
})

describe('encryption', () => {
  it('round-trips a string', () => {
    const plain = 'FR7630006000011234567890189'
    const encrypted = encrypt(plain)
    expect(encrypted).toBeInstanceOf(Buffer)
    expect(decrypt(encrypted)).toBe(plain)
  })

  it('produces different ciphertexts for the same input (random IV)', () => {
    const a = encrypt('same')
    const b = encrypt('same')
    expect(a.equals(b)).toBe(false)
    expect(decrypt(a)).toBe('same')
    expect(decrypt(b)).toBe('same')
  })

  it('throws when ENCRYPTION_KEY is missing', () => {
    const original = process.env.ENCRYPTION_KEY
    delete process.env.ENCRYPTION_KEY
    expect(() => encrypt('x')).toThrow(/ENCRYPTION_KEY/)
    process.env.ENCRYPTION_KEY = original
  })

  it('throws on tampered ciphertext', () => {
    const ct = encrypt('hello')
    ct[ct.length - 1] ^= 0xff
    expect(() => decrypt(ct)).toThrow()
  })
})

describe('storage round-trip (Postgres bytea simulation)', () => {
  it('encryptForStorage produces a \\\\xHEX literal that round-trips through bytesFromBytea', () => {
    const plain = 'FR7630006000011234567890189'
    const stored = encryptForStorage(plain)
    expect(stored.startsWith('\\x')).toBe(true)
    expect(stored.slice(2)).toMatch(/^[0-9a-f]+$/)

    // Simulate read-back: PostgREST returns the literal as a string
    const readBack = bytesFromBytea(stored)
    expect(decrypt(readBack)).toBe(plain)
  })

  it('bytesFromBytea also accepts native Buffer (driver direct mode)', () => {
    const plain = 'hello'
    const buf = encrypt(plain)
    expect(decrypt(bytesFromBytea(buf))).toBe(plain)
  })

  it('bytesFromBytea accepts Uint8Array', () => {
    const plain = 'hello'
    const buf = encrypt(plain)
    const u8 = new Uint8Array(buf)
    expect(decrypt(bytesFromBytea(u8))).toBe(plain)
  })

  it('bytesFromBytea falls back to base64 for non-\\\\x strings', () => {
    const plain = 'hello'
    const buf = encrypt(plain)
    const b64 = buf.toString('base64')
    expect(decrypt(bytesFromBytea(b64))).toBe(plain)
  })
})

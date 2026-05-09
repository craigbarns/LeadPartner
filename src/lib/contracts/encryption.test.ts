import { describe, it, expect, beforeAll } from 'vitest'
import { encrypt, decrypt } from './encryption'

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

import { describe, it, expect, beforeAll } from 'vitest'
import { createHmac } from 'crypto'
import { verifyYousignSignature } from './webhook'

const SECRET = 'test-webhook-secret-32bytes-aaaaa'

beforeAll(() => {
  process.env.YOUSIGN_WEBHOOK_SECRET = SECRET
})

function sign(body: string): string {
  return createHmac('sha256', SECRET).update(body).digest('hex')
}

describe('verifyYousignSignature', () => {
  it('accepts a valid signature', () => {
    const body = '{"event_id":"abc"}'
    expect(verifyYousignSignature(body, sign(body))).toBe(true)
  })

  it('rejects an invalid signature', () => {
    expect(verifyYousignSignature('{"a":1}', 'deadbeef'.repeat(8))).toBe(false)
  })

  it('rejects an empty signature', () => {
    expect(verifyYousignSignature('{}', '')).toBe(false)
  })

  it('throws if secret env var is missing', () => {
    delete process.env.YOUSIGN_WEBHOOK_SECRET
    expect(() => verifyYousignSignature('{}', 'x')).toThrow(/YOUSIGN_WEBHOOK_SECRET/)
    process.env.YOUSIGN_WEBHOOK_SECRET = SECRET
  })
})

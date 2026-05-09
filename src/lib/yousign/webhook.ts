import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Verifies a Yousign webhook signature.
 * Yousign signs the raw request body with HMAC-SHA256 using the webhook secret.
 * The signature is sent in the `X-Yousign-Signature-256` header (hex).
 */
export function verifyYousignSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.YOUSIGN_WEBHOOK_SECRET
  if (!secret) throw new Error('YOUSIGN_WEBHOOK_SECRET env var is required')
  if (!signature) return false

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  if (expected.length !== signature.length) return false

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

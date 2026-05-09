import { NextResponse } from 'next/server'
import { verifyYousignSignature } from '@/lib/yousign/webhook'
import { downloadSignedPdf } from '@/lib/yousign/create-request'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { YousignWebhookPayload } from '@/lib/yousign/types'

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-yousign-signature-256') ?? ''

  try {
    if (!verifyYousignSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
    }
  } catch (e) {
    return NextResponse.json({ error: 'webhook_misconfigured', detail: (e as Error).message }, { status: 500 })
  }

  let payload: YousignWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any

  // Idempotency: dedupe by event_id
  const { error: dupErr } = await admin
    .from('yousign_events')
    .insert({
      yousign_event_id: payload.event_id,
      event_type: payload.event_name,
      signature_request_id: payload.data.signature_request?.id ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: payload as any,
    })
  if (dupErr) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((dupErr as any).code === '23505') return NextResponse.json({ ok: true, dedup: true })
    return NextResponse.json({ error: 'event_log_failed', detail: dupErr.message }, { status: 500 })
  }

  const sr = payload.data.signature_request
  if (!sr) return NextResponse.json({ ok: true })

  const { data: contract } = await admin
    .from('contracts')
    .select('*')
    .eq('yousign_signature_request_id', sr.id)
    .single()
  if (!contract) {
    console.warn(`Webhook: no contract for SR ${sr.id}`)
    return NextResponse.json({ ok: true, warning: 'contract_not_found' })
  }

  switch (payload.event_name) {
    case 'signature_request.done': {
      const pdf = await downloadSignedPdf(sr.id, contract.yousign_document_id!)
      const signedPath = `${contract.tenant_id}/${contract.id}.pdf`
      const pdfBytes = new Uint8Array(pdf)
      await admin.storage.from('contracts-signed').upload(signedPath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })
      await admin
        .from('contracts')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
          signed_pdf_path: signedPath,
        })
        .eq('id', contract.id)
      break
    }
    case 'signer.declined':
    case 'signature_request.declined': {
      await admin
        .from('contracts')
        .update({ status: 'declined' })
        .eq('id', contract.id)
      break
    }
    case 'signature_request.expired': {
      await admin
        .from('contracts')
        .update({ status: 'expired', expires_at: new Date().toISOString() })
        .eq('id', contract.id)
      break
    }
    default:
      // Other events (signer.notified, signer.signed, etc.) — no-op
      break
  }

  await admin
    .from('yousign_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('yousign_event_id', payload.event_id)

  return NextResponse.json({ ok: true })
}

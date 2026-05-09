import { yousign } from './client'
import type { YousignSignatureRequest, YousignSigner, YousignDocument } from './types'

interface CreateRequestInput {
  name: string
  signerEmail: string
  signerFirstName: string
  signerLastName: string
  signerPhone?: string
  pdfBuffer: Buffer
  pdfFilename: string
  expirationDays?: number
}

export interface CreatedRequest {
  signatureRequestId: string
  documentId: string
  signerId: string
}

/**
 * Creates a Yousign signature request, uploads the PDF, adds the signer
 * with a signature field on the last page, and activates the request
 * (which triggers the email to the signer).
 */
export async function createSignatureRequest(
  input: CreateRequestInput,
): Promise<CreatedRequest> {
  const sr = await yousign.post<YousignSignatureRequest>('/signature_requests', {
    name: input.name,
    delivery_mode: 'email',
    timezone: 'Europe/Paris',
    expiration_date: new Date(
      Date.now() + (input.expirationDays ?? 30) * 86400 * 1000,
    ).toISOString().slice(0, 10),
  })

  const form = new FormData()
  const pdfBytes = new Uint8Array(input.pdfBuffer)
  form.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), input.pdfFilename)
  form.append('nature', 'signable_document')
  const doc = await yousign.postForm<YousignDocument>(
    `/signature_requests/${sr.id}/documents`,
    form,
  )

  const signer = await yousign.post<YousignSigner>(
    `/signature_requests/${sr.id}/signers`,
    {
      info: {
        first_name: input.signerFirstName,
        last_name: input.signerLastName,
        email: input.signerEmail,
        phone_number: input.signerPhone,
        locale: 'fr',
      },
      signature_level: 'electronic_signature',
      signature_authentication_mode: 'no_otp',
      fields: [
        {
          type: 'signature',
          document_id: doc.id,
          page: -1,
          x: 350,
          y: 600,
          width: 200,
          height: 80,
        },
      ],
    },
  )

  await yousign.post(`/signature_requests/${sr.id}/activate`, {})

  return {
    signatureRequestId: sr.id,
    documentId: doc.id,
    signerId: signer.id,
  }
}

/**
 * Downloads the signed PDF as a Buffer.
 */
export async function downloadSignedPdf(
  signatureRequestId: string,
  documentId: string,
): Promise<Buffer> {
  const apiKey = process.env.YOUSIGN_API_KEY
  const apiBase = process.env.YOUSIGN_API_BASE ?? 'https://api-sandbox.yousign.app/v3'
  if (!apiKey) throw new Error('YOUSIGN_API_KEY is not configured')

  const url = `${apiBase}/signature_requests/${signatureRequestId}/documents/${documentId}/download`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`Failed to download signed PDF: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

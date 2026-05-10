import { createServiceRoleClient } from '@/lib/supabase/server'
import { downloadSignedPdf } from '@/lib/yousign/create-request'
import { yousign } from '@/lib/yousign/client'
import type { YousignSignatureRequest } from '@/lib/yousign/types'

type ContractRow = {
  id: string
  tenant_id: string
  status: string
  yousign_signature_request_id: string | null
  yousign_document_id: string | null
}

export async function syncContractWithYousign(contractId: string): Promise<ContractRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceRoleClient() as any

  const { data: contract, error } = await admin
    .from('contracts')
    .select('id, tenant_id, status, yousign_signature_request_id, yousign_document_id')
    .eq('id', contractId)
    .single()

  if (error || !contract) return null
  if (!contract.yousign_signature_request_id || !contract.yousign_document_id) return contract
  if (contract.status === 'signed' || contract.status === 'declined' || contract.status === 'expired') {
    return contract
  }

  const signatureRequest = await yousign.get<YousignSignatureRequest>(
    `/signature_requests/${contract.yousign_signature_request_id}`,
  )

  if (signatureRequest.status === 'done') {
    const pdf = await downloadSignedPdf(
      contract.yousign_signature_request_id,
      contract.yousign_document_id,
    )
    const signedPath = `${contract.tenant_id}/${contract.id}.pdf`
    const pdfBytes = new Uint8Array(pdf)
    const { error: uploadError } = await admin.storage
      .from('contracts-signed')
      .upload(signedPath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) throw new Error(`signed_contract_upload_failed: ${uploadError.message}`)

    const { data: updated, error: updateError } = await admin
      .from('contracts')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signed_pdf_path: signedPath,
      })
      .eq('id', contract.id)
      .select('id, tenant_id, status, yousign_signature_request_id, yousign_document_id')
      .single()

    if (updateError || !updated) {
      throw new Error(`signed_contract_update_failed: ${updateError?.message ?? 'no row returned'}`)
    }

    return updated
  }

  if (signatureRequest.status === 'declined' || signatureRequest.status === 'expired' || signatureRequest.status === 'canceled') {
    const { data: updated, error: updateError } = await admin
      .from('contracts')
      .update({ status: signatureRequest.status })
      .eq('id', contract.id)
      .select('id, tenant_id, status, yousign_signature_request_id, yousign_document_id')
      .single()

    if (updateError || !updated) {
      throw new Error(`contract_status_update_failed: ${updateError?.message ?? 'no row returned'}`)
    }

    return updated
  }

  return contract
}

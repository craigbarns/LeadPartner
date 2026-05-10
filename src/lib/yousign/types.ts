export interface YousignSignatureRequest {
  id: string
  status: 'draft' | 'ongoing' | 'done' | 'declined' | 'expired' | 'canceled'
  delivery_mode: 'email' | 'none'
  signers: YousignSigner[]
  documents: YousignDocument[]
}

export interface YousignSigner {
  id: string
  status: 'initiated' | 'notified' | 'signed' | 'declined' | 'expired'
  info: {
    first_name: string
    last_name: string
    email: string
    phone_number?: string
    locale: string
  }
}

export interface YousignDocument {
  id: string
  filename: string
  nature: 'signable_document' | 'attachment'
  total_pages?: number
}

export interface YousignWebhookPayload {
  event_id: string
  event_name: string
  event_time: string
  data: {
    signature_request: YousignSignatureRequest
    signer?: YousignSigner
  }
}

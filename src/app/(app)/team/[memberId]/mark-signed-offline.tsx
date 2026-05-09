'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { markSignedOffline } from './actions'

export function MarkSignedOfflineButton({ memberId }: { memberId: string }) {
  const [busy, setBusy] = useState(false)

  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        if (!confirm('Marquer ce contrat comme signé hors-ligne ? Cette action est tracée.')) return
        setBusy(true)
        try {
          await markSignedOffline(memberId)
        } finally {
          setBusy(false)
        }
      }}
    >
      Marquer comme signé hors-ligne
    </Button>
  )
}

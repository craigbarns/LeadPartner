import { renderToBuffer } from '@react-pdf/renderer'
import { ContractDocument } from './template'
import type { ContractSnapshot } from './types'

export async function generateContractPDF(
  snapshot: ContractSnapshot,
): Promise<Buffer> {
  return renderToBuffer(<ContractDocument snapshot={snapshot} />)
}

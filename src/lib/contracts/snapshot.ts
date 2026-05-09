export function maskIban(iban: string): string {
  const cleaned = iban.replace(/\s+/g, '')
  if (cleaned.length < 8) return '****'
  const last4 = cleaned.slice(-4)
  const cc = cleaned.slice(0, 2)
  return `${cc}**** **** **** ${last4}`
}

export function maskSSN(ssn: string): string {
  const cleaned = ssn.replace(/\s+/g, '')
  if (cleaned.length < 8) return '****'
  const last4 = cleaned.slice(-4)
  return `${'*'.repeat(cleaned.length - 4)}${last4.slice(0, 2)} ${last4.slice(2)}`
}

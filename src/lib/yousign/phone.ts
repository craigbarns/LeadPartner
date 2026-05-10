/**
 * Yousign exige un numéro E.164 valide pour `info.phone_number`.
 * Retourne `undefined` si le champ est vide ou non reconnu : le payload n’inclut alors pas la clé.
 */
export function formatPhoneForYousign(phone: string | null | undefined): string | undefined {
  if (phone == null) return undefined
  const trimmed = phone.trim()
  if (!trimmed) return undefined

  const noSpaces = trimmed.replace(/[\s.\-()/]/g, '')
  if (!noSpaces) return undefined

  if (noSpaces.startsWith("+")) {
    const rest = noSpaces.slice(1).replace(/\D/g, "")
    if (rest.length >= 8 && rest.length <= 15) return `+${rest}`
    return undefined
  }

  const digitsOnly = noSpaces.replace(/\D/g, "")
  if (!digitsOnly) return undefined

  // France : 0X XX XX XX XX (10 chiffres)
  if (/^0\d{9}$/.test(digitsOnly)) {
    return `+33${digitsOnly.slice(1)}`
  }

  // Déjà 33XXXXXXXXX sans +
  if (/^33\d{9}$/.test(digitsOnly)) {
    return `+${digitsOnly}`
  }

  return undefined
}

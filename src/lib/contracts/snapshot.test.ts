import { describe, it, expect } from 'vitest'
import { maskIban, maskSSN } from './snapshot'

describe('snapshot helpers', () => {
  it('masks IBAN to last 4 digits', () => {
    expect(maskIban('FR7630006000011234567890189')).toBe('FR**** **** **** 0189')
  })

  it('masks SSN to last 4 digits', () => {
    expect(maskSSN('1850275123456 78')).toBe('***********56 78')
  })

  it('handles short input gracefully', () => {
    expect(maskIban('ABC')).toBe('****')
    expect(maskSSN('1')).toBe('****')
  })
})

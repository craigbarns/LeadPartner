import { describe, it, expect } from 'vitest'
import { generateContractPDF } from './generator'
import type { ContractSnapshot } from './types'

const baseSnapshot: ContractSnapshot = {
  generated_at: '2026-05-09T12:00:00Z',
  tenant: {
    legal_name: 'Test Real Estate SAS',
    legal_form: 'SAS',
    siret: '12345678900012',
    rcs_city: 'Paris',
    capital: 10000,
    legal_address: '1 rue Test, 75001 Paris',
    representative_name: 'Jean Dupont',
    representative_role: 'Président',
    industry: 'real_estate',
    carte_t_number: 'CPI 1234',
    carte_t_city: 'Paris',
    caisse_garantie: 'CEGC',
  },
  referrer: {
    status: 'individual',
    first_name: 'Marie',
    last_name: 'Martin',
    email: 'marie@example.com',
    birth_date: '1985-03-15',
    birth_place: 'Lyon',
    nationality: 'Française',
    address: '5 avenue Test',
    postal_code: '75002',
    city: 'Paris',
    country: 'France',
    phone: '+33612345678',
    social_security_number_masked: '***********56 78',
    iban_masked: 'FR**** **** **** 0189',
  },
  commission_rule: {
    name: 'Standard',
    type: 'percentage',
    base: 'contract_amount',
    percentage: 5,
  },
  contract_duration_months: 12,
  jurisdiction_city: 'Paris',
}

describe('generateContractPDF', () => {
  it('produces a non-empty PDF buffer (individual / real_estate)', async () => {
    const buf = await generateContractPDF(baseSnapshot)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(1000)
    expect(buf.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('produces a PDF for auto_entrepreneur in insurance', async () => {
    const snap: ContractSnapshot = {
      ...baseSnapshot,
      tenant: { ...baseSnapshot.tenant, industry: 'insurance', orias_number: '12345678' },
      referrer: {
        status: 'auto_entrepreneur',
        first_name: 'Paul',
        last_name: 'Bernard',
        email: 'paul@example.com',
        birth_date: '1990-01-01',
        address: '10 rue Test',
        postal_code: '69001',
        city: 'Lyon',
        country: 'France',
        phone: '+33611111111',
        siret: '98765432100012',
        naf_code: '7022Z',
        vat_applicable: false,
        iban_masked: 'FR**** **** **** 0189',
      },
    }
    const buf = await generateContractPDF(snap)
    expect(buf.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('produces a PDF for company in credit', async () => {
    const snap: ContractSnapshot = {
      ...baseSnapshot,
      tenant: { ...baseSnapshot.tenant, industry: 'credit', orias_number: '99999999' },
      referrer: {
        status: 'company',
        email: 'contact@apporteur.fr',
        phone: '+33144444444',
        company_name: 'Apporteur SARL',
        legal_form: 'SARL',
        siret: '11122233300012',
        rcs_city: 'Paris',
        capital: 50000,
        address: '20 rue Test',
        postal_code: '75003',
        city: 'Paris',
        country: 'France',
        vat_applicable: true,
        vat_number: 'FR12345678901',
        legal_representative_name: 'Sophie Durand',
        legal_representative_role: 'Gérante',
        iban_masked: 'FR**** **** **** 0189',
      },
    }
    const buf = await generateContractPDF(snap)
    expect(buf.subarray(0, 4).toString()).toBe('%PDF')
  })
})

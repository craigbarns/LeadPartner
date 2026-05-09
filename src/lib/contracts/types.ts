import type { Database } from '@/types/database'

export type IndustryCode = Database['public']['Enums']['industry_code']
export type ReferrerStatus = Database['public']['Enums']['referrer_status']

export interface TenantSnapshot {
  legal_name: string
  legal_form: string
  siret: string
  rcs_city: string
  capital: number
  legal_address: string
  representative_name: string
  representative_role: string
  industry: IndustryCode
  carte_t_number?: string
  carte_t_city?: string
  caisse_garantie?: string
  orias_number?: string
  primary_color?: string
  logo_url?: string
}

export interface IndividualSnapshot {
  status: 'individual'
  first_name: string
  last_name: string
  email: string
  birth_date: string
  birth_place: string
  nationality: string
  address: string
  postal_code: string
  city: string
  country: string
  phone: string
  social_security_number_masked: string
  iban_masked: string
}

export interface AutoEntrepreneurSnapshot {
  status: 'auto_entrepreneur'
  first_name: string
  last_name: string
  email: string
  birth_date: string
  address: string
  postal_code: string
  city: string
  country: string
  phone: string
  siret: string
  naf_code: string
  vat_applicable: boolean
  vat_number?: string
  iban_masked: string
}

export interface CompanySnapshot {
  status: 'company'
  email: string
  phone: string
  company_name: string
  legal_form: string
  siret: string
  rcs_city: string
  capital: number
  address: string
  postal_code: string
  city: string
  country: string
  vat_applicable: boolean
  vat_number?: string
  legal_representative_name: string
  legal_representative_role: string
  iban_masked: string
}

export type ReferrerSnapshot =
  | IndividualSnapshot
  | AutoEntrepreneurSnapshot
  | CompanySnapshot

export interface CommissionRuleSnapshot {
  name: string
  type: 'fixed' | 'percentage' | 'tiered'
  base: 'contract_amount' | 'fees' | 'signed_quote' | 'collected_revenue'
  percentage?: number
  fixed_amount?: number
  tiers?: Array<{ from: number; to: number | null; rate: number }>
}

export interface ContractSnapshot {
  generated_at: string
  tenant: TenantSnapshot
  referrer: ReferrerSnapshot
  commission_rule: CommissionRuleSnapshot
  contract_duration_months: number
  jurisdiction_city: string
}

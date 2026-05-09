import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { ContractSnapshot, CommissionRuleSnapshot } from './types'
import { COMMON_CLAUSES } from './clauses/common'
import { getIndustryClauses } from './clauses/industry'
import { getStatusClauses } from './clauses/status'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', lineHeight: 1.5 },
  title: { fontSize: 16, marginBottom: 16, textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  h2: { fontSize: 12, marginTop: 14, marginBottom: 6, fontFamily: 'Helvetica-Bold' },
  paragraph: { marginBottom: 6, textAlign: 'justify' },
  party: { marginBottom: 8 },
  partyLabel: { fontFamily: 'Helvetica-Bold' },
  signatureRow: { marginTop: 30, flexDirection: 'row', justifyContent: 'space-between' },
  signatureBox: { width: '45%', borderTop: 1, paddingTop: 6 },
  small: { fontSize: 8, color: '#666' },
})

function baseLabel(base: CommissionRuleSnapshot['base']): string {
  switch (base) {
    case 'contract_amount': return 'le montant total du contrat signé'
    case 'fees': return 'les honoraires perçus par la Société'
    case 'signed_quote': return 'le montant du devis signé'
    case 'collected_revenue': return 'le chiffre d\'affaires effectivement encaissé'
  }
}

function PartiesSection({ snapshot }: { snapshot: ContractSnapshot }) {
  const { tenant, referrer } = snapshot
  const status = getStatusClauses(referrer.status)

  return (
    <View>
      <Text style={styles.h2}>1. Parties</Text>

      <View style={styles.party}>
        <Text style={styles.partyLabel}>La Société :</Text>
        <Text>
          {tenant.legal_name}, {tenant.legal_form} au capital de {tenant.capital}€,
          immatriculée au RCS de {tenant.rcs_city} sous le n° {tenant.siret},
          dont le siège social est sis {tenant.legal_address},
          représentée par {tenant.representative_name}, en sa qualité de {tenant.representative_role},
          dûment habilité.
        </Text>
        <Text>Ci-après dénommée la « Société ».</Text>
      </View>

      <View style={styles.party}>
        <Text style={styles.partyLabel}>L'Apporteur :</Text>
        {referrer.status === 'individual' && (
          <Text>
            {referrer.first_name} {referrer.last_name}, né(e) le {referrer.birth_date} à {referrer.birth_place},
            de nationalité {referrer.nationality}, demeurant {referrer.address}, {referrer.postal_code} {referrer.city}, {referrer.country},
            tél. {referrer.phone}, email {referrer.email}.
            {' '}{status.party_qualifier}.
          </Text>
        )}
        {referrer.status === 'auto_entrepreneur' && (
          <Text>
            {referrer.first_name} {referrer.last_name}, {status.party_qualifier},
            immatriculé sous le SIRET n° {referrer.siret}, code NAF {referrer.naf_code},
            demeurant {referrer.address}, {referrer.postal_code} {referrer.city}, {referrer.country},
            tél. {referrer.phone}, email {referrer.email}
            {referrer.vat_applicable && referrer.vat_number ? `, n° TVA : ${referrer.vat_number}` : ', en franchise en base de TVA'}.
          </Text>
        )}
        {referrer.status === 'company' && (
          <Text>
            {referrer.company_name}, {referrer.legal_form} au capital de {referrer.capital}€,
            immatriculée au RCS de {referrer.rcs_city} sous le n° {referrer.siret},
            dont le siège social est sis {referrer.address}, {referrer.postal_code} {referrer.city}, {referrer.country},
            représentée par {referrer.legal_representative_name}, en sa qualité de {referrer.legal_representative_role},
            {' '}{status.party_qualifier}
            {referrer.vat_applicable && referrer.vat_number ? `, n° TVA : ${referrer.vat_number}` : ''}.
          </Text>
        )}
      </View>
    </View>
  )
}

function RemunerationSection({ snapshot }: { snapshot: ContractSnapshot }) {
  const rule = snapshot.commission_rule
  const status = getStatusClauses(snapshot.referrer.status)

  let body = ''
  if (rule.type === 'percentage' && rule.percentage != null) {
    body = `La Société versera à l'Apporteur une commission de ${rule.percentage}% calculée sur la base : ${baseLabel(rule.base)}, pour chaque opportunité signalée par l'Apporteur ayant abouti à la signature d'un contrat avec un client final.`
  } else if (rule.type === 'fixed' && rule.fixed_amount != null) {
    body = `La Société versera à l'Apporteur une commission forfaitaire de ${rule.fixed_amount}€ pour chaque opportunité signalée ayant abouti à la signature d'un contrat avec un client final.`
  } else if (rule.type === 'tiered' && rule.tiers) {
    const tierLines = rule.tiers
      .map((t) => `de ${t.from}€ à ${t.to ?? '∞'}€ : ${t.rate}%`)
      .join(' ; ')
    body = `La Société versera à l'Apporteur une commission selon le barème dégressif suivant, calculé sur la base : ${baseLabel(rule.base)} — ${tierLines}.`
  }

  return (
    <View>
      <Text style={styles.h2}>3. Rémunération</Text>
      <Text style={styles.paragraph}>{body}</Text>
      <Text style={styles.paragraph}>
        La commission est due à compter de l'encaissement effectif des sommes par la Société auprès du client final, et sera versée par virement bancaire dans un délai de trente (30) jours suivant cet encaissement.
      </Text>
      <Text style={styles.paragraph}>{status.remuneration_addendum}</Text>
    </View>
  )
}

export function ContractDocument({ snapshot }: { snapshot: ContractSnapshot }) {
  const industry = getIndustryClauses(snapshot.tenant.industry, snapshot.tenant)
  const status = getStatusClauses(snapshot.referrer.status)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>CONTRAT D'APPORT D'AFFAIRES</Text>
        <Text style={styles.small}>Généré le {new Date(snapshot.generated_at).toLocaleDateString('fr-FR')}</Text>

        <Text style={styles.paragraph}>{COMMON_CLAUSES.preamble(snapshot.tenant.legal_name)}</Text>

        <PartiesSection snapshot={snapshot} />

        <Text style={styles.h2}>2. Objet du Contrat</Text>
        <Text style={styles.paragraph}>{industry.object}</Text>
        <Text style={styles.paragraph}>{industry.legal_mentions}</Text>
        <Text style={styles.paragraph}>{industry.obligations}</Text>

        <RemunerationSection snapshot={snapshot} />

        <Text style={styles.h2}>4. Durée</Text>
        <Text style={styles.paragraph}>{COMMON_CLAUSES.duration(snapshot.contract_duration_months)}</Text>

        <Text style={styles.h2}>5. Confidentialité</Text>
        <Text style={styles.paragraph}>{COMMON_CLAUSES.confidentiality()}</Text>

        <Text style={styles.h2}>6. Exclusivité</Text>
        <Text style={styles.paragraph}>{COMMON_CLAUSES.exclusivity()}</Text>

        <Text style={styles.h2}>7. Données personnelles (RGPD)</Text>
        <Text style={styles.paragraph}>{COMMON_CLAUSES.rgpd(snapshot.tenant.legal_name)}</Text>

        <Text style={styles.h2}>8. Résiliation</Text>
        <Text style={styles.paragraph}>{COMMON_CLAUSES.termination()}</Text>

        <Text style={styles.h2}>9. Loi applicable et juridiction</Text>
        <Text style={styles.paragraph}>{COMMON_CLAUSES.jurisdiction(snapshot.jurisdiction_city)}</Text>

        <View style={styles.signatureRow}>
          <View style={styles.signatureBox}>
            <Text style={styles.partyLabel}>Pour la Société</Text>
            <Text>{snapshot.tenant.representative_name}</Text>
            <Text style={styles.small}>{snapshot.tenant.representative_role}</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.partyLabel}>{status.signature_block_label}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

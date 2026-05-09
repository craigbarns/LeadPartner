import type { ReferrerStatus } from '../types'

export interface StatusClauseSet {
  party_qualifier: string
  remuneration_addendum: string
  signature_block_label: string
}

export function getStatusClauses(status: ReferrerStatus): StatusClauseSet {
  switch (status) {
    case 'individual':
      return {
        party_qualifier: `agissant à titre personnel à titre occasionnel, ci-après dénommé l'« Apporteur »`,
        remuneration_addendum: `L'Apporteur déclare exercer cette activité à titre occasionnel, ne dépassant pas trois (3) opérations par année civile. Au-delà, les parties conviennent qu'une régularisation sera nécessaire (immatriculation en tant qu'auto-entrepreneur ou société). Conformément à la réglementation, la Société établira chaque année un Imprimé Fiscal Unique (IFU) déclarant les commissions versées.`,
        signature_block_label: `Lu et approuvé, signé par l'Apporteur`,
      }

    case 'auto_entrepreneur':
      return {
        party_qualifier: `auto-entrepreneur, ci-après dénommé l'« Apporteur »`,
        remuneration_addendum: `L'Apporteur établira mensuellement une facture pour les commissions dues, conformément à son régime de micro-entreprise. La franchise en base de TVA s'applique, sauf si l'Apporteur a opté pour l'assujettissement à la TVA, auquel cas son numéro de TVA intracommunautaire figurera sur ses factures.`,
        signature_block_label: `Lu et approuvé, signé par l'Apporteur (auto-entrepreneur)`,
      }

    case 'company':
      return {
        party_qualifier: `agissant en qualité de représentant légal dûment habilité, ci-après dénommée la « Société Apporteuse »`,
        remuneration_addendum: `La Société Apporteuse établira mensuellement une facture pour les commissions dues, conformément à ses obligations comptables et fiscales. La TVA sera applicable au taux en vigueur.`,
        signature_block_label: `Pour la Société Apporteuse, son représentant légal`,
      }
  }
}

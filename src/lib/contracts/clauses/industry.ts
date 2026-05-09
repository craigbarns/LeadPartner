import type { IndustryCode, TenantSnapshot } from '../types'

export interface IndustryClauseSet {
  object: string
  legal_mentions: string
  obligations: string
}

export function getIndustryClauses(
  industry: IndustryCode,
  tenant: TenantSnapshot,
): IndustryClauseSet {
  switch (industry) {
    case 'real_estate':
      return {
        object: `L'Apporteur s'engage à signaler à la Société des opportunités d'affaires en lien avec son activité de transactions et/ou de gestion immobilière. L'Apporteur n'est pas autorisé à intervenir dans les négociations commerciales, ni à présenter les biens, ni à percevoir directement des fonds des prospects.`,
        legal_mentions: tenant.carte_t_number
          ? `La Société est titulaire de la carte professionnelle n° ${tenant.carte_t_number} délivrée par la CCI de ${tenant.carte_t_city ?? '[ville]'}, garantie financière auprès de ${tenant.caisse_garantie ?? '[organisme]'}, conformément aux dispositions de la loi n° 70-9 du 2 janvier 1970 (loi Hoguet) et de son décret d'application n° 72-678 du 20 juillet 1972.`
          : `La Société exerce son activité conformément aux dispositions de la loi n° 70-9 du 2 janvier 1970 (loi Hoguet).`,
        obligations: `L'Apporteur reconnaît que toute activité d'entremise immobilière (négociation, présentation, perception de fonds) est strictement réservée aux titulaires de la carte professionnelle. Son rôle se limite à la mise en relation initiale.`,
      }

    case 'insurance':
      return {
        object: `L'Apporteur s'engage à signaler à la Société des opportunités de souscription de contrats d'assurance.`,
        legal_mentions: tenant.orias_number
          ? `La Société est immatriculée à l'ORIAS sous le n° ${tenant.orias_number} en qualité de courtier d'assurance. Cette immatriculation peut être vérifiée sur le site www.orias.fr.`
          : `La Société exerce son activité conformément au Code des assurances.`,
        obligations: `L'Apporteur n'est pas autorisé à présenter, proposer ou aider à conclure des contrats d'assurance, activités strictement réservées aux intermédiaires immatriculés à l'ORIAS. Son rôle se limite à la mise en relation initiale.`,
      }

    case 'credit':
      return {
        object: `L'Apporteur s'engage à signaler à la Société des opportunités de financement (crédit immobilier, crédit à la consommation, regroupement de crédits, financement professionnel).`,
        legal_mentions: tenant.orias_number
          ? `La Société est immatriculée à l'ORIAS sous le n° ${tenant.orias_number} en qualité d'IOBSP (Intermédiaire en Opérations de Banque et Services de Paiement). Cette immatriculation peut être vérifiée sur le site www.orias.fr.`
          : `La Société exerce son activité conformément au Code monétaire et financier.`,
        obligations: `L'Apporteur n'est pas autorisé à présenter ou faire souscrire des opérations de banque ou de services de paiement, activités strictement réservées aux IOBSP immatriculés à l'ORIAS. Son rôle se limite à la mise en relation initiale.`,
      }

    case 'construction':
      return {
        object: `L'Apporteur s'engage à signaler à la Société des opportunités de chantiers (rénovation, construction neuve, extension, aménagement).`,
        legal_mentions: `La Société dispose des assurances professionnelles requises (responsabilité civile professionnelle, garantie décennale).`,
        obligations: `L'Apporteur ne peut pas chiffrer les travaux, signer un devis au nom de la Société, ni percevoir d'acompte.`,
      }

    case 'automotive':
      return {
        object: `L'Apporteur s'engage à signaler à la Société des opportunités liées à l'achat, la vente ou le financement de véhicules.`,
        legal_mentions: `La Société exerce son activité conformément aux dispositions du Code de la consommation.`,
        obligations: `L'Apporteur ne peut pas conclure de vente, signer de bon de commande, ni percevoir d'acompte au nom de la Société.`,
      }

    case 'training':
      return {
        object: `L'Apporteur s'engage à signaler à la Société des opportunités de formation professionnelle (entreprises ou particuliers).`,
        legal_mentions: `La Société est déclarée organisme de formation conformément aux articles L.6351-1 et suivants du Code du travail.`,
        obligations: `L'Apporteur ne peut pas négocier de programme de formation, signer de convention, ni encaisser de frais pédagogiques.`,
      }

    case 'b2b_services':
      return {
        object: `L'Apporteur s'engage à signaler à la Société des opportunités commerciales B2B en lien avec ses prestations de services.`,
        legal_mentions: `La Société exerce son activité conformément aux dispositions du Code de commerce et du Code civil.`,
        obligations: `L'Apporteur n'est pas habilité à engager la Société sur le périmètre, les délais ou le prix des prestations.`,
      }

    case 'other':
    default:
      return {
        object: `L'Apporteur s'engage à signaler à la Société des opportunités commerciales relevant de son activité.`,
        legal_mentions: `La Société exerce son activité conformément à la réglementation française applicable à son secteur.`,
        obligations: `L'Apporteur n'est pas habilité à engager la Société et son rôle se limite à la mise en relation initiale.`,
      }
  }
}

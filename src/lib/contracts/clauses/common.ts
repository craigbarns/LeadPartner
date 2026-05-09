export const COMMON_CLAUSES = {
  preamble: (tenantName: string) =>
    `Le présent contrat d'apport d'affaires (ci-après le « Contrat ») est conclu entre les parties désignées ci-dessous afin de définir les modalités de leur collaboration dans le cadre de l'apport d'opportunités commerciales à la société ${tenantName}.`,

  duration: (months: number) =>
    `Le présent Contrat est conclu pour une durée de ${months} mois à compter de sa signature, renouvelable tacitement par périodes équivalentes sauf dénonciation par l'une des parties moyennant un préavis de trente (30) jours par lettre recommandée avec accusé de réception.`,

  confidentiality: () =>
    `Chacune des parties s'engage à conserver strictement confidentielles toutes les informations échangées dans le cadre du présent Contrat. Cette obligation de confidentialité subsiste pendant cinq (5) ans après la fin du Contrat.`,

  exclusivity: () =>
    `Le présent Contrat n'emporte aucune exclusivité. Chacune des parties demeure libre de poursuivre ses activités auprès d'autres partenaires sous réserve du respect des obligations de confidentialité ci-dessus.`,

  rgpd: (tenantName: string) =>
    `Conformément au Règlement (UE) 2016/679 (RGPD), les données personnelles collectées dans le cadre du présent Contrat sont traitées par ${tenantName} aux fins exclusives de l'exécution du Contrat et de ses obligations légales. L'Apporteur dispose d'un droit d'accès, de rectification, d'effacement et de portabilité de ses données, qu'il peut exercer en contactant le responsable de traitement par courrier ou par email. Les données sont conservées pour la durée légale applicable aux contrats commerciaux (10 ans).`,

  jurisdiction: (city: string) =>
    `Le présent Contrat est régi par le droit français. Tout litige relatif à son interprétation ou à son exécution sera de la compétence exclusive des tribunaux compétents de ${city}.`,

  termination: () =>
    `Le présent Contrat peut être résilié de plein droit par l'une ou l'autre des parties en cas de manquement grave de l'autre partie à ses obligations, après mise en demeure restée infructueuse pendant trente (30) jours.`,
}

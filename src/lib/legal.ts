/**
 * Textes juridiques de la boutique.
 *
 * IMPORTANT : ce fichier ne contient AUCUNE information d'entreprise en dur.
 * Tout vient de `legal-identity.ts`, qui est le seul fichier a remplir.
 * Un champ non rempli s'affiche en clair comme « [A COMPLETER : ...] ».
 *
 * Ces textes couvrent les obligations d'une boutique en ligne francaise
 * vendant a des consommateurs : mentions legales (article 6 III de la LCEN),
 * informations precontractuelles (article L221-5 du code de la consommation),
 * droit de retractation (articles L221-18 et suivants), garanties legales
 * (articles L217-3 et suivants du code de la consommation, article 1641 du
 * code civil) et mediation (article L616-1).
 *
 * Ils ne remplacent pas l'avis d'un juriste. Ils comblent le vide qui existait
 * — les anciens textes ne nommaient ni l'entreprise, ni l'hebergeur, ni le
 * mediateur, ce qui rendait la boutique non conforme.
 */

import {
  DELAI_RETRACTATION_JOURS,
  HEBERGEUR,
  adressePostale,
  champ,
  champFacultatif,
} from "@/lib/legal-identity";

type LegalSection = {
  title: string;
  paragraphs: string[];
};

type LegalDocument = {
  title: string;
  updatedAt: string;
  sections: LegalSection[];
};

export type LegalDocumentKey = "mentions" | "cgv" | "privacy" | "retractation";

const MISE_A_JOUR = "5 août 2026";

/** Ligne « Capital social : ... » uniquement si le champ est rempli. */
function ligneCapital() {
  const capital = champFacultatif("capitalSocial");
  return capital ? `Capital social : ${capital}.` : "";
}

function ligneImmatriculation() {
  const valeur = champFacultatif("immatriculation");
  return valeur ? `Immatriculation : ${valeur}.` : "";
}

function ligneTva() {
  const valeur = champFacultatif("tvaIntracommunautaire");
  return valeur
    ? `Numéro de TVA intracommunautaire : ${valeur}.`
    : "TVA non applicable, article 293 B du code général des impôts (franchise en base de TVA). Les prix affichés sont nets de taxe.";
}

function blocMediateur() {
  const nom = champ("mediateurNom");
  const adresse = champFacultatif("mediateurAdresse");
  const site = champFacultatif("mediateurSite");

  return [
    `Conformément à l'article L616-1 du code de la consommation, le client consommateur peut recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable d'un litige, après avoir adressé une réclamation écrite au service client et à défaut de réponse satisfaisante sous deux mois.`,
    [`Médiateur compétent : ${nom}.`, adresse, site].filter(Boolean).join(" "),
    `Le client peut également utiliser la plateforme européenne de règlement en ligne des litiges : https://ec.europa.eu/consumers/odr`,
  ];
}

export const legalDocuments: Record<LegalDocumentKey, LegalDocument> = {
  mentions: {
    title: "Mentions légales",
    updatedAt: MISE_A_JOUR,
    sections: [
      {
        title: "Éditeur du site",
        paragraphs: [
          `Le site maxitrouvaille.fr est édité par ${champ("denomination")}, ${champ("formeJuridique")}.`,
          `Siège : ${adressePostale()}.`,
          `SIRET : ${champ("siret")}.`,
          [ligneImmatriculation(), ligneCapital()].filter(Boolean).join(" "),
          ligneTva(),
        ].filter(Boolean),
      },
      {
        title: "Contact",
        paragraphs: [
          `Email : ${champ("email")}.`,
          `Téléphone : ${champ("telephone")}.`,
          `Toute demande relative à une commande, une livraison, un retour ou un remboursement peut également être adressée depuis la page Contact du site.`,
        ],
      },
      {
        title: "Directeur de la publication",
        paragraphs: [`${champ("directeurPublication")}.`],
      },
      {
        title: "Hébergement",
        paragraphs: [
          `Le site est hébergé par ${HEBERGEUR.nom}, ${HEBERGEUR.adresse}.`,
          `Site de l'hébergeur : ${HEBERGEUR.site}`,
        ],
      },
      {
        title: "Médiation de la consommation",
        paragraphs: blocMediateur(),
      },
      {
        title: "Propriété intellectuelle",
        paragraphs: [
          `Le nom Maxi Trouvaille, la structure du site, ses textes et ses éléments graphiques sont protégés. Toute reproduction ou réutilisation non autorisée est interdite.`,
          `Les visuels et descriptions de produits fournis par les partenaires logistiques restent la propriété de leurs auteurs respectifs.`,
        ],
      },
    ],
  },

  cgv: {
    title: "Conditions générales de vente",
    updatedAt: MISE_A_JOUR,
    sections: [
      {
        title: "1. Identité du vendeur",
        paragraphs: [
          `Les produits vendus sur maxitrouvaille.fr le sont par ${champ("denomination")}, ${champ("formeJuridique")}, SIRET ${champ("siret")}, dont le siège est situé ${adressePostale()}.`,
          `Contact : ${champ("email")} — ${champ("telephone")}.`,
        ],
      },
      {
        title: "2. Objet et acceptation",
        paragraphs: [
          `Les présentes conditions régissent les ventes conclues sur le site maxitrouvaille.fr entre le vendeur et tout client agissant en qualité de consommateur.`,
          `La validation de la commande vaut acceptation sans réserve des présentes conditions, dont le client reconnaît avoir pris connaissance avant de payer.`,
        ],
      },
      {
        title: "3. Produits",
        paragraphs: [
          `Les caractéristiques essentielles de chaque produit sont présentées sur sa fiche. Les photographies et illustrations n'entrent pas dans le champ contractuel : elles peuvent différer légèrement du produit livré.`,
          `Certains produits sont expédiés directement par un partenaire logistique situé hors de l'Union européenne. Cette information est indiquée sur la fiche produit et n'a aucune conséquence sur les droits du client : le vendeur reste son seul interlocuteur.`,
          `Les offres sont valables tant qu'elles sont visibles sur le site et dans la limite des stocks disponibles.`,
        ],
      },
      {
        title: "4. Prix",
        paragraphs: [
          `Les prix sont indiqués en euros, toutes taxes comprises le cas échéant, hors frais de livraison.`,
          ligneTva(),
          `Les frais de livraison sont affichés avant la validation définitive de la commande. Le montant total dû est rappelé au moment du paiement.`,
          `Le vendeur se réserve le droit de modifier ses prix à tout moment ; le produit est facturé au prix affiché lors de l'enregistrement de la commande.`,
        ],
      },
      {
        title: "5. Commande",
        paragraphs: [
          `La commande est enregistrée lorsque le client a validé son panier, renseigné son adresse de livraison, accepté les présentes conditions et confirmé son paiement.`,
          `Un email de confirmation récapitulant la commande est envoyé à l'adresse indiquée par le client. Cet email vaut preuve de la commande.`,
          `Le vendeur se réserve le droit de refuser ou d'annuler une commande présentant une anomalie manifeste, notamment en cas d'adresse incomplète, de suspicion de fraude ou d'indisponibilité du produit. Le client est alors intégralement remboursé.`,
        ],
      },
      {
        title: "6. Paiement",
        paragraphs: [
          `Le paiement s'effectue en ligne par carte bancaire via le prestataire de paiement Stripe. Les données bancaires sont transmises directement à Stripe et ne transitent jamais par les serveurs du vendeur, qui n'y a pas accès.`,
          `La commande n'est traitée qu'après encaissement effectif du paiement.`,
        ],
      },
      {
        title: "7. Livraison",
        paragraphs: [
          `Les produits sont livrés à l'adresse indiquée par le client lors de la commande. Le client est responsable de l'exactitude des informations qu'il fournit.`,
          `Les modes, délais et frais de livraison sont affichés avant la validation de la commande. Le délai indicatif est de 7 à 14 jours ouvrés selon le produit et le transporteur.`,
          `Conformément à l'article L216-1 du code de la consommation, en l'absence d'indication contraire, le vendeur livre au plus tard trente jours après la conclusion du contrat. En cas de dépassement, le client peut résoudre le contrat dans les conditions de l'article L216-6 et être remboursé.`,
          `Les risques sont transférés au client à la remise physique du produit.`,
        ],
      },
      {
        title: "8. Droit de rétractation",
        paragraphs: [
          `Le client consommateur dispose d'un délai de ${DELAI_RETRACTATION_JOURS} jours à compter de la réception du produit pour exercer son droit de rétractation, sans avoir à justifier de motif ni à payer de pénalité.`,
          `Les modalités complètes, les exceptions légales et le formulaire type figurent sur la page « Droit de rétractation » du site.`,
        ],
      },
      {
        title: "9. Garanties légales",
        paragraphs: [
          `Indépendamment de toute garantie commerciale, le vendeur reste tenu de la garantie légale de conformité (articles L217-3 et suivants du code de la consommation) et de la garantie des vices cachés (articles 1641 et suivants du code civil).`,
          `Au titre de la garantie légale de conformité, le client dispose d'un délai de deux ans à compter de la délivrance du bien. Il peut choisir entre la réparation et le remplacement, sous réserve des conditions de coût prévues par la loi. Il est dispensé de rapporter la preuve du défaut de conformité pendant les vingt-quatre mois suivant la délivrance.`,
          `Au titre de la garantie des vices cachés, le client peut agir dans un délai de deux ans à compter de la découverte du vice et obtenir la résolution de la vente ou une réduction du prix.`,
          `Ces garanties s'exercent auprès du vendeur, à l'adresse et aux coordonnées indiquées à l'article 1, sans aucun contact nécessaire avec le partenaire logistique.`,
        ],
      },
      {
        title: "10. Service client et réclamations",
        paragraphs: [
          `Toute réclamation doit être adressée à ${champ("email")} ou par téléphone au ${champ("telephone")}. Le vendeur s'engage à accuser réception de toute réclamation écrite.`,
          `Le vendeur reste l'interlocuteur unique du client pour le suivi de commande, la livraison, le retour, le remboursement et la garantie.`,
        ],
      },
      {
        title: "11. Données personnelles",
        paragraphs: [
          `Les données collectées sont nécessaires au traitement de la commande. Leur traitement est détaillé dans la politique de confidentialité du site.`,
        ],
      },
      {
        title: "12. Médiation et droit applicable",
        paragraphs: [
          ...blocMediateur(),
          `Les présentes conditions sont soumises au droit français. En cas de litige, les tribunaux français sont compétents dans les conditions prévues par le code de procédure civile.`,
        ],
      },
    ],
  },

  retractation: {
    title: "Droit de rétractation",
    updatedAt: MISE_A_JOUR,
    sections: [
      {
        title: "Votre délai",
        paragraphs: [
          `Vous disposez de ${DELAI_RETRACTATION_JOURS} jours pour changer d'avis, sans avoir à vous justifier et sans pénalité.`,
          `Ce délai court à compter du jour où vous, ou un tiers désigné par vous, prenez physiquement possession du produit. Si votre commande contient plusieurs produits livrés séparément, le délai court à compter de la réception du dernier produit.`,
          `Si le délai expire un samedi, un dimanche ou un jour férié, il est prolongé jusqu'au premier jour ouvrable suivant.`,
        ],
      },
      {
        title: "Comment nous prévenir",
        paragraphs: [
          `Envoyez-nous votre décision avant l'expiration du délai, par email à ${champ("email")} ou par courrier à ${adressePostale()}.`,
          `Toute déclaration dénuée d'ambiguïté suffit : vous pouvez écrire avec vos propres mots. Vous pouvez aussi utiliser le formulaire type reproduit plus bas.`,
          `Conservez une preuve de votre envoi : c'est la date d'envoi qui compte, pas la date de réception.`,
        ],
      },
      {
        title: "Renvoyer le produit",
        paragraphs: [
          `Renvoyez le produit au plus tard ${DELAI_RETRACTATION_JOURS} jours après nous avoir informés de votre décision.`,
          `Les frais de retour sont à votre charge, sauf si le produit livré était défectueux ou non conforme à votre commande : dans ce cas, nous les prenons intégralement en charge.`,
          `Votre responsabilité n'est engagée qu'à l'égard de la dépréciation du produit résultant de manipulations autres que celles nécessaires pour établir sa nature, ses caractéristiques et son bon fonctionnement.`,
        ],
      },
      {
        title: "Votre remboursement",
        paragraphs: [
          `Nous vous remboursons l'intégralité des sommes versées, frais de livraison standard compris, au plus tard ${DELAI_RETRACTATION_JOURS} jours à compter de la récupération du produit ou de la preuve de son expédition, la date retenue étant celle du premier de ces faits.`,
          `Si vous aviez choisi un mode de livraison plus coûteux que le mode standard, seul le coût du mode standard vous est remboursé.`,
          `Le remboursement est effectué par le même moyen de paiement que celui utilisé lors de la commande, sans frais pour vous.`,
        ],
      },
      {
        title: "Les cas où la rétractation ne s'applique pas",
        paragraphs: [
          `Conformément à l'article L221-28 du code de la consommation, le droit de rétractation ne peut être exercé notamment pour : les biens confectionnés selon vos spécifications ou nettement personnalisés ; les biens susceptibles de se détériorer ou de se périmer rapidement ; les biens descellés par vous et ne pouvant être renvoyés pour des raisons d'hygiène ou de protection de la santé ; les enregistrements audio, vidéo ou logiciels descellés ; les biens qui, après livraison, sont mélangés de manière indissociable avec d'autres articles.`,
          `Lorsqu'une exception s'applique à un produit, elle est signalée sur sa fiche avant l'achat.`,
        ],
      },
      {
        title: "Formulaire type de rétractation",
        paragraphs: [
          `Ce formulaire n'est pas obligatoire : il vous est proposé pour vous simplifier la tâche. Complétez-le et renvoyez-le uniquement si vous souhaitez vous rétracter.`,
          `À l'attention de ${champ("denomination")}, ${adressePostale()}, ${champ("email")} :`,
          `Je vous notifie par la présente ma rétractation du contrat portant sur la vente du bien ci-dessous :`,
          `— Commandé le : …………  /  Reçu le : …………`,
          `— Numéro de commande : …………`,
          `— Produit(s) concerné(s) : …………`,
          `— Nom du consommateur : …………`,
          `— Adresse du consommateur : …………`,
          `— Date : …………`,
          `— Signature (uniquement en cas de notification sur papier) : …………`,
        ],
      },
    ],
  },

  privacy: {
    title: "Politique de confidentialité",
    updatedAt: MISE_A_JOUR,
    sections: [
      {
        title: "Responsable du traitement",
        paragraphs: [
          `Le responsable du traitement des données est ${champ("denomination")}, ${adressePostale()}.`,
          `Pour toute question relative à vos données : ${champ("email")}.`,
        ],
      },
      {
        title: "Données collectées et finalités",
        paragraphs: [
          `Lors d'une commande, sont collectés : nom, prénom, adresse de livraison, code postal, ville, pays, adresse email et numéro de téléphone. Ces données sont nécessaires à l'exécution du contrat de vente : préparation, expédition, suivi du colis, service après-vente.`,
          `Aucune donnée bancaire n'est collectée ni conservée par le vendeur. Le paiement est traité par Stripe, qui agit en qualité de responsable de traitement pour cette opération.`,
        ],
      },
      {
        title: "Base légale",
        paragraphs: [
          `Le traitement des données de commande repose sur l'exécution du contrat (article 6.1.b du RGPD). La conservation des factures repose sur une obligation légale (article 6.1.c).`,
        ],
      },
      {
        title: "Destinataires",
        paragraphs: [
          `Les données de livraison sont transmises au partenaire logistique et au transporteur chargés d'acheminer la commande, strictement dans la mesure nécessaire à la livraison.`,
          `Lorsque le partenaire logistique est situé hors de l'Union européenne, la transmission de l'adresse de livraison est nécessaire à l'exécution du contrat conclu avec vous, au sens de l'article 49.1.b du RGPD.`,
          `Aucune donnée n'est vendue ni cédée à des fins publicitaires.`,
        ],
      },
      {
        title: "Durée de conservation",
        paragraphs: [
          `Les données de commande sont conservées le temps nécessaire au traitement puis archivées conformément aux obligations comptables et fiscales, soit dix ans pour les pièces justificatives.`,
          `Les demandes du service client sont conservées trois ans à compter du dernier échange.`,
        ],
      },
      {
        title: "Cookies et stockage local",
        paragraphs: [
          `Le panier utilise le stockage local du navigateur pour conserver les articles ajoutés. Ce stockage est strictement nécessaire au fonctionnement du site et ne nécessite pas de consentement.`,
          `Aucun outil de mesure d'audience ni de publicité ciblée n'est installé sur le site à ce jour. Si un tel outil devait l'être, un bandeau de consentement serait mis en place au préalable.`,
        ],
      },
      {
        title: "Vos droits",
        paragraphs: [
          `Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données. Pour les exercer, écrivez à ${champ("email")}.`,
          `Vous pouvez introduire une réclamation auprès de la Commission nationale de l'informatique et des libertés (CNIL), 3 place de Fontenoy, 75007 Paris — www.cnil.fr`,
        ],
      },
    ],
  },
};

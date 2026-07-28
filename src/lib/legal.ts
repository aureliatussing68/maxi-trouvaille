type LegalSection = {
  title: string;
  paragraphs: string[];
};

type LegalDocument = {
  title: string;
  updatedAt: string;
  sections: LegalSection[];
};

export type LegalDocumentKey = "mentions" | "cgv" | "privacy";

export const legalDocuments: Record<LegalDocumentKey, LegalDocument> = {
  mentions: {
    title: "Mentions légales",
    updatedAt: "18 juin 2026",
    sections: [
      {
        title: "Éditeur du site",
        paragraphs: [
          "Maxi Trouvaille exploite une boutique en ligne centrée sur des produits partenaires, des nouveautés et des promotions sélectionnées. Les informations administratives de l'éditeur sont tenues à jour dans l'espace légal de la boutique.",
        ],
      },
      {
        title: "Contact",
        paragraphs: [
          "Le service client Maxi Trouvaille peut être contacté depuis la page Contact pour toute question liée à une commande, un produit, une livraison ou un retour.",
        ],
      },
      {
        title: "Hébergement",
        paragraphs: [
          "Le site est hébergé par un prestataire technique. Les informations d'hébergement peuvent être communiquées sur demande via le service client.",
        ],
      },
      {
        title: "Propriété intellectuelle",
        paragraphs: [
          "Le nom Maxi Trouvaille, les contenus, textes, visuels et éléments graphiques du site sont destinés à l'exploitation de la boutique. Toute reproduction non autorisée est interdite.",
        ],
      },
    ],
  },
  cgv: {
    title: "Conditions générales de vente",
    updatedAt: "18 juin 2026",
    sections: [
      {
        title: "Objet",
        paragraphs: [
          "Les présentes conditions encadrent les ventes de produits proposés par Maxi Trouvaille : produits partenaires, nouveautés, promotions et bonnes affaires identifiées comme telles.",
        ],
      },
      {
        title: "Produits",
        paragraphs: [
          "Les caractéristiques essentielles, l'état, le prix et les disponibilités seront indiqués sur chaque fiche produit. Les stocks pourront être limités selon les arrivages.",
          "Un produit partenaire n'est rendu achetable que lorsque les informations essentielles sont suffisamment contrôlées pour le client.",
        ],
      },
      {
        title: "Prix et paiement",
        paragraphs: [
          "Les prix sont affichés en euros toutes taxes applicables comprises selon le régime fiscal de l'entreprise. Le paiement en ligne s'appuie sur un prestataire sécurisé afin de protéger la transaction.",
        ],
      },
      {
        title: "Livraison",
        paragraphs: [
          "Les modes, délais et frais de livraison sont affichés avant validation de la commande. Les délais peuvent varier selon le transporteur, le stock, le partenaire logistique et le type de produit.",
        ],
      },
      {
        title: "Produits partenaires",
        paragraphs: [
          "Certains produits neufs peuvent être expédiés directement par un partenaire logistique. Le client paie Maxi Trouvaille, conserve le service client Maxi Trouvaille et reçoit un suivi colis lorsque l'expédition est confirmée.",
          "Les commandes partenaires sont préparées avec validation humaine afin de garder un contrôle clair sur le produit, le paiement, la livraison et le service client.",
        ],
      },
      {
        title: "Droit de rétractation",
        paragraphs: [
          "Le client consommateur dispose en principe d'un délai légal de rétractation de 14 jours à compter de la réception, sous réserve des exceptions prévues par la loi et de l'état du produit retourné.",
        ],
      },
      {
        title: "Service client",
        paragraphs: [
          "Toute demande peut être envoyée depuis la page Contact. Maxi Trouvaille reste l'interlocuteur principal pour le suivi de commande, la livraison, le retour et le remboursement.",
        ],
      },
    ],
  },
  privacy: {
    title: "Politique de confidentialité",
    updatedAt: "18 juin 2026",
    sections: [
      {
        title: "Données collectées",
        paragraphs: [
          "Maxi Trouvaille traite les données nécessaires aux commandes, au paiement, à la livraison, au suivi colis, aux retours et au support client.",
        ],
      },
      {
        title: "Paiement",
        paragraphs: [
          "Les données bancaires sont traitées par un prestataire de paiement sécurisé. Maxi Trouvaille ne stocke pas de numéros de carte bancaire dans son code ou sa base de données.",
        ],
      },
      {
        title: "Livraison et suivi",
        paragraphs: [
          "Les informations nécessaires à la préparation, à la livraison et au suivi colis peuvent être utilisées pour traiter la commande et informer le client.",
          "Lorsque la livraison implique un partenaire logistique, seules les données utiles au traitement de la commande sont partagées selon le parcours client applicable.",
        ],
      },
      {
        title: "Cookies",
        paragraphs: [
          "Le panier utilise le stockage du navigateur pour conserver les articles ajoutés. Les outils de mesure ou de publicité, s'ils sont activés, font l'objet d'une information adaptée.",
        ],
      },
      {
        title: "Droits des utilisateurs",
        paragraphs: [
          "Les utilisateurs peuvent demander l'accès, la rectification ou la suppression de leurs données personnelles selon la réglementation applicable.",
        ],
      },
      {
        title: "Durée de conservation",
        paragraphs: [
          "Les durées de conservation seront précisées selon les obligations comptables, fiscales, commerciales et les besoins du service client.",
        ],
      },
    ],
  },
};

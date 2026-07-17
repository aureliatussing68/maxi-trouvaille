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
    title: "Mentions legales provisoires",
    updatedAt: "1 mai 2026",
    sections: [
      {
        title: "Editeur du site",
        paragraphs: [
          "Maxi Trouvaille est un projet de boutique en ligne en cours de creation. Les informations definitives de l'entreprise, notamment la forme juridique, le capital social, l'adresse du siege, le numero SIRET et le responsable de publication, devront etre ajoutees avant la mise en ligne publique.",
        ],
      },
      {
        title: "Contact",
        paragraphs: [
          "Adresse e-mail provisoire : contact@maxitrouvaille.fr. Cette adresse devra etre remplacee ou confirmee avant le lancement commercial.",
        ],
      },
      {
        title: "Hebergement",
        paragraphs: [
          "L'hebergeur definitif sera precise avant publication. En phase de developpement, le site fonctionne en local.",
        ],
      },
      {
        title: "Propriete intellectuelle",
        paragraphs: [
          "Le nom Maxi Trouvaille, les contenus, textes, visuels et elements graphiques du site sont destines a l'exploitation de la boutique. Toute reproduction non autorisee est interdite.",
        ],
      },
    ],
  },
  cgv: {
    title: "Conditions generales de vente provisoires",
    updatedAt: "1 mai 2026",
    sections: [
      {
        title: "Objet",
        paragraphs: [
          "Les presentes conditions encadrent les ventes de produits proposes par Maxi Trouvaille : lots, colis perdus, objets neufs ou quasi neufs, bonnes affaires et, le cas echeant, produits en dropshipping identifies comme tels.",
        ],
      },
      {
        title: "Produits",
        paragraphs: [
          "Les caracteristiques essentielles, l'etat, le prix et les disponibilites seront indiques sur chaque fiche produit. Les stocks pourront etre limites selon les arrivages.",
        ],
      },
      {
        title: "Prix et paiement",
        paragraphs: [
          "Les prix seront affiches en euros toutes taxes applicables comprises selon le regime fiscal de l'entreprise. Le paiement reel n'est pas encore active. Le site est prepare pour Stripe en mode test uniquement.",
        ],
      },
      {
        title: "Livraison",
        paragraphs: [
          "Les modes, delais et frais de livraison definitifs seront precises avant ouverture. Les delais pourront varier selon le transporteur, le stock, le partenaire logistique et le type de produit.",
        ],
      },
      {
        title: "Produits dropshipping",
        paragraphs: [
          "Certains produits neufs peuvent etre expedies directement par un partenaire logistique. Le client paie Maxi Trouvaille, conserve le service client Maxi Trouvaille et recoit un suivi colis lorsque l'expedition est confirmee.",
          "Au lancement, les commandes fournisseur restent traitees manuellement : aucune commande fournisseur automatique n'est declenchee sans validation humaine.",
        ],
      },
      {
        title: "Colis surprises et palettes",
        paragraphs: [
          "Les colis surprises, palettes, box mysteres, colis perdus et offres similaires sont prepares comme offres futures. Tant qu'ils sont marques À venir, ils ne sont pas vendus et ne peuvent pas etre payes sur le site.",
        ],
      },
      {
        title: "Droit de retractation",
        paragraphs: [
          "Le client consommateur dispose en principe d'un delai legal de retractation de 14 jours a compter de la reception, sous reserve des exceptions prevues par la loi et de l'etat du produit retourne.",
        ],
      },
      {
        title: "Service client",
        paragraphs: [
          "Toute demande pourra etre envoyee a l'adresse de contact indiquee sur le site. Les modalites definitives seront completees avant la mise en ligne.",
        ],
      },
    ],
  },
  privacy: {
    title: "Politique de confidentialite provisoire",
    updatedAt: "1 mai 2026",
    sections: [
      {
        title: "Donnees collectees",
        paragraphs: [
          "En phase locale, aucune donnee client reelle ne doit etre collectee. Apres lancement, Maxi Trouvaille pourra traiter les donnees necessaires aux commandes, au paiement, a la livraison et au support client.",
        ],
      },
      {
        title: "Paiement",
        paragraphs: [
          "Les donnees bancaires seront traitees par Stripe via une page de paiement securisee. Maxi Trouvaille ne doit pas stocker de numeros de carte bancaire dans son code ou sa base de donnees.",
        ],
      },
      {
        title: "Cookies",
        paragraphs: [
          "Le panier local utilise le stockage du navigateur pour conserver les articles ajoutes. Une politique cookies complete devra etre ajoutee si des outils de mesure d'audience, publicite ou suivi sont installes.",
        ],
      },
      {
        title: "Droits des utilisateurs",
        paragraphs: [
          "Les utilisateurs pourront demander l'acces, la rectification ou la suppression de leurs donnees personnelles selon la reglementation applicable. Les coordonnees definitives du responsable de traitement devront etre ajoutees.",
        ],
      },
      {
        title: "Duree de conservation",
        paragraphs: [
          "Les durees de conservation seront precisees selon les obligations comptables, fiscales, commerciales et les besoins du service client.",
        ],
      },
    ],
  },
};

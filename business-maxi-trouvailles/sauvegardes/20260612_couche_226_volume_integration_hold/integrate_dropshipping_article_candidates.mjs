import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const quickProductsPath = path.join(root, "data", "quick-products.json");
const outputRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "integration-articles",
);

const apply = process.argv.includes("--apply");

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function localDateStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function categoryImage(categoryId) {
  const map = {
    "dropshipping-accessoires": "/uploads/category-images/accessoires.webp",
    "dropshipping-animaux": "/uploads/category-images/animaux.webp",
    "dropshipping-auto-moto": "/uploads/category-images/auto-moto.webp",
    "dropshipping-beaute": "/uploads/category-images/beaute-sante.webp",
    "dropshipping-cuisine": "/uploads/category-images/cuisine.webp",
    "dropshipping-enfant": "/uploads/category-images/jouets.webp",
    "dropshipping-high-tech": "/uploads/category-images/high-tech.webp",
    "dropshipping-maison": "/uploads/category-images/maison.webp",
    "dropshipping-mode": "/uploads/category-images/vetements.webp",
  };

  return map[categoryId] ?? "/uploads/category-images/dropshipping.webp";
}

const candidateSeeds = [
  {
    key: "boite-rangement-cables-bureau",
    name: "Boite rangement cables bureau",
    categoryId: "dropshipping-accessoires",
    targetSalePriceCents: 1290,
    estimatedSupplierPriceCents: 420,
    deliveryTarget: "France/Europe 5 a 10 jours a verifier",
    angle: "Produit simple, utile et facile a comprendre pour panier impulsif bureau/maison.",
    proofEffort: "Image exacte facile a prouver si fournisseur avec photos variantes propres.",
  },
  {
    key: "support-telephone-voiture-ventouse",
    name: "Support telephone voiture ventouse",
    categoryId: "dropshipping-auto-moto",
    targetSalePriceCents: 1490,
    estimatedSupplierPriceCents: 520,
    deliveryTarget: "Entrepot Europe a verifier",
    angle: "Accessoire auto recurrent, bonne recherche mobile et faible complexite SAV.",
    proofEffort: "Verifier compatibilite, fixation exacte et photos du modele vendu.",
  },
  {
    key: "lampe-led-placard-rechargeable",
    name: "Lampe LED placard rechargeable",
    categoryId: "dropshipping-maison",
    targetSalePriceCents: 1690,
    estimatedSupplierPriceCents: 650,
    deliveryTarget: "France/Europe 5 a 12 jours a verifier",
    angle: "Probleme clair: eclairage placard/cuisine sans travaux, bon potentiel video.",
    proofEffort: "Verifier batterie, cable fourni, dimensions et marquage produit.",
  },
  {
    key: "rouleau-adhesif-poils-animaux-lavable",
    name: "Rouleau adhesif poils animaux lavable",
    categoryId: "dropshipping-animaux",
    targetSalePriceCents: 1190,
    estimatedSupplierPriceCents: 380,
    deliveryTarget: "Livraison Europe rapide a verifier",
    angle: "Produit demonstration facile, utile pour chats/chiens, panier additionnel.",
    proofEffort: "Verifier matiere, mode de lavage et photos exactes du rouleau.",
  },
  {
    key: "organisateur-tiroir-cuisine-extensible",
    name: "Organisateur tiroir cuisine extensible",
    categoryId: "dropshipping-cuisine",
    targetSalePriceCents: 1990,
    estimatedSupplierPriceCents: 820,
    deliveryTarget: "Stock Europe a verifier",
    angle: "Produit rangement visible, valeur percue bonne, faible risque technique.",
    proofEffort: "Verifier dimensions exactes, couleur et photos fournisseur autorisees.",
  },
  {
    key: "brosse-nettoyage-joints-cuisine",
    name: "Brosse nettoyage joints cuisine",
    categoryId: "dropshipping-cuisine",
    targetSalePriceCents: 990,
    estimatedSupplierPriceCents: 260,
    deliveryTarget: "France/Europe 5 a 10 jours a verifier",
    angle: "Petit produit demonstratif pour TikTok/Reels, facile a vendre en lot.",
    proofEffort: "Verifier lot exact, poils, manche et image de la variante vendue.",
  },
  {
    key: "sacs-compression-voyage-lot",
    name: "Sacs compression voyage lot",
    categoryId: "dropshipping-accessoires",
    targetSalePriceCents: 1590,
    estimatedSupplierPriceCents: 540,
    deliveryTarget: "Entrepot Europe a verifier",
    angle: "Preparation vacances, gain de place concret, bon panier avant ete.",
    proofEffort: "Verifier nombre de sacs, tailles exactes, valve et droits photos.",
  },
  {
    key: "mini-humidificateur-usb-bureau",
    name: "Mini humidificateur USB bureau",
    categoryId: "dropshipping-high-tech",
    targetSalePriceCents: 1890,
    estimatedSupplierPriceCents: 690,
    deliveryTarget: "Europe 5 a 12 jours a verifier",
    angle: "Produit bureau/maison avec usage visuel clair, marge cible correcte.",
    proofEffort: "Verifier norme, capacite, cable, couleur et image exacte.",
  },
  {
    key: "protege-coins-silicone-enfant",
    name: "Protege coins silicone enfant",
    categoryId: "dropshipping-enfant",
    targetSalePriceCents: 1090,
    estimatedSupplierPriceCents: 320,
    deliveryTarget: "France/Europe a verifier",
    angle: "Produit securite maison simple, achat rationnel, vendable en lot.",
    proofEffort: "Verifier matiere, adhesif, quantite, conformite et avertissements.",
  },
  {
    key: "gourde-chien-voyage-anti-fuite",
    name: "Gourde chien voyage anti fuite",
    categoryId: "dropshipping-animaux",
    targetSalePriceCents: 1690,
    estimatedSupplierPriceCents: 610,
    deliveryTarget: "Stock Europe a verifier",
    angle: "Produit ete/sortie chien, demonstration facile et utile en mobile.",
    proofEffort: "Verifier volume, bouton, filtre, couleur et photos exactes.",
  },
  {
    key: "attaches-cables-velcro-lot",
    name: "Attaches cables velcro lot",
    categoryId: "dropshipping-accessoires",
    targetSalePriceCents: 890,
    estimatedSupplierPriceCents: 180,
    deliveryTarget: "France/Europe 5 a 10 jours a verifier",
    angle: "Produit petit prix pour augmenter panier moyen et reduire friction achat.",
    proofEffort: "Verifier quantite, longueur, couleurs et conditionnement exact.",
  },
  {
    key: "sac-rangement-chaussures-voyage",
    name: "Sac rangement chaussures voyage",
    categoryId: "dropshipping-mode",
    targetSalePriceCents: 1390,
    estimatedSupplierPriceCents: 430,
    deliveryTarget: "Entrepot Europe a verifier",
    angle: "Produit voyage propre, simple, bon pour bundles vacances et sport.",
    proofEffort: "Verifier taille, tissu, fermeture, coloris et galerie exacte.",
  },
  {
    key: "miroir-maquillage-led-compact",
    name: "Miroir maquillage LED compact",
    categoryId: "dropshipping-beaute",
    targetSalePriceCents: 1490,
    estimatedSupplierPriceCents: 520,
    deliveryTarget: "France/Europe 5 a 12 jours a verifier",
    angle: "Accessoire beaute simple, utile en voyage et facile a demontrer en video courte.",
    proofEffort: "Verifier dimensions, piles ou recharge, luminosite et photo exacte du modele.",
  },
  {
    key: "bandeau-skincare-microfibre",
    name: "Bandeau skincare microfibre",
    categoryId: "dropshipping-beaute",
    targetSalePriceCents: 890,
    estimatedSupplierPriceCents: 190,
    deliveryTarget: "Stock Europe a verifier",
    angle: "Petit prix beaute, panier additionnel, bon pour bundles routine soin.",
    proofEffort: "Verifier matiere, taille, coloris et photo exacte du lot vendu.",
  },
  {
    key: "organisateur-maquillage-transparent",
    name: "Organisateur maquillage transparent",
    categoryId: "dropshipping-beaute",
    targetSalePriceCents: 1790,
    estimatedSupplierPriceCents: 680,
    deliveryTarget: "Entrepot Europe a verifier",
    angle: "Produit rangement visible, valeur percue correcte et faible complexite technique.",
    proofEffort: "Verifier dimensions, nombre de compartiments, matiere et photos exactes.",
  },
  {
    key: "housse-protection-canape-animal",
    name: "Housse protection canape animal",
    categoryId: "dropshipping-maison",
    targetSalePriceCents: 2490,
    estimatedSupplierPriceCents: 1120,
    deliveryTarget: "Europe 5 a 12 jours a verifier",
    angle: "Produit maison utile pour familles avec animaux, panier moyen plus eleve.",
    proofEffort: "Verifier taille, tissu, couleur, compatibilite canape et photos exactes.",
  },
  {
    key: "tapis-egouttoir-vaisselle-microfibre",
    name: "Tapis egouttoir vaisselle microfibre",
    categoryId: "dropshipping-cuisine",
    targetSalePriceCents: 1290,
    estimatedSupplierPriceCents: 380,
    deliveryTarget: "France/Europe a verifier",
    angle: "Produit cuisine quotidien, demonstration claire et achat rationnel.",
    proofEffort: "Verifier dimensions, matiere, absorption, coloris et droits photos.",
  },
  {
    key: "etagere-douche-angle-adhesive",
    name: "Etagere douche angle adhesive",
    categoryId: "dropshipping-maison",
    targetSalePriceCents: 1990,
    estimatedSupplierPriceCents: 760,
    deliveryTarget: "Stock Europe a verifier",
    angle: "Rangement salle de bain sans percer, probleme concret et valeur percue bonne.",
    proofEffort: "Verifier dimensions, charge supportee, adhesif, matiere et photos exactes.",
  },
  {
    key: "sac-repas-isotherme-pliable",
    name: "Sac repas isotherme pliable",
    categoryId: "dropshipping-accessoires",
    targetSalePriceCents: 1490,
    estimatedSupplierPriceCents: 480,
    deliveryTarget: "France/Europe 5 a 10 jours a verifier",
    angle: "Produit bureau/ecole/voyage, usage facile a comprendre et saisonnier toute l annee.",
    proofEffort: "Verifier volume, isolation, fermeture, coloris et photo de la variante.",
  },
  {
    key: "mini-pompe-air-usb-voyage",
    name: "Mini pompe air USB voyage",
    categoryId: "dropshipping-high-tech",
    targetSalePriceCents: 1990,
    estimatedSupplierPriceCents: 820,
    deliveryTarget: "Entrepot Europe a verifier",
    angle: "Complement naturel aux sacs compression, panier moyen interessant.",
    proofEffort: "Verifier batterie, cable, embouts fournis, puissance et photos exactes.",
  },
  {
    key: "tapis-souris-ergonomique-repose-poignet",
    name: "Tapis souris ergonomique repose poignet",
    categoryId: "dropshipping-accessoires",
    targetSalePriceCents: 1290,
    estimatedSupplierPriceCents: 350,
    deliveryTarget: "France/Europe a verifier",
    angle: "Produit bureau simple, utile pour teletravail, faible risque de retour.",
    proofEffort: "Verifier dimensions, matiere, couleur et photo exacte du modele.",
  },
  {
    key: "brosse-chaussures-nettoyage-3-en-1",
    name: "Brosse chaussures nettoyage 3 en 1",
    categoryId: "dropshipping-mode",
    targetSalePriceCents: 990,
    estimatedSupplierPriceCents: 240,
    deliveryTarget: "Europe rapide a verifier",
    angle: "Petit produit demonstration, bon panier additionnel mode/sport.",
    proofEffort: "Verifier usage, matiere, lot exact et photos de la brosse vendue.",
  },
  {
    key: "diffuseur-voiture-clip-ventilation",
    name: "Diffuseur voiture clip ventilation",
    categoryId: "dropshipping-auto-moto",
    targetSalePriceCents: 1190,
    estimatedSupplierPriceCents: 280,
    deliveryTarget: "France/Europe 5 a 10 jours a verifier",
    angle: "Accessoire auto petit prix, simple a comprendre, potentiel achat impulsif.",
    proofEffort: "Verifier matiere, compatibilite ventilation, contenu exact et photos.",
  },
  {
    key: "filet-rangement-jouets-bain-enfant",
    name: "Filet rangement jouets bain enfant",
    categoryId: "dropshipping-enfant",
    targetSalePriceCents: 1090,
    estimatedSupplierPriceCents: 300,
    deliveryTarget: "France/Europe a verifier",
    angle: "Produit rangement enfant simple, achat familial, utile en salle de bain.",
    proofEffort: "Verifier ventouses, matiere, dimensions, securite enfant et photos exactes.",
  },
  {
    key: "porte-savon-drainant-silicone",
    name: "Porte savon drainant silicone",
    categoryId: "dropshipping-maison",
    targetSalePriceCents: 990,
    estimatedSupplierPriceCents: 260,
    deliveryTarget: "France/Europe 5 a 10 jours a verifier",
    angle: "Petit rangement salle de bain simple, visuel clair, bon panier additionnel.",
    proofEffort: "Verifier dimensions, matiere, couleur, drainage et photo exacte du modele.",
  },
  {
    key: "brosse-bouteille-flexible",
    name: "Brosse bouteille flexible",
    categoryId: "dropshipping-cuisine",
    targetSalePriceCents: 1090,
    estimatedSupplierPriceCents: 280,
    deliveryTarget: "Stock Europe a verifier",
    angle: "Produit nettoyage quotidien, demonstration facile et faible complexite technique.",
    proofEffort: "Verifier longueur, matiere, lot exact, usage alimentaire et photos exactes.",
  },
  {
    key: "organisateur-sac-main-feutre",
    name: "Organisateur sac a main feutre",
    categoryId: "dropshipping-mode",
    targetSalePriceCents: 1590,
    estimatedSupplierPriceCents: 520,
    deliveryTarget: "Entrepot Europe a verifier",
    angle: "Produit rangement mode utile, valeur percue correcte et retours limites si taille claire.",
    proofEffort: "Verifier dimensions, poches, coloris, compatibilite sac et galerie exacte.",
  },
  {
    key: "pelle-litiere-chat-support",
    name: "Pelle litiere chat avec support",
    categoryId: "dropshipping-animaux",
    targetSalePriceCents: 1290,
    estimatedSupplierPriceCents: 360,
    deliveryTarget: "France/Europe a verifier",
    angle: "Accessoire animal quotidien, besoin clair et produit simple a expliquer.",
    proofEffort: "Verifier dimensions, support inclus, matiere, couleur et photos exactes.",
  },
  {
    key: "coussinets-meubles-anti-rayures",
    name: "Coussinets meubles anti rayures lot",
    categoryId: "dropshipping-maison",
    targetSalePriceCents: 890,
    estimatedSupplierPriceCents: 180,
    deliveryTarget: "France/Europe 5 a 10 jours a verifier",
    angle: "Petit produit maison pratique, achat rationnel et bon complement panier.",
    proofEffort: "Verifier quantite, diametre, matiere, couleur et conditionnement exact.",
  },
  {
    key: "range-epices-adhesif-cuisine",
    name: "Range epices adhesif cuisine",
    categoryId: "dropshipping-cuisine",
    targetSalePriceCents: 1490,
    estimatedSupplierPriceCents: 480,
    deliveryTarget: "Stock Europe a verifier",
    angle: "Rangement cuisine sans percer, probleme concret et valeur percue correcte.",
    proofEffort: "Verifier charge supportee, adhesif, dimensions, contenu exact et photos.",
  },
  {
    key: "support-tablette-lit-canape",
    name: "Support tablette lit canape",
    categoryId: "dropshipping-high-tech",
    targetSalePriceCents: 1890,
    estimatedSupplierPriceCents: 690,
    deliveryTarget: "Entrepot Europe a verifier",
    angle: "Accessoire confort ecran, usage clair maison/bureau et panier moyen correct.",
    proofEffort: "Verifier compatibilite tailles, articulation, fixation et photos du modele vendu.",
  },
  {
    key: "trousse-toilette-suspendue-voyage",
    name: "Trousse toilette suspendue voyage",
    categoryId: "dropshipping-accessoires",
    targetSalePriceCents: 1790,
    estimatedSupplierPriceCents: 620,
    deliveryTarget: "France/Europe 5 a 12 jours a verifier",
    angle: "Produit voyage utile, facile a comprendre et vendable en saison vacances.",
    proofEffort: "Verifier dimensions, crochet, compartiments, coloris et photos exactes.",
  },
  {
    key: "bouchons-evier-silicone-lot",
    name: "Bouchons evier silicone lot",
    categoryId: "dropshipping-cuisine",
    targetSalePriceCents: 790,
    estimatedSupplierPriceCents: 160,
    deliveryTarget: "France/Europe a verifier",
    angle: "Petit accessoire cuisine, faible prix d'appel et achat de depannage simple.",
    proofEffort: "Verifier diametre, quantite, matiere, compatibilite et photo exacte du lot.",
  },
  {
    key: "organisateur-telecommande-canape",
    name: "Organisateur telecommande canape",
    categoryId: "dropshipping-maison",
    targetSalePriceCents: 1490,
    estimatedSupplierPriceCents: 470,
    deliveryTarget: "Stock Europe a verifier",
    angle: "Produit rangement salon simple, besoin recurrent et faible risque technique.",
    proofEffort: "Verifier dimensions, nombre de poches, matiere, couleur et photos exactes.",
  },
  {
    key: "sangle-valise-ajustable-voyage",
    name: "Sangle valise ajustable voyage",
    categoryId: "dropshipping-accessoires",
    targetSalePriceCents: 990,
    estimatedSupplierPriceCents: 230,
    deliveryTarget: "France/Europe 5 a 10 jours a verifier",
    angle: "Accessoire voyage compact, marge correcte et achat impulsif avant depart.",
    proofEffort: "Verifier longueur, boucle, couleur, largeur et photo exacte de la sangle.",
  },
  {
    key: "peigne-demelage-animaux-double-face",
    name: "Peigne demelage animaux double face",
    categoryId: "dropshipping-animaux",
    targetSalePriceCents: 1390,
    estimatedSupplierPriceCents: 420,
    deliveryTarget: "Entrepot Europe a verifier",
    angle: "Produit entretien animal utile, demonstration simple et panier additionnel possible.",
    proofEffort: "Verifier taille, dents, securite animal, matiere et photos exactes.",
  },
];

function buildCandidate(seed, dateKey) {
  const id = `integration_articles_${dateKey}_${seed.key}`;
  const slug = `${slugify(seed.name)}-partenaire-hold`;
  const image = categoryImage(seed.categoryId);
  const estimatedMarginCents = seed.targetSalePriceCents - seed.estimatedSupplierPriceCents;
  const estimatedMarginRate = Math.round((estimatedMarginCents / seed.targetSalePriceCents) * 100);

  return {
    id,
    slug,
    name: seed.name,
    categoryId: seed.categoryId,
    price: seed.targetSalePriceCents,
    compareAtPrice: Math.round(seed.targetSalePriceCents * 1.25),
    condition: "Neuf - fournisseur partenaire a verifier",
    stock: 0,
    badge: "Integration HOLD",
    image,
    images: [image],
    imageAlt: `${seed.name} - visuel categorie temporaire, image produit exacte a prouver`,
    shortDescription:
      "Brouillon dropshipping interne. Image exacte, fournisseur, SKU, prix reel, stock et delai a verifier avant toute mise en vente.",
    description:
      "Fiche candidate preparee pour Maxi Trouvaille dans la branche integration articles. Elle sert a organiser la recherche fournisseur et les preuves business. La fiche doit rester en brouillon/HOLD tant que le fournisseur exact, la variante exacte, les photos exactes, les droits image, le stock, le prix fournisseur, le delai France/Europe et la validation Mouss ne sont pas completes.",
    features: [
      seed.angle,
      `Prix cible client: ${(seed.targetSalePriceCents / 100).toFixed(2)} EUR.`,
      `Marge cible estimee: ${(estimatedMarginCents / 100).toFixed(2)} EUR (${estimatedMarginRate}%) a confirmer avec prix fournisseur reel.`,
      `Livraison visee: ${seed.deliveryTarget}.`,
      seed.proofEffort,
    ],
    livraisonDisponible: "colissimo uniquement",
    source: "internal",
    status: "draft",
    commerceStatus: "available",
    dropshipping: {
      enabled: true,
      supplierName: "Fournisseur France/Europe a verifier",
      supplierUrl: "",
      supplierSku: "",
      supplierPriceCents: 0,
      supplierStock: 0,
      deliveryEstimate: "A verifier avant publication",
      isPromotion: false,
      isNew: true,
      logisticsPartnerLabel: "partenaire logistique",
      salePriceCents: seed.targetSalePriceCents,
      marginCents: 0,
      syncStatus: "manual",
      validationGate: {
        source: "Branche integration articles Maxi Trouvaille",
        checkedAt: new Date().toISOString(),
        checks: [
          "Produit prepare uniquement en brouillon/HOLD",
          "Image exacte non prouvee",
          "Fournisseur exact non prouve",
          "Prix, stock et delai non prouves",
          "Validation Mouss obligatoire avant vente",
        ],
        candidateId: id,
        candidateCategory: seed.categoryId,
        sourceGeneratedAt: dateKey,
        note:
          "HOLD integration: ne pas publier, ne pas acheter, ne pas commander. Completer preuves fournisseur, image exacte, droits, marge, stock, delai et validation Mouss.",
      },
    },
    imageValidation: {
      status: "hold_integration_candidate_no_exact_image",
      checkedAt: new Date().toISOString(),
      sourceUrl: "",
      imageCount: 0,
      reason: "Image de categorie temporaire utilisee seulement pour le travail interne.",
      nextAction:
        "Remplacer par photos WebP exactes du produit vendu apres preuve fournisseur et droits images.",
    },
    sourceVerification: {
      status: "hold_supplier_not_verified",
      checkedAt: new Date().toISOString(),
      productUrl: "",
      evidenceUrl: "",
      sourcePriceRange: `Estimation interne fournisseur: ${(seed.estimatedSupplierPriceCents / 100).toFixed(2)} EUR a verifier`,
      sourceSignal: "Integration articles dropshipping; preuve externe a collecter.",
      imageCount: 0,
      deliveryStatus: "hold_delivery_to_verify",
      priceStatus: "hold_estimate_only",
      rightsStatus: "hold_rights_missing",
    },
    internalSourcing: {
      validationStatus: "HOLD_INTEGRATION_ARTICLES",
      evidenceUrl: "",
      evidenceNote:
        "Candidate utile pour sourcing rapide. Ne devient vendable qu apres preuve fournisseur exacte, images exactes, droits, marge, stock, delai et validation Mouss.",
      pricingRule: `Prix cible ${(seed.targetSalePriceCents / 100).toFixed(2)} EUR; fournisseur estime ${(seed.estimatedSupplierPriceCents / 100).toFixed(2)} EUR; marge cible ${(estimatedMarginCents / 100).toFixed(2)} EUR (${estimatedMarginRate}%) a confirmer.`,
      pricingUpdatedAt: new Date().toISOString(),
    },
    seo: {
      title: `${seed.name} | Maxi Trouvaille`,
      description:
        "Produit partenaire en validation interne. Mise en vente bloquee tant que les preuves fournisseur et image exacte ne sont pas completes.",
      h1: seed.name,
      h2: "Produit partenaire en validation",
      keywords: ["maxi trouvaille", "produit partenaire", "dropshipping", "validation fournisseur"],
      imageAlt: `${seed.name} - image exacte a valider avant publication`,
    },
  };
}

function markdownReport(payload) {
  const lines = [
    "# Integration articles dropshipping - lot courant",
    "",
    `Date: ${payload.generatedAt}`,
    "",
    "## Synthese",
    "",
    `- Mode apply: ${payload.apply ? "oui" : "non"}`,
    `- Produits candidats prepares: ${payload.candidateCount}`,
    `- Produits ajoutes: ${payload.addedCount}`,
    `- Produits deja presents: ${payload.skippedCount}`,
    `- Total quick-products apres couche: ${payload.afterCount}`,
    "",
    "## Produits ajoutes",
    "",
    "| Produit | Categorie | Prix cible | Marge cible | Statut |",
    "|---|---|---:|---:|---|",
    ...payload.added.map(
      (product) =>
        `| ${product.name} | ${product.categoryId} | ${(product.price / 100).toFixed(2)} EUR | ${product.targetMargin} | draft/HOLD |`,
    ),
    "",
    "## Garde-fous",
    "",
    "- Aucune publication production.",
    "- Aucune commande fournisseur.",
    "- Aucun paiement fournisseur.",
    "- Aucune image exacte inventee ou approximative utilisee comme preuve.",
    "- Les images sont des visuels de categorie temporaires internes, bloquees par imageValidation/sourceVerification.",
    "- Fournisseur exact, SKU, prix fournisseur reel, stock, delai France/Europe, droits image et validation Mouss restent obligatoires.",
    "",
    "## Prochaine action",
    "",
    "Prendre 3 a 5 fiches du lot, chercher fournisseur Europe/France exact, remplir les preuves, deposer les WebP exacts et relancer les audits de gates avant toute revue humaine.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

const dateKey = localDateKey();
const generatedAt = new Date().toISOString();
const quickProducts = readJson(quickProductsPath);

if (!Array.isArray(quickProducts)) {
  throw new Error("data/quick-products.json must contain an array.");
}

const existingIds = new Set(quickProducts.map((product) => product.id));
const existingSlugs = new Set(quickProducts.map((product) => product.slug));
const candidates = candidateSeeds.map((seed) => buildCandidate(seed, dateKey));
const addable = candidates.filter((candidate) => !existingIds.has(candidate.id) && !existingSlugs.has(candidate.slug));
const skipped = candidates.filter((candidate) => existingIds.has(candidate.id) || existingSlugs.has(candidate.slug));

let backupPath = null;
if (apply && addable.length > 0) {
  const backupDir = path.join(root, "backups", `quick-products-before-integration-articles-${localDateStamp()}`);
  fs.mkdirSync(backupDir, { recursive: true });
  backupPath = path.join(backupDir, "quick-products.json.bak");
  fs.copyFileSync(quickProductsPath, backupPath);
  fs.writeFileSync(quickProductsPath, `${JSON.stringify([...quickProducts, ...addable], null, 2)}\n`, "utf8");
}

const addedForReport = addable.map((product) => {
  const targetMargin = product.internalSourcing?.pricingRule?.match(/marge cible ([^;]+);/)?.[1] ?? "a verifier";

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    categoryId: product.categoryId,
    price: product.price,
    targetMargin,
  };
});

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const payload = {
  generatedAt,
  apply,
  quickProductsPath,
  backupPath,
  beforeCount: quickProducts.length,
  candidateCount: candidates.length,
  addedCount: apply ? addable.length : 0,
  wouldAddCount: addable.length,
  skippedCount: skipped.length,
  afterCount: quickProducts.length + (apply ? addable.length : 0),
  added: addedForReport,
  skipped: skipped.map((product) => ({ id: product.id, slug: product.slug, name: product.name })),
  safety: {
    statusDraftOnly: candidates.every((product) => product.status === "draft"),
    exactImageMissingHold: candidates.every((product) =>
      String(product.imageValidation?.status ?? "").includes("hold"),
    ),
    supplierUrlMissingHold: candidates.every((product) => !product.dropshipping?.supplierUrl),
    supplierSkuMissingHold: candidates.every((product) => !product.dropshipping?.supplierSku),
    noSupplierOrder: true,
    noPayment: true,
    noPublication: true,
  },
};

const jsonPath = path.join(outputDir, `INTEGRATION_ARTICLES_${dateKey}.json`);
const mdPath = path.join(outputDir, `INTEGRATION_ARTICLES_${dateKey}.md`);

fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(payload), "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: apply ? "apply" : "dry-run",
      candidateCount: payload.candidateCount,
      addedCount: payload.addedCount,
      wouldAddCount: payload.wouldAddCount,
      skippedCount: payload.skippedCount,
      beforeCount: payload.beforeCount,
      afterCount: payload.afterCount,
      files: { jsonPath, mdPath, backupPath },
      safety: payload.safety,
    },
    null,
    2,
  ),
);

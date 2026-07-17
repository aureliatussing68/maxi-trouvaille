import { promises as fs } from "fs";
import path from "path";

const quickProductsPath = path.join(process.cwd(), "data", "quick-products.json");

function withPartnerPricing(product) {
  const supplierPriceCents = product.dropshipping.supplierPriceCents;
  const salePriceCents = Math.ceil((supplierPriceCents * 1.4) / 10) * 10;

  return {
    ...product,
    price: salePriceCents,
    dropshipping: {
      ...product.dropshipping,
      salePriceCents,
      marginCents: salePriceCents - supplierPriceCents,
      syncStatus: "manual",
      lastSyncAt: "2026-05-27",
    },
    internalSourcing: {
      ...product.internalSourcing,
      markupPercent: 40,
      pricingRule: "Prix de vente = prix fournisseur estime x 1,40, arrondi aux 10 centimes superieurs.",
      validationStatus: "a verifier manuellement avant commande fournisseur",
    },
  };
}

const productsToImport = [
  {
    id: "ali_partner_20260527_support_tel_voiture_001",
    slug: "support-telephone-voiture-360-partenaire",
    name: "Support téléphone voiture 360°",
    categoryId: "dropshipping-auto-moto",
    condition: "Neuf - fournisseur partenaire",
    stock: 40,
    badge: "Nouveauté",
    image: "/uploads/category-images/auto-moto.webp",
    images: ["/uploads/category-images/auto-moto.webp"],
    shortDescription:
      "Support orientable pour garder le téléphone visible en voiture, pratique pour GPS et appels mains libres.",
    description:
      "Support téléphone voiture 360° pensé pour une utilisation simple au quotidien : GPS, appels mains libres et maintien stable du smartphone. Produit partenaire neuf, à valider manuellement avant toute commande fournisseur.",
    features: [
      "Rotation 360° pour ajuster facilement l'angle de vue",
      "Pensé pour GPS, trajets quotidiens et mains libres",
      "Produit partenaire neuf avec validation humaine avant commande",
      "Délai estimé : 7 à 15 jours ouvrés selon fournisseur",
    ],
    livraisonDisponible: "colissimo uniquement",
    source: "internal",
    status: "published",
    dropshipping: {
      enabled: true,
      supplierName: "AliExpress Choice - à confirmer",
      supplierUrl:
        "https://www.aliexpress.com/wholesale?SearchText=360+rearview+mirror+phone+holder+choice",
      supplierSku: "AE-CHOICE-CAR-HOLDER-001",
      supplierPriceCents: 970,
      supplierStock: 40,
      deliveryEstimate: "7 à 15 jours ouvrés estimés",
      isPromotion: false,
      isNew: true,
      logisticsPartnerLabel: "partenaire logistique",
    },
    internalSourcing: {
      evidenceUrl:
        "https://www.mypredicthub.com/blog/best-holders-and-stands-product-on-aliexpress-2026-guide",
      evidenceNote: "Prix repere $10.92 et option livraison rapide indiquee dans le guide source.",
    },
  },
  {
    id: "ali_partner_20260527_lampes_detection_001",
    slug: "lot-2-lampes-led-detection-mouvement-usb",
    name: "Lot 2 lampes LED détection mouvement USB",
    categoryId: "dropshipping-maison",
    condition: "Neuf - fournisseur partenaire",
    stock: 50,
    badge: "Nouveauté",
    image: "/uploads/category-images/maison.webp",
    images: ["/uploads/category-images/maison.webp"],
    shortDescription:
      "Lampes LED rechargeables avec détection de mouvement pour placard, couloir ou coin sombre.",
    description:
      "Lot de 2 lampes LED compactes avec détection de mouvement, utile pour éclairer un placard, une entrée, un couloir ou un meuble. Produit partenaire neuf, à valider manuellement avant toute commande fournisseur.",
    features: [
      "Détection de mouvement pour éclairage automatique",
      "Recharge USB pratique",
      "Format lot de 2 pour augmenter la valeur panier",
      "Délai estimé : 7 à 15 jours ouvrés selon fournisseur",
    ],
    livraisonDisponible: "colissimo uniquement",
    source: "internal",
    status: "published",
    dropshipping: {
      enabled: true,
      supplierName: "AliExpress Choice - à confirmer",
      supplierUrl:
        "https://www.aliexpress.com/wholesale?SearchText=USB+motion+sensor+cabinet+light+choice",
      supplierSku: "AE-CHOICE-MOTION-LIGHT-002",
      supplierPriceCents: 540,
      supplierStock: 50,
      deliveryEstimate: "7 à 15 jours ouvrés estimés",
      isPromotion: false,
      isNew: true,
      logisticsPartnerLabel: "partenaire logistique",
    },
    internalSourcing: {
      evidenceUrl:
        "https://www.reddit.com/r/xiaomi_discount/comments/1mzsd1z",
      evidenceNote: "Prix repere $2.70 par lampe sur offre AliExpress similaire.",
    },
  },
  {
    id: "ali_partner_20260527_brosse_poils_animaux_001",
    slug: "brosse-anti-poils-animaux-reutilisable",
    name: "Brosse anti-poils animaux réutilisable",
    categoryId: "dropshipping-animaux",
    condition: "Neuf - fournisseur partenaire",
    stock: 45,
    badge: "Nouveauté",
    image: "/uploads/category-images/animaux.webp",
    images: ["/uploads/category-images/animaux.webp"],
    shortDescription:
      "Brosse réutilisable pour retirer les poils de chien et chat sur canapé, tapis, lit ou voiture.",
    description:
      "Brosse anti-poils animaux réutilisable, utile pour nettoyer canapés, tapis, couvertures, sièges auto et paniers. Produit partenaire neuf, à valider manuellement avant toute commande fournisseur.",
    features: [
      "Réutilisable, sans recharge jetable",
      "Utile sur canapé, tapis, lit et siège auto",
      "Produit pratique pour propriétaires de chiens et chats",
      "Délai estimé : 7 à 15 jours ouvrés selon fournisseur",
    ],
    livraisonDisponible: "colissimo uniquement",
    source: "internal",
    status: "published",
    dropshipping: {
      enabled: true,
      supplierName: "AliExpress Choice - à confirmer",
      supplierUrl:
        "https://www.aliexpress.com/wholesale?SearchText=reusable+pet+hair+remover+brush+choice",
      supplierSku: "AE-CHOICE-PET-BRUSH-003",
      supplierPriceCents: 789,
      supplierStock: 45,
      deliveryEstimate: "7 à 15 jours ouvrés estimés",
      isPromotion: false,
      isNew: true,
      logisticsPartnerLabel: "partenaire logistique",
    },
    internalSourcing: {
      evidenceUrl: "https://vi.pricearchive.org/aliexpress.com/item/1005011984700750",
      evidenceNote: "Prix repere PriceArchive : 7,89 EUR.",
    },
  },
  {
    id: "ali_partner_20260527_support_pc_pliant_001",
    slug: "support-ordinateur-portable-pliant-aluminium",
    name: "Support ordinateur portable pliant aluminium",
    categoryId: "dropshipping-high-tech",
    condition: "Neuf - fournisseur partenaire",
    stock: 35,
    badge: "Nouveauté",
    image: "/uploads/category-images/high-tech.webp",
    images: ["/uploads/category-images/high-tech.webp"],
    shortDescription:
      "Support pliant pour ordinateur portable, pratique pour bureau, télétravail et déplacements.",
    description:
      "Support ordinateur portable pliant en aluminium, pensé pour améliorer l'angle de travail et garder un setup propre. Produit partenaire neuf, à valider manuellement avant toute commande fournisseur.",
    features: [
      "Compatible avec de nombreux ordinateurs 10 à 15,6 pouces",
      "Format pliant facile à transporter",
      "Idéal télétravail, bureau et étudiant",
      "Délai estimé : 7 à 15 jours ouvrés selon fournisseur",
    ],
    livraisonDisponible: "colissimo uniquement",
    source: "internal",
    status: "published",
    dropshipping: {
      enabled: true,
      supplierName: "AliExpress Choice - à confirmer",
      supplierUrl:
        "https://www.aliexpress.com/wholesale?SearchText=foldable+aluminum+laptop+stand+choice",
      supplierSku: "AE-CHOICE-LAPTOP-STAND-004",
      supplierPriceCents: 1180,
      supplierStock: 35,
      deliveryEstimate: "7 à 15 jours ouvrés estimés",
      isPromotion: false,
      isNew: true,
      logisticsPartnerLabel: "partenaire logistique",
    },
    internalSourcing: {
      evidenceUrl: "https://www.pricearchive.org/aliexpress.com/item/1005009671290730",
      evidenceNote: "Prix repere PriceArchive : $13.26.",
    },
  },
  {
    id: "ali_partner_20260527_sacs_rangement_vide_001",
    slug: "sacs-rangement-sous-vide-voyage",
    name: "Sacs rangement sous vide voyage",
    categoryId: "dropshipping-accessoires",
    condition: "Neuf - fournisseur partenaire",
    stock: 60,
    badge: "Nouveauté",
    image: "/uploads/category-images/accessoires.webp",
    images: ["/uploads/category-images/accessoires.webp"],
    shortDescription:
      "Sacs de compression pour gagner de la place dans une valise, un placard ou un rangement maison.",
    description:
      "Sacs rangement sous vide pratiques pour comprimer vêtements, linge ou affaires de voyage. Produit partenaire neuf, à valider manuellement avant toute commande fournisseur.",
    features: [
      "Aide à gagner de la place en voyage ou à la maison",
      "Produit léger et facile à expédier",
      "Intéressant pour départs vacances et rangement saisonnier",
      "Délai estimé : 7 à 15 jours ouvrés selon fournisseur",
    ],
    livraisonDisponible: "colissimo uniquement",
    source: "internal",
    status: "published",
    dropshipping: {
      enabled: true,
      supplierName: "AliExpress Choice - à confirmer",
      supplierUrl:
        "https://www.aliexpress.com/wholesale?SearchText=travel+vacuum+storage+bags+choice",
      supplierSku: "AE-CHOICE-VACUUM-BAGS-005",
      supplierPriceCents: 530,
      supplierStock: 60,
      deliveryEstimate: "7 à 15 jours ouvrés estimés",
      isPromotion: false,
      isNew: true,
      logisticsPartnerLabel: "partenaire logistique",
    },
    internalSourcing: {
      evidenceUrl: "https://www.sistastore.com/products/170869",
      evidenceNote: "Prix repere $5.97, note 4.9 et volume de ventes indique par la source.",
    },
  },
  {
    id: "ali_partner_20260527_mini_humidificateur_usb_001",
    slug: "mini-humidificateur-usb-bureau-maison",
    name: "Mini humidificateur USB bureau & maison",
    categoryId: "dropshipping-maison",
    condition: "Neuf - fournisseur partenaire",
    stock: 50,
    badge: "Nouveauté",
    image: "/uploads/category-images/maison.webp",
    images: ["/uploads/category-images/maison.webp"],
    shortDescription:
      "Petit humidificateur USB pour bureau, chambre ou voiture, format compact et facile à poser.",
    description:
      "Mini humidificateur USB compact pour bureau, chambre, coin détente ou voiture. Produit partenaire neuf, à valider manuellement avant toute commande fournisseur.",
    features: [
      "Format compact pour bureau ou table de nuit",
      "Alimentation USB simple",
      "Produit visuel facile à mettre en avant en vidéo",
      "Délai estimé : 7 à 15 jours ouvrés selon fournisseur",
    ],
    livraisonDisponible: "colissimo uniquement",
    source: "internal",
    status: "published",
    dropshipping: {
      enabled: true,
      supplierName: "AliExpress Choice - à confirmer",
      supplierUrl:
        "https://www.aliexpress.com/wholesale?SearchText=mini+USB+humidifier+choice",
      supplierSku: "AE-CHOICE-HUMIDIFIER-006",
      supplierPriceCents: 360,
      supplierStock: 50,
      deliveryEstimate: "7 à 15 jours ouvrés estimés",
      isPromotion: false,
      isNew: true,
      logisticsPartnerLabel: "partenaire logistique",
    },
    internalSourcing: {
      evidenceUrl: "https://ko.pricearchive.org/aliexpress.com/item/1005007578805705",
      evidenceNote: "Prix repere PriceArchive : environ $4.05 à $4.23.",
    },
  },
  {
    id: "ali_partner_20260527_pochette_cables_voyage_001",
    slug: "pochette-rangement-cables-voyage-premium",
    name: "Pochette rangement câbles voyage",
    categoryId: "dropshipping-accessoires",
    condition: "Neuf - fournisseur partenaire",
    stock: 55,
    badge: "Nouveauté",
    image: "/uploads/category-images/accessoires.webp",
    images: ["/uploads/category-images/accessoires.webp"],
    shortDescription:
      "Pochette zippée pour ranger chargeurs, câbles, écouteurs et petits accessoires tech.",
    description:
      "Pochette rangement câbles voyage, utile pour organiser chargeurs, câbles, écouteurs, cartes mémoire et petits accessoires. Produit partenaire neuf, à valider manuellement avant toute commande fournisseur.",
    features: [
      "Rangement simple pour accessoires tech",
      "Format voyage, bureau ou sac à dos",
      "Produit léger avec bon potentiel d'achat impulsif",
      "Délai estimé : 7 à 15 jours ouvrés selon fournisseur",
    ],
    livraisonDisponible: "colissimo uniquement",
    source: "internal",
    status: "published",
    dropshipping: {
      enabled: true,
      supplierName: "AliExpress Choice - à confirmer",
      supplierUrl:
        "https://www.aliexpress.com/wholesale?SearchText=travel+cable+organizer+bag+choice",
      supplierSku: "AE-CHOICE-CABLE-BAG-007",
      supplierPriceCents: 1100,
      supplierStock: 55,
      deliveryEstimate: "7 à 15 jours ouvrés estimés",
      isPromotion: false,
      isNew: true,
      logisticsPartnerLabel: "partenaire logistique",
    },
    internalSourcing: {
      evidenceUrl: "https://www.sistastore.com/products/132954",
      evidenceNote: "Prix repere $12.37, note 4.9 et volume de ventes indique par la source.",
    },
  },
  {
    id: "ali_partner_20260527_gourde_pliable_001",
    slug: "gourde-pliable-silicone-voyage",
    name: "Gourde pliable silicone voyage",
    categoryId: "dropshipping-accessoires",
    condition: "Neuf - fournisseur partenaire",
    stock: 70,
    badge: "Nouveauté",
    image: "/uploads/category-images/accessoires.webp",
    images: ["/uploads/category-images/accessoires.webp"],
    shortDescription:
      "Gourde souple et pliable pour sport, voyage, randonnée ou sac du quotidien.",
    description:
      "Gourde pliable en silicone, pratique pour transporter une bouteille légère qui prend moins de place une fois vide. Produit partenaire neuf, à valider manuellement avant toute commande fournisseur.",
    features: [
      "Format pliable pour gagner de la place",
      "Utile en sport, voyage, camping ou sac quotidien",
      "Produit visuel et facile à présenter",
      "Délai estimé : 7 à 15 jours ouvrés selon fournisseur",
    ],
    livraisonDisponible: "colissimo uniquement",
    source: "internal",
    status: "published",
    dropshipping: {
      enabled: true,
      supplierName: "AliExpress Choice - à confirmer",
      supplierUrl:
        "https://www.aliexpress.com/wholesale?SearchText=collapsible+silicone+water+bottle+choice",
      supplierSku: "AE-CHOICE-FOLD-BOTTLE-008",
      supplierPriceCents: 370,
      supplierStock: 70,
      deliveryEstimate: "7 à 15 jours ouvrés estimés",
      isPromotion: false,
      isNew: true,
      logisticsPartnerLabel: "partenaire logistique",
    },
    internalSourcing: {
      evidenceUrl:
        "https://aliexpress.ru/popular/%D1%81%D0%BA%D0%BB%D0%B0%D0%B4%D0%BD%D0%B0%D1%8F-%D0%B1%D1%83%D1%82%D1%8B%D0%BB%D0%BA%D0%B0-%D0%B4%D0%BB%D1%8F-%D0%B2%D0%BE%D0%B4%D1%8B-%D1%81%D0%B8%D0%BB%D0%B8%D0%BA%D0%BE%D0%BD",
      evidenceNote: "Page AliExpress indiquant plusieurs offres avec notes et volumes d'achat.",
    },
  },
  {
    id: "ali_partner_20260527_tapis_evier_silicone_001",
    slug: "tapis-silicone-anti-eclaboussures-evier",
    name: "Tapis silicone anti-éclaboussures évier",
    categoryId: "dropshipping-cuisine",
    condition: "Neuf - fournisseur partenaire",
    stock: 60,
    badge: "Nouveauté",
    image: "/uploads/category-images/cuisine.webp",
    images: ["/uploads/category-images/cuisine.webp"],
    shortDescription:
      "Tapis silicone à placer autour du robinet pour limiter les traces d'eau et poser une éponge.",
    description:
      "Tapis silicone anti-éclaboussures pour évier, pratique pour limiter les traces d'eau autour du robinet et garder l'espace plus propre. Produit partenaire neuf, à valider manuellement avant toute commande fournisseur.",
    features: [
      "Aide à garder le plan de travail plus propre",
      "Peut servir de support éponge ou petit égouttoir",
      "Produit cuisine simple, visuel et démonstratif",
      "Délai estimé : 7 à 15 jours ouvrés selon fournisseur",
    ],
    livraisonDisponible: "colissimo uniquement",
    source: "internal",
    status: "published",
    dropshipping: {
      enabled: true,
      supplierName: "AliExpress Choice - à confirmer",
      supplierUrl:
        "https://www.aliexpress.com/wholesale?SearchText=silicone+sink+splash+guard+choice",
      supplierSku: "AE-CHOICE-SINK-MAT-009",
      supplierPriceCents: 500,
      supplierStock: 60,
      deliveryEstimate: "7 à 15 jours ouvrés estimés",
      isPromotion: false,
      isNew: true,
      logisticsPartnerLabel: "partenaire logistique",
    },
    internalSourcing: {
      evidenceUrl: "https://es.pricearchive.org/aliexpress.com/item/1005011663468333",
      evidenceNote: "Prix repere PriceArchive : $5.63.",
    },
  },
  {
    id: "ali_partner_20260527_filet_coffre_voiture_001",
    slug: "filet-rangement-coffre-voiture",
    name: "Filet rangement coffre voiture",
    categoryId: "dropshipping-auto-moto",
    condition: "Neuf - fournisseur partenaire",
    stock: 45,
    badge: "Nouveauté",
    image: "/uploads/category-images/auto-moto.webp",
    images: ["/uploads/category-images/auto-moto.webp"],
    shortDescription:
      "Filet de rangement pour organiser le coffre et éviter que les petits objets se baladent.",
    description:
      "Filet rangement coffre voiture, utile pour maintenir câbles, petits outils, sacs ou accessoires auto en place. Produit partenaire neuf, à valider manuellement avant toute commande fournisseur.",
    features: [
      "Aide à organiser le coffre et les petits accessoires auto",
      "Produit léger, pratique et facile à expédier",
      "Intéressant pour famille, trajet quotidien ou véhicule pro",
      "Délai estimé : 7 à 15 jours ouvrés selon fournisseur",
    ],
    livraisonDisponible: "colissimo uniquement",
    source: "internal",
    status: "published",
    dropshipping: {
      enabled: true,
      supplierName: "AliExpress Choice - à confirmer",
      supplierUrl:
        "https://www.aliexpress.com/wholesale?SearchText=car+trunk+storage+net+organizer+choice",
      supplierSku: "AE-CHOICE-CAR-NET-010",
      supplierPriceCents: 400,
      supplierStock: 45,
      deliveryEstimate: "7 à 15 jours ouvrés estimés",
      isPromotion: false,
      isNew: true,
      logisticsPartnerLabel: "partenaire logistique",
    },
    internalSourcing: {
      evidenceUrl: "https://no.pricearchive.org/aliexpress.com/item/1005006160871310",
      evidenceNote: "Produit similaire référence par PriceArchive.",
    },
  },
].map(withPartnerPricing);

async function main() {
  const currentProducts = JSON.parse(await fs.readFile(quickProductsPath, "utf8"));
  const importIds = new Set(productsToImport.map((product) => product.id));
  const preservedProducts = currentProducts.filter(
    (product) => !importIds.has(product.id),
  );

  await fs.writeFile(
    quickProductsPath,
    `${JSON.stringify([...productsToImport, ...preservedProducts], null, 2)}\n`,
    "utf8",
  );

  console.log(`Imported ${productsToImport.length} partner products with +40% pricing.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

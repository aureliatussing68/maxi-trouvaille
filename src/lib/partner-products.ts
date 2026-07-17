export type PartnerProduct = {
  id: string;
  productId: string;
  slug: string;
  name: string;
  category: string;
  image: string;
  estimatedSupplierPrice: string;
  suggestedSalePrice: string;
  salePriceCents: number;
  marginNote: string;
  deliveryNote: string;
  supplier: string;
  supplierSearchUrl: string;
  status: "test" | "ready" | "paused";
  description: string;
  highlights: string[];
};

export const partnerProducts: PartnerProduct[] = [
  {
    id: "partner-mini-thermal-printer",
    productId: "prod_partner_thermal_printer_001",
    slug: "mini-imprimante-thermique-bluetooth",
    name: "Mini imprimante thermique Bluetooth",
    category: "High-tech / organisation",
    image: "/uploads/partner-products/mini-imprimante-thermique.webp",
    estimatedSupplierPrice: "12 à 24 €",
    suggestedSalePrice: "29,90 €",
    salePriceCents: 2990,
    marginNote: "Prix fixe Maxi Trouvaille avec marge incluse, paiement chez nous.",
    deliveryNote: "Produit neuf sourcé fournisseur : disponibilité et délai à confirmer après commande.",
    supplier: "AliExpress / Temu",
    supplierSearchUrl:
      "https://www.aliexpress.com/wholesale?SearchText=mini+thermal+printer+bluetooth",
    status: "test",
    description:
      "Mini imprimante sans encre pour notes, étiquettes, listes, rangement et petits usages créatifs. Produit simple à démontrer en vidéo courte.",
    highlights: [
      "Produit tendance organisation",
      "Démonstration facile en vidéo",
      "Consommable papier à proposer plus tard",
      "Prix public simple à 29,90 €",
    ],
  },
  {
    id: "partner-cable-organizer-bag",
    productId: "prod_partner_cable_organizer_001",
    slug: "organisateur-cables-voyage-tech",
    name: "Organisateur de câbles et accessoires tech",
    category: "Accessoires / voyage",
    image: "/uploads/partner-products/organisateur-cables-voyage.webp",
    estimatedSupplierPrice: "2 à 6 €",
    suggestedSalePrice: "12,90 €",
    salePriceCents: 1290,
    marginNote: "Petit produit d’appel avec marge incluse, facile à ajouter au panier.",
    deliveryNote: "Produit neuf sourcé fournisseur : taille et délai à confirmer après commande.",
    supplier: "Temu / AliExpress",
    supplierSearchUrl:
      "https://www.aliexpress.com/wholesale?SearchText=cable+organizer+bag+travel+electronics",
    status: "test",
    description:
      "Petite pochette pour ranger chargeurs, câbles, écouteurs, cartes mémoire et accessoires de voyage. Bon produit à petit prix.",
    highlights: [
      "Prix fournisseur bas",
      "Produit utile toute l’année",
      "Léger et peu encombrant",
      "Bon complément de panier",
    ],
  },
  {
    id: "partner-galaxy-projector",
    productId: "prod_partner_galaxy_projector_001",
    slug: "projecteur-galaxie-led-ambiance",
    name: "Projecteur galaxie LED pour ambiance",
    category: "Maison / déco",
    image: "/uploads/partner-products/projecteur-galaxie-led.webp",
    estimatedSupplierPrice: "7 à 15 €",
    suggestedSalePrice: "24,90 €",
    salePriceCents: 2490,
    marginNote: "Très visuel, idéal TikTok/Reels, prix fixe avec marge incluse.",
    deliveryNote: "Produit neuf sourcé fournisseur : alimentation, option et délai à confirmer après commande.",
    supplier: "Temu / AliExpress",
    supplierSearchUrl:
      "https://www.aliexpress.com/wholesale?SearchText=galaxy+projector+led+star+light",
    status: "test",
    description:
      "Lampe d’ambiance qui projette des effets galaxie ou ciel étoilé. Produit visuel, parfait pour contenu vidéo et achat cadeau.",
    highlights: [
      "Fort potentiel vidéo",
      "Idée cadeau simple",
      "Prix public accessible",
      "Bon angle déco/chambre",
    ],
  },
  {
    id: "partner-cordless-car-vacuum",
    productId: "prod_partner_car_vacuum_001",
    slug: "mini-aspirateur-voiture-sans-fil",
    name: "Mini aspirateur voiture sans fil",
    category: "Auto / nettoyage",
    image: "/uploads/partner-products/aspirateur-voiture-sans-fil.webp",
    estimatedSupplierPrice: "14 à 28 €",
    suggestedSalePrice: "39,90 €",
    salePriceCents: 3990,
    marginNote: "Panier moyen plus élevé, marge incluse dans le prix Maxi Trouvaille.",
    deliveryNote: "Produit neuf sourcé fournisseur : puissance, accessoires et délai à confirmer après commande.",
    supplier: "AliExpress / fournisseur UE",
    supplierSearchUrl:
      "https://www.aliexpress.com/wholesale?SearchText=cordless+car+vacuum+cleaner",
    status: "test",
    description:
      "Petit aspirateur rechargeable pour voiture, miettes, poussière et entretien rapide. Bon produit démonstration avant/après.",
    highlights: [
      "Démonstration avant/après facile",
      "Cible auto large",
      "Panier moyen plus élevé",
      "Qualité fournisseur à valider avant vente",
    ],
  },
];

export function getPartnerProducts() {
  return partnerProducts;
}

import type { ProductSource, SellerListingMeta } from "@/lib/marketplace";

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  accent: string;
  image: string;
  parentId?: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  price: number;
  compareAtPrice?: number;
  condition: string;
  stock: number;
  badge: string;
  image: string;
  images?: string[];
  shortDescription: string;
  description: string;
  features: string[];
  isTestProduct?: boolean;
  status?: "published" | "draft" | "archived";
  livraisonDisponible?:
    | "toutes"
    | "remise uniquement"
    | "mondial relay uniquement"
    | "colissimo uniquement"
    | "sur devis";
  commerceStatus?: "available" | "coming-soon";
  dropshipping?: DropshippingProductMeta;
  source: ProductSource;
  sellerListing?: SellerListingMeta;
};

export type DropshippingProductMeta = {
  enabled: boolean;
  supplierName?: string;
  supplierUrl?: string;
  supplierSku?: string;
  supplierPriceCents?: number;
  salePriceCents?: number;
  marginCents?: number;
  supplierStock?: number;
  deliveryEstimate?: string;
  isPromotion?: boolean;
  isNew?: boolean;
  logisticsPartnerLabel?: string;
  syncStatus?: "manual" | "ready" | "error";
  lastSyncAt?: string;
};

export type ProductBadgeTone =
  | "coming-soon"
  | "dropshipping"
  | "new"
  | "promotion"
  | "stock"
  | "default";

export type ProductBadge = {
  label: string;
  tone: ProductBadgeTone;
};

export const mainCategoryIds = [
  "colis-surprise-palettes",
  "dropshipping",
] as const;

const hiddenNavigationCategoryIds = ["colis-surprise"] as const;

const categoryImageBase = "/uploads/category-images";

const categoryImageById: Record<string, string> = {
  "colis-surprise-palettes": `${categoryImageBase}/colis-surprise-palettes.webp`,
  dropshipping: `${categoryImageBase}/dropshipping.webp`,
  "dropshipping-nouveautes": `${categoryImageBase}/dropshipping-nouveautes.webp`,
  "dropshipping-promotions": `${categoryImageBase}/dropshipping-promotions.webp`,
  "dropshipping-maison": `${categoryImageBase}/maison.webp`,
  "dropshipping-cuisine": `${categoryImageBase}/cuisine.webp`,
  "dropshipping-beaute": `${categoryImageBase}/beaute-sante.webp`,
  "dropshipping-high-tech": `${categoryImageBase}/high-tech.webp`,
  "dropshipping-accessoires": `${categoryImageBase}/accessoires.webp`,
  "dropshipping-auto-moto": `${categoryImageBase}/auto-moto.webp`,
  "dropshipping-animaux": `${categoryImageBase}/animaux.webp`,
  "dropshipping-enfant": `${categoryImageBase}/jouets.webp`,
  "dropshipping-mode": `${categoryImageBase}/vetements.webp`,
  "palettes-destockage": `${categoryImageBase}/espace-revendeur.webp`,
  "colis-mysteres": `${categoryImageBase}/colis-surprise-palettes.webp`,
  "colis-au-poids": `${categoryImageBase}/colis-surprise-palettes.webp`,
  "lots-bonnes-affaires": `${categoryImageBase}/dropshipping-promotions.webp`,
  "espace-revendeur": `${categoryImageBase}/espace-revendeur.webp`,
  "sport-loisirs": `${categoryImageBase}/sport-loisirs.webp`,
  "auto-moto": `${categoryImageBase}/auto-moto.webp`,
  animaux: `${categoryImageBase}/animaux.webp`,
  "livre-media": `${categoryImageBase}/livre-media.webp`,
  "jeux-video": `${categoryImageBase}/jeux-video.webp`,
  puericulture: `${categoryImageBase}/puericulture.webp`,
  cuisine: `${categoryImageBase}/cuisine.webp`,
  outillage: `${categoryImageBase}/outillage.webp`,
  jardin: `${categoryImageBase}/jardin.webp`,
  "beaute-sante": `${categoryImageBase}/beaute-sante.webp`,
  informatique: `${categoryImageBase}/informatique.webp`,
  telephonie: `${categoryImageBase}/telephonie.webp`,
  "agencement-magasin": `${categoryImageBase}/agencement-magasin.webp`,
  "mannequins-bustes": `${categoryImageBase}/mannequins-bustes.webp`,
  presentoirs: `${categoryImageBase}/presentoirs.webp`,
  "mobilier-professionnel": `${categoryImageBase}/mobilier-professionnel.webp`,
  "colis-surprise": `${categoryImageBase}/colis-surprise-palettes.webp`,
  vetements: `${categoryImageBase}/vetements.webp`,
  maison: `${categoryImageBase}/maison.webp`,
  deco: `${categoryImageBase}/deco.webp`,
  "high-tech": `${categoryImageBase}/high-tech.webp`,
  accessoires: `${categoryImageBase}/accessoires.webp`,
  jouets: `${categoryImageBase}/jouets.webp`,
  bricolage: `${categoryImageBase}/bricolage.webp`,
  electricite: `${categoryImageBase}/electricite.webp`,
  gadgets: `${categoryImageBase}/gadgets.webp`,
  "produits-partenaires": `${categoryImageBase}/produits-partenaires.webp`,
};

const rawCategories: Array<Omit<Category, "image">> = [
  {
    id: "colis-surprise-palettes",
    slug: "colis-surprise-palettes",
    name: "Colis surprise & palettes",
    description:
      "Palettes, colis mystères, colis au poids et lots surprise issus de déstockage.",
    accent: "#ffbf38",
  },
  {
    id: "dropshipping",
    slug: "dropshipping",
    name: "Dropshipping",
    description:
      "Produits partenaires neufs, promotions, nouveautes et selections multi-categories.",
    accent: "#0f766e",
  },
  {
    id: "dropshipping-nouveautes",
    slug: "dropshipping-nouveautes",
    name: "Nouveautés",
    description: "Les derniers produits partenaires prepares pour Maxi Trouvaille.",
    accent: "#2563eb",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-promotions",
    slug: "dropshipping-promotions",
    name: "Promotions",
    description: "Selections partenaires avec prix barres et offres mises en avant.",
    accent: "#be123c",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-maison",
    slug: "dropshipping-maison",
    name: "Maison",
    description: "Objets utiles pour la maison, le rangement et le confort.",
    accent: "#0f766e",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-cuisine",
    slug: "dropshipping-cuisine",
    name: "Cuisine",
    description: "Ustensiles, accessoires pratiques et petites idees cuisine.",
    accent: "#ea580c",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-beaute",
    slug: "dropshipping-beaute",
    name: "Beauté",
    description: "Soins, accessoires beaute et bien-etre expedies par partenaire.",
    accent: "#e11d48",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-high-tech",
    slug: "dropshipping-high-tech",
    name: "High-tech",
    description: "Accessoires connectes, charge, audio et gadgets utiles.",
    accent: "#2563eb",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-accessoires",
    slug: "dropshipping-accessoires",
    name: "Accessoires",
    description: "Petits produits pratiques, rangement, voyage et accessoires du quotidien.",
    accent: "#db2777",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-auto-moto",
    slug: "dropshipping-auto-moto",
    name: "Auto / Moto",
    description: "Accessoires auto, nettoyage, confort et equipement vehicule.",
    accent: "#dc2626",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-animaux",
    slug: "dropshipping-animaux",
    name: "Animaux",
    description: "Accessoires partenaires pour chiens, chats et animaux du quotidien.",
    accent: "#ca8a04",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-enfant",
    slug: "dropshipping-enfant",
    name: "Enfant",
    description: "Idees utiles, cadeaux et accessoires pour enfants.",
    accent: "#16a34a",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-mode",
    slug: "dropshipping-mode",
    name: "Mode",
    description: "Accessoires mode et petits essentiels textiles.",
    accent: "#7c3aed",
    parentId: "dropshipping",
  },
  {
    id: "palettes-destockage",
    slug: "palettes-destockage",
    name: "Palettes",
    description:
      "Palettes déstockage, palettes mystères, palettes visibles et arrivages réguliers.",
    accent: "#b45309",
    parentId: "colis-surprise-palettes",
  },
  {
    id: "colis-mysteres",
    slug: "colis-mysteres",
    name: "Colis mystères",
    description:
      "Colis perdus, colis surprise, cartons mystères et contenu aléatoire issu de déstockage.",
    accent: "#be123c",
    parentId: "colis-surprise-palettes",
  },
  {
    id: "colis-au-poids",
    slug: "colis-au-poids",
    name: "Colis au poids",
    description:
      "Colis vendus au poids, 5 kg, 10 kg ou plus, pour découvrir plusieurs produits à prix réduit.",
    accent: "#0f766e",
    parentId: "colis-surprise-palettes",
  },
  {
    id: "lots-bonnes-affaires",
    slug: "lots-bonnes-affaires",
    name: "Lots & bonnes affaires",
    description:
      "Lots aléatoires, lots de déstockage, arrivages surprise et bonnes affaires visibles.",
    accent: "#2563eb",
    parentId: "colis-surprise-palettes",
  },
  {
    id: "espace-revendeur",
    slug: "espace-revendeur",
    name: "Espace revendeur",
    description:
      "Lots en quantité, palettes et prix dégressifs pour professionnels, marchés et revente.",
    accent: "#7c3aed",
  },
  {
    id: "sport-loisirs",
    slug: "sport-loisirs",
    name: "Sport & loisirs",
    description: "Sport, plein air, camping, fitness et loisirs actifs.",
    accent: "#16a34a",
  },
  {
    id: "auto-moto",
    slug: "auto-moto",
    name: "Auto / moto",
    description: "Pieces, accessoires et equipement pour voiture et moto.",
    accent: "#dc2626",
  },
  {
    id: "animaux",
    slug: "animaux",
    name: "Animaux",
    description: "Accessoires pour chiens, chats, aquarium et animaux.",
    accent: "#ca8a04",
  },
  {
    id: "livre-media",
    slug: "livre-media",
    name: "Livre / média",
    description: "Livres, BD, mangas, DVD, CD, vinyles et supports media.",
    accent: "#9333ea",
  },
  {
    id: "jeux-video",
    slug: "jeux-video",
    name: "Jeux vidéo",
    description: "Consoles, manettes, jeux et accessoires gaming.",
    accent: "#2563eb",
  },
  {
    id: "puericulture",
    slug: "puericulture",
    name: "Puériculture",
    description: "Bebe, poussettes, sieges auto, biberons et accessoires.",
    accent: "#db2777",
  },
  {
    id: "cuisine",
    slug: "cuisine",
    name: "Cuisine",
    description: "Ustensiles, vaisselle, robots, mugs et equipement cuisine.",
    accent: "#ea580c",
  },
  {
    id: "outillage",
    slug: "outillage",
    name: "Outillage",
    description: "Outils, perceuses, batteries, scies et materiel pro.",
    accent: "#d97706",
  },
  {
    id: "jardin",
    slug: "jardin",
    name: "Jardin",
    description: "Plantes, pots, arrosage, tondeuses et exterieur.",
    accent: "#15803d",
  },
  {
    id: "beaute-sante",
    slug: "beaute-sante",
    name: "Beauté / santé",
    description: "Soins, maquillage, parfum, cheveux et accessoires bien-etre.",
    accent: "#e11d48",
  },
  {
    id: "informatique",
    slug: "informatique",
    name: "Informatique",
    description: "PC, ecrans, claviers, souris, stockage et composants.",
    accent: "#0f766e",
  },
  {
    id: "telephonie",
    slug: "telephonie",
    name: "Téléphonie",
    description: "Telephones, smartphones, coques, chargeurs et ecouteurs.",
    accent: "#0284c7",
  },
  {
    id: "agencement-magasin",
    slug: "agencement-magasin",
    name: "Agencement magasin",
    description: "Portants, vitrines, rayons, gondoles et equipement de vente.",
    accent: "#0f766e",
  },
  {
    id: "mannequins-bustes",
    slug: "mannequins-bustes",
    name: "Mannequins & bustes",
    description: "Mannequins, bustes, têtes et supports de présentation.",
    accent: "#be123c",
  },
  {
    id: "presentoirs",
    slug: "presentoirs",
    name: "Présentoirs",
    description: "Présentoirs comptoir, supports et accessoires de mise en avant.",
    accent: "#0891b2",
  },
  {
    id: "mobilier-professionnel",
    slug: "mobilier-professionnel",
    name: "Mobilier professionnel",
    description: "Meubles, rangement et equipement pour activites pro.",
    accent: "#7c3aed",
  },
  {
    id: "colis-surprise",
    slug: "colis-surprise",
    name: "Colis surprise",
    description: "Lots mystere, retours et trouvailles a decouvrir.",
    accent: "#ffbf38",
    parentId: "colis-surprise-palettes",
  },
  {
    id: "vetements",
    slug: "vetements",
    name: "Vêtements",
    description: "Pieces neuves ou quasi neuves selon les arrivages.",
    accent: "#be123c",
  },
  {
    id: "maison",
    slug: "maison",
    name: "Maison",
    description: "Objets utiles pour le quotidien et l'equipement.",
    accent: "#0f766e",
  },
  {
    id: "deco",
    slug: "deco",
    name: "Déco",
    description: "Petites touches, rangements et ambiance.",
    accent: "#7c3aed",
  },
  {
    id: "high-tech",
    slug: "high-tech",
    name: "High-tech",
    description: "Accessoires connectes, audio, charge et gadgets utiles.",
    accent: "#2563eb",
  },
  {
    id: "accessoires",
    slug: "accessoires",
    name: "Accessoires",
    description: "Objets pratiques, mode et indispensables du sac.",
    accent: "#db2777",
  },
  {
    id: "jouets",
    slug: "jouets",
    name: "Jouets",
    description: "Idees pour enfants, jeux et petits cadeaux.",
    accent: "#16a34a",
  },
  {
    id: "bricolage",
    slug: "bricolage",
    name: "Bricolage",
    description: "Outils, pieces et equipement malin.",
    accent: "#d97706",
  },
  {
    id: "electricite",
    slug: "electricite",
    name: "Électricité",
    description: "Interrupteurs, prises, petits lots et accessoires.",
    accent: "#ca8a04",
  },
  {
    id: "gadgets",
    slug: "gadgets",
    name: "Gadgets",
    description: "Trouvailles amusantes, pratiques ou inattendues.",
    accent: "#0891b2",
  },
  {
    id: "produits-partenaires",
    slug: "produits-partenaires",
    name: "Produits partenaires",
    description:
      "Produits neufs sourcés chez des fournisseurs partenaires, vendus par Maxi Trouvaille.",
    accent: "#0f766e",
  },
];

export const categories: Category[] = rawCategories.map((category) => ({
  ...category,
  image:
    categoryImageById[category.id] ??
    `${categoryImageBase}/colis-surprise-palettes.webp`,
}));

export const products: Product[] = [
  {
    id: "prod_palette_mystere_destockage_001",
    slug: "palette-mystere-destockage",
    name: "Palette mystère déstockage",
    categoryId: "palettes-destockage",
    price: 89900,
    condition: "Produits possibles : neufs, quasi neufs ou occasion",
    stock: 3,
    badge: "Dès 899 €",
    image:
      "https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=900&q=80",
    images: [
      "https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=80",
    ],
    shortDescription:
      "Palette de déstockage avec contenu variable selon arrivage, pensée pour revendeurs et marchés.",
    description:
      "Exemple de palette de déstockage Maxi Trouvaille. Le contenu est variable selon les arrivages et peut inclure des produits neufs, quasi neufs ou d'occasion. Aucun contenu exact n'est promis pour les palettes mystères.",
    features: [
      "Arrivage type palette mystère ou visible selon stock",
      "Adapté aux revendeurs, marchés et bonnes affaires en volume",
      "Contenu non garanti : composition variable selon déstockage",
      "Objet volumineux : retrait ou devis livraison personnalisé",
    ],
    livraisonDisponible: "sur devis",
    isTestProduct: true,
    commerceStatus: "coming-soon",
    source: "internal",
    status: "published",
  },
  {
    id: "prod_colis_surprise_10kg_001",
    slug: "colis-surprise-10-kg",
    name: "Colis surprise 10 kg",
    categoryId: "colis-au-poids",
    price: 5900,
    condition: "Produits possibles : neufs, quasi neufs ou occasion",
    stock: 12,
    badge: "10 kg",
    image:
      "https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=900&q=80",
    images: [
      "https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=900&q=80",
    ],
    shortDescription:
      "Colis vendu au poids pour découvrir plusieurs produits de déstockage à prix réduit.",
    description:
      "Exemple de colis surprise 10 kg. Le contenu est aléatoire et dépend des arrivages disponibles. Les produits possibles peuvent être neufs, quasi neufs ou d'occasion, sans promesse de contenu exact.",
    features: [
      "Format 10 kg pour tester plusieurs trouvailles",
      "Contenu aléatoire issu de déstockage",
      "Produits possibles : maison, accessoires, gadgets ou textile",
      "Idéal pour particuliers curieux et petits revendeurs",
    ],
    livraisonDisponible: "toutes",
    isTestProduct: true,
    commerceStatus: "coming-soon",
    source: "internal",
    status: "published",
  },
  {
    id: "prod_colis_mystere_premium_001",
    slug: "colis-mystere-premium",
    name: "Colis mystère premium",
    categoryId: "colis-mysteres",
    price: 9900,
    compareAtPrice: 12900,
    condition: "Produits possibles : neufs, quasi neufs ou occasion",
    stock: 8,
    badge: "Premium",
    image:
      "https://images.unsplash.com/photo-1512909006721-3d6018887383?auto=format&fit=crop&w=900&q=80",
    images: [
      "https://images.unsplash.com/photo-1512909006721-3d6018887383?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=900&q=80",
    ],
    shortDescription:
      "Colis mystère orienté bonnes affaires, avec sélection variable selon arrivage.",
    description:
      "Exemple de colis mystère premium. Il s'agit d'un colis surprise dont le contenu reste aléatoire. Les articles possibles peuvent être neufs, quasi neufs ou d'occasion selon le lot disponible.",
    features: [
      "Sélection orientée trouvailles utiles ou cadeaux",
      "Contenu aléatoire et non garanti",
      "Prix attractif par rapport à l'achat à l'unité",
      "Préparé pour une expérience simple et rassurante",
    ],
    livraisonDisponible: "toutes",
    isTestProduct: true,
    commerceStatus: "coming-soon",
    source: "internal",
    status: "published",
  },
  {
    id: "prod_lot_special_marche_001",
    slug: "lot-special-marche",
    name: "Lot spécial marché",
    categoryId: "lots-bonnes-affaires",
    price: 24900,
    condition: "Lot visible ou semi-visible selon arrivage",
    stock: 5,
    badge: "Lot pro",
    image:
      "https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&w=900&q=80",
    images: [
      "https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&w=900&q=80",
    ],
    shortDescription:
      "Lot pensé pour les marchés, stands, brocantes et revente à petit prix.",
    description:
      "Exemple de lot spécial marché. Les articles sont sélectionnés pour créer une offre visible ou semi-visible selon les arrivages. Les états peuvent varier : neuf, quasi neuf ou occasion.",
    features: [
      "Pensé pour marchés, stands et revente locale",
      "Produits possibles : vêtements, accessoires, maison ou gadgets",
      "Prix attractif pour achat en quantité",
      "Composition à confirmer selon arrivage disponible",
    ],
    livraisonDisponible: "sur devis",
    isTestProduct: true,
    commerceStatus: "coming-soon",
    source: "internal",
    status: "published",
  },
  {
    id: "prod_pack_revendeur_001",
    slug: "pack-revendeur",
    name: "Pack revendeur",
    categoryId: "espace-revendeur",
    price: 49900,
    condition: "Lots en quantité selon disponibilité",
    stock: 4,
    badge: "Revendeur",
    image:
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=80",
    images: [
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=900&q=80",
    ],
    shortDescription:
      "Pack en volume pour revendeurs, professionnels, marchés et lots à prix dégressif.",
    description:
      "Exemple de pack revendeur Maxi Trouvaille. Il prépare une offre de lots en quantité avec prix dégressifs selon volume et disponibilité. Le contenu exact dépend des arrivages.",
    features: [
      "Prévu pour revendeurs, marchés et professionnels",
      "Prix dégressifs possibles selon volume",
      "Lots visibles, semi-visibles ou mystères selon arrivage",
      "Retrait ou devis personnalisé pour les volumes importants",
    ],
    livraisonDisponible: "sur devis",
    isTestProduct: true,
    source: "internal",
    status: "published",
  },
  {
    id: "prod_partner_thermal_printer_001",
    slug: "mini-imprimante-thermique-bluetooth",
    name: "Mini imprimante thermique Bluetooth",
    categoryId: "dropshipping-high-tech",
    price: 2990,
    compareAtPrice: 3990,
    condition: "Neuf - fournisseur partenaire",
    stock: 20,
    badge: "Neuf partenaire",
    image: "/uploads/partner-products/mini-imprimante-thermique.webp",
    images: ["/uploads/partner-products/mini-imprimante-thermique.webp"],
    shortDescription:
      "Petite imprimante sans encre pour notes, étiquettes, listes et organisation.",
    description:
      "Mini imprimante thermique Bluetooth pensée pour imprimer rapidement notes, étiquettes, listes et petits contenus du quotidien. Produit neuf sourcé chez un fournisseur partenaire, vendu par Maxi Trouvaille avec paiement sécurisé sur le site.",
    features: [
      "Prix fournisseur estimé : 12 à 24 € selon modèle et délai",
      "Prix Maxi Trouvaille fixe : 29,90 €",
      "Produit neuf sourcé auprès d'un fournisseur partenaire",
      "Disponibilité, application et papier inclus à confirmer après commande",
    ],
    livraisonDisponible: "colissimo uniquement",
    dropshipping: {
      enabled: true,
      supplierName: "Fournisseur partenaire",
      supplierUrl:
        "https://www.aliexpress.com/wholesale?SearchText=mini+thermal+printer+bluetooth",
      supplierPriceCents: 1800,
      salePriceCents: 2990,
      marginCents: 1190,
      supplierStock: 20,
      deliveryEstimate: "8 a 15 jours ouvres",
      isPromotion: true,
      isNew: true,
      logisticsPartnerLabel: "partenaire logistique",
      syncStatus: "manual",
    },
    source: "internal",
    status: "published",
  },
  {
    id: "prod_partner_cable_organizer_001",
    slug: "organisateur-cables-voyage-tech",
    name: "Organisateur de câbles et accessoires tech",
    categoryId: "dropshipping-accessoires",
    price: 1290,
    compareAtPrice: 1990,
    condition: "Neuf - fournisseur partenaire",
    stock: 30,
    badge: "Petit prix",
    image: "/uploads/partner-products/organisateur-cables-voyage.webp",
    images: ["/uploads/partner-products/organisateur-cables-voyage.webp"],
    shortDescription:
      "Pochette pratique pour ranger chargeurs, câbles, écouteurs et petits accessoires.",
    description:
      "Organisateur compact pour garder câbles, chargeurs, cartes mémoire, écouteurs et accessoires tech au même endroit. Produit neuf sourcé chez un fournisseur partenaire, vendu par Maxi Trouvaille à prix simple.",
    features: [
      "Prix fournisseur estimé : 2 à 6 € selon taille et finition",
      "Prix Maxi Trouvaille fixe : 12,90 €",
      "Produit léger, utile et facile à ajouter au panier",
      "Taille exacte et délai fournisseur à confirmer après commande",
    ],
    livraisonDisponible: "colissimo uniquement",
    dropshipping: {
      enabled: true,
      supplierName: "Fournisseur partenaire",
      supplierUrl:
        "https://www.aliexpress.com/wholesale?SearchText=cable+organizer+bag+travel+electronics",
      supplierPriceCents: 400,
      salePriceCents: 1290,
      marginCents: 890,
      supplierStock: 30,
      deliveryEstimate: "8 a 15 jours ouvres",
      isPromotion: true,
      isNew: false,
      logisticsPartnerLabel: "partenaire logistique",
      syncStatus: "manual",
    },
    source: "internal",
    status: "published",
  },
  {
    id: "prod_partner_galaxy_projector_001",
    slug: "projecteur-galaxie-led-ambiance",
    name: "Projecteur galaxie LED pour ambiance",
    categoryId: "dropshipping-maison",
    price: 2490,
    compareAtPrice: 3490,
    condition: "Neuf - fournisseur partenaire",
    stock: 20,
    badge: "Ambiance",
    image: "/uploads/partner-products/projecteur-galaxie-led.webp",
    images: ["/uploads/partner-products/projecteur-galaxie-led.webp"],
    shortDescription:
      "Lampe d'ambiance qui projette un effet galaxie ou ciel étoilé dans une pièce.",
    description:
      "Projecteur LED décoratif pour créer une ambiance galaxie dans une chambre, un salon ou un coin détente. Produit neuf sourcé chez un fournisseur partenaire, vendu directement par Maxi Trouvaille.",
    features: [
      "Prix fournisseur estimé : 7 à 15 € selon options",
      "Prix Maxi Trouvaille fixe : 24,90 €",
      "Produit visuel, idéal cadeau et contenu vidéo",
      "Alimentation, télécommande et délai à confirmer après commande",
    ],
    livraisonDisponible: "colissimo uniquement",
    dropshipping: {
      enabled: true,
      supplierName: "Fournisseur partenaire",
      supplierUrl:
        "https://www.aliexpress.com/wholesale?SearchText=galaxy+projector+led+star+light",
      supplierPriceCents: 1100,
      salePriceCents: 2490,
      marginCents: 1390,
      supplierStock: 20,
      deliveryEstimate: "8 a 15 jours ouvres",
      isPromotion: false,
      isNew: true,
      logisticsPartnerLabel: "partenaire logistique",
      syncStatus: "manual",
    },
    source: "internal",
    status: "published",
  },
  {
    id: "prod_partner_car_vacuum_001",
    slug: "mini-aspirateur-voiture-sans-fil",
    name: "Mini aspirateur voiture sans fil",
    categoryId: "dropshipping-auto-moto",
    price: 3990,
    compareAtPrice: 4990,
    condition: "Neuf - fournisseur partenaire",
    stock: 15,
    badge: "Auto",
    image: "/uploads/partner-products/aspirateur-voiture-sans-fil.webp",
    images: ["/uploads/partner-products/aspirateur-voiture-sans-fil.webp"],
    shortDescription:
      "Aspirateur rechargeable compact pour nettoyer rapidement voiture, miettes et poussières.",
    description:
      "Mini aspirateur sans fil pratique pour l'entretien rapide de la voiture, des sièges, tapis et petits espaces. Produit neuf sourcé chez un fournisseur partenaire, vendu par Maxi Trouvaille avec prix fixe.",
    features: [
      "Prix fournisseur estimé : 14 à 28 € selon puissance et accessoires",
      "Prix Maxi Trouvaille fixe : 39,90 €",
      "Format démonstration avant/après facile",
      "Puissance réelle, embouts fournis et délai à confirmer après commande",
    ],
    livraisonDisponible: "colissimo uniquement",
    dropshipping: {
      enabled: true,
      supplierName: "Fournisseur partenaire",
      supplierUrl:
        "https://www.aliexpress.com/wholesale?SearchText=cordless+car+vacuum+cleaner",
      supplierPriceCents: 2200,
      salePriceCents: 3990,
      marginCents: 1790,
      supplierStock: 15,
      deliveryEstimate: "8 a 15 jours ouvres",
      isPromotion: true,
      isNew: false,
      logisticsPartnerLabel: "partenaire logistique",
      syncStatus: "manual",
    },
    source: "internal",
    status: "published",
  },
  {
    id: "prod_test_pack_decouverte_001",
    slug: "pack-decouverte-test",
    name: "Pack decouverte test",
    categoryId: "high-tech",
    price: 1990,
    compareAtPrice: 3490,
    condition: "Produit fictif - affichage test",
    stock: 8,
    badge: "Mode test",
    image:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
    images: [
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
    ],
    shortDescription:
      "Un exemple de fiche produit pour valider la boutique, le panier et le futur paiement Stripe test.",
    description:
      "Ce produit est volontairement fictif. Il sert a verifier l'apparence de la boutique Maxi Trouvaille, le fonctionnement du panier, la fiche produit et le tunnel de paiement en mode test Stripe.",
    features: [
      "Fiche produit modele prete a dupliquer",
      "Prix et stock centralises dans le catalogue",
      "Compatible avec le panier local",
      "Paiement reel bloque tant qu'une validation finale n'est pas faite",
    ],
    livraisonDisponible: "toutes",
    isTestProduct: true,
    source: "internal",
  },
];

const surpriseComingSoonCategoryIds = new Set([
  "colis-surprise-palettes",
  "palettes-destockage",
  "colis-mysteres",
  "colis-au-poids",
  "colis-surprise",
  "lots-bonnes-affaires",
]);

const surpriseComingSoonKeywords = [
  "palette surprise",
  "palettes surprise",
  "palette mystere",
  "palettes mystere",
  "colis surprise",
  "colis mystere",
  "box mystere",
  "mystery box",
  "colis perdu",
  "colis perdus",
];

function normalizeCatalogText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isComingSoonProduct(product: Product) {
  if (product.commerceStatus === "coming-soon") {
    return true;
  }

  if (surpriseComingSoonCategoryIds.has(product.categoryId)) {
    return true;
  }

  const searchable = normalizeCatalogText(
    `${product.name} ${product.shortDescription} ${product.description}`,
  );

  return surpriseComingSoonKeywords.some((keyword) =>
    searchable.includes(normalizeCatalogText(keyword)),
  );
}

export function isDropshippingProduct(product: Product) {
  return Boolean(product.dropshipping?.enabled);
}

export function isPromotionProduct(product: Product) {
  return Boolean(product.dropshipping?.isPromotion || product.compareAtPrice);
}

export function isNewProduct(product: Product) {
  return Boolean(product.dropshipping?.isNew);
}

export function isProductPurchasable(product: Product) {
  return (
    (product.status ?? "published") === "published" &&
    product.stock > 0 &&
    !isComingSoonProduct(product)
  );
}

export function getPublicDeliveryEstimate(product: Product) {
  if (isComingSoonProduct(product)) {
    return "Bientot disponible sur Maxi Trouvaille";
  }

  if (product.dropshipping?.deliveryEstimate) {
    return product.dropshipping.deliveryEstimate;
  }

  return "Livraison estimee au panier";
}

export function getProductBadges(product: Product): ProductBadge[] {
  if (isComingSoonProduct(product)) {
    return [{ label: "À venir", tone: "coming-soon" }];
  }

  const badges: ProductBadge[] = [];

  if (isDropshippingProduct(product)) {
    badges.push({ label: "Dropshipping", tone: "dropshipping" });
  }

  if (isNewProduct(product)) {
    badges.push({ label: "Nouveauté", tone: "new" });
  }

  if (isPromotionProduct(product)) {
    badges.push({ label: "Promotion", tone: "promotion" });
  }

  if (product.stock <= 0) {
    badges.push({ label: "Rupture de stock", tone: "stock" });
  }

  if (badges.length === 0 && product.badge) {
    badges.push({ label: product.badge, tone: "default" });
  }

  return badges;
}

export function getCategoryById(id: string) {
  return categories.find((category) => category.id === id);
}

export function getCategoryBySlug(slug: string) {
  return categories.find((category) => category.slug === slug);
}

function isHiddenNavigationCategory(category: Category) {
  return hiddenNavigationCategoryIds.includes(
    category.id as (typeof hiddenNavigationCategoryIds)[number],
  );
}

export function getTopLevelCategories() {
  return categories.filter(
    (category) => !category.parentId && !isHiddenNavigationCategory(category),
  );
}

export function getSubcategoriesByParentId(parentId: string) {
  return categories.filter(
    (category) =>
      category.parentId === parentId && !isHiddenNavigationCategory(category),
  );
}

export function getCategoryFamilyIds(categoryId: string): string[] {
  const childIds = categories
    .filter((category) => category.parentId === categoryId)
    .flatMap((category) => getCategoryFamilyIds(category.id));

  return [categoryId, ...childIds];
}

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getProductById(id: string) {
  return products.find((product) => product.id === id);
}

export function getProductsByCategory(categoryId: string) {
  const categoryIds = new Set(getCategoryFamilyIds(categoryId));
  return products.filter((product) => categoryIds.has(product.categoryId));
}

export function getFeaturedProducts() {
  return products.slice(0, 3);
}

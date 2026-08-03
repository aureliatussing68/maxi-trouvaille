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
  seo?: ProductSeoMeta;
  imageAlt?: string;
  imageValidation?: ProductImageValidationMeta;
  sourceVerification?: ProductSourceVerificationMeta;
  internalSourcing?: ProductInternalSourcingMeta;
  source: ProductSource;
  sellerListing?: SellerListingMeta;
};

export type ProductImageValidationMeta = {
  status?: string;
  checkedAt?: string;
  sourceUrl?: string;
  imageCount?: number;
  reason?: string;
  nextAction?: string;
};

export type ProductSourceVerificationMeta = {
  status?: string;
  checkedAt?: string;
  productUrl?: string;
  evidenceUrl?: string;
  sourcePriceRange?: string;
  sourceSignal?: string;
  imageCount?: number;
  deliveryStatus?: string;
  priceStatus?: string;
  rightsStatus?: string;
};

export type ProductInternalSourcingMeta = {
  validationStatus?: string;
  evidenceUrl?: string;
  evidenceNote?: string;
  findNicheDetailUrl?: string;
  pricingRule?: string;
  pricingUpdatedAt?: string;
};

export type ProductSeoMeta = {
  title?: string;
  description?: string;
  h1?: string;
  h2?: string;
  keywords?: string[];
  imageAlt?: string;
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
  validationGate?: {
    source: string;
    checkedAt: string;
    checks: string[];
    candidateId?: string;
    candidateCategory?: string;
    sourceGeneratedAt?: string;
    note?: string;
  };
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
  "sport-loisirs",
  "auto-moto",
  "jeux-video",
  "outillage",
  "informatique",
  "jardin",
  "telephonie",
  "maison",
  "high-tech",
  "electricite",
  "deco",
  "jouets",
  "gadgets",
  "animaux",
] as const;

export const dropshippingFocusCategoryIds = [
  "dropshipping",
  "dropshipping-nouveautes",
  "dropshipping-promotions",
  "dropshipping-maison",
  "dropshipping-cuisine",
  "dropshipping-beaute",
  "dropshipping-high-tech",
  "dropshipping-accessoires",
  "dropshipping-auto-moto",
  "dropshipping-animaux",
  "dropshipping-enfant",
  "dropshipping-mode",
  "dropshipping-outillage",
  "dropshipping-gaming",
] as const;

// Rayons mis en avant sur l'accueil et en bas de la boutique, dans l'ordre
// d'affichage. Liste VOLONTAIREMENT distincte de dropshippingFocusCategoryIds :
// cette derniere sert de garde de publication (isDropshippingCategory ->
// isPublicCategory -> isPublicProduct), en retirer une entree depublierait des
// produits entiers. Ici on ne fait que choisir ce que le client voit.
// Sont ecartes : "dropshipping" (fourre-tout qui doublonne la boutique entiere)
// ainsi que "dropshipping-nouveautes" et "dropshipping-promotions", qui sont des
// vues filtrees et non des univers de produits : ils redeviennent des raccourcis
// a part, pour qu'un client ne clique pas sur un "rayon" qui est un filtre.
export const homeShowcaseCategoryIds = [
  "dropshipping-cuisine",
  "dropshipping-maison",
  "dropshipping-high-tech",
  "dropshipping-accessoires",
  "dropshipping-beaute",
  "dropshipping-outillage",
  "dropshipping-animaux",
  "dropshipping-auto-moto",
  "dropshipping-enfant",
  "dropshipping-mode",
  "dropshipping-gaming",
] as const;

const publicStoreMode = "dropshipping" as const;
const dropshippingFocusCategoryIdSet = new Set<string>(dropshippingFocusCategoryIds);

const hiddenNavigationCategoryIds = [
  "colis-surprise-palettes",
  "palettes-destockage",
  "colis-mysteres",
  "colis-au-poids",
  "lots-bonnes-affaires",
  "colis-surprise",
  "produits-partenaires",
] as const;

const hiddenPublicCategoryIds = new Set<string>(hiddenNavigationCategoryIds);
const exactProductImagePrefixes = [
  "/uploads/partner-products/",
  "/uploads/quick-products/",
] as const;
const nonExactProductImagePrefixes = [
  "/uploads/category-images/",
  "/uploads/generated-products/",
] as const;

const partnerCategoryMirrors: Record<string, string[]> = {
  accessoires: ["dropshipping-accessoires", "dropshipping-mode"],
  "auto-moto": ["dropshipping-auto-moto"],
  animaux: ["dropshipping-animaux"],
  "beaute-sante": ["dropshipping-beaute"],
  bricolage: ["dropshipping-outillage", "dropshipping-high-tech", "dropshipping-accessoires"],
  cuisine: ["dropshipping-cuisine"],
  deco: ["dropshipping-maison", "dropshipping-accessoires"],
  electricite: ["dropshipping-outillage", "dropshipping-high-tech"],
  gadgets: ["dropshipping-accessoires", "dropshipping-high-tech"],
  "high-tech": ["dropshipping-high-tech", "dropshipping-gaming"],
  informatique: ["dropshipping-gaming", "dropshipping-high-tech", "dropshipping-accessoires"],
  jardin: ["dropshipping-maison", "dropshipping-accessoires"],
  "jeux-video": ["dropshipping-gaming", "dropshipping-high-tech", "dropshipping-accessoires"],
  outillage: ["dropshipping-outillage"],
  jouets: ["dropshipping-enfant", "dropshipping-accessoires"],
  maison: ["dropshipping-maison", "dropshipping-cuisine", "dropshipping-accessoires"],
  puericulture: ["dropshipping-enfant"],
  "sport-loisirs": ["dropshipping-accessoires", "dropshipping-high-tech"],
  telephonie: ["dropshipping-high-tech", "dropshipping-accessoires"],
  vetements: ["dropshipping-mode", "dropshipping-accessoires"],
};

const categoryImageBase = "/uploads/category-images";

const categoryImageById: Record<string, string> = {
  "colis-surprise-palettes": `${categoryImageBase}/colis-surprise-palettes.webp`,
  dropshipping: `${categoryImageBase}/produits-partenaires.webp`,
  "dropshipping-nouveautes": `${categoryImageBase}/nouveautes-partenaires.webp`,
  "dropshipping-promotions": `${categoryImageBase}/promotions-partenaires.webp`,
  "dropshipping-maison": `${categoryImageBase}/maison.webp`,
  "dropshipping-cuisine": `${categoryImageBase}/cuisine.webp`,
  "dropshipping-beaute": `${categoryImageBase}/beaute-sante.webp`,
  "dropshipping-high-tech": `${categoryImageBase}/high-tech.webp`,
  "dropshipping-accessoires": `${categoryImageBase}/accessoires.webp`,
  "dropshipping-auto-moto": `${categoryImageBase}/auto-moto.webp`,
  "dropshipping-animaux": `${categoryImageBase}/animaux.webp`,
  "dropshipping-enfant": `${categoryImageBase}/jouets.webp`,
  "dropshipping-mode": `${categoryImageBase}/vetements.webp`,
  "dropshipping-outillage": `${categoryImageBase}/outillage.webp`,
  "dropshipping-gaming": `${categoryImageBase}/jeux-video.webp`,
  "palettes-destockage": `${categoryImageBase}/espace-revendeur.webp`,
  "colis-mysteres": `${categoryImageBase}/colis-surprise-palettes.webp`,
  "colis-au-poids": `${categoryImageBase}/colis-surprise-palettes.webp`,
  "lots-bonnes-affaires": `${categoryImageBase}/promotions-partenaires.webp`,
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
    slug: "produits-partenaires",
    name: "Produits partenaires",
    description:
      "Produits neufs sélectionnés par Maxi Trouvaille, expédiés par partenaires logistiques, avec nouveautés et promotions.",
    accent: "#0f766e",
  },
  {
    id: "dropshipping-nouveautes",
    slug: "nouveautes-partenaires",
    name: "Nouveautés",
    description: "Les derniers produits partenaires préparés pour Maxi Trouvaille.",
    accent: "#2563eb",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-promotions",
    slug: "promotions-partenaires",
    name: "Promotions",
    description: "Sélections partenaires avec prix barrés et offres mises en avant.",
    accent: "#be123c",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-maison",
    slug: "maison-partenaires",
    name: "Maison",
    description: "Objets utiles pour la maison, le rangement et le confort.",
    accent: "#0f766e",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-cuisine",
    slug: "cuisine-partenaires",
    name: "Cuisine",
    description: "Ustensiles, accessoires pratiques et petites idées cuisine.",
    accent: "#ea580c",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-beaute",
    slug: "beaute-partenaires",
    name: "Beauté",
    description: "Soins, accessoires beauté et bien-être du quotidien.",
    accent: "#e11d48",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-high-tech",
    slug: "high-tech-partenaires",
    name: "High-tech",
    description: "Accessoires connectés, charge, audio et gadgets utiles.",
    accent: "#2563eb",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-accessoires",
    slug: "accessoires-partenaires",
    name: "Accessoires",
    description: "Petits produits pratiques, rangement, voyage et accessoires du quotidien.",
    accent: "#db2777",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-auto-moto",
    slug: "auto-moto-partenaires",
    name: "Auto / Moto",
    description: "Accessoires auto, nettoyage, confort et équipement véhicule.",
    accent: "#dc2626",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-animaux",
    slug: "animaux-partenaires",
    name: "Animaux",
    description: "Accessoires partenaires pour chiens, chats et animaux du quotidien.",
    accent: "#ca8a04",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-enfant",
    slug: "enfant-partenaires",
    name: "Enfant",
    description: "Idées cadeaux, jeux et accessoires pour enfants.",
    accent: "#16a34a",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-mode",
    slug: "mode-partenaires",
    name: "Mode",
    description: "Accessoires mode et petits essentiels textiles.",
    accent: "#7c3aed",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-outillage",
    slug: "outillage-partenaires",
    name: "Outillage & Bricolage",
    description: "Outils, visseuses, équipement chantier, énergie portable et panneaux solaires.",
    accent: "#b45309",
    parentId: "dropshipping",
  },
  {
    id: "dropshipping-gaming",
    slug: "gaming-partenaires",
    name: "Gaming & PC",
    description: "Accessoires console, périphériques PC, setup gaming et idées cadeaux joueurs.",
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
      "Lots en quantité, prix dégressifs et offres professionnelles pour marchés et revente.",
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
      "Produits neufs sélectionnés par Maxi Trouvaille et expédiés par partenaires logistiques.",
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
    status: "draft",
  },
  {
    id: "prod_partner_thermal_printer_001",
    slug: "mini-imprimante-thermique-bluetooth",
    name: "Mini imprimante thermique Bluetooth",
    categoryId: "dropshipping-high-tech",
    price: 2990,
    compareAtPrice: 3990,
    condition: "Neuf - selection partenaire",
    stock: 20,
    badge: "Neuf partenaire",
    image: "/uploads/partner-products/mini-imprimante-thermique.webp",
    images: ["/uploads/partner-products/mini-imprimante-thermique.webp"],
    shortDescription:
      "Petite imprimante sans encre pour notes, étiquettes, listes et organisation.",
    description:
      "Mini imprimante thermique Bluetooth pensée pour imprimer rapidement notes, étiquettes, listes et petits contenus du quotidien. Produit neuf vendu par Maxi Trouvaille avec paiement sécurisé sur le site.",
    features: [
      "Prix Maxi Trouvaille fixe : 29,90 €",
      "Produit neuf prepare avec expedition par partenaire logistique",
      "Application, papier inclus et delai client confirmes avant mise en vente",
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
      validationGate: {
        source: "Catalogue statique Maxi Trouvaille",
        checkedAt: "2026-06-09",
        checks: [
          "Produit partenaire statique repere par audit toutes sources",
          "Publication bloquee tant que fournisseur exact, SKU, images, prix et delai ne sont pas prouves",
        ],
        note: "HOLD jusqu'a validation fournisseur exact, SKU, droits images, prix reel et delai France/Europe.",
      },
    },
    source: "internal",
    status: "draft",
  },
  {
    id: "prod_partner_cable_organizer_001",
    slug: "organisateur-cables-voyage-tech",
    name: "Organisateur de câbles et accessoires tech",
    categoryId: "dropshipping-accessoires",
    price: 1290,
    compareAtPrice: 1990,
    condition: "Neuf - selection partenaire",
    stock: 30,
    badge: "Petit prix",
    image: "/uploads/partner-products/organisateur-cables-voyage.webp",
    images: ["/uploads/partner-products/organisateur-cables-voyage.webp"],
    shortDescription:
      "Pochette pratique pour ranger chargeurs, câbles, écouteurs et petits accessoires.",
    description:
      "Organisateur compact pour garder câbles, chargeurs, cartes mémoire, écouteurs et accessoires tech au même endroit. Produit neuf vendu par Maxi Trouvaille à prix simple.",
    features: [
      "Prix Maxi Trouvaille fixe : 12,90 €",
      "Produit léger, utile et facile à ajouter au panier",
      "Taille exacte, finition et delai client confirmes avant mise en vente",
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
      validationGate: {
        source: "Catalogue statique Maxi Trouvaille",
        checkedAt: "2026-06-09",
        checks: [
          "Produit partenaire statique repere par audit toutes sources",
          "Publication bloquee tant que fournisseur exact, SKU, images, prix et delai ne sont pas prouves",
        ],
        note: "HOLD jusqu'a validation fournisseur exact, SKU, droits images, prix reel et delai France/Europe.",
      },
    },
    source: "internal",
    status: "draft",
  },
  {
    id: "prod_partner_galaxy_projector_001",
    slug: "projecteur-galaxie-led-ambiance",
    name: "Projecteur galaxie LED pour ambiance",
    categoryId: "dropshipping-maison",
    price: 2490,
    compareAtPrice: 3490,
    condition: "Neuf - selection partenaire",
    stock: 20,
    badge: "Ambiance",
    image: "/uploads/partner-products/projecteur-galaxie-led.webp",
    images: ["/uploads/partner-products/projecteur-galaxie-led.webp"],
    shortDescription:
      "Lampe d'ambiance qui projette un effet galaxie ou ciel étoilé dans une pièce.",
    description:
      "Projecteur LED décoratif pour créer une ambiance galaxie dans une chambre, un salon ou un coin détente. Produit neuf vendu directement par Maxi Trouvaille.",
    features: [
      "Prix Maxi Trouvaille fixe : 24,90 €",
      "Produit visuel, idéal cadeau et contenu vidéo",
      "Alimentation, telecommande et delai client confirmes avant mise en vente",
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
      validationGate: {
        source: "Catalogue statique Maxi Trouvaille",
        checkedAt: "2026-06-09",
        checks: [
          "Produit partenaire statique repere par audit toutes sources",
          "Publication bloquee tant que fournisseur exact, SKU, images, prix et delai ne sont pas prouves",
        ],
        note: "HOLD jusqu'a validation fournisseur exact, SKU, droits images, prix reel et delai France/Europe.",
      },
    },
    source: "internal",
    status: "draft",
  },
  {
    id: "prod_partner_car_vacuum_001",
    slug: "mini-aspirateur-voiture-sans-fil",
    name: "Mini aspirateur voiture sans fil",
    categoryId: "dropshipping-auto-moto",
    price: 3990,
    compareAtPrice: 4990,
    condition: "Neuf - selection partenaire",
    stock: 15,
    badge: "Auto",
    image: "/uploads/partner-products/aspirateur-voiture-sans-fil.webp",
    images: ["/uploads/partner-products/aspirateur-voiture-sans-fil.webp"],
    shortDescription:
      "Aspirateur rechargeable compact pour nettoyer rapidement voiture, miettes et poussières.",
    description:
      "Mini aspirateur sans fil pratique pour l'entretien rapide de la voiture, des sièges, tapis et petits espaces. Produit neuf vendu par Maxi Trouvaille avec prix fixe.",
    features: [
      "Prix Maxi Trouvaille fixe : 39,90 €",
      "Format démonstration avant/après facile",
      "Puissance, embouts fournis et delai client confirmes avant mise en vente",
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
      validationGate: {
        source: "Catalogue statique Maxi Trouvaille",
        checkedAt: "2026-06-09",
        checks: [
          "Produit partenaire statique repere par audit toutes sources",
          "Publication bloquee tant que fournisseur exact, SKU, images, prix et delai ne sont pas prouves",
        ],
        note: "HOLD jusqu'a validation fournisseur exact, SKU, droits images, prix reel et delai France/Europe.",
      },
    },
    source: "internal",
    status: "draft",
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
    status: "draft",
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

function hasHoldOrManualCheckSignal(value: unknown) {
  const normalized = normalizeCatalogText(String(value ?? ""));

  return [
    "hold",
    "a verifier",
    "verifier avant",
    "a confirmer",
    "confirmer avant",
    "obligatoire",
    "manquant",
    "missing",
    "avant publication",
    "avant vente",
  ].some((signal) => normalized.includes(signal));
}

function hasPositiveCents(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasExactSupplierUrl(value: unknown) {
  const normalized = normalizeCatalogText(String(value ?? ""));

  if (!normalized) {
    return false;
  }

  return !(
    normalized.includes("wholesale?") ||
    normalized.includes("searchtext=") ||
    normalized.includes("/w/wholesale-")
  );
}

function hasReadyStatus(value: unknown) {
  const normalized = normalizeCatalogText(String(value ?? ""));
  const statusParts = normalized.split(/[^a-z0-9]+/).filter(Boolean);

  if (
    !normalized ||
    hasHoldOrManualCheckSignal(normalized) ||
    ["not", "non", "pas", "pending", "ko", "incomplete", "blocked", "refused", "invalid"].some(
      (status) => statusParts.includes(status),
    )
  ) {
    return false;
  }

  return ["ok", "ready", "verified", "validated", "valide"].some((status) =>
    statusParts.includes(status),
  );
}

function getProductImageCandidates(product: Product) {
  return Array.from(
    new Set(
      [product.image, ...(Array.isArray(product.images) ? product.images : [])]
        .map((image) => String(image ?? "").trim())
        .filter(Boolean),
    ),
  );
}

export function getPublicImageBlockers(product: Product) {
  const blockers: string[] = [];
  const images = getProductImageCandidates(product);

  if (images.length === 0) {
    blockers.push("image_missing");
  }

  for (const image of images) {
    const normalized = image.toLowerCase();

    if (/^https?:\/\//i.test(image)) {
      blockers.push("image_remote_not_local");
    }

    if (/alicdn|aliexpress-media|ae-pic|aliexpress|temu/i.test(image)) {
      blockers.push("supplier_cdn_image");
    }

    if (/images\.unsplash\.com|unsplash/i.test(image)) {
      blockers.push("stock_visual_image");
    }

    if (nonExactProductImagePrefixes.some((prefix) => normalized.startsWith(prefix))) {
      blockers.push("image_not_exact_product_photo");
    }

    if (/placeholder|a-verifier|hold/i.test(image)) {
      blockers.push("placeholder_or_hold_image");
    }

    if (!exactProductImagePrefixes.some((prefix) => normalized.startsWith(prefix))) {
      blockers.push("image_not_in_exact_product_depot");
    }

    if (!/\.webp(?:\?.*)?$/i.test(image)) {
      blockers.push("image_not_webp");
    }
  }

  return Array.from(new Set(blockers));
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

export function getDropshippingPublicBlockers(product: Product) {
  const blockers: string[] = [];
  const dropshipping = product.dropshipping;

  if (!dropshipping?.enabled) {
    blockers.push("dropshipping_disabled");
    return blockers;
  }

  if (!hasExactSupplierUrl(dropshipping.supplierUrl)) {
    blockers.push("supplier_url_exact_missing");
  }

  if (!dropshipping.supplierSku) {
    blockers.push("supplier_sku_missing");
  }

  if (!hasPositiveCents(dropshipping.supplierPriceCents)) {
    blockers.push("supplier_price_missing");
  }

  if (!hasPositiveCents(dropshipping.salePriceCents)) {
    blockers.push("sale_price_missing");
  }

  if (!hasPositiveCents(dropshipping.marginCents)) {
    blockers.push("margin_missing");
  }

  if (!(typeof dropshipping.supplierStock === "number" && dropshipping.supplierStock > 0)) {
    blockers.push("supplier_stock_missing");
  }

  if (
    !dropshipping.deliveryEstimate ||
    hasHoldOrManualCheckSignal(dropshipping.deliveryEstimate)
  ) {
    blockers.push("delivery_estimate_not_ready");
  }

  if (product.imageValidation?.status !== "verified_source_images") {
    blockers.push("exact_images_not_verified");
  }

  blockers.push(...getPublicImageBlockers(product));

  if (!product.sourceVerification?.rightsStatus || !hasReadyStatus(product.sourceVerification.rightsStatus)) {
    blockers.push("image_rights_not_ready");
  }

  if (!product.sourceVerification?.priceStatus || !hasReadyStatus(product.sourceVerification.priceStatus)) {
    blockers.push("source_price_not_ready");
  }

  if (
    !product.sourceVerification?.deliveryStatus ||
    !hasReadyStatus(product.sourceVerification.deliveryStatus)
  ) {
    blockers.push("source_delivery_not_ready");
  }

  const validationGateChecks = Array.isArray(dropshipping.validationGate?.checks)
    ? dropshipping.validationGate.checks
    : [];

  if (!dropshipping.validationGate || (!dropshipping.validationGate.note && validationGateChecks.length === 0)) {
    blockers.push("validation_gate_missing");
  }

  if (
    hasHoldOrManualCheckSignal(dropshipping.validationGate?.note) ||
    hasHoldOrManualCheckSignal(validationGateChecks.join(" "))
  ) {
    blockers.push("validation_gate_not_ready");
  }

  if (hasHoldOrManualCheckSignal(product.internalSourcing?.validationStatus)) {
    blockers.push("internal_sourcing_hold");
  }

  if (isComingSoonProduct(product)) {
    blockers.push("coming_soon");
  }

  return Array.from(new Set(blockers));
}

export function isDropshippingProductReadyForPublic(product: Product) {
  return getDropshippingPublicBlockers(product).length === 0;
}

export function isDropshippingCategory(category: Category) {
  return (
    dropshippingFocusCategoryIdSet.has(category.id) ||
    category.id === "dropshipping" ||
    category.parentId === "dropshipping"
  );
}

export function isPublicCategory(category: Category) {
  if (publicStoreMode === "dropshipping") {
    return isDropshippingCategory(category);
  }

  return !hiddenPublicCategoryIds.has(category.id);
}

export function isPublicProduct(product: Product) {
  const category = getCategoryById(product.categoryId);
  const basePublic =
    (product.status ?? "published") === "published" &&
    !product.isTestProduct &&
    (!category || isPublicCategory(category));

  if (!basePublic) {
    return false;
  }

  if (publicStoreMode === "dropshipping") {
    return isDropshippingProductReadyForPublic(product);
  }

  return true;
}

export function isPromotionProduct(product: Product) {
  return Boolean(product.dropshipping?.isPromotion || product.compareAtPrice);
}

export function isNewProduct(product: Product) {
  return Boolean(product.dropshipping?.isNew);
}

export function isProductPurchasable(product: Product) {
  return (
    isPublicProduct(product) &&
    product.stock > 0 &&
    !isComingSoonProduct(product)
  );
}

export function getPublicDeliveryEstimate(product: Product) {
  if (isComingSoonProduct(product)) {
    return "Bientôt disponible sur Maxi Trouvaille";
  }

  if (product.dropshipping?.deliveryEstimate) {
    return product.dropshipping.deliveryEstimate;
  }

  return "Livraison estimée au panier";
}

export function getProductSeoTitle(product: Product) {
  const rawTitle = product.seo?.title || product.name;
  // Le layout ajoute deja "| Maxi Trouvaille" : on retire le suffixe
  // pour eviter un titre duplique du type "... | Maxi Trouvaille | Maxi Trouvaille".
  return rawTitle.replace(/\s*[|–-]\s*Maxi Trouvailles?\s*$/i, "").trim();
}

export function getProductSeoDescription(product: Product) {
  return product.seo?.description || product.shortDescription;
}

export function getProductImageAlt(product: Product, fallbackSuffix?: string) {
  const baseAlt = product.imageAlt || product.seo?.imageAlt || product.name;
  return fallbackSuffix ? `${baseAlt} ${fallbackSuffix}` : baseAlt;
}

export function getProductBadges(product: Product): ProductBadge[] {
  if (isComingSoonProduct(product)) {
    return [{ label: "À venir", tone: "coming-soon" }];
  }

  const badges: ProductBadge[] = [];

  if (isDropshippingProduct(product)) {
    badges.push({ label: "Partenaire", tone: "dropshipping" });
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
  return !isPublicCategory(category);
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

export function getCategoryProductFamilyIds(categoryId: string): string[] {
  return Array.from(
    new Set([...getCategoryFamilyIds(categoryId), ...(partnerCategoryMirrors[categoryId] ?? [])]),
  );
}

// Nombre reel de produits par rayon, pour l'afficher sur les vignettes.
// Volontairement calcule avec EXACTEMENT le meme regroupement que la page d'un
// rayon (getPublicCatalogProductsByCategory) : le chiffre annonce sur la tuile
// est donc toujours celui que le client comptera en ouvrant le rayon.
// La liste de produits doit deja etre filtree (produits publics) par l'appelant.
export function countProductsByCategory(
  productList: Product[],
  categoryIds: readonly string[],
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const categoryId of categoryIds) {
    const familyIds = new Set(getCategoryProductFamilyIds(categoryId));
    counts[categoryId] = productList.filter((product) =>
      familyIds.has(product.categoryId),
    ).length;
  }

  return counts;
}

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getProductById(id: string) {
  return products.find((product) => product.id === id);
}

export function getProductsByCategory(categoryId: string) {
  const categoryIds = new Set(getCategoryProductFamilyIds(categoryId));
  return products.filter((product) => categoryIds.has(product.categoryId));
}

export function getFeaturedProducts() {
  return products
    .filter((product) => isPublicProduct(product) && !isComingSoonProduct(product))
    .slice(0, 3);
}

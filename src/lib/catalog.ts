import type { ProductSource, SellerListingMeta } from "@/lib/marketplace";

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  accent: string;
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
  source: ProductSource;
  sellerListing?: SellerListingMeta;
};

export const mainCategoryIds = [
  "palettes-destockage",
  "colis-mysteres",
  "colis-au-poids",
  "lots-bonnes-affaires",
  "espace-revendeur",
] as const;

export const categories: Category[] = [
  {
    id: "palettes-destockage",
    slug: "palettes-destockage",
    name: "Palettes déstockage",
    description:
      "Palettes mystères, palettes visibles, arrivages réguliers, idéal pour revendeurs et marchés.",
    accent: "#b45309",
  },
  {
    id: "colis-mysteres",
    slug: "colis-mysteres",
    name: "Colis mystères",
    description:
      "Colis surprise, cartons mystères, contenu aléatoire issu de déstockage.",
    accent: "#be123c",
  },
  {
    id: "colis-au-poids",
    slug: "colis-au-poids",
    name: "Colis au poids",
    description:
      "Colis vendus au poids, 5 kg, 10 kg ou plus, pour découvrir plusieurs produits à prix réduit.",
    accent: "#0f766e",
  },
  {
    id: "lots-bonnes-affaires",
    slug: "lots-bonnes-affaires",
    name: "Lots & bonnes affaires",
    description:
      "Produits visibles à prix cassés : vêtements, chaussures, accessoires et trouvailles utiles.",
    accent: "#2563eb",
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
];

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

export function getCategoryById(id: string) {
  return categories.find((category) => category.id === id);
}

export function getCategoryBySlug(slug: string) {
  return categories.find((category) => category.slug === slug);
}

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getProductById(id: string) {
  return products.find((product) => product.id === id);
}

export function getProductsByCategory(categoryId: string) {
  return products.filter((product) => product.categoryId === categoryId);
}

export function getFeaturedProducts() {
  return products.slice(0, 3);
}

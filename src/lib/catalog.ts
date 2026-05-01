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

export const categories: Category[] = [
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

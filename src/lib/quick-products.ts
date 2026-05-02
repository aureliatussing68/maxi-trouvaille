import { categories, getCategoryById, products, type Product } from "@/lib/catalog";

export const QUICK_PRODUCTS_UPDATED_EVENT = "maxi-trouvaille-products-updated";

export type QuickProductInput = {
  title: string;
  description: string;
  price: string;
  categoryId: string;
  condition: "neuf" | "occasion";
  stock?: string | number;
  images?: string[];
  livraisonDisponible?: Product["livraisonDisponible"];
};

type DescriptionGenerationInput = {
  title: string;
  categoryId: string;
  condition: "neuf" | "occasion";
  stock?: string | number;
  price?: string;
  imageContext?: string;
};

export const defaultProductImage =
  "https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=900&q=80";

const keywordCategories: Array<{
  categoryId: string;
  priority: number;
  keywords: string[];
}> = [
  {
    categoryId: "palettes-destockage",
    priority: 130,
    keywords: [
      "palette",
      "palettes",
      "palette mystere",
      "palette destockage",
      "palette visible",
      "arrivage palette",
    ],
  },
  {
    categoryId: "colis-mysteres",
    priority: 125,
    keywords: [
      "colis mystere",
      "colis surprise",
      "carton mystere",
      "carton surprise",
      "lot mystere",
    ],
  },
  {
    categoryId: "colis-au-poids",
    priority: 120,
    keywords: ["colis au poids", "5 kg", "10 kg", "20 kg", "kilo", "kg"],
  },
  {
    categoryId: "lots-bonnes-affaires",
    priority: 100,
    keywords: [
      "lot",
      "lots",
      "bonne affaire",
      "prix casse",
      "destockage",
      "stock",
    ],
  },
  {
    categoryId: "espace-revendeur",
    priority: 115,
    keywords: [
      "revendeur",
      "grossiste",
      "marche",
      "professionnel",
      "prix degressif",
      "quantite",
    ],
  },
  {
    categoryId: "sport-loisirs",
    priority: 80,
    keywords: [
      "raquette",
      "tennis",
      "badminton",
      "ping-pong",
      "ballon",
      "sport",
      "velo",
      "trottinette",
      "fitness",
      "musculation",
      "peche",
      "camping",
    ],
  },
  {
    categoryId: "auto-moto",
    priority: 90,
    keywords: [
      "voiture",
      "auto",
      "moto",
      "phare",
      "feu",
      "stop",
      "verin",
      "essuie-glace",
      "retroviseur",
      "opel",
      "peugeot",
      "renault",
      "bmw",
      "mercedes",
    ],
  },
  {
    categoryId: "animaux",
    priority: 80,
    keywords: [
      "chien",
      "chat",
      "animal",
      "tapis educateur",
      "laisse",
      "collier",
      "gamelle",
      "cage",
      "aquarium",
    ],
  },
  {
    categoryId: "livre-media",
    priority: 80,
    keywords: [
      "livre",
      "roman",
      "dictionnaire",
      "bd",
      "manga",
      "dvd",
      "cd",
      "vinyle",
      "cassette",
      "vhs",
    ],
  },
  {
    categoryId: "jeux-video",
    priority: 100,
    keywords: [
      "playstation",
      "ps4",
      "ps5",
      "xbox",
      "nintendo",
      "switch",
      "jeu video",
      "manette",
      "console",
    ],
  },
  {
    categoryId: "puericulture",
    priority: 90,
    keywords: [
      "bebe",
      "enfant",
      "poussette",
      "rehausseur",
      "siege auto",
      "biberon",
      "jouet bebe",
    ],
  },
  {
    categoryId: "cuisine",
    priority: 85,
    keywords: [
      "casserole",
      "poele",
      "assiette",
      "verre",
      "mug",
      "tasse",
      "cuisine",
      "couteau",
      "robot",
      "mixeur",
    ],
  },
  {
    categoryId: "outillage",
    priority: 100,
    keywords: [
      "perceuse",
      "visseuse",
      "makita",
      "bosch",
      "outil",
      "scie",
      "ponceuse",
      "bricolage",
      "batterie",
    ],
  },
  {
    categoryId: "jardin",
    priority: 80,
    keywords: [
      "jardin",
      "plante",
      "pot",
      "arrosage",
      "tuyau",
      "tondeuse",
      "exterieur",
    ],
  },
  {
    categoryId: "beaute-sante",
    priority: 85,
    keywords: [
      "beaute",
      "sante",
      "soin",
      "maquillage",
      "parfum",
      "cheveux",
      "brosse",
      "miroir",
    ],
  },
  {
    categoryId: "informatique",
    priority: 95,
    keywords: [
      "pc",
      "ordinateur",
      "ecran",
      "clavier",
      "souris",
      "imprimante",
      "cable usb",
      "disque dur",
      "ssd",
      "ram",
    ],
  },
  {
    categoryId: "telephonie",
    priority: 100,
    keywords: [
      "telephone",
      "smartphone",
      "iphone",
      "samsung",
      "coque",
      "chargeur",
      "ecouteurs",
    ],
  },
  {
    categoryId: "mannequins-bustes",
    priority: 110,
    keywords: ["mannequin", "tete", "buste"],
  },
  {
    categoryId: "agencement-magasin",
    priority: 105,
    keywords: [
      "presentoir",
      "portant",
      "vitrine",
      "rayon",
      "gondole",
      "magasin",
      "commerce",
      "agencement",
    ],
  },
  {
    categoryId: "presentoirs",
    priority: 95,
    keywords: ["support comptoir", "display", "presentoir de comptoir"],
  },
  {
    categoryId: "mobilier-professionnel",
    priority: 85,
    keywords: ["bureau", "comptoir", "caisse", "mobilier professionnel"],
  },
  {
    categoryId: "vetements",
    priority: 70,
    keywords: ["veste", "pull", "robe", "pantalon", "jean", "chaussure", "tshirt", "shirt", "manteau"],
  },
  {
    categoryId: "high-tech",
    priority: 45,
    keywords: ["tablette", "cable", "casque", "ecouteur", "connecte"],
  },
  {
    categoryId: "maison",
    priority: 45,
    keywords: ["salon", "rangement", "aspirateur", "machine", "meuble", "vaisselle"],
  },
  {
    categoryId: "deco",
    priority: 60,
    keywords: ["lampe", "cadre", "miroir", "deco", "decoration", "vase", "bougie"],
  },
  {
    categoryId: "jouets",
    priority: 50,
    keywords: ["jouet", "lego", "puzzle", "peluche"],
  },
  {
    categoryId: "electricite",
    priority: 95,
    keywords: ["interrupteur", "prise", "electricite", "disjoncteur", "ampoule", "led", "eclairage"],
  },
  {
    categoryId: "accessoires",
    priority: 40,
    keywords: ["sac", "montre", "lunettes", "bijou", "ceinture", "portefeuille"],
  },
  {
    categoryId: "gadgets",
    priority: 20,
    keywords: ["gadget", "support", "mini", "accessoire", "portable"],
  },
];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function detectPrice(text: string) {
  const normalized = text.replace(/\s/g, " ");
  const match =
    normalized.match(/(\d{1,5}(?:[,.]\d{1,2})?)\s*(?:€|eur|euros)/i) ??
    normalized.match(/(?:€|eur|euros)\s*(\d{1,5}(?:[,.]\d{1,2})?)/i);

  if (!match?.[1]) {
    return "";
  }

  return match[1].replace(",", ".");
}

export function parsePriceToCents(value: string) {
  const detected = detectPrice(value) || value;
  const normalized = detected.replace(/[^\d,.]/g, "").replace(",", ".");
  const amount = Number.parseFloat(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    return 0;
  }

  return Math.round(amount * 100);
}

function getCategoryTone(categoryId: string) {
  const tones: Record<string, { usage: string; benefit: string }> = {
    "palettes-destockage": {
      usage:
        "ideal pour les arrivages en volume, les marchés, la revente ou les bonnes affaires en quantité",
      benefit: "un format pensé pour acheter plus et mieux valoriser un stock",
    },
    "colis-mysteres": {
      usage:
        "adapte aux colis surprise et aux cartons mystères avec contenu aléatoire selon arrivage",
      benefit: "une expérience de déstockage simple, attractive et pleine de découverte",
    },
    "colis-au-poids": {
      usage:
        "pratique pour découvrir plusieurs produits dans un format vendu au poids",
      benefit: "un bon moyen de tester des trouvailles variées à prix réduit",
    },
    "lots-bonnes-affaires": {
      usage:
        "pensé pour regrouper des produits visibles ou semi-visibles à prix cassés",
      benefit: "une sélection utile pour faire de bonnes affaires rapidement",
    },
    "espace-revendeur": {
      usage:
        "prévu pour les professionnels, marchés et revendeurs qui cherchent du volume",
      benefit: "un accès simple aux lots et palettes en quantité",
    },
    "agencement-magasin": {
      usage: "ideal pour l'equipement d'un commerce, d'une vitrine ou d'un espace de vente",
      benefit: "pratique pour presenter les produits proprement",
    },
    "mannequins-bustes": {
      usage: "parfait pour vitrine, presentation textile, photo produit ou decoration",
      benefit: "met facilement les articles en valeur",
    },
    "auto-moto": {
      usage: "utile pour remplacer, completer ou garder une piece d'avance",
      benefit: "une solution simple pour depanner ou equiper un vehicule",
    },
    outillage: {
      usage: "adapte aux travaux, au bricolage et aux petits chantiers",
      benefit: "un produit pratique a garder sous la main",
    },
    "jeux-video": {
      usage: "pret pour le jeu, le loisir ou pour completer un setup gaming",
      benefit: "une bonne trouvaille pour se faire plaisir ou offrir",
    },
    telephonie: {
      usage: "utile au quotidien pour proteger, charger ou completer un telephone",
      benefit: "un accessoire simple et pratique",
    },
    informatique: {
      usage: "ideal pour un poste de travail, un setup maison ou du materiel d'appoint",
      benefit: "pratique pour s'equiper a petit prix",
    },
    cuisine: {
      usage: "utile pour la cuisine du quotidien, la table ou la preparation",
      benefit: "un article simple a reutiliser facilement",
    },
    "sport-loisirs": {
      usage: "adapte aux loisirs, au sport ou aux sorties",
      benefit: "une bonne occasion pour s'equiper sans se ruiner",
    },
  };

  return (
    tones[categoryId] ?? {
      usage: "utile au quotidien ou pour completer un equipement existant",
      benefit: "une trouvaille pratique a prix malin",
    }
  );
}

export function generateCommerceDescription(input: DescriptionGenerationInput) {
  const title = input.title.trim() || "Produit";
  const category = getCategoryById(input.categoryId);
  const conditionLabel = input.condition === "neuf" ? "neuf" : "d'occasion";
  const stock = Math.max(0, Math.trunc(Number(input.stock ?? 1)) || 0);
  const tone = getCategoryTone(input.categoryId);
  const priceText = input.price?.trim() ? ` Prix indique : ${input.price.trim()}.` : "";
  const imageText = input.imageContext ? ` ${input.imageContext}` : "";

  return [
    `${title} ${conditionLabel}, selectionne pour Maxi Trouvaille. Ce produit est ${tone.usage}.${priceText}${imageText}`,
    "",
    "Points forts :",
    `- ${tone.benefit}`,
    `- Etat : ${conditionLabel}`,
    `- Categorie : ${category?.name ?? "Colis surprise"}`,
    `- Quantite disponible : ${stock}`,
    "",
    "Phrase de vente :",
    "Une bonne affaire simple, utile et prete a rejoindre votre panier.",
  ].join("\n");
}

export function detectCategoryId(text: string) {
  const normalized = normalizeText(text);
  const detected = keywordCategories
    .map((item) => {
      const matchedKeywords = item.keywords.filter((keyword) =>
        normalized.includes(normalizeText(keyword)),
      );

      return {
        categoryId: item.categoryId,
        score: matchedKeywords.reduce(
          (total, keyword) => total + item.priority + normalizeText(keyword).length,
          0,
        ),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  return detected?.categoryId ?? "colis-surprise";
}

function slugify(value: string) {
  const slug = normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 72);

  return slug || "produit";
}

export function createQuickProduct(input: QuickProductInput): Product {
  const now = Date.now();
  const id = `quick_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const cleanTitle = input.title.trim() || "Produit sans titre";
  const cleanDescription = input.description.trim() || "Produit ajoute rapidement.";
  const categoryId = getCategoryById(input.categoryId)
    ? input.categoryId
    : detectCategoryId(`${cleanTitle} ${cleanDescription}`);
  const price = parsePriceToCents(input.price);
  const stock = Math.max(0, Math.trunc(Number(input.stock ?? 1)) || 0);
  const conditionLabel = input.condition === "neuf" ? "Neuf" : "Occasion";
  const category = getCategoryById(categoryId);
  const images = (input.images ?? [])
    .filter((image): image is string => typeof image === "string" && image.length > 0)
    .slice(0, 10);
  const mainImage = images[0] ?? defaultProductImage;

  return {
    id,
    slug: `${slugify(cleanTitle)}-${now.toString(36)}`,
    name: cleanTitle,
    categoryId,
    price,
    condition: conditionLabel,
    stock,
    badge: stock > 0 ? "Ajout rapide" : "Rupture",
    image: mainImage,
    images: images.length > 0 ? images : [mainImage],
    shortDescription: cleanDescription.slice(0, 150),
    description: cleanDescription,
    features: [
      "Produit ajoute depuis l'import rapide admin",
      `Etat : ${conditionLabel}`,
      `Quantite disponible : ${stock}`,
      `Categorie : ${category?.name ?? "Categorie a verifier"}`,
    ],
    source: "internal",
    status: "published",
    livraisonDisponible: input.livraisonDisponible ?? "toutes",
  };
}

export function mergeProducts(quickProducts: Product[]) {
  const ids = new Set(products.map((product) => product.id));
  return [...products, ...quickProducts.filter((product) => !ids.has(product.id))];
}

export function sanitizeQuickProducts(input: unknown): Product[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((product): Product[] => {
    if (!product || typeof product !== "object") {
      return [];
    }

    const maybeProduct = product as Partial<Product>;
    const isValid =
      typeof maybeProduct.id === "string" &&
      typeof maybeProduct.slug === "string" &&
      typeof maybeProduct.name === "string" &&
      typeof maybeProduct.categoryId === "string" &&
      typeof maybeProduct.price === "number" &&
      categories.some((category) => category.id === maybeProduct.categoryId);

    if (!isValid) {
      return [];
    }

    const images = Array.isArray(maybeProduct.images)
      ? maybeProduct.images
          .filter((image): image is string => typeof image === "string")
          .slice(0, 10)
      : [];

    return [
      {
        ...maybeProduct,
        stock: Math.max(0, Math.trunc(Number(maybeProduct.stock ?? 0)) || 0),
        image: maybeProduct.image ?? images[0] ?? defaultProductImage,
        images:
          images.length > 0
            ? images
            : [maybeProduct.image ?? defaultProductImage],
        source: maybeProduct.source ?? "internal",
        status:
          maybeProduct.status === "draft" || maybeProduct.status === "archived"
            ? maybeProduct.status
            : "published",
        livraisonDisponible:
          maybeProduct.livraisonDisponible === "remise uniquement" ||
          maybeProduct.livraisonDisponible === "mondial relay uniquement" ||
          maybeProduct.livraisonDisponible === "colissimo uniquement" ||
          maybeProduct.livraisonDisponible === "sur devis"
            ? maybeProduct.livraisonDisponible
            : "toutes",
        features: Array.isArray(maybeProduct.features) ? maybeProduct.features : [],
      } as Product,
    ];
  });
}

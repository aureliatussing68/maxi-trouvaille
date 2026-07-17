import type {
  Product,
  ProductBadge,
  ProductBadgeTone,
} from "@/lib/catalog";

export type { Product, ProductBadgeTone };

const categoryNamesById: Record<string, string> = {
  dropshipping: "Produits partenaires",
  "dropshipping-nouveautes": "Nouveautés",
  "dropshipping-promotions": "Promotions",
  "dropshipping-maison": "Maison",
  "dropshipping-cuisine": "Cuisine",
  "dropshipping-beaute": "Beauté",
  "dropshipping-high-tech": "High-tech",
  "dropshipping-accessoires": "Accessoires",
  "dropshipping-auto-moto": "Auto / Moto",
  "dropshipping-animaux": "Animaux",
  "dropshipping-enfant": "Enfant",
  "dropshipping-mode": "Mode",
  "produits-partenaires": "Produits partenaires",
};

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

export function getClientCategoryNameById(categoryId: string) {
  return categoryNamesById[categoryId];
}

export function isClientComingSoonProduct(product: Product) {
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

export function isClientDropshippingProduct(product: Product) {
  return Boolean(product.dropshipping?.enabled);
}

export function isClientPromotionProduct(product: Product) {
  return Boolean(product.dropshipping?.isPromotion || product.compareAtPrice);
}

export function isClientNewProduct(product: Product) {
  return Boolean(product.dropshipping?.isNew);
}

export function isClientProductPurchasable(product: Product) {
  return (
    (product.status ?? "published") === "published" &&
    !product.isTestProduct &&
    product.stock > 0 &&
    !isClientComingSoonProduct(product)
  );
}

export function getClientPublicDeliveryEstimate(product: Product) {
  if (isClientComingSoonProduct(product)) {
    return "Bientot disponible sur Maxi Trouvaille";
  }

  if (product.dropshipping?.deliveryEstimate) {
    return product.dropshipping.deliveryEstimate;
  }

  return "Livraison estimee au panier";
}

export function getClientProductImageAlt(product: Product, fallbackSuffix?: string) {
  const baseAlt = product.imageAlt || product.seo?.imageAlt || product.name;
  return fallbackSuffix ? `${baseAlt} ${fallbackSuffix}` : baseAlt;
}

export function getClientProductBadges(product: Product): ProductBadge[] {
  if (isClientComingSoonProduct(product)) {
    return [{ label: "À venir", tone: "coming-soon" }];
  }

  const badges: ProductBadge[] = [];

  if (isClientDropshippingProduct(product)) {
    badges.push({ label: "Partenaire", tone: "dropshipping" });
  }

  if (isClientNewProduct(product)) {
    badges.push({ label: "Nouveauté", tone: "new" });
  }

  if (isClientPromotionProduct(product)) {
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

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

const dropshippingFocusCategoryIdSet = new Set([
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
]);

const exactProductImagePrefixes = [
  "/uploads/partner-products/",
  "/uploads/quick-products/",
] as const;

const nonExactProductImagePrefixes = [
  "/uploads/category-images/",
  "/uploads/generated-products/",
] as const;

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

function getClientProductImageCandidates(product: Product) {
  return Array.from(
    new Set(
      [product.image, ...(Array.isArray(product.images) ? product.images : [])]
        .map((image) => String(image ?? "").trim())
        .filter(Boolean),
    ),
  );
}

export function getClientPublicImageBlockers(product: Product) {
  const blockers: string[] = [];
  const images = getClientProductImageCandidates(product);

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

export function getClientDropshippingPublicBlockers(product: Product) {
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

  blockers.push(...getClientPublicImageBlockers(product));

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

  if (isClientComingSoonProduct(product)) {
    blockers.push("coming_soon");
  }

  return Array.from(new Set(blockers));
}

export function isClientDropshippingProductReadyForPublic(product: Product) {
  return getClientDropshippingPublicBlockers(product).length === 0;
}

export function isClientPublicProduct(product: Product) {
  const basePublic =
    (product.status ?? "published") === "published" &&
    !product.isTestProduct &&
    dropshippingFocusCategoryIdSet.has(product.categoryId);

  if (!basePublic) {
    return false;
  }

  return isClientDropshippingProductReadyForPublic(product);
}

export function isClientProductPurchasable(product: Product) {
  return (
    isClientPublicProduct(product) &&
    product.stock > 0 &&
    !isClientComingSoonProduct(product)
  );
}

export function getClientPublicDeliveryEstimate(product: Product) {
  if (isClientComingSoonProduct(product)) {
    return "Bientôt disponible sur Maxi Trouvaille";
  }

  if (product.dropshipping?.deliveryEstimate) {
    return product.dropshipping.deliveryEstimate;
  }

  return "Livraison estimée au panier";
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

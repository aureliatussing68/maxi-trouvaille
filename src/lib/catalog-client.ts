import type { ProductBadge, ProductBadgeTone } from "@/lib/catalog";
import type { PublicProduct } from "@/lib/public-product";

/**
 * Helpers utilisables dans un composant "use client".
 *
 * IMPORTANT — ce que "Product" veut dire ICI :
 *
 * Cote navigateur, un produit n'est PAS la fiche complete du catalogue : c'est
 * sa version publique (voir src/lib/public-product.ts), amputee de tout le
 * dossier de sourcing (prix d'achat, marge, lien et reference fournisseur,
 * notes de validation interne). Le type est donc volontairement alias sur
 * PublicProduct : si un composant client tente de lire un champ sensible,
 * TypeScript refuse de compiler. C'est le garde-fou principal contre le retour
 * de la fuite.
 *
 * Ce fichier ne doit contenir QUE des imports de type : rien de @/lib/catalog
 * ne doit se retrouver dans le paquet JavaScript envoye au navigateur.
 */
export type Product = PublicProduct;
export type { PublicProduct };
export type { ProductBadgeTone };

/**
 * Meme regle que dans src/lib/catalog.ts et src/lib/product-display.ts, qui la
 * documente en detail. Recopiee ici pour la meme raison : ces fichiers sont
 * charges tels quels par les scripts d'audit du depot, avec node, qui ne sait
 * pas resoudre les alias "@/...". Les trois valeurs doivent rester identiques.
 */
const REFERENCE_PRICE_MIN_DISCOUNT = 30;

function getRealDiscountPercent(product: Product) {
  const compareAtPrice = product.compareAtPrice;

  if (
    typeof compareAtPrice !== "number" ||
    !Number.isFinite(compareAtPrice) ||
    compareAtPrice <= product.price
  ) {
    return 0;
  }

  return Math.round(((compareAtPrice - product.price) / compareAtPrice) * 100);
}

/**
 * Interrupteur general du prix barre. Voir product-display.ts, qui documente
 * en detail pourquoi il est a false : sans historique de prix reel, un prix
 * barre est une annonce de reduction irreguliere (article L112-1-1 du code de
 * la consommation). Les trois copies doivent rester egales.
 */
const HISTORIQUE_PRIX_VERIFIE = false;

function shouldShowReferencePrice(product: Product) {
  if (!HISTORIQUE_PRIX_VERIFIE) {
    return false;
  }

  return getRealDiscountPercent(product) >= REFERENCE_PRICE_MIN_DISCOUNT;
}

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
  "dropshipping-outillage": "Outillage & Bricolage",
  "dropshipping-gaming": "Gaming & PC",
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

/** Meme regle que cote serveur : seules les vraies remises comptent. */
export function isClientPromotionProduct(product: Product) {
  return shouldShowReferencePrice(product);
}

export function isClientNewProduct(product: Product) {
  return Boolean(product.dropshipping?.isNew);
}

/**
 * Verdict de publication.
 *
 * Avant, cette fonction REJOUAIT dans le navigateur toute la porte de
 * publication : elle exigeait supplierUrl, supplierSku, supplierPriceCents,
 * marginCents, supplierStock, validationGate, sourceVerification,
 * imageValidation... C'etait la raison technique pour laquelle tout le dossier
 * de sourcing partait au navigateur, et donc la cause de la fuite.
 *
 * Le serveur rend deja ce verdict (isServerPublicProduct dans catalog-server.ts,
 * qui verifie en plus l'existence reelle des fichiers photo). On se contente
 * desormais de transmettre son resultat. Aucun controle n'est perdu : celui du
 * serveur est strictement plus complet que celui qui etait refait ici.
 */
export function isClientPublicProduct(product: Product) {
  return product.isPublic;
}

export function isClientProductPurchasable(product: Product) {
  return product.isPurchasable;
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

export function getClientProductImageAlt(
  product: Product,
  fallbackSuffix?: string,
) {
  const baseAlt = product.imageAlt || product.seo?.imageAlt || product.name;
  return fallbackSuffix ? `${baseAlt} ${fallbackSuffix}` : baseAlt;
}

/** Meme regle que cote serveur : une pastille au maximum, et jamais pour rien. */
export function getClientProductBadges(product: Product): ProductBadge[] {
  if (isClientComingSoonProduct(product)) {
    return [{ label: "À venir", tone: "coming-soon" }];
  }

  if (product.stock <= 0) {
    return [{ label: "Rupture de stock", tone: "stock" }];
  }

  const discountPercent = getRealDiscountPercent(product);

  if (
    HISTORIQUE_PRIX_VERIFIE &&
    discountPercent >= REFERENCE_PRICE_MIN_DISCOUNT
  ) {
    return [{ label: `-${discountPercent} %`, tone: "promotion" }];
  }

  return [];
}

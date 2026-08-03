import type { Product } from "@/lib/catalog";
import { getPublicDescription, getPublicFeatures } from "@/lib/product-display";

/**
 * LISTE BLANCHE DE SORTIE — le seul objet produit autorise a franchir la
 * frontiere serveur -> navigateur.
 *
 * Pourquoi ce fichier existe :
 *
 * Le catalogue interne (data/quick-products.json) porte, dans la MEME fiche que
 * le nom et le prix de vente, tout le dossier de sourcing : prix d'achat reel
 * (dropshipping.supplierPriceCents), marge (marginCents), reference et lien
 * fournisseur (supplierSku / supplierUrl), stock fournisseur, regle de calcul
 * des prix (internalSourcing.pricingRule), notes de validation interne
 * (validationGate / sourceVerification / imageValidation).
 *
 * Or les pages publiques passaient l'objet Product ENTIER a des composants
 * "use client". Next.js serialise alors tout l'objet dans la charge utile RSC
 * de la page (les balises <script>self.__next_f.push(...)</script>) : les
 * champs n'etaient pas AFFICHES, mais ils etaient LISIBLES dans le code source
 * de la page par n'importe quel visiteur. Un client pouvait y lire le prix
 * d'achat de l'article qu'il s'apprete a payer ; un concurrent pouvait y
 * recopier tout le catalogue avec ses sources.
 *
 * Regle retenue : LISTE BLANCHE, jamais liste noire. On enumere ici ce qui SORT.
 * Un champ ajoute demain au fichier de catalogue ne partira donc pas tout seul
 * au navigateur : il faudra venir l'ajouter ici, en connaissance de cause.
 *
 * Ne JAMAIS remplacer la construction champ par champ ci-dessous par un
 * `{ ...product }` : ce serait revenir exactement au probleme d'origine.
 *
 * L'administration n'est pas concernee : elle lit le catalogue par
 * readQuickProducts() / getAllProducts() / getCatalogProductBySlug(), qui
 * rendent toujours la fiche complete. Seule la SORTIE PUBLIQUE est filtree.
 */

/**
 * Bloc "dropshipping" reduit a ce qui sert reellement a l'affichage :
 * - enabled : distingue un produit partenaire (tri et filtres de la boutique) ;
 * - isNew / isPromotion : alimentent /nouveautes et /promotions ;
 * - deliveryEstimate : le delai annonce au client, affiche au panier ;
 * - logisticsPartnerLabel : libelle neutre ("partenaire logistique").
 *
 * Tout le reste (supplierName, supplierUrl, supplierSku, supplierPriceCents,
 * salePriceCents, marginCents, supplierStock, syncStatus, lastSyncAt,
 * validationGate) reste cote serveur.
 */
export type PublicDropshippingMeta = {
  enabled: boolean;
  isNew?: boolean;
  isPromotion?: boolean;
  deliveryEstimate?: string;
  logisticsPartnerLabel?: string;
};

/**
 * Le produit tel que le navigateur a le droit de le connaitre.
 *
 * Les deux booleens isPublic / isPurchasable remplacent le calcul qui etait
 * refait cote client : avant, le navigateur rejouait toute la porte de
 * publication (isClientPublicProduct), ce qui l'obligeait a recevoir la matiere
 * premiere — donc precisement les champs sensibles. Le serveur a deja rendu ce
 * verdict, il suffit de transmettre le verdict.
 */
export type PublicProduct = {
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
  imageAlt?: string;
  shortDescription: string;
  description: string;
  features: string[];
  status?: "published" | "draft" | "archived";
  commerceStatus?: "available" | "coming-soon";
  livraisonDisponible?: Product["livraisonDisponible"];
  /** Uniquement le texte alternatif des photos : le reste du bloc SEO est interne. */
  seo?: { imageAlt?: string };
  dropshipping?: PublicDropshippingMeta;
  /** Verdict de publication, calcule cote serveur. */
  isPublic: boolean;
  /** Verdict d'achat (publie, en stock, pas "a venir"), calcule cote serveur. */
  isPurchasable: boolean;
};

export type PublicProductVerdict = {
  isPublic: boolean;
  isPurchasable: boolean;
};

/**
 * Liste blanche sous forme de donnee, pour que le script de controle
 * (scripts/automation/audit_public_payload_leaks.mjs) puisse verifier qu'elle
 * n'a pas ete elargie en douce.
 */
export const PUBLIC_PRODUCT_FIELDS = [
  "id",
  "slug",
  "name",
  "categoryId",
  "price",
  "compareAtPrice",
  "condition",
  "stock",
  "badge",
  "image",
  "images",
  "imageAlt",
  "shortDescription",
  "description",
  "features",
  "status",
  "commerceStatus",
  "livraisonDisponible",
  "seo",
  "dropshipping",
  "isPublic",
  "isPurchasable",
] as const;

export const PUBLIC_DROPSHIPPING_FIELDS = [
  "enabled",
  "isNew",
  "isPromotion",
  "deliveryEstimate",
  "logisticsPartnerLabel",
] as const;

function toPublicDropshipping(
  dropshipping: Product["dropshipping"],
): PublicDropshippingMeta | undefined {
  if (!dropshipping) {
    return undefined;
  }

  const publicDropshipping: PublicDropshippingMeta = {
    enabled: Boolean(dropshipping.enabled),
  };

  if (typeof dropshipping.isNew === "boolean") {
    publicDropshipping.isNew = dropshipping.isNew;
  }

  if (typeof dropshipping.isPromotion === "boolean") {
    publicDropshipping.isPromotion = dropshipping.isPromotion;
  }

  if (dropshipping.deliveryEstimate) {
    publicDropshipping.deliveryEstimate = dropshipping.deliveryEstimate;
  }

  if (dropshipping.logisticsPartnerLabel) {
    publicDropshipping.logisticsPartnerLabel = dropshipping.logisticsPartnerLabel;
  }

  return publicDropshipping;
}

/**
 * Construit la version publique d'une fiche produit.
 *
 * Les champs absents ne sont pas recopies a `undefined` : ils sont simplement
 * omis, ce qui allege d'autant la charge utile envoyee au navigateur.
 *
 * Les textes libres (description, accroche, points cles) passent par les
 * filtres d'affichage deja en place : le catalogue importe contient encore des
 * notes de coulisses du type "Marge cible 30-40% avant frais" ou "fournisseur a
 * verifier". Elles etaient deja retirees a l'AFFICHAGE, mais partaient quand
 * meme brutes dans la charge utile. Elles sont maintenant retirees a la SOURCE.
 */
export function toPublicProduct(
  product: Product,
  verdict: PublicProductVerdict,
): PublicProduct {
  const publicProduct: PublicProduct = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    categoryId: product.categoryId,
    price: product.price,
    condition: product.condition,
    stock: product.stock,
    badge: product.badge,
    image: product.image,
    shortDescription: getPublicDescription(product.shortDescription),
    description: getPublicDescription(product.description),
    features: [...getPublicFeatures(product.features)],
    isPublic: verdict.isPublic,
    isPurchasable: verdict.isPurchasable,
  };

  if (
    typeof product.compareAtPrice === "number" &&
    Number.isFinite(product.compareAtPrice)
  ) {
    publicProduct.compareAtPrice = product.compareAtPrice;
  }

  if (Array.isArray(product.images) && product.images.length > 0) {
    publicProduct.images = [...product.images];
  }

  if (product.imageAlt) {
    publicProduct.imageAlt = product.imageAlt;
  }

  if (product.status) {
    publicProduct.status = product.status;
  }

  if (product.commerceStatus) {
    publicProduct.commerceStatus = product.commerceStatus;
  }

  if (product.livraisonDisponible) {
    publicProduct.livraisonDisponible = product.livraisonDisponible;
  }

  if (product.seo?.imageAlt) {
    publicProduct.seo = { imageAlt: product.seo.imageAlt };
  }

  const publicDropshipping = toPublicDropshipping(product.dropshipping);

  if (publicDropshipping) {
    publicProduct.dropshipping = publicDropshipping;
  }

  return publicProduct;
}

/** Verdict d'achat deja calcule cote serveur : aucun recalcul cote navigateur. */
export function isPublicProductPurchasable(product: PublicProduct) {
  return product.isPurchasable;
}

import type { Product } from "@/lib/catalog";

/**
 * Regles d'AFFICHAGE des produits, partagees par toutes les surfaces
 * publiques (vitrine, boutique, fiche, panier).
 *
 * Ce fichier ne modifie jamais les donnees : il decide seulement ce qui est
 * montre au client. Le catalogue reste la propriete de la chaine d'import.
 */

/**
 * Suffixes commerciaux herites de l'import fournisseur qui trainent dans
 * certains noms de produit et s'affichent donc tels quels sur les cartes.
 *
 * "best-seller" est une revendication que la boutique ne peut pas tenir :
 * aucune vente n'a encore ete enregistree. "promo" est un reliquat d'import
 * qui n'apporte rien puisque le prix barre dit deja la meme chose.
 *
 * On les retire a l'affichage plutot que dans le fichier de donnees : les URL
 * publiques restent valides, aucun lien ne casse, et la correction s'applique
 * partout d'un coup.
 */
const IMPORTED_NAME_SUFFIX =
  /[\s,;:–—-]+(best[\s-]?sellers?|promos?|pas\s+cher|nouveau)\s*$/i;

export function getDisplayProductName(product: Pick<Product, "name">) {
  const cleaned = product.name.replace(IMPORTED_NAME_SUFFIX, "").trim();
  return cleaned.length > 0 ? cleaned : product.name;
}

/**
 * Phrases qui ne doivent jamais atteindre un client, retirees a l'affichage.
 *
 * Deux familles, toutes deux heritees de l'import fournisseur :
 *
 * 1. Une preuve sociale que la boutique ne peut pas justifier — "Note 4.8 par
 *    plus de 2 300 acheteurs", "plebiscite par plus de 100 000 acheteurs".
 *    Aucune vente n'a encore ete enregistree et aucun avis n'est affiche nulle
 *    part : le client qui lit ca puis ne trouve pas un seul avis sent la
 *    copie. En France une note affichee doit en plus etre verifiable et son
 *    origine indiquee. Le jour ou de vrais avis arriveront, ils s'afficheront
 *    d'eux-memes, avec leurs etoiles et leur compte reel.
 *
 * 2. Du vocabulaire de coulisses reste dans quelques fiches — "facile a
 *    vendre", "bon candidat panier impulsif", "fournisseur", "marge". Ce sont
 *    des notes de selection, pas une description produit.
 *
 * On retire la PHRASE fautive, pas la fiche : le reste de la description est
 * conserve tel quel. On n'ajoute jamais rien.
 */
const UNSUPPORTED_CLAIM_PATTERNS = [
  /\bnot[eé]e?s?\s*:?\s*\d/i,
  /\d[.,]\d\s*\/\s*5/,
  /\bacheteu(?:r|se)s?\b/i,
  /\bpl[eé]biscit/i,
  /\bavis\b\s*(?:client|verifi|vérifi)/i,
  /\bmeilleures?\s+ventes?\b/i,
  /\bbest.?sellers?\b/i,
];

const INTERNAL_COPY_PATTERNS = [
  /panier\s+impulsif/i,
  /\b[aà]\s+vendre\b/i,
  /\bbundle\b/i,
  /\bcandidat\b/i,
  /\bmarge\b/i,
  /\bfournisseur\b/i,
  /\bdropshipping\b/i,
  /\bHOLD\b/,
  /fiche\s+candidate/i,
  /brouillon/i,
];

const REMOVABLE_SENTENCE_PATTERNS = [
  ...UNSUPPORTED_CLAIM_PATTERNS,
  ...INTERNAL_COPY_PATTERNS,
];

/**
 * Description prete a etre montree : les phrases invendables ci-dessus sont
 * retirees. Si tout devait sauter, on rend le texte d'origine plutot qu'un
 * vide — une fiche sans description serait pire.
 */
export function getPublicDescription(rawDescription: string | undefined) {
  const source = (rawDescription ?? "").trim();

  if (!source) {
    return "";
  }

  const kept = source
    .split(/(?<=[.;!?])\s+/)
    .filter(
      (sentence) =>
        !REMOVABLE_SENTENCE_PATTERNS.some((pattern) => pattern.test(sentence)),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/[\s,;]+$/, "")
    .trim();

  return kept.length >= 30 ? kept : source;
}

/**
 * Points cles prets a etre montres : meme filtre que la description.
 * Une puce "Note 4,9/5 par les acheteurs" ou "Produit facile a vendre" n'a
 * rien a faire dans les arguments montres au client.
 */
export function getPublicFeatures(features: readonly string[] | undefined) {
  const source = features ?? [];
  const kept = source.filter(
    (feature) =>
      !REMOVABLE_SENTENCE_PATTERNS.some((pattern) => pattern.test(feature)),
  );

  return kept.length > 0 ? kept : source;
}

/**
 * Accents manquants sur les mentions de delai.
 *
 * Une partie des fiches importees porte "Livraison suivie 7 a 14 jours
 * ouvres" au lieu de "7 a 14 jours ouvres" correctement accentue. Le decalage
 * se voit a l'oeil nu sur la fiche, juste sous un titre lui bien accentue —
 * et en francais c'est LE signal "traduit a la machine".
 *
 * Correction ciblee sur des chaines entieres connues, jamais un remplacement
 * de mots au hasard : on sait exactement ce qu'on remplace et par quoi.
 */
const DELIVERY_LABEL_FIXES = new Map<string, string>([
  [
    "Livraison suivie 7 a 14 jours ouvres",
    "7 à 14 jours ouvrés, livraison suivie",
  ],
  [
    "Livraison suivie 3 a 7 jours ouvres",
    "3 à 7 jours ouvrés, livraison suivie",
  ],
]);

export function getDisplayDeliveryEstimate(estimate: string) {
  return DELIVERY_LABEL_FIXES.get(estimate.trim()) ?? estimate;
}

/**
 * Pourcentage de remise reel, calcule a partir du prix barre de la fiche.
 * Aucun chiffre invente : sans prix barre superieur au prix, pas de badge.
 */
export function getRealDiscountPercent(
  product: Pick<Product, "price" | "compareAtPrice">,
) {
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
 * Seuil a partir duquel un prix barre est reellement montre au client.
 *
 * Pourquoi un seuil : le catalogue importe porte un prix barre sur 100 % des
 * fiches, avec une remise comprise entre 12 % et 35 % (la plus frequente etant
 * -26 %). Une "promotion" sur absolument tout n'est plus une promotion : le
 * badge rouge devient du papier peint et le client cesse d'y croire. C'est
 * aussi le point le plus expose cote reglementation, un prix de reference
 * devant correspondre au prix le plus bas reellement pratique.
 *
 * A 30 %, la selection retombe autour d'un produit sur cinq : le badge
 * redevient une information, et il reste stable dans le temps pour un produit
 * donne (il ne clignote pas d'un jour a l'autre).
 */
export const REFERENCE_PRICE_MIN_DISCOUNT = 30;

/**
 * Vrai quand le prix barre et le badge de remise doivent etre affiches.
 * Sous le seuil, le produit garde simplement son prix, sans mise en scene.
 */
export function shouldShowReferencePrice(
  product: Pick<Product, "price" | "compareAtPrice">,
) {
  return getRealDiscountPercent(product) >= REFERENCE_PRICE_MIN_DISCOUNT;
}

/**
 * Mention de stock reellement utile au client.
 *
 * Le nombre exact ne sert a rien et se retourne contre la boutique : 220
 * fiches sur 285 portent la meme valeur (40), et lire "En stock : 40
 * disponibles" carte apres carte se voit immediatement comme une donnee de
 * remplissage. On ne garde donc que deux etats : disponible, ou vraiment
 * bientot epuise.
 */
export const LOW_STOCK_THRESHOLD = 5;

export function getStockLabel(product: Pick<Product, "stock">) {
  if (product.stock <= 0) {
    return { label: "Rupture de stock", tone: "out" as const };
  }

  if (product.stock <= LOW_STOCK_THRESHOLD) {
    return {
      label: `Plus que ${product.stock} en stock`,
      tone: "low" as const,
    };
  }

  return { label: "En stock", tone: "ok" as const };
}

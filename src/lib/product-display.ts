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

  // Ajoutes le 05/08/2026, apres verification sur le site EN LIGNE : ces
  // formules-la passaient bel et bien jusqu'au client. Sur la fiche publique
  // « Lampe velo USB rechargeable », un visiteur lisait « Tres bon signal de
  // ventes recentes » et « Produit ajoute en couche catalogue controlee ».
  //
  // « Marge cible 30-40% » etait deja intercepte par /\bmarge\b/. C'est en
  // cherchant pourquoi les deux autres passaient que le trou est apparu.
  // Lecon : un filtre se verifie sur la page publique, jamais sur sa liste de
  // motifs.
  //
  // « signal de ventes » est le plus genant des trois. Ce n'est pas seulement
  // du jargon de coulisses : c'est une allegation de succes commercial que la
  // boutique ne peut pas justifier, puisqu'aucune vente n'a encore ete
  // enregistree. Meme famille que les fausses notes plus haut — article L121-2
  // du code de la consommation.
  /signal\s+de\s+vente/i,
  /couche\s+catalogue/i,
  /potentiel\s+promo/i,
  /\bsourcing\b/i,
  /source\s+europe/i,
  /prix\s+d['’]achat/i,
  /taux\s+de\s+conversion/i,
  /panier\s+moyen/i,

  // Le pire de tous, trouve le 05/08/2026 et VU sur les pages publiques :
  // onze fiches pourtant publiees affichaient au client « Publication bloquee
  // tant que prix, delai, stock et droits images ne sont pas verifies ».
  //
  // C'est un aveu ecrit, par le vendeur lui-meme, qu'il vend un produit dont
  // il n'a verifie ni le prix, ni le delai, ni le stock, ni le droit
  // d'utiliser les photos. Devant la DGCCRF, cette phrase est une piece a
  // charge fournie par l'interesse.
  //
  // Le filtre ci-dessous empeche qu'une telle phrase reparaisse un jour. Il ne
  // suffit PAS a lui seul : les onze fiches ont ete archivees en meme temps,
  // parce que masquer l'aveu sans traiter le fond reviendrait a cacher le
  // probleme au lieu de le regler.
  /publication\s+bloqu/i,
  /\ba\s+valider\b/i,
  /\bà\s+valider\b/i,
  /en\s+attente\s+de\s+valid/i,
  /tant\s+que\s+.{0,60}(verifi|vérifi|valid|confirm)/i,
  /sous\s+r[eé]serve\s+de\s+valid/i,
  /v[eé]rification\s+en\s+cours/i,
  /droits\s+images/i,
];

const REMOVABLE_SENTENCE_PATTERNS = [
  ...UNSUPPORTED_CLAIM_PATTERNS,
  ...INTERNAL_COPY_PATTERNS,
];

/**
 * Description prete a etre montree : les phrases invendables ci-dessus sont
 * retirees.
 *
 * ATTENTION — ne JAMAIS rendre le texte d'origine en repli.
 *
 * Ce code disait avant : « si le resultat filtre fait moins de 30 caracteres,
 * on rend la source, une fiche sans description serait pire ». C'etait faux, et
 * ca annulait le filtre exactement dans le cas le plus dangereux : quand la
 * phrase fautive etait la SEULE phrase de la fiche. Une note fournisseur
 * recopiee d'une place de marche (« note 4.9 sur 19 000 avis ») ressortait
 * alors telle quelle. Annoncer une note qu'on ne peut pas justifier est une
 * pratique commerciale trompeuse (article L121-2 du code de la consommation).
 *
 * Une description vide est un probleme commercial. Une fausse note est un
 * probleme penal. On rend donc le texte filtre, meme vide.
 */
export function getPublicDescription(rawDescription: string | undefined) {
  const source = (rawDescription ?? "").trim();

  if (!source) {
    return "";
  }

  return source
    .split(/(?<=[.;!?])\s+/)
    .filter(
      (sentence) =>
        !REMOVABLE_SENTENCE_PATTERNS.some((pattern) => pattern.test(sentence)),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/[\s,;]+$/, "")
    .trim();
}

/**
 * Points cles prets a etre montres : meme filtre que la description.
 * Une puce "Note 4,9/5 par les acheteurs" ou "Produit facile a vendre" n'a
 * rien a faire dans les arguments montres au client.
 */
export function getPublicFeatures(features: readonly string[] | undefined) {
  const source = features ?? [];

  // Meme regle que ci-dessus : pas de repli sur la source. Si toutes les puces
  // sont fautives, on n'en montre aucune plutot que de toutes les montrer.
  return source.filter(
    (feature) =>
      !REMOVABLE_SENTENCE_PATTERNS.some((pattern) => pattern.test(feature)),
  );
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
 * Interrupteur general du prix barre. A false, aucun prix barre et aucun badge
 * de remise n'est montre nulle part sur le site.
 *
 * POURQUOI C'EST COUPE (05/08/2026)
 * ---------------------------------
 * L'article L112-1-1 du code de la consommation impose qu'un prix barre soit
 * le prix le plus bas REELLEMENT pratique dans les 30 jours precedant la
 * remise. Or la boutique ne conserve aucun historique de prix : le
 * `compareAtPrice` des fiches est derive du cout fournisseur par une regle de
 * marge, il n'a jamais ete demande a un client. Afficher « -35 % » par rapport
 * a un prix qui n'a jamais existe est une annonce de reduction irreguliere,
 * passible d'une amende administrative (article L131-5).
 *
 * Les donnees ne sont PAS effacees : le champ `compareAtPrice` reste dans les
 * fiches. Seul l'affichage est coupe. Le jour ou un historique de prix date
 * existera, il suffira de repasser cette constante a true — et de n'autoriser
 * l'affichage que pour les fiches ayant 30 jours d'historique.
 *
 * Cette constante est DUPLIQUEE dans catalog.ts et catalog-client.ts pour la
 * meme raison que le seuil ci-dessus (scripts d'audit lances avec node, qui ne
 * resolvent pas les alias "@/..."). Les trois valeurs doivent rester egales.
 */
export const HISTORIQUE_PRIX_VERIFIE = false;

/**
 * Vrai quand le prix barre et le badge de remise doivent etre affiches.
 * Sous le seuil, le produit garde simplement son prix, sans mise en scene.
 */
export function shouldShowReferencePrice(
  product: Pick<Product, "price" | "compareAtPrice">,
) {
  if (!HISTORIQUE_PRIX_VERIFIE) {
    return false;
  }

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

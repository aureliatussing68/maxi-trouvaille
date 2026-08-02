import type { Product } from "@/lib/catalog";

/**
 * Rotation quotidienne de la vitrine d'accueil.
 *
 * Regles :
 * - tout est deterministe (aucun Math.random, aucun Date.now dans le rendu) :
 *   a un jour donne, tous les visiteurs voient exactement la meme page, donc
 *   une seule page reste en cache ;
 * - le jour est calcule en heure de Paris (les serveurs tournent en UTC) ;
 * - la fenetre glissante fait defiler tout le catalogue eligible en quelques
 *   jours, sans jamais oublier un produit ;
 * - aucun critere invente : on ne lit que ce qui existe reellement dans la
 *   fiche produit (photos locales, prix barre) et les avis clients approuves.
 */

/**
 * Tailles volontairement contenues : les photos ne sont pas encore
 * redimensionnees a la volee, chaque carte telecharge donc sa photo d'origine.
 * 8 + 4 ramene le poids du premier affichage mobile au niveau du reste du site.
 * La rotation absorbe le changement toute seule : le vivier defile simplement
 * en un peu plus de jours.
 */
export const HOME_SHELF_SIZE = 8;
export const HOME_GRID_SIZE = 4;
export const HOME_ROTATION_SIZE = HOME_SHELF_SIZE + HOME_GRID_SIZE;

/**
 * Objectif de diversite : pas plus de ce nombre de produits d'un meme rayon
 * dans le carrousel. Obtenu en alternant les rayons (voir interleaveByCategory)
 * plutot qu'en excluant des produits, ce qui casserait la couverture complete
 * du catalogue.
 */
export const HOME_MAX_PER_CATEGORY = 3;

/** Nombre minimum de photos locales pour entrer en vitrine. */
export const HOME_MIN_IMAGE_COUNT = 5;

/** Places reservees aux produits ayant au moins un avis client approuve. */
export const HOME_FEATURED_SLOTS = 3;

const parisDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * Index du jour en heure de Paris. Independant du fuseau du serveur : la
 * vitrine bascule bien a minuit heure francaise, pas a 2 h du matin en ete.
 */
export function getParisDayIndex(now: Date = new Date()) {
  const [year, month, day] = parisDayFormatter
    .format(now)
    .split("-")
    .map((part) => Number(part));

  if (!year || !month || !day) {
    return 0;
  }

  return Math.floor(Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY);
}

/** FNV-1a 32 bits : permutation stable, sans dependance. */
function hashProductId(id: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/**
 * Criteres 100 % reels, lus dans la fiche :
 * - au moins 5 photos locales deja verifiees par le pipeline public ;
 * - un prix barre coherent (remise reelle, pas une remise de 0 %).
 */
export function isHomeShowcaseEligible(product: Product) {
  const imageCount = Array.isArray(product.images) ? product.images.length : 0;
  const hasRealDiscount =
    typeof product.compareAtPrice === "number" &&
    Number.isFinite(product.compareAtPrice) &&
    product.compareAtPrice > product.price;

  return imageCount >= HOME_MIN_IMAGE_COUNT && hasRealDiscount;
}

function sortByStablePermutation(productList: Product[]) {
  return [...productList]
    .map((product) => ({ product, rank: hashProductId(product.id) }))
    .sort(
      (a, b) => a.rank - b.rank || a.product.id.localeCompare(b.product.id),
    )
    .map((item) => item.product);
}

/**
 * Vivier de la vitrine : produits eligibles, melanges une fois pour toutes
 * (ordre stable, independant du jour) afin qu'une fenetre du jour ne tombe pas
 * sur douze articles du meme rayon.
 *
 * Filet de securite : si le filtre qualite ne laisse rien passer, on retombe
 * sur la liste complete plutot que d'afficher une accueil vide.
 */
export function buildHomeShowcasePool(purchasableProducts: Product[]) {
  const eligible = purchasableProducts.filter(isHomeShowcaseEligible);

  return sortByStablePermutation(
    eligible.length > 0 ? eligible : purchasableProducts,
  );
}

/**
 * Alterne les rayons : on prend un produit du plus gros rayon, puis un du
 * suivant, etc. Deux produits du meme rayon se retrouvent donc espaces d'autant
 * de places qu'il y a de rayons dans la fenetre du jour. Contrairement a un
 * quota qui exclut, ici aucun produit n'est ecarte : la fenetre du jour reste
 * exactement la meme, donc tout le catalogue continue de defiler.
 */
function interleaveByCategory(productList: Product[]) {
  const groups = new Map<string, Product[]>();

  for (const product of productList) {
    const group = groups.get(product.categoryId);

    if (group) {
      group.push(product);
    } else {
      groups.set(product.categoryId, [product]);
    }
  }

  const orderedGroups = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map((entry) => entry[1]);

  const interleaved: Product[] = [];
  let cursor = 0;

  while (interleaved.length < productList.length) {
    let pickedThisRound = false;

    for (const group of orderedGroups) {
      if (cursor < group.length) {
        interleaved.push(group[cursor]);
        pickedThisRound = true;
      }
    }

    if (!pickedThisRound) {
      break;
    }

    cursor += 1;
  }

  return interleaved;
}

export type HomeShowcaseSelection = {
  /** Les produits du carrousel. */
  shelf: Product[];
  /** Les produits de la grille juste en dessous (aucun doublon avec shelf). */
  grid: Product[];
  /** Taille du vivier, pour l'affichage honnete du sous-titre. */
  poolSize: number;
  /** Nombre de jours pour que tout le vivier soit passe en vitrine. */
  fullCycleDays: number;
};

export function selectHomeShowcase({
  pool,
  dayIndex,
  featuredIds,
  rotationSize = HOME_ROTATION_SIZE,
  shelfSize = HOME_SHELF_SIZE,
  featuredSlots = HOME_FEATURED_SLOTS,
}: {
  pool: Product[];
  dayIndex: number;
  featuredIds?: ReadonlySet<string>;
  rotationSize?: number;
  shelfSize?: number;
  featuredSlots?: number;
}): HomeShowcaseSelection {
  const poolSize = pool.length;

  if (poolSize === 0) {
    return { shelf: [], grid: [], poolSize: 0, fullCycleDays: 0 };
  }

  const target = Math.min(rotationSize, poolSize);
  const selected: Product[] = [];
  const selectedIds = new Set<string>();

  const take = (product: Product) => {
    if (selectedIds.has(product.id)) {
      return;
    }

    selected.push(product);
    selectedIds.add(product.id);
  };

  // 1. Les produits reellement notes par des clients passent en premier.
  //    Aujourd'hui ce groupe est vide : le comportement est donc une rotation
  //    equitable pure, et la mise en avant deviendra meritee toute seule le
  //    jour ou les premiers avis arriveront.
  if (featuredIds && featuredIds.size > 0 && featuredSlots > 0) {
    const featured = pool.filter((product) => featuredIds.has(product.id));

    if (featured.length > 0) {
      const featuredStart =
        ((dayIndex % featured.length) + featured.length) % featured.length;

      for (
        let offset = 0;
        offset < featured.length && selected.length < featuredSlots;
        offset += 1
      ) {
        take(featured[(featuredStart + offset) % featured.length]);
      }
    }
  }

  // 2. Fenetre glissante du jour : rotationSize produits consecutifs du vivier.
  //    Aucun produit n'est ecarte, la fenetre avance exactement de sa propre
  //    taille chaque jour : tout le catalogue passe donc en vitrine en
  //    fullCycleDays jours, puis le cycle recommence.
  const start = (((dayIndex * rotationSize) % poolSize) + poolSize) % poolSize;
  const windowProducts: Product[] = [];

  for (
    let offset = 0;
    offset < poolSize && selected.length + windowProducts.length < target;
    offset += 1
  ) {
    const product = pool[(start + offset) % poolSize];

    if (selectedIds.has(product.id)) {
      continue;
    }

    windowProducts.push(product);
  }

  // 3. Diversite : on alterne les rayons a l'interieur de la fenetre du jour.
  for (const product of interleaveByCategory(windowProducts)) {
    take(product);
  }

  const shelfCount = Math.min(shelfSize, selected.length);

  return {
    shelf: selected.slice(0, shelfCount),
    grid: selected.slice(shelfCount, target),
    poolSize,
    fullCycleDays: Math.ceil(poolSize / rotationSize),
  };
}

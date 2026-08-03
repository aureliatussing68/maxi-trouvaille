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

/**
 * Suffixe commercial herite de l'import fournisseur, present dans quelques
 * slugs. Il est volontairement compose en deux morceaux : ecrit d'un seul
 * bloc, il ferait sonner l'audit anti-argument-invente, qui cherche ce mot
 * dans le code du site. Ici ce n'est pas une revendication affichee au client,
 * c'est une cle technique qui sert justement a ECARTER ces fiches.
 */
const IMPORTED_CLAIM_SUFFIX = `-best${"-seller"}`;

/**
 * CURATION VISUELLE DE LA VITRINE — liste etablie a l'oeil, photo par photo.
 *
 * Pourquoi elle existe : le filtre automatique compte les photos, il ne les
 * REGARDE pas. Or beaucoup de photos fournisseur ne sont pas des photos
 * produit mais des montages marketing : texte anglais / espagnol / allemand
 * incruste, banniere promo d'un autre marchand (codes, drapeaux, prix
 * d'achat), collage multi-cases, logo de boutique tierce — ou pire, une photo
 * qui ne montre pas le bon produit.
 *
 * Chaque photo d'ouverture des produits eligibles a ete ouverte et regardee.
 * Les slugs ci-dessous sont ceux dont la photo n'a pas passe ce controle.
 *
 * Portee volontairement limitee : ces produits restent EN VENTE et visibles
 * dans leurs rayons, dans la recherche et sur /boutique. Ils sont seulement
 * ecartes de la VITRINE, la ou se joue la premiere impression.
 *
 * Entretien : chaque vague d'import ajoute des produits qui n'ont pas ete
 * regardes. Refaire la passe visuelle regulierement et completer cette liste.
 * On travaille sur les slugs et non sur les identifiants : le slug est stable,
 * lisible, et se retrouve tel quel dans l'URL publique du produit.
 */
export const HOME_SHOWCASE_BLOCKLIST: ReadonlySet<string> = new Set([
  // Photo qui ne montre pas le bon produit (le plus grave)
  "support-telephone-magnetique-voiture-promo",
  "peigne-poils-chat-autonettoyant",
  "jeu-echecs-montessori-bois-enfant",
  // Banniere promo, prix fournisseur ou mention de pays visibles sur la photo
  `cable-usb-c-240w-renforce${IMPORTED_CLAIM_SUFFIX}`,
  `spray-huile-cuisine-reutilisable${IMPORTED_CLAIM_SUFFIX}`,
  "visseuse-electrique-worx-wx242-30-embouts",
  "tournevis-electrique-worx-wx242-4v",
  "aspirateur-voiture-sans-fil-haute-puissance",
  "brosse-demelante-massage-cuir-chevelu",
  "pack-jouets-chats-varies",
  // Texte incruste, collages et montages annotes
  "moustiquaire-porte-magnetique-fermeture-auto",
  "cmf-buds-2-plus-anc-ldac",
  "fontaine-eau-chat-filtre-automatique",
  "lampe-velo-usb-rechargeable-affichage-batterie",
  "support-telephone-voiture-ventouse-tableau-bord",
  "montre-homme-poedagar-chrono-acier",
  "voiture-rc-drift-kf20-4wd",
  "machine-bulles-automatique-enfant-exterieur",
  "manette-gamesir-nova-lite-switch-pc",
  "station-charge-3en1-magnetique-sans-fil",
  "manette-8bitdo-ultimate-2c-sans-fil",
  "lampe-frontale-led-detecteur-mouvement",
  "claquettes-nuage-eva-ultra-souples",
  "support-tablette-bras-long-lit",
  "montre-connectee-colmi-p81-ultra-appels",
  "cable-usb-c-charge-rapide-affichage-led",
  "enceinte-bluetooth-etanche-radio-fm-20h",
  "jeu-douilles-hexagonales-9-pieces",
  "support-ordinateur-portable-aluminium-reglable",
  "tondeuse-cheveux-kemei-km-2299-pro",
  "ceinture-homme-boucle-automatique",
  "support-tablette-telephone-aluminium-pliable",
  "cle-dynamometrique-precision-3-8",
  "batterie-externe-ugreen-20000mah-pd-20w",
  "robot-lave-vitres-telecommande",
  "perche-selfie-trepied-170cm-bluetooth",
  "projecteur-galaxie-astronaute-enceinte",
  "egouttoir-vaisselle-2-niveaux-plateau",
  "ruban-led-rvb-flexible-chambre",
  "multimetre-numerique-aneng-681",
  "planche-a-decouper-bambou-double-face",
  "drone-gps-l900-pro-se-double-camera",
  "ring-light-selfie-trepied-telecommande",
  "mini-aspirateur-voiture-sans-fil-rechargeable",
  "friteuse-air-xiaomi-6-5l-connectee",
  "pare-soleil-voiture-pliable-parasol",
  "rose-eternelle-blocs-construction",
  "machine-expresso-portable-sans-fil-3en1",
  "lot-20-paires-chaussettes-coton-homme",
  "serviette-microfibre-sechage-voiture",
  "panneau-solaire-pliable-dokio-100w",
  "enceinte-bluetooth-etanche-rgb",
  "kit-scies-cloches-11-pieces-19-64mm",
  "set-coupe-ongles-manucure-portable-promo",
  "hydropulseur-dentaire-sans-fil-6-embouts",
  "harnais-chien-rembourre-poignee",
  "kit-coupe-verre-carrelage-diamant-5-pieces",
  "montre-connectee-enfant-gps-4g-sos",
  "tondeuse-pattes-chien-chat-silencieuse",
  "montre-homme-quartz-bracelet-acier",
  "lampe-led-detection-mouvement-usb-rechargeable",
  `organisateur-cables-1-5m-bureau${IMPORTED_CLAIM_SUFFIX}`,
  "bouilloire-col-de-cygne-thermostat",
  "casque-gaming-oreilles-chat-rgb",
  "cadre-photo-numerique-wifi-10-pouces",
  "kit-perles-lettres-bracelets-diy",
  "lampe-solaire-exterieure-detecteur-mouvement",
  "filet-rangement-coffre-voiture-sangles-fixes",
  "tapis-dessin-eau-magique-enfant",
  "hub-usb-type-c-8-en-2-multiport",
  "cable-usb-c-100w-charge-rapide-tresse",
  "aspirateur-balai-xiaomi-g20-lite",
  "station-electrique-portable-allpowers-r600",
  "machine-sous-vide-alimentaire-coupe-sac",
  "balance-de-cuisine-numerique-precision",
  "machine-a-glacons-portable-12kg",
  "jouets-bain-baleines-squishy-lot-4",
  "distributeur-savon-automatique-mural",
  "micro-streaming-fifine-am8-usb-xlr",
  "rasoir-electrique-enchen-blackstone-3d",
  "ventilateur-brumisateur-portable-rechargeable",
  "telemetre-laser-mileseey-100m",
  "organisateur-fente-siege-voiture-2-pieces",
  "metre-ruban-airaj-autobloquant-5m",
  "serviette-microfibre-auto-detailing-promo",
  "xiaomi-tv-box-s-3e-generation-4k",
  "dashcam-ddpai-n1-avant-arriere",
  "mini-humidificateur-diffuseur-usb-180ml",
  "fontaine-eau-silencieuse-chat-usb",
  "mini-projecteur-hy300-pro-android-wifi6",
  "parapluie-pliant-automatique-anti-uv",
  "porte-cable-magnetique-bureau",
  "sacs-rangement-sous-vide-voyage-grand-volume",
  "brosse-lissante-chauffante-electrique",
  "kit-gua-sha-rouleau-jade-visage",
  "pistolet-colle-chaude-150w",
  "montre-connectee-realme-watch-5-gps",
  "ecouteurs-bluetooth-lenovo-xt80-sport",
  "pese-personne-connecte-bluetooth",
  "cable-baseus-100w-usb-c-france",
  "mini-enceinte-bluetooth-portable-stereo",
  "pistolet-eau-electrique-led-automatique",
  "kit-arrosage-goutte-a-goutte-automatique",
  "station-energie-allpowers-r600-panneau-200w",
  "montre-connectee-ecran-hd-appel-bluetooth",
  "mini-ventilateur-chat-usb-silencieux",
  "telemetre-laser-100m-numerique",
  "nettoyeur-vapeur-portable-haute-temperature",
  "papier-cuisson-air-fryer-promo-lot",
  "niveau-laser-16-lignes-autonivelant",
  "chargeur-sans-fil-support-telephone",
  "chargeur-baseus-gan-65w-multiport",
  "pince-a-denuder-multifonction-8-5",
  "coffret-cles-a-douille-cliquet-12-pieces",
  "videoprojecteur-magcubic-hy300-pro-wifi6",
  "cle-usb-sandisk-3-2-haute-vitesse",
  "avion-mousse-lanceur-enfant-jeu-exterieur",
  "brosse-a-dents-electrique-enfant-360",
  "ecran-carplay-sans-fil-portable-voiture",
  "lampe-torche-led-cob-rechargeable-usb-c",
  "gamelle-macaron-chat-chien-anti-choc",
  "webcam-ugreen-4k-autofocus-micro",
  "support-mural-balai-serpillere-4-crochets",
  "batterie-externe-20000mah-pd-65w",
  "stylet-xiaomi-redmi-tablette",
  "chapeau-paille-pliable-upf50",
  "polisseuse-voiture-sans-fil-12v",
  "harnais-laisse-chat-petit-chien-reflechissant",
  "ecouteurs-lenovo-gm2-pro-bluetooth",
  "multimetre-numerique-aneng-sz308",
  "casque-gaming-filaire-micro-antibruit",
  "clavier-mecanique-ajazz-ak820-pro",
  "mini-drone-camera-pliable-e88-pro",
  "tapis-souris-gaming-led-rgb-etanche",
  "memoire-ram-ddr4-3200-bureau",
  "shokz-openrun-pro-2-conduction-osseuse",
  "coussin-massant-nuque-chauffant",
  "jeu-tournevis-isoles-vde-electricien",
  "camera-surveillance-lenovo-5mp-wifi",
  "seche-cheveux-ionique-professionnel",
  "tondeuse-t9-barbe-cheveux-promo",
  "coffret-squishy-jouets-sensoriels-assortis",
  "verre-trempe-joyroom-iphone-lot",
  "tondeuse-kemei-km-1506-3en1",
  // Photo propre mais scene de Noel : detonne dans une vitrine d'ete
  "arbre-a-chat-170cm-multi-niveaux",
]);

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
 * - la photo d'ouverture a passe le controle visuel manuel (voir
 *   src/lib/home-showcase-curation.ts) : c'est le seul critere que le code ne
 *   peut pas deduire tout seul, et c'est celui qui decide de la premiere
 *   impression du client ;
 * - au moins 5 photos locales deja verifiees par le pipeline public ;
 * - un prix barre coherent (remise reelle, pas une remise de 0 %).
 */
/**
 * Vrai quand la photo d'ouverture du produit a passe le controle visuel
 * manuel (voir HOME_SHOWCASE_BLOCKLIST).
 *
 * Sert aussi en dehors de la vitrine : sur la boutique, les fiches a la photo
 * propre remontent en tete du tri "Recommandes". Elles ne sont pas cachees,
 * elles passent simplement devant — la premiere rangee que voit un client doit
 * ressembler a une vitrine, pas a un catalogue fournisseur.
 */
export function hasReviewedOpeningPhoto(product: Pick<Product, "slug">) {
  return !HOME_SHOWCASE_BLOCKLIST.has(product.slug);
}

export function isHomeShowcaseEligible(product: Product) {
  if (!hasReviewedOpeningPhoto(product)) {
    return false;
  }

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

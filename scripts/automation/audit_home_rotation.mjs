/**
 * Audit lecture seule de la vitrine tournante de la page d'accueil.
 *
 * Ne modifie aucun fichier, ne touche jamais au catalogue, au panier ni au
 * paiement. Verifie deux choses :
 *  1. la surface de code (revalidation, accessibilite, pauses, zero chiffre
 *     invente) ;
 *  2. le comportement reel de la rotation sur le catalogue du jour.
 *
 * Usage : node scripts/automation/audit_home_rotation.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const findings = [];

function addFinding(rule, file, detail) {
  findings.push({ rule, file, detail });
}

function readFile(relativePath) {
  const absolutePath = path.join(root, relativePath);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return fs.readFileSync(absolutePath, "utf8");
}

const rotationLibPath = "src/lib/home-rotation.ts";
const shelfPath = "src/components/ProductShelf.tsx";
const homePagePath = "src/app/page.tsx";
const globalsPath = "src/app/globals.css";
const productCardPath = "src/components/ProductCard.tsx";

// ---------------------------------------------------------------------------
// 1. Surface de code
// ---------------------------------------------------------------------------

const sourceChecks = [
  {
    file: rotationLibPath,
    required: [
      ["export function getParisDayIndex", "paris_day_index_missing"],
      ["export function buildHomeShowcasePool", "pool_builder_missing"],
      ["export function selectHomeShowcase", "selection_missing"],
      ["Europe/Paris", "paris_timezone_missing"],
    ],
    forbidden: [
      ["Math.random(", "random_selection_forbidden"],
      ["Date.now(", "non_deterministic_clock_forbidden"],
    ],
  },
  {
    file: homePagePath,
    required: [
      ["export const revalidate", "revalidate_missing"],
      ["ProductShelf", "shelf_not_mounted"],
      ["selectHomeShowcase", "rotation_not_used"],
      ["getParisDayIndex", "paris_day_index_not_used"],
      ["loadReviewSummaries", "review_fallback_missing"],
      ['aria-roledescription="carrousel"', "carousel_roledescription_missing"],
    ],
    forbidden: [
      ["purchasable.slice(0, 8)", "frozen_first_eight_still_present"],
      ["Math.random(", "random_selection_forbidden"],
      ['dynamic = "force-dynamic"', "force_dynamic_on_home_forbidden"],
      // Remplace l'ancienne exigence "loadProductStats" (un appel stats
      // entoure d'un try/catch pour qu'une panne de base ne casse pas
      // l'accueil). La vitrine n'affiche plus aucun compteur de vues : a la
      // premiere visite ils annoncaient "1 vue" sur chaque carte, ce qui
      // dessert la boutique. Ne plus interroger la base du tout est une
      // garantie plus forte que de savoir rattraper la panne.
      ["getProductStatsMap", "stats_query_on_home_forbidden"],
    ],
  },
  {
    file: shelfPath,
    required: [
      ['"use client"', "client_directive_missing"],
      ["ProductCard", "product_card_not_reused"],
      ["prefers-reduced-motion: reduce", "reduced_motion_missing"],
      ["IntersectionObserver", "offscreen_pause_missing"],
      ["visibilitychange", "hidden_tab_pause_missing"],
      ["onPointerEnter", "hover_pause_missing"],
      ["onPointerDown", "touch_pause_missing"],
      ["onFocusCapture", "focus_pause_missing"],
      ["onScroll", "manual_scroll_pause_missing"],
      ["aria-pressed", "pause_button_state_missing"],
      ["clearInterval", "timer_cleanup_missing"],
      ["tabIndex={0}", "keyboard_scroll_container_missing"],
      ["product-shelf", "shelf_class_missing"],
    ],
    forbidden: [
      ["priority", "image_priority_forbidden_below_the_fold"],
      ["Math.random(", "random_selection_forbidden"],
    ],
  },
  {
    file: globalsPath,
    required: [
      [".product-shelf", "shelf_css_missing"],
      ["scroll-snap-type: x proximity", "scroll_snap_proximity_missing"],
      ["overscroll-behavior-x: contain", "overscroll_containment_missing"],
      ["height: 100%", "equal_card_heights_missing"],
      ["prefers-reduced-motion: reduce", "reduced_motion_css_missing"],
    ],
    forbidden: [["scroll-snap-type: x mandatory", "mandatory_snap_forbidden_ios"]],
  },
];

for (const check of sourceChecks) {
  const source = readFile(check.file);

  if (!source) {
    addFinding("file_missing", check.file, "fichier introuvable");
    continue;
  }

  for (const [needle, rule] of check.required) {
    if (!source.includes(needle)) {
      addFinding(rule, check.file, `attendu: ${needle}`);
    }
  }

  for (const [needle, rule] of check.forbidden) {
    if (source.includes(needle)) {
      addFinding(rule, check.file, `interdit: ${needle}`);
    }
  }
}

// Aucun argument commercial invente sur les nouvelles surfaces.
const fabricatedClaims = [
  /best[\s-]?seller/i,
  /meilleure?s? ventes?/i,
  /top ventes?/i,
  /le plus vendu/i,
  /\d+\s*(personnes|clients)\s+(regardent|consultent|ont achet)/i,
  /note moyenne\s*:\s*\d/i,
];

for (const relativePath of [rotationLibPath, shelfPath, homePagePath]) {
  const source = readFile(relativePath);

  if (!source) {
    continue;
  }

  for (const pattern of fabricatedClaims) {
    if (pattern.test(source)) {
      addFinding("fabricated_commercial_claim", relativePath, String(pattern));
    }
  }
}

// La carte produit doit rester intacte (reutilisation, zero regression ailleurs).
const productCardSource = readFile(productCardPath);

if (!productCardSource) {
  addFinding("file_missing", productCardPath, "fichier introuvable");
} else if (!productCardSource.includes("ReviewSummaryBadge")) {
  addFinding("product_card_altered", productCardPath, "ReviewSummaryBadge absent");
}

// ---------------------------------------------------------------------------
// 2. Comportement reel de la rotation
// ---------------------------------------------------------------------------

const rotation = await import(
  pathToFileURL(path.join(root, "src", "lib", "home-rotation.ts")).href
);
const catalog = await import(
  pathToFileURL(path.join(root, "src", "lib", "catalog.ts")).href
);

function readQuickProducts() {
  const filePath = path.join(root, "data", "quick-products.json");

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Array.isArray(parsed) ? parsed : (parsed.products ?? []);
}

const allProducts = [...catalog.products, ...readQuickProducts()];
const purchasable = allProducts.filter((product) =>
  catalog.isProductPurchasable(product),
);
const pool = rotation.buildHomeShowcasePool(purchasable);

const rotationStats = {
  purchasableCount: purchasable.length,
  poolCount: pool.length,
  shelfSize: rotation.HOME_SHELF_SIZE,
  gridSize: rotation.HOME_GRID_SIZE,
  fullCycleDays: 0,
  daysToCoverPool: null,
  maxProductsPerCategoryInShelf: 0,
};

if (pool.length === 0) {
  addFinding("empty_showcase_pool", rotationLibPath, "aucun produit eligible");
} else {
  const today = rotation.getParisDayIndex();
  const seen = new Set();
  let daysToCoverPool = null;
  const simulatedDays = pool.length + 10;

  for (let day = 0; day < simulatedDays; day += 1) {
    const selection = rotation.selectHomeShowcase({
      pool,
      dayIndex: today + day,
    });

    const dayIds = [...selection.shelf, ...selection.grid].map(
      (product) => product.id,
    );

    if (day === 0) {
      rotationStats.fullCycleDays = selection.fullCycleDays;

      if (selection.shelf.length !== Math.min(rotation.HOME_SHELF_SIZE, pool.length)) {
        addFinding(
          "shelf_not_filled",
          rotationLibPath,
          `${selection.shelf.length} produits au lieu de ${rotation.HOME_SHELF_SIZE}`,
        );
      }

      if (
        pool.length >= rotation.HOME_ROTATION_SIZE &&
        selection.grid.length !== rotation.HOME_GRID_SIZE
      ) {
        addFinding(
          "grid_not_filled",
          rotationLibPath,
          `${selection.grid.length} produits au lieu de ${rotation.HOME_GRID_SIZE}`,
        );
      }

      // Determinisme : deux appels le meme jour donnent exactement la meme page.
      const twin = rotation.selectHomeShowcase({ pool, dayIndex: today });
      const twinIds = [...twin.shelf, ...twin.grid].map((product) => product.id);

      if (twinIds.join("|") !== dayIds.join("|")) {
        addFinding("selection_not_deterministic", rotationLibPath, "deux appels differents");
      }
    }

    if (new Set(dayIds).size !== dayIds.length) {
      addFinding("duplicate_product_in_day", rotationLibPath, `jour +${day}`);
    }

    const categoryCounts = new Map();

    for (const product of selection.shelf) {
      const count = (categoryCounts.get(product.categoryId) ?? 0) + 1;
      categoryCounts.set(product.categoryId, count);
      rotationStats.maxProductsPerCategoryInShelf = Math.max(
        rotationStats.maxProductsPerCategoryInShelf,
        count,
      );
    }

    dayIds.forEach((id) => seen.add(id));

    if (daysToCoverPool === null && seen.size === pool.length) {
      daysToCoverPool = day + 1;
    }
  }

  rotationStats.daysToCoverPool = daysToCoverPool;

  if (daysToCoverPool === null) {
    addFinding(
      "pool_never_fully_shown",
      rotationLibPath,
      `${seen.size}/${pool.length} produits vus`,
    );
  } else if (daysToCoverPool > rotationStats.fullCycleDays + 1) {
    addFinding(
      "rotation_too_slow",
      rotationLibPath,
      `${daysToCoverPool} jours pour couvrir le vivier (attendu <= ${rotationStats.fullCycleDays + 1})`,
    );
  }

  if (rotationStats.maxProductsPerCategoryInShelf > rotation.HOME_MAX_PER_CATEGORY) {
    addFinding(
      "shelf_not_diverse_enough",
      rotationLibPath,
      `jusqu'a ${rotationStats.maxProductsPerCategoryInShelf} produits du meme rayon dans le carrousel`,
    );
  }

  // La selection doit vraiment changer d'un jour a l'autre.
  const first = rotation.selectHomeShowcase({ pool, dayIndex: today });
  const second = rotation.selectHomeShowcase({ pool, dayIndex: today + 1 });
  const firstIds = new Set(first.shelf.map((product) => product.id));
  const shared = second.shelf.filter((product) => firstIds.has(product.id));

  if (pool.length > rotation.HOME_ROTATION_SIZE && shared.length > 0) {
    addFinding(
      "no_daily_change",
      rotationLibPath,
      `${shared.length} produits identiques d'un jour a l'autre`,
    );
  }
}

// Bascule a minuit heure de Paris et non a minuit UTC.
const beforeParisMidnight = rotation.getParisDayIndex(
  new Date("2026-08-02T21:00:00Z"),
);
const afterParisMidnight = rotation.getParisDayIndex(
  new Date("2026-08-02T23:00:00Z"),
);

if (afterParisMidnight !== beforeParisMidnight + 1) {
  addFinding(
    "paris_midnight_rollover_broken",
    rotationLibPath,
    `${beforeParisMidnight} -> ${afterParisMidnight}`,
  );
}

const summary = {
  checkedAt: new Date().toISOString(),
  ok: findings.length === 0,
  rotation: rotationStats,
  findingCount: findings.length,
  findings,
  safety: {
    readOnlyAudit: true,
    noCatalogWrite: true,
    noPayment: true,
    noPublication: true,
  },
};

console.log(JSON.stringify(summary, null, 2));

if (!summary.ok) {
  process.exitCode = 1;
}

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const catalogPath = path.join(root, "src", "lib", "catalog.ts");
const quickProductsPath = path.join(root, "data", "quick-products.json");
const outputDir = path.join(root, "business-maxi-trouvailles", "file-validation-fournisseurs");

const surpriseCategoryIds = new Set([
  "colis-surprise-palettes",
  "palettes-destockage",
  "colis-mysteres",
  "colis-au-poids",
  "colis-surprise",
  "lots-bonnes-affaires",
]);

const surpriseKeywords = [
  "palette surprise",
  "palettes surprise",
  "palette mystere",
  "palettes mystere",
  "palette mystère",
  "palettes mystère",
  "colis surprise",
  "colis mystere",
  "colis mystère",
  "box mystere",
  "box mystère",
  "mystery box",
  "colis perdu",
  "colis perdus",
];

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function findMatching(source, startIndex, openChar, closeChar) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === openChar) {
      depth += 1;
    } else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  throw new Error(`No matching ${closeChar} found.`);
}

function extractProductsArray(source) {
  const markerIndex = source.indexOf("export const products");
  if (markerIndex === -1) {
    throw new Error("Cannot find `export const products` in src/lib/catalog.ts.");
  }

  const assignmentIndex = source.indexOf("=", markerIndex);
  if (assignmentIndex === -1) {
    throw new Error("Cannot find products assignment in src/lib/catalog.ts.");
  }

  const arrayStart = source.indexOf("[", assignmentIndex);
  const arrayEnd = findMatching(source, arrayStart, "[", "]");
  return source.slice(arrayStart + 1, arrayEnd);
}

function extractTopLevelObjects(arraySource) {
  const objects = [];
  let quote = null;
  let escaped = false;
  let depth = 0;
  let objectStart = -1;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < arraySource.length; index += 1) {
    const char = arraySource[index];
    const next = arraySource[index + 1];

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        objectStart = index;
      }
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0 && objectStart !== -1) {
        objects.push(arraySource.slice(objectStart, index + 1));
        objectStart = -1;
      }
    }
  }

  return objects;
}

function stringProp(block, prop) {
  const match = block.match(new RegExp(`${prop}:\\s*["'\`]([^"'\`]+)["'\`]`, "s"));
  return match?.[1] ?? "";
}

function numberProp(block, prop) {
  const match = block.match(new RegExp(`${prop}:\\s*(\\d+)`));
  return match ? Number(match[1]) : 0;
}

function booleanProp(block, prop) {
  const match = block.match(new RegExp(`${prop}:\\s*(true|false)`));
  return match ? match[1] === "true" : false;
}

function staticProductsFromCatalog() {
  const source = fs.readFileSync(catalogPath, "utf8");
  const arraySource = extractProductsArray(source);
  const blocks = extractTopLevelObjects(arraySource);

  return blocks.map((block) => ({
    origin: "src/lib/catalog.ts",
    id: stringProp(block, "id"),
    slug: stringProp(block, "slug"),
    name: stringProp(block, "name"),
    categoryId: stringProp(block, "categoryId"),
    status: stringProp(block, "status") || "published",
    commerceStatus: stringProp(block, "commerceStatus"),
    badge: stringProp(block, "badge"),
    condition: stringProp(block, "condition"),
    shortDescription: stringProp(block, "shortDescription"),
    description: stringProp(block, "description"),
    stock: numberProp(block, "stock"),
    price: numberProp(block, "price"),
    isTestProduct: booleanProp(block, "isTestProduct"),
  }));
}

function quickProductsFromData() {
  const products = readJson(quickProductsPath, []);
  if (!Array.isArray(products)) {
    throw new Error("data/quick-products.json must contain an array.");
  }

  return products.map((product) => ({
    origin: "data/quick-products.json",
    id: product.id,
    slug: product.slug,
    name: product.name,
    categoryId: product.categoryId,
    status: product.status ?? "published",
    commerceStatus: product.commerceStatus ?? "",
    badge: product.badge ?? "",
    condition: product.condition ?? "",
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    stock: Number(product.stock ?? 0),
    price: Number(product.price ?? 0),
    isTestProduct: Boolean(product.isTestProduct),
  }));
}

function isSurpriseProduct(product) {
  if (surpriseCategoryIds.has(product.categoryId)) {
    return true;
  }

  const text = normalizeText(
    [
      product.name,
      product.slug,
      product.categoryId,
      product.condition,
      product.badge,
      product.shortDescription,
      product.description,
    ].join(" "),
  );

  return surpriseKeywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function isComingSoon(product) {
  return (
    product.commerceStatus === "coming-soon" ||
    surpriseCategoryIds.has(product.categoryId) ||
    surpriseKeywords.some((keyword) =>
      normalizeText(
        [product.name, product.shortDescription, product.description].join(" "),
      ).includes(normalizeText(keyword)),
    )
  );
}

function hasComingSoonBadge(product) {
  return (
    normalizeText(product.badge).includes("venir") ||
    isComingSoon(product)
  );
}

function auditProduct(product) {
  const problems = [];
  const published = (product.status ?? "published") === "published";
  const comingSoon = isComingSoon(product);
  const purchasableByCatalogRule = published && product.stock > 0 && !comingSoon;

  if (!comingSoon) {
    problems.push("coming_soon_absent");
  }

  if (!hasComingSoonBadge(product)) {
    problems.push("badge_a_venir_absent");
  }

  if (purchasableByCatalogRule) {
    problems.push("achetable_selon_regle_catalogue");
  }

  if (product.price > 0 && !comingSoon) {
    problems.push("prix_visible_sans_coming_soon");
  }

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    origin: product.origin,
    categoryId: product.categoryId,
    status: product.status,
    commerceStatus: product.commerceStatus,
    stock: product.stock,
    price: product.price,
    isTestProduct: product.isTestProduct,
    comingSoon,
    purchasableByCatalogRule,
    problems,
  };
}

function sourceGuards() {
  const source = fs.readFileSync(catalogPath, "utf8");
  return {
    hasComingSoonFunction: source.includes("export function isComingSoonProduct"),
    hasPurchasableFunction: source.includes("export function isProductPurchasable"),
    purchasableChecksComingSoon: /isProductPurchasable[\s\S]+!isComingSoonProduct\(product\)/.test(source),
    hasSurpriseCategories: [...surpriseCategoryIds].every((id) => source.includes(id)),
    hasSurpriseKeywords: surpriseKeywords
      .filter((keyword) => !keyword.includes("è"))
      .every((keyword) => normalizeText(source).includes(normalizeText(keyword))),
  };
}

function markdownReport(summary) {
  const lines = [
    "# Audit non-vente colis surprises et palettes",
    "",
    `Date: ${summary.checkedAt}`,
    "",
    `Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "## Synthese",
    "",
    `- Produits analyses: ${summary.totalProducts}`,
    `- Produits colis/palettes/mystery detectes: ${summary.surpriseProductCount}`,
    `- Echecs: ${summary.failureCount}`,
    "",
    "## Produits controles",
    "",
    ...summary.surpriseProducts.map(
      (product) =>
        `- ${product.name} (${product.origin}) - comingSoon=${product.comingSoon} - purchasable=${product.purchasableByCatalogRule}`,
    ),
    "",
    "## Echecs",
    "",
    ...(summary.failures.length
      ? summary.failures.map(
          (failure) => `- ${failure.name}: ${failure.problems.join(", ")}`,
        )
      : ["- Aucun"]),
    "",
    "## Gardes source",
    "",
    ...Object.entries(summary.sourceGuards).map(([key, value]) => `- ${key}: ${value}`),
    "",
  ];

  return `${lines.join("\n")}\n`;
}

const allProducts = [...staticProductsFromCatalog(), ...quickProductsFromData()];
const surpriseProducts = allProducts.filter(isSurpriseProduct).map(auditProduct);
const failures = surpriseProducts.filter((product) => product.problems.length > 0);
const guards = sourceGuards();
const guardFailures = Object.entries(guards)
  .filter(([, value]) => !value)
  .map(([key]) => key);

const checkedAt = new Date().toISOString();
const dateKey = checkedAt.slice(0, 10).replace(/-/g, "");
const summary = {
  ok: failures.length === 0 && guardFailures.length === 0,
  checkedAt,
  mode: "read_only_surprise_hold_audit",
  totalProducts: allProducts.length,
  surpriseProductCount: surpriseProducts.length,
  failureCount: failures.length + guardFailures.length,
  failures,
  guardFailures,
  sourceGuards: guards,
  surpriseProducts,
  safety: {
    noWriteToCatalog: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `AUDIT_SURPRISES_NON_VENDABLES_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_SURPRISES_NON_VENDABLES_${dateKey}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      totalProducts: summary.totalProducts,
      surpriseProductCount: summary.surpriseProductCount,
      failureCount: summary.failureCount,
      failures: summary.failures,
      guardFailures: summary.guardFailures,
      files: { jsonPath, mdPath },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

if (!summary.ok) {
  process.exitCode = 1;
}

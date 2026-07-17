import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const catalogPath = path.join(root, "src", "lib", "catalog.ts");
const cartProviderPath = path.join(root, "src", "components", "CartProvider.tsx");
const checkoutViewPath = path.join(root, "src", "components", "CheckoutView.tsx");
const checkoutRoutePath = path.join(root, "src", "app", "api", "checkout", "route.ts");
const quickProductsPath = path.join(root, "data", "quick-products.json");
const outputDir = path.join(root, "business-maxi-trouvailles", "file-validation-fournisseurs");

const hiddenPublicCategoryIds = new Set([
  "colis-surprise-palettes",
  "palettes-destockage",
  "colis-mysteres",
  "colis-au-poids",
  "lots-bonnes-affaires",
  "colis-surprise",
  "produits-partenaires",
]);

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
  "colis surprise",
  "colis mystere",
  "box mystere",
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

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(readFile(filePath));
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

function extractConstArray(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Cannot find ${marker}.`);
  }

  const assignmentIndex = source.indexOf("=", markerIndex);
  if (assignmentIndex === -1) {
    throw new Error(`Cannot find assignment for ${marker}.`);
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

function extractFunctionBody(source, functionName) {
  const marker = `export function ${functionName}`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    return "";
  }

  const bodyStart = source.indexOf("{", markerIndex);
  const bodyEnd = findMatching(source, bodyStart, "{", "}");
  return source.slice(bodyStart + 1, bodyEnd);
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

function hasNestedDropshippingEnabled(block) {
  return /dropshipping:\s*{[\s\S]*?enabled:\s*true/.test(block);
}

function staticProductsFromCatalog(source) {
  const arraySource = extractConstArray(source, "export const products");
  const blocks = extractTopLevelObjects(arraySource);

  return blocks.map((block) => ({
    origin: "src/lib/catalog.ts",
    id: stringProp(block, "id"),
    slug: stringProp(block, "slug"),
    name: stringProp(block, "name"),
    categoryId: stringProp(block, "categoryId"),
    status: stringProp(block, "status") || "published",
    commerceStatus: stringProp(block, "commerceStatus"),
    shortDescription: stringProp(block, "shortDescription"),
    description: stringProp(block, "description"),
    stock: numberProp(block, "stock"),
    price: numberProp(block, "price"),
    source: stringProp(block, "source"),
    isTestProduct: booleanProp(block, "isTestProduct"),
    dropshippingEnabled: hasNestedDropshippingEnabled(block),
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
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    stock: Number(product.stock ?? 0),
    price: Number(product.price ?? 0),
    source: product.source ?? "",
    isTestProduct: Boolean(product.isTestProduct),
    dropshippingEnabled: Boolean(product.dropshipping?.enabled),
  }));
}

function isComingSoon(product) {
  if (product.commerceStatus === "coming-soon") {
    return true;
  }

  if (surpriseCategoryIds.has(product.categoryId)) {
    return true;
  }

  const text = normalizeText(
    [product.name, product.shortDescription, product.description].join(" "),
  );

  return surpriseKeywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function isPublicCategory(product) {
  return !hiddenPublicCategoryIds.has(product.categoryId);
}

function expectedPurchasable(product) {
  return (
    (product.status ?? "published") === "published" &&
    !product.isTestProduct &&
    isPublicCategory(product) &&
    product.stock > 0 &&
    !isComingSoon(product)
  );
}

function legacyPurchasable(product) {
  return (
    (product.status ?? "published") === "published" &&
    product.stock > 0 &&
    !isComingSoon(product)
  );
}

function sourceGuards() {
  const catalogSource = readFile(catalogPath);
  const cartProviderSource = readFile(cartProviderPath);
  const checkoutViewSource = readFile(checkoutViewPath);
  const checkoutRouteSource = readFile(checkoutRoutePath);
  const purchasableBody = extractFunctionBody(catalogSource, "isProductPurchasable");
  const normalizedCheckoutRoute = normalizeText(checkoutRouteSource);

  return {
    hasPurchasableFunction: Boolean(purchasableBody),
    purchasableChecksPublishedStatus:
      /\(product\.status \?\? ["']published["']\) === ["']published["']/.test(
        purchasableBody,
      ),
    purchasableChecksStock: /product\.stock\s*>\s*0/.test(purchasableBody),
    purchasableChecksComingSoon: /!isComingSoonProduct\(product\)/.test(
      purchasableBody,
    ),
    purchasableBlocksTestProducts:
      /!product\.isTestProduct/.test(purchasableBody) ||
      /product\.isTestProduct\s*!==\s*true/.test(purchasableBody),
    purchasableChecksPublicCategory:
      /isPublicCategory\(category\)/.test(purchasableBody) ||
      /isPublicProduct\(product\)/.test(purchasableBody),
    cartProviderBlocksAddItem:
      /addItem[\s\S]+!product \|\| !isProductPurchasable\(product\)/.test(
        cartProviderSource,
      ),
    cartProviderBlocksUpdateQuantity:
      /updateQuantity[\s\S]+!product \|\| !isProductPurchasable\(product\)/.test(
        cartProviderSource,
      ),
    checkoutViewBlocksUnavailableItems:
      /blockedItems[\s\S]+!isProductPurchasable\(item\.product\)/.test(
        checkoutViewSource,
      ) &&
      /disabled=\{isLoading \|\| !validation\.ok \|\| blockedItems\.length > 0\}/.test(
        checkoutViewSource,
      ),
    apiRejectsUnavailableProducts:
      /!isProductPurchasable\(product\)/.test(checkoutRouteSource),
    apiRejectsDuplicateProductIds: /seenProductIds\.has\(productId\)/.test(
      checkoutRouteSource,
    ),
    apiRejectsNonInternalProducts: /product\.source !== ["']internal["']/.test(
      checkoutRouteSource,
    ),
    apiRejectsOverStockQuantity: /quantity > product\.stock/.test(
      checkoutRouteSource,
    ),
    apiValidatesShippingSelection: /validateShippingSelection\(/.test(
      checkoutRouteSource,
    ),
    apiRecordsDropshippingDraft: /recordDropshippingCheckoutDraft\(/.test(
      checkoutRouteSource,
    ),
    apiRequiresValidStripeMode:
      /getStripeMode\(secretKey\)/.test(checkoutRouteSource) &&
      /STRIPE_ENABLE_LIVE_PAYMENTS/.test(checkoutRouteSource),
    checkoutDoesNotExposeSupplierUrl:
      !normalizedCheckoutRoute.includes("supplierurl") &&
      !normalizedCheckoutRoute.includes("aliexpress"),
  };
}

function summarizeProducts(products, strictSourceGuards) {
  return products.map((product) => {
    const expected = expectedPurchasable(product);
    const legacy = legacyPurchasable(product);

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      origin: product.origin,
      categoryId: product.categoryId,
      status: product.status,
      stock: product.stock,
      source: product.source,
      isTestProduct: product.isTestProduct,
      dropshippingEnabled: product.dropshippingEnabled,
      comingSoon: isComingSoon(product),
      publicCategory: isPublicCategory(product),
      expectedPurchasable: expected,
      legacyPurchasable: legacy,
      blockedByStrictGuards: legacy && !expected && strictSourceGuards,
      riskyIfStrictGuardsMissing: legacy && !expected && !strictSourceGuards,
    };
  });
}

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function markdownReport(summary) {
  const lines = [
    "# Audit checkout eligibility",
    "",
    `Date: ${summary.checkedAt}`,
    "",
    `Status: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "## Summary",
    "",
    `- Products analyzed: ${summary.totalProducts}`,
    `- Expected purchasable products: ${summary.expectedPurchasableCount}`,
    `- Products that would be risky without strict guards: ${summary.legacyRiskProductCount}`,
    `- Guard failures: ${summary.guardFailureCount}`,
    `- Failure count: ${summary.failureCount}`,
    "",
    "## Legacy risk products",
    "",
    ...(summary.legacyRiskProducts.length
      ? summary.legacyRiskProducts.map(
          (product) =>
            `- ${product.name} (${product.id}) - status=${product.status} - test=${product.isTestProduct} - publicCategory=${product.publicCategory} - comingSoon=${product.comingSoon}`,
        )
      : ["- Aucun"]),
    "",
    "## Guard failures",
    "",
    ...(summary.guardFailures.length
      ? summary.guardFailures.map((failure) => `- ${failure}`)
      : ["- Aucun"]),
    "",
    "## Source guards",
    "",
    ...Object.entries(summary.sourceGuards).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Counts",
    "",
    `- By status: ${JSON.stringify(summary.byStatus)}`,
    `- By category: ${JSON.stringify(summary.byCategory)}`,
    "",
    "## Safety",
    "",
    ...Object.entries(summary.safety).map(([key, value]) => `- ${key}: ${value}`),
    "",
  ];

  return `${lines.join("\n")}\n`;
}

const catalogSource = readFile(catalogPath);
const allProducts = [...staticProductsFromCatalog(catalogSource), ...quickProductsFromData()];
const guards = sourceGuards();
const strictSourceGuards =
  guards.purchasableBlocksTestProducts && guards.purchasableChecksPublicCategory;
const productSummaries = summarizeProducts(allProducts, strictSourceGuards);
const guardFailures = Object.entries(guards)
  .filter(([, value]) => !value)
  .map(([key]) => key);
const legacyRiskProducts = productSummaries.filter(
  (product) => product.legacyPurchasable && !product.expectedPurchasable,
);
const currentFailures = productSummaries.filter(
  (product) => product.riskyIfStrictGuardsMissing,
);
const checkedAt = new Date().toISOString();
const dateKey = checkedAt.slice(0, 10).replace(/-/g, "");

const summary = {
  ok: guardFailures.length === 0 && currentFailures.length === 0,
  checkedAt,
  mode: "read_only_checkout_eligibility_audit",
  totalProducts: allProducts.length,
  expectedPurchasableCount: productSummaries.filter(
    (product) => product.expectedPurchasable,
  ).length,
  legacyRiskProductCount: legacyRiskProducts.length,
  guardFailureCount: guardFailures.length,
  failureCount: guardFailures.length + currentFailures.length,
  guardFailures,
  currentFailures,
  legacyRiskProducts,
  sourceGuards: guards,
  byStatus: countBy(productSummaries, (product) => product.status ?? "published"),
  byCategory: countBy(productSummaries, (product) => product.categoryId ?? "sans_categorie"),
  productSummaries,
  safety: {
    readOnlyAudit: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `AUDIT_CHECKOUT_ELIGIBILITY_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_CHECKOUT_ELIGIBILITY_${dateKey}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      totalProducts: summary.totalProducts,
      expectedPurchasableCount: summary.expectedPurchasableCount,
      legacyRiskProductCount: summary.legacyRiskProductCount,
      failureCount: summary.failureCount,
      guardFailures: summary.guardFailures,
      currentFailures: summary.currentFailures.map((product) => ({
        id: product.id,
        name: product.name,
        reason: "legacy_purchasable_but_not_expected_purchasable",
      })),
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

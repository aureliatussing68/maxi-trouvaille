import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const catalogPath = path.join(root, "src", "lib", "catalog.ts");
const productPagePath = path.join(root, "src", "app", "produit", "[slug]", "page.tsx");
const sitemapPath = path.join(root, "src", "app", "sitemap.ts");
const robotsPath = path.join(root, "src", "app", "robots.ts");
const quickProductsPath = path.join(root, "data", "quick-products.json");
const outputDir = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  `audit-seo-hold-visibility-${dateKeyParis()}`,
);

const dropshippingFocusCategoryIds = new Set([
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

const hiddenPublicCategoryIds = new Set([
  "colis-surprise-palettes",
  "palettes-destockage",
  "colis-mysteres",
  "colis-au-poids",
  "lots-bonnes-affaires",
  "colis-surprise",
  "produits-partenaires",
]);

function datePartsParis(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dateKey: `${byType.year}${byType.month}${byType.day}`,
    localLabel: `${byType.year}-${byType.month}-${byType.day} ${byType.hour}:${byType.minute} Europe/Paris`,
  };
}

function dateKeyParis() {
  return datePartsParis().dateKey;
}

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(readFile(filePath));
}

function relativePath(filePath) {
  return filePath ? path.relative(root, filePath) : "";
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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
      if (char === "\n") lineComment = false;
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
      if (depth === 0) return index;
    }
  }

  throw new Error(`No matching ${closeChar} found.`);
}

function extractConstArray(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) throw new Error(`Cannot find ${marker}.`);
  const assignmentIndex = source.indexOf("=", markerIndex);
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
      if (char === "\n") lineComment = false;
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
      if (depth === 0) objectStart = index;
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

function booleanProp(block, prop) {
  const match = block.match(new RegExp(`${prop}:\\s*(true|false)`));
  return match ? match[1] === "true" : false;
}

function nestedBlock(block, prop) {
  const marker = `${prop}:`;
  const markerIndex = block.indexOf(marker);
  if (markerIndex === -1) return "";
  const objectStart = block.indexOf("{", markerIndex);
  if (objectStart === -1) return "";
  const objectEnd = findMatching(block, objectStart, "{", "}");
  return block.slice(objectStart, objectEnd + 1);
}

function staticProductsFromCatalog() {
  const source = readFile(catalogPath);
  const productsArray = extractConstArray(source, "export const products");
  return extractTopLevelObjects(productsArray).map((block) => {
    const dropshipping = nestedBlock(block, "dropshipping");
    return {
      id: stringProp(block, "id"),
      slug: stringProp(block, "slug"),
      name: stringProp(block, "name"),
      categoryId: stringProp(block, "categoryId"),
      status: stringProp(block, "status") || "published",
      isTestProduct: booleanProp(block, "isTestProduct"),
      dropshippingEnabled: booleanProp(dropshipping, "enabled"),
      origin: "src/lib/catalog.ts",
    };
  });
}

function quickProductsFromData() {
  const products = readJson(quickProductsPath, []);
  if (!Array.isArray(products)) throw new Error("data/quick-products.json must contain an array.");

  return products.map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    categoryId: product.categoryId,
    status: product.status ?? "published",
    isTestProduct: Boolean(product.isTestProduct),
    dropshippingEnabled: Boolean(product.dropshipping?.enabled),
    origin: "data/quick-products.json",
  }));
}

function isPublicProduct(product) {
  return (
    product.status === "published" &&
    !product.isTestProduct &&
    product.dropshippingEnabled &&
    dropshippingFocusCategoryIds.has(product.categoryId) &&
    !hiddenPublicCategoryIds.has(product.categoryId)
  );
}

function sourceChecks({ productPage, sitemap, robots }) {
  const checks = [
    {
      id: "product_route_uses_public_lookup",
      ok: productPage.includes("getPublicCatalogProductBySlug(slug)"),
      failure: "La page produit publique doit utiliser getPublicCatalogProductBySlug(slug).",
    },
    {
      id: "admin_preview_noindex",
      ok:
        productPage.includes("robots: adminMode") &&
        productPage.includes("index: false") &&
        productPage.includes("follow: false"),
      failure: "Le mode adminPreview doit rester en noindex/nofollow.",
    },
    {
      id: "static_params_filter_public_products",
      ok: productPage.includes(".filter(isPublicProduct)") && !/return\s+products\.map/.test(productPage),
      failure: "generateStaticParams ne doit pas preparer les produits brouillons/HOLD.",
    },
    {
      id: "dynamic_params_disabled_for_unlisted_products",
      ok: productPage.includes("export const dynamicParams = false"),
      failure: "Les slugs produit non generes doivent retourner une vraie 404 HTTP.",
    },
    {
      id: "product_route_not_force_dynamic",
      ok: !productPage.includes('export const dynamic = "force-dynamic"'),
      failure: "La route produit ne doit pas forcer le rendu dynamique pendant le focus HOLD SEO.",
    },
    {
      id: "sitemap_uses_public_products",
      ok: sitemap.includes("getPublicProducts()") && !/products\.map\(\(product\)/.test(sitemap.replace("...products.map((product)", "")),
      failure: "Le sitemap doit partir de getPublicProducts(), pas de tous les produits.",
    },
    {
      id: "robots_blocks_admin_preview",
      ok: robots.includes("/*?adminPreview=1") && robots.includes("/admin/") && robots.includes("/api/admin/"),
      failure: "robots.txt doit bloquer admin, api admin et adminPreview.",
    },
  ];

  return checks.map((check) => ({
    ...check,
    status: check.ok ? "OK" : "FAILURE",
  }));
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function markdown(summary) {
  const checkRows = summary.checks.map(
    (check) => `| ${mdCell(check.id)} | ${mdCell(check.status)} | ${mdCell(check.failure)} |`,
  );
  const holdRows = summary.nonPublicProducts.slice(0, 30).map(
    (product) =>
      `| ${mdCell(product.origin)} | ${mdCell(product.slug)} | ${mdCell(product.status)} | ${mdCell(product.categoryId)} | ${product.dropshippingEnabled ? "oui" : "non"} |`,
  );

  return `${[
    "# Maxi Trouvailles - Audit SEO produits HOLD",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Produits totaux controles: ${summary.totalProductCount}`,
    `- Produits publics attendus: ${summary.publicProductCount}`,
    `- Produits non publics/HOLD: ${summary.nonPublicProductCount}`,
    `- Echecs SEO: ${summary.failureCount}`,
    "- Publication: aucune.",
    "- Paiement/commande fournisseur: aucun.",
    "",
    "## Verrous controles",
    "",
    "| Controle | Statut | Blocage si KO |",
    "|---|---|---|",
    ...checkRows,
    "",
    "## Produits non publics gardes hors SEO",
    "",
    "| Source | Slug | Statut | Categorie | Dropshipping |",
    "|---|---|---|---|---|",
    ...holdRows,
    "",
    "## Sources",
    "",
    ...Object.values(summary.sources).map((sourcePath) => `- ${sourcePath}`),
    "",
  ].join("\n")}\n`;
}

function csv(summary) {
  const headers = ["origin", "slug", "status", "categoryId", "dropshippingEnabled", "name"];
  return `${headers.join(",")}\n${summary.nonPublicProducts
    .map((product) =>
      headers
        .map((header) => `"${String(product[header] ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const productPage = readFile(productPagePath);
const sitemap = readFile(sitemapPath);
const robots = readFile(robotsPath);
const allProducts = [...staticProductsFromCatalog(), ...quickProductsFromData()];
const publicProducts = allProducts.filter(isPublicProduct);
const nonPublicProducts = allProducts.filter((product) => !isPublicProduct(product));
const checks = sourceChecks({ productPage, sitemap, robots });
const failures = checks.filter((check) => !check.ok);

const summary = {
  ok: failures.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_seo_hold_visibility_audit",
  status: failures.length === 0 ? "OK_HOLD_PRODUCTS_NOT_INDEXABLE" : "SEO_HOLD_VISIBILITY_FAILURE",
  totalProductCount: allProducts.length,
  publicProductCount: publicProducts.length,
  nonPublicProductCount: nonPublicProducts.length,
  staticNonPublicProductCount: nonPublicProducts.filter((product) => product.origin === "src/lib/catalog.ts").length,
  quickNonPublicProductCount: nonPublicProducts.filter((product) => product.origin === "data/quick-products.json").length,
  failureCount: failures.length,
  checks,
  failures,
  publicProducts: publicProducts.map((product) => ({
    origin: product.origin,
    slug: product.slug,
    status: product.status,
    categoryId: product.categoryId,
    dropshippingEnabled: product.dropshippingEnabled,
  })),
  nonPublicProducts: nonPublicProducts.map((product) => ({
    origin: product.origin,
    slug: product.slug,
    name: product.name,
    status: product.status,
    categoryId: product.categoryId,
    dropshippingEnabled: product.dropshippingEnabled,
  })),
  sources: {
    productPagePath: relativePath(productPagePath),
    sitemapPath: relativePath(sitemapPath),
    robotsPath: relativePath(robotsPath),
    catalogPath: relativePath(catalogPath),
    quickProductsPath: relativePath(quickProductsPath),
  },
  safety: {
    readOnly: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noMessageSent: true,
  },
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `AUDIT_SEO_HOLD_VISIBILITY_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_SEO_HOLD_VISIBILITY_${dateKey}.md`);
const csvPath = path.join(outputDir, `AUDIT_SEO_HOLD_VISIBILITY_${dateKey}.csv`);

summary.files = {
  json: relativePath(jsonPath),
  md: relativePath(mdPath),
  csv: relativePath(csvPath),
};

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      status: summary.status,
      totalProductCount: summary.totalProductCount,
      publicProductCount: summary.publicProductCount,
      nonPublicProductCount: summary.nonPublicProductCount,
      failureCount: summary.failureCount,
      files: summary.files,
      safety: summary.safety,
    },
    null,
    2,
  ),
);

if (!summary.ok) {
  process.exitCode = 1;
}

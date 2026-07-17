import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const catalogPath = path.join(root, "src", "lib", "catalog.ts");
const catalogServerPath = path.join(root, "src", "lib", "catalog-server.ts");
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

const surpriseCategoryIds = new Set([
  "colis-surprise-palettes",
  "palettes-destockage",
  "colis-mysteres",
  "colis-au-poids",
  "colis-surprise",
  "lots-bonnes-affaires",
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

function hasHoldOrManualCheckSignal(value) {
  const normalized = normalizeText(value);

  return [
    "hold",
    "a verifier",
    "verifier avant",
    "a confirmer",
    "confirmer avant",
    "obligatoire",
    "manquant",
    "missing",
    "avant publication",
    "avant vente",
  ].some((signal) => normalized.includes(signal));
}

function hasExactSupplierUrl(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return false;
  }

  return !(
    normalized.includes("wholesale?") ||
    normalized.includes("searchtext=") ||
    normalized.includes("/w/wholesale-")
  );
}

function hasReadyStatus(value) {
  const normalized = normalizeText(value);
  const statusParts = normalized.split(/[^a-z0-9]+/).filter(Boolean);

  if (
    !normalized ||
    hasHoldOrManualCheckSignal(normalized) ||
    ["not", "non", "pas", "pending", "ko", "incomplete", "blocked", "refused", "invalid"].some(
      (status) => statusParts.includes(status),
    )
  ) {
    return false;
  }

  return ["ok", "ready", "verified", "validated", "valide"].some((status) =>
    statusParts.includes(status),
  );
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

function numberProp(block, prop) {
  const match = block.match(new RegExp(`${prop}:\\s*(\\d+)`));
  return match ? Number(match[1]) : 0;
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

function arrayStringsProp(block, prop) {
  const marker = `${prop}:`;
  const markerIndex = block.indexOf(marker);
  if (markerIndex === -1) return [];
  const arrayStart = block.indexOf("[", markerIndex);
  if (arrayStart === -1) return [];
  const arrayEnd = findMatching(block, arrayStart, "[", "]");
  const arrayBlock = block.slice(arrayStart, arrayEnd + 1);
  return [...arrayBlock.matchAll(/["'`]([^"'`]+)["'`]/g)].map((match) => match[1]);
}

function hasNestedDropshippingEnabled(block) {
  return /dropshipping:\s*{[\s\S]*?enabled:\s*true/.test(block);
}

function staticProductsFromCatalog() {
  const source = readFile(catalogPath);
  const productsArray = extractConstArray(source, "export const products");
  return extractTopLevelObjects(productsArray).map((block) => {
    const dropshipping = nestedBlock(block, "dropshipping");
    const validationGate = nestedBlock(dropshipping, "validationGate");
    const imageValidation = nestedBlock(block, "imageValidation");
    const sourceVerification = nestedBlock(block, "sourceVerification");
    const internalSourcing = nestedBlock(block, "internalSourcing");
    return {
      id: stringProp(block, "id"),
      slug: stringProp(block, "slug"),
      name: stringProp(block, "name"),
      categoryId: stringProp(block, "categoryId"),
      status: stringProp(block, "status") || "published",
      commerceStatus: stringProp(block, "commerceStatus"),
      condition: stringProp(block, "condition"),
      badge: stringProp(block, "badge"),
      shortDescription: stringProp(block, "shortDescription"),
      description: stringProp(block, "description"),
      features: arrayStringsProp(block, "features"),
      stock: numberProp(block, "stock"),
      isTestProduct: booleanProp(block, "isTestProduct"),
      dropshippingEnabled: hasNestedDropshippingEnabled(block),
      supplierUrl: stringProp(dropshipping, "supplierUrl"),
      supplierSku: stringProp(dropshipping, "supplierSku"),
      supplierPriceCents: numberProp(dropshipping, "supplierPriceCents"),
      salePriceCents: numberProp(dropshipping, "salePriceCents"),
      marginCents: numberProp(dropshipping, "marginCents"),
      supplierStock: numberProp(dropshipping, "supplierStock"),
      deliveryEstimate: stringProp(dropshipping, "deliveryEstimate"),
      validationGateNote: stringProp(validationGate, "note"),
      validationGateChecks: arrayStringsProp(validationGate, "checks"),
      imageValidationStatus: stringProp(imageValidation, "status"),
      sourceDeliveryStatus: stringProp(sourceVerification, "deliveryStatus"),
      sourcePriceStatus: stringProp(sourceVerification, "priceStatus"),
      sourceRightsStatus: stringProp(sourceVerification, "rightsStatus"),
      internalValidationStatus: stringProp(internalSourcing, "validationStatus"),
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
    commerceStatus: product.commerceStatus ?? "",
    condition: product.condition ?? "",
    badge: product.badge ?? "",
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    features: Array.isArray(product.features) ? product.features : [],
    stock: Number(product.stock ?? 0),
    isTestProduct: Boolean(product.isTestProduct),
    dropshippingEnabled: Boolean(product.dropshipping?.enabled),
    supplierUrl: product.dropshipping?.supplierUrl ?? "",
    supplierSku: product.dropshipping?.supplierSku ?? "",
    supplierPriceCents: Number(product.dropshipping?.supplierPriceCents ?? 0),
    salePriceCents: Number(product.dropshipping?.salePriceCents ?? 0),
    marginCents: Number(product.dropshipping?.marginCents ?? 0),
    supplierStock: Number(product.dropshipping?.supplierStock ?? 0),
    deliveryEstimate: product.dropshipping?.deliveryEstimate ?? "",
    validationGateNote: product.dropshipping?.validationGate?.note ?? "",
    validationGateChecks: Array.isArray(product.dropshipping?.validationGate?.checks)
      ? product.dropshipping.validationGate.checks
      : [],
    imageValidationStatus: product.imageValidation?.status ?? "",
    sourceDeliveryStatus: product.sourceVerification?.deliveryStatus ?? "",
    sourcePriceStatus: product.sourceVerification?.priceStatus ?? "",
    sourceRightsStatus: product.sourceVerification?.rightsStatus ?? "",
    internalValidationStatus: product.internalSourcing?.validationStatus ?? "",
    origin: "data/quick-products.json",
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

  return [
    "palette surprise",
    "palette mystere",
    "colis surprise",
    "colis mystere",
    "box mystere",
    "mystery box",
    "colis perdu",
  ].some((keyword) => text.includes(normalizeText(keyword)));
}

function publicReadinessBlockers(product) {
  const blockers = [];

  if (!product.dropshippingEnabled) {
    blockers.push("dropshipping_disabled");
    return blockers;
  }

  if (!hasExactSupplierUrl(product.supplierUrl)) blockers.push("supplier_url_exact_missing");
  if (!product.supplierSku) blockers.push("supplier_sku_missing");
  if (!(product.supplierPriceCents > 0)) blockers.push("supplier_price_missing");
  if (!(product.salePriceCents > 0)) blockers.push("sale_price_missing");
  if (!(product.marginCents > 0)) blockers.push("margin_missing");
  if (!(product.supplierStock > 0)) blockers.push("supplier_stock_missing");
  if (!product.deliveryEstimate || hasHoldOrManualCheckSignal(product.deliveryEstimate)) {
    blockers.push("delivery_estimate_not_ready");
  }
  if (product.imageValidationStatus !== "verified_source_images") {
    blockers.push("exact_images_not_verified");
  }
  if (!product.sourceRightsStatus || !hasReadyStatus(product.sourceRightsStatus)) {
    blockers.push("image_rights_not_ready");
  }
  if (!product.sourcePriceStatus || !hasReadyStatus(product.sourcePriceStatus)) {
    blockers.push("source_price_not_ready");
  }
  if (!product.sourceDeliveryStatus || !hasReadyStatus(product.sourceDeliveryStatus)) {
    blockers.push("source_delivery_not_ready");
  }
  if (!product.validationGateNote && product.validationGateChecks.length === 0) {
    blockers.push("validation_gate_missing");
  }
  if (
    hasHoldOrManualCheckSignal(product.validationGateNote) ||
    hasHoldOrManualCheckSignal(product.validationGateChecks.join(" "))
  ) {
    blockers.push("validation_gate_not_ready");
  }
  if (hasHoldOrManualCheckSignal(product.internalValidationStatus)) {
    blockers.push("internal_sourcing_hold");
  }
  if (isComingSoon(product)) blockers.push("coming_soon");

  return Array.from(new Set(blockers));
}

function isPublicProduct(product) {
  return (
    product.status === "published" &&
    !product.isTestProduct &&
    product.dropshippingEnabled &&
    dropshippingFocusCategoryIds.has(product.categoryId) &&
    !hiddenPublicCategoryIds.has(product.categoryId) &&
    publicReadinessBlockers(product).length === 0
  );
}

function sourceChecks({ catalogSource, catalogServer, productPage, sitemap, robots }) {
  const serverLookupUsesPublicGate =
    catalogServer.includes("getPublicCatalogProductBySlug") &&
    (catalogServer.includes("return product && isPublicProduct(product) ? product : undefined") ||
      (catalogServer.includes("return product && (await isServerPublicProduct(product)) ? product : undefined") &&
        catalogServer.includes("return isPublicProduct(product)") &&
        catalogServer.includes("getPublicImageFileBlockers(product)")));
  const staticParamsUsePublicProducts =
    productPage.includes("const publicProducts = await getPublicProducts()") &&
    /return\s+publicProducts\.map\(\(product\)/.test(productPage);

  const checks = [
    {
      id: "catalog_public_filter_uses_readiness_gate",
      ok:
        catalogSource.includes("isDropshippingProductReadyForPublic(product)") &&
        catalogSource.includes("getDropshippingPublicBlockers(product)"),
      failure: "Le filtre public du catalogue doit garder le verrou readiness dropshipping strict.",
    },
    {
      id: "catalog_server_public_lookup_reuses_is_public_product",
      ok: serverLookupUsesPublicGate,
      failure: "Le lookup public par slug doit repasser par isPublicProduct avant de servir une fiche.",
    },
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
      ok:
        (productPage.includes(".filter(isPublicProduct)") && !/return\s+products\.map/.test(productPage)) ||
        staticParamsUsePublicProducts,
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
      `| ${mdCell(product.origin)} | ${mdCell(product.slug)} | ${mdCell(product.status)} | ${mdCell(product.categoryId)} | ${product.dropshippingEnabled ? "oui" : "non"} | ${product.routeShielded ? "oui" : "non"} | ${mdCell(product.publicReadinessBlockers.join(", "))} |`,
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
    `- Slugs publies mais blindes en route publique: ${summary.routeShieldedProductCount}`,
    `- Fiches publiees bloquees par readiness: ${summary.readinessBlockedProductCount}`,
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
    "| Source | Slug | Statut | Categorie | Dropshipping | Route 404/noindex | Blockers readiness |",
    "|---|---|---|---|---|---|---|",
    ...holdRows,
    "",
    "## Sources",
    "",
    ...Object.values(summary.sources).map((sourcePath) => `- ${sourcePath}`),
    "",
  ].join("\n")}\n`;
}

function csv(summary) {
  const rows = summary.nonPublicProducts.map((product) => ({
    ...product,
    publicReadinessBlockers: product.publicReadinessBlockers.join("; "),
  }));
  const headers = [
    "origin",
    "slug",
    "status",
    "categoryId",
    "dropshippingEnabled",
    "routeShielded",
    "publicReadinessBlockers",
    "name",
  ];
  return `${headers.join(",")}\n${rows
    .map((product) =>
      headers
        .map((header) => `"${String(product[header] ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const catalogSource = readFile(catalogPath);
const catalogServer = readFile(catalogServerPath);
const productPage = readFile(productPagePath);
const sitemap = readFile(sitemapPath);
const robots = readFile(robotsPath);
const allProducts = [...staticProductsFromCatalog(), ...quickProductsFromData()];
const publicProducts = allProducts.filter(isPublicProduct);
const nonPublicProducts = allProducts.filter((product) => !isPublicProduct(product));
const routeShieldedProducts = nonPublicProducts.filter(
  (product) => product.slug && product.status === "published",
);
const readinessBlockedProducts = allProducts
  .map((product) => ({
    ...product,
    publicReadinessBlockers: publicReadinessBlockers(product),
  }))
  .filter(
    (product) =>
      product.status === "published" &&
      product.dropshippingEnabled &&
      dropshippingFocusCategoryIds.has(product.categoryId) &&
      product.publicReadinessBlockers.length > 0,
  );
const checks = sourceChecks({ catalogSource, catalogServer, productPage, sitemap, robots });
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
  routeShieldedProductCount: routeShieldedProducts.length,
  readinessBlockedProductCount: readinessBlockedProducts.length,
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
    routeShielded: product.status === "published",
    publicReadinessBlockers: publicReadinessBlockers(product),
  })),
  routeShieldedProducts: routeShieldedProducts.slice(0, 60).map((product) => ({
    origin: product.origin,
    slug: product.slug,
    status: product.status,
    categoryId: product.categoryId,
    publicReadinessBlockers: publicReadinessBlockers(product),
  })),
  readinessBlockedProducts: readinessBlockedProducts.slice(0, 60).map((product) => ({
    origin: product.origin,
    slug: product.slug,
    status: product.status,
    categoryId: product.categoryId,
    publicReadinessBlockers: product.publicReadinessBlockers,
  })),
  sources: {
    catalogServerPath: relativePath(catalogServerPath),
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
      routeShieldedProductCount: summary.routeShieldedProductCount,
      readinessBlockedProductCount: summary.readinessBlockedProductCount,
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

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const catalogPath = path.join(root, "src", "lib", "catalog.ts");
const quickProductsPath = path.join(root, "data", "quick-products.json");
const outputDir = path.join(root, "business-maxi-trouvailles", "file-validation-fournisseurs");

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(readFile(filePath));
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
  const source = readFile(catalogPath);
  const arraySource = extractProductsArray(source);
  const blocks = extractTopLevelObjects(arraySource);

  return blocks.map((block) => ({
    origin: "src/lib/catalog.ts",
    id: stringProp(block, "id"),
    slug: stringProp(block, "slug"),
    name: stringProp(block, "name"),
    categoryId: stringProp(block, "categoryId"),
    status: stringProp(block, "status") || "published",
    stock: numberProp(block, "stock"),
    image: stringProp(block, "image"),
    dropshipping: {
      enabled: /dropshipping:\s*{[\s\S]*?enabled:\s*true/.test(block),
      supplierUrl: stringProp(block, "supplierUrl"),
      supplierSku: stringProp(block, "supplierSku"),
      supplierPriceCents: numberProp(block, "supplierPriceCents"),
      deliveryEstimate: stringProp(block, "deliveryEstimate"),
      validationGate: /validationGate:\s*{/.test(block)
        ? {
            note: stringProp(block, "note"),
          }
        : undefined,
    },
    imageValidation: undefined,
    internalSourcing: undefined,
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
    stock: Number(product.stock ?? 0),
    image: product.image ?? "",
    dropshipping: product.dropshipping ?? {},
    imageValidation: product.imageValidation,
    internalSourcing: product.internalSourcing,
  }));
}

function isPartnerProduct(product) {
  return Boolean(
    product.dropshipping?.enabled ||
      String(product.categoryId ?? "").startsWith("dropshipping-"),
  );
}

function includesHold(value) {
  return normalizeText(value).includes("hold");
}

function hasHoldSignal(product) {
  return Boolean(
    includesHold(product.internalSourcing?.validationStatus) ||
      includesHold(product.dropshipping?.validationGate?.note),
  );
}

function needsManualCheck(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return true;
  }

  return (
    normalized.includes("a verifier") ||
    normalized.includes("a confirmer") ||
    normalized.includes("estime") ||
    normalized.includes("estimated")
  );
}

function hasExactSupplierUrl(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return false;
  }

  if (
    normalized.includes("wholesale?") ||
    normalized.includes("searchtext=") ||
    normalized.includes("/w/wholesale-")
  ) {
    return false;
  }

  return true;
}

function auditProduct(product) {
  const problems = [];
  const warnings = [];
  const status = product.status ?? "published";
  const dropshipping = product.dropshipping ?? {};

  if (status === "published" && hasHoldSignal(product)) {
    problems.push("published_malgre_signal_hold");
  }

  if (status === "published" && product.imageValidation?.status !== "verified_source_images") {
    problems.push("published_sans_images_verifiees");
  }

  if (status === "published" && !hasExactSupplierUrl(dropshipping.supplierUrl)) {
    problems.push("published_sans_lien_fournisseur_exact");
  }

  if (status === "published" && !dropshipping.supplierSku) {
    problems.push("published_sans_sku_fournisseur");
  }

  if (status === "published" && !(dropshipping.supplierPriceCents > 0)) {
    problems.push("published_sans_prix_fournisseur");
  }

  if (status === "published" && needsManualCheck(dropshipping.deliveryEstimate)) {
    problems.push("published_avec_delai_a_verifier");
  }

  if (status === "published" && !dropshipping.validationGate) {
    problems.push("published_sans_gate_validation");
  }

  if (status === "draft" && !hasHoldSignal(product)) {
    warnings.push("draft_sans_signal_hold");
  }

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    origin: product.origin,
    status,
    categoryId: product.categoryId,
    supplierUrlPresent: Boolean(dropshipping.supplierUrl),
    supplierUrlExactEnough: hasExactSupplierUrl(dropshipping.supplierUrl),
    supplierSkuPresent: Boolean(dropshipping.supplierSku),
    supplierPricePresent: Boolean(dropshipping.supplierPriceCents > 0),
    deliveryEstimate: dropshipping.deliveryEstimate ?? "",
    imageValidation: product.imageValidation?.status ?? "absent",
    validationGatePresent: Boolean(dropshipping.validationGate),
    holdSignalPresent: hasHoldSignal(product),
    problems,
    warnings,
  };
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
    "# Audit all partner publication gates",
    "",
    `Date: ${summary.checkedAt}`,
    "",
    `Status: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "## Summary",
    "",
    `- Partner products analyzed: ${summary.partnerProductCount}`,
    `- Published partner products: ${summary.publishedPartnerCount}`,
    `- Draft/HOLD partner products: ${summary.draftHoldCount}`,
    `- Failure count: ${summary.failureCount}`,
    `- Warning count: ${summary.warningCount}`,
    "",
    "## Failures",
    "",
    ...(summary.failures.length
      ? summary.failures.map(
          (failure) =>
            `- ${failure.name} (${failure.origin}) - ${failure.problems.join(", ")}`,
        )
      : ["- Aucun"]),
    "",
    "## Warnings",
    "",
    ...(summary.warnings.length
      ? summary.warnings.map(
          (warning) =>
            `- ${warning.name} (${warning.origin}) - ${warning.warnings.join(", ")}`,
        )
      : ["- Aucun"]),
    "",
    "## Counts",
    "",
    `- By origin: ${JSON.stringify(summary.byOrigin)}`,
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

const products = [...staticProductsFromCatalog(), ...quickProductsFromData()];
const partnerProducts = products.filter(isPartnerProduct);
const auditedProducts = partnerProducts.map(auditProduct);
const failures = auditedProducts.filter((product) => product.problems.length > 0);
const warnings = auditedProducts.filter((product) => product.warnings.length > 0);
const checkedAt = new Date().toISOString();
const dateKey = checkedAt.slice(0, 10).replace(/-/g, "");
const summary = {
  ok: failures.length === 0,
  checkedAt,
  mode: "read_only_all_partner_publication_gate_audit",
  partnerProductCount: partnerProducts.length,
  publishedPartnerCount: auditedProducts.filter((product) => product.status === "published").length,
  draftHoldCount: auditedProducts.filter(
    (product) => product.status === "draft" && product.holdSignalPresent,
  ).length,
  failureCount: failures.length,
  warningCount: warnings.length,
  failures,
  warnings,
  auditedProducts,
  byOrigin: countBy(auditedProducts, (product) => product.origin),
  byStatus: countBy(auditedProducts, (product) => product.status),
  byCategory: countBy(auditedProducts, (product) => product.categoryId),
  safety: {
    readOnlyAudit: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `AUDIT_ALL_PARTNER_GATES_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_ALL_PARTNER_GATES_${dateKey}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      partnerProductCount: summary.partnerProductCount,
      publishedPartnerCount: summary.publishedPartnerCount,
      draftHoldCount: summary.draftHoldCount,
      failureCount: summary.failureCount,
      warningCount: summary.warningCount,
      failures: summary.failures.map((product) => ({
        id: product.id,
        name: product.name,
        origin: product.origin,
        problems: product.problems,
      })),
      warnings: summary.warnings.map((product) => ({
        id: product.id,
        name: product.name,
        origin: product.origin,
        warnings: product.warnings,
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

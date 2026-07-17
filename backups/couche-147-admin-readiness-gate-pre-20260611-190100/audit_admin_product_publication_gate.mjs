import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const routePath = path.join(root, "src", "app", "api", "admin", "products", "[slug]", "route.ts");
const quickProductsPath = path.join(root, "data", "quick-products.json");
const outputDir = path.join(root, "business-maxi-trouvailles", "file-validation-fournisseurs");

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

function includesHold(value) {
  return normalizeText(value).includes("hold");
}

function needsManualCheck(value) {
  const normalized = normalizeText(value);
  return (
    !normalized ||
    normalized.includes("a verifier") ||
    normalized.includes("a confirmer") ||
    normalized.includes("estime") ||
    normalized.includes("estimated")
  );
}

function hasExactSupplierUrl(value) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return !(
    normalized.includes("wholesale?") ||
    normalized.includes("searchtext=") ||
    normalized.includes("/w/wholesale-")
  );
}

function isPartnerProduct(product) {
  return Boolean(
    product.dropshipping?.enabled ||
      product.categoryId === "dropshipping" ||
      String(product.categoryId ?? "").startsWith("dropshipping-"),
  );
}

function productBlockers(product) {
  if ((product.status ?? "published") !== "published" || !isPartnerProduct(product)) {
    return [];
  }

  const dropshipping = product.dropshipping ?? {};
  const blockers = [];

  if (
    includesHold(product.internalSourcing?.validationStatus) ||
    includesHold(dropshipping.validationGate?.note)
  ) {
    blockers.push("signal_hold_present");
  }

  if (product.imageValidation?.status !== "verified_source_images") {
    blockers.push("images_not_verified");
  }

  if (!hasExactSupplierUrl(dropshipping.supplierUrl)) {
    blockers.push("supplier_url_not_exact");
  }

  if (!dropshipping.supplierSku) {
    blockers.push("supplier_sku_missing");
  }

  if (!(dropshipping.supplierPriceCents > 0)) {
    blockers.push("supplier_price_missing");
  }

  if (!(dropshipping.supplierStock > 0)) {
    blockers.push("supplier_stock_missing");
  }

  if (needsManualCheck(dropshipping.deliveryEstimate)) {
    blockers.push("delivery_estimate_needs_check");
  }

  if (!dropshipping.validationGate) {
    blockers.push("validation_gate_missing");
  }

  return blockers;
}

function sourceChecks(routeSource) {
  const checks = [
    {
      id: "guard_function_present",
      ok: routeSource.includes("function getPartnerPublicationBlockers"),
      failure: "La fonction getPartnerPublicationBlockers doit exister dans la route admin produit.",
    },
    {
      id: "guard_blocks_before_write",
      ok:
        routeSource.indexOf("const publicationBlockers = getPartnerPublicationBlockers(updatedProduct)") >
          routeSource.indexOf("const updatedProduct: Product =") &&
        routeSource.indexOf("const updatedProducts = [...quickProducts]") >
          routeSource.indexOf("publicationBlockers.length > 0"),
      failure: "Le blocage publication doit arriver apres construction produit et avant ecriture JSON.",
    },
    {
      id: "guard_returns_400",
      ok:
        routeSource.includes("Publication bloquee") &&
        routeSource.includes("{ status: 400 }"),
      failure: "La route doit refuser la publication incomplete avec un HTTP 400.",
    },
    {
      id: "image_gate_checked",
      ok: routeSource.includes("verified_source_images"),
      failure: "La publication doit verifier les images exactes.",
    },
    {
      id: "supplier_gate_checked",
      ok:
        routeSource.includes("supplierUrl") &&
        routeSource.includes("supplierSku") &&
        routeSource.includes("supplierPriceCents") &&
        routeSource.includes("supplierStock") &&
        routeSource.includes("validationGate"),
      failure: "La publication doit verifier fournisseur, SKU, prix, stock et gate de validation.",
    },
  ];

  return checks.map((check) => ({ ...check, status: check.ok ? "OK" : "FAILURE" }));
}

function markdown(summary) {
  const checkRows = summary.sourceChecks.map(
    (check) => `| ${check.id} | ${check.status} | ${check.failure} |`,
  );
  const riskRows = summary.riskProducts.map(
    (product) => `| ${product.slug} | ${product.status} | ${product.blockers.join(", ")} |`,
  );

  return `${[
    "# Maxi Trouvailles - Audit garde publication admin",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Checks code: ${summary.sourceCheckCount}`,
    `- Echecs code: ${summary.sourceFailureCount}`,
    `- Produits rapides partenaires publies a risque: ${summary.riskProductCount}`,
    "- Publication automatique: aucune.",
    "- Paiement/commande fournisseur: aucun.",
    "",
    "## Checks route admin",
    "",
    "| Controle | Statut | Blocage si KO |",
    "|---|---|---|",
    ...checkRows,
    "",
    "## Produits a risque",
    "",
    riskRows.length ? "| Slug | Statut | Blocages |" : "Aucun produit rapide partenaire publie a risque.",
    riskRows.length ? "|---|---|---|" : "",
    ...riskRows,
    "",
    "## Sources",
    "",
    `- Route: ${summary.sources.routePath}`,
    `- Produits rapides: ${summary.sources.quickProductsPath}`,
    "",
  ].join("\n")}\n`;
}

const routeSource = readFile(routePath);
const products = readJson(quickProductsPath, []);
if (!Array.isArray(products)) {
  throw new Error("data/quick-products.json must contain an array.");
}

const checks = sourceChecks(routeSource);
const sourceFailures = checks.filter((check) => !check.ok);
const riskProducts = products
  .map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    status: product.status ?? "published",
    blockers: productBlockers(product),
  }))
  .filter((product) => product.blockers.length > 0);
const { dateKey, localLabel } = datePartsParis();
const summary = {
  ok: sourceFailures.length === 0 && riskProducts.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_admin_product_publication_gate_audit",
  status:
    sourceFailures.length === 0 && riskProducts.length === 0
      ? "OK_ADMIN_PUBLICATION_GATE_ACTIVE"
      : "ADMIN_PUBLICATION_GATE_FAILURE",
  sourceCheckCount: checks.length,
  sourceFailureCount: sourceFailures.length,
  riskProductCount: riskProducts.length,
  sourceChecks: checks,
  sourceFailures,
  riskProducts,
  sources: {
    routePath: relativePath(routePath),
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
const jsonPath = path.join(outputDir, `AUDIT_ADMIN_PUBLICATION_GATE_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_ADMIN_PUBLICATION_GATE_${dateKey}.md`);

summary.files = {
  json: relativePath(jsonPath),
  md: relativePath(mdPath),
};

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      status: summary.status,
      sourceCheckCount: summary.sourceCheckCount,
      sourceFailureCount: summary.sourceFailureCount,
      riskProductCount: summary.riskProductCount,
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

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "src", "lib", "quick-products.ts");
const quickProductsPath = path.join(root, "data", "quick-products.json");
const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const outputDir = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  `audit-garde-ajout-rapide-hold-${dateStamp}`,
);

function readFile(filePath, fallback = "") {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return fallback;
  }
}

function readJson(filePath, fallback) {
  const content = readFile(filePath);
  return content ? JSON.parse(content) : fallback;
}

function normalizeStatus(value) {
  return typeof value === "string" && value.length > 0 ? value : "missing";
}

function lineNumber(source, needle) {
  const index = source.indexOf(needle);
  if (index === -1) {
    return null;
  }

  return source.slice(0, index).split(/\r?\n/).length;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

const source = readFile(sourcePath);
const quickProducts = readJson(quickProductsPath, []);
const sourceFailures = [];

const draftCreateNeedle = 'status: "draft"';
if (!source.includes(draftCreateNeedle)) {
  sourceFailures.push({
    code: "quick_create_not_draft",
    message: "createQuickProduct ne force pas le statut draft.",
    file: path.relative(root, sourcePath),
    line: null,
  });
}

const holdFeatureNeedle =
  "HOLD: image exacte, fournisseur, prix, stock, delai et validation humaine a verifier avant publication";
if (!source.includes(holdFeatureNeedle)) {
  sourceFailures.push({
    code: "quick_create_missing_hold_note",
    message: "La fiche rapide ne porte pas la note HOLD dans ses caracteristiques.",
    file: path.relative(root, sourcePath),
    line: null,
  });
}

const invalidFallbackNeedle = ': "published"';
const statusFallbackIndex = source.indexOf(invalidFallbackNeedle, source.indexOf("const status ="));
if (statusFallbackIndex !== -1) {
  sourceFailures.push({
    code: "sanitize_fallback_published",
    message: "sanitizeQuickProducts peut encore retomber sur published.",
    file: path.relative(root, sourcePath),
    line: lineNumber(source, invalidFallbackNeedle),
  });
}

const publishedProducts = quickProducts
  .filter((product) => product?.status === "published")
  .map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    categoryId: product.categoryId,
    image: product.image,
    dropshipping: Boolean(product.dropshipping?.enabled),
  }));

const missingStatusProducts = quickProducts
  .filter((product) => !product || typeof product !== "object" || !("status" in product))
  .map((product) => ({
    id: product?.id ?? "unknown",
    slug: product?.slug ?? "unknown",
    name: product?.name ?? "unknown",
    categoryId: product?.categoryId ?? "unknown",
  }));

const statusCounts = quickProducts.reduce((acc, product) => {
  const status = normalizeStatus(product?.status);
  acc[status] = (acc[status] ?? 0) + 1;
  return acc;
}, {});

const failures = [
  ...sourceFailures,
  ...publishedProducts.map((product) => ({
    code: "quick_product_published",
    message: "Une fiche rapide est publiee alors que le flux rapide doit rester en HOLD.",
    product,
  })),
  ...missingStatusProducts.map((product) => ({
    code: "quick_product_missing_status",
    message: "Une fiche rapide sans statut explicite serait normalisee en draft.",
    product,
  })),
];

const result = {
  ok: failures.length === 0,
  status:
    failures.length === 0
      ? "OK_QUICK_PRODUCT_HOLD_GUARD_ACTIVE"
      : "HOLD_QUICK_PRODUCT_GUARD_FAILURE",
  generatedAtLocal: new Date().toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    hour12: false,
  }),
  source: {
    path: path.relative(root, sourcePath),
    createDraftLine: lineNumber(source, draftCreateNeedle),
    holdNoteLine: lineNumber(source, holdFeatureNeedle),
  },
  metrics: {
    quickProductCount: quickProducts.length,
    publishedQuickProductCount: publishedProducts.length,
    missingStatusCount: missingStatusProducts.length,
    statusCounts,
  },
  failures,
  safety: {
    readOnly: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

const jsonPath = path.join(outputDir, `AUDIT_GARDE_AJOUT_RAPIDE_HOLD_${dateStamp}.json`);
const mdPath = path.join(outputDir, `AUDIT_GARDE_AJOUT_RAPIDE_HOLD_${dateStamp}.md`);

writeJson(jsonPath, result);
writeText(
  mdPath,
  [
    "# Audit garde ajout rapide HOLD",
    "",
    `Date locale: ${result.generatedAtLocal}`,
    `Statut: ${result.status}`,
    "",
    "## Mesures",
    "",
    `- Fiches rapides: ${result.metrics.quickProductCount}`,
    `- Fiches rapides publiees: ${result.metrics.publishedQuickProductCount}`,
    `- Fiches sans statut: ${result.metrics.missingStatusCount}`,
    `- Ligne statut draft: ${result.source.createDraftLine ?? "absente"}`,
    `- Ligne note HOLD: ${result.source.holdNoteLine ?? "absente"}`,
    "",
    "## Echecs",
    "",
    failures.length === 0
      ? "- Aucun echec."
      : failures.map((failure) => `- ${failure.code}: ${failure.message}`).join("\n"),
    "",
    "## Securite",
    "",
    "- Lecture seule.",
    "- Aucune publication.",
    "- Aucun paiement.",
    "- Aucune commande fournisseur.",
    "",
  ].join("\n"),
);

console.log(
  JSON.stringify(
    {
      ok: result.ok,
      status: result.status,
      metrics: result.metrics,
      files: {
        jsonPath,
        mdPath,
      },
      safety: result.safety,
    },
    null,
    2,
  ),
);

if (!result.ok) {
  process.exitCode = 1;
}

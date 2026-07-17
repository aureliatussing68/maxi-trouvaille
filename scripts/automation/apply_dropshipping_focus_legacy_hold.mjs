import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const quickProductsPath = path.join(root, "data", "quick-products.json");
const businessDir = path.join(root, "business-maxi-trouvailles");
const supplierDir = path.join(businessDir, "file-validation-fournisseurs");
const actionRoot = path.join(businessDir, "tableaux-action");
const backupRoot = path.join(root, "backups");

function datePartsParis(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dateKey: `${byType.year}${byType.month}${byType.day}`,
    stamp: `${byType.year}${byType.month}${byType.day}-${byType.hour}${byType.minute}${byType.second}`,
    localLabel: `${byType.year}-${byType.month}-${byType.day} ${byType.hour}:${byType.minute} Europe/Paris`,
  };
}

function collectFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, predicate, out);
    } else if (predicate(entry.name, fullPath)) {
      out.push(fullPath);
    }
  }
  return out;
}

function latestFileUnder(dir, prefix) {
  const matches = collectFiles(dir, (name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  const todayKey = datePartsParis().dateKey;
  return matches.find((match) => match.fullPath.includes(todayKey))?.fullPath ?? matches[0]?.fullPath ?? null;
}

function readJson(filePath, fallback = null) {
  if (!filePath || !fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relativePath(filePath) {
  return filePath ? path.relative(root, filePath) : "";
}

function isApplyMode() {
  return process.argv.includes("--apply");
}

function ensureArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  return value;
}

function copyFileWithParents(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function markdown(summary) {
  const rows = summary.items.map(
    (item) =>
      `| ${item.rank} | ${item.name} | ${item.origin} | ${item.categoryId} | ${item.beforeStatus} | ${item.afterStatus} | ${item.action} |`,
  );

  return `${[
    "# Maxi Trouvailles - Suspension focus dropshipping",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Mode: ${summary.applyMode ? "apply" : "dry-run"}`,
    "",
    "## Synthese",
    "",
    `- Produits legacy detectes: ${summary.legacyRiskProductCount}`,
    `- Produits quick-products passes en draft: ${summary.quickProductsMovedToDraftCount}`,
    `- Produits quick-products deja suspendus: ${summary.quickProductsAlreadySuspendedCount}`,
    `- Produits statiques a garder en draft: ${summary.staticLegacyCount}`,
    `- Publication ajoutee: aucune`,
    `- Paiement/commande fournisseur: aucun`,
    "",
    "## Produits traites",
    "",
    "| Rang | Produit | Origine | Categorie | Avant | Apres | Action |",
    "|---:|---|---|---|---|---|---|",
    ...rows,
    "",
    "## Garde-fous",
    "",
    "- Les fiches personnelles, test ou hors dropshipping restent hors parcours client.",
    "- Aucune suppression definitive.",
    "- Aucune publication production.",
    "- Aucun paiement, aucune commande fournisseur, aucun message client.",
    "",
    "## Sources",
    "",
    `- Audit checkout: ${summary.sources.checkoutAuditPath}`,
    `- Backup: ${summary.backupDirRelative || "non cree en dry-run"}`,
    "",
  ].join("\n")}\n`;
}

const applyMode = isApplyMode();
const { dateKey, stamp, localLabel } = datePartsParis();
const checkoutAuditPath = latestFileUnder(supplierDir, "AUDIT_CHECKOUT_ELIGIBILITY_");
const checkoutAudit = readJson(checkoutAuditPath, {});
const legacyRiskProducts = ensureArray(checkoutAudit.legacyRiskProducts ?? [], "legacyRiskProducts");
const quickProducts = ensureArray(readJson(quickProductsPath, []), "quickProducts");
const legacyById = new Map(legacyRiskProducts.map((product) => [product.id, product]));
const quickLegacyIds = new Set(
  legacyRiskProducts
    .filter((product) => product.origin === "data/quick-products.json")
    .map((product) => product.id),
);

let backupDir = "";
let movedCount = 0;
let alreadySuspendedCount = 0;
const touchedItems = [];

const nextQuickProducts = quickProducts.map((product) => {
  if (!quickLegacyIds.has(product.id)) return product;

  const auditProduct = legacyById.get(product.id);
  const beforeStatus = product.status ?? "published";
  const afterStatus = "draft";
  const alreadySuspended = beforeStatus === afterStatus;
  if (alreadySuspended) {
    alreadySuspendedCount += 1;
  } else {
    movedCount += 1;
  }

  touchedItems.push({
    rank: touchedItems.length + 1,
    id: product.id,
    slug: product.slug,
    name: product.name,
    origin: "data/quick-products.json",
    categoryId: product.categoryId,
    beforeStatus,
    afterStatus,
    action: alreadySuspended ? "deja_draft" : applyMode ? "draft_applique" : "draft_a_appliquer",
    reason: "focus_dropshipping_seulement",
    audit: auditProduct,
  });

  return alreadySuspended
    ? product
    : {
        ...product,
        status: afterStatus,
      };
});

for (const product of legacyRiskProducts.filter((item) => item.origin !== "data/quick-products.json")) {
  touchedItems.push({
    rank: touchedItems.length + 1,
    id: product.id,
    slug: product.slug,
    name: product.name,
    origin: product.origin,
    categoryId: product.categoryId,
    beforeStatus: product.status ?? "published",
    afterStatus: "draft",
    action: "verifier_statut_catalogue_statique",
    reason: "focus_dropshipping_seulement",
    audit: product,
  });
}

if (applyMode && movedCount > 0) {
  backupDir = path.join(backupRoot, `dropshipping-focus-hold-${stamp}`);
  copyFileWithParents(
    quickProductsPath,
    path.join(backupDir, "data", "quick-products.json"),
  );
  writeJson(quickProductsPath, nextQuickProducts);
}

const outputDir = path.join(actionRoot, `suspension-legacy-dropshipping-focus-${dateKey}`);
const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "dropshipping_focus_legacy_hold",
  applyMode,
  legacyRiskProductCount: legacyRiskProducts.length,
  quickLegacyProductCount: quickLegacyIds.size,
  quickProductsMovedToDraftCount: applyMode ? movedCount : 0,
  quickProductsWouldMoveToDraftCount: applyMode ? 0 : movedCount,
  quickProductsAlreadySuspendedCount: alreadySuspendedCount,
  staticLegacyCount: legacyRiskProducts.filter((item) => item.origin !== "data/quick-products.json").length,
  items: touchedItems,
  outputDirRelative: relativePath(outputDir),
  backupDirRelative: relativePath(backupDir),
  sources: {
    checkoutAuditPath: relativePath(checkoutAuditPath),
    quickProductsPath: relativePath(quickProductsPath),
  },
  safety: {
    noDeletion: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noMessageSent: true,
    noPublicUploadsWrite: true,
  },
};

const jsonPath = path.join(outputDir, `SUSPENSION_LEGACY_FOCUS_DROPSHIPPING_${dateKey}.json`);
const mdPath = path.join(outputDir, `SUSPENSION_LEGACY_FOCUS_DROPSHIPPING_${dateKey}.md`);
writeJson(jsonPath, summary);
fs.writeFileSync(mdPath, markdown(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      applyMode: summary.applyMode,
      legacyRiskProductCount: summary.legacyRiskProductCount,
      quickProductsMovedToDraftCount: summary.quickProductsMovedToDraftCount,
      quickProductsWouldMoveToDraftCount: summary.quickProductsWouldMoveToDraftCount,
      staticLegacyCount: summary.staticLegacyCount,
      files: {
        jsonPath,
        mdPath,
        backupDir,
      },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

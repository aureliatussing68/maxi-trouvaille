import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessRoot = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessRoot, "tableaux-action");
const microPacksRoot = path.join(actionRoot, "micro-packs-lot-actif-prochaine-vague-sourcing-integration-articles");
const microPacksAuditRoot = path.join(
  actionRoot,
  "audit-micro-packs-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const outputRoot = path.join(
  actionRoot,
  "preuves-internes-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const allowedProofPrefix = "business-maxi-trouvailles/preuves-internes/integration-articles/";

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

function walkFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return [];

  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath, predicate));
      continue;
    }

    if (!predicate || predicate(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function latestFile(dir, pattern, label) {
  const files = walkFiles(dir, (filePath) => pattern.test(filePath));
  if (files.length === 0) {
    throw new Error(`No ${label} found under ${dir}`);
  }

  const todayKey = datePartsParis().dateKey;
  const matches = files
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return matches.find((match) => match.filePath.includes(todayKey))?.filePath ?? matches[0].filePath;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function normalizeRel(value) {
  return String(value ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function resolveInsideRoot(relativePath) {
  const normalized = normalizeRel(relativePath);
  const absolutePath = path.resolve(root, normalized);
  const rootPath = path.resolve(root);
  if (!absolutePath.startsWith(`${rootPath}${path.sep}`)) {
    throw new Error(`Refusing to write outside workspace: ${relativePath}`);
  }

  return absolutePath;
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  if (/[",\n\r;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function addIssue(issues, scope, code, message, details = {}) {
  issues.push({ scope, code, message, ...details });
}

function isSafeProofPath(value, dateKey) {
  const text = normalizeRel(value);
  return (
    text.startsWith(`${allowedProofPrefix}${dateKey}/`) &&
    text.endsWith(".md") &&
    !text.includes("..") &&
    !path.isAbsolute(text)
  );
}

function proofMarkdown({ pack, proof, dateKey }) {
  return `${[
    `# Preuve interne HOLD - ${pack.productName}`,
    "",
    "Statut: TO_FILL_HOLD",
    `Date dossier: ${dateKey}`,
    `Lot: ${pack.batchId}`,
    `Produit: ${pack.productId}`,
    `Slug: ${pack.slug}`,
    `Categorie: ${pack.categoryId}`,
    `Champ: ${proof.label}`,
    `Cle: ${proof.key}`,
    `Format attendu: ${proof.expectedFormat}`,
    `Rejet: ${proof.rejectIf}`,
    "",
    "## Saisie Mouss",
    "",
    "- Valeur interne: A_REMPLIR",
    "- Note preuve locale: A_REMPLIR",
    "- Meme article confirme: A_REMPLIR",
    "- Variante exacte confirmee: A_REMPLIR",
    "- Validation Mouss: A_REMPLIR",
    "- Decision finale: TO_DECIDE_HOLD",
    "",
    "## Garde-fous",
    "",
    "- Ne pas publier.",
    "- Ne pas commander fournisseur.",
    "- Ne pas exposer cette preuve cote client.",
    "- Ne pas remplacer par un produit similaire.",
    "- Ne pas utiliser d'image approximative comme preuve.",
    "- Laisser la fiche en HOLD tant que la validation Mouss manque.",
    "",
  ].join("\n")}\n`;
}

function readmeMarkdown({ pack, proofRows, dateKey }) {
  return `${[
    `# Dossier preuves internes HOLD - ${pack.productName}`,
    "",
    `Statut: HOLD_PROOF_INTAKE_READY`,
    `Date dossier: ${dateKey}`,
    `Lot: ${pack.batchId}`,
    `Produit: ${pack.productId}`,
    `Categorie: ${pack.categoryId}`,
    "",
    "## Fichiers a remplir",
    "",
    "| Ordre | Champ | Fichier | Statut |",
    "|---:|---|---|---|",
    ...proofRows.map(
      (row) => `| ${row.order} | ${mdCell(row.label)} | ${mdCell(row.proofPath)} | ${row.status} |`,
    ),
    "",
    "## Garde-fous",
    "",
    "- Remplir uniquement les fichiers locaux de ce dossier.",
    "- Garder toutes les valeurs fournisseur hors surface client.",
    "- Aucun achat, aucune commande, aucune publication.",
    "- Relancer l'audit preuve avant toute revue Mouss.",
    "",
  ].join("\n")}\n`;
}

function summaryMarkdown(summary) {
  const rows = summary.products.map(
    (product) =>
      `| ${product.rank} | ${mdCell(product.productName)} | ${product.proofFileCount} | ${product.existingProofFileCount} | ${product.createdProofFileCount} | ${mdCell(product.readmePath)} |`,
  );

  return `${[
    "# Preuves internes lot actif prochaine vague",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Lot actif: ${summary.activeBatchId}`,
    `- Produits: ${summary.productCount}`,
    `- Fichiers preuves: ${summary.proofFileCount}/${summary.proofTaskCount}`,
    `- Fichiers crees: ${summary.createdProofFileCount}`,
    `- Fichiers deja presents conserves: ${summary.existingProofFileCount}`,
    `- Fichiers README: ${summary.readmeFileCount}`,
    `- Preuves HOLD a remplir: ${summary.holdProofCount}`,
    "",
    "## Dossiers",
    "",
    "| Rang | Produit | Preuves | Deja presents | Crees | README |",
    "|---:|---|---:|---:|---:|---|",
    ...rows,
    "",
    "## Garde-fous",
    "",
    "- Generation locale non destructive: un fichier preuve deja present est conserve.",
    "- Aucune valeur fournisseur n'est inventee.",
    "- Aucune image n'est creee, telechargee ou copiee.",
    "- Aucune publication, aucun paiement, aucune commande fournisseur.",
    "- Tout reste en HOLD jusqu'a validation humaine Mouss.",
    "",
  ].join("\n")}\n`;
}

function itemsCsv(items) {
  const headers = [
    "product_rank",
    "batch_id",
    "product_id",
    "product_name",
    "category_id",
    "proof_order",
    "proof_key",
    "label",
    "status",
    "proof_path",
    "file_action",
    "expected_format",
    "reject_if",
  ];

  return `${headers.join(";")}\n${items
    .map((item) =>
      [
        item.productRank,
        item.batchId,
        item.productId,
        item.productName,
        item.categoryId,
        item.order,
        item.key,
        item.label,
        item.status,
        item.proofPath,
        item.fileAction,
        item.expectedFormat,
        item.rejectIf,
      ]
        .map(csvEscape)
        .join(";"),
    )
    .join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const microPacksPath = latestFile(
  microPacksRoot,
  /MICRO_PACKS_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch micro packs",
);
const microPacksAuditPath = latestFile(
  microPacksAuditRoot,
  /AUDIT_MICRO_PACKS_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch micro packs audit",
);

const microPacks = readJson(microPacksPath);
const microPacksAudit = readJson(microPacksAuditPath);
const issues = [];

if (microPacks.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_MICRO_PACKS_READY") {
  addIssue(issues, "micro_packs", "micro_pack_status_invalid", "Les micro-packs doivent rester prets en HOLD.", {
    status: microPacks.status,
  });
}

if (microPacksAudit.status !== "OK_NEXT_WAVE_ACTIVE_BATCH_MICRO_PACKS_GUARDED") {
  addIssue(issues, "micro_packs_audit", "micro_pack_audit_not_ok", "L'audit micro-packs doit etre OK avant intake.", {
    status: microPacksAudit.status,
  });
}

const packs = (microPacks.products ?? []).map((product) => {
  const productPath = resolveInsideRoot(product.relativeJsonPath);
  return readJson(productPath);
});

const proofItems = [];
const productSummaries = [];

for (const pack of packs) {
  const proofRows = [];
  let createdProofFileCount = 0;
  let existingProofFileCount = 0;

  for (const proof of pack.proofTasks ?? []) {
    const proofPath = proof.localProofPath;
    if (!isSafeProofPath(proofPath, dateKey)) {
      addIssue(issues, proof.taskId, "proof_path_invalid", "Chemin preuve local invalide.", { proofPath });
      continue;
    }

    const absoluteProofPath = resolveInsideRoot(proofPath);
    fs.mkdirSync(path.dirname(absoluteProofPath), { recursive: true });

    let fileAction = "preserved";
    if (!fs.existsSync(absoluteProofPath)) {
      fs.writeFileSync(absoluteProofPath, proofMarkdown({ pack, proof, dateKey }), "utf8");
      createdProofFileCount += 1;
      fileAction = "created";
    } else {
      existingProofFileCount += 1;
    }

    const row = {
      productRank: pack.rank,
      batchId: pack.batchId,
      productId: pack.productId,
      productName: pack.productName,
      categoryId: pack.categoryId,
      order: proof.order,
      key: proof.key,
      label: proof.label,
      status: "TO_FILL_HOLD",
      proofPath,
      fileAction,
      expectedFormat: proof.expectedFormat,
      rejectIf: proof.rejectIf,
    };
    proofRows.push(row);
    proofItems.push(row);
  }

  const productDir = path.dirname(resolveInsideRoot(proofRows[0]?.proofPath ?? `${allowedProofPrefix}${dateKey}/${pack.slug}/placeholder.md`));
  const readmePath = path.join(productDir, `README_PREUVES_LOT_ACTIF_HOLD_${dateKey}.md`);
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, readmeMarkdown({ pack, proofRows, dateKey }), "utf8");
  }

  productSummaries.push({
    rank: pack.rank,
    batchId: pack.batchId,
    productId: pack.productId,
    slug: pack.slug,
    productName: pack.productName,
    categoryId: pack.categoryId,
    status: "HOLD_PROOF_INTAKE_READY",
    proofTaskCount: pack.proofTaskCount,
    proofFileCount: proofRows.length,
    createdProofFileCount,
    existingProofFileCount,
    readmePath: rel(readmePath),
  });
}

if (packs.length !== 4 || proofItems.length !== 20) {
  addIssue(issues, "proof_intake", "proof_intake_scope_invalid", "L'intake doit couvrir 4 produits et 20 preuves.", {
    productCount: packs.length,
    proofCount: proofItems.length,
  });
}

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: issues.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "local_hold_integration_next_wave_active_batch_proof_intake",
  status: issues.length === 0 ? "HOLD_NEXT_WAVE_ACTIVE_BATCH_PROOF_INTAKE_READY" : "FAIL_NEXT_WAVE_ACTIVE_BATCH_PROOF_INTAKE",
  activeBatchId: microPacks.activeBatchId,
  productCount: packs.length,
  proofTaskCount: proofItems.length,
  proofFileCount: proofItems.filter((item) => fs.existsSync(resolveInsideRoot(item.proofPath))).length,
  createdProofFileCount: proofItems.filter((item) => item.fileAction === "created").length,
  existingProofFileCount: proofItems.filter((item) => item.fileAction === "preserved").length,
  readmeFileCount: productSummaries.filter((product) => fs.existsSync(resolveInsideRoot(product.readmePath))).length,
  holdProofCount: proofItems.filter((item) => item.status === "TO_FILL_HOLD").length,
  filledProofCount: 0,
  structuralFailureCount: issues.length,
  structuralFailures: issues,
  products: productSummaries,
  proofs: proofItems,
  sources: {
    microPacksPath: rel(microPacksPath),
    microPacksAuditPath: rel(microPacksAuditPath),
  },
  safety: {
    localProofTemplatesOnly: true,
    nonDestructiveExistingFiles: true,
    noCatalogWrite: true,
    noSupplierValueExport: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noExternalContact: true,
    noImageDownload: true,
    noImageFileCreated: true,
    noPublicImageWrite: true,
    manualValidationRequired: true,
    microPacksAuditRequired: true,
  },
};

const jsonPath = path.join(outputDir, `PROOF_INTAKE_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `preuves-internes-lot-actif-prochaine-vague-sourcing-${dateKey}.md`);
const csvPath = path.join(outputDir, `preuves-internes-lot-actif-items-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, summaryMarkdown(summary), "utf8");
fs.writeFileSync(csvPath, itemsCsv(proofItems), "utf8");

console.log(
  JSON.stringify(
    {
      status: summary.status,
      ok: summary.ok,
      activeBatchId: summary.activeBatchId,
      productCount: summary.productCount,
      proofTaskCount: summary.proofTaskCount,
      proofFileCount: summary.proofFileCount,
      createdProofFileCount: summary.createdProofFileCount,
      existingProofFileCount: summary.existingProofFileCount,
      outputDir: rel(outputDir),
    },
    null,
    2,
  ),
);

if (!summary.ok) {
  process.exitCode = 1;
}

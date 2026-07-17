import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessRoot = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessRoot, "tableaux-action");
const proofIntakeRoot = path.join(
  actionRoot,
  "preuves-internes-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const webpContractsRoot = path.join(
  actionRoot,
  "contrats-validation-webp-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const moussReviewRoot = path.join(
  actionRoot,
  "revue-mouss-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const moussReviewAuditRoot = path.join(
  actionRoot,
  "audit-revue-mouss-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const outputRoot = path.join(
  actionRoot,
  "pack-saisie-terrain-lot-actif-prochaine-vague-sourcing-integration-articles",
);

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
    if (!predicate || predicate(fullPath)) files.push(fullPath);
  }
  return files;
}

function latestFile(dir, pattern, label) {
  const files = walkFiles(dir, (filePath) => pattern.test(filePath));
  if (files.length === 0) throw new Error(`No ${label} found under ${dir}`);
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

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  if (/[",\n\r;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function addIssue(issues, scope, code, message, details = {}) {
  issues.push({ scope, code, message, ...details });
}

function fieldEntryMarkdown(product) {
  const proofRows = product.entries
    .filter((entry) => entry.entryType === "proof")
    .map(
      (entry) =>
        `| ${entry.order} | ${mdCell(entry.label)} | ${entry.status} | ${mdCell(entry.targetPath)} |`,
    );
  const webpRows = product.entries
    .filter((entry) => entry.entryType === "webp")
    .map(
      (entry) =>
        `| ${entry.order} | ${mdCell(entry.label)} | ${entry.status} | ${mdCell(entry.targetPath)} | ${mdCell(entry.contractPath)} |`,
    );

  return `${[
    `# Saisie terrain HOLD - ${product.productName}`,
    "",
    "Statut: BLOCKED_FIELD_ENTRY_HOLD",
    `Lot: ${product.batchId}`,
    `Produit: ${product.productId}`,
    `Categorie: ${product.categoryId}`,
    "",
    "## Preuves internes",
    "",
    "| Ordre | Champ | Statut | Fichier a remplir |",
    "|---:|---|---|---|",
    ...proofRows,
    "",
    "## WebP exacts",
    "",
    "| Ordre | Image | Statut | Fichier WebP attendu | Contrat |",
    "|---:|---|---|---|---|",
    ...webpRows,
    "",
    "## Sequence de saisie",
    "",
    "1. Remplir les preuves internes dans les fichiers listes.",
    "2. Deposer seulement les vrais WebP exacts dans les chemins listes.",
    "3. Mettre a jour les contrats WebP uniquement quand les preuves et droits image sont confirmes.",
    "4. Relancer les audits avant toute revue Mouss.",
    "",
    "## Garde-fous",
    "",
    "- Garder le produit en HOLD.",
    "- Garder les preuves fournisseur hors surface client.",
    "- Refuser toute image approximative.",
    "- Revue humaine Mouss obligatoire.",
    "",
  ].join("\n")}\n`;
}

function summaryMarkdown(summary) {
  const rows = summary.products.map(
    (product) =>
      `| ${product.rank} | ${mdCell(product.productName)} | ${product.proofEntryCount} | ${product.webpEntryCount} | ${product.blockedEntryCount} | ${mdCell(product.sheetPath)} |`,
  );
  return `${[
    "# Pack saisie terrain lot actif",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Lot actif: ${summary.activeBatchId}`,
    `- Produits: ${summary.productCount}`,
    `- Entrees de saisie: ${summary.entryCount}`,
    `- Preuves internes: ${summary.proofEntryCount}`,
    `- WebP exacts: ${summary.webpEntryCount}`,
    `- Entrees bloquees HOLD: ${summary.blockedEntryCount}`,
    `- Fiches produit terrain: ${summary.productSheetCount}`,
    "",
    "## Produits",
    "",
    "| Rang | Produit | Preuves | WebP | HOLD | Fiche terrain |",
    "|---:|---|---:|---:|---:|---|",
    ...rows,
    "",
    "## Garde-fous",
    "",
    "- Pack de saisie interne uniquement.",
    "- Aucune valeur fournisseur n'est inventee.",
    "- Aucun WebP n'est cree automatiquement.",
    "- Aucun deblocage vente.",
    "",
  ].join("\n")}\n`;
}

function entriesCsv(entries) {
  const headers = [
    "rank",
    "batch_id",
    "product_id",
    "product_name",
    "category_id",
    "entry_type",
    "order",
    "label",
    "status",
    "target_path",
    "contract_path",
    "expected_action",
  ];
  return `${headers.join(";")}\n${entries
    .map((entry) =>
      [
        entry.rank,
        entry.batchId,
        entry.productId,
        entry.productName,
        entry.categoryId,
        entry.entryType,
        entry.order,
        entry.label,
        entry.status,
        entry.targetPath,
        entry.contractPath,
        entry.expectedAction,
      ]
        .map(csvEscape)
        .join(";"),
    )
    .join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const proofIntakePath = latestFile(
  proofIntakeRoot,
  /PROOF_INTAKE_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch proof intake",
);
const webpContractsPath = latestFile(
  webpContractsRoot,
  /WEBP_VALIDATION_CONTRACTS_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch webp validation contracts",
);
const moussReviewPath = latestFile(
  moussReviewRoot,
  /MOUSS_REVIEW_BOARD_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch Mouss review board",
);
const moussReviewAuditPath = latestFile(
  moussReviewAuditRoot,
  /AUDIT_MOUSS_REVIEW_BOARD_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch Mouss review audit",
);

const proofIntake = readJson(proofIntakePath);
const webpContracts = readJson(webpContractsPath);
const moussReview = readJson(moussReviewPath);
const moussReviewAudit = readJson(moussReviewAuditPath);
const issues = [];

if (proofIntake.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_PROOF_INTAKE_READY") {
  addIssue(issues, "proof_intake", "proof_intake_status_invalid", "Les preuves internes doivent etre en HOLD.", {
    status: proofIntake.status,
  });
}
if (webpContracts.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_WEBP_VALIDATION_CONTRACTS_READY") {
  addIssue(issues, "webp_contracts", "webp_contracts_status_invalid", "Les contrats WebP doivent etre en HOLD.", {
    status: webpContracts.status,
  });
}
if (moussReview.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_MOUSS_REVIEW_BOARD_READY") {
  addIssue(issues, "mouss_review", "mouss_review_status_invalid", "Le board Mouss doit etre en HOLD.", {
    status: moussReview.status,
  });
}
if (moussReviewAudit.status !== "OK_NEXT_WAVE_ACTIVE_BATCH_MOUSS_REVIEW_BOARD_GUARDED") {
  addIssue(issues, "mouss_review_audit", "mouss_review_audit_not_ok", "L'audit Mouss doit etre OK.", {
    status: moussReviewAudit.status,
  });
}

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const entries = [];
const products = (moussReview.products ?? []).map((product) => {
  const proofEntries = (proofIntake.proofs ?? [])
    .filter((proof) => proof.productId === product.productId)
    .map((proof) => ({
      rank: product.rank,
      batchId: product.batchId,
      productId: product.productId,
      productName: product.productName,
      categoryId: product.categoryId,
      entryType: "proof",
      order: proof.order,
      label: proof.label,
      status: "TO_FILL_HOLD",
      targetPath: proof.proofPath,
      contractPath: "",
      expectedAction: "Remplir la preuve interne avec valeur locale et decision Mouss.",
    }));
  const webpEntries = (webpContracts.contracts ?? [])
    .filter((contract) => contract.productId === product.productId)
    .map((contract) => ({
      rank: product.rank,
      batchId: product.batchId,
      productId: product.productId,
      productName: product.productName,
      categoryId: product.categoryId,
      entryType: "webp",
      order: contract.imageOrder,
      label: `${contract.imageRole}: ${contract.expectedWebpFileName}`,
      status: "TO_DEPOSIT_HOLD",
      targetPath: contract.targetPath,
      contractPath: contract.contractPath,
      expectedAction: "Deposer un WebP exact local puis relancer les audits.",
    }));
  const productEntries = [...proofEntries, ...webpEntries];
  entries.push(...productEntries);
  const sheetPath = path.join(outputDir, `SAISIE_TERRAIN_${String(product.rank).padStart(2, "0")}_${slugify(product.productName)}.md`);
  const summary = {
    ...product,
    entries: productEntries,
    proofEntryCount: proofEntries.length,
    webpEntryCount: webpEntries.length,
    blockedEntryCount: productEntries.length,
    sheetPath: rel(sheetPath),
  };
  fs.writeFileSync(sheetPath, fieldEntryMarkdown(summary), "utf8");
  return summary;
});

if (products.length !== 4 || entries.length !== 32) {
  addIssue(issues, "field_entry_pack", "field_entry_scope_invalid", "Le pack doit couvrir 4 produits et 32 entrees.", {
    productCount: products.length,
    entryCount: entries.length,
  });
}

const summary = {
  ok: issues.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "local_hold_integration_next_wave_active_batch_field_entry_pack",
  status:
    issues.length === 0
      ? "HOLD_NEXT_WAVE_ACTIVE_BATCH_FIELD_ENTRY_PACK_READY"
      : "FAIL_NEXT_WAVE_ACTIVE_BATCH_FIELD_ENTRY_PACK",
  activeBatchId: moussReview.activeBatchId,
  productCount: products.length,
  entryCount: entries.length,
  proofEntryCount: entries.filter((entry) => entry.entryType === "proof").length,
  webpEntryCount: entries.filter((entry) => entry.entryType === "webp").length,
  blockedEntryCount: entries.length,
  readyEntryCount: 0,
  productSheetCount: products.length,
  structuralFailureCount: issues.length,
  structuralFailures: issues,
  products,
  entries,
  sources: {
    proofIntakePath: rel(proofIntakePath),
    webpContractsPath: rel(webpContractsPath),
    moussReviewPath: rel(moussReviewPath),
    moussReviewAuditPath: rel(moussReviewAuditPath),
  },
  safety: {
    localFieldEntryPackOnly: true,
    noCatalogWrite: true,
    noPublicImageWrite: true,
    noImageDownload: true,
    noImageGeneration: true,
    noSupplierValueExport: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noMessageSent: true,
    manualValidationRequired: true,
  },
};

const jsonPath = path.join(outputDir, `FIELD_ENTRY_PACK_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `pack-saisie-terrain-lot-actif-prochaine-vague-sourcing-${dateKey}.md`);
const csvPath = path.join(outputDir, `pack-saisie-terrain-lot-actif-entrees-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, summaryMarkdown(summary), "utf8");
fs.writeFileSync(csvPath, entriesCsv(entries), "utf8");

console.log(
  JSON.stringify(
    {
      status: summary.status,
      ok: summary.ok,
      activeBatchId: summary.activeBatchId,
      productCount: summary.productCount,
      entryCount: summary.entryCount,
      proofEntryCount: summary.proofEntryCount,
      webpEntryCount: summary.webpEntryCount,
      productSheetCount: summary.productSheetCount,
      outputDir: rel(outputDir),
    },
    null,
    2,
  ),
);

if (!summary.ok) process.exitCode = 1;

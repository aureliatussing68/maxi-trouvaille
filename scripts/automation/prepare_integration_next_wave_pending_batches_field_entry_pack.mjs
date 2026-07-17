import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessRoot = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessRoot, "tableaux-action");
const runwayRoot = path.join(
  actionRoot,
  "runway-lots-suivants-prochaine-vague-sourcing-integration-articles",
);
const runwayAuditRoot = path.join(
  actionRoot,
  "audit-runway-lots-suivants-prochaine-vague-sourcing-integration-articles",
);
const outputRoot = path.join(
  actionRoot,
  "pack-saisie-terrain-lots-suivants-prochaine-vague-sourcing-integration-articles",
);

const forbiddenPattern = /\b(aliexpress|ali\s*express|alicdn|ae-pic|temu|dhgate|1688)\b/i;
const externalUrlPattern = /https?:\/\//i;
const sensitivePattern =
  /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|bearer|secret|password)\b\s*[:=]\s*["']?[^"',;\s]{8,}/i;
const keyLikePattern = /\b(sk|pk)_(live|test)_[A-Za-z0-9]{12,}\b|\bsk-[A-Za-z0-9]{12,}\b/i;

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

function isSafeOutput(value) {
  const serialized = JSON.stringify(value);
  return (
    !externalUrlPattern.test(serialized) &&
    !forbiddenPattern.test(serialized) &&
    !sensitivePattern.test(serialized) &&
    !keyLikePattern.test(serialized)
  );
}

function plannedProofPath(dateKey, product, task) {
  const productSlug = slugify(product.productName);
  const labelSlug = slugify(task.label || `preuve-${task.taskOrder}`);
  return [
    "business-maxi-trouvailles",
    "preuves-internes",
    "integration-articles",
    dateKey,
    "lots-suivants",
    product.batchId,
    productSlug,
    `preuve-${String(task.taskOrder).padStart(2, "0")}-${labelSlug}.md`,
  ].join("/");
}

function plannedWebpContractPath(dateKey, product, task) {
  const productSlug = slugify(product.productName);
  return [
    "business-maxi-trouvailles",
    "tableaux-action",
    "pack-saisie-terrain-lots-suivants-prochaine-vague-sourcing-integration-articles",
    dateKey,
    "contrats-webp-prevus",
    product.batchId,
    `${String(product.nextWaveRank).padStart(2, "0")}-${productSlug}-${String(task.taskOrder).padStart(2, "0")}.md`,
  ].join("/");
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
    "Statut: BLOCKED_PENDING_BATCH_FIELD_ENTRY_HOLD",
    `Lot: ${product.batchId}`,
    `Rang prochaine vague: ${product.nextWaveRank}`,
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
    "| Ordre | Image | Statut | Fichier WebP attendu | Contrat prevu |",
    "|---:|---|---|---|---|",
    ...webpRows,
    "",
    "## Sequence de saisie",
    "",
    "1. Remplir les preuves internes locales.",
    "2. Deposer seulement des WebP exacts dans les chemins listes.",
    "3. Completer les contrats WebP quand les droits image sont confirmes.",
    "4. Relancer les audits avant toute revue Mouss.",
    "",
    "## Garde-fous",
    "",
    "- Garder le produit en HOLD.",
    "- Garder les donnees source hors surface client.",
    "- Refuser toute image approximative.",
    "- Revue humaine Mouss obligatoire.",
    "",
  ].join("\n")}\n`;
}

function summaryMarkdown(summary) {
  const batchRows = summary.pendingBatches.map(
    (batch) =>
      `| ${batch.batchNumber} | ${batch.batchId} | ${batch.productCount} | ${batch.proofEntryCount} | ${batch.webpEntryCount} | ${batch.blockedEntryCount} |`,
  );
  const productRows = summary.products.map(
    (product) =>
      `| ${product.batchId} | ${product.nextWaveRank} | ${mdCell(product.productName)} | ${product.proofEntryCount} | ${product.webpEntryCount} | ${product.blockedEntryCount} | ${mdCell(product.sheetPath)} |`,
  );
  return `${[
    "# Pack saisie terrain lots suivants",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    `Lot actif protege: ${summary.activeBatchId}`,
    "",
    "## Synthese",
    "",
    `- Lots en attente: ${summary.pendingBatchCount}`,
    `- Produits: ${summary.productCount}`,
    `- Entrees de saisie: ${summary.entryCount}`,
    `- Preuves internes: ${summary.proofEntryCount}`,
    `- WebP exacts: ${summary.webpEntryCount}`,
    `- Entrees bloquees HOLD: ${summary.blockedEntryCount}`,
    `- Fiches produit terrain: ${summary.productSheetCount}`,
    "",
    "## Lots",
    "",
    "| Numero | Lot | Produits | Preuves | WebP | HOLD |",
    "|---:|---|---:|---:|---:|---:|",
    ...batchRows,
    "",
    "## Produits",
    "",
    "| Lot | Rang | Produit | Preuves | WebP | HOLD | Fiche terrain |",
    "|---|---:|---|---:|---:|---:|---|",
    ...productRows,
    "",
    "## Garde-fous",
    "",
    "- Pack de saisie interne uniquement.",
    "- Aucune valeur source n'est inventee.",
    "- Aucun WebP n'est cree automatiquement.",
    "- Aucun deblocage vente.",
    "",
  ].join("\n")}\n`;
}

function entriesCsv(entries) {
  const headers = [
    "rank",
    "batch_id",
    "batch_number",
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
        entry.batchNumber,
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
const runwayPath = latestFile(
  runwayRoot,
  /PENDING_BATCHES_RUNWAY_NEXT_WAVE_SOURCING_INTEGRATION_\d{8}\.json$/,
  "next wave pending batches runway",
);
const runwayAuditPath = latestFile(
  runwayAuditRoot,
  /AUDIT_PENDING_BATCHES_RUNWAY_NEXT_WAVE_SOURCING_INTEGRATION_\d{8}\.json$/,
  "next wave pending batches runway audit",
);

const runway = readJson(runwayPath);
const runwayAudit = readJson(runwayAuditPath);
const issues = [];

if (runway.status !== "HOLD_NEXT_WAVE_PENDING_BATCHES_RUNWAY_READY" || runway.ok !== true) {
  addIssue(issues, "runway", "runway_status_invalid", "La runway lots suivants doit etre prete en HOLD.", {
    status: runway.status,
  });
}
if (runwayAudit.status !== "OK_NEXT_WAVE_PENDING_BATCHES_RUNWAY_GUARDED" || runwayAudit.failureCount !== 0) {
  addIssue(issues, "runway_audit", "runway_audit_not_ok", "L'audit runway lots suivants doit etre OK.", {
    status: runwayAudit.status,
    failureCount: runwayAudit.failureCount,
  });
}
if (runway.activeBatchId !== "lot-01" || runway.activeBatchBlockedHold !== true) {
  addIssue(issues, "active_batch", "active_batch_not_protected", "Le lot actif doit rester protege en HOLD.", {
    activeBatchId: runway.activeBatchId,
    activeBatchBlockedHold: runway.activeBatchBlockedHold,
  });
}

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const entries = [];
const products = (runway.products ?? []).map((product) => {
  const productTasks = (runway.tasks ?? []).filter((task) => task.productId === product.productId);
  const proofEntries = productTasks
    .filter((task) => task.taskType === "proof")
    .map((task) => ({
      rank: product.nextWaveRank,
      batchId: product.batchId,
      batchNumber: product.batchNumber,
      productId: product.productId,
      productName: product.productName,
      categoryId: product.categoryId,
      entryType: "proof",
      order: task.taskOrder,
      label: task.label,
      status: "TO_FILL_HOLD",
      targetPath: task.localTarget || plannedProofPath(dateKey, product, task),
      contractPath: "",
      expectedAction: "Remplir la preuve interne locale puis garder HOLD.",
    }));
  const webpEntries = productTasks
    .filter((task) => task.taskType === "webp")
    .map((task) => ({
      rank: product.nextWaveRank,
      batchId: product.batchId,
      batchNumber: product.batchNumber,
      productId: product.productId,
      productName: product.productName,
      categoryId: product.categoryId,
      entryType: "webp",
      order: task.taskOrder,
      label: task.label,
      status: "TO_DEPOSIT_HOLD",
      targetPath: task.localTarget,
      contractPath: plannedWebpContractPath(dateKey, product, task),
      expectedAction: "Deposer un WebP exact local puis garder HOLD.",
    }));
  const productEntries = [...proofEntries, ...webpEntries].sort(
    (a, b) => a.entryType.localeCompare(b.entryType) || a.order - b.order,
  );
  entries.push(...productEntries);
  const sheetPath = path.join(
    outputDir,
    `SAISIE_TERRAIN_LOTS_SUIVANTS_${product.batchId}_${String(product.nextWaveRank).padStart(2, "0")}_${slugify(
      product.productName,
    )}.md`,
  );
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

const pendingBatches = (runway.pendingBatches ?? []).map((batch) => {
  const batchProducts = products.filter((product) => product.batchId === batch.batchId);
  const batchEntries = entries.filter((entry) => entry.batchId === batch.batchId);
  return {
    batchId: batch.batchId,
    batchNumber: batch.batchNumber,
    status: "PENDING_FIELD_ENTRY_PACK_HOLD",
    productCount: batchProducts.length,
    proofEntryCount: batchEntries.filter((entry) => entry.entryType === "proof").length,
    webpEntryCount: batchEntries.filter((entry) => entry.entryType === "webp").length,
    blockedEntryCount: batchEntries.length,
  };
});

if (pendingBatches.length !== 2 || products.length !== 8 || entries.length !== 64) {
  addIssue(issues, "field_entry_pack", "field_entry_scope_invalid", "Le pack doit couvrir 2 lots, 8 produits et 64 entrees.", {
    batchCount: pendingBatches.length,
    productCount: products.length,
    entryCount: entries.length,
  });
}
if (
  entries.filter((entry) => entry.entryType === "proof").length !== 40 ||
  entries.filter((entry) => entry.entryType === "webp").length !== 24
) {
  addIssue(issues, "field_entry_pack", "field_entry_type_counts_invalid", "Le pack doit contenir 40 preuves et 24 WebP.", {
    proofEntryCount: entries.filter((entry) => entry.entryType === "proof").length,
    webpEntryCount: entries.filter((entry) => entry.entryType === "webp").length,
  });
}
for (const product of products) {
  if (product.proofEntryCount !== 5 || product.webpEntryCount !== 3 || product.blockedEntryCount !== 8) {
    addIssue(issues, product.productId, "product_entry_counts_invalid", "Chaque produit doit avoir 5 preuves et 3 WebP.", {
      proofEntryCount: product.proofEntryCount,
      webpEntryCount: product.webpEntryCount,
      blockedEntryCount: product.blockedEntryCount,
    });
  }
}
if (!isSafeOutput({ pendingBatches, products, entries })) {
  addIssue(issues, "field_entry_pack", "unsafe_output_detected", "Une valeur externe, marketplace ou sensible est detectee.");
}

const summary = {
  ok: issues.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "local_hold_integration_next_wave_pending_batches_field_entry_pack",
  status:
    issues.length === 0
      ? "HOLD_NEXT_WAVE_PENDING_BATCHES_FIELD_ENTRY_PACK_READY"
      : "FAIL_NEXT_WAVE_PENDING_BATCHES_FIELD_ENTRY_PACK",
  activeBatchId: runway.activeBatchId,
  activeBatchBlockedHold: runway.activeBatchBlockedHold === true,
  pendingBatchCount: pendingBatches.length,
  productCount: products.length,
  entryCount: entries.length,
  proofEntryCount: entries.filter((entry) => entry.entryType === "proof").length,
  webpEntryCount: entries.filter((entry) => entry.entryType === "webp").length,
  blockedEntryCount: entries.length,
  readyEntryCount: 0,
  productSheetCount: products.length,
  structuralFailureCount: issues.length,
  structuralFailures: issues,
  pendingBatches,
  products,
  entries,
  sources: {
    runwayPath: rel(runwayPath),
    runwayAuditPath: rel(runwayAuditPath),
  },
  safety: {
    localFieldEntryPackOnly: true,
    readOnlyRunway: true,
    noActiveBatchReplacement: true,
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

const jsonPath = path.join(outputDir, `PENDING_BATCHES_FIELD_ENTRY_PACK_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `pack-saisie-terrain-lots-suivants-prochaine-vague-sourcing-${dateKey}.md`);
const csvPath = path.join(outputDir, `pack-saisie-terrain-lots-suivants-entrees-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, summaryMarkdown(summary), "utf8");
fs.writeFileSync(csvPath, entriesCsv(entries), "utf8");

console.log(
  JSON.stringify(
    {
      status: summary.status,
      ok: summary.ok,
      pendingBatchCount: summary.pendingBatchCount,
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

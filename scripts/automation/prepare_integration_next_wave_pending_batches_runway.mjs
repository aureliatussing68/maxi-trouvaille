import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessRoot = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessRoot, "tableaux-action");
const sessionRoot = path.join(actionRoot, "session-prochaine-vague-sourcing-integration-articles");
const sessionAuditRoot = path.join(actionRoot, "audit-session-prochaine-vague-sourcing-integration-articles");
const activeCompletionGateRoot = path.join(
  actionRoot,
  "audit-saisie-terrain-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const outputRoot = path.join(
  actionRoot,
  "runway-lots-suivants-prochaine-vague-sourcing-integration-articles",
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

function taskRowsCsv(rows) {
  const headers = [
    "batch_id",
    "batch_number",
    "product_rank",
    "product_id",
    "product_name",
    "category_id",
    "task_type",
    "task_order",
    "label",
    "status",
    "local_target",
    "expected_action",
  ];
  return `${headers.join(";")}\n${rows
    .map((row) =>
      [
        row.batchId,
        row.batchNumber,
        row.productRank,
        row.productId,
        row.productName,
        row.categoryId,
        row.taskType,
        row.taskOrder,
        row.label,
        row.status,
        row.localTarget,
        row.expectedAction,
      ]
        .map(csvEscape)
        .join(";"),
    )
    .join("\n")}\n`;
}

function batchRowsCsv(batches) {
  const headers = [
    "batch_id",
    "batch_number",
    "status",
    "product_count",
    "proof_task_count",
    "image_task_count",
    "first_action",
  ];
  return `${headers.join(";")}\n${batches
    .map((batch) =>
      [
        batch.batchId,
        batch.batchNumber,
        batch.status,
        batch.productCount,
        batch.proofTaskCount,
        batch.imageTaskCount,
        batch.firstAction,
      ]
        .map(csvEscape)
        .join(";"),
    )
    .join("\n")}\n`;
}

function markdown(summary) {
  const batchRows = summary.pendingBatches.map(
    (batch) =>
      `| ${batch.batchNumber} | ${batch.batchId} | ${batch.productCount} | ${batch.proofTaskCount} | ${batch.imageTaskCount} | ${mdCell(batch.status)} |`,
  );
  const productRows = summary.products.map(
    (product) =>
      `| ${product.batchId} | ${product.nextWaveRank} | ${mdCell(product.productName)} | ${mdCell(product.categoryId)} | ${product.proofTaskCount} | ${product.imageTaskCount} |`,
  );
  return `${[
    "# Runway lots suivants - prochaine vague sourcing integration",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    `Lot actif protege: ${summary.activeBatchId}`,
    "",
    "## Synthese",
    "",
    `- Lots en attente: ${summary.pendingBatchCount}`,
    `- Produits en attente: ${summary.pendingProductCount}`,
    `- Preuves a preparer: ${summary.proofTaskCount}`,
    `- WebP exacts attendus: ${summary.imageTaskCount}`,
    `- Lot actif toujours bloque HOLD: ${summary.activeBatchBlockedHold}`,
    "",
    "## Lots",
    "",
    "| Numero | Lot | Produits | Preuves | WebP | Statut |",
    "|---:|---|---:|---:|---:|---|",
    ...batchRows,
    "",
    "## Produits",
    "",
    "| Lot | Rang | Produit | Categorie | Preuves | WebP |",
    "|---|---:|---|---|---:|---:|",
    ...productRows,
    "",
    "## Garde-fous",
    "",
    "- Runway interne uniquement.",
    "- Aucun lot suivant ne remplace le lot actif.",
    "- Aucune valeur fournisseur n'est ajoutee.",
    "- Aucun WebP n'est cree, telecharge ou copie en public.",
    "- Validation humaine Mouss obligatoire avant toute suite.",
    "",
  ].join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const sessionPath = latestFile(sessionRoot, /SESSION_NEXT_WAVE_SOURCING_INTEGRATION_\d{8}\.json$/, "next wave session");
const sessionAuditPath = latestFile(
  sessionAuditRoot,
  /AUDIT_SESSION_NEXT_WAVE_SOURCING_INTEGRATION_\d{8}\.json$/,
  "next wave session audit",
);
const activeCompletionGatePath = latestFile(
  activeCompletionGateRoot,
  /FIELD_COMPLETION_GATE_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d{8}\.json$/,
  "active batch field completion gate",
);

const session = readJson(sessionPath);
const sessionAudit = readJson(sessionAuditPath);
const activeCompletionGate = readJson(activeCompletionGatePath);
const structuralFailures = [];

if (session.status !== "HOLD_NEXT_WAVE_SESSION_READY" || session.ok !== true) {
  addIssue(structuralFailures, "next_wave_session", "session_status_invalid", "La session prochaine vague doit etre prete en HOLD.", {
    status: session.status,
  });
}
if (sessionAudit.status !== "OK_NEXT_WAVE_SESSION_GUARDED" || sessionAudit.failureCount !== 0) {
  addIssue(structuralFailures, "next_wave_session_audit", "session_audit_not_ok", "L'audit session prochaine vague doit etre OK.", {
    status: sessionAudit.status,
    failureCount: sessionAudit.failureCount,
  });
}
if (activeCompletionGate.auditStatus !== "OK_NEXT_WAVE_ACTIVE_BATCH_FIELD_COMPLETION_GATE_GUARDED") {
  addIssue(structuralFailures, "active_batch_gate", "active_gate_not_ok", "Le gate saisie terrain du lot actif doit etre audite OK.", {
    status: activeCompletionGate.auditStatus,
  });
}

const activeBatchId = session.activeBatchId || "lot-01";
const pendingBatches = (session.batches ?? [])
  .filter((batch) => batch.batchId !== activeBatchId)
  .sort((a, b) => a.batchNumber - b.batchNumber)
  .map((batch) => ({
    batchId: batch.batchId,
    batchNumber: batch.batchNumber,
    status: "PENDING_RUNWAY_HOLD",
    productCount: batch.productCount,
    proofTaskCount: batch.proofTaskCount,
    imageTaskCount: batch.imageTaskCount,
    firstAction: "preparer preuves internes et WebP exacts locaux en HOLD",
    products: batch.products ?? [],
  }));
const pendingBatchIds = new Set(pendingBatches.map((batch) => batch.batchId));
const products = pendingBatches.flatMap((batch) =>
  (batch.products ?? []).map((product) => ({
    ...product,
    batchId: batch.batchId,
    batchNumber: batch.batchNumber,
    status: "PENDING_RUNWAY_HOLD",
  })),
);
const proofTasks = (session.proofRows ?? [])
  .filter((row) => pendingBatchIds.has(row.batchId))
  .map((row) => ({
    batchId: row.batchId,
    batchNumber: pendingBatches.find((batch) => batch.batchId === row.batchId)?.batchNumber ?? 0,
    productRank: row.productRank,
    productId: row.productId,
    productName: row.productName,
    categoryId: row.categoryId,
    taskType: "proof",
    taskOrder: row.order,
    label: row.label,
    status: "TO_PREPARE_HOLD",
    localTarget: row.localProofPath || "",
    expectedAction: "preparer preuve interne locale sans valeur fournisseur visible client",
  }));
const imageTasks = (session.imageRows ?? [])
  .filter((row) => pendingBatchIds.has(row.batchId))
  .map((row) => ({
    batchId: row.batchId,
    batchNumber: pendingBatches.find((batch) => batch.batchId === row.batchId)?.batchNumber ?? 0,
    productRank: row.productRank,
    productId: row.productId,
    productName: row.productName,
    categoryId: row.categoryId,
    taskType: "webp",
    taskOrder: row.order,
    label: row.expectedFileName,
    status: "TO_DEPOSIT_HOLD",
    localTarget: row.localFilePath || path.posix.join(row.depositDirRelative ?? "", row.expectedFileName ?? ""),
    expectedAction: "deposer uniquement un WebP exact local apres preuve",
  }));
const allTasks = [...proofTasks, ...imageTasks].sort(
  (a, b) => a.batchNumber - b.batchNumber || a.productRank - b.productRank || a.taskType.localeCompare(b.taskType) || a.taskOrder - b.taskOrder,
);

if (pendingBatches.length !== 2 || products.length !== 8 || proofTasks.length !== 40 || imageTasks.length !== 24) {
  addIssue(
    structuralFailures,
    "pending_batches_runway",
    "pending_scope_invalid",
    "La runway doit couvrir 2 lots suivants, 8 produits, 40 preuves et 24 WebP.",
    {
      pendingBatchCount: pendingBatches.length,
      pendingProductCount: products.length,
      proofTaskCount: proofTasks.length,
      imageTaskCount: imageTasks.length,
    },
  );
}

if (!isSafeOutput({ pendingBatches, products, allTasks })) {
  addIssue(
    structuralFailures,
    "pending_batches_runway",
    "unsafe_output_detected",
    "Une valeur externe, marketplace ou sensible est detectee dans la runway.",
  );
}

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: structuralFailures.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_integration_next_wave_pending_batches_runway",
  status:
    structuralFailures.length === 0
      ? "HOLD_NEXT_WAVE_PENDING_BATCHES_RUNWAY_READY"
      : "FAIL_NEXT_WAVE_PENDING_BATCHES_RUNWAY",
  activeBatchId,
  activeBatchStatus: activeCompletionGate.status,
  activeBatchBlockedHold: activeCompletionGate.status === "HOLD_NEXT_WAVE_ACTIVE_BATCH_FIELD_COMPLETION_BLOCKED",
  pendingBatchCount: pendingBatches.length,
  pendingProductCount: products.length,
  proofTaskCount: proofTasks.length,
  imageTaskCount: imageTasks.length,
  totalTaskCount: allTasks.length,
  structuralFailureCount: structuralFailures.length,
  structuralFailures,
  pendingBatches,
  products,
  tasks: allTasks,
  sources: {
    sessionPath: rel(sessionPath),
    sessionAuditPath: rel(sessionAuditPath),
    activeCompletionGatePath: rel(activeCompletionGatePath),
  },
  safety: {
    readOnlyRunway: true,
    noActiveBatchReplacement: true,
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
  },
};

const jsonPath = path.join(outputDir, `PENDING_BATCHES_RUNWAY_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `runway-lots-suivants-prochaine-vague-sourcing-${dateKey}.md`);
const batchesCsvPath = path.join(outputDir, `runway-lots-suivants-lots-${dateKey}.csv`);
const tasksCsvPath = path.join(outputDir, `runway-lots-suivants-taches-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(batchesCsvPath, batchRowsCsv(pendingBatches), "utf8");
fs.writeFileSync(tasksCsvPath, taskRowsCsv(allTasks), "utf8");

console.log(
  JSON.stringify(
    {
      status: summary.status,
      ok: summary.ok,
      activeBatchId: summary.activeBatchId,
      pendingBatchCount: summary.pendingBatchCount,
      pendingProductCount: summary.pendingProductCount,
      proofTaskCount: summary.proofTaskCount,
      imageTaskCount: summary.imageTaskCount,
      outputDir: rel(outputDir),
    },
    null,
    2,
  ),
);

if (!summary.ok) process.exitCode = 1;

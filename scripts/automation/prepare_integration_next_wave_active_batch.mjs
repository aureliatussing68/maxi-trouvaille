import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const sessionRoot = path.join(actionRoot, "session-prochaine-vague-sourcing-integration-articles");
const sessionAuditRoot = path.join(actionRoot, "audit-session-prochaine-vague-sourcing-integration-articles");
const outputRoot = path.join(actionRoot, "lot-actif-prochaine-vague-sourcing-integration-articles");

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

function isSafeOutput(value) {
  const serialized = JSON.stringify(value);
  return (
    !externalUrlPattern.test(serialized) &&
    !forbiddenPattern.test(serialized) &&
    !sensitivePattern.test(serialized) &&
    !keyLikePattern.test(serialized)
  );
}

function productCsv(products) {
  const headers = [
    "batch_id",
    "rank",
    "product_id",
    "product_name",
    "category_id",
    "target_sale_price",
    "target_margin",
    "proof_task_count",
    "image_task_count",
    "image_deposit_dir",
    "admin_href",
    "first_action",
  ];

  const rows = products.map((product) =>
    [
      product.batchId,
      product.nextWaveRank,
      product.productId,
      product.productName,
      product.categoryId,
      product.targetSalePrice,
      product.targetMargin,
      product.proofTasks.length,
      product.imageTasks.length,
      product.imageDepositDirRelative,
      product.adminProofHref,
      "remplir preuves internes puis deposer WebP exacts locaux",
    ]
      .map(csvEscape)
      .join(";"),
  );

  return `${headers.join(";")}\n${rows.join("\n")}\n`;
}

function proofCsv(rows) {
  const headers = [
    "sprint_order",
    "batch_id",
    "product_rank",
    "product_id",
    "product_name",
    "category_id",
    "proof_order",
    "proof_key",
    "zone",
    "label",
    "status",
    "expected_format",
    "reject_if",
    "admin_href",
    "manual_value",
    "evidence_note",
    "local_proof_path",
    "checked_same_article",
    "mouss_validation",
    "final_decision",
  ];

  const csvRows = rows.map((row, index) =>
    [
      index + 1,
      row.batchId,
      row.productRank,
      row.productId,
      row.productName,
      row.categoryId,
      row.order,
      row.key,
      row.zone,
      row.label,
      row.status,
      row.expectedFormat,
      row.rejectIf,
      row.adminProofHref,
      "",
      "",
      "",
      "",
      "",
      "HOLD_TO_FILL",
    ]
      .map(csvEscape)
      .join(";"),
  );

  return `${headers.join(";")}\n${csvRows.join("\n")}\n`;
}

function imageCsv(rows) {
  const headers = [
    "sprint_order",
    "batch_id",
    "product_rank",
    "product_id",
    "product_name",
    "category_id",
    "image_order",
    "role",
    "label",
    "expected_file_name",
    "deposit_dir",
    "status",
    "admin_href",
    "local_file_path",
    "checked_same_article",
    "rights_confirmed",
    "variant_confirmed",
    "mouss_validation",
    "final_decision",
  ];

  const csvRows = rows.map((row, index) =>
    [
      index + 1,
      row.batchId,
      row.productRank,
      row.productId,
      row.productName,
      row.categoryId,
      row.order,
      row.role,
      row.label,
      row.expectedFileName,
      row.depositDirRelative,
      row.status,
      row.adminProofHref,
      "",
      "",
      "",
      "",
      "",
      "HOLD_TO_DEPOSIT",
    ]
      .map(csvEscape)
      .join(";"),
  );

  return `${headers.join(";")}\n${csvRows.join("\n")}\n`;
}

function actionCsv(actions) {
  const headers = ["order", "lane", "product_id", "product_name", "label", "status", "next_action"];
  const rows = actions.map((action) =>
    [
      action.order,
      action.lane,
      action.productId,
      action.productName,
      action.label,
      action.status,
      action.nextAction,
    ]
      .map(csvEscape)
      .join(";"),
  );

  return `${headers.join(";")}\n${rows.join("\n")}\n`;
}

function markdown(summary) {
  const productRows = summary.products.map(
    (product) =>
      `| ${product.nextWaveRank} | ${mdCell(product.productName)} | ${mdCell(product.categoryId)} | ${product.proofTasks.length} | ${product.imageTasks.length} | ${mdCell(product.imageDepositDirRelative)} |`,
  );
  const actionRows = summary.actions.map(
    (action) =>
      `| ${action.order} | ${mdCell(action.lane)} | ${mdCell(action.productName)} | ${mdCell(action.label)} | ${mdCell(action.status)} |`,
  );

  return `${[
    "# Maxi Trouvailles - Lot actif prochaine vague",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    `Lot actif: ${summary.activeBatchId}`,
    "",
    "## Synthese",
    "",
    `- Produits: ${summary.productCount}`,
    `- Preuves internes a remplir: ${summary.proofTaskCount}`,
    `- Images WebP exactes attendues: ${summary.imageTaskCount}`,
    `- Actions terrain: ${summary.actionCount}`,
    "",
    "## Produits",
    "",
    "| Rang | Produit | Categorie | Preuves | Images | Depot |",
    "|---:|---|---|---:|---:|---|",
    ...productRows,
    "",
    "## Actions terrain",
    "",
    "| Ordre | Lane | Produit | Action | Statut |",
    "|---:|---|---|---|---|",
    ...actionRows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule cote catalogue.",
    "- Aucun telechargement image.",
    "- Aucune copie publique.",
    "- Aucun paiement, achat, publication ou commande partenaire.",
    "- Les valeurs fournisseur restent en preuves internes et ne sont pas exposees client.",
    "- Validation humaine Mouss obligatoire avant tout deblocage.",
    "",
  ].join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const sessionPath = latestFile(sessionRoot, /SESSION_NEXT_WAVE_SOURCING_INTEGRATION_\d{8}\.json$/, "next wave session");
const sessionAuditPath = latestFile(
  sessionAuditRoot,
  /AUDIT_SESSION_NEXT_WAVE_SOURCING_INTEGRATION_\d{8}\.json$/,
  "next wave session audit",
);
const session = readJson(sessionPath);
const sessionAudit = readJson(sessionAuditPath);
const activeBatchId = session.activeBatchId || "lot-01";
const structuralFailures = [];

if (session.status !== "HOLD_NEXT_WAVE_SESSION_READY" || session.ok !== true) {
  structuralFailures.push({
    code: "session_not_ready",
    message: "La session prochaine vague n'est pas prete en HOLD.",
    status: session.status,
  });
}

if (sessionAudit.status !== "OK_NEXT_WAVE_SESSION_GUARDED" || sessionAudit.failureCount !== 0) {
  structuralFailures.push({
    code: "session_audit_not_ok",
    message: "L'audit session prochaine vague n'est pas OK.",
    status: sessionAudit.status,
    failureCount: sessionAudit.failureCount,
  });
}

const products = [...(session.products ?? [])]
  .filter((product) => product.batchId === activeBatchId)
  .sort((a, b) => a.nextWaveRank - b.nextWaveRank);
const proofRows = [...(session.proofRows ?? [])]
  .filter((row) => row.batchId === activeBatchId)
  .sort((a, b) => a.productRank - b.productRank || a.order - b.order);
const imageRows = [...(session.imageRows ?? [])]
  .filter((row) => row.batchId === activeBatchId)
  .sort((a, b) => a.productRank - b.productRank || a.order - b.order);
const actions = [
  ...proofRows.map((row, index) => ({
    order: index + 1,
    lane: "preuves",
    productId: row.productId,
    productName: row.productName,
    label: row.label,
    status: row.status,
    nextAction: "remplir cette preuve interne et garder HOLD",
  })),
  ...imageRows.map((row, index) => ({
    order: proofRows.length + index + 1,
    lane: "images",
    productId: row.productId,
    productName: row.productName,
    label: row.expectedFileName,
    status: row.status,
    nextAction: "deposer un WebP exact local puis garder HOLD",
  })),
];

if (products.length !== 4 || proofRows.length !== 20 || imageRows.length !== 12) {
  structuralFailures.push({
    code: "active_batch_counts_invalid",
    message: "Le lot actif doit contenir 4 produits, 20 preuves et 12 images.",
    productCount: products.length,
    proofTaskCount: proofRows.length,
    imageTaskCount: imageRows.length,
  });
}

const safeDraft = { products, proofRows, imageRows, actions };
if (!isSafeOutput(safeDraft)) {
  structuralFailures.push({
    code: "unsafe_output_detected",
    message: "Le lot actif contient une valeur externe, marketplace ou sensible.",
  });
}

const summary = {
  ok: structuralFailures.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_integration_next_wave_active_batch",
  status:
    structuralFailures.length === 0
      ? "HOLD_NEXT_WAVE_ACTIVE_BATCH_READY"
      : "BLOCKED_NEXT_WAVE_ACTIVE_BATCH_REVIEW_REQUIRED",
  activeBatchId,
  productCount: products.length,
  proofTaskCount: proofRows.length,
  imageTaskCount: imageRows.length,
  actionCount: actions.length,
  structuralFailureCount: structuralFailures.length,
  structuralFailures,
  products,
  proofRows,
  imageRows,
  actions,
  sources: {
    sessionPath: rel(sessionPath),
    sessionAuditPath: rel(sessionAuditPath),
  },
  safety: {
    readOnlyInputs: true,
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
    sessionAuditRequired: true,
  },
};

const jsonPath = path.join(outputDir, `ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `maxi-lot-actif-prochaine-vague-sourcing-${dateKey}.md`);
const productsCsvPath = path.join(outputDir, `maxi-lot-actif-prochaine-vague-produits-${dateKey}.csv`);
const proofsCsvPath = path.join(outputDir, `maxi-lot-actif-prochaine-vague-preuves-${dateKey}.csv`);
const imagesCsvPath = path.join(outputDir, `maxi-lot-actif-prochaine-vague-images-${dateKey}.csv`);
const actionsCsvPath = path.join(outputDir, `maxi-lot-actif-prochaine-vague-actions-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(productsCsvPath, productCsv(products), "utf8");
fs.writeFileSync(proofsCsvPath, proofCsv(proofRows), "utf8");
fs.writeFileSync(imagesCsvPath, imageCsv(imageRows), "utf8");
fs.writeFileSync(actionsCsvPath, actionCsv(actions), "utf8");

console.log(
  JSON.stringify(
    {
      status: summary.status,
      ok: summary.ok,
      activeBatchId: summary.activeBatchId,
      productCount: summary.productCount,
      proofTaskCount: summary.proofTaskCount,
      imageTaskCount: summary.imageTaskCount,
      actionCount: summary.actionCount,
      outputDir: rel(outputDir),
    },
    null,
    2,
  ),
);

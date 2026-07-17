import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const planRoot = path.join(actionRoot, "prochaine-vague-sourcing-integration-articles");
const planAuditRoot = path.join(actionRoot, "audit-prochaine-vague-sourcing-integration-articles");
const outputRoot = path.join(actionRoot, "session-prochaine-vague-sourcing-integration-articles");

const batchSize = 4;
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

function slugSafe(value) {
  return (
    String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "article"
  );
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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

function depositReadme(product) {
  const imageRows = product.imageTasks.map(
    (task) => `- ${task.expectedFileName}: ${task.label}, statut ${task.status}`,
  );

  return `${[
    `# Depot WebP exact - ${product.productName}`,
    "",
    `Produit: ${product.productName}`,
    `Statut: ${product.status}`,
    "",
    "## Fichiers attendus",
    "",
    ...imageRows,
    "",
    "## Garde-fous",
    "",
    "- Ne deposer que des WebP exacts du meme article et de la meme variante.",
    "- Ne pas telecharger automatiquement.",
    "- Ne pas copier dans public/uploads.",
    "- Ne pas publier.",
    "- Garder HOLD jusqu'a preuves completes et validation Mouss.",
    "",
  ].join("\n")}\n`;
}

function productMarkdown(product) {
  const proofRows = product.proofTasks.map(
    (task) => `| ${task.order} | ${mdCell(task.zone)} | ${mdCell(task.label)} | ${mdCell(task.expectedFormat)} | ${mdCell(task.rejectIf)} |`,
  );
  const imageRows = product.imageTasks.map(
    (task) =>
      `| ${task.order} | ${mdCell(task.role)} | ${mdCell(task.label)} | ${mdCell(task.expectedFileName)} | ${mdCell(task.depositDirRelative)} |`,
  );

  return `${[
    `# Session prochaine vague - ${product.productName}`,
    "",
    `Lot: ${product.batchId}`,
    `Rang vague: ${product.nextWaveRank}`,
    `Categorie: ${product.categoryId}`,
    `Statut: ${product.status}`,
    `Prix cible: ${product.targetSalePrice}`,
    `Marge cible: ${product.targetMargin}`,
    "",
    "## Preuves a remplir",
    "",
    "| Ordre | Zone | Champ | Format attendu | Refuser si |",
    "|---:|---|---|---|---|",
    ...proofRows,
    "",
    "## Images WebP exactes",
    "",
    "| Ordre | Role | Libelle | Fichier attendu | Dossier depot |",
    "|---:|---|---|---|---|",
    ...imageRows,
    "",
    "## Garde-fous",
    "",
    "- Ne pas publier.",
    "- Ne pas payer.",
    "- Ne pas commander.",
    "- Ne pas contacter un partenaire automatiquement.",
    "- Ne pas copier d'image publique.",
    "- Garder HOLD jusqu'a preuves completes et validation humaine Mouss.",
    "",
  ].join("\n")}\n`;
}

function batchMarkdown(batch) {
  const rows = batch.products.map(
    (product) =>
      `| ${product.nextWaveRank} | ${mdCell(product.productName)} | ${mdCell(product.categoryId)} | ${product.proofTasks.length} | ${product.imageTasks.length} | ${mdCell(product.imageDepositDirRelative)} |`,
  );

  return `${[
    `# Lot ${batch.batchNumber} - Prochaine vague sourcing`,
    "",
    `Statut: ${batch.status}`,
    `Produits: ${batch.productCount}`,
    `Preuves: ${batch.proofTaskCount}`,
    `Images WebP: ${batch.imageTaskCount}`,
    "",
    "| Rang | Produit | Categorie | Preuves | Images | Depot |",
    "|---:|---|---|---:|---:|---|",
    ...rows,
    "",
    "## Ordre conseille",
    "",
    "1. Remplir les 5 preuves internes de chaque produit.",
    "2. Deposer les 3 WebP exacts dans le dossier local du produit.",
    "3. Relancer les audits avant toute revue Mouss.",
    "",
    "## Garde-fous",
    "",
    "- Aucune publication.",
    "- Aucun paiement.",
    "- Aucune commande partenaire.",
    "- Aucune image approximative.",
    "- Aucun fournisseur visible client.",
    "",
  ].join("\n")}\n`;
}

function summaryMarkdown(summary) {
  const rows = summary.batches.map(
    (batch) =>
      `| ${batch.batchId} | ${batch.productCount} | ${batch.proofTaskCount} | ${batch.imageTaskCount} | ${mdCell(batch.status)} |`,
  );

  return `${[
    "# Maxi Trouvailles - Session prochaine vague sourcing",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Lots: ${summary.batchCount}`,
    `- Produits: ${summary.productCount}`,
    `- Preuves internes a remplir: ${summary.proofTaskCount}`,
    `- Images WebP exactes attendues: ${summary.imageTaskCount}`,
    `- Instructions depot local: ${summary.depositInstructionCount}`,
    `- Lot actif conseille: ${summary.activeBatchId}`,
    "",
    "| Lot | Produits | Preuves | Images | Statut |",
    "|---|---:|---:|---:|---|",
    ...rows,
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

function proofCsv(rows) {
  const headers = [
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

  const csvRows = rows.map((row) =>
    [
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

  const csvRows = rows.map((row) =>
    [
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

function batchCsv(batches) {
  const headers = [
    "batch_id",
    "batch_number",
    "product_count",
    "proof_task_count",
    "image_task_count",
    "status",
    "first_action",
  ];
  const rows = batches.map((batch) =>
    [
      batch.batchId,
      batch.batchNumber,
      batch.productCount,
      batch.proofTaskCount,
      batch.imageTaskCount,
      batch.status,
      batch.firstAction,
    ]
      .map(csvEscape)
      .join(";"),
  );

  return `${headers.join(";")}\n${rows.join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(outputRoot, dateKey);
const productSheetDir = path.join(outputDir, "fiches-produits");
const batchSheetDir = path.join(outputDir, "lots");
fs.mkdirSync(productSheetDir, { recursive: true });
fs.mkdirSync(batchSheetDir, { recursive: true });

const planPath = latestFile(planRoot, /NEXT_WAVE_SOURCING_INTEGRATION_\d{8}\.json$/, "next wave plan");
const planAuditPath = latestFile(planAuditRoot, /AUDIT_NEXT_WAVE_SOURCING_INTEGRATION_\d{8}\.json$/, "next wave audit");
const plan = readJson(planPath);
const planAudit = readJson(planAuditPath);
const structuralFailures = [];

if (plan.status !== "HOLD_NEXT_WAVE_SOURCING_READY" || plan.ok !== true) {
  structuralFailures.push({
    code: "plan_not_ready",
    message: "Le plan prochaine vague n'est pas pret en HOLD.",
    status: plan.status,
  });
}

if (planAudit.status !== "OK_NEXT_WAVE_SOURCING_GUARDED" || planAudit.failureCount !== 0) {
  structuralFailures.push({
    code: "plan_audit_not_ok",
    message: "L'audit prochaine vague n'est pas OK.",
    status: planAudit.status,
    failureCount: planAudit.failureCount,
  });
}

const products = [...(plan.products ?? [])].sort((a, b) => a.nextWaveRank - b.nextWaveRank);
const productBatches = chunk(products, batchSize);
const sessionProducts = [];
const proofRows = [];
const imageRows = [];
const depositReadmePaths = [];

const batches = productBatches.map((batchProducts, batchIndex) => {
  const batchId = `lot-${String(batchIndex + 1).padStart(2, "0")}`;
  const enrichedProducts = batchProducts.map((product) => {
    const enriched = {
      ...product,
      batchId,
      sessionStatus: "TO_PROCESS_HOLD",
      productSheetRelative: `business-maxi-trouvailles/tableaux-action/session-prochaine-vague-sourcing-integration-articles/${dateKey}/fiches-produits/${String(product.nextWaveRank).padStart(2, "0")}-${slugSafe(product.slug)}.md`,
      depositReadmeRelative: `${product.imageDepositDirRelative}/README_NEXT_WAVE_HOLD_${dateKey}.md`,
    };

    sessionProducts.push(enriched);
    proofRows.push(
      ...(product.proofTasks ?? []).map((task) => ({
        batchId,
        productRank: product.nextWaveRank,
        productId: product.productId,
        productName: product.productName,
        categoryId: product.categoryId,
        adminProofHref: product.adminProofHref,
        imageDepositDirRelative: product.imageDepositDirRelative,
        ...task,
      })),
    );
    imageRows.push(
      ...(product.imageTasks ?? []).map((task) => ({
        batchId,
        productRank: product.nextWaveRank,
        productId: product.productId,
        productName: product.productName,
        categoryId: product.categoryId,
        adminProofHref: product.adminProofHref,
        ...task,
      })),
    );

    const depositDir = path.join(root, product.imageDepositDirRelative);
    fs.mkdirSync(depositDir, { recursive: true });
    const readmePath = path.join(depositDir, `README_NEXT_WAVE_HOLD_${dateKey}.md`);
    fs.writeFileSync(readmePath, depositReadme(product), "utf8");
    depositReadmePaths.push(rel(readmePath));

    const productSheetPath = path.join(productSheetDir, `${String(product.nextWaveRank).padStart(2, "0")}-${slugSafe(product.slug)}.md`);
    fs.writeFileSync(productSheetPath, productMarkdown(enriched), "utf8");

    return enriched;
  });

  const batch = {
    batchId,
    batchNumber: batchIndex + 1,
    status: "TO_PROCESS_HOLD",
    productCount: enrichedProducts.length,
    proofTaskCount: enrichedProducts.reduce((sum, product) => sum + product.proofTasks.length, 0),
    imageTaskCount: enrichedProducts.reduce((sum, product) => sum + product.imageTasks.length, 0),
    firstAction: "remplir les preuves internes, puis deposer les WebP exacts locaux",
    products: enrichedProducts.map((product) => ({
      productId: product.productId,
      productName: product.productName,
      nextWaveRank: product.nextWaveRank,
      categoryId: product.categoryId,
      imageDepositDirRelative: product.imageDepositDirRelative,
      proofTaskCount: product.proofTasks.length,
      imageTaskCount: product.imageTasks.length,
    })),
  };

  const batchPath = path.join(batchSheetDir, `${batchId}.md`);
  fs.writeFileSync(batchPath, batchMarkdown({ ...batch, products: enrichedProducts }), "utf8");

  return {
    ...batch,
    batchSheetRelative: rel(batchPath),
  };
});

if (products.length !== 12 || proofRows.length !== 60 || imageRows.length !== 36 || batches.length !== 3) {
  structuralFailures.push({
    code: "session_counts_invalid",
    message: "La session doit contenir 3 lots, 12 produits, 60 preuves et 36 images.",
    productCount: products.length,
    proofTaskCount: proofRows.length,
    imageTaskCount: imageRows.length,
    batchCount: batches.length,
  });
}

const safeDraft = { batches, products: sessionProducts, proofRows, imageRows };
if (!isSafeOutput(safeDraft)) {
  structuralFailures.push({
    code: "unsafe_output_detected",
    message: "La session contient une valeur externe, marketplace ou sensible.",
  });
}

const summary = {
  ok: structuralFailures.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_integration_next_wave_session",
  status: structuralFailures.length === 0 ? "HOLD_NEXT_WAVE_SESSION_READY" : "BLOCKED_NEXT_WAVE_SESSION_REVIEW_REQUIRED",
  batchCount: batches.length,
  batchSize,
  activeBatchId: batches[0]?.batchId ?? "",
  productCount: sessionProducts.length,
  proofTaskCount: proofRows.length,
  imageTaskCount: imageRows.length,
  totalTaskCount: proofRows.length + imageRows.length,
  depositInstructionCount: depositReadmePaths.length,
  structuralFailureCount: structuralFailures.length,
  structuralFailures,
  batches,
  products: sessionProducts,
  proofRows,
  imageRows,
  sources: {
    planPath: rel(planPath),
    planAuditPath: rel(planAuditPath),
  },
  files: {
    productSheetPaths: sessionProducts.map((product) => product.productSheetRelative),
    batchSheetPaths: batches.map((batch) => batch.batchSheetRelative),
    depositReadmePaths,
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
    planAuditRequired: true,
  },
};

const jsonPath = path.join(outputDir, `SESSION_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `maxi-session-prochaine-vague-sourcing-${dateKey}.md`);
const batchesCsvPath = path.join(outputDir, `maxi-session-prochaine-vague-sourcing-lots-${dateKey}.csv`);
const proofsCsvPath = path.join(outputDir, `maxi-session-prochaine-vague-sourcing-preuves-${dateKey}.csv`);
const imagesCsvPath = path.join(outputDir, `maxi-session-prochaine-vague-sourcing-images-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, summaryMarkdown(summary), "utf8");
fs.writeFileSync(batchesCsvPath, batchCsv(batches), "utf8");
fs.writeFileSync(proofsCsvPath, proofCsv(proofRows), "utf8");
fs.writeFileSync(imagesCsvPath, imageCsv(imageRows), "utf8");

console.log(
  JSON.stringify(
    {
      status: summary.status,
      ok: summary.ok,
      batchCount: summary.batchCount,
      productCount: summary.productCount,
      proofTaskCount: summary.proofTaskCount,
      imageTaskCount: summary.imageTaskCount,
      depositInstructionCount: summary.depositInstructionCount,
      outputDir: rel(outputDir),
    },
    null,
    2,
  ),
);

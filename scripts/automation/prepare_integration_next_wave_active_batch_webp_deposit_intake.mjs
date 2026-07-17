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
const proofIntakeAuditRoot = path.join(
  actionRoot,
  "audit-preuves-internes-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const outputRoot = path.join(
  actionRoot,
  "depots-webp-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const allowedDepositPrefix = "business-maxi-trouvailles/depots-images-exactes/integration-articles/";

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

function isSafeDepositPath(value, dateKey) {
  const text = normalizeRel(value);
  return (
    text.startsWith(`${allowedDepositPrefix}${dateKey}/`) &&
    !text.includes("..") &&
    !path.isAbsolute(text)
  );
}

function webpState(targetPath) {
  const absolutePath = resolveInsideRoot(targetPath);
  if (!fs.existsSync(absolutePath)) return "missing";
  const buffer = fs.readFileSync(absolutePath);
  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return isWebp ? "present_valid_header" : "present_invalid_header";
}

function readmeMarkdown({ pack, imageRows, dateKey }) {
  return `${[
    `# Depot WebP exact HOLD - ${pack.productName}`,
    "",
    "Statut: HOLD_WEBP_DEPOSIT_INTAKE_READY",
    `Date dossier: ${dateKey}`,
    `Lot: ${pack.batchId}`,
    `Produit: ${pack.productId}`,
    `Categorie: ${pack.categoryId}`,
    "",
    "## Fichiers attendus",
    "",
    "| Ordre | Role | Fichier WebP attendu | Statut attendu |",
    "|---:|---|---|---|",
    ...imageRows.map(
      (row) => `| ${row.order} | ${mdCell(row.role)} | ${mdCell(row.expectedFileName)} | ${row.status} |`,
    ),
    "",
    "## Controle avant depot",
    "",
    "- Meme article que la preuve interne.",
    "- Variante exacte visible.",
    "- Droits image confirmes.",
    "- Format WebP reel.",
    "- Pas d'image approximative.",
    "- Pas de copie vers public/uploads.",
    "",
    "## Garde-fous",
    "",
    "- Ne pas publier.",
    "- Ne pas commander fournisseur.",
    "- Ne pas remplacer par un produit similaire.",
    "- Relancer les audits apres depot des vrais WebP.",
    "- Garder la fiche en HOLD jusqu'a validation Mouss.",
    "",
  ].join("\n")}\n`;
}

function summaryMarkdown(summary) {
  const rows = summary.products.map(
    (product) =>
      `| ${product.rank} | ${mdCell(product.productName)} | ${product.imageTaskCount} | ${product.existingWebpFileCount} | ${product.missingWebpFileCount} | ${mdCell(product.readmePath)} |`,
  );

  return `${[
    "# Depots WebP lot actif prochaine vague",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Lot actif: ${summary.activeBatchId}`,
    `- Produits: ${summary.productCount}`,
    `- WebP attendus: ${summary.expectedWebpFileCount}`,
    `- WebP presents: ${summary.existingWebpFileCount}`,
    `- WebP manquants: ${summary.missingWebpFileCount}`,
    `- WebP invalides: ${summary.invalidWebpFileCount}`,
    `- Dossiers depot: ${summary.depositDirCount}`,
    `- READMEs depot: ${summary.readmeFileCount}`,
    "",
    "## Dossiers",
    "",
    "| Rang | Produit | WebP attendus | Presents | Manquants | README |",
    "|---:|---|---:|---:|---:|---|",
    ...rows,
    "",
    "## Garde-fous",
    "",
    "- Dossiers et READMEs seulement.",
    "- Aucun fichier image n'est cree automatiquement.",
    "- Les WebP manquants restent un blocage business normal.",
    "- Aucune copie vers public/uploads.",
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
    "image_order",
    "role",
    "label",
    "status",
    "expected_file_name",
    "deposit_dir",
    "target_path",
    "file_state",
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
        item.role,
        item.label,
        item.status,
        item.expectedFileName,
        item.depositDir,
        item.targetPath,
        item.fileState,
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
const proofIntakeAuditPath = latestFile(
  proofIntakeAuditRoot,
  /AUDIT_PROOF_INTAKE_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch proof intake audit",
);

const microPacks = readJson(microPacksPath);
const microPacksAudit = readJson(microPacksAuditPath);
const proofIntakeAudit = readJson(proofIntakeAuditPath);
const issues = [];

if (microPacks.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_MICRO_PACKS_READY") {
  addIssue(issues, "micro_packs", "micro_pack_status_invalid", "Les micro-packs doivent rester prets en HOLD.", {
    status: microPacks.status,
  });
}

if (microPacksAudit.status !== "OK_NEXT_WAVE_ACTIVE_BATCH_MICRO_PACKS_GUARDED") {
  addIssue(issues, "micro_packs_audit", "micro_pack_audit_not_ok", "L'audit micro-packs doit etre OK avant depot.", {
    status: microPacksAudit.status,
  });
}

if (proofIntakeAudit.status !== "OK_NEXT_WAVE_ACTIVE_BATCH_PROOF_INTAKE_GUARDED") {
  addIssue(issues, "proof_intake_audit", "proof_intake_audit_not_ok", "L'audit preuves doit etre OK avant depot WebP.", {
    status: proofIntakeAudit.status,
  });
}

const packs = (microPacks.products ?? []).map((product) => {
  const productPath = resolveInsideRoot(product.relativeJsonPath);
  return readJson(productPath);
});

const imageItems = [];
const productSummaries = [];

for (const pack of packs) {
  const imageRows = [];
  const depositDirs = new Set();

  for (const image of pack.imageTasks ?? []) {
    const depositDir = normalizeRel(image.depositDirRelative);
    const targetPath = normalizeRel(image.localFilePath);
    if (!isSafeDepositPath(depositDir, dateKey) || !isSafeDepositPath(targetPath, dateKey)) {
      addIssue(issues, image.taskId, "image_deposit_path_invalid", "Chemin depot WebP invalide.", {
        depositDir,
        targetPath,
      });
      continue;
    }

    if (!String(image.expectedFileName ?? "").endsWith(".webp")) {
      addIssue(issues, image.taskId, "expected_webp_name_invalid", "Le fichier attendu doit etre en .webp.", {
        expectedFileName: image.expectedFileName,
      });
      continue;
    }

    fs.mkdirSync(resolveInsideRoot(depositDir), { recursive: true });
    depositDirs.add(depositDir);
    const row = {
      productRank: pack.rank,
      batchId: pack.batchId,
      productId: pack.productId,
      productName: pack.productName,
      categoryId: pack.categoryId,
      order: image.order,
      role: image.role,
      label: image.label,
      status: "TO_DEPOSIT_HOLD",
      expectedFileName: image.expectedFileName,
      depositDir,
      targetPath,
      fileState: webpState(targetPath),
      rejectIf: "Refuser si l'image ne montre pas exactement la variante vendue ou si les droits image ne sont pas confirmes.",
    };
    imageRows.push(row);
    imageItems.push(row);
  }

  const productDepositDir = [...depositDirs][0] ?? `${allowedDepositPrefix}${dateKey}/${pack.slug}`;
  const readmePath = path.join(
    resolveInsideRoot(productDepositDir),
    `README_DEPOT_WEBP_LOT_ACTIF_HOLD_${dateKey}.md`,
  );
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, readmeMarkdown({ pack, imageRows, dateKey }), "utf8");
  }

  productSummaries.push({
    rank: pack.rank,
    batchId: pack.batchId,
    productId: pack.productId,
    slug: pack.slug,
    productName: pack.productName,
    categoryId: pack.categoryId,
    status: "HOLD_WEBP_DEPOSIT_INTAKE_READY",
    imageTaskCount: imageRows.length,
    expectedWebpFileCount: imageRows.length,
    existingWebpFileCount: imageRows.filter((row) => row.fileState !== "missing").length,
    missingWebpFileCount: imageRows.filter((row) => row.fileState === "missing").length,
    invalidWebpFileCount: imageRows.filter((row) => row.fileState === "present_invalid_header").length,
    depositDir: productDepositDir,
    readmePath: rel(readmePath),
  });
}

if (packs.length !== 4 || imageItems.length !== 12) {
  addIssue(issues, "webp_deposit_intake", "webp_deposit_scope_invalid", "L'intake WebP doit couvrir 4 produits et 12 images.", {
    productCount: packs.length,
    imageCount: imageItems.length,
  });
}

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: issues.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "local_hold_integration_next_wave_active_batch_webp_deposit_intake",
  status: issues.length === 0 ? "HOLD_NEXT_WAVE_ACTIVE_BATCH_WEBP_DEPOSIT_INTAKE_READY" : "FAIL_NEXT_WAVE_ACTIVE_BATCH_WEBP_DEPOSIT_INTAKE",
  activeBatchId: microPacks.activeBatchId,
  productCount: packs.length,
  imageTaskCount: imageItems.length,
  expectedWebpFileCount: imageItems.length,
  existingWebpFileCount: imageItems.filter((item) => item.fileState !== "missing").length,
  missingWebpFileCount: imageItems.filter((item) => item.fileState === "missing").length,
  validExistingWebpFileCount: imageItems.filter((item) => item.fileState === "present_valid_header").length,
  invalidWebpFileCount: imageItems.filter((item) => item.fileState === "present_invalid_header").length,
  depositDirCount: new Set(productSummaries.map((product) => product.depositDir)).size,
  readmeFileCount: productSummaries.filter((product) => fs.existsSync(resolveInsideRoot(product.readmePath))).length,
  structuralFailureCount: issues.length,
  structuralFailures: issues,
  products: productSummaries,
  images: imageItems,
  sources: {
    microPacksPath: rel(microPacksPath),
    microPacksAuditPath: rel(microPacksAuditPath),
    proofIntakeAuditPath: rel(proofIntakeAuditPath),
  },
  safety: {
    localDepositReadmesOnly: true,
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
    proofIntakeAuditRequired: true,
    microPacksAuditRequired: true,
  },
};

const jsonPath = path.join(outputDir, `WEBP_DEPOSIT_INTAKE_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `depots-webp-lot-actif-prochaine-vague-sourcing-${dateKey}.md`);
const csvPath = path.join(outputDir, `depots-webp-lot-actif-items-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, summaryMarkdown(summary), "utf8");
fs.writeFileSync(csvPath, itemsCsv(imageItems), "utf8");

console.log(
  JSON.stringify(
    {
      status: summary.status,
      ok: summary.ok,
      activeBatchId: summary.activeBatchId,
      productCount: summary.productCount,
      imageTaskCount: summary.imageTaskCount,
      expectedWebpFileCount: summary.expectedWebpFileCount,
      existingWebpFileCount: summary.existingWebpFileCount,
      missingWebpFileCount: summary.missingWebpFileCount,
      invalidWebpFileCount: summary.invalidWebpFileCount,
      outputDir: rel(outputDir),
    },
    null,
    2,
  ),
);

if (!summary.ok) {
  process.exitCode = 1;
}

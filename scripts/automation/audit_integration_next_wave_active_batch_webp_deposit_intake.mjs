import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessRoot = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessRoot, "tableaux-action");
const webpDepositRoot = path.join(
  actionRoot,
  "depots-webp-lot-actif-prochaine-vague-sourcing-integration-articles",
);
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
  "audit-depots-webp-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const allowedDepositPrefix = "business-maxi-trouvailles/depots-images-exactes/integration-articles/";
const requiredCsvHeaders = [
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
const requiredSafetyFlags = [
  "localDepositReadmesOnly",
  "noCatalogWrite",
  "noSupplierValueExport",
  "noPublication",
  "noPayment",
  "noSupplierOrder",
  "noExternalContact",
  "noImageDownload",
  "noImageFileCreated",
  "noPublicImageWrite",
  "manualValidationRequired",
  "proofIntakeAuditRequired",
  "microPacksAuditRequired",
];
const externalUrlPattern = /https?:\/\//i;
const forbiddenPattern = /\b(aliexpress|ali\s*express|alicdn|ae-pic|temu|dhgate|1688)\b/i;
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

function normalizeRel(value) {
  return String(value ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function resolveInsideRoot(relativePath) {
  const normalized = normalizeRel(relativePath);
  const absolutePath = path.resolve(root, normalized);
  const rootPath = path.resolve(root);
  if (!absolutePath.startsWith(`${rootPath}${path.sep}`)) {
    throw new Error(`Refusing to read outside workspace: ${relativePath}`);
  }

  return absolutePath;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ";" && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function readCsv(filePath) {
  if (!fs.existsSync(filePath)) return { headers: [], rows: [] };

  const lines = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });

  return { headers, rows };
}

function addIssue(issues, scope, code, message, details = {}) {
  issues.push({ scope, code, message, ...details });
}

function validateCsvHeaders(issues, csv) {
  for (const header of requiredCsvHeaders) {
    if (!csv.headers.includes(header)) {
      addIssue(issues, "webp_items_csv", "missing_csv_header", "Une colonne CSV obligatoire manque.", { header });
    }
  }
}

function isSafeDepositPath(value, dateKey) {
  const text = normalizeRel(value);
  return (
    text.startsWith(`${allowedDepositPrefix}${dateKey}/`) &&
    !text.includes("..") &&
    !path.isAbsolute(text) &&
    !externalUrlPattern.test(text) &&
    !forbiddenPattern.test(text) &&
    !sensitivePattern.test(text)
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

function scanSensitiveArtifacts(files) {
  const findings = [];
  for (const filePath of files) {
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      const checks = [
        ["external_url", externalUrlPattern],
        ["marketplace_marker", forbiddenPattern],
        ["sensitive_assignment", sensitivePattern],
        ["key_like_value", keyLikePattern],
      ];

      for (const [type, regex] of checks) {
        const match = line.match(regex);
        if (match) {
          findings.push({
            file: rel(filePath),
            line: index + 1,
            type,
            sample: match[0].slice(0, 80),
          });
        }
      }
    });
  }

  return findings;
}

function markdown(summary) {
  const issueRows =
    summary.issues.length === 0
      ? ["| OK | Aucun echec | - |"]
      : summary.issues.map(
          (issue) => `| ${mdCell(issue.scope)} | ${mdCell(issue.code)} | ${mdCell(issue.message)} |`,
        );

  return `${[
    "# Audit depots WebP lot actif prochaine vague",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Lot actif: ${summary.activeBatchId}`,
    `- Produits: ${summary.productCount}`,
    `- WebP attendus: ${summary.expectedWebpFileCount}`,
    `- WebP presents valides: ${summary.validExistingWebpFileCount}`,
    `- WebP manquants: ${summary.missingWebpFileCount}`,
    `- WebP invalides: ${summary.invalidWebpFileCount}`,
    `- READMEs: ${summary.readmeFileCount}`,
    `- CSV lignes: ${summary.csvRowCount}`,
    `- Fichiers scannes: ${summary.scannedFileCount}`,
    `- Echecs: ${summary.failureCount}`,
    `- Fuites sensibles: ${summary.sensitiveFindingCount}`,
    "",
    "## Echecs",
    "",
    "| Portee | Code | Message |",
    "|---|---|---|",
    ...issueRows,
    "",
    "## Garde-fous",
    "",
    "- Les images manquantes restent en HOLD.",
    "- Les fichiers presents doivent etre de vrais WebP.",
    "- Aucune image n'est creee automatiquement.",
    "- Aucune copie publique, aucun paiement, aucune commande fournisseur.",
    "",
  ].join("\n")}\n`;
}

function issuesCsv(issues) {
  const headers = ["scope", "code", "message"];
  return `${headers.join(";")}\n${issues
    .map((issue) => headers.map((header) => csvEscape(issue[header])).join(";"))
    .join("\n")}${issues.length > 0 ? "\n" : ""}`;
}

const { dateKey, localLabel } = datePartsParis();
const webpDepositPath = latestFile(
  webpDepositRoot,
  /WEBP_DEPOSIT_INTAKE_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch webp deposit intake",
);
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

const webpDeposit = readJson(webpDepositPath);
const microPacks = readJson(microPacksPath);
const microPacksAudit = readJson(microPacksAuditPath);
const proofIntakeAudit = readJson(proofIntakeAuditPath);
const outputDir = path.dirname(webpDepositPath);
const csvPath = path.join(outputDir, `depots-webp-lot-actif-items-${dateKey}.csv`);
const csv = readCsv(csvPath);
const issues = [];

if (webpDeposit.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_WEBP_DEPOSIT_INTAKE_READY") {
  addIssue(issues, "webp_deposit", "webp_deposit_status_invalid", "L'intake WebP doit rester pret en HOLD.", {
    status: webpDeposit.status,
  });
}

if (microPacks.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_MICRO_PACKS_READY") {
  addIssue(issues, "micro_packs", "micro_pack_status_invalid", "Les micro-packs source doivent rester en HOLD.", {
    status: microPacks.status,
  });
}

if (microPacksAudit.status !== "OK_NEXT_WAVE_ACTIVE_BATCH_MICRO_PACKS_GUARDED") {
  addIssue(issues, "micro_packs_audit", "micro_pack_audit_not_ok", "L'audit micro-packs source doit etre OK.", {
    status: microPacksAudit.status,
  });
}

if (proofIntakeAudit.status !== "OK_NEXT_WAVE_ACTIVE_BATCH_PROOF_INTAKE_GUARDED") {
  addIssue(issues, "proof_intake_audit", "proof_intake_audit_not_ok", "L'audit preuves source doit etre OK.", {
    status: proofIntakeAudit.status,
  });
}

if (
  webpDeposit.productCount !== 4 ||
  webpDeposit.imageTaskCount !== 12 ||
  webpDeposit.expectedWebpFileCount !== 12 ||
  webpDeposit.depositDirCount !== 4
) {
  addIssue(issues, "webp_deposit", "webp_deposit_scope_invalid", "L'intake WebP doit couvrir 4 produits et 12 WebP.", {
    productCount: webpDeposit.productCount,
    imageTaskCount: webpDeposit.imageTaskCount,
    expectedWebpFileCount: webpDeposit.expectedWebpFileCount,
    depositDirCount: webpDeposit.depositDirCount,
  });
}

if ((webpDeposit.existingWebpFileCount ?? 0) + (webpDeposit.missingWebpFileCount ?? 0) !== 12) {
  addIssue(issues, "webp_deposit", "webp_count_mismatch", "Les compteurs WebP presents/manquants sont incoherents.", {
    existing: webpDeposit.existingWebpFileCount,
    missing: webpDeposit.missingWebpFileCount,
  });
}

validateCsvHeaders(issues, csv);
if (csv.rows.length !== 12) {
  addIssue(issues, "webp_items_csv", "csv_row_count_invalid", "Le CSV doit contenir 12 lignes WebP.", {
    csvRows: csv.rows.length,
  });
}

for (const flag of requiredSafetyFlags) {
  if (webpDeposit.safety?.[flag] !== true) {
    addIssue(issues, "safety", "missing_safety_flag", "Un garde-fou intake WebP est absent.", { flag });
  }
}

const readmeFiles = [];
let validExistingWebpFileCount = 0;
let missingWebpFileCount = 0;
let invalidWebpFileCount = 0;

for (const image of webpDeposit.images ?? []) {
  if (image.status !== "TO_DEPOSIT_HOLD") {
    addIssue(issues, image.productId, "image_status_invalid", "Une image doit rester TO_DEPOSIT_HOLD.", {
      status: image.status,
      targetPath: image.targetPath,
    });
  }
  if (!String(image.expectedFileName ?? "").endsWith(".webp")) {
    addIssue(issues, image.productId, "expected_webp_name_invalid", "Le fichier attendu doit etre en .webp.", {
      expectedFileName: image.expectedFileName,
    });
  }
  if (!isSafeDepositPath(image.depositDir, dateKey) || !isSafeDepositPath(image.targetPath, dateKey)) {
    addIssue(issues, image.productId, "image_deposit_path_invalid", "Chemin depot WebP invalide.", {
      depositDir: image.depositDir,
      targetPath: image.targetPath,
    });
    continue;
  }

  if (!fs.existsSync(resolveInsideRoot(image.depositDir))) {
    addIssue(issues, image.productId, "deposit_dir_missing", "Un dossier depot WebP attendu manque.", {
      depositDir: image.depositDir,
    });
  }

  const state = webpState(image.targetPath);
  if (state === "present_valid_header") validExistingWebpFileCount += 1;
  if (state === "missing") missingWebpFileCount += 1;
  if (state === "present_invalid_header") {
    invalidWebpFileCount += 1;
    addIssue(issues, image.productId, "invalid_webp_file", "Un fichier WebP present n'a pas une signature valide.", {
      targetPath: image.targetPath,
    });
  }
}

for (const product of webpDeposit.products ?? []) {
  if (!product.readmePath || !isSafeDepositPath(product.readmePath, dateKey)) {
    addIssue(issues, product.productId, "readme_path_invalid", "Chemin README depot invalide.", {
      readmePath: product.readmePath,
    });
    continue;
  }

  const readmePath = resolveInsideRoot(product.readmePath);
  if (!fs.existsSync(readmePath)) {
    addIssue(issues, product.productId, "readme_missing", "Un README depot attendu manque.", {
      readmePath: product.readmePath,
    });
    continue;
  }

  const content = fs.readFileSync(readmePath, "utf8");
  readmeFiles.push(readmePath);
  for (const marker of [
    "Statut: HOLD_WEBP_DEPOSIT_INTAKE_READY",
    "- Pas d'image approximative.",
    "- Pas de copie vers public/uploads.",
    "- Ne pas publier.",
    "- Ne pas commander fournisseur.",
  ]) {
    if (!content.includes(marker)) {
      addIssue(issues, product.productId, "readme_marker_missing", "Un marqueur HOLD manque dans un README depot.", {
        readmePath: product.readmePath,
        marker,
      });
    }
  }
}

for (const row of csv.rows) {
  if (row.status !== "TO_DEPOSIT_HOLD") {
    addIssue(issues, row.product_id, "csv_status_invalid", "Une ligne CSV WebP doit rester TO_DEPOSIT_HOLD.", {
      status: row.status,
    });
  }
  if (!String(row.expected_file_name ?? "").endsWith(".webp")) {
    addIssue(issues, row.product_id, "csv_expected_webp_name_invalid", "Une ligne CSV n'attend pas un .webp.", {
      expectedFileName: row.expected_file_name,
    });
  }
  if (!isSafeDepositPath(row.deposit_dir, dateKey) || !isSafeDepositPath(row.target_path, dateKey)) {
    addIssue(issues, row.product_id, "csv_deposit_path_invalid", "Une ligne CSV a un chemin depot invalide.", {
      depositDir: row.deposit_dir,
      targetPath: row.target_path,
    });
  }
}

const scannedFiles = [
  ...walkFiles(outputDir, (filePath) => [".json", ".md", ".csv"].includes(path.extname(filePath).toLowerCase())),
  ...readmeFiles,
];
const sensitiveFindings = scanSensitiveArtifacts(scannedFiles);
for (const finding of sensitiveFindings) {
  addIssue(issues, "sensitive_scan", "sensitive_finding", "Marqueur sensible detecte dans l'intake WebP.", finding);
}

const summary = {
  ok: issues.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_audit_integration_next_wave_active_batch_webp_deposit_intake",
  status: issues.length === 0 ? "OK_NEXT_WAVE_ACTIVE_BATCH_WEBP_DEPOSIT_INTAKE_GUARDED" : "FAIL_NEXT_WAVE_ACTIVE_BATCH_WEBP_DEPOSIT_INTAKE",
  activeBatchId: webpDeposit.activeBatchId,
  productCount: webpDeposit.productCount ?? 0,
  imageTaskCount: webpDeposit.imageTaskCount ?? 0,
  expectedWebpFileCount: webpDeposit.expectedWebpFileCount ?? 0,
  validExistingWebpFileCount,
  existingWebpFileCount: validExistingWebpFileCount + invalidWebpFileCount,
  missingWebpFileCount,
  invalidWebpFileCount,
  readmeFileCount: readmeFiles.length,
  csvRowCount: csv.rows.length,
  failureCount: issues.length,
  sensitiveFindingCount: sensitiveFindings.length,
  scannedFileCount: scannedFiles.length,
  issues,
  sources: {
    webpDepositPath: rel(webpDepositPath),
    microPacksPath: rel(microPacksPath),
    microPacksAuditPath: rel(microPacksAuditPath),
    proofIntakeAuditPath: rel(proofIntakeAuditPath),
    csvPath: rel(csvPath),
  },
  safety: {
    readOnlyAudit: true,
    noCatalogWrite: true,
    noSupplierValueExport: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noExternalContact: true,
    noImageDownload: true,
    noImageFileCreated: true,
    noPublicImageWrite: true,
  },
};

const auditDir = path.join(outputRoot, dateKey);
fs.mkdirSync(auditDir, { recursive: true });

const jsonPath = path.join(auditDir, `AUDIT_WEBP_DEPOSIT_INTAKE_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(auditDir, `audit-depots-webp-lot-actif-prochaine-vague-sourcing-${dateKey}.md`);
const issueCsvPath = path.join(auditDir, `audit-depots-webp-lot-actif-prochaine-vague-sourcing-issues-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(issueCsvPath, issuesCsv(issues), "utf8");

console.log(
  JSON.stringify(
    {
      status: summary.status,
      ok: summary.ok,
      activeBatchId: summary.activeBatchId,
      productCount: summary.productCount,
      imageTaskCount: summary.imageTaskCount,
      expectedWebpFileCount: summary.expectedWebpFileCount,
      validExistingWebpFileCount: summary.validExistingWebpFileCount,
      missingWebpFileCount: summary.missingWebpFileCount,
      invalidWebpFileCount: summary.invalidWebpFileCount,
      readmeFileCount: summary.readmeFileCount,
      failureCount: summary.failureCount,
      sensitiveFindingCount: summary.sensitiveFindingCount,
      outputDir: rel(auditDir),
    },
    null,
    2,
  ),
);

if (!summary.ok) {
  process.exitCode = 1;
}

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessRoot = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessRoot, "tableaux-action");
const contractsRoot = path.join(
  actionRoot,
  "contrats-validation-webp-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const webpDepositRoot = path.join(
  actionRoot,
  "depots-webp-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const webpDepositAuditRoot = path.join(
  actionRoot,
  "audit-depots-webp-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const outputRoot = path.join(
  actionRoot,
  "audit-contrats-validation-webp-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const allowedDepositPrefix = "business-maxi-trouvailles/depots-images-exactes/integration-articles/";
const requiredCsvHeaders = [
  "product_rank",
  "batch_id",
  "product_id",
  "product_name",
  "image_order",
  "image_role",
  "expected_webp_file",
  "webp_file_state",
  "contract_status",
  "decision_status",
  "target_path",
  "contract_path",
];
const requiredSafetyFlags = [
  "localSidecarsOnly",
  "noCatalogWrite",
  "noPublicImageWrite",
  "noImageDownload",
  "noImageGeneration",
  "noSupplierValueExport",
  "noPublication",
  "noPayment",
  "noSupplierOrder",
  "manualValidationRequired",
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
  if (/[",\n\r;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
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

function webpFileState(targetPath) {
  const absolutePath = resolveInsideRoot(targetPath);
  if (!fs.existsSync(absolutePath)) return "missing";
  const buffer = fs.readFileSync(absolutePath);
  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return isWebp ? "present_valid_header" : "present_invalid_header";
}

function validateCsvHeaders(issues, csv) {
  for (const header of requiredCsvHeaders) {
    if (!csv.headers.includes(header)) {
      addIssue(issues, "contracts_csv", "missing_csv_header", "Une colonne CSV obligatoire manque.", { header });
    }
  }
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
    "# Audit contrats validation WebP lot actif",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Lot actif: ${summary.activeBatchId}`,
    `- Produits: ${summary.productCount}`,
    `- Contrats: ${summary.contractFileCount}`,
    `- Contrats HOLD: ${summary.blockedContractCount}`,
    `- WebP valides presents: ${summary.validWebpFileCount}`,
    `- WebP manquants: ${summary.missingWebpFileCount}`,
    `- WebP invalides: ${summary.invalidWebpFileCount}`,
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
    "- Les contrats ne valident jamais une publication.",
    "- Ils restent bloques tant que Mouss n'a pas valide.",
    "- Les WebP presents doivent garder une signature WebP valide.",
    "- Aucun fournisseur ou marketplace ne doit sortir dans les artefacts.",
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
const contractsPath = latestFile(
  contractsRoot,
  /WEBP_VALIDATION_CONTRACTS_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch webp validation contracts",
);
const webpDepositPath = latestFile(
  webpDepositRoot,
  /WEBP_DEPOSIT_INTAKE_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch webp deposit intake",
);
const webpDepositAuditPath = latestFile(
  webpDepositAuditRoot,
  /AUDIT_WEBP_DEPOSIT_INTAKE_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch webp deposit audit",
);

const contractsSummary = readJson(contractsPath);
const webpDeposit = readJson(webpDepositPath);
const webpDepositAudit = readJson(webpDepositAuditPath);
const outputDir = path.dirname(contractsPath);
const csvPath = path.join(outputDir, `contrats-validation-webp-lot-actif-items-${dateKey}.csv`);
const csv = readCsv(csvPath);
const issues = [];

if (contractsSummary.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_WEBP_VALIDATION_CONTRACTS_READY") {
  addIssue(issues, "contracts", "contracts_status_invalid", "Les contrats WebP doivent etre prets en HOLD.", {
    status: contractsSummary.status,
  });
}

if (webpDeposit.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_WEBP_DEPOSIT_INTAKE_READY") {
  addIssue(issues, "webp_deposit", "webp_deposit_status_invalid", "L'intake depot WebP source doit rester en HOLD.", {
    status: webpDeposit.status,
  });
}

if (webpDepositAudit.status !== "OK_NEXT_WAVE_ACTIVE_BATCH_WEBP_DEPOSIT_INTAKE_GUARDED") {
  addIssue(issues, "webp_deposit_audit", "webp_deposit_audit_not_ok", "L'audit depot WebP source doit etre OK.", {
    status: webpDepositAudit.status,
  });
}

if (
  contractsSummary.productCount !== 4 ||
  contractsSummary.imageTaskCount !== 12 ||
  contractsSummary.contractFileCount !== 12
) {
  addIssue(issues, "contracts", "contract_scope_invalid", "Les contrats doivent couvrir 4 produits et 12 WebP.", {
    productCount: contractsSummary.productCount,
    imageTaskCount: contractsSummary.imageTaskCount,
    contractFileCount: contractsSummary.contractFileCount,
  });
}

validateCsvHeaders(issues, csv);
if (csv.rows.length !== 12) {
  addIssue(issues, "contracts_csv", "csv_row_count_invalid", "Le CSV contrats doit contenir 12 lignes.", {
    csvRows: csv.rows.length,
  });
}

for (const flag of requiredSafetyFlags) {
  if (contractsSummary.safety?.[flag] !== true) {
    addIssue(issues, "safety", "missing_safety_flag", "Un garde-fou contrats WebP est absent.", { flag });
  }
}

let validWebpFileCount = 0;
let missingWebpFileCount = 0;
let invalidWebpFileCount = 0;
let blockedContractCount = 0;
const contractFiles = [];

for (const contractRef of contractsSummary.contracts ?? []) {
  if (!isSafeDepositPath(contractRef.targetPath, dateKey) || !isSafeDepositPath(contractRef.contractPath, dateKey)) {
    addIssue(issues, contractRef.productId, "contract_path_invalid", "Un chemin contrat/WebP est invalide.", {
      targetPath: contractRef.targetPath,
      contractPath: contractRef.contractPath,
    });
    continue;
  }

  const contractPath = resolveInsideRoot(contractRef.contractPath);
  if (!fs.existsSync(contractPath)) {
    addIssue(issues, contractRef.productId, "contract_file_missing", "Un fichier contrat WebP manque.", {
      contractPath: contractRef.contractPath,
    });
    continue;
  }

  const contract = readJson(contractPath);
  contractFiles.push(contractPath);
  if (contract.schemaVersion !== "maxi-webp-validation-contract-v1") {
    addIssue(issues, contract.productId, "contract_schema_invalid", "Schema contrat WebP invalide.", {
      schemaVersion: contract.schemaVersion,
    });
  }
  if (contract.status !== "WEBP_VALIDATION_CONTRACT_HOLD") {
    addIssue(issues, contract.productId, "contract_status_invalid", "Un contrat WebP doit rester en HOLD.", {
      status: contract.status,
    });
  }
  if (contract.decision?.status !== "BLOCKED_HOLD") {
    addIssue(issues, contract.productId, "contract_decision_not_blocked", "Un contrat doit rester bloque avant Mouss.", {
      decisionStatus: contract.decision?.status,
    });
  } else {
    blockedContractCount += 1;
  }
  if (contract.decision?.mayCopyToPublicUploads !== false || contract.decision?.mayPublishProduct !== false) {
    addIssue(issues, contract.productId, "contract_unlocked_public_action", "Un contrat ne doit pas autoriser la copie/publication.", {
      contractPath: contractRef.contractPath,
    });
  }
  if (contract.acceptanceChecks?.moussValidationApproved !== false) {
    addIssue(issues, contract.productId, "mouss_validation_not_blocked", "La validation Mouss doit rester non approuvee.", {
      contractPath: contractRef.contractPath,
    });
  }

  const state = webpFileState(contract.targetPath);
  if (state === "present_valid_header") validWebpFileCount += 1;
  if (state === "missing") missingWebpFileCount += 1;
  if (state === "present_invalid_header") {
    invalidWebpFileCount += 1;
    addIssue(issues, contract.productId, "invalid_webp_file", "Un WebP present a une signature invalide.", {
      targetPath: contract.targetPath,
    });
  }
}

for (const row of csv.rows) {
  if (row.contract_status !== "WEBP_VALIDATION_CONTRACT_HOLD" || row.decision_status !== "BLOCKED_HOLD") {
    addIssue(issues, row.product_id, "csv_contract_status_invalid", "Une ligne CSV contrat doit rester HOLD/BLOCKED.", {
      contractStatus: row.contract_status,
      decisionStatus: row.decision_status,
    });
  }
  if (!isSafeDepositPath(row.target_path, dateKey) || !isSafeDepositPath(row.contract_path, dateKey)) {
    addIssue(issues, row.product_id, "csv_contract_path_invalid", "Une ligne CSV a un chemin contrat/WebP invalide.", {
      targetPath: row.target_path,
      contractPath: row.contract_path,
    });
  }
}

const scannedFiles = [
  ...walkFiles(outputDir, (filePath) => [".json", ".md", ".csv"].includes(path.extname(filePath).toLowerCase())),
  ...contractFiles,
];
const sensitiveFindings = scanSensitiveArtifacts(scannedFiles);
for (const finding of sensitiveFindings) {
  addIssue(issues, "sensitive_scan", "sensitive_finding", "Marqueur sensible detecte dans les contrats WebP.", finding);
}

const summary = {
  ok: issues.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_audit_integration_next_wave_active_batch_webp_validation_contracts",
  status:
    issues.length === 0
      ? "OK_NEXT_WAVE_ACTIVE_BATCH_WEBP_VALIDATION_CONTRACTS_GUARDED"
      : "FAIL_NEXT_WAVE_ACTIVE_BATCH_WEBP_VALIDATION_CONTRACTS",
  activeBatchId: contractsSummary.activeBatchId,
  productCount: contractsSummary.productCount ?? 0,
  imageTaskCount: contractsSummary.imageTaskCount ?? 0,
  contractFileCount: contractsSummary.contractFileCount ?? 0,
  blockedContractCount,
  validWebpFileCount,
  missingWebpFileCount,
  invalidWebpFileCount,
  csvRowCount: csv.rows.length,
  failureCount: issues.length,
  sensitiveFindingCount: sensitiveFindings.length,
  scannedFileCount: scannedFiles.length,
  issues,
  sources: {
    contractsPath: rel(contractsPath),
    webpDepositPath: rel(webpDepositPath),
    webpDepositAuditPath: rel(webpDepositAuditPath),
    csvPath: rel(csvPath),
  },
  safety: {
    readOnlyAudit: true,
    noCatalogWrite: true,
    noPublicImageWrite: true,
    noImageDownload: true,
    noImageGeneration: true,
    noSupplierValueExport: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

const auditDir = path.join(outputRoot, dateKey);
fs.mkdirSync(auditDir, { recursive: true });

const jsonPath = path.join(
  auditDir,
  `AUDIT_WEBP_VALIDATION_CONTRACTS_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`,
);
const mdPath = path.join(auditDir, `audit-contrats-validation-webp-lot-actif-prochaine-vague-sourcing-${dateKey}.md`);
const issueCsvPath = path.join(
  auditDir,
  `audit-contrats-validation-webp-lot-actif-prochaine-vague-sourcing-issues-${dateKey}.csv`,
);

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
      contractFileCount: summary.contractFileCount,
      blockedContractCount: summary.blockedContractCount,
      validWebpFileCount: summary.validWebpFileCount,
      missingWebpFileCount: summary.missingWebpFileCount,
      invalidWebpFileCount: summary.invalidWebpFileCount,
      failureCount: summary.failureCount,
      sensitiveFindingCount: summary.sensitiveFindingCount,
      outputDir: rel(auditDir),
    },
    null,
    2,
  ),
);

if (!summary.ok) process.exitCode = 1;

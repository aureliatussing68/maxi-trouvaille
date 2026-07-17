import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessRoot = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessRoot, "tableaux-action");
const boardRoot = path.join(
  actionRoot,
  "revue-mouss-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const proofIntakeAuditRoot = path.join(
  actionRoot,
  "audit-preuves-internes-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const webpContractsAuditRoot = path.join(
  actionRoot,
  "audit-contrats-validation-webp-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const outputRoot = path.join(
  actionRoot,
  "audit-revue-mouss-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const requiredCsvHeaders = [
  "rank",
  "batch_id",
  "product_id",
  "product_name",
  "category_id",
  "review_decision",
  "proof_todo_count",
  "webp_missing_count",
  "blocked_contract_count",
  "business_blocker_count",
  "next_mouss_action",
  "proof_files",
  "contract_files",
];
const requiredSafetyFlags = [
  "readOnlyBoard",
  "noCatalogWrite",
  "noPublicImageWrite",
  "noImageDownload",
  "noImageGeneration",
  "noSupplierValueExport",
  "noPublication",
  "noPayment",
  "noSupplierOrder",
  "noMessageSent",
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

function validateCsvHeaders(issues, csv) {
  for (const header of requiredCsvHeaders) {
    if (!csv.headers.includes(header)) {
      addIssue(issues, "mouss_review_csv", "missing_csv_header", "Une colonne CSV obligatoire manque.", { header });
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
    "# Audit revue Mouss lot actif",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Lot actif: ${summary.activeBatchId}`,
    `- Produits: ${summary.productCount}`,
    `- Prets revue Mouss: ${summary.readyForMoussReviewCount}`,
    `- Bloques HOLD: ${summary.blockedProductCount}`,
    `- Preuves a remplir: ${summary.proofTodoCount}`,
    `- WebP manquants: ${summary.webpMissingCount}`,
    `- Contrats bloques: ${summary.blockedContractCount}`,
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
    "- La revue est un board interne en lecture seule.",
    "- Aucun statut ne publie automatiquement.",
    "- Les blocages HOLD restent attendus tant que les preuves et images manquent.",
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
const boardPath = latestFile(
  boardRoot,
  /MOUSS_REVIEW_BOARD_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch Mouss review board",
);
const proofIntakeAuditPath = latestFile(
  proofIntakeAuditRoot,
  /AUDIT_PROOF_INTAKE_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch proof intake audit",
);
const webpContractsAuditPath = latestFile(
  webpContractsAuditRoot,
  /AUDIT_WEBP_VALIDATION_CONTRACTS_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch webp validation contracts audit",
);

const board = readJson(boardPath);
const proofIntakeAudit = readJson(proofIntakeAuditPath);
const webpContractsAudit = readJson(webpContractsAuditPath);
const csvPath = path.join(path.dirname(boardPath), `revue-mouss-lot-actif-produits-${dateKey}.csv`);
const csv = readCsv(csvPath);
const issues = [];

if (board.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_MOUSS_REVIEW_BOARD_READY") {
  addIssue(issues, "mouss_review", "mouss_review_status_invalid", "Le board revue Mouss doit etre pret en HOLD.", {
    status: board.status,
  });
}
if (proofIntakeAudit.status !== "OK_NEXT_WAVE_ACTIVE_BATCH_PROOF_INTAKE_GUARDED") {
  addIssue(issues, "proof_intake_audit", "proof_intake_audit_not_ok", "L'audit preuves source doit etre OK.", {
    status: proofIntakeAudit.status,
  });
}
if (webpContractsAudit.status !== "OK_NEXT_WAVE_ACTIVE_BATCH_WEBP_VALIDATION_CONTRACTS_GUARDED") {
  addIssue(issues, "webp_contracts_audit", "webp_contracts_audit_not_ok", "L'audit contrats WebP source doit etre OK.", {
    status: webpContractsAudit.status,
  });
}

if (
  board.productCount !== 4 ||
  board.proofFileCount !== 20 ||
  board.contractFileCount !== 12 ||
  board.businessBlockerCount !== 32
) {
  addIssue(issues, "mouss_review", "mouss_review_scope_invalid", "Le board doit couvrir 4 produits, 20 preuves, 12 contrats et 32 blocages.", {
    productCount: board.productCount,
    proofFileCount: board.proofFileCount,
    contractFileCount: board.contractFileCount,
    businessBlockerCount: board.businessBlockerCount,
  });
}

if (board.readyForMoussReviewCount !== 0 || board.blockedProductCount !== 4) {
  addIssue(issues, "mouss_review", "mouss_review_readiness_invalid", "Aucun produit ne doit etre pret tant que les preuves/WebP manquent.", {
    readyForMoussReviewCount: board.readyForMoussReviewCount,
    blockedProductCount: board.blockedProductCount,
  });
}

if (board.proofTodoCount !== 20 || board.webpMissingCount !== 12 || board.blockedContractCount !== 12) {
  addIssue(issues, "mouss_review", "mouss_review_blocker_counts_invalid", "Les compteurs de blocage Mouss sont incoherents.", {
    proofTodoCount: board.proofTodoCount,
    webpMissingCount: board.webpMissingCount,
    blockedContractCount: board.blockedContractCount,
  });
}

for (const product of board.products ?? []) {
  if (product.reviewDecision !== "BLOCKED_MOUSS_REVIEW_HOLD") {
    addIssue(issues, product.productId, "product_decision_invalid", "Chaque produit doit rester bloque en revue Mouss HOLD.", {
      reviewDecision: product.reviewDecision,
    });
  }
  if (product.proofTodoCount !== 5 || product.webpMissingCount !== 3 || product.blockedContractCount !== 3) {
    addIssue(issues, product.productId, "product_blocker_counts_invalid", "Un produit n'a pas les compteurs 5 preuves / 3 WebP / 3 contrats attendus.", {
      proofTodoCount: product.proofTodoCount,
      webpMissingCount: product.webpMissingCount,
      blockedContractCount: product.blockedContractCount,
    });
  }
}

validateCsvHeaders(issues, csv);
if (csv.rows.length !== 4) {
  addIssue(issues, "mouss_review_csv", "csv_row_count_invalid", "Le CSV revue Mouss doit contenir 4 lignes.", {
    csvRows: csv.rows.length,
  });
}
for (const row of csv.rows) {
  if (row.review_decision !== "BLOCKED_MOUSS_REVIEW_HOLD") {
    addIssue(issues, row.product_id, "csv_decision_invalid", "Une ligne CSV revue Mouss doit rester bloquee HOLD.", {
      reviewDecision: row.review_decision,
    });
  }
}

for (const flag of requiredSafetyFlags) {
  if (board.safety?.[flag] !== true) {
    addIssue(issues, "safety", "missing_safety_flag", "Un garde-fou revue Mouss est absent.", { flag });
  }
}

const scannedFiles = walkFiles(path.dirname(boardPath), (filePath) =>
  [".json", ".md", ".csv"].includes(path.extname(filePath).toLowerCase()),
);
const sensitiveFindings = scanSensitiveArtifacts(scannedFiles);
for (const finding of sensitiveFindings) {
  addIssue(issues, "sensitive_scan", "sensitive_finding", "Marqueur sensible detecte dans le board revue Mouss.", finding);
}

const summary = {
  ok: issues.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_audit_integration_next_wave_active_batch_mouss_review_board",
  status:
    issues.length === 0
      ? "OK_NEXT_WAVE_ACTIVE_BATCH_MOUSS_REVIEW_BOARD_GUARDED"
      : "FAIL_NEXT_WAVE_ACTIVE_BATCH_MOUSS_REVIEW_BOARD",
  activeBatchId: board.activeBatchId,
  productCount: board.productCount ?? 0,
  readyForMoussReviewCount: board.readyForMoussReviewCount ?? 0,
  blockedProductCount: board.blockedProductCount ?? 0,
  proofTodoCount: board.proofTodoCount ?? 0,
  webpMissingCount: board.webpMissingCount ?? 0,
  blockedContractCount: board.blockedContractCount ?? 0,
  businessBlockerCount: board.businessBlockerCount ?? 0,
  csvRowCount: csv.rows.length,
  failureCount: issues.length,
  sensitiveFindingCount: sensitiveFindings.length,
  scannedFileCount: scannedFiles.length,
  issues,
  sources: {
    boardPath: rel(boardPath),
    proofIntakeAuditPath: rel(proofIntakeAuditPath),
    webpContractsAuditPath: rel(webpContractsAuditPath),
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
    noMessageSent: true,
  },
};

const auditDir = path.join(outputRoot, dateKey);
fs.mkdirSync(auditDir, { recursive: true });

const jsonPath = path.join(auditDir, `AUDIT_MOUSS_REVIEW_BOARD_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(auditDir, `audit-revue-mouss-lot-actif-prochaine-vague-sourcing-${dateKey}.md`);
const issueCsvPath = path.join(auditDir, `audit-revue-mouss-lot-actif-prochaine-vague-sourcing-issues-${dateKey}.csv`);

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
      readyForMoussReviewCount: summary.readyForMoussReviewCount,
      blockedProductCount: summary.blockedProductCount,
      proofTodoCount: summary.proofTodoCount,
      webpMissingCount: summary.webpMissingCount,
      blockedContractCount: summary.blockedContractCount,
      failureCount: summary.failureCount,
      sensitiveFindingCount: summary.sensitiveFindingCount,
      outputDir: rel(auditDir),
    },
    null,
    2,
  ),
);

if (!summary.ok) process.exitCode = 1;

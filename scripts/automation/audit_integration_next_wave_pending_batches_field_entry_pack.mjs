import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const packRoot = path.join(
  actionRoot,
  "pack-saisie-terrain-lots-suivants-prochaine-vague-sourcing-integration-articles",
);
const runwayAuditRoot = path.join(
  actionRoot,
  "audit-runway-lots-suivants-prochaine-vague-sourcing-integration-articles",
);
const outputRoot = path.join(
  actionRoot,
  "audit-pack-saisie-terrain-lots-suivants-prochaine-vague-sourcing-integration-articles",
);

const requiredCsvHeaders = [
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
const requiredSafetyFlags = [
  "localFieldEntryPackOnly",
  "readOnlyRunway",
  "noActiveBatchReplacement",
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
      addIssue(issues, "field_entry_csv", "missing_csv_header", "Une colonne CSV obligatoire manque.", { header });
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
    "# Audit pack saisie terrain lots suivants",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Lots en attente: ${summary.pendingBatchCount}`,
    `- Produits: ${summary.productCount}`,
    `- Entrees: ${summary.entryCount}`,
    `- Preuves: ${summary.proofEntryCount}`,
    `- WebP: ${summary.webpEntryCount}`,
    `- Fiches terrain: ${summary.productSheetCount}`,
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
    "- Audit lecture seule.",
    "- Aucune publication ou copie image.",
    "- Les entrees restent en HOLD.",
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
const packPath = latestFile(
  packRoot,
  /PENDING_BATCHES_FIELD_ENTRY_PACK_NEXT_WAVE_SOURCING_INTEGRATION_\d{8}\.json$/,
  "next wave pending batches field entry pack",
);
const runwayAuditPath = latestFile(
  runwayAuditRoot,
  /AUDIT_PENDING_BATCHES_RUNWAY_NEXT_WAVE_SOURCING_INTEGRATION_\d{8}\.json$/,
  "next wave pending batches runway audit",
);

const pack = readJson(packPath);
const runwayAudit = readJson(runwayAuditPath);
const csvPath = path.join(path.dirname(packPath), `pack-saisie-terrain-lots-suivants-entrees-${dateKey}.csv`);
const csv = readCsv(csvPath);
const issues = [];

if (pack.status !== "HOLD_NEXT_WAVE_PENDING_BATCHES_FIELD_ENTRY_PACK_READY") {
  addIssue(issues, "field_entry_pack", "field_entry_pack_status_invalid", "Le pack saisie terrain doit etre pret en HOLD.", {
    status: pack.status,
  });
}
if (runwayAudit.status !== "OK_NEXT_WAVE_PENDING_BATCHES_RUNWAY_GUARDED" || runwayAudit.failureCount !== 0) {
  addIssue(issues, "runway_audit", "runway_audit_not_ok", "L'audit runway source doit etre OK.", {
    status: runwayAudit.status,
    failureCount: runwayAudit.failureCount,
  });
}
if (
  pack.pendingBatchCount !== 2 ||
  pack.productCount !== 8 ||
  pack.entryCount !== 64 ||
  pack.proofEntryCount !== 40 ||
  pack.webpEntryCount !== 24 ||
  pack.productSheetCount !== 8
) {
  addIssue(issues, "field_entry_pack", "field_entry_scope_invalid", "Le pack doit couvrir 2 lots, 8 produits, 40 preuves, 24 WebP et 8 fiches.", {
    pendingBatchCount: pack.pendingBatchCount,
    productCount: pack.productCount,
    entryCount: pack.entryCount,
    proofEntryCount: pack.proofEntryCount,
    webpEntryCount: pack.webpEntryCount,
    productSheetCount: pack.productSheetCount,
  });
}
if (pack.blockedEntryCount !== 64 || pack.readyEntryCount !== 0) {
  addIssue(issues, "field_entry_pack", "field_entry_readiness_invalid", "Toutes les entrees doivent rester bloquees HOLD.", {
    blockedEntryCount: pack.blockedEntryCount,
    readyEntryCount: pack.readyEntryCount,
  });
}
if (pack.activeBatchBlockedHold !== true) {
  addIssue(issues, "active_batch", "active_batch_not_blocked", "Le lot actif doit rester bloque HOLD.", {
    activeBatchBlockedHold: pack.activeBatchBlockedHold,
  });
}

for (const product of pack.products ?? []) {
  if (product.proofEntryCount !== 5 || product.webpEntryCount !== 3 || product.blockedEntryCount !== 8) {
    addIssue(issues, product.productId, "product_entry_counts_invalid", "Chaque fiche doit contenir 5 preuves et 3 WebP.", {
      proofEntryCount: product.proofEntryCount,
      webpEntryCount: product.webpEntryCount,
      blockedEntryCount: product.blockedEntryCount,
    });
  }
  if (!product.sheetPath || !fs.existsSync(path.join(root, product.sheetPath))) {
    addIssue(issues, product.productId, "product_sheet_missing", "Une fiche terrain produit manque.", {
      sheetPath: product.sheetPath,
    });
  }
}

for (const entry of pack.entries ?? []) {
  const expectedStatus = entry.entryType === "proof" ? "TO_FILL_HOLD" : "TO_DEPOSIT_HOLD";
  if (entry.status !== expectedStatus) {
    addIssue(issues, entry.productId, "entry_status_invalid", "Une entree n'a pas le statut HOLD attendu.", {
      entryType: entry.entryType,
      status: entry.status,
      expectedStatus,
    });
  }
  if (!entry.targetPath) {
    addIssue(issues, entry.productId, "entry_target_missing", "Une entree n'a pas de chemin cible.", {
      entryType: entry.entryType,
      order: entry.order,
    });
  }
}

validateCsvHeaders(issues, csv);
if (csv.rows.length !== 64) {
  addIssue(issues, "field_entry_csv", "csv_row_count_invalid", "Le CSV saisie terrain doit contenir 64 lignes.", {
    csvRows: csv.rows.length,
  });
}

for (const flag of requiredSafetyFlags) {
  if (pack.safety?.[flag] !== true) {
    addIssue(issues, "safety", "missing_safety_flag", "Un garde-fou pack saisie terrain est absent.", { flag });
  }
}

const scannedFiles = walkFiles(path.dirname(packPath), (filePath) =>
  [".json", ".md", ".csv"].includes(path.extname(filePath).toLowerCase()),
);
const sensitiveFindings = scanSensitiveArtifacts(scannedFiles);
for (const finding of sensitiveFindings) {
  addIssue(issues, "sensitive_scan", "sensitive_finding", "Marqueur sensible detecte dans le pack saisie terrain.", finding);
}

const summary = {
  ok: issues.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_audit_integration_next_wave_pending_batches_field_entry_pack",
  status:
    issues.length === 0
      ? "OK_NEXT_WAVE_PENDING_BATCHES_FIELD_ENTRY_PACK_GUARDED"
      : "FAIL_NEXT_WAVE_PENDING_BATCHES_FIELD_ENTRY_PACK",
  activeBatchId: pack.activeBatchId,
  pendingBatchCount: pack.pendingBatchCount ?? 0,
  productCount: pack.productCount ?? 0,
  entryCount: pack.entryCount ?? 0,
  proofEntryCount: pack.proofEntryCount ?? 0,
  webpEntryCount: pack.webpEntryCount ?? 0,
  blockedEntryCount: pack.blockedEntryCount ?? 0,
  readyEntryCount: pack.readyEntryCount ?? 0,
  productSheetCount: pack.productSheetCount ?? 0,
  csvRowCount: csv.rows.length,
  failureCount: issues.length,
  sensitiveFindingCount: sensitiveFindings.length,
  scannedFileCount: scannedFiles.length,
  issues,
  sources: {
    packPath: rel(packPath),
    runwayAuditPath: rel(runwayAuditPath),
    csvPath: rel(csvPath),
  },
  safety: {
    readOnlyAudit: true,
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
  },
};

const auditDir = path.join(outputRoot, dateKey);
fs.mkdirSync(auditDir, { recursive: true });

const jsonPath = path.join(auditDir, `AUDIT_PENDING_BATCHES_FIELD_ENTRY_PACK_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(auditDir, `audit-pack-saisie-terrain-lots-suivants-prochaine-vague-sourcing-${dateKey}.md`);
const issueCsvPath = path.join(auditDir, `audit-pack-saisie-terrain-lots-suivants-prochaine-vague-sourcing-issues-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(issueCsvPath, issuesCsv(issues), "utf8");

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
      failureCount: summary.failureCount,
      sensitiveFindingCount: summary.sensitiveFindingCount,
      outputDir: rel(auditDir),
    },
    null,
    2,
  ),
);

if (!summary.ok) process.exitCode = 1;

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const runwayRoot = path.join(
  actionRoot,
  "runway-lots-suivants-prochaine-vague-sourcing-integration-articles",
);
const outputRoot = path.join(
  actionRoot,
  "audit-runway-lots-suivants-prochaine-vague-sourcing-integration-articles",
);

const requiredSafetyFlags = [
  "readOnlyRunway",
  "noActiveBatchReplacement",
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

function addIssue(issues, scope, code, message, details = {}) {
  issues.push({ scope, code, message, ...details });
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
    "# Audit runway lots suivants",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Lots en attente: ${summary.pendingBatchCount}`,
    `- Produits en attente: ${summary.pendingProductCount}`,
    `- Preuves: ${summary.proofTaskCount}`,
    `- WebP: ${summary.imageTaskCount}`,
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
    "- Aucun remplacement du lot actif.",
    "- Aucune ecriture catalogue.",
    "- Aucune copie image publique.",
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
const runwayPath = latestFile(
  runwayRoot,
  /PENDING_BATCHES_RUNWAY_NEXT_WAVE_SOURCING_INTEGRATION_\d{8}\.json$/,
  "next wave pending batches runway",
);
const runway = readJson(runwayPath);
const issues = [];

if (runway.status !== "HOLD_NEXT_WAVE_PENDING_BATCHES_RUNWAY_READY" || runway.ok !== true) {
  addIssue(issues, "runway", "runway_status_invalid", "La runway lots suivants doit etre prete en HOLD.", {
    status: runway.status,
  });
}
if (runway.activeBatchId !== "lot-01" || runway.activeBatchBlockedHold !== true) {
  addIssue(issues, "active_batch", "active_batch_not_protected", "Le lot actif doit rester protege et bloque HOLD.", {
    activeBatchId: runway.activeBatchId,
    activeBatchBlockedHold: runway.activeBatchBlockedHold,
  });
}
if (
  runway.pendingBatchCount !== 2 ||
  runway.pendingProductCount !== 8 ||
  runway.proofTaskCount !== 40 ||
  runway.imageTaskCount !== 24 ||
  runway.totalTaskCount !== 64
) {
  addIssue(issues, "runway", "runway_scope_invalid", "La runway doit couvrir 2 lots, 8 produits et 64 taches.", {
    pendingBatchCount: runway.pendingBatchCount,
    pendingProductCount: runway.pendingProductCount,
    proofTaskCount: runway.proofTaskCount,
    imageTaskCount: runway.imageTaskCount,
    totalTaskCount: runway.totalTaskCount,
  });
}
for (const flag of requiredSafetyFlags) {
  if (runway.safety?.[flag] !== true) {
    addIssue(issues, "safety", `safety_${flag}_missing`, "Garde-fou runway manquant.", { flag });
  }
}

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });
const sourceDir = path.dirname(runwayPath);
const sourceFiles = walkFiles(sourceDir, (filePath) => [".json", ".md", ".csv"].includes(path.extname(filePath)));
const sensitiveFindings = scanSensitiveArtifacts(sourceFiles);
for (const finding of sensitiveFindings) {
  addIssue(issues, "sensitive_artifact", finding.type, "Marqueur sensible detecte dans la runway.", finding);
}

const summary = {
  ok: issues.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_integration_next_wave_pending_batches_runway_audit",
  status:
    issues.length === 0
      ? "OK_NEXT_WAVE_PENDING_BATCHES_RUNWAY_GUARDED"
      : "FAIL_NEXT_WAVE_PENDING_BATCHES_RUNWAY_AUDIT",
  pendingBatchCount: runway.pendingBatchCount ?? 0,
  pendingProductCount: runway.pendingProductCount ?? 0,
  proofTaskCount: runway.proofTaskCount ?? 0,
  imageTaskCount: runway.imageTaskCount ?? 0,
  totalTaskCount: runway.totalTaskCount ?? 0,
  activeBatchBlockedHold: runway.activeBatchBlockedHold === true,
  scannedFileCount: sourceFiles.length,
  sensitiveFindingCount: sensitiveFindings.length,
  failureCount: issues.length,
  issues,
  sources: {
    runwayPath: rel(runwayPath),
  },
  safety: {
    readOnlyAudit: true,
    noActiveBatchReplacement: true,
    noCatalogWrite: true,
    noPublicImageWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noMessageSent: true,
  },
};

const jsonPath = path.join(outputDir, `AUDIT_PENDING_BATCHES_RUNWAY_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `audit-runway-lots-suivants-prochaine-vague-sourcing-${dateKey}.md`);
const csvPath = path.join(outputDir, `audit-runway-lots-suivants-issues-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, issuesCsv(issues), "utf8");

console.log(
  JSON.stringify(
    {
      status: summary.status,
      ok: summary.ok,
      pendingBatchCount: summary.pendingBatchCount,
      pendingProductCount: summary.pendingProductCount,
      proofTaskCount: summary.proofTaskCount,
      imageTaskCount: summary.imageTaskCount,
      failureCount: summary.failureCount,
      sensitiveFindingCount: summary.sensitiveFindingCount,
      outputDir: rel(outputDir),
    },
    null,
    2,
  ),
);

if (!summary.ok) process.exitCode = 1;

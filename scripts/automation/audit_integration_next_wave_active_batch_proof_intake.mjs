import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessRoot = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessRoot, "tableaux-action");
const proofIntakeRoot = path.join(
  actionRoot,
  "preuves-internes-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const microPacksRoot = path.join(actionRoot, "micro-packs-lot-actif-prochaine-vague-sourcing-integration-articles");
const microPacksAuditRoot = path.join(
  actionRoot,
  "audit-micro-packs-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const outputRoot = path.join(
  actionRoot,
  "audit-preuves-internes-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const allowedProofPrefix = "business-maxi-trouvailles/preuves-internes/integration-articles/";
const requiredCsvHeaders = [
  "product_rank",
  "batch_id",
  "product_id",
  "product_name",
  "category_id",
  "proof_order",
  "proof_key",
  "label",
  "status",
  "proof_path",
  "file_action",
  "expected_format",
  "reject_if",
];
const requiredSafetyFlags = [
  "localProofTemplatesOnly",
  "nonDestructiveExistingFiles",
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
      addIssue(issues, "proof_items_csv", "missing_csv_header", "Une colonne CSV obligatoire manque.", { header });
    }
  }
}

function isSafeProofPath(value, dateKey) {
  const text = normalizeRel(value);
  return (
    text.startsWith(`${allowedProofPrefix}${dateKey}/`) &&
    text.endsWith(".md") &&
    !text.includes("..") &&
    !path.isAbsolute(text) &&
    !externalUrlPattern.test(text) &&
    !forbiddenPattern.test(text) &&
    !sensitivePattern.test(text)
  );
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
    "# Audit preuves internes lot actif prochaine vague",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Lot actif: ${summary.activeBatchId}`,
    `- Produits: ${summary.productCount}`,
    `- Fichiers preuves: ${summary.proofFileCount}/${summary.proofTaskCount}`,
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
    "- Les fichiers restent locaux et en HOLD.",
    "- Aucune valeur fournisseur brute n'est requise dans les sorties partageables.",
    "- Aucune image n'est creee ou telechargee.",
    "- Aucun paiement, aucune publication, aucune commande fournisseur.",
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
const proofIntakePath = latestFile(
  proofIntakeRoot,
  /PROOF_INTAKE_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch proof intake",
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

const proofIntake = readJson(proofIntakePath);
const microPacks = readJson(microPacksPath);
const microPacksAudit = readJson(microPacksAuditPath);
const outputDir = path.dirname(proofIntakePath);
const csvPath = path.join(outputDir, `preuves-internes-lot-actif-items-${dateKey}.csv`);
const csv = readCsv(csvPath);
const issues = [];

if (proofIntake.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_PROOF_INTAKE_READY") {
  addIssue(issues, "proof_intake", "proof_intake_status_invalid", "L'intake preuves doit rester pret en HOLD.", {
    status: proofIntake.status,
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

if (proofIntake.productCount !== 4 || proofIntake.proofTaskCount !== 20 || proofIntake.proofFileCount !== 20) {
  addIssue(issues, "proof_intake", "proof_intake_scope_invalid", "L'intake doit couvrir 4 produits et 20 fichiers preuves.", {
    productCount: proofIntake.productCount,
    proofTaskCount: proofIntake.proofTaskCount,
    proofFileCount: proofIntake.proofFileCount,
  });
}

if (proofIntake.holdProofCount !== 20 || proofIntake.filledProofCount !== 0) {
  addIssue(issues, "proof_intake", "proof_intake_hold_counts_invalid", "Les preuves creees doivent rester HOLD a remplir.", {
    holdProofCount: proofIntake.holdProofCount,
    filledProofCount: proofIntake.filledProofCount,
  });
}

validateCsvHeaders(issues, csv);
if (csv.rows.length !== 20) {
  addIssue(issues, "proof_items_csv", "csv_row_count_invalid", "Le CSV doit contenir 20 lignes preuves.", {
    csvRows: csv.rows.length,
  });
}

for (const flag of requiredSafetyFlags) {
  if (proofIntake.safety?.[flag] !== true) {
    addIssue(issues, "safety", "missing_safety_flag", "Un garde-fou intake preuves est absent.", { flag });
  }
}

const proofFiles = [];
for (const proof of proofIntake.proofs ?? []) {
  if (proof.status !== "TO_FILL_HOLD") {
    addIssue(issues, proof.productId, "proof_status_invalid", "Une preuve doit rester TO_FILL_HOLD.", {
      status: proof.status,
      proofPath: proof.proofPath,
    });
  }

  if (!isSafeProofPath(proof.proofPath, dateKey)) {
    addIssue(issues, proof.productId, "proof_path_invalid", "Chemin preuve local invalide.", {
      proofPath: proof.proofPath,
    });
    continue;
  }

  const proofPath = resolveInsideRoot(proof.proofPath);
  if (!fs.existsSync(proofPath)) {
    addIssue(issues, proof.productId, "proof_file_missing", "Un fichier preuve attendu manque.", {
      proofPath: proof.proofPath,
    });
    continue;
  }

  const content = fs.readFileSync(proofPath, "utf8");
  proofFiles.push(proofPath);
  for (const marker of [
    "Statut: TO_FILL_HOLD",
    "- Valeur interne: A_REMPLIR",
    "- Validation Mouss: A_REMPLIR",
    "- Decision finale: TO_DECIDE_HOLD",
    "- Ne pas publier.",
    "- Ne pas commander fournisseur.",
  ]) {
    if (!content.includes(marker)) {
      addIssue(issues, proof.productId, "proof_file_marker_missing", "Un marqueur HOLD manque dans un fichier preuve.", {
        proofPath: proof.proofPath,
        marker,
      });
    }
  }
}

const readmeFiles = [];
for (const product of proofIntake.products ?? []) {
  if (!product.readmePath || !isSafeProofPath(product.readmePath, dateKey)) {
    addIssue(issues, product.productId, "readme_path_invalid", "Chemin README preuve invalide.", {
      readmePath: product.readmePath,
    });
    continue;
  }

  const readmePath = resolveInsideRoot(product.readmePath);
  if (!fs.existsSync(readmePath)) {
    addIssue(issues, product.productId, "readme_missing", "Un README preuve attendu manque.", {
      readmePath: product.readmePath,
    });
    continue;
  }

  readmeFiles.push(readmePath);
}

for (const row of csv.rows) {
  if (row.status !== "TO_FILL_HOLD") {
    addIssue(issues, row.product_id, "csv_status_invalid", "Une ligne CSV preuve doit rester TO_FILL_HOLD.", {
      status: row.status,
    });
  }
  if (!isSafeProofPath(row.proof_path, dateKey)) {
    addIssue(issues, row.product_id, "csv_proof_path_invalid", "Une ligne CSV a un chemin preuve invalide.", {
      proofPath: row.proof_path,
    });
  }
}

const scannedFiles = [
  ...walkFiles(outputDir, (filePath) => [".json", ".md", ".csv"].includes(path.extname(filePath).toLowerCase())),
  ...proofFiles,
  ...readmeFiles,
];
const sensitiveFindings = scanSensitiveArtifacts(scannedFiles);
for (const finding of sensitiveFindings) {
  addIssue(issues, "sensitive_scan", "sensitive_finding", "Marqueur sensible detecte dans l'intake preuves.", finding);
}

const summary = {
  ok: issues.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_audit_integration_next_wave_active_batch_proof_intake",
  status: issues.length === 0 ? "OK_NEXT_WAVE_ACTIVE_BATCH_PROOF_INTAKE_GUARDED" : "FAIL_NEXT_WAVE_ACTIVE_BATCH_PROOF_INTAKE",
  activeBatchId: proofIntake.activeBatchId,
  productCount: proofIntake.productCount ?? 0,
  proofTaskCount: proofIntake.proofTaskCount ?? 0,
  proofFileCount: proofFiles.length,
  readmeFileCount: readmeFiles.length,
  csvRowCount: csv.rows.length,
  failureCount: issues.length,
  sensitiveFindingCount: sensitiveFindings.length,
  scannedFileCount: scannedFiles.length,
  issues,
  sources: {
    proofIntakePath: rel(proofIntakePath),
    microPacksPath: rel(microPacksPath),
    microPacksAuditPath: rel(microPacksAuditPath),
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

const jsonPath = path.join(auditDir, `AUDIT_PROOF_INTAKE_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(auditDir, `audit-preuves-internes-lot-actif-prochaine-vague-sourcing-${dateKey}.md`);
const issueCsvPath = path.join(auditDir, `audit-preuves-internes-lot-actif-prochaine-vague-sourcing-issues-${dateKey}.csv`);

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
      proofTaskCount: summary.proofTaskCount,
      proofFileCount: summary.proofFileCount,
      readmeFileCount: summary.readmeFileCount,
      csvRowCount: summary.csvRowCount,
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

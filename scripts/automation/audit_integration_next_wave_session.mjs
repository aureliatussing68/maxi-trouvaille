import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const sessionRoot = path.join(actionRoot, "session-prochaine-vague-sourcing-integration-articles");
const planRoot = path.join(actionRoot, "prochaine-vague-sourcing-integration-articles");
const planAuditRoot = path.join(actionRoot, "audit-prochaine-vague-sourcing-integration-articles");
const outputRoot = path.join(actionRoot, "audit-session-prochaine-vague-sourcing-integration-articles");

const requiredSafetyFlags = [
  "readOnlyInputs",
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
  "planAuditRequired",
];
const requiredBatchHeaders = [
  "batch_id",
  "batch_number",
  "product_count",
  "proof_task_count",
  "image_task_count",
  "status",
  "first_action",
];
const requiredProofHeaders = [
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
const requiredImageHeaders = [
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
  const text = String(value ?? "");
  if (/[",\n\r;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
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

function validateCsvHeaders(issues, scope, csv, requiredHeaders) {
  for (const header of requiredHeaders) {
    if (!csv.headers.includes(header)) {
      addIssue(issues, scope, "missing_csv_header", "Une colonne CSV obligatoire manque.", { header });
    }
  }
}

function isInternalAdminHref(value) {
  const text = String(value ?? "").trim();
  return (
    text.startsWith("/admin/") &&
    !text.startsWith("//") &&
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

function scanFilesForSession(sessionDir, session) {
  const sessionFiles = walkFiles(sessionDir, (filePath) =>
    [".json", ".md", ".csv", ".txt"].includes(path.extname(filePath).toLowerCase()),
  );
  const depositFiles = (session.files?.depositReadmePaths ?? [])
    .map((filePath) => path.join(root, filePath))
    .filter((filePath) => fs.existsSync(filePath));

  return [...sessionFiles, ...depositFiles];
}

function validateSession({ session, plan, planAudit, batchCsv, proofCsv, imageCsv }) {
  const issues = [];
  const products = Array.isArray(session.products) ? session.products : [];
  const batches = Array.isArray(session.batches) ? session.batches : [];
  const proofRows = Array.isArray(session.proofRows) ? session.proofRows : [];
  const imageRows = Array.isArray(session.imageRows) ? session.imageRows : [];

  if (session.mode !== "read_only_integration_next_wave_session") {
    addIssue(issues, "session", "invalid_mode", "Le mode session est inattendu.", { mode: session.mode });
  }

  if (session.status !== "HOLD_NEXT_WAVE_SESSION_READY") {
    addIssue(issues, "session", "invalid_status", "La session doit rester en HOLD prete terrain.", {
      status: session.status,
    });
  }

  if (plan.status !== "HOLD_NEXT_WAVE_SOURCING_READY" || plan.ok !== true) {
    addIssue(issues, "source_plan", "plan_not_ready", "Le plan source n'est pas pret.", { status: plan.status });
  }

  if (planAudit.status !== "OK_NEXT_WAVE_SOURCING_GUARDED" || planAudit.failureCount !== 0) {
    addIssue(issues, "source_audit", "plan_audit_not_ok", "L'audit source n'est pas OK.", {
      status: planAudit.status,
      failureCount: planAudit.failureCount,
    });
  }

  for (const flag of requiredSafetyFlags) {
    if (session.safety?.[flag] !== true) {
      addIssue(issues, "safety", "missing_safety_flag", "Un garde-fou session est absent.", { flag });
    }
  }

  if (session.batchCount !== 3 || batches.length !== 3) {
    addIssue(issues, "counts", "batch_count_invalid", "La session doit contenir 3 lots.", {
      batchCount: session.batchCount,
      batchRows: batches.length,
    });
  }

  if (session.productCount !== 12 || products.length !== 12) {
    addIssue(issues, "counts", "product_count_invalid", "La session doit couvrir 12 produits.", {
      productCount: session.productCount,
      productRows: products.length,
    });
  }

  if (session.proofTaskCount !== 60 || proofRows.length !== 60) {
    addIssue(issues, "counts", "proof_count_invalid", "La session doit contenir 60 preuves.", {
      proofTaskCount: session.proofTaskCount,
      proofRows: proofRows.length,
    });
  }

  if (session.imageTaskCount !== 36 || imageRows.length !== 36) {
    addIssue(issues, "counts", "image_count_invalid", "La session doit contenir 36 images.", {
      imageTaskCount: session.imageTaskCount,
      imageRows: imageRows.length,
    });
  }

  if (session.depositInstructionCount !== 12) {
    addIssue(issues, "counts", "deposit_instruction_count_invalid", "La session doit creer 12 consignes depot.", {
      depositInstructionCount: session.depositInstructionCount,
    });
  }

  if (session.totalTaskCount !== session.proofTaskCount + session.imageTaskCount) {
    addIssue(issues, "counts", "total_task_count_invalid", "Le total de taches session est incoherent.", {
      totalTaskCount: session.totalTaskCount,
    });
  }

  validateCsvHeaders(issues, "batch_csv", batchCsv, requiredBatchHeaders);
  validateCsvHeaders(issues, "proof_csv", proofCsv, requiredProofHeaders);
  validateCsvHeaders(issues, "image_csv", imageCsv, requiredImageHeaders);

  if (batchCsv.rows.length !== batches.length) {
    addIssue(issues, "batch_csv", "row_count_invalid", "Le CSV lots ne suit pas le JSON.", {
      csvRows: batchCsv.rows.length,
      batchRows: batches.length,
    });
  }

  if (proofCsv.rows.length !== proofRows.length) {
    addIssue(issues, "proof_csv", "row_count_invalid", "Le CSV preuves ne suit pas le JSON.", {
      csvRows: proofCsv.rows.length,
      proofRows: proofRows.length,
    });
  }

  if (imageCsv.rows.length !== imageRows.length) {
    addIssue(issues, "image_csv", "row_count_invalid", "Le CSV images ne suit pas le JSON.", {
      csvRows: imageCsv.rows.length,
      imageRows: imageRows.length,
    });
  }

  const seenProductIds = new Set();
  for (const product of products) {
    if (seenProductIds.has(product.productId)) {
      addIssue(issues, "product", "duplicate_product", "Produit duplique dans la session.", {
        productId: product.productId,
      });
    }
    seenProductIds.add(product.productId);

    if (product.status !== "HOLD_NEXT_WAVE_SOURCING_READY" || product.sessionStatus !== "TO_PROCESS_HOLD") {
      addIssue(issues, "product", "product_status_invalid", "Un produit ne reste pas en HOLD session.", {
        productId: product.productId,
        status: product.status,
        sessionStatus: product.sessionStatus,
      });
    }

    if (!isInternalAdminHref(product.adminProofHref)) {
      addIssue(issues, "product", "admin_href_invalid", "Lien admin produit non interne.", {
        productId: product.productId,
        adminProofHref: product.adminProofHref,
      });
    }

    if (!String(product.imageDepositDirRelative ?? "").startsWith("business-maxi-trouvailles/depots-images-exactes/")) {
      addIssue(issues, "product", "deposit_dir_invalid", "Dossier depot produit hors zone autorisee.", {
        productId: product.productId,
        imageDepositDirRelative: product.imageDepositDirRelative,
      });
    }
  }

  for (const batch of batches) {
    if (batch.productCount !== 4 || batch.proofTaskCount !== 20 || batch.imageTaskCount !== 12) {
      addIssue(issues, "batch", "batch_scope_invalid", "Chaque lot doit couvrir 4 produits, 20 preuves et 12 images.", {
        batchId: batch.batchId,
        productCount: batch.productCount,
        proofTaskCount: batch.proofTaskCount,
        imageTaskCount: batch.imageTaskCount,
      });
    }
  }

  for (const row of proofRows) {
    if (row.status !== "TO_FILL_HOLD") {
      addIssue(issues, "proof", "proof_status_invalid", "Une preuve ne reste pas a remplir en HOLD.", {
        taskId: row.taskId,
        status: row.status,
      });
    }

    if (!isInternalAdminHref(row.adminProofHref)) {
      addIssue(issues, "proof", "admin_href_invalid", "Lien admin preuve non interne.", {
        taskId: row.taskId,
        adminProofHref: row.adminProofHref,
      });
    }
  }

  for (const row of imageRows) {
    if (row.status !== "TO_DEPOSIT_HOLD") {
      addIssue(issues, "image", "image_status_invalid", "Une image ne reste pas a deposer en HOLD.", {
        taskId: row.taskId,
        status: row.status,
      });
    }

    if (!String(row.expectedFileName ?? "").endsWith(".webp")) {
      addIssue(issues, "image", "filename_not_webp", "Nom image attendu non WebP.", {
        taskId: row.taskId,
        expectedFileName: row.expectedFileName,
      });
    }

    if (!String(row.depositDirRelative ?? "").startsWith("business-maxi-trouvailles/depots-images-exactes/")) {
      addIssue(issues, "image", "deposit_dir_invalid", "Dossier depot image hors zone autorisee.", {
        taskId: row.taskId,
        depositDirRelative: row.depositDirRelative,
      });
    }
  }

  for (const filePath of [
    ...(session.files?.productSheetPaths ?? []),
    ...(session.files?.batchSheetPaths ?? []),
    ...(session.files?.depositReadmePaths ?? []),
  ]) {
    if (!fs.existsSync(path.join(root, filePath))) {
      addIssue(issues, "files", "expected_file_missing", "Un fichier de session attendu manque.", { filePath });
    }
  }

  if ((session.files?.productSheetPaths ?? []).length !== 12) {
    addIssue(issues, "files", "product_sheet_count_invalid", "La session doit avoir 12 fiches produit.", {
      count: session.files?.productSheetPaths?.length ?? 0,
    });
  }

  if ((session.files?.batchSheetPaths ?? []).length !== 3) {
    addIssue(issues, "files", "batch_sheet_count_invalid", "La session doit avoir 3 fiches lot.", {
      count: session.files?.batchSheetPaths?.length ?? 0,
    });
  }

  if ((session.files?.depositReadmePaths ?? []).length !== 12) {
    addIssue(issues, "files", "deposit_readme_count_invalid", "La session doit avoir 12 README depot.", {
      count: session.files?.depositReadmePaths?.length ?? 0,
    });
  }

  return issues;
}

function markdown(summary) {
  const rows =
    summary.issues.length === 0
      ? ["| OK | Session prochaine vague gardee | - |"]
      : summary.issues.map((issue) => `| ${issue.scope} | ${issue.code} | ${issue.message} |`);

  return `${[
    "# Audit session prochaine vague sourcing",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Lots: ${summary.batchCount}`,
    `- Produits: ${summary.productCount}`,
    `- Preuves: ${summary.proofTaskCount}`,
    `- Images WebP: ${summary.imageTaskCount}`,
    `- Fichiers scannes: ${summary.scannedFileCount}`,
    `- Echecs: ${summary.failureCount}`,
    `- Alertes sensibles: ${summary.sensitiveFindingCount}`,
    "",
    "## Issues",
    "",
    "| Scope | Code | Message |",
    "|---|---|---|",
    ...rows,
    "",
  ].join("\n")}\n`;
}

function issuesCsv(summary) {
  const headers = ["scope", "code", "message"];
  const rows = summary.issues.map((issue) => [issue.scope, issue.code, issue.message].map(csvEscape).join(";"));
  return `${headers.join(";")}\n${rows.join("\n")}${rows.length > 0 ? "\n" : ""}`;
}

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const sessionPath = latestFile(sessionRoot, /SESSION_NEXT_WAVE_SOURCING_INTEGRATION_\d{8}\.json$/, "next wave session");
const sessionDir = path.dirname(sessionPath);
const planPath = latestFile(planRoot, /NEXT_WAVE_SOURCING_INTEGRATION_\d{8}\.json$/, "next wave plan");
const planAuditPath = latestFile(planAuditRoot, /AUDIT_NEXT_WAVE_SOURCING_INTEGRATION_\d{8}\.json$/, "next wave plan audit");
const batchCsvPath = latestFile(sessionDir, /maxi-session-prochaine-vague-sourcing-lots-\d{8}\.csv$/, "batch csv");
const proofCsvPath = latestFile(sessionDir, /maxi-session-prochaine-vague-sourcing-preuves-\d{8}\.csv$/, "proof csv");
const imageCsvPath = latestFile(sessionDir, /maxi-session-prochaine-vague-sourcing-images-\d{8}\.csv$/, "image csv");

const session = readJson(sessionPath);
const plan = readJson(planPath);
const planAudit = readJson(planAuditPath);
const batchCsv = readCsv(batchCsvPath);
const proofCsv = readCsv(proofCsvPath);
const imageCsv = readCsv(imageCsvPath);
const issues = validateSession({ session, plan, planAudit, batchCsv, proofCsv, imageCsv });
const filesToScan = scanFilesForSession(sessionDir, session);
const sensitiveFindings = scanSensitiveArtifacts(filesToScan);
const allIssues = [
  ...issues,
  ...sensitiveFindings.map((finding) => ({
    scope: "sensitive_scan",
    code: finding.type,
    message: "Marqueur externe ou sensible detecte dans un artefact.",
    file: finding.file,
    line: finding.line,
    sample: finding.sample,
  })),
];

const summary = {
  ok: allIssues.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_audit_integration_next_wave_session",
  status: allIssues.length === 0 ? "OK_NEXT_WAVE_SESSION_GUARDED" : "FAIL_NEXT_WAVE_SESSION_REVIEW_REQUIRED",
  batchCount: session.batchCount ?? 0,
  productCount: session.productCount ?? 0,
  proofTaskCount: session.proofTaskCount ?? 0,
  imageTaskCount: session.imageTaskCount ?? 0,
  depositInstructionCount: session.depositInstructionCount ?? 0,
  failureCount: allIssues.length,
  sensitiveFindingCount: sensitiveFindings.length,
  scannedFileCount: filesToScan.length,
  issues: allIssues,
  sources: {
    sessionPath: rel(sessionPath),
    planPath: rel(planPath),
    planAuditPath: rel(planAuditPath),
    batchCsvPath: rel(batchCsvPath),
    proofCsvPath: rel(proofCsvPath),
    imageCsvPath: rel(imageCsvPath),
  },
  safety: {
    readOnlyAudit: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noExternalContact: true,
    noImageDownload: true,
    noPublicImageWrite: true,
  },
};

const jsonPath = path.join(outputDir, `AUDIT_SESSION_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `maxi-audit-session-prochaine-vague-sourcing-${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-audit-session-prochaine-vague-sourcing-issues-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, issuesCsv(summary), "utf8");

console.log(
  JSON.stringify(
    {
      status: summary.status,
      ok: summary.ok,
      batchCount: summary.batchCount,
      productCount: summary.productCount,
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

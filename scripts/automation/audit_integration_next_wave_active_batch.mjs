import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const activeBatchRoot = path.join(actionRoot, "lot-actif-prochaine-vague-sourcing-integration-articles");
const sessionRoot = path.join(actionRoot, "session-prochaine-vague-sourcing-integration-articles");
const sessionAuditRoot = path.join(actionRoot, "audit-session-prochaine-vague-sourcing-integration-articles");
const outputRoot = path.join(actionRoot, "audit-lot-actif-prochaine-vague-sourcing-integration-articles");

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
  "sessionAuditRequired",
];
const requiredProductHeaders = [
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
const requiredProofHeaders = [
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
const requiredImageHeaders = [
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
const requiredActionHeaders = ["order", "lane", "product_id", "product_name", "label", "status", "next_action"];

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

function validateActiveBatch({ batch, session, sessionAudit, productCsv, proofCsv, imageCsv, actionCsv }) {
  const issues = [];
  const products = Array.isArray(batch.products) ? batch.products : [];
  const proofRows = Array.isArray(batch.proofRows) ? batch.proofRows : [];
  const imageRows = Array.isArray(batch.imageRows) ? batch.imageRows : [];
  const actions = Array.isArray(batch.actions) ? batch.actions : [];

  if (batch.mode !== "read_only_integration_next_wave_active_batch") {
    addIssue(issues, "batch", "invalid_mode", "Le mode lot actif est inattendu.", { mode: batch.mode });
  }

  if (batch.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_READY") {
    addIssue(issues, "batch", "invalid_status", "Le lot actif doit rester en HOLD pret terrain.", {
      status: batch.status,
    });
  }

  if (session.status !== "HOLD_NEXT_WAVE_SESSION_READY" || session.ok !== true) {
    addIssue(issues, "source_session", "session_not_ready", "La session source n'est pas prete.", {
      status: session.status,
    });
  }

  if (sessionAudit.status !== "OK_NEXT_WAVE_SESSION_GUARDED" || sessionAudit.failureCount !== 0) {
    addIssue(issues, "source_audit", "session_audit_not_ok", "L'audit session source n'est pas OK.", {
      status: sessionAudit.status,
      failureCount: sessionAudit.failureCount,
    });
  }

  for (const flag of requiredSafetyFlags) {
    if (batch.safety?.[flag] !== true) {
      addIssue(issues, "safety", "missing_safety_flag", "Un garde-fou lot actif est absent.", { flag });
    }
  }

  if (batch.productCount !== 4 || products.length !== 4) {
    addIssue(issues, "counts", "product_count_invalid", "Le lot actif doit couvrir 4 produits.", {
      productCount: batch.productCount,
      productRows: products.length,
    });
  }

  if (batch.proofTaskCount !== 20 || proofRows.length !== 20) {
    addIssue(issues, "counts", "proof_count_invalid", "Le lot actif doit contenir 20 preuves.", {
      proofTaskCount: batch.proofTaskCount,
      proofRows: proofRows.length,
    });
  }

  if (batch.imageTaskCount !== 12 || imageRows.length !== 12) {
    addIssue(issues, "counts", "image_count_invalid", "Le lot actif doit contenir 12 images.", {
      imageTaskCount: batch.imageTaskCount,
      imageRows: imageRows.length,
    });
  }

  if (batch.actionCount !== 32 || actions.length !== 32) {
    addIssue(issues, "counts", "action_count_invalid", "Le lot actif doit contenir 32 actions terrain.", {
      actionCount: batch.actionCount,
      actionRows: actions.length,
    });
  }

  validateCsvHeaders(issues, "product_csv", productCsv, requiredProductHeaders);
  validateCsvHeaders(issues, "proof_csv", proofCsv, requiredProofHeaders);
  validateCsvHeaders(issues, "image_csv", imageCsv, requiredImageHeaders);
  validateCsvHeaders(issues, "action_csv", actionCsv, requiredActionHeaders);

  if (productCsv.rows.length !== products.length) {
    addIssue(issues, "product_csv", "row_count_invalid", "Le CSV produits ne suit pas le JSON.", {
      csvRows: productCsv.rows.length,
      productRows: products.length,
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

  if (actionCsv.rows.length !== actions.length) {
    addIssue(issues, "action_csv", "row_count_invalid", "Le CSV actions ne suit pas le JSON.", {
      csvRows: actionCsv.rows.length,
      actionRows: actions.length,
    });
  }

  for (const product of products) {
    if (product.status !== "HOLD_NEXT_WAVE_SOURCING_READY" || product.sessionStatus !== "TO_PROCESS_HOLD") {
      addIssue(issues, "product", "product_status_invalid", "Un produit ne reste pas en HOLD.", {
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

  return issues;
}

function markdown(summary) {
  const rows =
    summary.issues.length === 0
      ? ["| OK | Lot actif prochaine vague garde | - |"]
      : summary.issues.map((issue) => `| ${issue.scope} | ${issue.code} | ${issue.message} |`);

  return `${[
    "# Audit lot actif prochaine vague sourcing",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Lot actif: ${summary.activeBatchId}`,
    `- Produits: ${summary.productCount}`,
    `- Preuves: ${summary.proofTaskCount}`,
    `- Images WebP: ${summary.imageTaskCount}`,
    `- Actions: ${summary.actionCount}`,
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

const batchPath = latestFile(activeBatchRoot, /ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d{8}\.json$/, "active batch");
const batchDir = path.dirname(batchPath);
const sessionPath = latestFile(sessionRoot, /SESSION_NEXT_WAVE_SOURCING_INTEGRATION_\d{8}\.json$/, "next wave session");
const sessionAuditPath = latestFile(
  sessionAuditRoot,
  /AUDIT_SESSION_NEXT_WAVE_SOURCING_INTEGRATION_\d{8}\.json$/,
  "next wave session audit",
);
const productCsvPath = latestFile(batchDir, /maxi-lot-actif-prochaine-vague-produits-\d{8}\.csv$/, "product csv");
const proofCsvPath = latestFile(batchDir, /maxi-lot-actif-prochaine-vague-preuves-\d{8}\.csv$/, "proof csv");
const imageCsvPath = latestFile(batchDir, /maxi-lot-actif-prochaine-vague-images-\d{8}\.csv$/, "image csv");
const actionCsvPath = latestFile(batchDir, /maxi-lot-actif-prochaine-vague-actions-\d{8}\.csv$/, "action csv");

const batch = readJson(batchPath);
const session = readJson(sessionPath);
const sessionAudit = readJson(sessionAuditPath);
const productCsv = readCsv(productCsvPath);
const proofCsv = readCsv(proofCsvPath);
const imageCsv = readCsv(imageCsvPath);
const actionCsv = readCsv(actionCsvPath);
const issues = validateActiveBatch({ batch, session, sessionAudit, productCsv, proofCsv, imageCsv, actionCsv });
const filesToScan = walkFiles(batchDir, (filePath) =>
  [".json", ".md", ".csv", ".txt"].includes(path.extname(filePath).toLowerCase()),
);
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
  mode: "read_only_audit_integration_next_wave_active_batch",
  status: allIssues.length === 0 ? "OK_NEXT_WAVE_ACTIVE_BATCH_GUARDED" : "FAIL_NEXT_WAVE_ACTIVE_BATCH_REVIEW_REQUIRED",
  activeBatchId: batch.activeBatchId ?? "",
  productCount: batch.productCount ?? 0,
  proofTaskCount: batch.proofTaskCount ?? 0,
  imageTaskCount: batch.imageTaskCount ?? 0,
  actionCount: batch.actionCount ?? 0,
  failureCount: allIssues.length,
  sensitiveFindingCount: sensitiveFindings.length,
  scannedFileCount: filesToScan.length,
  issues: allIssues,
  sources: {
    batchPath: rel(batchPath),
    sessionPath: rel(sessionPath),
    sessionAuditPath: rel(sessionAuditPath),
    productCsvPath: rel(productCsvPath),
    proofCsvPath: rel(proofCsvPath),
    imageCsvPath: rel(imageCsvPath),
    actionCsvPath: rel(actionCsvPath),
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

const jsonPath = path.join(outputDir, `AUDIT_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `maxi-audit-lot-actif-prochaine-vague-sourcing-${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-audit-lot-actif-prochaine-vague-sourcing-issues-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, issuesCsv(summary), "utf8");

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
      failureCount: summary.failureCount,
      sensitiveFindingCount: summary.sensitiveFindingCount,
      outputDir: rel(outputDir),
    },
    null,
    2,
  ),
);

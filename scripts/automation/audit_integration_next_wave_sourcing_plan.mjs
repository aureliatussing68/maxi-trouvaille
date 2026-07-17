import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const planRoot = path.join(actionRoot, "prochaine-vague-sourcing-integration-articles");
const top3Root = path.join(actionRoot, "top3-sourcing-integration-articles");
const outputRoot = path.join(actionRoot, "audit-prochaine-vague-sourcing-integration-articles");

const requiredSafetyFlags = [
  "readOnlyInputs",
  "noCatalogWrite",
  "noSupplierValueExport",
  "noPublication",
  "noPayment",
  "noSupplierOrder",
  "noImageDownload",
  "noImageFileCreated",
  "noPublicImageWrite",
  "top3Excluded",
  "manualValidationRequired",
];
const requiredProductCsvHeaders = [
  "next_wave_rank",
  "product_id",
  "slug",
  "product_name",
  "category_id",
  "status",
  "priority_score",
  "target_sale_price",
  "target_margin",
  "proof_task_count",
  "image_task_count",
  "image_deposit_dir",
  "admin_href",
  "next_action",
];
const requiredProofCsvHeaders = [
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
];
const requiredImageCsvHeaders = [
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

function top3ProductIds(top3) {
  return new Set((top3.rows ?? []).map((row) => row.productId).filter(Boolean));
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

function validateCsvHeaders(issues, scope, csv, requiredHeaders) {
  for (const header of requiredHeaders) {
    if (!csv.headers.includes(header)) {
      addIssue(issues, scope, "missing_csv_header", "Une colonne CSV obligatoire manque.", { header });
    }
  }
}

function validatePlan({ plan, productCsv, proofCsv, imageCsv, top3 }) {
  const issues = [];
  const products = Array.isArray(plan.products) ? plan.products : [];
  const proofTasks = Array.isArray(plan.proofTasks) ? plan.proofTasks : [];
  const imageTasks = Array.isArray(plan.imageTasks) ? plan.imageTasks : [];
  const excludedIds = top3ProductIds(top3);

  if (plan.mode !== "read_only_integration_next_wave_sourcing_plan") {
    addIssue(issues, "plan", "invalid_mode", "Le mode du plan est inattendu.", { mode: plan.mode });
  }

  if (plan.status !== "HOLD_NEXT_WAVE_SOURCING_READY") {
    addIssue(issues, "plan", "invalid_status", "Le plan doit rester en HOLD pret sourcing.", {
      status: plan.status,
    });
  }

  for (const flag of requiredSafetyFlags) {
    if (plan.safety?.[flag] !== true) {
      addIssue(issues, "safety", "missing_safety_flag", "Un garde-fou du plan est absent.", { flag });
    }
  }

  if (plan.productCount !== 12 || products.length !== 12) {
    addIssue(issues, "counts", "product_count_invalid", "La prochaine vague doit couvrir 12 produits.", {
      productCount: plan.productCount,
      productRows: products.length,
    });
  }

  if (plan.proofTaskCount !== 60 || proofTasks.length !== 60) {
    addIssue(issues, "counts", "proof_task_count_invalid", "La prochaine vague doit contenir 60 preuves.", {
      proofTaskCount: plan.proofTaskCount,
      proofRows: proofTasks.length,
    });
  }

  if (plan.imageTaskCount !== 36 || imageTasks.length !== 36) {
    addIssue(issues, "counts", "image_task_count_invalid", "La prochaine vague doit contenir 36 images.", {
      imageTaskCount: plan.imageTaskCount,
      imageRows: imageTasks.length,
    });
  }

  if (plan.totalTaskCount !== plan.proofTaskCount + plan.imageTaskCount) {
    addIssue(issues, "counts", "total_task_count_invalid", "Le compteur total est incoherent.", {
      totalTaskCount: plan.totalTaskCount,
      proofTaskCount: plan.proofTaskCount,
      imageTaskCount: plan.imageTaskCount,
    });
  }

  validateCsvHeaders(issues, "product_csv", productCsv, requiredProductCsvHeaders);
  validateCsvHeaders(issues, "proof_csv", proofCsv, requiredProofCsvHeaders);
  validateCsvHeaders(issues, "image_csv", imageCsv, requiredImageCsvHeaders);

  if (productCsv.rows.length !== products.length) {
    addIssue(issues, "product_csv", "product_csv_row_count_invalid", "Le CSV produits ne suit pas le JSON.", {
      csvRows: productCsv.rows.length,
      productRows: products.length,
    });
  }

  if (proofCsv.rows.length !== proofTasks.length) {
    addIssue(issues, "proof_csv", "proof_csv_row_count_invalid", "Le CSV preuves ne suit pas le JSON.", {
      csvRows: proofCsv.rows.length,
      proofRows: proofTasks.length,
    });
  }

  if (imageCsv.rows.length !== imageTasks.length) {
    addIssue(issues, "image_csv", "image_csv_row_count_invalid", "Le CSV images ne suit pas le JSON.", {
      csvRows: imageCsv.rows.length,
      imageRows: imageTasks.length,
    });
  }

  const seenProductIds = new Set();
  for (const [index, product] of products.entries()) {
    if (product.nextWaveRank !== index + 1) {
      addIssue(issues, "product", "rank_gap", "Les rangs de la vague ne sont pas continus.", {
        productId: product.productId,
        rank: product.nextWaveRank,
      });
    }

    if (seenProductIds.has(product.productId)) {
      addIssue(issues, "product", "duplicate_product", "Produit duplique dans la vague.", {
        productId: product.productId,
      });
    }
    seenProductIds.add(product.productId);

    if (excludedIds.has(product.productId)) {
      addIssue(issues, "product", "top3_overlap", "Un produit top 3 est revenu dans la prochaine vague.", {
        productId: product.productId,
      });
    }

    if (product.status !== "HOLD_NEXT_WAVE_SOURCING_READY") {
      addIssue(issues, "product", "product_status_invalid", "Un produit n'est pas garde en HOLD.", {
        productId: product.productId,
        status: product.status,
      });
    }

    if (!isInternalAdminHref(product.adminProofHref)) {
      addIssue(issues, "product", "admin_href_invalid", "Lien admin non interne.", {
        productId: product.productId,
        adminProofHref: product.adminProofHref,
      });
    }

    if (!String(product.imageDepositDirRelative ?? "").startsWith("business-maxi-trouvailles/depots-images-exactes/")) {
      addIssue(issues, "product", "deposit_dir_invalid", "Dossier depot images hors zone attendue.", {
        productId: product.productId,
        imageDepositDirRelative: product.imageDepositDirRelative,
      });
    }

    if ((product.proofTasks ?? []).length !== 5 || (product.imageTasks ?? []).length !== 3) {
      addIssue(issues, "product", "task_counts_invalid", "Le produit doit avoir 5 preuves et 3 images.", {
        productId: product.productId,
        proofTaskCount: product.proofTasks?.length ?? 0,
        imageTaskCount: product.imageTasks?.length ?? 0,
      });
    }
  }

  for (const task of proofTasks) {
    if (task.status !== "TO_FILL_HOLD") {
      addIssue(issues, "proof", "proof_status_invalid", "Une preuve ne reste pas a remplir en HOLD.", {
        taskId: task.taskId,
        status: task.status,
      });
    }

    if (!isInternalAdminHref(task.adminProofHref)) {
      addIssue(issues, "proof", "proof_admin_href_invalid", "Lien admin preuve non interne.", {
        taskId: task.taskId,
        adminProofHref: task.adminProofHref,
      });
    }
  }

  for (const task of imageTasks) {
    if (task.status !== "TO_DEPOSIT_HOLD") {
      addIssue(issues, "image", "image_status_invalid", "Une image ne reste pas a deposer en HOLD.", {
        taskId: task.taskId,
        status: task.status,
      });
    }

    if (!String(task.expectedFileName ?? "").endsWith(".webp")) {
      addIssue(issues, "image", "image_filename_not_webp", "Nom de fichier image non WebP.", {
        taskId: task.taskId,
        expectedFileName: task.expectedFileName,
      });
    }

    if (!String(task.depositDirRelative ?? "").startsWith("business-maxi-trouvailles/depots-images-exactes/")) {
      addIssue(issues, "image", "image_deposit_dir_invalid", "Dossier image hors zone attendue.", {
        taskId: task.taskId,
        depositDirRelative: task.depositDirRelative,
      });
    }
  }

  return issues;
}

function markdown(summary) {
  const rows =
    summary.issues.length === 0
      ? ["| OK | Plan prochaine vague garde | - |"]
      : summary.issues.map((issue) => `| ${issue.scope} | ${issue.code} | ${issue.message} |`);

  return `${[
    "# Audit prochaine vague sourcing integration",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Produits: ${summary.productCount}`,
    `- Preuves: ${summary.proofTaskCount}`,
    `- Images WebP: ${summary.imageTaskCount}`,
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

const planPath = latestFile(planRoot, /NEXT_WAVE_SOURCING_INTEGRATION_\d{8}\.json$/, "next wave sourcing plan");
const planDir = path.dirname(planPath);
const top3Path = latestFile(top3Root, /TOP3_SOURCING_INTEGRATION_\d{8}\.json$/, "top 3 sourcing sprint");
const productCsvPath = latestFile(
  planDir,
  /maxi-prochaine-vague-sourcing-integration-produits-\d{8}\.csv$/,
  "next wave product csv",
);
const proofCsvPath = latestFile(
  planDir,
  /maxi-prochaine-vague-sourcing-integration-preuves-\d{8}\.csv$/,
  "next wave proof csv",
);
const imageCsvPath = latestFile(
  planDir,
  /maxi-prochaine-vague-sourcing-integration-images-\d{8}\.csv$/,
  "next wave image csv",
);
const filesToScan = walkFiles(planDir, (filePath) =>
  [
    ".json",
    ".md",
    ".csv",
  ].includes(path.extname(filePath).toLowerCase()),
);

const plan = readJson(planPath);
const top3 = readJson(top3Path);
const productCsv = readCsv(productCsvPath);
const proofCsv = readCsv(proofCsvPath);
const imageCsv = readCsv(imageCsvPath);
const issues = validatePlan({ plan, productCsv, proofCsv, imageCsv, top3 });
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
  mode: "read_only_audit_integration_next_wave_sourcing_plan",
  status: allIssues.length === 0 ? "OK_NEXT_WAVE_SOURCING_GUARDED" : "FAIL_NEXT_WAVE_SOURCING_REVIEW_REQUIRED",
  productCount: plan.productCount ?? 0,
  proofTaskCount: plan.proofTaskCount ?? 0,
  imageTaskCount: plan.imageTaskCount ?? 0,
  failureCount: allIssues.length,
  sensitiveFindingCount: sensitiveFindings.length,
  scannedFileCount: filesToScan.length,
  issues: allIssues,
  sources: {
    planPath: rel(planPath),
    top3Path: rel(top3Path),
    productCsvPath: rel(productCsvPath),
    proofCsvPath: rel(proofCsvPath),
    imageCsvPath: rel(imageCsvPath),
  },
  safety: {
    readOnlyInputs: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noImageDownload: true,
    noPublicImageWrite: true,
  },
};

const jsonPath = path.join(outputDir, `AUDIT_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `maxi-audit-prochaine-vague-sourcing-integration-${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-audit-prochaine-vague-sourcing-integration-issues-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, issuesCsv(summary), "utf8");

console.log(
  JSON.stringify(
    {
      status: summary.status,
      ok: summary.ok,
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

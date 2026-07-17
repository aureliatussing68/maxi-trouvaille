import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workpackRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action", "top3-webp-sourcing-integration-articles");
const outputRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "audit-top3-webp-sourcing-integration-articles",
);

const requiredHeaders = [
  "rank",
  "top3_rank",
  "product_id",
  "product_name",
  "category_id",
  "role",
  "expected_file_name",
  "image_deposit_dir",
  "expected_target_path",
  "admin_href",
  "status",
  "source_local_file",
  "rights_note",
  "exact_same_article",
  "exact_variant_confirmed",
  "mouss_validation",
  "final_decision",
];
const requiredSafetyFlags = [
  "readOnly",
  "noCatalogWrite",
  "noPublication",
  "noPayment",
  "noSupplierOrder",
  "noExternalContact",
  "noImageDownload",
  "noPublicImageWrite",
  "manualValidationRequired",
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

function latestFile(dir, pattern) {
  const files = walkFiles(dir, (filePath) => pattern.test(filePath));
  if (files.length === 0) {
    throw new Error(`No file matching ${pattern} found under ${dir}`);
  }

  return files
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0].filePath;
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
  if (!fs.existsSync(filePath)) {
    return { headers: [], rows: [] };
  }

  const lines = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

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

function taskKey(task) {
  return `${task.rank}:${task.productId}:${task.expectedFileName}`;
}

function csvTaskKey(row) {
  return `${row.rank}:${row.product_id}:${row.expected_file_name}`;
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

function validateWorkpack({ workpack, csv, fillableCsvPath }) {
  const issues = [];
  const tasks = workpack.imageTasks ?? [];
  const taskKeys = new Set(tasks.map(taskKey));
  const csvKeys = new Set(csv.rows.map(csvTaskKey));

  if (workpack.mode !== "read_only_integration_top3_webp_workpack") {
    addIssue(issues, "workpack", "invalid_mode", "Le mode du workpack WebP est inattendu.", {
      mode: workpack.mode,
    });
  }

  if (workpack.status !== "HOLD_TOP3_WEBP_WORKPACK_READY") {
    addIssue(issues, "workpack", "invalid_status", "Le workpack WebP doit rester pret en HOLD.", {
      status: workpack.status,
    });
  }

  if (workpack.top3AuditStatus !== "OK_TOP3_SOURCING_GUARDED") {
    addIssue(issues, "sources", "top3_audit_not_guarded", "L'audit top 3 source n'est pas OK.", {
      top3AuditStatus: workpack.top3AuditStatus,
    });
  }

  for (const flag of requiredSafetyFlags) {
    if (workpack.safety?.[flag] !== true) {
      addIssue(issues, "safety", "missing_safety_flag", "Un garde-fou du workpack est absent.", { flag });
    }
  }

  if (workpack.productCount !== 3 || workpack.imageTaskCount !== 9 || tasks.length !== 9) {
    addIssue(issues, "counts", "image_task_count_mismatch", "Le volume WebP top 3 doit etre 3 produits / 9 images.", {
      productCount: workpack.productCount,
      imageTaskCount: workpack.imageTaskCount,
      taskRows: tasks.length,
    });
  }

  for (const header of requiredHeaders) {
    if (!csv.headers.includes(header)) {
      addIssue(issues, "csv", "missing_csv_header", "Le CSV a remplir ne contient pas une colonne obligatoire.", {
        header,
      });
    }
  }

  if (!fs.existsSync(fillableCsvPath)) {
    addIssue(issues, "csv", "fillable_csv_missing", "Le CSV remplissable WebP est introuvable.", {
      file: rel(fillableCsvPath),
    });
  }

  if (csv.rows.length !== tasks.length) {
    addIssue(issues, "csv", "csv_row_count_mismatch", "Le CSV a remplir ne suit pas les images JSON.", {
      csvRows: csv.rows.length,
      taskRows: tasks.length,
    });
  }

  for (const task of tasks) {
    if (typeof task.expectedFileName !== "string" || !/^[a-z0-9][a-z0-9-]*\.webp$/i.test(task.expectedFileName)) {
      addIssue(issues, "image", "invalid_expected_file_name", "Nom WebP attendu invalide.", {
        productId: task.productId,
        expectedFileName: task.expectedFileName,
      });
    }

    if (!String(task.expectedTargetPathRelative ?? "").endsWith(`/${task.expectedFileName}`)) {
      addIssue(issues, "image", "target_path_file_mismatch", "Chemin cible WebP incoherent avec le nom attendu.", {
        productId: task.productId,
        expectedFileName: task.expectedFileName,
      });
    }

    if (!String(task.imageDepositDirRelative ?? "").startsWith("business-maxi-trouvailles/depots-images-exactes/integration-articles/")) {
      addIssue(issues, "image", "invalid_deposit_dir", "Dossier depot WebP hors zone integration.", {
        productId: task.productId,
        imageDepositDirRelative: task.imageDepositDirRelative,
      });
    }

    if (!isInternalAdminHref(task.adminProofHref)) {
      addIssue(issues, "image", "admin_href_not_internal", "Lien admin image non interne.", {
        productId: task.productId,
        expectedFileName: task.expectedFileName,
      });
    }

    if (task.manualInput?.finalDecision !== "HOLD_TO_FILL") {
      addIssue(issues, "image", "manual_decision_not_hold", "La decision manuelle doit rester HOLD_TO_FILL.", {
        productId: task.productId,
        expectedFileName: task.expectedFileName,
      });
    }

    if (!csvKeys.has(taskKey(task))) {
      addIssue(issues, "csv", "task_missing_from_csv", "Une image JSON manque dans le CSV remplissable.", {
        key: taskKey(task),
      });
    }
  }

  for (const row of csv.rows) {
    if (!taskKeys.has(csvTaskKey(row))) {
      addIssue(issues, "csv", "unexpected_csv_row", "Le CSV contient une image absente du JSON.", {
        key: csvTaskKey(row),
      });
    }
  }

  return issues;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function markdown(summary) {
  const issueRows =
    summary.issues.length === 0
      ? ["| OK | Aucun echec | - | - |"]
      : summary.issues.map(
          (issue) =>
            `| ${mdCell(issue.scope)} | ${mdCell(issue.code)} | ${mdCell(issue.message)} | ${mdCell(
              issue.productId ?? issue.file ?? issue.key ?? "-",
            )} |`,
        );

  const sensitiveRows =
    summary.sensitiveFindings.length === 0
      ? ["| OK | Aucun marqueur sensible detecte | - | - |"]
      : summary.sensitiveFindings.map(
          (finding) =>
            `| ${mdCell(finding.type)} | ${mdCell(finding.file)} | ${finding.line} | ${mdCell(finding.sample)} |`,
        );

  return `${[
    "# Audit top 3 WebP sourcing",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Statut: ${summary.status}`,
    `- Produits controles: ${summary.productCount}`,
    `- WebP attendus: ${summary.imageTaskCount}`,
    `- Echecs structurels: ${summary.failureCount}`,
    `- Alertes sensibles: ${summary.sensitiveFindingCount}`,
    "",
    "## Echecs structurels",
    "",
    "| Portee | Code | Message | Detail |",
    "|---|---|---|---|",
    ...issueRows,
    "",
    "## Scan sensible",
    "",
    "| Type | Fichier | Ligne | Extrait |",
    "|---|---|---:|---|",
    ...sensitiveRows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule.",
    "- Aucune ecriture catalogue.",
    "- Aucune copie image publique.",
    "- Aucun telechargement image.",
    "- Aucune publication.",
    "- HOLD tant que les preuves exactes et la validation Mouss manquent.",
    "",
  ].join("\n")}\n`;
}

function toCsv(summary) {
  const headers = ["scope", "code", "message", "productId", "file", "key"];
  const rows = summary.issues.map((issue) => headers.map((header) => csvEscape(issue[header] ?? "")).join(";"));
  return `${headers.join(";")}\n${rows.join("\n")}${rows.length ? "\n" : ""}`;
}

function workpackDateKey(workpackPath) {
  const match = path.basename(workpackPath).match(/_(\d{8})\.json$/);
  return match?.[1] ?? datePartsParis().dateKey;
}

const { dateKey, localLabel } = datePartsParis();
const workpackPath = latestFile(workpackRoot, /TOP3_WEBP_SOURCING_INTEGRATION_\d+\.json$/);
const workpackDir = path.dirname(workpackPath);
const workpackKey = workpackDateKey(workpackPath);
const workpack = readJson(workpackPath);
const fillableCsvPath = path.join(workpackDir, `A_REMPLIR_TOP3_WEBP_SOURCING_${workpackKey}.csv`);
const csv = readCsv(fillableCsvPath);
const workpackFiles = [
  workpackPath,
  path.join(workpackDir, `TOP3_WEBP_SOURCING_INTEGRATION_${workpackKey}.md`),
  path.join(workpackDir, `top3-webp-sourcing-integration-${workpackKey}.csv`),
  fillableCsvPath,
  ...walkFiles(path.join(workpackDir, "images"), (filePath) => [".json", ".md"].includes(path.extname(filePath))),
].filter((filePath) => fs.existsSync(filePath));

const issues = validateWorkpack({ workpack, csv, fillableCsvPath });
const sensitiveFindings = scanSensitiveArtifacts(workpackFiles);

const summary = {
  ok: issues.length === 0 && sensitiveFindings.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_integration_top3_webp_workpack_audit",
  status: issues.length === 0 && sensitiveFindings.length === 0 ? "OK_TOP3_WEBP_WORKPACK_GUARDED" : "FAIL_TOP3_WEBP_WORKPACK_GUARDS",
  productCount: workpack.productCount ?? 0,
  imageTaskCount: workpack.imageTaskCount ?? 0,
  scannedFileCount: workpackFiles.length,
  failureCount: issues.length,
  sensitiveFindingCount: sensitiveFindings.length,
  issues,
  sensitiveFindings,
  sources: {
    workpackPath: rel(workpackPath),
    fillableCsvPath: rel(fillableCsvPath),
    top3Path: workpack.sources?.top3Path ?? "",
    top3AuditPath: workpack.sources?.top3AuditPath ?? "",
  },
  safety: {
    readOnlyAudit: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noImageDownload: true,
    noPublicImageWrite: true,
    manualValidationRequired: true,
  },
};

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const jsonPath = path.join(outputDir, `AUDIT_TOP3_WEBP_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_TOP3_WEBP_SOURCING_INTEGRATION_${dateKey}.md`);
const csvPath = path.join(outputDir, `audit-top3-webp-sourcing-integration-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, toCsv(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      status: summary.status,
      productCount: summary.productCount,
      imageTaskCount: summary.imageTaskCount,
      scannedFileCount: summary.scannedFileCount,
      failureCount: summary.failureCount,
      sensitiveFindingCount: summary.sensitiveFindingCount,
      files: { jsonPath, mdPath, csvPath },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

if (!summary.ok) {
  process.exitCode = 1;
}

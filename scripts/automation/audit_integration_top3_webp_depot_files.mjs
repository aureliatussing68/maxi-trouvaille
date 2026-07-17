import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const workpackRoot = path.join(actionRoot, "top3-webp-sourcing-integration-articles");
const workpackAuditRoot = path.join(actionRoot, "audit-top3-webp-sourcing-integration-articles");
const outputRoot = path.join(actionRoot, "audit-top3-webp-depot-files-sourcing-integration-articles");
const allowedDepositRootRelative = "business-maxi-trouvailles/depots-images-exactes/integration-articles";
const allowedDepositRootAbsolute = path.resolve(root, allowedDepositRootRelative);

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
    return null;
  }

  return files
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0].filePath;
}

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function rel(filePath) {
  if (!filePath) return "";
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function normalizeRelative(value) {
  return String(value ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function absFromRelative(relativePath) {
  return path.resolve(root, normalizeRelative(relativePath));
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  if (/[",\n\r;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function addIssue(issues, scope, code, message, details = {}) {
  issues.push({ scope, code, message, ...details });
}

function isInsideAllowedDepositRoot(filePath) {
  const resolved = path.resolve(filePath);
  return resolved === allowedDepositRootAbsolute || resolved.startsWith(`${allowedDepositRootAbsolute}${path.sep}`);
}

function isValidExpectedFileName(value) {
  return /^[a-z0-9][a-z0-9-]*\.webp$/i.test(String(value ?? ""));
}

function isWebpFile(filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }

  const buffer = fs.readFileSync(filePath);
  return (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
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

function workpackDateKey(workpackPath) {
  const match = path.basename(workpackPath ?? "").match(/_(\d{8})\.json$/);
  return match?.[1] ?? datePartsParis().dateKey;
}

function auditTask(task, index, issues) {
  const expectedFileName = String(task.expectedFileName ?? "");
  const expectedTargetPathRelative = normalizeRelative(task.expectedTargetPathRelative);
  const expectedTargetPath = absFromRelative(expectedTargetPathRelative);
  const expectedExists = fs.existsSync(expectedTargetPath);
  const fileStat = expectedExists && fs.statSync(expectedTargetPath).isFile() ? fs.statSync(expectedTargetPath) : null;
  const webpHeaderOk = expectedExists && Boolean(fileStat) ? isWebpFile(expectedTargetPath) : false;
  const blockers = [];

  if (!isValidExpectedFileName(expectedFileName)) {
    blockers.push("expected_file_name_invalid");
    addIssue(issues, "image", "expected_file_name_invalid", "Nom WebP attendu invalide.", {
      rank: task.rank ?? index + 1,
      productId: task.productId,
      expectedFileName,
    });
  }

  if (!expectedTargetPathRelative.startsWith(`${allowedDepositRootRelative}/`)) {
    blockers.push("target_path_outside_allowed_deposit_root");
    addIssue(issues, "image", "target_path_outside_allowed_deposit_root", "Chemin cible WebP hors zone depot autorisee.", {
      rank: task.rank ?? index + 1,
      productId: task.productId,
      expectedTargetPathRelative,
    });
  }

  if (!isInsideAllowedDepositRoot(expectedTargetPath)) {
    blockers.push("target_path_escape_attempt");
    addIssue(issues, "image", "target_path_escape_attempt", "Chemin cible WebP resolu hors racine depot autorisee.", {
      rank: task.rank ?? index + 1,
      productId: task.productId,
      expectedTargetPath: rel(expectedTargetPath),
    });
  }

  if (!expectedTargetPathRelative.endsWith(`/${expectedFileName}`)) {
    blockers.push("target_path_file_mismatch");
    addIssue(issues, "image", "target_path_file_mismatch", "Chemin cible WebP incoherent avec le nom attendu.", {
      rank: task.rank ?? index + 1,
      productId: task.productId,
      expectedFileName,
      expectedTargetPathRelative,
    });
  }

  if (!expectedExists) {
    blockers.push("expected_webp_missing");
  } else if (!fileStat) {
    blockers.push("expected_path_not_file");
    addIssue(issues, "image", "expected_path_not_file", "Le chemin attendu existe mais n'est pas un fichier.", {
      rank: task.rank ?? index + 1,
      productId: task.productId,
      expectedTargetPath: rel(expectedTargetPath),
    });
  } else if (!webpHeaderOk) {
    blockers.push("expected_file_not_valid_webp");
    addIssue(issues, "image", "expected_file_not_valid_webp", "Le fichier attendu n'a pas une signature WebP valide.", {
      rank: task.rank ?? index + 1,
      productId: task.productId,
      expectedTargetPath: rel(expectedTargetPath),
    });
  }

  const readyForHumanReview = expectedExists && Boolean(fileStat) && webpHeaderOk && blockers.length === 0;

  return {
    rank: task.rank ?? index + 1,
    top3Rank: task.top3Rank ?? "",
    productId: task.productId ?? "",
    productName: task.productName ?? "",
    productSlug: task.productSlug ?? "",
    categoryId: task.categoryId ?? "",
    role: task.role ?? "",
    expectedFileName,
    expectedTargetPathRelative,
    expectedExists,
    webpHeaderOk,
    fileSizeBytes: fileStat?.size ?? 0,
    status: readyForHumanReview ? "READY_FOR_HUMAN_REVIEW_HOLD" : expectedExists ? "INVALID_HOLD" : "MISSING_HOLD",
    readyForHumanReview,
    blockers,
  };
}

function markdown(summary) {
  const rows = summary.items.map(
    (item) =>
      `| ${item.status} | ${item.productName} | ${item.role} | ${item.expectedFileName} | ${item.fileSizeBytes} | ${item.blockers.join(", ")} |`,
  );
  const issueRows =
    summary.issues.length === 0
      ? ["| OK | Aucun echec structurel | - | - |"]
      : summary.issues.map(
          (issue) =>
            `| ${mdCell(issue.scope)} | ${mdCell(issue.code)} | ${mdCell(issue.message)} | ${mdCell(
              issue.productId ?? issue.expectedTargetPathRelative ?? issue.file ?? "-",
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
    "# Audit depots WebP top 3 integration",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Statut: ${summary.status}`,
    `- Produits controles: ${summary.productCount}`,
    `- WebP attendus: ${summary.imageTaskCount}`,
    `- WebP valides: ${summary.readyImageCount}`,
    `- WebP manquants: ${summary.missingCount}`,
    `- WebP invalides: ${summary.invalidImageCount}`,
    `- Echecs structurels: ${summary.failureCount}`,
    `- Alertes sensibles: ${summary.sensitiveFindingCount}`,
    "",
    "## Fichiers attendus",
    "",
    "| Statut | Produit | Role | WebP attendu | Octets | Blocages |",
    "|---|---|---|---|---:|---|",
    ...rows,
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
    "- Lecture seule cote catalogue.",
    "- Aucun telechargement image.",
    "- Aucune copie dans `public/uploads`.",
    "- Aucun fournisseur ou marketplace expose client.",
    "- HOLD maintenu tant que les WebP exacts, droits image et validation Mouss ne sont pas prouves.",
    "",
  ].join("\n")}\n`;
}

function toCsv(summary) {
  const headers = [
    "status",
    "rank",
    "top3Rank",
    "productId",
    "productName",
    "categoryId",
    "role",
    "expectedFileName",
    "expectedTargetPathRelative",
    "expectedExists",
    "webpHeaderOk",
    "fileSizeBytes",
    "readyForHumanReview",
    "blockers",
  ];

  return `${headers.join(";")}\n${summary.items
    .map((item) => headers.map((header) => csvEscape(item[header])).join(";"))
    .join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const workpackPath = latestFile(workpackRoot, /TOP3_WEBP_SOURCING_INTEGRATION_\d+\.json$/);
const workpackAuditPath = latestFile(workpackAuditRoot, /AUDIT_TOP3_WEBP_SOURCING_INTEGRATION_\d+\.json$/);
const workpack = readJsonIfExists(workpackPath);
const workpackAudit = readJsonIfExists(workpackAuditPath);
const issues = [];
const workpackKey = workpackDateKey(workpackPath);

if (!workpackPath || !workpack) {
  addIssue(issues, "workpack", "top3_webp_workpack_missing", "Le workpack WebP top 3 est introuvable.");
}

if (!workpackAuditPath || !workpackAudit) {
  addIssue(issues, "workpack_audit", "top3_webp_workpack_audit_missing", "L'audit workpack WebP top 3 est introuvable.");
}

if (workpack && workpack.status !== "HOLD_TOP3_WEBP_WORKPACK_READY") {
  addIssue(issues, "workpack", "top3_webp_workpack_status_invalid", "Le workpack WebP top 3 doit rester en HOLD pret.", {
    status: workpack.status,
  });
}

if (workpackAudit && workpackAudit.status !== "OK_TOP3_WEBP_WORKPACK_GUARDED") {
  addIssue(issues, "workpack_audit", "top3_webp_workpack_audit_status_invalid", "L'audit workpack WebP top 3 n'est pas OK.", {
    status: workpackAudit.status,
  });
}

const imageTasks = Array.isArray(workpack?.imageTasks) ? workpack.imageTasks : [];
if (workpack && (workpack.productCount !== 3 || workpack.imageTaskCount !== 9 || imageTasks.length !== 9)) {
  addIssue(issues, "workpack", "top3_webp_workpack_scope_invalid", "Le workpack WebP top 3 doit contenir 3 produits / 9 images.", {
    productCount: workpack.productCount,
    imageTaskCount: workpack.imageTaskCount,
    taskRows: imageTasks.length,
  });
}

const items = imageTasks.map((task, index) => auditTask(task, index, issues));
const sourceTextFiles = [
  workpackPath,
  workpackAuditPath,
  workpackPath ? path.join(path.dirname(workpackPath), `TOP3_WEBP_SOURCING_INTEGRATION_${workpackKey}.md`) : null,
  workpackPath ? path.join(path.dirname(workpackPath), `top3-webp-sourcing-integration-${workpackKey}.csv`) : null,
  workpackPath ? path.join(path.dirname(workpackPath), `A_REMPLIR_TOP3_WEBP_SOURCING_${workpackKey}.csv`) : null,
  ...(workpackPath
    ? walkFiles(path.join(path.dirname(workpackPath), "images"), (filePath) =>
        [".json", ".md", ".csv"].includes(path.extname(filePath).toLowerCase()),
      )
    : []),
].filter((filePath) => filePath && fs.existsSync(filePath));
const sensitiveFindings = scanSensitiveArtifacts(sourceTextFiles);

const readyImageCount = items.filter((item) => item.readyForHumanReview).length;
const missingCount = items.filter((item) => !item.expectedExists).length;
const invalidImageCount = items.filter((item) => item.expectedExists && !item.readyForHumanReview).length;
const ok = issues.length === 0 && invalidImageCount === 0 && sensitiveFindings.length === 0;
const status = !ok
  ? "FAIL_TOP3_WEBP_DEPOT_FILES_GUARDS"
  : readyImageCount === 9 && missingCount === 0
    ? "READY_TOP3_WEBP_FILES_FOR_HUMAN_REVIEW_HOLD"
    : "HOLD_TOP3_WEBP_FILES_MISSING";

const summary = {
  ok,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_integration_top3_webp_depot_files_audit",
  status,
  productCount: workpack?.productCount ?? 0,
  imageTaskCount: workpack?.imageTaskCount ?? 0,
  readyImageCount,
  missingCount,
  invalidImageCount,
  scannedFileCount: sourceTextFiles.length,
  failureCount: issues.length,
  sensitiveFindingCount: sensitiveFindings.length,
  items,
  issues,
  sensitiveFindings,
  sources: {
    workpackPath: rel(workpackPath),
    workpackAuditPath: rel(workpackAuditPath),
    allowedDepositRootRelative,
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
    manualValidationRequired: true,
  },
};

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const jsonPath = path.join(outputDir, `AUDIT_TOP3_WEBP_DEPOT_FILES_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_TOP3_WEBP_DEPOT_FILES_SOURCING_INTEGRATION_${dateKey}.md`);
const csvPath = path.join(outputDir, `audit-top3-webp-depot-files-sourcing-integration-${dateKey}.csv`);

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
      readyImageCount: summary.readyImageCount,
      missingCount: summary.missingCount,
      invalidImageCount: summary.invalidImageCount,
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

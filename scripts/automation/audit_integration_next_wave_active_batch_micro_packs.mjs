import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const microPacksRoot = path.join(actionRoot, "micro-packs-lot-actif-prochaine-vague-sourcing-integration-articles");
const activeBatchRoot = path.join(actionRoot, "lot-actif-prochaine-vague-sourcing-integration-articles");
const businessGateRoot = path.join(
  actionRoot,
  "audit-lot-actif-business-gate-prochaine-vague-sourcing-integration-articles",
);
const outputRoot = path.join(actionRoot, "audit-micro-packs-lot-actif-prochaine-vague-sourcing-integration-articles");
const allowedDepositPrefix = "business-maxi-trouvailles/depots-images-exactes/integration-articles/";
const allowedProofPrefix = "business-maxi-trouvailles/preuves-internes/integration-articles/";
const requiredActionHeaders = [
  "action_order",
  "batch_id",
  "product_rank",
  "product_id",
  "product_name",
  "category_id",
  "action_type",
  "label",
  "status",
  "next_action",
  "admin_href",
  "target_path",
  "reject_if",
];
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
  "businessGateRequired",
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

function normalizeRel(value) {
  return String(value ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
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

function validateCsvHeaders(issues, scope, csv, requiredHeaders) {
  for (const header of requiredHeaders) {
    if (!csv.headers.includes(header)) {
      addIssue(issues, scope, "missing_csv_header", "Une colonne CSV obligatoire manque.", { header });
    }
  }
}

function isInternalAdminHref(value) {
  const text = String(value ?? "").trim();
  return text.startsWith("/admin/") && !text.startsWith("//") && !externalUrlPattern.test(text);
}

function isSafeRelativePath(value, prefix) {
  const text = normalizeRel(value);
  return (
    text.startsWith(prefix) &&
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
    "# Audit micro-packs lot actif prochaine vague",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Lot actif: ${summary.activeBatchId}`,
    `- Produits: ${summary.productCount}`,
    `- Fiches produit JSON: ${summary.productJsonFileCount}`,
    `- Fiches produit Markdown: ${summary.productMdFileCount}`,
    `- Preuves: ${summary.proofTaskCount}`,
    `- Images: ${summary.imageTaskCount}`,
    `- Actions: ${summary.actionCount}`,
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
    "- Lecture seule cote catalogue.",
    "- Aucune valeur fournisseur brute exportee.",
    "- Aucun telechargement image.",
    "- Aucune copie publique.",
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
const microPacksPath = latestFile(
  microPacksRoot,
  /MICRO_PACKS_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch micro packs",
);
const activeBatchPath = latestFile(
  activeBatchRoot,
  /ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch",
);
const businessGatePath = latestFile(
  businessGateRoot,
  /AUDIT_ACTIVE_BATCH_BUSINESS_GATE_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch business gate",
);

const microPacks = readJson(microPacksPath);
const activeBatch = readJson(activeBatchPath);
const businessGate = readJson(businessGatePath);
const outputDir = path.dirname(microPacksPath);
const productDir = path.join(outputDir, "fiches-produits");
const actionCsvPath = path.join(outputDir, `micro-packs-lot-actif-actions-${dateKey}.csv`);
const actionCsv = readCsv(actionCsvPath);
const issues = [];

if (microPacks.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_MICRO_PACKS_READY") {
  addIssue(issues, "micro_packs", "micro_pack_status_invalid", "Les micro-packs doivent rester prets en HOLD.", {
    status: microPacks.status,
  });
}

if (activeBatch.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_READY") {
  addIssue(issues, "active_batch", "active_batch_status_invalid", "Le lot actif source n'est pas pret en HOLD.", {
    status: activeBatch.status,
  });
}

if (businessGate.failureCount !== 0 || businessGate.sensitiveFindingCount !== 0) {
  addIssue(issues, "business_gate", "business_gate_not_clean", "Le gate business source a des echecs ou fuites.", {
    failureCount: businessGate.failureCount,
    sensitiveFindingCount: businessGate.sensitiveFindingCount,
  });
}

if (microPacks.productCount !== 4 || microPacks.proofTaskCount !== 20 || microPacks.imageTaskCount !== 12) {
  addIssue(issues, "micro_packs", "micro_pack_scope_invalid", "Les compteurs micro-packs sont incorrects.", {
    productCount: microPacks.productCount,
    proofTaskCount: microPacks.proofTaskCount,
    imageTaskCount: microPacks.imageTaskCount,
  });
}

if (microPacks.actionCount !== 32 || actionCsv.rows.length !== 32) {
  addIssue(issues, "actions", "micro_pack_action_count_invalid", "Les micro-packs doivent contenir 32 actions.", {
    actionCount: microPacks.actionCount,
    csvRows: actionCsv.rows.length,
  });
}

validateCsvHeaders(issues, "actions_csv", actionCsv, requiredActionHeaders);

for (const flag of requiredSafetyFlags) {
  if (microPacks.safety?.[flag] !== true) {
    addIssue(issues, "safety", "missing_safety_flag", "Un garde-fou micro-packs est absent.", { flag });
  }
}

const productJsonFiles = walkFiles(productDir, (filePath) => filePath.endsWith(".json"));
const productMdFiles = walkFiles(productDir, (filePath) => filePath.endsWith(".md"));
if (productJsonFiles.length !== 4 || productMdFiles.length !== 4) {
  addIssue(issues, "product_files", "product_file_count_invalid", "Les 4 fiches JSON et 4 fiches Markdown sont requises.", {
    jsonCount: productJsonFiles.length,
    mdCount: productMdFiles.length,
  });
}

const productPacks = productJsonFiles.map(readJson);
for (const pack of productPacks) {
  if (pack.status !== "HOLD_ACTIVE_BATCH_MICRO_PACK_READY") {
    addIssue(issues, pack.productId, "product_pack_status_invalid", "Une fiche produit n'est pas en HOLD pret.", {
      status: pack.status,
    });
  }
  if (!isInternalAdminHref(pack.adminProofHref)) {
    addIssue(issues, pack.productId, "admin_href_invalid", "Lien admin interne invalide.", { value: pack.adminProofHref });
  }
  if ((pack.proofTasks ?? []).length !== 5 || (pack.imageTasks ?? []).length !== 3 || (pack.actions ?? []).length !== 8) {
    addIssue(issues, pack.productId, "product_pack_scope_invalid", "Une fiche produit doit avoir 5 preuves, 3 images et 8 actions.", {
      proofTaskCount: pack.proofTasks?.length ?? 0,
      imageTaskCount: pack.imageTasks?.length ?? 0,
      actionCount: pack.actions?.length ?? 0,
    });
  }
  for (const proof of pack.proofTasks ?? []) {
    if (proof.status !== "TO_FILL_HOLD") {
      addIssue(issues, proof.taskId, "proof_status_invalid", "Une preuve micro-pack doit rester a remplir en HOLD.", {
        status: proof.status,
      });
    }
    if (!isSafeRelativePath(proof.localProofPath, allowedProofPrefix)) {
      addIssue(issues, proof.taskId, "proof_path_invalid", "Chemin preuve local invalide.", {
        localProofPath: proof.localProofPath,
      });
    }
  }
  for (const image of pack.imageTasks ?? []) {
    if (image.status !== "TO_DEPOSIT_HOLD") {
      addIssue(issues, image.taskId, "image_status_invalid", "Une image micro-pack doit rester a deposer en HOLD.", {
        status: image.status,
      });
    }
    if (!String(image.expectedFileName ?? "").endsWith(".webp")) {
      addIssue(issues, image.taskId, "image_filename_invalid", "Le fichier image attendu doit etre en .webp.", {
        expectedFileName: image.expectedFileName,
      });
    }
    if (!isSafeRelativePath(image.depositDirRelative, allowedDepositPrefix)) {
      addIssue(issues, image.taskId, "image_deposit_dir_invalid", "Dossier depot WebP invalide.", {
        depositDirRelative: image.depositDirRelative,
      });
    }
    if (normalizeRel(image.localFilePath) !== `${normalizeRel(image.depositDirRelative)}/${image.expectedFileName}`) {
      addIssue(issues, image.taskId, "image_local_path_mismatch", "Le chemin image local ne correspond pas au depot attendu.", {
        localFilePath: image.localFilePath,
      });
    }
  }
}

for (const row of actionCsv.rows) {
  if (!isInternalAdminHref(row.admin_href)) {
    addIssue(issues, row.product_id, "action_admin_href_invalid", "Une action n'a pas de lien admin interne valide.", {
      adminHref: row.admin_href,
    });
  }
  if (!["proof", "image"].includes(row.action_type)) {
    addIssue(issues, row.product_id, "action_type_invalid", "Type d'action micro-pack invalide.", {
      actionType: row.action_type,
    });
  }
  if (!["TO_FILL_HOLD", "TO_DEPOSIT_HOLD"].includes(row.status)) {
    addIssue(issues, row.product_id, "action_status_invalid", "Statut action micro-pack invalide.", {
      status: row.status,
    });
  }
  if (row.action_type === "proof" && !isSafeRelativePath(row.target_path, allowedProofPrefix)) {
    addIssue(issues, row.product_id, "action_proof_target_invalid", "Cible preuve action invalide.", {
      targetPath: row.target_path,
    });
  }
  if (row.action_type === "image" && !isSafeRelativePath(row.target_path, allowedDepositPrefix)) {
    addIssue(issues, row.product_id, "action_image_target_invalid", "Cible image action invalide.", {
      targetPath: row.target_path,
    });
  }
}

const scannedFiles = walkFiles(outputDir, (filePath) =>
  [".json", ".md", ".csv"].includes(path.extname(filePath).toLowerCase()),
);
const sensitiveFindings = scanSensitiveArtifacts(scannedFiles);
for (const finding of sensitiveFindings) {
  addIssue(issues, "sensitive_scan", "sensitive_finding", "Marqueur sensible detecte dans les micro-packs.", finding);
}

const summary = {
  ok: issues.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_audit_integration_next_wave_active_batch_micro_packs",
  status: issues.length === 0 ? "OK_NEXT_WAVE_ACTIVE_BATCH_MICRO_PACKS_GUARDED" : "FAIL_NEXT_WAVE_ACTIVE_BATCH_MICRO_PACKS",
  activeBatchId: microPacks.activeBatchId,
  productCount: microPacks.productCount ?? 0,
  productJsonFileCount: productJsonFiles.length,
  productMdFileCount: productMdFiles.length,
  proofTaskCount: microPacks.proofTaskCount ?? 0,
  imageTaskCount: microPacks.imageTaskCount ?? 0,
  actionCount: microPacks.actionCount ?? 0,
  csvActionRowCount: actionCsv.rows.length,
  failureCount: issues.length,
  sensitiveFindingCount: sensitiveFindings.length,
  scannedFileCount: scannedFiles.length,
  issues,
  sources: {
    microPacksPath: rel(microPacksPath),
    activeBatchPath: rel(activeBatchPath),
    businessGatePath: rel(businessGatePath),
    actionCsvPath: rel(actionCsvPath),
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

const jsonPath = path.join(auditDir, `AUDIT_MICRO_PACKS_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(auditDir, `audit-micro-packs-lot-actif-prochaine-vague-sourcing-${dateKey}.md`);
const csvPath = path.join(auditDir, `audit-micro-packs-lot-actif-prochaine-vague-sourcing-issues-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, issuesCsv(issues), "utf8");

console.log(
  JSON.stringify(
    {
      status: summary.status,
      ok: summary.ok,
      activeBatchId: summary.activeBatchId,
      productCount: summary.productCount,
      productJsonFileCount: summary.productJsonFileCount,
      productMdFileCount: summary.productMdFileCount,
      proofTaskCount: summary.proofTaskCount,
      imageTaskCount: summary.imageTaskCount,
      actionCount: summary.actionCount,
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

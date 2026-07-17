import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const top3Root = path.join(actionRoot, "top3-sourcing-integration-articles");
const top3AuditRoot = path.join(actionRoot, "audit-top3-sourcing-integration-articles");
const outputRoot = path.join(actionRoot, "top3-webp-sourcing-integration-articles");

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

function slugSafe(value) {
  return (
    String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "image"
  );
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function imageRole(fileName, index) {
  if (fileName.includes("-main.")) return "main";
  if (fileName.includes("-variant.")) return "variant";
  if (fileName.includes("-detail-")) return "detail";
  return `image-${index + 1}`;
}

function addFailure(failures, scope, code, message, details = {}) {
  failures.push({ scope, code, message, ...details });
}

function validateNoLeaks(value) {
  const serialized = JSON.stringify(value);
  const findings = [];
  const checks = [
    ["external_url", externalUrlPattern],
    ["marketplace_marker", forbiddenPattern],
    ["sensitive_assignment", sensitivePattern],
    ["key_like_value", keyLikePattern],
  ];

  for (const [type, regex] of checks) {
    if (regex.test(serialized)) {
      findings.push(type);
    }
  }

  return findings;
}

function buildImageTasks({ top3, top3Audit, structuralFailures }) {
  if (top3.status !== "HOLD_TOP3_SOURCING_READY") {
    addFailure(structuralFailures, "top3", "top3_not_ready", "Le sprint top 3 source n'est pas pret en HOLD.", {
      status: top3.status,
    });
  }

  if (top3Audit.status !== "OK_TOP3_SOURCING_GUARDED" || top3Audit.failureCount !== 0) {
    addFailure(structuralFailures, "top3_audit", "top3_audit_not_ok", "L'audit top 3 source n'est pas OK.", {
      status: top3Audit.status,
      failureCount: top3Audit.failureCount,
    });
  }

  return [...(top3.rows ?? [])]
    .sort((a, b) => a.sprintRank - b.sprintRank)
    .flatMap((row) =>
      (row.expectedImageFiles ?? []).map((fileName, index) => ({
        rank: 0,
        top3Rank: row.sprintRank,
        productId: row.productId,
        productSlug: row.slug,
        productName: row.name,
        categoryId: row.categoryId,
        role: imageRole(fileName, index),
        order: index + 1,
        expectedFileName: fileName,
        imageDepositDirRelative: row.imageDepositDirRelative,
        expectedTargetPathRelative: `${row.imageDepositDirRelative}/${fileName}`,
        adminProofHref: row.adminProofHref,
        status: "MISSING_HOLD",
        manualInput: {
          sourceLocalFile: "",
          rightsNote: "",
          exactSameArticle: "",
          exactVariantConfirmed: "",
          moussValidation: "",
          finalDecision: "HOLD_TO_FILL",
        },
        nextAction: "Deposer un WebP exact local uniquement apres preuve meme article, droits image et validation Mouss.",
      })),
    )
    .map((task, index) => ({ ...task, rank: index + 1 }));
}

function validateImageTasks(tasks, structuralFailures) {
  for (const task of tasks) {
    if (typeof task.expectedFileName !== "string" || !/^[a-z0-9][a-z0-9-]*\.webp$/i.test(task.expectedFileName)) {
      addFailure(structuralFailures, "image", "invalid_expected_file_name", "Nom WebP attendu invalide.", {
        productId: task.productId,
        expectedFileName: task.expectedFileName,
      });
    }

    if (!String(task.imageDepositDirRelative ?? "").startsWith("business-maxi-trouvailles/depots-images-exactes/integration-articles/")) {
      addFailure(structuralFailures, "image", "invalid_deposit_dir", "Dossier depot WebP hors zone integration.", {
        productId: task.productId,
        imageDepositDirRelative: task.imageDepositDirRelative,
      });
    }

    if (task.manualInput.finalDecision !== "HOLD_TO_FILL") {
      addFailure(structuralFailures, "image", "manual_decision_not_hold", "Decision manuelle image non HOLD.", {
        productId: task.productId,
        expectedFileName: task.expectedFileName,
      });
    }
  }
}

function taskMarkdown(task) {
  return `${[
    `# WebP top 3 ${task.rank} - ${task.productName}`,
    "",
    `Rang top 3: ${task.top3Rank}`,
    `Produit: ${task.productName}`,
    `Categorie: ${task.categoryId}`,
    `Role image: ${task.role}`,
    `Fichier attendu: ${task.expectedFileName}`,
    `Statut: ${task.status}`,
    "",
    "## Depot attendu",
    "",
    `- Dossier: ${task.imageDepositDirRelative}`,
    `- Chemin cible: ${task.expectedTargetPathRelative}`,
    "",
    "## A remplir manuellement",
    "",
    "- Fichier source local: ",
    "- Note droits image: ",
    "- Meme article exact confirme: ",
    "- Variante exacte confirmee: ",
    "- Validation Mouss: ",
    "- Decision finale: HOLD_TO_FILL",
    "",
    "## Liens",
    "",
    `- Lien admin: ${task.adminProofHref}`,
    "",
    "## Garde-fous",
    "",
    "- Ne pas telecharger automatiquement.",
    "- Ne pas copier dans public/uploads.",
    "- Ne pas publier.",
    "- Ne pas utiliser une image approximative.",
    "- Garder HOLD jusqu'a preuve image exacte, droits image et validation humaine Mouss.",
    "",
  ].join("\n")}\n`;
}

function markdownReport(payload) {
  const rows = payload.imageTasks.map(
    (task) =>
      `| ${task.rank} | ${task.top3Rank} | ${mdCell(task.productName)} | ${task.role} | ${mdCell(
        task.expectedFileName,
      )} | ${mdCell(task.imageDepositDirRelative)} |`,
  );

  return `${[
    "# Maxi Trouvailles - Top 3 WebP exacts sourcing",
    "",
    `Date locale: ${payload.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Statut: ${payload.status}`,
    `- Produits top 3: ${payload.productCount}`,
    `- WebP exacts attendus: ${payload.imageTaskCount}`,
    `- Audit top 3 source: ${payload.top3AuditStatus}`,
    "",
    "## Images a deposer",
    "",
    "| # | Top 3 | Produit | Role | Fichier attendu | Dossier depot |",
    "|---:|---:|---|---|---|---|",
    ...rows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule cote catalogue.",
    "- Aucune image telechargee.",
    "- Aucune copie vers public/uploads.",
    "- Aucun fournisseur contacte.",
    "- Aucune publication.",
    "- Les valeurs restent a remplir manuellement.",
    "",
  ].join("\n")}\n`;
}

function workCsv(tasks) {
  const headers = [
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
  const rows = tasks.map((task) => [
    task.rank,
    task.top3Rank,
    task.productId,
    task.productName,
    task.categoryId,
    task.role,
    task.expectedFileName,
    task.imageDepositDirRelative,
    task.expectedTargetPathRelative,
    task.adminProofHref,
    task.status,
    task.manualInput.sourceLocalFile,
    task.manualInput.rightsNote,
    task.manualInput.exactSameArticle,
    task.manualInput.exactVariantConfirmed,
    task.manualInput.moussValidation,
    task.manualInput.finalDecision,
  ]);

  return `${headers.join(";")}\n${rows.map((row) => row.map(csvEscape).join(";")).join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const top3Path = latestFile(top3Root, /TOP3_SOURCING_INTEGRATION_\d+\.json$/);
const top3AuditPath = latestFile(top3AuditRoot, /AUDIT_TOP3_SOURCING_INTEGRATION_\d+\.json$/);
const top3 = readJson(top3Path);
const top3Audit = readJson(top3AuditPath);
const structuralFailures = [];
const imageTasks = buildImageTasks({ top3, top3Audit, structuralFailures });
validateImageTasks(imageTasks, structuralFailures);

if (imageTasks.length === 0) {
  addFailure(structuralFailures, "image", "no_image_tasks_found", "Aucune tache WebP top 3 generee.");
}

const payload = {
  ok: structuralFailures.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_integration_top3_webp_workpack",
  status:
    structuralFailures.length === 0
      ? "HOLD_TOP3_WEBP_WORKPACK_READY"
      : "HOLD_TOP3_WEBP_WORKPACK_A_CORRIGER",
  productCount: top3.productCount ?? 0,
  imageTaskCount: imageTasks.length,
  top3AuditStatus: top3Audit.status ?? "absent",
  structuralFailures,
  imageTasks,
  sources: {
    top3Path: rel(top3Path),
    top3AuditPath: rel(top3AuditPath),
  },
  safety: {
    readOnly: true,
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

const leakFindings = validateNoLeaks(payload);
if (leakFindings.length > 0) {
  payload.ok = false;
  payload.status = "FAIL_TOP3_WEBP_SENSITIVE_OUTPUT";
  payload.leakFindings = leakFindings;
}

const outputDir = path.join(outputRoot, dateKey);
const imageDir = path.join(outputDir, "images");
fs.mkdirSync(imageDir, { recursive: true });

for (const task of imageTasks) {
  const baseName = `webp-${String(task.rank).padStart(2, "0")}-top${task.top3Rank}-${slugSafe(
    task.productName,
  )}-${slugSafe(task.role)}`;
  fs.writeFileSync(path.join(imageDir, `${baseName}.md`), taskMarkdown(task), "utf8");
  fs.writeFileSync(path.join(imageDir, `${baseName}.json`), `${JSON.stringify(task, null, 2)}\n`, "utf8");
}

const jsonPath = path.join(outputDir, `TOP3_WEBP_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `TOP3_WEBP_SOURCING_INTEGRATION_${dateKey}.md`);
const csvPath = path.join(outputDir, `top3-webp-sourcing-integration-${dateKey}.csv`);
const fillableCsvPath = path.join(outputDir, `A_REMPLIR_TOP3_WEBP_SOURCING_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(payload), "utf8");
fs.writeFileSync(csvPath, workCsv(imageTasks), "utf8");
fs.writeFileSync(fillableCsvPath, workCsv(imageTasks), "utf8");

console.log(
  JSON.stringify(
    {
      ok: payload.ok,
      mode: payload.mode,
      status: payload.status,
      productCount: payload.productCount,
      imageTaskCount: payload.imageTaskCount,
      structuralFailureCount: payload.structuralFailures.length,
      files: { jsonPath, mdPath, csvPath, fillableCsvPath, imageDir },
      safety: payload.safety,
    },
    null,
    2,
  ),
);

if (!payload.ok) {
  process.exitCode = 1;
}

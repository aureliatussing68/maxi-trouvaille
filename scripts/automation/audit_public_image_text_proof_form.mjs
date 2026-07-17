import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const requiredSafetyFlags = [
  "readOnlyInputs",
  "noCatalogWrite",
  "noImageDownload",
  "noImageFileCreated",
  "noPublicImageWrite",
  "noPublication",
  "noPayment",
  "noSupplierOrder",
  "noMessageSent",
  "requiresMoussValidation",
  "noSensitiveValuesExported",
];
const leakPattern = /(https?:\/\/|aliexpress|alicdn|ae-pic|temu|dhgate|api[_-]?key|token|password|sk_live|sk_test)/i;
const allowedValuePlaceholder = "A_REMPLIR_DANS_CHECKLIST";
const requiredFieldKeys = [
  "source_image_exacte",
  "droits_image",
  "meme_article_exact_confirme",
  "variante_exacte_confirmee",
  "validation_mouss",
  "decision_copie_publique",
];

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

function latestDirectoryUnder(dirPath, prefix, excludedPrefix = null) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return null;
  }

  return (
    fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          entry.name.startsWith(prefix) &&
          (!excludedPrefix || !entry.name.startsWith(excludedPrefix)),
      )
      .map((entry) => path.join(dirPath, entry.name))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] ?? null
  );
}

function latestFileUnder(dirPath, prefix) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return null;
  }

  return (
    fs
      .readdirSync(dirPath)
      .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
      .map((name) => path.join(dirPath, name))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] ?? null
  );
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function collectTextFiles(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath)
    .filter((name) => [".json", ".md", ".csv"].includes(path.extname(name).toLowerCase()))
    .map((name) => path.join(dirPath, name));
}

function isProofPath(value) {
  const normalized = String(value ?? "").replace(/\\/g, "/");
  return normalized.startsWith("business-maxi-trouvailles/preuves-images-publiques/");
}

function isTargetPublicPath(value) {
  return /^\/uploads\/partner-products\/[^?#]+\.webp$/i.test(String(value ?? ""));
}

function assertCondition(condition, code, message, details = {}) {
  if (!condition) {
    return { code, message, details };
  }
  return null;
}

function csvEscape(value) {
  const text = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(failures) {
  const headers = ["code", "message", "details"];

  return `${headers.join(",")}\n${failures
    .map((failure) => headers.map((header) => csvEscape(failure[header])).join(","))
    .join("\n")}\n`;
}

function markdown(summary) {
  const rows =
    summary.failures.length === 0
      ? ["| OK | Aucun echec | - |"]
      : summary.failures.map(
          (failure) => `| ${failure.code} | ${failure.message} | ${csvEscape(failure.details)} |`,
        );

  return `${[
    "# Audit formulaire preuves texte images publiques",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Formulaire: ${summary.formJson ?? "absent"}`,
    "",
    "## Synthese",
    "",
    `- Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    `- Produits controles: ${summary.itemCount}`,
    `- Lignes controlees: ${summary.rowCount}`,
    `- Fichiers scannes: ${summary.scannedFileCount}`,
    `- Echecs: ${summary.failureCount}`,
    "",
    "| Code | Message | Details |",
    "|---|---|---|",
    ...rows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule.",
    "- Valeurs source/fournisseur non exportees.",
    "- Aucune copie publique.",
    "- Aucune modification catalogue.",
    "- Aucune publication.",
    "- Aucun paiement.",
    "- Aucune commande partenaire.",
    "",
  ].join("\n")}\n`;
}

function findLeaks(files) {
  return files
    .map((filePath) => {
      const content = fs.readFileSync(filePath, "utf8");
      if (!leakPattern.test(content)) {
        return null;
      }

      return {
        file: rel(filePath),
        message: "Marqueur sensible detecte dans le formulaire preuves texte images publiques.",
      };
    })
    .filter(Boolean);
}

function rowFailures(row, index) {
  return [
    assertCondition(row.valueToFill === allowedValuePlaceholder, "row_value_not_placeholder", "Une ligne contient une valeur remplie.", {
      index,
      slug: row.slug,
      fieldKey: row.fieldKey,
    }),
    assertCondition(requiredFieldKeys.includes(row.fieldKey), "row_field_key_invalid", "Cle de champ inattendue.", {
      index,
      slug: row.slug,
      fieldKey: row.fieldKey,
    }),
    assertCondition(String(row.expectedFileName ?? "").endsWith(".webp"), "row_expected_file_invalid", "Nom WebP invalide.", {
      index,
      slug: row.slug,
      expectedFileName: row.expectedFileName,
    }),
    assertCondition(isProofPath(row.checklistPath), "row_checklist_path_invalid", "Checklist hors preuves images.", {
      index,
      slug: row.slug,
      checklistPath: row.checklistPath,
    }),
    assertCondition(isProofPath(row.dropFolder), "row_drop_folder_invalid", "Dossier depot hors preuves images.", {
      index,
      slug: row.slug,
      dropFolder: row.dropFolder,
    }),
    assertCondition(
      isTargetPublicPath(row.targetPublicPath),
      "row_target_public_path_invalid",
      "Cible publique invalide.",
      { index, slug: row.slug, targetPublicPath: row.targetPublicPath },
    ),
    assertCondition(!leakPattern.test(JSON.stringify(row)), "row_leak_marker", "Marqueur sensible dans une ligne.", {
      index,
      slug: row.slug,
      fieldKey: row.fieldKey,
    }),
  ].filter(Boolean);
}

const formDir = latestDirectoryUnder(
  actionRoot,
  "public-image-text-proof-form-",
  "public-image-text-proof-form-audit-",
);
const formJsonPath = latestFileUnder(formDir, "FORMULAIRE_PREUVES_TEXTE_IMAGES_PUBLIQUES_");
const boardDir = latestDirectoryUnder(
  actionRoot,
  "public-image-mouss-review-board-",
  "public-image-mouss-review-board-audit-",
);
const boardJsonPath = latestFileUnder(boardDir, "BOARD_MOUSS_IMAGES_PUBLIQUES_");
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `public-image-text-proof-form-audit-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const failures = [];
let form = null;
let board = null;
let rows = [];
let items = [];
let files = [];

if (!formDir || !formJsonPath) {
  failures.push({
    code: "form_missing",
    message: "Aucun formulaire preuves texte images publiques n'a ete trouve.",
    details: {},
  });
} else {
  form = readJson(formJsonPath);
  board = boardJsonPath ? readJson(boardJsonPath) : null;
  rows = Array.isArray(form.rows) ? form.rows : [];
  items = Array.isArray(form.items) ? form.items : [];
  files = collectTextFiles(formDir);
  const leaks = findLeaks(files);
  const expectedRowsFromBoard =
    board && Array.isArray(board.items)
      ? board.items.reduce((sum, item) => sum + (Array.isArray(item.fieldsToFill) ? item.fieldsToFill.length : 0), 0)
      : null;

  failures.push(
    assertCondition(form.ok === true, "form_not_ok", "Le formulaire n'est pas marque OK."),
    assertCondition(
      form.mode === "manual_public_image_text_proof_form",
      "form_mode_invalid",
      "Le mode du formulaire est invalide.",
      { mode: form.mode },
    ),
    assertCondition(form.sensitiveValuesExported === false, "sensitive_values_exported", "Le formulaire indique exporter des valeurs sensibles."),
    assertCondition(form.itemCount === items.length, "item_count_mismatch", "itemCount ne correspond pas aux produits.", {
      itemCount: form.itemCount,
      rows: items.length,
    }),
    assertCondition(form.rowCount === rows.length, "row_count_mismatch", "rowCount ne correspond pas aux lignes.", {
      rowCount: form.rowCount,
      rows: rows.length,
    }),
    assertCondition(rows.length > 0, "rows_missing", "Aucune ligne de preuve texte dans le formulaire."),
    assertCondition(
      expectedRowsFromBoard === null || rows.length === expectedRowsFromBoard,
      "board_row_count_mismatch",
      "Le formulaire n'est pas aligne avec les champs manquants du board Mouss.",
      { formRows: rows.length, expectedRowsFromBoard },
    ),
    ...requiredSafetyFlags.map((flag) =>
      assertCondition(form.safety?.[flag] === true, `safety_${flag}_missing`, `Garde-fou absent ou faux: ${flag}.`),
    ),
    ...rows.flatMap(rowFailures),
    ...leaks.map((leak) => ({
      code: "artifact_leak_marker",
      message: leak.message,
      details: { file: leak.file },
    })),
  );
}

const cleanFailures = failures.filter(Boolean);
const summary = {
  ok: cleanFailures.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "manual_public_image_text_proof_form_audit",
  formDir: formDir ? rel(formDir) : null,
  formJson: formJsonPath ? rel(formJsonPath) : null,
  sourceBoard: form?.sourceBoard ?? (boardJsonPath ? rel(boardJsonPath) : null),
  itemCount: items.length,
  rowCount: rows.length,
  scannedFileCount: files.length,
  failureCount: cleanFailures.length,
  failures: cleanFailures,
  safety: {
    readOnlyAudit: true,
    noCatalogWrite: true,
    noImageDownload: true,
    noImageFileCreated: true,
    noPublicImageWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noMessageSent: true,
  },
};

const jsonPath = path.join(outputDir, `AUDIT_FORMULAIRE_PREUVES_TEXTE_IMAGES_PUBLIQUES_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_FORMULAIRE_PREUVES_TEXTE_IMAGES_PUBLIQUES_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-audit-formulaire-preuves-texte-images-publiques-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, toCsv(cleanFailures), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      itemCount: summary.itemCount,
      rowCount: summary.rowCount,
      scannedFileCount: summary.scannedFileCount,
      failureCount: summary.failureCount,
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

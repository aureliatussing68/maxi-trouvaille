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
const allowedStatuses = ["HOLD_A_COMPLETER", "WEBP_PRESENT_PREUVES_A_COMPLETER", "READY_REVIEW_MOUSS_HOLD"];
const allowedWebpStatuses = ["WEBP_MANQUANT", "WEBP_INVALIDE", "WEBP_VALIDE"];
const allowedChecklistStatuses = ["CASES_A_COMPLETER", "CASES_COCHEES"];
const allowedEvidenceStatuses = ["PREUVES_TEXTE_A_REMPLIR", "PREUVES_TEXTE_OK"];

function datePartsParis(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    minute: "2-digit",
    hour: "2-digit",
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
    "# Audit board Mouss images publiques exactes",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Board: ${summary.boardJson ?? "absent"}`,
    "",
    "## Synthese",
    "",
    `- Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    `- Fiches controlees: ${summary.itemCount}`,
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
        message: "Marqueur sensible detecte dans le board Mouss images publiques.",
      };
    })
    .filter(Boolean);
}

const boardDir = latestDirectoryUnder(
  actionRoot,
  "public-image-mouss-review-board-",
  "public-image-mouss-review-board-audit-",
);
const boardJsonPath = latestFileUnder(boardDir, "BOARD_MOUSS_IMAGES_PUBLIQUES_");
const proofPackDir = latestDirectoryUnder(actionRoot, "public-image-proof-pack-", "public-image-proof-pack-audit-");
const proofPackPath = latestFileUnder(proofPackDir, "PACK_PREUVES_IMAGES_PUBLIQUES_");
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `public-image-mouss-review-board-audit-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const failures = [];
let items = [];
let files = [];

if (!boardDir || !boardJsonPath) {
  failures.push({
    code: "board_missing",
    message: "Aucun board Mouss images publiques n'a ete trouve.",
    details: {},
  });
} else {
  const board = readJson(boardJsonPath);
  const proofPack = proofPackPath ? readJson(proofPackPath) : null;
  items = Array.isArray(board.items) ? board.items : [];
  files = collectTextFiles(boardDir);
  const leaks = findLeaks(files);

  failures.push(
    assertCondition(board.ok === true, "board_not_ok", "Le board n'est pas marque OK."),
    assertCondition(
      board.mode === "manual_public_image_mouss_review_board",
      "board_mode_invalid",
      "Le mode du board Mouss est invalide.",
      { mode: board.mode },
    ),
    assertCondition(
      board.sensitiveValuesExported === false,
      "sensitive_values_exported",
      "Le board indique exporter des valeurs sensibles.",
    ),
    assertCondition(
      board.itemCount === items.length,
      "item_count_mismatch",
      "itemCount ne correspond pas aux lignes.",
      { itemCount: board.itemCount, rows: items.length },
    ),
    assertCondition(
      !proofPack || board.itemCount === proofPack.itemCount,
      "source_pack_count_mismatch",
      "Le board n'est pas aligne avec le pack preuves images.",
      { boardItemCount: board.itemCount, proofPackItemCount: proofPack?.itemCount },
    ),
    ...requiredSafetyFlags.map((flag) =>
      assertCondition(
        board.safety?.[flag] === true,
        `safety_${flag}_missing`,
        `Garde-fou absent ou faux: ${flag}.`,
      ),
    ),
    ...items.flatMap((item, index) => [
      assertCondition(item.rank === index + 1, "rank_invalid", "Rang board invalide.", {
        index,
        rank: item.rank,
        slug: item.slug,
      }),
      assertCondition(allowedStatuses.includes(item.status), "status_invalid", "Statut board inconnu.", {
        index,
        slug: item.slug,
        status: item.status,
      }),
      assertCondition(
        allowedWebpStatuses.includes(item.webpStatus),
        "webp_status_invalid",
        "Statut WebP inconnu.",
        { index, slug: item.slug, webpStatus: item.webpStatus },
      ),
      assertCondition(
        allowedChecklistStatuses.includes(item.checklistStatus),
        "checklist_status_invalid",
        "Statut checklist inconnu.",
        { index, slug: item.slug, checklistStatus: item.checklistStatus },
      ),
      assertCondition(
        allowedEvidenceStatuses.includes(item.evidenceStatus),
        "evidence_status_invalid",
        "Statut preuves texte inconnu.",
        { index, slug: item.slug, evidenceStatus: item.evidenceStatus },
      ),
      assertCondition(isProofPath(item.dropFolder), "drop_folder_invalid", "Dossier depot hors preuves.", {
        index,
        slug: item.slug,
        dropFolder: item.dropFolder,
      }),
      assertCondition(isProofPath(item.checklistPath), "checklist_path_invalid", "Checklist hors preuves.", {
        index,
        slug: item.slug,
        checklistPath: item.checklistPath,
      }),
      assertCondition(
        isTargetPublicPath(item.targetPublicPath),
        "target_public_path_invalid",
        "Cible publique invalide.",
        { index, slug: item.slug, targetPublicPath: item.targetPublicPath },
      ),
      assertCondition(
        !Object.hasOwn(item, "evidenceValues"),
        "evidence_values_exported",
        "Une ligne expose des valeurs de preuve au lieu de statuts.",
        { index, slug: item.slug },
      ),
      assertCondition(!leakPattern.test(JSON.stringify(item)), "item_leak_marker", "Marqueur sensible dans une ligne.", {
        index,
        slug: item.slug,
      }),
    ]),
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
  mode: "manual_public_image_mouss_review_board_audit",
  boardDir: boardDir ? rel(boardDir) : null,
  boardJson: boardJsonPath ? rel(boardJsonPath) : null,
  itemCount: items.length,
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

const jsonPath = path.join(outputDir, `AUDIT_BOARD_MOUSS_IMAGES_PUBLIQUES_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_BOARD_MOUSS_IMAGES_PUBLIQUES_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-audit-board-mouss-images-publiques-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, toCsv(cleanFailures), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      itemCount: summary.itemCount,
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

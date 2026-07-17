import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const packPrefix = "public-image-proof-pack-";
const leakPattern =
  /(https?:\/\/|aliexpress|alicdn|ae-pic|temu|supplierUrl|sourceUrl|productUrl|exactProductUrl)/i;
const ignoredDropFilePattern = /^(A_DEPOSER_.*\.txt|\.gitkeep|desktop\.ini)$/i;
const imageLikeExtensions = new Set([".webp", ".jpg", ".jpeg", ".png", ".gif", ".avif"]);
const requiredChecklistEvidenceFields = [
  "Source image exacte",
  "Droits image",
  "Meme article exact confirme",
  "Variante exacte confirmee",
  "Validation Mouss",
  "Decision copie publique",
];
const placeholderPattern = /^(a remplir|todo|hold|n\/a|na|non|no|-)?$/i;

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

function latestDirectoryUnder(dirPath, prefix) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return null;
  }

  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.startsWith(prefix) &&
        !entry.name.startsWith("public-image-proof-pack-audit-") &&
        !entry.name.startsWith("public-image-deposit-files-audit-"),
    )
    .map((entry) => path.join(dirPath, entry.name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] ?? null;
}

function latestFileUnder(dirPath, prefix) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return null;
  }

  return fs
    .readdirSync(dirPath)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((name) => path.join(dirPath, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] ?? null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function abs(relativePath) {
  return path.join(root, String(relativePath ?? "").replace(/\//g, path.sep));
}

function isTargetPublicPath(value) {
  return /^\/uploads\/partner-products\/[^?#]+\.webp$/i.test(String(value ?? ""));
}

function isTargetLocalPath(value) {
  const normalized = String(value ?? "").replace(/\\/g, "/");
  return /^public\/uploads\/partner-products\/[^?#]+\.webp$/i.test(normalized);
}

function isInsideProofRoot(value) {
  const normalized = String(value ?? "").replace(/\\/g, "/");
  return normalized.startsWith("business-maxi-trouvailles/preuves-images-publiques/");
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

function checklistComplete(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const source = fs.readFileSync(filePath, "utf8");
  const boxes = [...source.matchAll(/- \[( |x|X)\]/g)].map((match) => match[1]);

  return boxes.length > 0 && boxes.every((value) => value.toLowerCase() === "x");
}

function readChecklist(filePath) {
  if (!fs.existsSync(filePath)) {
    return "";
  }

  return fs.readFileSync(filePath, "utf8");
}

function checklistEvidenceStatus(filePath) {
  const source = readChecklist(filePath);
  if (!source) {
    return {
      ready: false,
      missingFields: requiredChecklistEvidenceFields,
      invalidFields: [],
    };
  }

  const missingFields = [];
  const invalidFields = [];

  for (const field of requiredChecklistEvidenceFields) {
    const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = source.match(new RegExp(`^-\\s*${escapedField}:\\s*(.+)$`, "im"));
    const value = match?.[1]?.trim() ?? "";

    if (!match) {
      missingFields.push(field);
      continue;
    }

    if (placeholderPattern.test(value)) {
      invalidFields.push(field);
    }
  }

  const decisionMatch = source.match(/^- *Decision copie publique: *(.*)$/im);
  const decisionValue = decisionMatch?.[1]?.trim() ?? "";
  if (decisionMatch && !/^READY_COPY_AFTER_MOUSS$/i.test(decisionValue)) {
    invalidFields.push("Decision copie publique");
  }

  return {
    ready: missingFields.length === 0 && invalidFields.length === 0,
    missingFields,
    invalidFields: [...new Set(invalidFields)],
  };
}

function listDropFiles(dropFolder) {
  if (!fs.existsSync(dropFolder)) {
    return [];
  }

  return fs
    .readdirSync(dropFolder, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(dropFolder, entry.name));
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  const headers = [
    "status",
    "name",
    "slug",
    "expectedFileName",
    "dropFolder",
    "expectedFilePath",
    "expectedExists",
    "webpHeaderOk",
    "fileSizeBytes",
    "checklistComplete",
    "checklistEvidenceReady",
    "checklistMissingFields",
    "checklistInvalidFields",
    "readyForHumanReview",
    "readyForCopyAfterMouss",
    "blockers",
  ];

  return `${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
    .join("\n")}\n`;
}

function markdown(summary) {
  const rows = summary.items.map(
    (item) =>
      `| ${item.status} | ${item.name} | ${item.expectedFileName} | ${item.fileSizeBytes} | ${item.blockers.join(", ")} |`,
  );

  return `${[
    "# Audit depot manuel WebP images publiques",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Pack source: ${summary.sourcePack}`,
    "",
    "## Synthese",
    "",
    `- Statut technique: ${summary.ok ? "OK" : "ECHEC"}`,
    `- Produits controles: ${summary.itemCount}`,
    `- WebP attendus manquants: ${summary.missingExpectedCount}`,
    `- WebP valides deposes: ${summary.validExpectedCount}`,
    `- Fichiers invalides/en trop: ${summary.invalidDropFileCount}`,
    `- Checklists avec preuves texte completes: ${summary.checklistEvidenceReadyCount}`,
    `- Prets pour revue humaine: ${summary.readyForHumanReviewCount}`,
    `- Prets pour copie apres Mouss: ${summary.readyForCopyAfterMoussCount}`,
    "",
    "| Statut | Produit | WebP attendu | Octets | Blocages |",
    "|---|---|---|---:|---|",
    ...rows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule.",
    "- Aucune creation image.",
    "- Aucune copie dans `public/uploads`.",
    "- Aucune publication.",
    "- Aucun paiement.",
    "- Aucune commande partenaire.",
    "",
  ].join("\n")}\n`;
}

function assertCondition(condition, code, message, details = {}) {
  if (!condition) {
    return { code, message, details };
  }
  return null;
}

const packDir = latestDirectoryUnder(actionRoot, packPrefix);
const packJsonPath = latestFileUnder(packDir, "PACK_PREUVES_IMAGES_PUBLIQUES_");
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `public-image-deposit-files-audit-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const failures = [];
let items = [];

if (!packDir || !packJsonPath) {
  failures.push({
    code: "pack_missing",
    message: "Aucun pack preuves images publiques n'a ete trouve.",
    details: {},
  });
} else {
  const pack = readJson(packJsonPath);
  const packItems = Array.isArray(pack.items) ? pack.items : [];

  items = packItems.map((item, index) => {
    const dropFolderPath = abs(item.dropFolder);
    const checklistPath = abs(item.checklistPath);
    const expectedFilePath = path.join(dropFolderPath, item.expectedFileName);
    const expectedExists = fs.existsSync(expectedFilePath);
    const expectedStat = expectedExists ? fs.statSync(expectedFilePath) : null;
    const webpHeaderOk = expectedExists ? isWebpFile(expectedFilePath) : false;
    const dropFiles = listDropFiles(dropFolderPath);
    const unexpectedFiles = dropFiles.filter((filePath) => {
      const name = path.basename(filePath);
      if (ignoredDropFilePattern.test(name)) {
        return false;
      }
      return name !== item.expectedFileName;
    });
    const invalidDropFiles = unexpectedFiles.filter((filePath) =>
      imageLikeExtensions.has(path.extname(filePath).toLowerCase()),
    );
    const blockers = [
      !isTargetPublicPath(item.targetPublicPath) ? "target_public_path_invalid" : null,
      !isTargetLocalPath(item.targetLocalPath) ? "target_local_path_invalid" : null,
      !isInsideProofRoot(item.dropFolder) ? "drop_folder_outside_proof_root" : null,
      !fs.existsSync(dropFolderPath) ? "drop_folder_missing" : null,
      !expectedExists ? "expected_webp_missing" : null,
      expectedExists && !webpHeaderOk ? "expected_file_not_valid_webp" : null,
      invalidDropFiles.length > 0 ? "unexpected_image_files_in_drop_folder" : null,
      expectedExists && expectedStat?.size < 2048 ? "expected_webp_too_small_to_trust" : null,
      leakPattern.test(JSON.stringify(item)) ? "sensitive_marker_in_manifest_item" : null,
    ].filter(Boolean);
    const completeChecklist = checklistComplete(checklistPath);
    const checklistEvidence = checklistEvidenceStatus(checklistPath);
    const readyForHumanReview =
      expectedExists &&
      webpHeaderOk &&
      invalidDropFiles.length === 0 &&
      isTargetPublicPath(item.targetPublicPath) &&
      isTargetLocalPath(item.targetLocalPath);
    const readyForCopyAfterMouss = readyForHumanReview && completeChecklist && checklistEvidence.ready;
    const finalBlockers = [
      ...blockers,
      expectedExists && !completeChecklist ? "checklist_not_complete" : null,
      expectedExists && !checklistEvidence.ready ? "checklist_evidence_fields_incomplete" : null,
    ].filter(Boolean);

    failures.push(
      assertCondition(
        isInsideProofRoot(item.dropFolder),
        "drop_folder_outside_proof_root",
        "Un dossier de depot sort de la racine preuves images.",
        { index, slug: item.slug, dropFolder: item.dropFolder },
      ),
      assertCondition(
        isTargetPublicPath(item.targetPublicPath),
        "target_public_path_invalid",
        "Une cible publique ne reste pas dans /uploads/partner-products.",
        { index, slug: item.slug, targetPublicPath: item.targetPublicPath },
      ),
      assertCondition(
        isTargetLocalPath(item.targetLocalPath),
        "target_local_path_invalid",
        "Une cible locale ne reste pas dans public/uploads/partner-products.",
        { index, slug: item.slug, targetLocalPath: item.targetLocalPath },
      ),
      assertCondition(
        invalidDropFiles.length === 0,
        "unexpected_image_files_in_drop_folder",
        "Un dossier de depot contient une image au mauvais nom ou format.",
        { index, slug: item.slug, files: invalidDropFiles.map(rel) },
      ),
      assertCondition(
        !expectedExists || webpHeaderOk,
        "expected_file_not_valid_webp",
        "Le fichier attendu existe mais n'a pas une signature WebP valide.",
        { index, slug: item.slug, expectedFilePath: rel(expectedFilePath) },
      ),
      assertCondition(
        !expectedExists || expectedStat.size >= 2048,
        "expected_webp_too_small_to_trust",
        "Le WebP attendu existe mais sa taille est trop faible pour etre fiable.",
        { index, slug: item.slug, size: expectedStat?.size ?? 0 },
      ),
      assertCondition(
        !leakPattern.test(JSON.stringify(item)),
        "sensitive_marker_in_manifest_item",
        "Une entree de manifeste contient un marqueur externe sensible.",
        { index, slug: item.slug },
      ),
    );

    return {
      status: readyForCopyAfterMouss
        ? "READY_COPY_AFTER_MOUSS"
        : readyForHumanReview
          ? "READY_HUMAN_REVIEW"
          : expectedExists
            ? "HOLD_FIX_DEPOSIT"
            : "HOLD_MISSING_WEBP",
      name: item.name,
      slug: item.slug,
      expectedFileName: item.expectedFileName,
      dropFolder: item.dropFolder,
      expectedFilePath: rel(expectedFilePath),
      expectedExists,
      webpHeaderOk,
      fileSizeBytes: expectedStat?.size ?? 0,
      checklistComplete: completeChecklist,
      checklistEvidenceReady: checklistEvidence.ready,
      checklistMissingFields: checklistEvidence.missingFields,
      checklistInvalidFields: checklistEvidence.invalidFields,
      readyForHumanReview,
      readyForCopyAfterMouss,
      blockers: finalBlockers,
    };
  });
}

const cleanFailures = failures.filter(Boolean);
const summary = {
  ok: cleanFailures.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_public_image_deposit_files_audit",
  sourcePack: packJsonPath ? rel(packJsonPath) : null,
  itemCount: items.length,
  missingExpectedCount: items.filter((item) => !item.expectedExists).length,
  validExpectedCount: items.filter((item) => item.expectedExists && item.webpHeaderOk).length,
  invalidDropFileCount: items.filter((item) =>
    item.blockers.some((blocker) =>
      [
        "unexpected_image_files_in_drop_folder",
        "expected_file_not_valid_webp",
        "expected_webp_too_small_to_trust",
      ].includes(blocker),
    ),
  ).length,
  checklistEvidenceReadyCount: items.filter((item) => item.checklistEvidenceReady).length,
  readyForHumanReviewCount: items.filter((item) => item.readyForHumanReview).length,
  readyForCopyAfterMoussCount: items.filter((item) => item.readyForCopyAfterMouss).length,
  items,
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
  },
};

const jsonPath = path.join(outputDir, `AUDIT_DEPOT_WEBP_IMAGES_PUBLIQUES_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_DEPOT_WEBP_IMAGES_PUBLIQUES_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-audit-depot-webp-images-publiques-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, toCsv(items), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      itemCount: summary.itemCount,
      missingExpectedCount: summary.missingExpectedCount,
      validExpectedCount: summary.validExpectedCount,
      invalidDropFileCount: summary.invalidDropFileCount,
      checklistEvidenceReadyCount: summary.checklistEvidenceReadyCount,
      readyForHumanReviewCount: summary.readyForHumanReviewCount,
      readyForCopyAfterMoussCount: summary.readyForCopyAfterMoussCount,
      failureCount: summary.failures.length,
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

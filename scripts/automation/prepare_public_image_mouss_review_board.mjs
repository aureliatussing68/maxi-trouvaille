import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const requiredEvidenceFields = [
  "Source image exacte",
  "Droits image",
  "Meme article exact confirme",
  "Variante exacte confirmee",
  "Validation Mouss",
  "Decision copie publique",
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

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  const headers = [
    "rank",
    "status",
    "name",
    "slug",
    "expectedFileName",
    "webpStatus",
    "checklistStatus",
    "evidenceStatus",
    "fieldsToFill",
    "dropFolder",
    "checklistPath",
    "targetPublicPath",
    "nextAction",
  ];

  return `${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
    .join("\n")}\n`;
}

function statusFor(depositItem) {
  if (depositItem?.readyForCopyAfterMouss) {
    return "READY_REVIEW_MOUSS_HOLD";
  }

  if (depositItem?.readyForHumanReview) {
    return "WEBP_PRESENT_PREUVES_A_COMPLETER";
  }

  return "HOLD_A_COMPLETER";
}

function webpStatusFor(depositItem) {
  if (!depositItem?.expectedExists) {
    return "WEBP_MANQUANT";
  }

  if (!depositItem.webpHeaderOk) {
    return "WEBP_INVALIDE";
  }

  return "WEBP_VALIDE";
}

function checklistStatusFor(depositItem) {
  return depositItem?.checklistComplete ? "CASES_COCHEES" : "CASES_A_COMPLETER";
}

function evidenceStatusFor(depositItem) {
  return depositItem?.checklistEvidenceReady ? "PREUVES_TEXTE_OK" : "PREUVES_TEXTE_A_REMPLIR";
}

function fieldsToFillFor(depositItem) {
  const missingFields = Array.isArray(depositItem?.checklistMissingFields)
    ? depositItem.checklistMissingFields
    : requiredEvidenceFields;
  const invalidFields = Array.isArray(depositItem?.checklistInvalidFields)
    ? depositItem.checklistInvalidFields
    : requiredEvidenceFields;
  const fields = [...new Set([...missingFields, ...invalidFields])];

  return fields.length > 0 ? fields : [];
}

function nextActionFor(item) {
  if (item.webpStatus === "WEBP_MANQUANT") {
    return `Deposer le WebP exact ${item.expectedFileName}, puis relancer les audits image.`;
  }

  if (item.webpStatus === "WEBP_INVALIDE") {
    return "Remplacer le fichier par un WebP valide au nom attendu.";
  }

  if (item.checklistStatus !== "CASES_COCHEES") {
    return "Cocher la checklist seulement apres verification meme article, variante et droits.";
  }

  if (item.fieldsToFill.length > 0) {
    return `Remplir les preuves texte: ${item.fieldsToFill.join(", ")}.`;
  }

  return "Faire revue Mouss finale avant toute copie publique manuelle.";
}

function markdown(summary) {
  const rows = summary.items.map(
    (item) =>
      `| ${item.rank} | ${item.status} | ${item.name} | ${item.expectedFileName} | ${item.webpStatus} | ${item.evidenceStatus} | ${item.fieldsToFill.join(", ")} |`,
  );
  const details = summary.items.flatMap((item) => [
    `### ${item.rank}. ${item.name}`,
    "",
    `- Statut: ${item.status}`,
    `- WebP attendu: \`${item.expectedFileName}\``,
    `- Dossier depot: \`${item.dropFolder}\``,
    `- Checklist: \`${item.checklistPath}\``,
    `- Champs a remplir: ${item.fieldsToFill.length > 0 ? item.fieldsToFill.join(", ") : "aucun"}`,
    `- Action: ${item.nextAction}`,
    "",
  ]);

  return `${[
    "# Board Mouss - images publiques exactes",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Pack source: ${summary.sourceProofPack}`,
    `Audit depot source: ${summary.sourceDepositAudit}`,
    "",
    "## Synthese",
    "",
    `- Statut technique: ${summary.ok ? "OK" : "ECHEC"}`,
    `- Produits controles: ${summary.itemCount}`,
    `- WebP a deposer: ${summary.webpMissingCount}`,
    `- Preuves texte a remplir: ${summary.evidenceTodoCount}`,
    `- Candidats copie publique: ${summary.readyReviewCount}`,
    "",
    "| Rang | Statut | Produit | WebP attendu | WebP | Preuves texte | Champs a remplir |",
    "|---:|---|---|---|---|---|---|",
    ...rows,
    "",
    "## Actions",
    "",
    ...details,
    "## Garde-fous",
    "",
    "- Valeurs source/fournisseur non exportees.",
    "- Aucun telechargement image.",
    "- Aucune creation image.",
    "- Aucune copie dans `public/uploads`.",
    "- Aucune modification catalogue.",
    "- Aucune publication.",
    "- Aucun paiement.",
    "- Aucune commande partenaire.",
    "",
  ].join("\n")}\n`;
}

const proofPackDir = latestDirectoryUnder(actionRoot, "public-image-proof-pack-", "public-image-proof-pack-audit-");
const depositAuditDir = latestDirectoryUnder(actionRoot, "public-image-deposit-files-audit-");
const proofPackPath = latestFileUnder(proofPackDir, "PACK_PREUVES_IMAGES_PUBLIQUES_");
const depositAuditPath = latestFileUnder(depositAuditDir, "AUDIT_DEPOT_WEBP_IMAGES_PUBLIQUES_");

if (!proofPackPath) {
  throw new Error("Pack preuves images publiques introuvable.");
}

if (!depositAuditPath) {
  throw new Error("Audit depot WebP images publiques introuvable.");
}

const proofPack = readJson(proofPackPath);
const depositAudit = readJson(depositAuditPath);
const depositBySlug = new Map((Array.isArray(depositAudit.items) ? depositAudit.items : []).map((item) => [item.slug, item]));
const proofItems = Array.isArray(proofPack.items) ? proofPack.items : [];
const items = proofItems.map((item, index) => {
  const depositItem = depositBySlug.get(item.slug);
  const row = {
    rank: index + 1,
    name: item.name,
    slug: item.slug,
    expectedFileName: item.expectedFileName,
    dropFolder: item.dropFolder,
    checklistPath: item.checklistPath,
    targetPublicPath: item.targetPublicPath,
    status: statusFor(depositItem),
    webpStatus: webpStatusFor(depositItem),
    checklistStatus: checklistStatusFor(depositItem),
    evidenceStatus: evidenceStatusFor(depositItem),
    fieldsToFill: fieldsToFillFor(depositItem),
    blockers: Array.isArray(depositItem?.blockers) ? depositItem.blockers : ["deposit_audit_missing"],
  };

  return {
    ...row,
    nextAction: nextActionFor(row),
  };
});

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `public-image-mouss-review-board-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "manual_public_image_mouss_review_board",
  sourceProofPack: rel(proofPackPath),
  sourceDepositAudit: rel(depositAuditPath),
  itemCount: items.length,
  webpMissingCount: items.filter((item) => item.webpStatus === "WEBP_MANQUANT").length,
  evidenceTodoCount: items.filter((item) => item.evidenceStatus !== "PREUVES_TEXTE_OK").length,
  readyReviewCount: items.filter((item) => item.status === "READY_REVIEW_MOUSS_HOLD").length,
  sensitiveValuesExported: false,
  items,
  safety: {
    readOnlyInputs: true,
    noCatalogWrite: true,
    noImageDownload: true,
    noImageFileCreated: true,
    noPublicImageWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noMessageSent: true,
    requiresMoussValidation: true,
    noSensitiveValuesExported: true,
  },
};

const jsonPath = path.join(outputDir, `BOARD_MOUSS_IMAGES_PUBLIQUES_${dateKey}.json`);
const mdPath = path.join(outputDir, `BOARD_MOUSS_IMAGES_PUBLIQUES_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-board-mouss-images-publiques-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, toCsv(items), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      itemCount: summary.itemCount,
      webpMissingCount: summary.webpMissingCount,
      evidenceTodoCount: summary.evidenceTodoCount,
      readyReviewCount: summary.readyReviewCount,
      sensitiveValuesExported: summary.sensitiveValuesExported,
      files: { jsonPath, mdPath, csvPath },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

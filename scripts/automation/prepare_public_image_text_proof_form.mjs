import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const requiredSafetyFlags = {
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
};

const fieldGuides = {
  "Source image exacte": {
    fieldKey: "source_image_exacte",
    expectedFormat: "origine interne redigee ou reference fournisseur gardee hors artefact client",
    rejectIf: "image similaire, recherche generique, URL client, marketplace visible",
  },
  "Droits image": {
    fieldKey: "droits_image",
    expectedFormat: "permission fournisseur, photo propre Maxi Trouvaille ou licence utilisable",
    rejectIf: "droits inconnus, logo plateforme, watermark, image non autorisee",
  },
  "Meme article exact confirme": {
    fieldKey: "meme_article_exact_confirme",
    expectedFormat: "oui avec comparaison nom, forme, fonction, accessoires et lot vendu",
    rejectIf: "produit proche, kit different, accessoire en plus, marque trompeuse",
  },
  "Variante exacte confirmee": {
    fieldKey: "variante_exacte_confirmee",
    expectedFormat: "couleur, taille, capacite, connectique et quantite identiques a la fiche",
    rejectIf: "variante non prouvee, couleur differente, pack affiche mais unite vendue",
  },
  "Validation Mouss": {
    fieldKey: "validation_mouss",
    expectedFormat: "validation humaine explicite avec date ou mention revue faite",
    rejectIf: "auto-validation, champ vide, doute image, avis non humain",
  },
  "Decision copie publique": {
    fieldKey: "decision_copie_publique",
    expectedFormat: "HOLD ou READY_COPY_AFTER_MOUSS seulement apres preuves completes",
    rejectIf: "READY sans WebP exact, droits, meme article, variante et validation Mouss",
  },
};

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

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function formRowsForItem(item) {
  const fields = Array.isArray(item.fieldsToFill) && item.fieldsToFill.length > 0 ? item.fieldsToFill : Object.keys(fieldGuides);

  return fields.map((fieldLabel, index) => {
    const guide = fieldGuides[fieldLabel] ?? {
      fieldKey: fieldLabel
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, ""),
      expectedFormat: "preuve manuelle lisible",
      rejectIf: "champ vide ou preuve approximative",
    };

    return {
      rank: item.rank,
      lineRank: `${item.rank}.${index + 1}`,
      productName: item.name,
      slug: item.slug,
      fieldKey: guide.fieldKey,
      fieldLabel,
      expectedFormat: guide.expectedFormat,
      rejectIf: guide.rejectIf,
      valueToFill: "A_REMPLIR_DANS_CHECKLIST",
      expectedFileName: item.expectedFileName,
      webpStatus: item.webpStatus,
      checklistStatus: item.checklistStatus,
      evidenceStatus: item.evidenceStatus,
      checklistPath: item.checklistPath,
      dropFolder: item.dropFolder,
      targetPublicPath: item.targetPublicPath,
      nextAction: `Remplir le champ "${fieldLabel}" dans la checklist, garder HOLD, puis relancer les audits image.`,
    };
  });
}

function toCsv(rows) {
  const headers = [
    "lineRank",
    "productName",
    "slug",
    "fieldKey",
    "fieldLabel",
    "valueToFill",
    "expectedFormat",
    "rejectIf",
    "expectedFileName",
    "webpStatus",
    "checklistStatus",
    "evidenceStatus",
    "checklistPath",
    "dropFolder",
    "targetPublicPath",
    "nextAction",
  ];

  return `${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
    .join("\n")}\n`;
}

function markdown(summary) {
  const rows = summary.rows.map(
    (row) =>
      `| ${mdCell(row.lineRank)} | ${mdCell(row.productName)} | ${mdCell(row.fieldLabel)} | ${mdCell(row.valueToFill)} | ${mdCell(row.expectedFormat)} |`,
  );
  const byProduct = summary.items.flatMap((item) => [
    `### ${item.rank}. ${item.name}`,
    "",
    `- Statut: ${item.status}`,
    `- WebP attendu: \`${item.expectedFileName}\` (${item.webpStatus})`,
    `- Checklist: \`${item.checklistPath}\``,
    `- Dossier depot: \`${item.dropFolder}\``,
    `- Champs a remplir: ${item.fieldsToFill.length > 0 ? item.fieldsToFill.join(", ") : "aucun"}`,
    "",
  ]);

  return `${[
    "# Formulaire preuves texte - images publiques exactes",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Board source: ${summary.sourceBoard}`,
    "",
    "## Synthese",
    "",
    `- Produits controles: ${summary.itemCount}`,
    `- Lignes a remplir: ${summary.rowCount}`,
    `- WebP manquants: ${summary.webpMissingCount}`,
    `- Preuves texte a remplir: ${summary.evidenceTodoCount}`,
    `- Valeurs sensibles exportees: ${summary.sensitiveValuesExported ? "oui" : "non"}`,
    "",
    "| Ligne | Produit | Champ | Valeur | Format attendu |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    "## Produits",
    "",
    ...byProduct,
    "## Garde-fous",
    "",
    "- Formulaire interne de remplissage manuel uniquement.",
    "- Valeurs source/fournisseur non exportees.",
    "- Aucune copie dans `public/uploads`.",
    "- Aucune modification catalogue.",
    "- Aucune publication.",
    "- Aucun paiement.",
    "- Aucune commande partenaire.",
    "",
  ].join("\n")}\n`;
}

const boardDir = latestDirectoryUnder(
  actionRoot,
  "public-image-mouss-review-board-",
  "public-image-mouss-review-board-audit-",
);
const boardPath = latestFileUnder(boardDir, "BOARD_MOUSS_IMAGES_PUBLIQUES_");

if (!boardPath) {
  throw new Error("Board Mouss images publiques introuvable.");
}

const board = readJson(boardPath);
const items = Array.isArray(board.items) ? board.items : [];
const rows = items.flatMap(formRowsForItem);
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `public-image-text-proof-form-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "manual_public_image_text_proof_form",
  sourceBoard: rel(boardPath),
  itemCount: items.length,
  rowCount: rows.length,
  webpMissingCount: board.webpMissingCount ?? items.filter((item) => item.webpStatus === "WEBP_MANQUANT").length,
  evidenceTodoCount: board.evidenceTodoCount ?? items.filter((item) => item.evidenceStatus !== "PREUVES_TEXTE_OK").length,
  sensitiveValuesExported: false,
  items: items.map((item) => ({
    rank: item.rank,
    name: item.name,
    slug: item.slug,
    status: item.status,
    expectedFileName: item.expectedFileName,
    webpStatus: item.webpStatus,
    checklistStatus: item.checklistStatus,
    evidenceStatus: item.evidenceStatus,
    fieldsToFill: item.fieldsToFill ?? [],
    checklistPath: item.checklistPath,
    dropFolder: item.dropFolder,
    targetPublicPath: item.targetPublicPath,
  })),
  rows,
  safety: requiredSafetyFlags,
};

const jsonPath = path.join(outputDir, `FORMULAIRE_PREUVES_TEXTE_IMAGES_PUBLIQUES_${dateKey}.json`);
const mdPath = path.join(outputDir, `FORMULAIRE_PREUVES_TEXTE_IMAGES_PUBLIQUES_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-formulaire-preuves-texte-images-publiques-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, toCsv(rows), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      itemCount: summary.itemCount,
      rowCount: summary.rowCount,
      webpMissingCount: summary.webpMissingCount,
      evidenceTodoCount: summary.evidenceTodoCount,
      sensitiveValuesExported: summary.sensitiveValuesExported,
      files: { jsonPath, mdPath, csvPath },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

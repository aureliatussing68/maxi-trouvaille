import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");

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

function collectFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, predicate, out);
    } else if (predicate(entry.name, fullPath)) {
      out.push(fullPath);
    }
  }
  return out;
}

function latestFileUnder(dir, prefix) {
  const todayKey = datePartsParis().dateKey;
  const matches = collectFiles(dir, (name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return matches.find((match) => match.fullPath.includes(todayKey))?.fullPath ?? matches[0]?.fullPath ?? null;
}

function readJson(filePath, fallback = null) {
  if (!filePath || !fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relativePath(filePath) {
  return filePath ? path.relative(root, filePath) : "";
}

function resolveProjectPath(value) {
  if (!value) return "";
  return path.isAbsolute(value) ? value : path.join(root, value);
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function csvEscape(value) {
  const normalized = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${normalized.replace(/"/g, '""')}"`;
}

function csv(rows, headers) {
  return `${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
    .join("\n")}\n`;
}

function imageExpectedFileName(image) {
  if (image.expectedFileName) return image.expectedFileName;
  const sourcePath = image.stagingRelativePath || image.targetPublicUrl || image.targetAbsolutePath || "";
  return sourcePath ? path.basename(sourcePath) : "";
}

function imagePath(image) {
  return image.stagingRelativePath || image.targetPublicUrl || image.targetAbsolutePath || "";
}

function requiredShot(image) {
  if (image.requiredShot) return image.requiredShot;
  const role = String(image.role ?? "").toLowerCase();
  if (role === "main") {
    return "photo produit entier, variante vendue seule, angle clair, sans accessoire non inclus";
  }
  if (role === "detail") {
    return "detail matiere, finition, attaches, fermeture ou zone fonctionnelle du produit";
  }
  if (role === "usage") {
    return "mise en situation realiste sans laisser croire que les accessoires de contexte sont inclus";
  }
  if (role === "dimensions") {
    return "dimensions lisibles ou preuve separee des mesures exactes";
  }
  if (role.startsWith("detail")) {
    return "detail complementaire exact du produit ou de la variante vendue";
  }
  return "photo exacte de la variante vendue, propre, nette et sans logo trompeur";
}

function markdown(summary) {
  const productRows = summary.products.map(
    (product) =>
      `| ${product.rank} | ${mdCell(product.name)} | ${mdCell(product.status)} | ${product.evidenceMissingCount} | ${product.imageTaskCount} | ${mdCell(product.nextAction)} |`,
  );
  const urgentEvidenceRows = summary.evidenceRows.slice(0, 18).map(
    (row) =>
      `| ${row.productRank} | ${mdCell(row.productName)} | ${mdCell(row.label)} | ${mdCell(row.answer)} | ${mdCell(row.instruction)} |`,
  );
  const imageRows = summary.imageRows.map(
    (row) =>
      `| ${row.productRank} | ${mdCell(row.productName)} | ${row.order} | ${mdCell(row.role)} | ${mdCell(row.expectedFileName)} | ${mdCell(row.requiredShot)} |`,
  );

  return `${[
    "# Maxi Trouvailles - Kit terrain validation produits",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Mode: ${summary.mode}`,
    "",
    "## Objectif",
    "",
    "Remplir les preuves et preparer les images exactes des produits dropshipping prioritaires, sans publier ni commander.",
    "",
    "## Synthese",
    "",
    `- Produits a traiter: ${summary.productCount}`,
    `- Preuves a remplir: ${summary.evidenceRowCount}`,
    `- Images exactes a deposer: ${summary.imageRowCount}`,
    `- Produits prets revue humaine: ${summary.readyReviewCount}`,
    "- Publication: aucune",
    "- Paiement/commande fournisseur: aucun",
    "",
    "## Ordre de travail",
    "",
    "| Rang | Produit | Statut | Preuves | Images | Prochaine action |",
    "|---:|---|---|---:|---:|---|",
    ...productRows,
    "",
    "## Preuves a remplir en premier",
    "",
    "| Produit | Nom | Champ | Reponse | Consigne |",
    "|---:|---|---|---|---|",
    ...urgentEvidenceRows,
    "",
    "## Images exactes a produire/deposer",
    "",
    "| Produit | Nom | Ordre | Role | Fichier attendu | Photo attendue |",
    "|---:|---|---:|---|---|---|",
    ...imageRows,
    "",
    "## Regles",
    "",
    "- La photo doit representer exactement la variante vendue.",
    "- Si le droit image ou la variante n'est pas prouve, garder HOLD.",
    "- Ne pas utiliser d'image generee pour la galerie produit exacte.",
    "- Ne rien copier dans `public/uploads` avant validation Mouss.",
    "- Ne jamais afficher le fournisseur au client.",
    "",
    "## Fichiers generes",
    "",
    ...Object.entries(summary.files).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Sources",
    "",
    `- Batch cockpits: ${summary.sources.batchPath}`,
    "",
  ].join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const batchPath = latestFileUnder(actionRoot, "COCKPITS_VALIDATION_PRODUITS_BATCH_");
const batch = readJson(batchPath, {});
const batchProducts = Array.isArray(batch.products) ? batch.products : [];

if (!batchProducts.length) {
  throw new Error("No cockpit batch available for field kit.");
}

const products = [];
const evidenceRows = [];
const imageRows = [];

for (const batchProduct of batchProducts) {
  const cockpitPath = resolveProjectPath(batchProduct.files?.jsonPath);
  const cockpit = readJson(cockpitPath, {});
  const supplier = cockpit.supplierForInternalValidation ?? {};
  const evidenceFields = Array.isArray(cockpit.evidenceFields) ? cockpit.evidenceFields : [];
  const images = Array.isArray(cockpit.imageTasks) ? cockpit.imageTasks : [];
  const rank = batchProduct.rank ?? products.length + 1;

  products.push({
    rank,
    id: cockpit.product?.id ?? batchProduct.id,
    name: cockpit.product?.name ?? batchProduct.name,
    categoryId: cockpit.product?.categoryId ?? "",
    status: cockpit.status ?? batchProduct.status,
    evidenceMissingCount: evidenceFields.filter((field) => !field.ok).length,
    imageTaskCount: images.length,
    blockerCount: cockpit.blockers?.length ?? batchProduct.blockerCount ?? 0,
    supplierSku: supplier.sku ?? "",
    supplierPrice: supplier.supplierPrice ?? "",
    supplierStock: supplier.stock ?? "",
    nextAction: "remplir preuves, verifier variante/prix/delai, deposer WebP exacts",
    cockpitPath: relativePath(cockpitPath),
    fillPath: batchProduct.files?.fillPath ?? "",
  });

  for (const field of evidenceFields) {
    evidenceRows.push({
      productRank: rank,
      productId: cockpit.product?.id ?? batchProduct.id,
      productName: cockpit.product?.name ?? batchProduct.name,
      categoryId: cockpit.product?.categoryId ?? "",
      fieldKey: field.key,
      label: field.label,
      instruction: field.instruction,
      currentValue: field.value || field.currentValue || "",
      answer: "",
      status: field.ok ? "OK" : "A_REMPLIR",
      cockpitPath: relativePath(cockpitPath),
      fillPath: batchProduct.files?.fillPath ?? "",
    });
  }

  for (const image of images) {
    imageRows.push({
      productRank: rank,
      productId: cockpit.product?.id ?? batchProduct.id,
      productName: cockpit.product?.name ?? batchProduct.name,
      order: image.order ?? image.imageIndex ?? "",
      role: image.role ?? "",
      expectedFileName: imageExpectedFileName(image),
      requiredShot: requiredShot(image),
      targetPath: imagePath(image),
      proof: "",
      status: image.status ?? image.stagingStatus ?? "missing",
      cockpitPath: relativePath(cockpitPath),
    });
  }
}

const outputDir = path.join(actionRoot, `kit-terrain-validation-produits-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_product_validation_field_kit",
  productCount: products.length,
  evidenceRowCount: evidenceRows.length,
  imageRowCount: imageRows.length,
  readyReviewCount: products.filter((product) => product.status === "READY_REVIEW_HOLD").length,
  products,
  evidenceRows,
  imageRows,
  files: {},
  outputDirRelative: relativePath(outputDir),
  sources: {
    batchPath: relativePath(batchPath),
  },
  safety: {
    readOnly: true,
    noCatalogWrite: true,
    noPublicUploadsWrite: true,
    noImageDownload: true,
    noImageGeneration: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noMessageSent: true,
    manualValidationRequired: true,
  },
};

const jsonPath = path.join(outputDir, `KIT_TERRAIN_VALIDATION_PRODUITS_${dateKey}.json`);
const mdPath = path.join(outputDir, `KIT_TERRAIN_VALIDATION_PRODUITS_${dateKey}.md`);
const evidenceCsvPath = path.join(outputDir, `PREUVES_A_REMPLIR_${dateKey}.csv`);
const imagesCsvPath = path.join(outputDir, `IMAGES_A_DEPOSER_${dateKey}.csv`);
const fillAllPath = path.join(outputDir, `A_REMPLIR_TOUTES_PREUVES_IMAGES_${dateKey}.json`);

summary.files = {
  json: relativePath(jsonPath),
  md: relativePath(mdPath),
  evidenceCsv: relativePath(evidenceCsvPath),
  imagesCsv: relativePath(imagesCsvPath),
  fillAllJson: relativePath(fillAllPath),
};

const fillAll = {
  generatedAt: summary.generatedAt,
  generatedAtLocal: summary.generatedAtLocal,
  status: "HOLD",
  finalDecision: "HOLD",
  products: products.map((product) => ({
    productId: product.id,
    productName: product.name,
    status: "HOLD",
    evidence: Object.fromEntries(
      evidenceRows
        .filter((row) => row.productId === product.id)
        .map((row) => [row.fieldKey, row.currentValue || ""]),
    ),
    images: imageRows
      .filter((row) => row.productId === product.id)
      .map((row) => ({
        role: row.role,
        expectedFileName: row.expectedFileName,
        targetPath: row.targetPath,
        proof: "",
      })),
  })),
  notes: [
    "Remplir uniquement avec preuves visibles.",
    "Garder HOLD tant que Mouss n'a pas valide.",
    "Ne pas publier, ne pas payer, ne pas commander fournisseur.",
  ],
};

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(
  evidenceCsvPath,
  csv(evidenceRows, [
    "productRank",
    "productId",
    "productName",
    "fieldKey",
    "label",
    "instruction",
    "currentValue",
    "answer",
    "status",
    "fillPath",
  ]),
  "utf8",
);
fs.writeFileSync(
  imagesCsvPath,
  csv(imageRows, [
    "productRank",
    "productId",
    "productName",
    "order",
    "role",
    "expectedFileName",
    "requiredShot",
    "targetPath",
    "proof",
    "status",
  ]),
  "utf8",
);
fs.writeFileSync(fillAllPath, `${JSON.stringify(fillAll, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      productCount: summary.productCount,
      evidenceRowCount: summary.evidenceRowCount,
      imageRowCount: summary.imageRowCount,
      files: summary.files,
      safety: summary.safety,
    },
    null,
    2,
  ),
);

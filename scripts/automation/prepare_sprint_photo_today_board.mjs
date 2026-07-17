import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessDir = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessDir, "tableaux-action");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

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

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);
}

function collectFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }

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

function latestFile(prefix, label) {
  const matches = collectFiles(
    actionRoot,
    (name) => name.startsWith(prefix) && name.endsWith(".json"),
  )
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (matches.length === 0) {
    throw new Error(`No ${label} found under ${actionRoot}`);
  }

  return matches[0].fullPath;
}

function csvEscape(value) {
  const normalized = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${normalized.replace(/"/g, '""')}"`;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function priorityScore(image) {
  const role = normalizeText(image.role);
  if (role === "main") return 1;
  if (role === "detail") return 2;
  if (role === "usage") return 3;
  if (role === "dimensions") return 4;
  return 9;
}

function buildProductTask(product, humanGateProduct) {
  const sortedImages = [...product.images].sort((a, b) => priorityScore(a) - priorityScore(b) || a.index - b.index);
  const imageTasks = sortedImages.map((image, index) => ({
    order: index + 1,
    productId: product.productId,
    productName: product.productName,
    role: image.role,
    targetPublicUrl: image.targetPublicUrl,
    targetAbsolutePath: image.targetAbsolutePath,
    requiredShot: image.requiredShot,
    currentGateStatus: humanGateProduct?.status ?? "UNKNOWN",
    outputMustBe: [
      "fichier WebP local au chemin cible",
      "photo du produit exact ou droits fournisseur documentes",
      "aucun logo tiers ajoute",
      "aucun accessoire trompeur non inclus",
      "variante exacte verifiee",
    ],
    keepHoldUntil: [
      "fichier local present",
      "droits images remplis",
      "correspondance visuelle prouvee",
      "validation Mouss",
    ],
  }));

  return {
    rank: product.rank,
    productId: product.productId,
    productName: product.productName,
    categoryId: product.categoryId,
    targetFolderPublic: product.targetFolderPublic,
    actionMode: product.actionMode,
    fieldPriority: product.fieldPriority,
    recommendedFirstMove: product.recommendedFirstMove,
    humanGateStatus: humanGateProduct?.status ?? "UNKNOWN",
    humanGateBlockers: humanGateProduct?.blockers ?? [],
    imageCount: imageTasks.length,
    imageTasks,
  };
}

function markdown(summary) {
  const rows = summary.products.flatMap((product) =>
    product.imageTasks.map(
      (task) =>
        `| ${product.rank}.${task.order} | ${mdCell(product.productName)} | ${mdCell(task.role)} | ${mdCell(task.requiredShot)} | ${mdCell(task.targetPublicUrl)} |`,
    ),
  );

  return `${[
    "# Maxi Trouvailles - Photo sprint du jour",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Produits a traiter aujourd'hui: ${summary.productCount}`,
    `- Images prioritaires: ${summary.imageTaskCount}`,
    `- Produits exclus du sprint photo rapide: ${summary.excludedProductCount}`,
    "- Action catalogue: aucune",
    "- Images generees: aucune",
    "- Publication: aucune",
    "",
    "## Files WebP a produire en premier",
    "",
    "| Ordre | Produit | Role | A photographier / verifier | Cible WebP |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    "## Regle",
    "",
    "Ne produire une image fiche produit que si elle correspond exactement a l'article vendu. Sinon garder HOLD.",
    "",
    "## Exclus du sprint rapide",
    "",
    ...summary.excludedProducts.map(
      (product) => `- ${product.productName}: ${product.reason}`,
    ),
    "",
    "## Sources",
    "",
    `- Checklist terrain: ${summary.sources.checklistPath}`,
    `- Passerelle revue humaine: ${summary.sources.humanReviewPath}`,
    "",
  ].join("\n")}\n`;
}

function printChecklist(summary) {
  const blocks = summary.products.map((product) => {
    const tasks = product.imageTasks.map(
      (task) => `- [ ] ${task.role}: ${task.requiredShot}\n  Cible: ${task.targetPublicUrl}`,
    );
    return [
      `## ${product.rank}. ${product.productName}`,
      "",
      `Dossier cible: ${product.targetFolderPublic}`,
      `Statut actuel: ${product.humanGateStatus}`,
      "",
      "A faire:",
      "",
      ...tasks,
      "",
      "Avant de sortir du HOLD:",
      "",
      "- [ ] fichiers WebP presents",
      "- [ ] droits image ou photo propre confirmes",
      "- [ ] variante exacte confirmee",
      "- [ ] validation Mouss",
      "",
    ].join("\n");
  });

  return `${[
    "# A imprimer - Photo sprint du jour",
    "",
    "Aucune publication, aucune commande fournisseur, aucun paiement. Cette feuille sert uniquement a produire/verifier les images locales.",
    "",
    ...blocks,
  ].join("\n")}\n`;
}

function productCard(product) {
  const rows = product.imageTasks.map(
    (task) =>
      `| ${task.order} | ${mdCell(task.role)} | ${mdCell(task.requiredShot)} | ${mdCell(task.targetPublicUrl)} |`,
  );

  return `${[
    `# Photo sprint - ${product.productName}`,
    "",
    `Statut passerelle: ${product.humanGateStatus}`,
    `Premier mouvement: ${product.recommendedFirstMove}`,
    "",
    "## Images a produire",
    "",
    "| Ordre | Role | Photo/preuve attendue | Cible WebP |",
    "|---:|---|---|---|",
    ...rows,
    "",
    "## A ne pas faire",
    "",
    "- ne pas utiliser d'image generee en galerie produit exacte",
    "- ne pas publier",
    "- ne pas commander fournisseur",
    "- ne pas afficher la marketplace fournisseur au client",
    "",
  ].join("\n")}\n`;
}

function csv(summary) {
  const headers = [
    "order",
    "productId",
    "productName",
    "role",
    "requiredShot",
    "targetPublicUrl",
    "targetAbsolutePath",
    "humanGateStatus",
  ];
  const rows = summary.products.flatMap((product) =>
    product.imageTasks.map((task) => ({
      order: `${product.rank}.${task.order}`,
      productId: product.productId,
      productName: product.productName,
      role: task.role,
      requiredShot: task.requiredShot,
      targetPublicUrl: task.targetPublicUrl,
      targetAbsolutePath: task.targetAbsolutePath,
      humanGateStatus: product.humanGateStatus,
    })),
  );

  return `${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
    .join("\n")}\n`;
}

const checklistPath = latestFile("CHECKLIST_TERRAIN_IMAGES_SPRINT_", "CHECKLIST_TERRAIN_IMAGES_SPRINT_*.json");
const humanReviewPath = latestFile("PASSERELLE_REVUE_HUMAINE_IMAGES_SPRINT_", "PASSERELLE_REVUE_HUMAINE_IMAGES_SPRINT_*.json");
const checklist = readJson(checklistPath);
const humanReview = readJson(humanReviewPath);
const humanGateById = new Map((humanReview.products ?? []).map((product) => [product.productId, product]));

const actionable = (checklist.products ?? []).filter((product) => product.actionMode === "PHOTO_OR_RIGHTS_FIRST");
const excludedProducts = (checklist.products ?? [])
  .filter((product) => product.actionMode !== "PHOTO_OR_RIGHTS_FIRST")
  .map((product) => ({
    productId: product.productId,
    productName: product.productName,
    actionMode: product.actionMode,
    reason: "HOLD/remplacement avant sprint rapide, preuves dimensions/fixations ou decision produit requises",
  }));

const products = actionable.map((product) => buildProductTask(product, humanGateById.get(product.productId)));
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `photo-sprint-du-jour-${dateKey}`);
const cardsDir = path.join(outputDir, "fiches-photo");
fs.mkdirSync(cardsDir, { recursive: true });

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_photo_sprint_today_board",
  productCount: products.length,
  imageTaskCount: products.reduce((sum, product) => sum + product.imageCount, 0),
  excludedProductCount: excludedProducts.length,
  products,
  excludedProducts,
  sources: {
    checklistPath,
    humanReviewPath,
  },
  safety: {
    readOnly: true,
    noImageDownload: true,
    noImageGeneration: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

for (const product of products) {
  const fileName = `${String(product.rank).padStart(2, "0")}-${slugify(product.productName)}.md`;
  fs.writeFileSync(path.join(cardsDir, fileName), productCard(product), "utf8");
}

const jsonPath = path.join(outputDir, `PHOTO_SPRINT_DU_JOUR_${dateKey}.json`);
const mdPath = path.join(outputDir, `PHOTO_SPRINT_DU_JOUR_${dateKey}.md`);
const csvPath = path.join(outputDir, `PHOTO_SPRINT_DU_JOUR_${dateKey}.csv`);
const printPath = path.join(outputDir, `A_IMPRIMER_PHOTO_SPRINT_DU_JOUR_${dateKey}.md`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(summary), "utf8");
fs.writeFileSync(printPath, printChecklist(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      productCount: summary.productCount,
      imageTaskCount: summary.imageTaskCount,
      excludedProductCount: summary.excludedProductCount,
      files: {
        jsonPath,
        mdPath,
        csvPath,
        printPath,
        cardsDir,
      },
      products: products.map((product) => ({
        productId: product.productId,
        productName: product.productName,
        imageCount: product.imageCount,
        humanGateStatus: product.humanGateStatus,
      })),
      excludedProducts,
      safety: summary.safety,
    },
    null,
    2,
  ),
);

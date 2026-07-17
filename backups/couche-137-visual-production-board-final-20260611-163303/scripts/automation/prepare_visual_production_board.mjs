import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessDir = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessDir, "tableaux-action");
const photoDropRoot = path.join(businessDir, "depots-photos");

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

function latestFileUnder(dir, predicate, label) {
  const matches = collectFiles(dir, predicate)
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (matches.length === 0) {
    throw new Error(`No ${label} found under ${dir}`);
  }

  const todayKey = datePartsParis().dateKey;
  return matches.find((match) => match.fullPath.includes(todayKey))?.fullPath ?? matches[0].fullPath;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relativePath(filePath) {
  return path.relative(root, filePath);
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function productPhotoItems(workOrder) {
  return (workOrder.tasks ?? []).map((task, index) => ({
    priority: index + 1,
    urgency: "P0",
    lane: "photo_produit_exacte",
    targetType: "produit",
    targetName: task.productName,
    targetId: task.productId,
    categoryId: task.categoryId,
    expectedFileName: task.expectedFileName,
    dropFolderRelative: task.dropFolderRelative,
    stagingRelativePath: task.stagingRelativePath,
    currentStatus: task.stagingStatus,
    blocker: "IMAGE_PRODUIT_EXACTE_MANQUANTE",
    nextAction: task.action,
    requiredShot: `${task.role} - ${task.requiredShot}`,
    businessImpact: "bloque la mise en vente propre de la fiche produit",
    safetyStatus: "HOLD_PHOTOS_PRODUITS",
  }));
}

function categoryImageItems(intakeStatus, offset) {
  return (intakeStatus.items ?? [])
    .filter((item) => !item.humanReviewReady)
    .map((item, index) => ({
      priority: offset + index + 1,
      urgency: item.batchLabel.startsWith("P1") ? "P1" : "P2",
      lane: "image_categorie_dropshipping",
      targetType: "categorie",
      targetName: item.categoryName,
      targetId: item.categoryId,
      categoryId: item.categoryId,
      expectedFileName: item.expectedFileName,
      dropFolderRelative: item.dropFolderRelative,
      stagingRelativePath: item.stagingRelativePath,
      currentStatus: item.stagingStatus,
      blocker: item.blockers?.[0] ?? "IMAGE_CATEGORIE_A_DEPOSER",
      nextAction: item.nextAction,
      requiredShot: item.visualDirection,
      businessImpact: "ameliore la navigation et le taux de clic categories",
      safetyStatus: item.safetyStatus,
    }));
}

function csv(summary) {
  const headers = [
    "priority",
    "urgency",
    "lane",
    "targetType",
    "targetName",
    "expectedFileName",
    "currentStatus",
    "dropFolderRelative",
    "stagingRelativePath",
    "nextAction",
    "businessImpact",
    "safetyStatus",
  ];

  return `${headers.join(",")}\n${summary.items
    .map((item) => headers.map((header) => csvEscape(item[header])).join(","))
    .join("\n")}\n`;
}

function markdown(summary) {
  const rows = summary.items.map(
    (item) =>
      `| ${item.priority} | ${item.urgency} | ${item.lane} | ${mdCell(item.targetName)} | ${mdCell(item.expectedFileName)} | ${mdCell(item.currentStatus)} | ${mdCell(item.nextAction)} |`,
  );

  return `${[
    "# Maxi Trouvailles - Production visuels exacts",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Total visuels a produire/deposer: ${summary.itemCount}`,
    `- Photos produits exactes: ${summary.counts.productPhotos}`,
    `- Images categories dropshipping: ${summary.counts.categoryImages}`,
    "- Copie publique: aucune",
    "- Publication: aucune",
    "- Paiement/commande fournisseur: aucun",
    "",
    "## Ordre de travail unique",
    "",
    "| Priorite | Urgence | File | Cible | Fichier attendu | Statut depot | Action |",
    "|---:|---|---|---|---|---|---|",
    ...rows,
    "",
    "## Regles",
    "",
    "- Produire ou deposer uniquement des WebP exacts avec les noms indiques.",
    "- Ne rien copier dans `public/uploads` sans revue humaine et validation Mouss.",
    "- Garder les fiches et categories en HOLD tant que les fichiers restent absents.",
    "- Relancer les audits photo et categorie apres depot.",
    "",
    "## Commandes apres depot",
    "",
    "```powershell",
    "npm run catalog:photo-drop-kit",
    "npm run catalog:audit-photo-checklist",
    "npm run catalog:category-image-intake-status",
    "npm run catalog:category-image-promotion-plan",
    "npm run catalog:daily-execution-board",
    "```",
    "",
    "## Sources",
    "",
    `- Ordre photos produits: ${summary.sources.photoWorkOrderPath}`,
    `- Suivi images categories: ${summary.sources.categoryIntakePath}`,
    "",
  ].join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const photoWorkOrderPath = latestFileUnder(
  photoDropRoot,
  (name) => name.startsWith("ORDRE_TRAVAIL_PHOTOS_MANQUANTES_") && name.endsWith(".json"),
  "photo missing work order",
);
const categoryIntakePath = latestFileUnder(
  actionRoot,
  (name) => name.startsWith("SUIVI_DEPOTS_IMAGES_CATEGORIES_") && name.endsWith(".json"),
  "category image intake status",
);

const photoWorkOrder = readJson(photoWorkOrderPath);
const categoryIntake = readJson(categoryIntakePath);
const photoItems = productPhotoItems(photoWorkOrder);
const categoryItems = categoryImageItems(categoryIntake, photoItems.length);
const items = [...photoItems, ...categoryItems];
const outputDir = path.join(actionRoot, `production-visuels-exacts-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: true,
  mode: "read_only_visual_production_board",
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  status: items.length > 0 ? "HOLD_VISUELS_EXACTS_A_PRODUIRE" : "READY_VISUAL_HUMAN_REVIEW_HOLD",
  itemCount: items.length,
  counts: {
    productPhotos: photoItems.length,
    categoryImages: categoryItems.length,
  },
  safety: {
    readOnly: true,
    noPublicUploadsWrite: true,
    noImageGeneration: true,
    noImageDownload: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    manualValidationRequired: true,
  },
  sources: {
    photoWorkOrderPath: relativePath(photoWorkOrderPath),
    categoryIntakePath: relativePath(categoryIntakePath),
  },
  outputDir: relativePath(outputDir),
  items,
};

const jsonPath = path.join(outputDir, `VISUELS_EXACTS_A_PRODUIRE_${dateKey}.json`);
const mdPath = path.join(outputDir, `VISUELS_EXACTS_A_PRODUIRE_${dateKey}.md`);
const csvPath = path.join(outputDir, `VISUELS_EXACTS_A_PRODUIRE_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      status: summary.status,
      itemCount: summary.itemCount,
      counts: summary.counts,
      files: {
        jsonPath,
        mdPath,
        csvPath,
      },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

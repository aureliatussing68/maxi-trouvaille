import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessDir = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessDir, "tableaux-action");
const categoryImageBase = "/uploads/category-images";

const commercialPriorityById = new Map([
  ["dropshipping-promotions", 95],
  ["dropshipping-nouveautes", 92],
  ["dropshipping-high-tech", 88],
  ["dropshipping-accessoires", 84],
  ["dropshipping-auto-moto", 80],
  ["dropshipping-maison", 76],
  ["dropshipping-cuisine", 72],
  ["dropshipping-beaute", 68],
  ["dropshipping-animaux", 64],
  ["dropshipping-mode", 60],
  ["dropshipping-enfant", 56],
  ["high-tech", 54],
  ["auto-moto", 52],
  ["accessoires", 50],
  ["maison", 48],
  ["cuisine", 46],
  ["espace-revendeur", 44],
]);

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

function tryLatestFile(prefix) {
  const matches = collectFiles(
    actionRoot,
    (name) => name.startsWith(prefix) && name.endsWith(".json"),
  )
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return matches[0]?.fullPath ?? null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

function csvEscape(value) {
  const normalized = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${normalized.replace(/"/g, '""')}"`;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function relativePath(filePath) {
  return path.relative(root, filePath);
}

function isDropshippingCategory(category) {
  return (
    category.id === "dropshipping" ||
    category.parentId === "dropshipping" ||
    category.id.startsWith("dropshipping-")
  );
}

function proposedFileName(category) {
  if (category.id.startsWith("dropshipping-")) return `${category.id}.webp`;
  if (!category.visible) return `${category.id}-a-venir.webp`;
  return `${category.id}-rayon.webp`;
}

function productSignal(category) {
  const id = category.id;
  if (id.includes("colis") || id.includes("palette")) {
    return "cartons ouverts, colis mysteres et ambiance destockage surprise, sans vente active";
  }
  if (id === "dropshipping-promotions") {
    return "promotions propres, prix visuels sans marque et sensation bonnes affaires";
  }
  if (id === "dropshipping-nouveautes") {
    return "produits nouveaux, tendance, selection ecommerce fraiche";
  }
  if (id.includes("revendeur")) {
    return "palettes, cartons en gros, stock professionnel et ambiance entrepot propre";
  }
  if (id.includes("sport")) {
    return "tennis, velo, ballon, fitness et activite exterieure";
  }
  if (id.includes("auto-moto")) {
    return "voiture et moto, accessoires modernes, nettoyage et confort vehicule";
  }
  if (id.includes("animaux")) {
    return "chien, chat, accessoires animaux et rayon animalerie chaleureux";
  }
  if (id.includes("livre") || id.includes("media")) {
    return "livres, mangas, BD, DVD, CD, vinyles ou etagere media";
  }
  if (id.includes("jeux-video")) {
    return "console, manette gaming, setup moderne et accessoires joueur";
  }
  if (id.includes("puericulture")) {
    return "bebe, poussette, jouets bebe, siege auto et biberons";
  }
  if (id.includes("cuisine")) {
    return "robot cuisine, ustensiles, vaisselle, mugs et cuisine moderne";
  }
  if (id.includes("outillage")) {
    return "perceuse, outils, caisse a outils et bricolage propre";
  }
  if (id.includes("jardin")) {
    return "plantes, tondeuse, arrosoir, pots et jardin exterieur";
  }
  if (id.includes("beaute")) {
    return "soins, maquillage, parfum, bien-etre et accessoires beaute";
  }
  if (id.includes("electricite")) {
    return "cables, prises, ampoules LED et materiel electrique";
  }
  if (id.includes("gadget")) {
    return "gadgets high-tech, objets insolites et accessoires modernes";
  }
  if (id.includes("bricolage")) {
    return "outils en action, travaux maison et etabli bricolage";
  }
  if (id.includes("high-tech")) {
    return "ecrans, ordinateurs, objets connectes et technologie moderne";
  }
  if (id.includes("accessoires")) {
    return "sacs, montres, bijoux et accessoires varies";
  }
  if (id.includes("jouets") || id.includes("enfant")) {
    return "jouets enfants, figurines, jeux et univers colore propre";
  }
  if (id.includes("deco")) {
    return "salon moderne, decoration interieure et ambiance maison design";
  }
  if (id.includes("maison")) {
    return "pieces maison, rangement et confort interieur";
  }
  if (id.includes("vetements") || id.includes("mode")) {
    return "portants vetements, mode homme/femme et ambiance boutique textile";
  }
  if (id.includes("mannequin")) {
    return "mannequins vitrine et bustes de presentation vetements";
  }
  if (id.includes("presentoir")) {
    return "rayonnages et presentoirs magasin avec mise en avant produits";
  }
  if (id.includes("mobilier")) {
    return "bureau pro, etageres et mobilier commerce ou entrepot";
  }
  if (id.includes("agencement")) {
    return "boutique moderne, rayons et organisation magasin";
  }
  if (id.includes("telephonie")) {
    return "smartphones, accessoires telephone et ecouteurs";
  }
  if (id.includes("informatique")) {
    return "PC, clavier, setup bureau et composants informatique";
  }
  return category.creativeBrief ?? "rayon ecommerce clair, moderne et immediatement reconnaissable";
}

function actionFor(category, sprintByCategory, promotionByCategory) {
  const warnings = category.warnings ?? [];
  const failures = category.failures ?? [];
  const shared = category.sharedWithCategoryIds ?? [];
  const inSprint = sprintByCategory.has(category.id);
  const promotion = promotionByCategory.get(category.id);

  if (failures.length > 0) {
    return {
      priority: "P0",
      status: "FIX_FILE_OR_MAPPING",
      action: "corriger fichier WebP ou mapping avant toute autre action",
      blockers: failures,
    };
  }

  if (!category.visible) {
    return {
      priority: "P4",
      status: "HOLD_HIDDEN_OR_COMING_SOON",
      action: "ne pas mettre en avant tant que la categorie reste cachee/non vendable",
      blockers: [],
    };
  }

  if (promotion?.promotionStatus === "HOLD_MECHANICAL_BLOCKERS") {
    return {
      priority: inSprint ? "P1" : "P2",
      status: "PRODUCE_OR_DEPOSIT_WEBP_FIRST",
      action: "deposer un WebP valide puis relancer la passerelle de promotion",
      blockers: promotion.blockers ?? [],
    };
  }

  if (promotion?.promotionStatus === "READY_FOR_HUMAN_VISUAL_REVIEW_HOLD") {
    return {
      priority: "P1",
      status: "READY_FOR_HUMAN_VISUAL_REVIEW_HOLD",
      action: "faire revue mobile/desktop puis validation Mouss avant copie publique",
      blockers: [],
    };
  }

  if (inSprint) {
    return {
      priority: "P1",
      status: "IN_UNIQUENESS_SPRINT_HOLD",
      action: "produire image dediee selon le sprint unicite",
      blockers: [],
    };
  }

  if (
    warnings.includes("shared_image_asset") &&
    category.imageUrl === `${categoryImageBase}/${proposedFileName(category)}`
  ) {
    return {
      priority: "P3",
      status: "KEEP_DEDICATED_VISIBLE_ASSET_REVIEW_HIDDEN_COPY",
      action: "conserver l'image dediee visible et verifier seulement la categorie cachee partagee",
      blockers: [],
    };
  }

  if (warnings.includes("shared_image_asset") && isDropshippingCategory(category)) {
    return {
      priority: "P2",
      status: "CREATE_DEDICATED_PARTNER_VISUAL",
      action: "creer une variante visuelle dediee produits partenaires",
      blockers: [],
    };
  }

  if (warnings.includes("shared_image_asset") && shared.some((id) => id.startsWith("dropshipping-"))) {
    return {
      priority: "P3",
      status: "KEEP_AS_CANONICAL_UNTIL_PARTNER_SPLIT",
      action: "garder comme image rayon principale, verifier apres separation dropshipping",
      blockers: [],
    };
  }

  if (warnings.includes("shared_image_asset")) {
    return {
      priority: "P3",
      status: "REVIEW_SHARED_ASSET",
      action: "revoir l'unicite si la categorie devient visible ou prioritaire",
      blockers: [],
    };
  }

  return {
    priority: "OK",
    status: "OK_KEEP_CURRENT",
    action: "conserver l'image actuelle",
    blockers: [],
  };
}

function buildBrief(item) {
  return [
    `# Brief image categorie - ${item.categoryName}`,
    "",
    `Categorie: ${item.categoryId}`,
    `Priorite: ${item.priority}`,
    `Statut: ${item.status}`,
    `Image actuelle: ${item.currentImageUrl}`,
    `Fichier propose si remplacement: ${item.proposedImageFileName}`,
    `URL future proposee: ${item.proposedPublicUrl}`,
    "",
    "## Direction visuelle",
    "",
    item.visualDirection,
    "",
    "## Contraintes",
    "",
    "- WebP optimise, ratio 16/10;",
    "- largeur minimum 900 px;",
    "- image lisible sur mobile;",
    "- coins arrondis geres par le front, pas dans l'image elle-meme;",
    "- aucun logo Amazon, AliExpress, marketplace ou marque visible;",
    "- pas d'image pixelisee ou cheap;",
    "- conserver titres et descriptions existants;",
    "- validation Mouss avant copie publique.",
    "",
    "## Statut actuel",
    "",
    `Action: ${item.action}`,
    `Bloquants: ${item.blockers.length ? item.blockers.join(", ") : "aucun"}`,
    "",
  ].join("\n");
}

function markdown(summary) {
  const priorityRows = summary.items
    .filter((item) => item.priority !== "OK")
    .map(
      (item) =>
        `| ${mdCell(item.priority)} | ${mdCell(item.categoryName)} | ${mdCell(item.status)} | ${mdCell(item.currentImageFileName)} | ${mdCell(item.proposedImageFileName)} | ${mdCell(item.action)} |`,
    );

  const okRows = summary.items
    .filter((item) => item.priority === "OK")
    .map((item) => `| ${mdCell(item.categoryName)} | ${mdCell(item.currentImageFileName)} | ${mdCell(item.fileStatus)} |`);

  return `${[
    "# Maxi Trouvailles - Roadmap globale images categories",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Categories auditees: ${summary.categoryCount}`,
    `- Categories visibles: ${summary.visibleCategoryCount}`,
    `- Categories cachees: ${summary.hiddenCategoryCount}`,
    `- Categories avec WebP local valide: ${summary.validCategoryWebpCount}`,
    `- Images uniques locales valides: ${summary.uniqueValidWebpFileCount}`,
    `- Categories OK a conserver: ${summary.okKeepCount}`,
    `- Categories a produire/revoir: ${summary.actionRequiredCount}`,
    "- Copie publique: aucune",
    "- Modification catalogue: aucune",
    "- Image generee/telechargee: aucune",
    "",
    "## Priorites",
    "",
    "| Priorite | Categorie | Statut | Image actuelle | Fichier propose | Action |",
    "|---|---|---|---|---|---|",
    ...priorityRows,
    "",
    "## Images OK a conserver",
    "",
    okRows.length
      ? "| Categorie | Image | Statut fichier |\n|---|---|---|\n" + okRows.join("\n")
      : "Aucune categorie classee OK.",
    "",
    "## Regles",
    "",
    "- une categorie visible partagee avec une categorie dropshipping doit etre separee cote dropshipping en premier;",
    "- les categories colis/palettes restent cachees ou a venir tant que la vente est bloquee;",
    "- aucune copie vers `public/uploads/category-images` sans revue mobile/desktop et validation Mouss;",
    "- les images doivent rester libres de logos marketplace et lisibles sur mobile.",
    "",
  ].join("\n")}\n`;
}

function csv(summary) {
  const headers = [
    "priority",
    "status",
    "categoryId",
    "categorySlug",
    "categoryName",
    "visible",
    "parentId",
    "currentImageFileName",
    "currentImageUrl",
    "fileStatus",
    "fileBytes",
    "fileWidth",
    "fileHeight",
    "sharedWithCategoryIds",
    "proposedImageFileName",
    "proposedPublicUrl",
    "inSprint",
    "promotionStatus",
    "action",
    "blockers",
    "visualDirection",
  ];

  return `${headers.join(",")}\n${summary.items
    .map((item) => headers.map((header) => csvEscape(item[header])).join(","))
    .join("\n")}\n`;
}

const auditPath = latestFile("AUDIT_IMAGES_CATEGORIES_", "AUDIT_IMAGES_CATEGORIES_*.json");
const sprintPath = tryLatestFile("SPRINT_UNICITE_IMAGES_CATEGORIES_");
const promotionPath = tryLatestFile("PLAN_PROMOTION_IMAGES_CATEGORIES_");
const audit = readJson(auditPath);
const sprint = sprintPath ? readJson(sprintPath) : { sprint: [] };
const promotion = promotionPath ? readJson(promotionPath) : { items: [] };
const sprintByCategory = new Map((sprint.sprint ?? []).map((item) => [item.categoryId, item]));
const promotionByCategory = new Map((promotion.items ?? []).map((item) => [item.categoryId, item]));
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `roadmap-images-categories-${dateKey}`);
const briefsDir = path.join(outputDir, "briefs-production");
fs.mkdirSync(briefsDir, { recursive: true });

const items = (audit.categories ?? []).map((category) => {
  const proposedImageFileName = proposedFileName(category);
  const proposedPublicUrl = `${categoryImageBase}/${proposedImageFileName}`;
  const gate = actionFor(category, sprintByCategory, promotionByCategory);
  return {
    priority: gate.priority,
    status: gate.status,
    categoryId: category.id,
    categorySlug: category.slug,
    categoryName: category.name,
    description: category.description,
    visible: category.visible,
    hiddenNavigation: category.hiddenNavigation,
    parentId: category.parentId,
    currentImageFileName: category.imageFileName,
    currentImageUrl: category.imageUrl,
    fileStatus: category.file?.status ?? "unknown",
    fileBytes: category.file?.bytes ?? 0,
    fileWidth: category.file?.width ?? null,
    fileHeight: category.file?.height ?? null,
    warnings: category.warnings ?? [],
    failures: category.failures ?? [],
    sharedWithCategoryIds: category.sharedWithCategoryIds ?? [],
    proposedImageFileName,
    proposedPublicUrl,
    proposedLocalPath: path.join(root, "public", proposedPublicUrl.replace(/^\//, "")),
    inSprint: sprintByCategory.has(category.id),
    sprintRank: sprintByCategory.get(category.id)?.rank ?? null,
    promotionStatus: promotionByCategory.get(category.id)?.promotionStatus ?? "",
    action: gate.action,
    blockers: gate.blockers,
    visualDirection: [
      isDropshippingCategory(category)
        ? "Version produits partenaires: selection ecommerce neuve et propre, sans marketplace visible."
        : "Version rayon Maxi Trouvailles: image realiste, moderne et claire.",
      `Signal visuel: ${productSignal(category)}.`,
      "Style premium leger, lumineux, responsive mobile et PC.",
    ].join(" "),
    safetyStatus: gate.priority === "OK" ? "KEEP_CURRENT_IMAGE" : "HOLD_IMAGE_WORKFLOW_REQUIRED",
  };
});

const priorityOrder = new Map([["P0", 0], ["P1", 1], ["P2", 2], ["P3", 3], ["P4", 4], ["OK", 5]]);
items.sort(
  (a, b) =>
    (priorityOrder.get(a.priority) ?? 9) - (priorityOrder.get(b.priority) ?? 9) ||
    (commercialPriorityById.get(b.categoryId) ?? 0) - (commercialPriorityById.get(a.categoryId) ?? 0) ||
    a.categoryId.localeCompare(b.categoryId),
);

items
  .filter((item) => item.priority !== "OK")
  .forEach((item, index) => {
    const fileName = `${String(index + 1).padStart(2, "0")}-${slugify(item.categoryName)}-${item.categoryId}.md`;
    const briefPath = path.join(briefsDir, fileName);
    fs.writeFileSync(briefPath, `${buildBrief(item)}\n`, "utf8");
    item.briefPath = briefPath;
    item.briefPathRelative = relativePath(briefPath);
  });

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_global_category_image_roadmap",
  categoryCount: items.length,
  visibleCategoryCount: items.filter((item) => item.visible).length,
  hiddenCategoryCount: items.filter((item) => !item.visible).length,
  validCategoryWebpCount: items.filter((item) => item.fileStatus === "present_valid_webp_signature").length,
  uniqueValidWebpFileCount: audit.validWebpFileCount ?? null,
  okKeepCount: items.filter((item) => item.priority === "OK").length,
  actionRequiredCount: items.filter((item) => item.priority !== "OK").length,
  priorityCounts: Object.fromEntries(
    [...priorityOrder.keys()].map((priority) => [
      priority,
      items.filter((item) => item.priority === priority).length,
    ]),
  ),
  outputDir,
  outputDirRelative: relativePath(outputDir),
  briefsDir,
  briefsDirRelative: relativePath(briefsDir),
  items,
  sources: {
    auditPath,
    sprintPath,
    promotionPath,
  },
  safety: {
    readOnly: true,
    noPublicUploadsWrite: true,
    noImageGeneration: true,
    noImageDownload: true,
    noImageReplacement: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    manualValidationRequired: true,
  },
};

const jsonPath = path.join(outputDir, `ROADMAP_IMAGES_CATEGORIES_${dateKey}.json`);
const mdPath = path.join(outputDir, `ROADMAP_IMAGES_CATEGORIES_${dateKey}.md`);
const csvPath = path.join(outputDir, `ROADMAP_IMAGES_CATEGORIES_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      categoryCount: summary.categoryCount,
      visibleCategoryCount: summary.visibleCategoryCount,
      hiddenCategoryCount: summary.hiddenCategoryCount,
      okKeepCount: summary.okKeepCount,
      actionRequiredCount: summary.actionRequiredCount,
      priorityCounts: summary.priorityCounts,
      files: {
        jsonPath,
        mdPath,
        csvPath,
        briefsDir,
      },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

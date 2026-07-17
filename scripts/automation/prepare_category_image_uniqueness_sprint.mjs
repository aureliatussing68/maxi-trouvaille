import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessDir = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessDir, "tableaux-action");
const categoryImageBase = "/uploads/category-images";
const sprintLimit = 5;

const commercialPriorityById = new Map([
  ["dropshipping-promotions", 85],
  ["dropshipping-high-tech", 80],
  ["dropshipping-accessoires", 76],
  ["dropshipping-auto-moto", 72],
  ["dropshipping-maison", 68],
  ["dropshipping-cuisine", 64],
  ["dropshipping-beaute", 62],
  ["dropshipping-animaux", 58],
  ["dropshipping-mode", 54],
  ["dropshipping-enfant", 50],
  ["high-tech", 46],
  ["auto-moto", 44],
  ["accessoires", 42],
  ["maison", 40],
  ["cuisine", 38],
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

  const todayKey = datePartsParis().dateKey;
  return matches.find((match) => match.fullPath.includes(todayKey))?.fullPath ?? matches[0].fullPath;
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

function categoryById(audit) {
  return new Map((audit.categories ?? []).map((category) => [category.id, category]));
}

function isDropshippingCategory(category) {
  return category.id === "dropshipping" || category.parentId === "dropshipping" || category.id.startsWith("dropshipping-");
}

function canonicalCategory(categories) {
  const visibleNonDropshipping = categories.find((category) => category.visible && !isDropshippingCategory(category));
  if (visibleNonDropshipping) return visibleNonDropshipping;

  const visible = categories.find((category) => category.visible);
  if (visible) return visible;

  return categories[0];
}

function proposedFileName(category) {
  if (category.id.startsWith("dropshipping-")) {
    return `${category.id}.webp`;
  }
  return `${category.id}-rayon.webp`;
}

function productSignal(category) {
  if (category.id === "dropshipping-promotions") {
    return "promotions et bonnes affaires partenaires a reconnaitre immediatement";
  }
  if (category.id.includes("high-tech")) {
    return "technologie moderne, accessoires connectes, ecrans et objets utiles";
  }
  if (category.id.includes("accessoires")) {
    return "petits accessoires utiles, voyage, rangement et mode sans confusion";
  }
  if (category.id.includes("auto-moto")) {
    return "equipement vehicule, nettoyage, confort auto et moto";
  }
  if (category.id.includes("maison")) {
    return "rangement, confort interieur et objets pratiques pour la maison";
  }
  if (category.id.includes("cuisine")) {
    return "ustensiles, robot, vaisselle et cuisine moderne";
  }
  if (category.id.includes("beaute")) {
    return "soins, accessoires beaute, bien-etre et rendu lumineux";
  }
  if (category.id.includes("animaux")) {
    return "chien, chat, accessoires animalerie, ambiance chaleureuse";
  }
  if (category.id.includes("mode") || category.id.includes("vetements")) {
    return "portants vetements, accessoires mode et rendu boutique textile";
  }
  if (category.id.includes("enfant") || category.id.includes("jouets")) {
    return "jouets, cadeaux enfants et univers colore propre";
  }
  if (category.id.includes("espace-revendeur")) {
    return "palettes, cartons en gros et stock professionnel";
  }
  return category.creativeBrief ?? "image categorie claire, moderne et reconnaissable";
}

function visualDirection(category, anchorCategory) {
  const partnerPrefix = isDropshippingCategory(category)
    ? "Version produits partenaires: montrer une selection ecommerce neuve et propre, sans marketplace visible."
    : "Version rayon principal: montrer le rayon comme univers de boutique Maxi Trouvailles.";

  return [
    partnerPrefix,
    `Differencier de l'image actuelle partagee avec ${anchorCategory.name}.`,
    `Signal visuel prioritaire: ${productSignal(category)}.`,
    "Style: realiste ou semi-realiste, premium leger, lumineux, mobile friendly.",
  ].join(" ");
}

function candidateScore(category, groupSize, anchorCategory) {
  let score = commercialPriorityById.get(category.id) ?? 25;
  if (category.visible) score += 100;
  if (isDropshippingCategory(category)) score += 35;
  if (category.parentId === "dropshipping") score += 20;
  if (category.id !== anchorCategory.id) score += 12;
  score += groupSize * 4;
  if (!category.visible) score -= 120;
  if (category.id.includes("colis") || category.id.includes("palette")) score -= 30;
  return score;
}

function buildCandidates(audit) {
  const byId = categoryById(audit);
  const candidates = [];
  const backlog = [];

  for (const group of audit.sharedImageGroups ?? []) {
    const categories = group.categoryIds
      .map((id) => byId.get(id))
      .filter(Boolean);
    const anchor = canonicalCategory(categories);
    const visibleCategories = categories.filter((category) => category.visible);

    if (visibleCategories.length === 0) {
      backlog.push({
        imageFileName: group.imageFileName,
        reason: "hidden_only_group",
        categoryIds: group.categoryIds,
        categoryNames: group.categoryNames,
      });
      continue;
    }

    for (const category of visibleCategories) {
      if (category.id === anchor.id && visibleCategories.length > 1) {
        continue;
      }

      const fileName = proposedFileName(category);
      const targetPublicUrl = `${categoryImageBase}/${fileName}`;
      if (targetPublicUrl === category.imageUrl) {
        backlog.push({
          imageFileName: group.imageFileName,
          reason: "visible_category_already_has_dedicated_filename",
          categoryIds: group.categoryIds,
          categoryNames: group.categoryNames,
        });
        continue;
      }

      const score = candidateScore(category, group.categoryIds.length, anchor);
      candidates.push({
        categoryId: category.id,
        categorySlug: category.slug,
        categoryName: category.name,
        parentId: category.parentId,
        isDropshippingCategory: isDropshippingCategory(category),
        currentImageUrl: category.imageUrl,
        currentImageFileName: category.imageFileName,
        sharedWithCategoryIds: category.sharedWithCategoryIds ?? [],
        sharedGroupSize: group.categoryIds.length,
        anchorCategoryId: anchor.id,
        anchorCategoryName: anchor.name,
        proposedImageFileName: fileName,
        proposedPublicUrl: targetPublicUrl,
        proposedLocalPath: path.join(root, "public", targetPublicUrl.replace(/^\//, "")),
        score,
        visualDirection: visualDirection(category, anchor),
        productionChecks: [
          "WebP optimise, ratio 16/10",
          "largeur minimum 900 px",
          "aucun logo marketplace, fournisseur ou marque visible",
          "image reconnaissable en mobile",
          "titre et description categorie inchanges",
          "validation Mouss avant remplacement public",
        ],
        safetyStatus: "HOLD_PRODUCTION_IMAGE_REQUIRED",
      });
    }
  }

  return {
    candidates: candidates.sort((a, b) => b.score - a.score || a.categoryId.localeCompare(b.categoryId)),
    backlog,
  };
}

function markdown(summary) {
  const rows = summary.sprint.map(
    (item) =>
      `| ${item.rank} | ${mdCell(item.categoryName)} | ${mdCell(item.currentImageFileName)} | ${mdCell(item.proposedImageFileName)} | ${item.score} | ${mdCell(item.visualDirection)} |`,
  );

  const backlogRows = summary.backlog.map(
    (item) => `| ${mdCell(item.imageFileName)} | ${mdCell(item.reason)} | ${mdCell(item.categoryIds.join(", "))} |`,
  );

  return `${[
    "# Maxi Trouvailles - Sprint unicite images categories",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Images partagees candidates: ${summary.candidateCount}`,
    `- Visuels a produire en premier: ${summary.sprintCount}`,
    `- Groupes mis en backlog: ${summary.backlogCount}`,
    "- Remplacement public: aucun",
    "- Image generee: aucune",
    "- Modification catalogue: aucune",
    "",
    "## Sprint prioritaire",
    "",
    "| Rang | Categorie | Image actuelle partagee | Nouveau WebP propose | Score | Direction visuelle |",
    "|---:|---|---|---|---:|---|",
    ...rows,
    "",
    "## Backlog",
    "",
    backlogRows.length
      ? "| Image | Raison | Categories |\n|---|---|---|\n" + backlogRows.join("\n")
      : "Aucun groupe cache en backlog.",
    "",
    "## Regles",
    "",
    "- garder les fichiers actuels tant que les nouveaux visuels ne sont pas valides;",
    "- ne pas publier de remplacement sans revue mobile/desktop;",
    "- ne pas utiliser de logos marketplace ou marques visibles;",
    "- utiliser des WebP propres et legers;",
    "- ne pas modifier les titres et descriptions categories.",
    "",
  ].join("\n")}\n`;
}

function productionChecklist(summary) {
  const blocks = summary.sprint.flatMap((item) => [
    `## ${item.rank}. ${item.categoryName}`,
    "",
    `Categorie: ${item.categoryId}`,
    `Image actuelle: ${item.currentImageUrl}`,
    `Nouveau fichier propose: ${item.proposedPublicUrl}`,
    `Image de reference a differencier: ${item.anchorCategoryName}`,
    "",
    "Direction:",
    "",
    item.visualDirection,
    "",
    "Checklist:",
    "",
    "- [ ] WebP exporte en 16/10",
    "- [ ] largeur minimum 900 px",
    "- [ ] poids raisonnable",
    "- [ ] aucun logo marketplace ou marque visible",
    "- [ ] visuel reconnaissable sur mobile",
    "- [ ] difference nette avec l'image actuelle partagee",
    "- [ ] validation Mouss avant remplacement public",
    "",
  ]);

  return `${[
    "# A produire - Images categories prioritaires",
    "",
    "Ce document est un brief de production. Il ne remplace aucune image automatiquement.",
    "",
    ...blocks,
  ].join("\n")}\n`;
}

function categoryCard(item) {
  return `${[
    `# Image categorie - ${item.categoryName}`,
    "",
    `Rang sprint: ${item.rank}`,
    `Score: ${item.score}`,
    `Categorie: ${item.categoryId}`,
    `Slug: ${item.categorySlug}`,
    "",
    "## Actuel",
    "",
    `Image partagee: ${item.currentImageUrl}`,
    `Partagee avec: ${item.sharedWithCategoryIds.join(", ") || "aucune"}`,
    `Ancre a conserver/differencier: ${item.anchorCategoryName}`,
    "",
    "## Proposition",
    "",
    `Nouveau fichier: ${item.proposedImageFileName}`,
    `Chemin public propose: ${item.proposedPublicUrl}`,
    "",
    "Direction visuelle:",
    "",
    item.visualDirection,
    "",
    "## Garde-fous",
    "",
    ...item.productionChecks.map((check) => `- ${check}`),
    "",
    "Statut: HOLD_PRODUCTION_IMAGE_REQUIRED",
    "",
  ].join("\n")}\n`;
}

function csv(summary) {
  const headers = [
    "rank",
    "categoryId",
    "categorySlug",
    "categoryName",
    "currentImageUrl",
    "currentImageFileName",
    "proposedImageFileName",
    "proposedPublicUrl",
    "score",
    "anchorCategoryId",
    "anchorCategoryName",
    "visualDirection",
    "safetyStatus",
  ];

  return `${headers.join(",")}\n${summary.sprint
    .map((item) => headers.map((header) => csvEscape(item[header])).join(","))
    .join("\n")}\n`;
}

const auditPath = latestFile("AUDIT_IMAGES_CATEGORIES_", "AUDIT_IMAGES_CATEGORIES_*.json");
const audit = readJson(auditPath);
const { candidates, backlog } = buildCandidates(audit);
const sprint = candidates.slice(0, sprintLimit).map((candidate, index) => ({
  rank: index + 1,
  ...candidate,
}));

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `sprint-unicite-images-categories-${dateKey}`);
const cardsDir = path.join(outputDir, "fiches-production");
fs.mkdirSync(cardsDir, { recursive: true });

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_category_image_uniqueness_sprint",
  sprintLimit,
  candidateCount: candidates.length,
  sprintCount: sprint.length,
  backlogCount: backlog.length,
  sprint,
  backlog,
  sources: {
    auditPath,
  },
  safety: {
    readOnly: true,
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

for (const item of sprint) {
  const fileName = `${String(item.rank).padStart(2, "0")}-${slugify(item.categoryName)}-${item.categoryId}.md`;
  fs.writeFileSync(path.join(cardsDir, fileName), categoryCard(item), "utf8");
}

const jsonPath = path.join(outputDir, `SPRINT_UNICITE_IMAGES_CATEGORIES_${dateKey}.json`);
const mdPath = path.join(outputDir, `SPRINT_UNICITE_IMAGES_CATEGORIES_${dateKey}.md`);
const csvPath = path.join(outputDir, `SPRINT_UNICITE_IMAGES_CATEGORIES_${dateKey}.csv`);
const checklistPath = path.join(outputDir, `A_PRODUIRE_IMAGES_CATEGORIES_${dateKey}.md`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(summary), "utf8");
fs.writeFileSync(checklistPath, productionChecklist(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      candidateCount: summary.candidateCount,
      sprintCount: summary.sprintCount,
      backlogCount: summary.backlogCount,
      files: {
        jsonPath,
        mdPath,
        csvPath,
        checklistPath,
        cardsDir,
      },
      sprint: sprint.map((item) => ({
        rank: item.rank,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        currentImageFileName: item.currentImageFileName,
        proposedImageFileName: item.proposedImageFileName,
        score: item.score,
      })),
      safety: summary.safety,
    },
    null,
    2,
  ),
);

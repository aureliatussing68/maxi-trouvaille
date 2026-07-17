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

function shotInstruction(productName, role) {
  const name = normalizeText(productName);
  const normalizedRole = normalizeText(role);

  if (name.includes("pochette")) {
    if (normalizedRole.includes("main")) {
      return "photo produit entier, pochette seule, angle 3/4, fermeture visible";
    }
    if (normalizedRole.includes("detail")) {
      return "detail interieur/compartiments et fermeture, sans objet non inclus trompeur";
    }
    if (normalizedRole.includes("usage")) {
      return "mise en situation avec cables pour montrer l'usage, en precisant que les accessoires ne sont pas inclus si besoin";
    }
    if (normalizedRole.includes("dimension")) {
      return "photo avec repere dimensions lisible ou preuve dimensions separee";
    }
  }

  if (name.includes("support pc")) {
    if (normalizedRole.includes("main")) {
      return "support seul, deploye, angle 3/4, matiere et forme visibles";
    }
    if (normalizedRole.includes("detail")) {
      return "detail charniere, reglages, patins ou pliage";
    }
    if (normalizedRole.includes("usage")) {
      return "usage avec ordinateur en contexte uniquement; ne pas laisser penser que l'ordinateur est inclus";
    }
    if (normalizedRole.includes("dimension")) {
      return "dimensions, hauteur/reglage ou encombrement plie/deplie";
    }
  }

  if (name.includes("filet") || name.includes("coffre") || name.includes("voiture")) {
    if (normalizedRole.includes("main")) {
      return "produit seul avec sangles/fixations visibles, sans promettre compatibilite universelle";
    }
    if (normalizedRole.includes("detail")) {
      return "detail fixation, sangle, couture, crochet ou attache exacte";
    }
    if (normalizedRole.includes("usage")) {
      return "mise en place dans coffre uniquement si vehicule/compatibilite sont documentes";
    }
    if (normalizedRole.includes("dimension")) {
      return "dimensions exactes et elasticite/longueur utile prouvees";
    }
  }

  return "photo nette du produit exact, sans logo tiers ajoute, sans accessoire trompeur";
}

function buildChecklist(action, manifestProduct) {
  const isPriorityPhoto = action.priorityLane === "P1_PREUVE_IMAGE_RAPIDE";
  const isAutoHold = action.priorityLane === "P2_HOLD_OU_REMPLACER";
  const keepHoldIf = [
    "image seulement similaire",
    "doute sur variante",
    "doute sur droits",
    "fichier local manquant",
  ];

  if (isAutoHold) {
    keepHoldIf.push("produit auto sans dimensions/fixations confirmees");
  }

  const images = manifestProduct.images.map((image) => ({
    index: image.index,
    role: image.role,
    targetPublicUrl: image.targetPublicUrl,
    targetAbsolutePath: image.targetAbsolutePath,
    currentSupplierHost: image.currentSupplierHost,
    requiredShot: shotInstruction(action.productName, image.role),
    mustProve: [
      "le produit photographie est exactement la variante vendue",
      "la photo peut etre utilisee par Maxi Trouvailles",
      "le fichier local WebP existe au chemin cible",
      "aucun accessoire non inclus ne cree une promesse trompeuse",
    ],
    fieldForm: {
      photoDone: false,
      exactVariantConfirmed: "",
      photoOwnerOrRights: "",
      localWebpCreated: "",
      visualMatchProof: "",
      reviewedByMouss: false,
      keepHoldUntilComplete: true,
    },
  }));

  return {
    rank: action.rank,
    productId: action.productId,
    productName: action.productName,
    categoryId: action.categoryId,
    priorityLane: action.priorityLane,
    actionMode: isPriorityPhoto ? "PHOTO_OR_RIGHTS_FIRST" : "HOLD_OR_REPLACE_FIRST",
    fieldPriority: isPriorityPhoto ? "a_traiter_en_premier" : "a_ne_pas_debloquer_sans_preuve_dimensions",
    recommendedFirstMove: isAutoHold
      ? "Verifier dimensions, fixations et compatibilite avant toute photo marketing; remplacer le produit si ce n'est pas prouvable vite."
      : "Si le produit exact est disponible: prendre les photos propres. Sinon demander la permission fournisseur documentee ou garder HOLD.",
    targetFolderPublic: action.targetFolderPublic,
    imageCount: action.imageCount,
    blockerCount: action.blockerCount,
    images,
    terrainChecklist: [
      "fond clair et lumiere stable",
      "produit entier visible sur la photo principale",
      "variante exacte confirmee avant conversion WebP",
      "pas de logo tiers ajoute ni marque visible inutile",
      "pas d'accessoires non inclus sauf contexte clairement non inclus",
      "dimensions ou caracteristiques visibles si elles conditionnent l'achat",
      "preuve droits images ou photo propre Maxi Trouvailles",
    ],
    goNoGo: {
      goReviewOnlyIf: [
        "toutes les images necessaires existent en local",
        "les droits images sont documentes",
        "la variante exacte est confirmee",
        "Mouss a valide la fiche",
      ],
      keepHoldIf,
    },
    forbidden: action.forbidden,
    sourceDecisionFile: action.decisionFile,
  };
}

function markdown(summary) {
  const rows = summary.products.map(
    (product) =>
      `| ${product.rank} | ${mdCell(product.productName)} | ${mdCell(product.fieldPriority)} | ${product.imageCount} | ${mdCell(product.recommendedFirstMove)} |`,
  );

  return `${[
    "# Maxi Trouvailles - Checklist terrain images sprint",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Produits checklist: ${summary.productCount}`,
    `- Images a verifier/photographier: ${summary.imageCount}`,
    `- Priorite photo rapide: ${summary.priorityPhotoCount}`,
    `- Maintien HOLD/remplacement: ${summary.holdOrReplaceCount}`,
    "- Action catalogue: aucune",
    "- Images generees: aucune",
    "",
    "## Actions terrain",
    "",
    "| Rang | Produit | Priorite | Images | Premier mouvement |",
    "|---:|---|---|---:|---|",
    ...rows,
    "",
    "## Regle terrain",
    "",
    "Si l'image ne prouve pas exactement le produit vendu, elle ne sert pas a la fiche produit. On garde HOLD.",
    "",
    "## Sources",
    "",
    `- Actions images sprint: ${summary.sources.actionBoardPath}`,
    `- Manifeste images: ${summary.sources.manifestPath}`,
    "",
  ].join("\n")}\n`;
}

function printChecklist(summary) {
  const sections = summary.products.map((product) => {
    const shots = product.images.map(
      (image) => `- [ ] ${image.role}: ${image.requiredShot} -> ${image.targetPublicUrl}`,
    );
    return [
      `## ${product.rank}. ${product.productName}`,
      "",
      `Priorite: ${product.fieldPriority}`,
      `Premier mouvement: ${product.recommendedFirstMove}`,
      "",
      "Photos / preuves:",
      "",
      ...shots,
      "",
      "A cocher avant revue:",
      "",
      "- [ ] variante exacte confirmee",
      "- [ ] droits images ou photo propre confirmes",
      "- [ ] fichiers WebP locaux crees",
      "- [ ] correspondance visuelle prouvee",
      "- [ ] validation Mouss",
      "",
      "Rester HOLD si un point est douteux.",
      "",
    ].join("\n");
  });

  return `${[
    "# Checklist terrain a imprimer - Images sprint Maxi Trouvailles",
    "",
    "Aucune publication, aucun paiement, aucune commande fournisseur. Cette checklist sert seulement a collecter les preuves images.",
    "",
    ...sections,
  ].join("\n")}\n`;
}

function productCard(product) {
  const imageRows = product.images.map(
    (image) =>
      `| ${image.index} | ${mdCell(image.role)} | ${mdCell(image.requiredShot)} | ${mdCell(image.targetPublicUrl)} |`,
  );

  return `${[
    `# Checklist terrain - ${product.productName}`,
    "",
    `Priorite: ${product.fieldPriority}`,
    `Mode: ${product.actionMode}`,
    `Premier mouvement: ${product.recommendedFirstMove}`,
    "",
    "## Photos / preuves",
    "",
    "| # | Role | A faire | Cible locale |",
    "|---:|---|---|---|",
    ...imageRows,
    "",
    "## Checklist terrain",
    "",
    ...product.terrainChecklist.map((item) => `- [ ] ${item}`),
    "",
    "## GO / HOLD",
    "",
    "GO revue seulement si:",
    "",
    ...product.goNoGo.goReviewOnlyIf.map((item) => `- [ ] ${item}`),
    "",
    "Garder HOLD si:",
    "",
    ...product.goNoGo.keepHoldIf.map((item) => `- ${item}`),
    "",
  ].join("\n")}\n`;
}

function csv(summary) {
  const headers = [
    "rank",
    "productId",
    "productName",
    "priorityLane",
    "fieldPriority",
    "imageIndex",
    "role",
    "requiredShot",
    "targetPublicUrl",
  ];
  const rows = summary.products.flatMap((product) =>
    product.images.map((image) => ({
      rank: product.rank,
      productId: product.productId,
      productName: product.productName,
      priorityLane: product.priorityLane,
      fieldPriority: product.fieldPriority,
      imageIndex: image.index,
      role: image.role,
      requiredShot: image.requiredShot,
      targetPublicUrl: image.targetPublicUrl,
    })),
  );

  return `${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
    .join("\n")}\n`;
}

const actionBoardPath = latestFile("ACTIONS_IMAGES_SPRINT_", "ACTIONS_IMAGES_SPRINT_*.json");
const manifestPath = latestFile("MANIFEST_REMPLACEMENT_IMAGES_SPRINT_", "MANIFEST_REMPLACEMENT_IMAGES_SPRINT_*.json");
const actionBoard = readJson(actionBoardPath);
const manifest = readJson(manifestPath);
const manifestById = new Map((manifest.products ?? []).map((product) => [product.id, product]));

const products = (actionBoard.actions ?? []).map((action) => {
  const manifestProduct = manifestById.get(action.productId);
  if (!manifestProduct) {
    throw new Error(`Missing manifest product for ${action.productId}`);
  }
  return buildChecklist(action, manifestProduct);
});

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `checklist-terrain-images-sprint-${dateKey}`);
const cardsDir = path.join(outputDir, "fiches-terrain");
fs.mkdirSync(cardsDir, { recursive: true });

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_sprint_image_field_checklist",
  productCount: products.length,
  imageCount: products.reduce((sum, product) => sum + product.imageCount, 0),
  priorityPhotoCount: products.filter((product) => product.actionMode === "PHOTO_OR_RIGHTS_FIRST").length,
  holdOrReplaceCount: products.filter((product) => product.actionMode === "HOLD_OR_REPLACE_FIRST").length,
  products,
  sources: {
    actionBoardPath,
    manifestPath,
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

const jsonPath = path.join(outputDir, `CHECKLIST_TERRAIN_IMAGES_SPRINT_${dateKey}.json`);
const mdPath = path.join(outputDir, `CHECKLIST_TERRAIN_IMAGES_SPRINT_${dateKey}.md`);
const csvPath = path.join(outputDir, `CHECKLIST_TERRAIN_IMAGES_SPRINT_${dateKey}.csv`);
const printPath = path.join(outputDir, `A_IMPRIMER_CHECKLIST_PHOTOS_SPRINT_${dateKey}.md`);

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
      imageCount: summary.imageCount,
      priorityPhotoCount: summary.priorityPhotoCount,
      holdOrReplaceCount: summary.holdOrReplaceCount,
      files: {
        jsonPath,
        mdPath,
        csvPath,
        printPath,
        cardsDir,
      },
      products: products.map((product) => ({
        rank: product.rank,
        productId: product.productId,
        productName: product.productName,
        fieldPriority: product.fieldPriority,
        actionMode: product.actionMode,
      })),
      safety: summary.safety,
    },
    null,
    2,
  ),
);

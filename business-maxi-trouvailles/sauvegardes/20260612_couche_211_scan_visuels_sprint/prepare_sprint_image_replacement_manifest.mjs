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
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function replacementOptions(product) {
  const hasAutoRisk = product.categoryId === "dropshipping-auto-moto";
  return [
    {
      value: "own_photo",
      label: "Photo propre Maxi Trouvailles",
      allowedForProductGallery: true,
      proofRequired: "photo prise du produit exact ou echantillon exact, variante confirmee",
      notes: "Option la plus propre si un exemplaire physique est disponible.",
    },
    {
      value: "supplier_permission_local_mirror",
      label: "Rapatriement fournisseur avec droits",
      allowedForProductGallery: true,
      proofRequired: "permission/licence image explicite, variante exacte, fichier local WebP",
      notes: "Autorise seulement si les droits images sont prouves et documentes.",
    },
    {
      value: "licensed_exact_stock",
      label: "Image licencee du produit exact",
      allowedForProductGallery: true,
      proofRequired: "licence valide et preuve que l'image montre exactement le produit/variante",
      notes: "Rare; refuser si l'image est seulement similaire.",
    },
    {
      value: "generated_lifestyle_only",
      label: "Visuel genere non catalogue",
      allowedForProductGallery: false,
      proofRequired: "utilisable uniquement pour bannieres ou contenu marketing non fiche produit",
      notes: "Interdit pour la galerie produit: risque de montrer un article approximatif.",
    },
    {
      value: "replace_product",
      label: "Remplacer le produit",
      allowedForProductGallery: false,
      proofRequired: "nouveau produit/fournisseur avec images exactes et droits plus simples",
      notes: hasAutoRisk
        ? "Option serieuse si les dimensions/fixations auto ne sont pas prouvables."
        : "Option utile si les droits fournisseur ne sont pas validables.",
    },
    {
      value: "keep_hold",
      label: "Garder HOLD",
      allowedForProductGallery: false,
      proofRequired: "aucune publication tant que les preuves restent manquantes",
      notes: "Choix par defaut tant que rien n'est prouve.",
    },
  ];
}

function briefFor(product, targetImage) {
  const name = normalizeText(product.name);
  const common = [
    "fond clair, propre, sans logo tiers ajoute",
    "produit entier visible, cadrage e-commerce",
    "pas d'accessoire trompeur si non inclus",
    "photo ou image strictement conforme a la variante vendue",
  ];

  if (name.includes("pochette")) {
    return [
      ...common,
      targetImage.role === "main"
        ? "pochette zippée organisateur câbles, vue produit principale"
        : "detail compartiments, fermeture, rangement cables ou dimensions reelles",
    ];
  }
  if (name.includes("support pc")) {
    return [
      ...common,
      targetImage.role === "main"
        ? "support ordinateur portable aluminium pliant seul, angle 3/4"
        : "detail pliage, reglages, patins, dimensions ou usage avec ordinateur",
    ];
  }
  if (name.includes("filet") || name.includes("coffre")) {
    return [
      ...common,
      targetImage.role === "main"
        ? "filet ou sangles de coffre voiture exacts, produit seul"
        : "detail fixation, dimensions, mise en place coffre, sans promettre compatibilite universelle",
    ];
  }

  return common;
}

function manifestImage(product, gateProduct, targetImage) {
  return {
    index: targetImage.index,
    role: targetImage.role,
    currentSupplierUrl: gateProduct.supplierDomainImages[targetImage.index - 1]?.url ?? "",
    currentSupplierHost: gateProduct.supplierDomainImages[targetImage.index - 1]?.host ?? "",
    targetPublicUrl: targetImage.targetPublicUrl,
    targetAbsolutePath: targetImage.targetAbsolutePath ?? "",
    alt: (targetImage.alt ?? `${product.name} - ${targetImage.role} Maxi Trouvailles`).replace(
      /Maxi Trouvaille\b/g,
      "Maxi Trouvailles",
    ),
    currentGate: targetImage.exists ? "file_exists_needs_review" : "missing_local_file_hold",
    recommendedDefault: "keep_hold",
    allowedModes: ["own_photo", "supplier_permission_local_mirror", "licensed_exact_stock", "keep_hold"],
    forbiddenModesForGallery: ["generated_lifestyle_only"],
    replacementBrief: briefFor(product, targetImage),
    formToFill: {
      selectedMode: "",
      checkedAt: "",
      exactVariantConfirmed: "",
      sourceOrPhotoOwner: "",
      rightsProof: "",
      localFileCreated: "",
      visualMatchProof: "",
      notes: "",
      finalDecision: "HOLD",
      reviewedByMouss: false,
    },
  };
}

function productManifest(planProduct, gateProduct) {
  const options = replacementOptions(planProduct);
  const images = planProduct.targetImages.map((image) => manifestImage(planProduct, gateProduct, image));
  return {
    shortlistRank: planProduct.shortlistRank,
    id: planProduct.id,
    name: planProduct.name,
    categoryId: planProduct.categoryId,
    currentReviewGateStatus: gateProduct.reviewGateStatus,
    replacementStatus: "HOLD_REPLACEMENT_DECISION_REQUIRED",
    defaultDecision: "keep_hold",
    recommendedPath:
      "Priorite: photo propre ou permission fournisseur documentee. Image generee interdite pour galerie produit exacte.",
    imageCount: images.length,
    supplierDomainImageCount: gateProduct.supplierDomainImageCount,
    missingLocalTargetCount: gateProduct.missingLocalTargetCount,
    options,
    images,
    productLevelFormToFill: {
      productId: planProduct.id,
      productName: planProduct.name,
      chosenGlobalMode: "",
      variantExacte: "",
      droitsImagesDecision: "",
      remplacementProduitSiNonValidable: "",
      finalDecision: "HOLD",
      reviewedByMouss: false,
    },
    safety: {
      noImageGenerationForProductGallery: true,
      noDownload: true,
      noCatalogWrite: true,
      noPublication: true,
      noPayment: true,
      noSupplierOrder: true,
    },
  };
}

function csv(products) {
  const rows = products.flatMap((product) =>
    product.images.map((image) => ({
      productRank: product.shortlistRank,
      productId: product.id,
      productName: product.name,
      imageIndex: image.index,
      role: image.role,
      recommendedDefault: image.recommendedDefault,
      targetPublicUrl: image.targetPublicUrl,
      forbiddenModesForGallery: image.forbiddenModesForGallery,
      currentGate: image.currentGate,
    })),
  );
  const headers = [
    "productRank",
    "productId",
    "productName",
    "imageIndex",
    "role",
    "recommendedDefault",
    "targetPublicUrl",
    "forbiddenModesForGallery",
    "currentGate",
  ];

  return `${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
    .join("\n")}\n`;
}

function cardMarkdown(product) {
  const rows = product.images.map(
    (image) =>
      `| ${image.index} | ${mdCell(image.role)} | ${mdCell(image.recommendedDefault)} | ${mdCell(image.targetPublicUrl)} | ${mdCell(image.forbiddenModesForGallery.join(", "))} |`,
  );

  return `${[
    `# Manifeste remplacement images - ${product.name}`,
    "",
    `Rang sprint: ${product.shortlistRank}`,
    `Produit: ${product.id}`,
    `Statut remplacement: ${product.replacementStatus}`,
    "",
    "## Regle cle",
    "",
    "Une image generee ou seulement similaire ne doit pas servir de photo principale ou de galerie produit. Elle peut servir uniquement a du marketing non catalogue si elle ne promet pas le produit exact.",
    "",
    "## Options",
    "",
    ...product.options.map(
      (option) =>
        `- ${option.value}: ${option.allowedForProductGallery ? "autorise galerie si preuves remplies" : "non autorise galerie"} - ${option.notes}`,
    ),
    "",
    "## Images",
    "",
    "| # | Role | Defaut | Cible locale | Interdit galerie |",
    "|---:|---|---|---|---|",
    ...rows,
    "",
    "## Bloc produit a remplir",
    "",
    "```json",
    JSON.stringify(product.productLevelFormToFill, null, 2),
    "```",
    "",
  ].join("\n")}\n`;
}

function markdown(summary) {
  const rows = summary.products.map(
    (product) =>
      `| ${product.shortlistRank} | ${mdCell(product.name)} | ${product.imageCount} | ${product.supplierDomainImageCount} | ${product.missingLocalTargetCount} | ${mdCell(product.replacementStatus)} | ${mdCell(product.defaultDecision)} |`,
  );

  return `${[
    "# Maxi Trouvailles - Manifeste remplacement images sprint",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Produits: ${summary.productCount}`,
    `- Images a traiter: ${summary.imageCount}`,
    `- Images fournisseur actuelles: ${summary.supplierDomainImageCount}`,
    `- Decisions remplacement requises: ${summary.replacementDecisionCount}`,
    "- Action appliquee au catalogue: aucune",
    "- Images generees: aucune",
    "",
    "## Tableau",
    "",
    "| Rang | Produit | Images | Fournisseur | Locales manquantes | Statut | Defaut |",
    "|---:|---|---:|---:|---:|---|---|",
    ...rows,
    "",
    "## Politique image produit",
    "",
    "- Photo propre du produit exact: OK si variante confirmee.",
    "- Rapatriement fournisseur: OK uniquement avec droits images documentes.",
    "- Image licencee: OK uniquement si produit et variante exactement identiques.",
    "- Image generee: interdite pour photo principale et galerie produit exacte.",
    "- Si aucune option n'est prouvable: produit reste HOLD ou doit etre remplace.",
    "",
    "## Sources",
    "",
    `- Audit gates images: ${summary.sources.auditPath}`,
    `- Plan local images: ${summary.sources.localPlanPath}`,
    "",
  ].join("\n")}\n`;
}

const auditPath = latestFile("AUDIT_GATES_IMAGES_SPRINT_", "AUDIT_GATES_IMAGES_SPRINT_*.json");
const localPlanPath = latestFile("PLAN_LOCAL_IMAGES_SPRINT_", "PLAN_LOCAL_IMAGES_SPRINT_*.json");
const audit = readJson(auditPath);
const localPlan = readJson(localPlanPath);
const auditById = new Map((audit.products ?? []).map((product) => [product.id, product]));
const planProducts = Array.isArray(localPlan.products) ? localPlan.products : [];

if (planProducts.length === 0) {
  throw new Error("Local image plan must contain products.");
}

const products = planProducts.map((product) => {
  const gateProduct = auditById.get(product.id);
  if (!gateProduct) {
    throw new Error(`Missing gate audit for ${product.id}`);
  }
  return productManifest(product, gateProduct);
});

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `manifest-remplacement-images-sprint-${dateKey}`);
const cardsDir = path.join(outputDir, "fiches-remplacement");
fs.mkdirSync(cardsDir, { recursive: true });

for (const product of products) {
  const fileName = `${String(product.shortlistRank).padStart(2, "0")}-${slugify(product.name)}.md`;
  fs.writeFileSync(path.join(cardsDir, fileName), cardMarkdown(product), "utf8");
}

const fillTemplate = {
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  instructions:
    "Remplir une decision image reelle. Ne pas utiliser d'image generee comme photo produit exacte. Garder finalDecision a HOLD avant validation explicite.",
  products: products.map((product) => ({
    productId: product.id,
    productName: product.name,
    productLevelFormToFill: product.productLevelFormToFill,
    images: product.images.map((image) => ({
      index: image.index,
      role: image.role,
      targetPublicUrl: image.targetPublicUrl,
      formToFill: image.formToFill,
    })),
  })),
  safety: {
    noImageGenerationForProductGallery: true,
    noDownload: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

const summary = {
  ok: true,
  generatedAt: fillTemplate.generatedAt,
  generatedAtLocal: localLabel,
  mode: "read_only_sprint_image_replacement_manifest",
  productCount: products.length,
  imageCount: products.reduce((sum, product) => sum + product.imageCount, 0),
  supplierDomainImageCount: products.reduce((sum, product) => sum + product.supplierDomainImageCount, 0),
  replacementDecisionCount: products.reduce((sum, product) => sum + product.images.length, 0),
  products,
  sources: {
    auditPath,
    localPlanPath,
  },
  files: {
    outputDir,
    cardsDir,
    fillTemplatePath: path.join(outputDir, `A_REMPLIR_DECISIONS_REMPLACEMENT_IMAGES_${dateKey}.json`),
  },
  safety: fillTemplate.safety,
};

const jsonPath = path.join(outputDir, `MANIFEST_REMPLACEMENT_IMAGES_SPRINT_${dateKey}.json`);
const mdPath = path.join(outputDir, `MANIFEST_REMPLACEMENT_IMAGES_SPRINT_${dateKey}.md`);
const csvPath = path.join(outputDir, `MANIFEST_REMPLACEMENT_IMAGES_SPRINT_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(products), "utf8");
fs.writeFileSync(summary.files.fillTemplatePath, `${JSON.stringify(fillTemplate, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      productCount: summary.productCount,
      imageCount: summary.imageCount,
      supplierDomainImageCount: summary.supplierDomainImageCount,
      replacementDecisionCount: summary.replacementDecisionCount,
      files: {
        jsonPath,
        mdPath,
        csvPath,
        fillTemplatePath: summary.files.fillTemplatePath,
        cardsDir,
      },
      products: products.map((product) => ({
        rank: product.shortlistRank,
        id: product.id,
        name: product.name,
        replacementStatus: product.replacementStatus,
        defaultDecision: product.defaultDecision,
      })),
      safety: summary.safety,
    },
    null,
    2,
  ),
);

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

function latestImageProofFile() {
  const matches = collectFiles(
    actionRoot,
    (name) => name.startsWith("PREUVES_IMAGES_SPRINT_") && name.endsWith(".json"),
  )
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (matches.length === 0) {
    throw new Error(`No PREUVES_IMAGES_SPRINT_*.json found under ${actionRoot}`);
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

function galleryRole(index) {
  if (index === 1) return "main";
  if (index === 2) return "detail";
  if (index === 3) return "usage";
  if (index === 4) return "dimensions";
  return `detail-${index}`;
}

function targetImage(product, image, dateKey) {
  const productSlug = slugify(product.name);
  const role = galleryRole(image.index);
  const fileName = `${String(image.index).padStart(2, "0")}-${productSlug}-${role}.webp`;
  const publicUrl = `/uploads/partner-products/sprint-go-humain-${dateKey}/${productSlug}/${fileName}`;
  const absolutePath = path.join(root, "public", publicUrl.replace(/^\//, ""));
  const exists = fs.existsSync(absolutePath);
  const stat = exists ? fs.statSync(absolutePath) : null;

  return {
    index: image.index,
    role,
    currentUrl: image.url,
    currentHostname: image.hostname,
    targetPublicUrl: publicUrl,
    targetAbsolutePath: absolutePath,
    exists,
    sizeBytes: stat?.size ?? null,
    ready: exists && (stat?.size ?? 0) >= 5000,
    alt: `${product.name} - ${role} Maxi Trouvaille`,
    validationStatus: exists ? "file_exists_needs_visual_review" : "missing_local_file_hold",
  };
}

function productPlan(product, dateKey) {
  const targetImages = product.images.map((image) => targetImage(product, image, dateKey));
  const missingCount = targetImages.filter((image) => !image.exists).length;
  const notReadyCount = targetImages.filter((image) => !image.ready).length;
  const status = notReadyCount === 0 ? "LOCAL_IMAGES_READY_FOR_REVIEW_HOLD" : "HOLD_LOCAL_IMAGES_MISSING";

  return {
    shortlistRank: product.shortlistRank,
    id: product.id,
    name: product.name,
    categoryId: product.categoryId,
    status,
    sourceStatusImageProof: product.statusImageProof,
    requiredImageCount: targetImages.length,
    missingLocalImageCount: missingCount,
    notReadyImageCount: notReadyCount,
    targetFolderPublic: `/uploads/partner-products/sprint-go-humain-${dateKey}/${slugify(product.name)}/`,
    targetFolderAbsolute: path.join(
      root,
      "public",
      "uploads",
      "partner-products",
      `sprint-go-humain-${dateKey}`,
      slugify(product.name),
    ),
    targetImages,
    expectedVisualTraits: product.expectedVisualTraits,
    validationBeforeCatalogUpdate: [
      "image exacte pour la variante vendue",
      "aucun logo/marque trompeuse",
      "format WebP optimise",
      "image visible sans domaine fournisseur cote client",
      "droits images ou decision de remplacement remplis",
      "Mouss valide avant toute modification catalogue",
    ],
    safety: {
      noDownload: true,
      noCatalogWrite: true,
      noPublication: true,
      noPayment: true,
      noSupplierOrder: true,
    },
  };
}

function csv(plans) {
  const rows = plans.flatMap((plan) =>
    plan.targetImages.map((image) => ({
      productRank: plan.shortlistRank,
      productId: plan.id,
      productName: plan.name,
      imageIndex: image.index,
      role: image.role,
      currentHostname: image.currentHostname,
      targetPublicUrl: image.targetPublicUrl,
      exists: image.exists,
      ready: image.ready,
      alt: image.alt,
      validationStatus: image.validationStatus,
    })),
  );
  const headers = [
    "productRank",
    "productId",
    "productName",
    "imageIndex",
    "role",
    "currentHostname",
    "targetPublicUrl",
    "exists",
    "ready",
    "alt",
    "validationStatus",
  ];

  return `${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
    .join("\n")}\n`;
}

function cardMarkdown(plan) {
  const rows = plan.targetImages.map(
    (image) =>
      `| ${image.index} | ${mdCell(image.role)} | ${image.exists ? "oui" : "non"} | ${image.ready ? "oui" : "non"} | ${mdCell(image.targetPublicUrl)} | ${mdCell(image.alt)} |`,
  );

  return `${[
    `# Plan images locales - ${plan.name}`,
    "",
    `Rang sprint: ${plan.shortlistRank}`,
    `Produit: ${plan.id}`,
    `Statut local: ${plan.status}`,
    `Dossier cible: ${plan.targetFolderPublic}`,
    "",
    "## Images cibles",
    "",
    "| # | Role | Existe | Pret | URL cible | Alt SEO |",
    "|---:|---|---|---|---|---|",
    ...rows,
    "",
    "## Traits visuels a respecter",
    "",
    ...plan.expectedVisualTraits.map((trait) => `- ${trait}`),
    "",
    "## Avant modification catalogue",
    "",
    ...plan.validationBeforeCatalogUpdate.map((item) => `- [ ] ${item}`),
    "",
    "## Regle",
    "",
    "Ne pas telecharger ou reutiliser une image fournisseur sans decision droits images. Si les images sont remplacees par des visuels propres, garder le produit en HOLD jusqu'a revue humaine.",
    "",
  ].join("\n")}\n`;
}

function markdown(summary) {
  const rows = summary.products.map(
    (plan) =>
      `| ${plan.shortlistRank} | ${mdCell(plan.name)} | ${plan.requiredImageCount} | ${plan.missingLocalImageCount} | ${mdCell(plan.status)} | ${mdCell(plan.targetFolderPublic)} |`,
  );

  return `${[
    "# Maxi Trouvailles - Plan images locales sprint",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Produits planifies: ${summary.productCount}`,
    `- Images cibles: ${summary.targetImageCount}`,
    `- Fichiers locaux manquants: ${summary.missingLocalImageCount}`,
    "- Action appliquee au catalogue: aucune",
    "- Telechargements effectues: aucun",
    "",
    "## Tableau",
    "",
    "| Rang | Produit | Images cibles | Manquantes | Statut | Dossier cible |",
    "|---:|---|---:|---:|---|---|",
    ...rows,
    "",
    "## Specifications images",
    "",
    "- Format cible: WebP.",
    "- Nom de fichier stable et SEO.",
    "- Image principale en slot 01.",
    "- Images secondaires dans l'ordre galerie.",
    "- Pas de domaine fournisseur visible cote client.",
    "- Produit maintenu HOLD tant que les fichiers ne sont pas presents et valides.",
    "",
    "## Sources",
    "",
    `- Preuves images: ${summary.sources.imageProofPath}`,
    "",
  ].join("\n")}\n`;
}

const imageProofPath = latestImageProofFile();
const imageProof = readJson(imageProofPath);
const products = Array.isArray(imageProof.products) ? imageProof.products : [];

if (products.length === 0) {
  throw new Error("Image proof file must contain a non-empty products array.");
}

const { dateKey, localLabel } = datePartsParis();
const plans = products.map((product) => productPlan(product, dateKey));
const outputDir = path.join(actionRoot, `plan-local-images-sprint-${dateKey}`);
const cardsDir = path.join(outputDir, "fiches-localisation");
fs.mkdirSync(cardsDir, { recursive: true });

for (const plan of plans) {
  const fileName = `${String(plan.shortlistRank).padStart(2, "0")}-${slugify(plan.name)}.md`;
  fs.writeFileSync(path.join(cardsDir, fileName), cardMarkdown(plan), "utf8");
}

const manifest = {
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  instructions:
    "Plan de localisation uniquement. Ne pas modifier le catalogue tant que les fichiers, droits images et validation Mouss ne sont pas remplis.",
  products: plans.map((plan) => ({
    productId: plan.id,
    productName: plan.name,
    status: plan.status,
    targetFolderPublic: plan.targetFolderPublic,
    targetFolderAbsolute: plan.targetFolderAbsolute,
    images: plan.targetImages,
  })),
  safety: {
    noDownload: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

const summary = {
  ok: true,
  generatedAt: manifest.generatedAt,
  generatedAtLocal: localLabel,
  mode: "read_only_sprint_image_localization_plan",
  productCount: plans.length,
  targetImageCount: plans.reduce((sum, plan) => sum + plan.requiredImageCount, 0),
  missingLocalImageCount: plans.reduce((sum, plan) => sum + plan.missingLocalImageCount, 0),
  products: plans,
  sources: {
    imageProofPath,
  },
  files: {
    outputDir,
    cardsDir,
    manifestPath: path.join(outputDir, `MANIFEST_IMAGES_LOCALES_A_REMPLIR_${dateKey}.json`),
  },
  safety: manifest.safety,
};

const jsonPath = path.join(outputDir, `PLAN_LOCAL_IMAGES_SPRINT_${dateKey}.json`);
const mdPath = path.join(outputDir, `PLAN_LOCAL_IMAGES_SPRINT_${dateKey}.md`);
const csvPath = path.join(outputDir, `PLAN_LOCAL_IMAGES_SPRINT_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(plans), "utf8");
fs.writeFileSync(summary.files.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      productCount: summary.productCount,
      targetImageCount: summary.targetImageCount,
      missingLocalImageCount: summary.missingLocalImageCount,
      files: {
        jsonPath,
        mdPath,
        csvPath,
        manifestPath: summary.files.manifestPath,
        cardsDir,
      },
      products: plans.map((plan) => ({
        rank: plan.shortlistRank,
        id: plan.id,
        name: plan.name,
        status: plan.status,
        missingLocalImageCount: plan.missingLocalImageCount,
        targetFolderPublic: plan.targetFolderPublic,
      })),
      safety: summary.safety,
    },
    null,
    2,
  ),
);

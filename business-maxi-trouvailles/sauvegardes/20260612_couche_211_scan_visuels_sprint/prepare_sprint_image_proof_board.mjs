import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessDir = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessDir, "tableaux-action");
const quickProductsPath = path.join(root, "data", "quick-products.json");

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
    .slice(0, 80);
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

function latestShortlistFile() {
  const matches = collectFiles(
    actionRoot,
    (name) => name.startsWith("SHORTLIST_GO_HUMAIN_PARTENAIRES_") && name.endsWith(".json"),
  )
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (matches.length === 0) {
    throw new Error(`No SHORTLIST_GO_HUMAIN_PARTENAIRES_*.json found under ${actionRoot}`);
  }

  return matches[0].fullPath;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function visualTraits(productName) {
  const text = normalizeText(productName);

  if (text.includes("pochette") || text.includes("cables")) {
    return [
      "pochette zippee de rangement cables/accessoires",
      "format double couche visible ou clairement compatible avec le titre",
      "accessoires tech coherents, pas un sac generique",
      "variante couleur a confirmer avant publication",
    ];
  }
  if (text.includes("support pc")) {
    return [
      "support aluminium pliant pour ordinateur portable ou tablette",
      "reglage inclinaison/hauteur visible ou explique par la variante",
      "pas un simple plateau, pas un support telephone seul",
      "couleur/matiere exactes a confirmer avant publication",
    ];
  }
  if (text.includes("filet") || text.includes("coffre")) {
    return [
      "filet ou sangles de rangement pour coffre voiture",
      "mode de fixation visible ou documente",
      "usage coffre/accessoire auto clair, pas filet de siege ou sac different",
      "dimensions et lot exact a confirmer avant publication",
    ];
  }

  return ["produit exact visible", "variante exacte a confirmer", "aucun logo ou marque trompeuse"];
}

function imageInfo(rawUrl, index) {
  const value = String(rawUrl ?? "").trim();
  const info = {
    index,
    url: value,
    sourceType: "unknown",
    hostname: "",
    isSupplierCdn: false,
    isLocalUpload: false,
    localPath: "",
    localExists: false,
    sizeBytes: null,
    clientSafeIfPublished: false,
  };

  if (!value) {
    return info;
  }

  if (value.startsWith("/")) {
    const localPath = path.join(root, "public", value.replace(/^\//, ""));
    const exists = fs.existsSync(localPath);
    const stat = exists ? fs.statSync(localPath) : null;

    return {
      ...info,
      sourceType: "local_upload",
      isLocalUpload: true,
      localPath,
      localExists: exists,
      sizeBytes: stat?.size ?? null,
      clientSafeIfPublished: exists && (stat?.size ?? 0) > 1024,
    };
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const isSupplierCdn =
      hostname.includes("alicdn.com") ||
      hostname.includes("aliexpress.com") ||
      hostname.includes("alitools.io");

    return {
      ...info,
      sourceType: "remote_url",
      hostname,
      isSupplierCdn,
      clientSafeIfPublished: !isSupplierCdn,
    };
  } catch {
    return {
      ...info,
      sourceType: "invalid_url",
    };
  }
}

function imageBlockers(product, imageInfos) {
  const blockers = [];
  const validation = product?.imageValidation ?? {};

  if (!product) {
    return ["produit_introuvable_dans_quick_products"];
  }
  if (imageInfos.length === 0) {
    blockers.push("aucune_image_attachee");
  }
  if (imageInfos.length < 3) {
    blockers.push("moins_de_3_images_a_controler");
  }
  if (imageInfos.some((image) => image.sourceType === "remote_url")) {
    blockers.push("images_distantes_a_securiser");
  }
  if (imageInfos.some((image) => image.isSupplierCdn)) {
    blockers.push("url_image_fournisseur_visible_si_publication");
  }
  if (imageInfos.some((image) => image.isLocalUpload && !image.localExists)) {
    blockers.push("image_locale_introuvable");
  }
  if (normalizeText(validation.nextAction).includes("valider")) {
    blockers.push("variante_image_a_confirmer");
  }
  if (!validation.status || normalizeText(validation.status).includes("hold")) {
    blockers.push("preuve_image_non_finalisee");
  }

  blockers.push("droits_images_a_decider");

  return [...new Set(blockers)];
}

function toRecord(candidate, product) {
  const images = Array.isArray(product?.images) ? product.images : product?.image ? [product.image] : [];
  const imageInfos = images.map((image, index) => imageInfo(image, index + 1));
  const blockers = imageBlockers(product, imageInfos);

  return {
    shortlistRank: candidate.shortlistRank,
    id: candidate.id,
    name: candidate.name,
    categoryId: candidate.categoryId,
    status: product?.status ?? candidate.status,
    supplierUrl: product?.dropshipping?.supplierUrl ?? candidate.supplier?.url ?? "",
    sourceImageStatus: product?.imageValidation?.status ?? "a_verifier",
    sourceImageCheckedAt: product?.imageValidation?.checkedAt ?? "",
    sourceImageReason: product?.imageValidation?.reason ?? "",
    sourceImageNextAction: product?.imageValidation?.nextAction ?? "",
    imageCount: imageInfos.length,
    remoteImageCount: imageInfos.filter((image) => image.sourceType === "remote_url").length,
    supplierCdnImageCount: imageInfos.filter((image) => image.isSupplierCdn).length,
    localImageCount: imageInfos.filter((image) => image.isLocalUpload).length,
    localMissingCount: imageInfos.filter((image) => image.isLocalUpload && !image.localExists).length,
    clientSafeImageCount: imageInfos.filter((image) => image.clientSafeIfPublished).length,
    statusImageProof: blockers.length === 0 ? "image_ready_review_hold" : "HOLD_IMAGE_PROOF",
    blockers,
    expectedVisualTraits: visualTraits(candidate.name),
    images: imageInfos,
    formToFill: null,
    safety: {
      readOnly: true,
      noCatalogWrite: true,
      noPublication: true,
      noPayment: true,
      noSupplierOrder: true,
      customerMustNotSeeSupplierImageDomain: true,
    },
  };
}

function formFor(record) {
  return {
    productId: record.id,
    productName: record.name,
    checkedAt: "",
    mainImageExact: "",
    variantConfirmed: "",
    clientSafeImageDecision: "",
    imageRightsDecision: "",
    localMirrorOrReplacementNeeded: record.supplierCdnImageCount > 0,
    imageProofNotes: "",
    images: record.images.map((image) => ({
      index: image.index,
      currentUrl: image.url,
      currentSourceType: image.sourceType,
      currentHostname: image.hostname,
      exactMatch: "",
      keepForReview: "",
      localReplacementPath: "",
      issueNotes: "",
    })),
    finalDecision: "HOLD",
    reviewedByMouss: false,
  };
}

function cardMarkdown(record) {
  const imageRows = record.images.map(
    (image) =>
      `| ${image.index} | ${mdCell(image.sourceType)} | ${mdCell(image.hostname || "local")} | ${image.isSupplierCdn ? "oui" : "non"} | ${image.clientSafeIfPublished ? "oui" : "non"} | ${mdCell(image.url)} |`,
  );

  return `${[
    `# Preuves images sprint - ${record.name}`,
    "",
    `Rang shortlist: ${record.shortlistRank}`,
    `Produit: ${record.id}`,
    `Statut produit: ${record.status}`,
    `Statut image: ${record.statusImageProof}`,
    "",
    "## Blocages image",
    "",
    ...record.blockers.map((blocker) => `- ${blocker}`),
    "",
    "## Traits visuels a confirmer",
    "",
    ...record.expectedVisualTraits.map((trait) => `- ${trait}`),
    "",
    "## Images actuelles",
    "",
    "| # | Source | Domaine | Domaine fournisseur | Client safe | URL |",
    "|---:|---|---|---|---|---|",
    ...imageRows,
    "",
    "## Bloc a remplir",
    "",
    "```json",
    JSON.stringify(record.formToFill, null, 2),
    "```",
    "",
    "## Regle",
    "",
    "La fiche reste HOLD tant que les images exactes, la variante et les droits ne sont pas valides. Si une image fournisseur est conservee, elle doit etre rapatriee ou remplacee avant publication client.",
    "",
  ].join("\n")}\n`;
}

function csv(records) {
  const headers = [
    "shortlistRank",
    "id",
    "name",
    "statusImageProof",
    "imageCount",
    "remoteImageCount",
    "supplierCdnImageCount",
    "localImageCount",
    "localMissingCount",
    "blockers",
  ];

  return `${headers.join(",")}\n${records
    .map((record) => headers.map((header) => csvEscape(record[header])).join(","))
    .join("\n")}\n`;
}

function markdown(summary) {
  const rows = summary.products.map(
    (record) =>
      `| ${record.shortlistRank} | ${mdCell(record.name)} | ${record.imageCount} | ${record.supplierCdnImageCount} | ${record.localImageCount} | ${mdCell(record.statusImageProof)} | ${mdCell(record.blockers.join(", "))} |`,
  );

  return `${[
    "# Maxi Trouvailles - Preuves images sprint",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Produits sprint controles: ${summary.productCount}`,
    `- Images analysees: ${summary.imageCount}`,
    `- Images fournisseur/CDN detectees: ${summary.supplierCdnImageCount}`,
    "- Action appliquee au catalogue: aucune",
    "- Statut: HOLD pour tous les produits",
    "",
    "## Tableau",
    "",
    "| Rang | Produit | Images | CDN fournisseur | Locales | Statut image | Blocages |",
    "|---:|---|---:|---:|---:|---|---|",
    ...rows,
    "",
    "## Decision technique",
    "",
    "Ces produits ne doivent pas passer en revue humaine tant que l'image exacte, la variante et les droits ne sont pas remplis. Les images distantes fournisseur doivent etre rapatriees proprement ou remplacees avant publication client.",
    "",
    "## Fichiers a remplir",
    "",
    `- ${summary.files.templatePath}`,
    `- ${summary.files.cardsDir}`,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule.",
    "- Aucun changement catalogue.",
    "- Aucune publication.",
    "- Aucun paiement.",
    "- Aucun achat fournisseur.",
    "",
    "## Sources",
    "",
    `- Shortlist: ${summary.sources.shortlistPath}`,
    `- Produits: ${summary.sources.quickProductsPath}`,
    "",
  ].join("\n")}\n`;
}

const shortlistPath = latestShortlistFile();
const shortlist = readJson(shortlistPath);
const quickProducts = readJson(quickProductsPath);
const productsById = new Map(quickProducts.map((product) => [product.id, product]));
const evidenceSprint = Array.isArray(shortlist.evidenceSprint) ? shortlist.evidenceSprint : [];

if (evidenceSprint.length === 0) {
  throw new Error("Shortlist must contain a non-empty evidenceSprint array.");
}

const records = evidenceSprint.map((candidate) => {
  const record = toRecord(candidate, productsById.get(candidate.id));
  record.formToFill = formFor(record);
  return record;
});

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `preuves-images-sprint-${dateKey}`);
const cardsDir = path.join(outputDir, "fiches-images");
fs.mkdirSync(cardsDir, { recursive: true });

for (const record of records) {
  const fileName = `${String(record.shortlistRank).padStart(2, "0")}-${slugify(record.name)}.md`;
  fs.writeFileSync(path.join(cardsDir, fileName), cardMarkdown(record), "utf8");
}

const fillTemplate = {
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  instructions:
    "Remplir uniquement apres verification visuelle reelle. Garder finalDecision a HOLD avant validation explicite.",
  products: records.map((record) => record.formToFill),
  safety: {
    readOnly: true,
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
  mode: "read_only_sprint_image_proof_board",
  productCount: records.length,
  imageCount: records.reduce((sum, record) => sum + record.imageCount, 0),
  supplierCdnImageCount: records.reduce((sum, record) => sum + record.supplierCdnImageCount, 0),
  localImageCount: records.reduce((sum, record) => sum + record.localImageCount, 0),
  products: records,
  sources: {
    shortlistPath,
    quickProductsPath,
  },
  files: {
    outputDir,
    cardsDir,
    templatePath: path.join(outputDir, `A_REMPLIR_PREUVES_IMAGES_SPRINT_${dateKey}.json`),
  },
  safety: fillTemplate.safety,
};

const jsonPath = path.join(outputDir, `PREUVES_IMAGES_SPRINT_${dateKey}.json`);
const mdPath = path.join(outputDir, `PREUVES_IMAGES_SPRINT_${dateKey}.md`);
const csvPath = path.join(outputDir, `PREUVES_IMAGES_SPRINT_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(records), "utf8");
fs.writeFileSync(summary.files.templatePath, `${JSON.stringify(fillTemplate, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      productCount: summary.productCount,
      imageCount: summary.imageCount,
      supplierCdnImageCount: summary.supplierCdnImageCount,
      localImageCount: summary.localImageCount,
      files: {
        jsonPath,
        mdPath,
        csvPath,
        templatePath: summary.files.templatePath,
        cardsDir,
      },
      products: records.map((record) => ({
        rank: record.shortlistRank,
        id: record.id,
        name: record.name,
        statusImageProof: record.statusImageProof,
        blockers: record.blockers,
      })),
      safety: summary.safety,
    },
    null,
    2,
  ),
);

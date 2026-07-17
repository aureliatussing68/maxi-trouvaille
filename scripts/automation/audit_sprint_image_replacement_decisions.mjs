import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessDir = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessDir, "tableaux-action");

const allowedImageFinalDecisions = new Set(["HOLD", "READY_REVIEW_HOLD", "REPLACE_PRODUCT_HOLD"]);
const allowedProductFinalDecisions = new Set(["HOLD", "READY_REVIEW_HOLD", "REPLACE_PRODUCT_HOLD"]);
const readyGalleryModes = new Set(["own_photo", "supplier_permission_local_mirror", "licensed_exact_stock"]);
const knownModes = new Set([
  "own_photo",
  "supplier_permission_local_mirror",
  "licensed_exact_stock",
  "generated_lifestyle_only",
  "replace_product",
  "keep_hold",
]);

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

function text(value) {
  return String(value ?? "").trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function truthyHuman(value) {
  if (value === true) {
    return true;
  }
  return /^(oui|yes|true|confirme|confirm[eé]|valid[eé]|ok)$/i.test(text(value));
}

function csvEscape(value) {
  const normalized = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${normalized.replace(/"/g, '""')}"`;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function absoluteFromPublicUrl(publicUrl) {
  const cleanUrl = text(publicUrl);
  if (!cleanUrl.startsWith("/")) {
    return "";
  }

  return path.join(root, "public", cleanUrl.replace(/^\//, ""));
}

function hasLocalFile(manifestImage, form) {
  const candidatePaths = [
    text(manifestImage.targetAbsolutePath),
    absoluteFromPublicUrl(manifestImage.targetPublicUrl),
    absoluteFromPublicUrl(form.localFileCreated),
    text(form.localFileCreated),
  ].filter(Boolean);

  return candidatePaths.some((candidate) => fs.existsSync(candidate));
}

function auditImage(product, manifestImage, filledImage) {
  const form = filledImage?.formToFill ?? {};
  const selectedMode = lower(form.selectedMode);
  const finalDecision = text(form.finalDecision || "HOLD").toUpperCase();
  const failures = [];
  const blockers = [];

  if (!allowedImageFinalDecisions.has(finalDecision)) {
    failures.push("decision_finale_image_invalide");
  }

  if (selectedMode && !knownModes.has(selectedMode)) {
    failures.push("mode_image_inconnu");
  }

  if (selectedMode === "generated_lifestyle_only" && finalDecision !== "HOLD") {
    failures.push("image_generee_interdite_en_galerie_produit");
  }

  if (finalDecision === "READY_REVIEW_HOLD") {
    if (!readyGalleryModes.has(selectedMode)) {
      failures.push("mode_image_non_autorise_pour_revue_galerie");
    }
    if (!text(form.checkedAt)) {
      failures.push("date_verification_absente");
    }
    if (!truthyHuman(form.exactVariantConfirmed)) {
      failures.push("variante_exacte_non_confirmee");
    }
    if (!text(form.sourceOrPhotoOwner)) {
      failures.push("source_ou_proprietaire_image_absent");
    }
    if (!text(form.rightsProof)) {
      failures.push("preuve_droits_images_absente");
    }
    if (!text(form.localFileCreated)) {
      failures.push("fichier_local_declare_absent");
    }
    if (!hasLocalFile(manifestImage, form)) {
      failures.push("fichier_local_introuvable");
    }
    if (!text(form.visualMatchProof)) {
      failures.push("preuve_correspondance_visuelle_absente");
    }
    if (!truthyHuman(form.reviewedByMouss)) {
      failures.push("validation_mouss_absente");
    }
  } else {
    if (!selectedMode || selectedMode === "keep_hold") {
      blockers.push("decision_image_humaine_absente");
    }
    if (!hasLocalFile(manifestImage, form)) {
      blockers.push("fichier_local_absent");
    }
    if (!text(form.rightsProof)) {
      blockers.push("preuve_droits_images_absente");
    }
    if (!truthyHuman(form.exactVariantConfirmed)) {
      blockers.push("variante_exacte_non_confirmee");
    }
  }

  const status = failures.length
    ? "BLOCK_INVALID_IMAGE_DECISION"
    : finalDecision === "READY_REVIEW_HOLD"
      ? "READY_REVIEW_HOLD"
      : "HOLD_DECISION_NOT_READY";

  return {
    productId: product.productId,
    productName: product.productName,
    imageIndex: manifestImage.index,
    role: manifestImage.role,
    targetPublicUrl: manifestImage.targetPublicUrl,
    selectedMode,
    finalDecision,
    reviewedByMouss: Boolean(form.reviewedByMouss),
    localFileExists: hasLocalFile(manifestImage, form),
    status,
    failures,
    blockers,
  };
}

function auditProduct(manifestProduct, filledProduct) {
  const form = filledProduct?.productLevelFormToFill ?? {};
  const finalDecision = text(form.finalDecision || "HOLD").toUpperCase();
  const chosenGlobalMode = lower(form.chosenGlobalMode);
  const failures = [];
  const blockers = [];

  if (!allowedProductFinalDecisions.has(finalDecision)) {
    failures.push("decision_finale_produit_invalide");
  }
  if (chosenGlobalMode && !knownModes.has(chosenGlobalMode)) {
    failures.push("mode_global_inconnu");
  }
  if (chosenGlobalMode === "generated_lifestyle_only" && finalDecision !== "HOLD") {
    failures.push("mode_global_image_generee_interdit");
  }

  const filledImagesByIndex = new Map((filledProduct?.images ?? []).map((image) => [Number(image.index), image]));
  const images = manifestProduct.images.map((manifestImage) =>
    auditImage(filledProduct, manifestImage, filledImagesByIndex.get(Number(manifestImage.index))),
  );

  if (finalDecision === "READY_REVIEW_HOLD") {
    if (!truthyHuman(form.reviewedByMouss)) {
      failures.push("validation_mouss_produit_absente");
    }
    if (!text(form.variantExacte)) {
      failures.push("variante_produit_absente");
    }
    if (!text(form.droitsImagesDecision)) {
      failures.push("decision_droits_images_produit_absente");
    }
    if (images.some((image) => image.status !== "READY_REVIEW_HOLD")) {
      failures.push("images_non_toutes_pretes");
    }
  } else if (finalDecision === "REPLACE_PRODUCT_HOLD") {
    if (!text(form.remplacementProduitSiNonValidable)) {
      blockers.push("piste_remplacement_produit_absente");
    }
  } else {
    blockers.push("decision_produit_reste_hold");
  }

  const imageFailures = images.flatMap((image) => image.failures);
  const imageBlockers = images.flatMap((image) => image.blockers);
  const status =
    failures.length || imageFailures.length
      ? "BLOCK_INVALID_REPLACEMENT_DECISION"
      : finalDecision === "READY_REVIEW_HOLD"
        ? "READY_REVIEW_HOLD"
        : "HOLD_DECISIONS_NOT_READY";

  return {
    productId: manifestProduct.id,
    productName: manifestProduct.name,
    finalDecision,
    chosenGlobalMode,
    status,
    imageCount: images.length,
    readyImageCount: images.filter((image) => image.status === "READY_REVIEW_HOLD").length,
    holdImageCount: images.filter((image) => image.status === "HOLD_DECISION_NOT_READY").length,
    failureCount: failures.length + imageFailures.length,
    blockerCount: blockers.length + imageBlockers.length,
    failures,
    blockers,
    images,
  };
}

function markdown(summary) {
  const rows = summary.products.map(
    (product) =>
      `| ${mdCell(product.productName)} | ${mdCell(product.status)} | ${product.readyImageCount}/${product.imageCount} | ${product.failureCount} | ${product.blockerCount} |`,
  );

  return `${[
    "# Maxi Trouvailles - Audit decisions remplacement images sprint",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Produits controles: ${summary.productCount}`,
    `- Images controlees: ${summary.imageCount}`,
    `- Produits prets revue: ${summary.readyReviewProductCount}`,
    `- Images pretes revue: ${summary.readyImageCount}`,
    `- Produits HOLD: ${summary.holdProductCount}`,
    `- Images HOLD: ${summary.holdImageCount}`,
    `- Echecs durs: ${summary.hardFailureCount}`,
    `- Blocages HOLD: ${summary.blockerCount}`,
    "",
    "## Tableau",
    "",
    "| Produit | Statut | Images pretes | Echecs | Blocages |",
    "|---|---|---:|---:|---:|",
    ...rows,
    "",
    "## Regles controlees",
    "",
    "- Les images generees sont refusees pour photo principale et galerie produit.",
    "- Un passage en READY_REVIEW_HOLD exige une variante exacte, une preuve de droits, un fichier local et une validation Mouss.",
    "- Les decisions vides restent autorisees seulement si le statut final reste HOLD.",
    "- Aucune ecriture catalogue, aucun telechargement et aucune publication ne sont effectues.",
    "",
    "## Sources",
    "",
    `- Manifeste: ${summary.sources.manifestPath}`,
    `- Decisions a remplir: ${summary.sources.fillTemplatePath}`,
    "",
  ].join("\n")}\n`;
}

function csv(summary) {
  const rows = summary.products.flatMap((product) =>
    product.images.map((image) => ({
      productId: product.productId,
      productName: product.productName,
      productStatus: product.status,
      imageIndex: image.imageIndex,
      role: image.role,
      imageStatus: image.status,
      finalDecision: image.finalDecision,
      selectedMode: image.selectedMode,
      localFileExists: image.localFileExists,
      failures: image.failures,
      blockers: image.blockers,
    })),
  );
  const headers = [
    "productId",
    "productName",
    "productStatus",
    "imageIndex",
    "role",
    "imageStatus",
    "finalDecision",
    "selectedMode",
    "localFileExists",
    "failures",
    "blockers",
  ];

  return `${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
    .join("\n")}\n`;
}

const manifestPath = latestFile("MANIFEST_REMPLACEMENT_IMAGES_SPRINT_", "MANIFEST_REMPLACEMENT_IMAGES_SPRINT_*.json");
const manifest = readJson(manifestPath);
const fillTemplatePath =
  manifest.files?.fillTemplatePath && fs.existsSync(manifest.files.fillTemplatePath)
    ? manifest.files.fillTemplatePath
    : latestFile("A_REMPLIR_DECISIONS_REMPLACEMENT_IMAGES_", "A_REMPLIR_DECISIONS_REMPLACEMENT_IMAGES_*.json");
const fillTemplate = readJson(fillTemplatePath);
const filledById = new Map((fillTemplate.products ?? []).map((product) => [product.productId, product]));

const products = (manifest.products ?? []).map((product) => {
  const filledProduct = filledById.get(product.id);
  if (!filledProduct) {
    return {
      productId: product.id,
      productName: product.name,
      finalDecision: "MISSING",
      chosenGlobalMode: "",
      status: "BLOCK_INVALID_REPLACEMENT_DECISION",
      imageCount: product.images.length,
      readyImageCount: 0,
      holdImageCount: product.images.length,
      failureCount: 1,
      blockerCount: 0,
      failures: ["formulaire_produit_absent"],
      blockers: [],
      images: [],
    };
  }
  return auditProduct(product, filledProduct);
});

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `audit-decisions-remplacement-images-sprint-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: products.every((product) => product.failureCount === 0),
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_sprint_image_replacement_decision_audit",
  productCount: products.length,
  imageCount: products.reduce((sum, product) => sum + product.imageCount, 0),
  readyReviewProductCount: products.filter((product) => product.status === "READY_REVIEW_HOLD").length,
  readyImageCount: products.reduce((sum, product) => sum + product.readyImageCount, 0),
  holdProductCount: products.filter((product) => product.status === "HOLD_DECISIONS_NOT_READY").length,
  holdImageCount: products.reduce((sum, product) => sum + product.holdImageCount, 0),
  hardFailureCount: products.reduce((sum, product) => sum + product.failureCount, 0),
  blockerCount: products.reduce((sum, product) => sum + product.blockerCount, 0),
  products,
  sources: {
    manifestPath,
    fillTemplatePath,
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

const jsonPath = path.join(outputDir, `AUDIT_DECISIONS_REMPLACEMENT_IMAGES_SPRINT_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_DECISIONS_REMPLACEMENT_IMAGES_SPRINT_${dateKey}.md`);
const csvPath = path.join(outputDir, `AUDIT_DECISIONS_REMPLACEMENT_IMAGES_SPRINT_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      productCount: summary.productCount,
      imageCount: summary.imageCount,
      readyReviewProductCount: summary.readyReviewProductCount,
      readyImageCount: summary.readyImageCount,
      holdProductCount: summary.holdProductCount,
      holdImageCount: summary.holdImageCount,
      hardFailureCount: summary.hardFailureCount,
      blockerCount: summary.blockerCount,
      files: {
        jsonPath,
        mdPath,
        csvPath,
      },
      products: products.map((product) => ({
        id: product.productId,
        name: product.productName,
        status: product.status,
        failureCount: product.failureCount,
        blockerCount: product.blockerCount,
      })),
      safety: summary.safety,
    },
    null,
    2,
  ),
);

if (!summary.ok) {
  process.exitCode = 1;
}

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessDir = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessDir, "tableaux-action");
const fieldDepotRoot = path.resolve(businessDir, "depots-photos");
const partnerUploadsRoot = path.resolve(root, "public", "uploads", "partner-products");
const minimumWebpBytes = 4096;

const requiredEvidenceFields = [
  "checkedAt",
  "supplierSellerName",
  "exactVariantChosen",
  "deliveryFranceEuropeProof",
  "deliveryEstimateForCustomer",
  "trackingAvailable",
  "pricingProof",
  "shippingProof",
  "imageProof",
  "imageRightsProof",
  "finalDecision",
  "reviewedByMouss",
];

const fieldLabels = {
  checkedAt: "Date de verification",
  supplierSellerName: "Nom vendeur fournisseur",
  exactVariantChosen: "Variante exacte",
  deliveryFranceEuropeProof: "Preuve delai France/Europe",
  deliveryEstimateForCustomer: "Delai client Maxi",
  trackingAvailable: "Suivi disponible",
  pricingProof: "Preuve prix",
  shippingProof: "Preuve livraison",
  imageProof: "Preuve image exacte",
  imageRightsProof: "Droits image",
  finalDecision: "Decision finale",
  reviewedByMouss: "Validation Mouss",
};

const placeholderValues = [
  "a remplir",
  "a verifier",
  "à remplir",
  "à vérifier",
  "hold",
  "todo",
  "tbd",
  "n/a",
  "na",
  "non",
  "non renseigne",
  "non renseigné",
  "inconnu",
  "placeholder",
  "test",
  "vide",
];

const trueValues = new Set([
  "1",
  "ok",
  "oui",
  "true",
  "valide",
  "validee",
  "validé",
  "validée",
  "mouss",
  "revue mouss",
  "validation mouss",
]);

const falseValues = new Set(["0", "non", "false", "no", "n"]);
const clientLeakTerms = ["aliexpress", "ali express", "fournisseur", "supplier", "vendeur"];

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relativePath(filePath) {
  return filePath ? path.relative(root, filePath) : "";
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isBlankOrPlaceholder(value, { allowNo = false } = {}) {
  const normalized = normalize(value);
  if (!normalized) return true;
  return placeholderValues.some((placeholder) => {
    const normalizedPlaceholder = normalize(placeholder);
    if (allowNo && ["non", "no", "n", "false", "0"].includes(normalizedPlaceholder)) {
      return false;
    }
    return normalized === normalizedPlaceholder || normalized.includes(normalizedPlaceholder);
  });
}

function looksPositive(value) {
  return trueValues.has(normalize(value));
}

function looksBooleanAnswer(value) {
  const normalized = normalize(value);
  return trueValues.has(normalized) || falseValues.has(normalized);
}

function hasClientLeak(value) {
  const normalized = normalize(value);
  return clientLeakTerms.some((term) => normalized.includes(term));
}

function hasGeneratedImageLanguage(value) {
  const normalized = normalize(value);
  return (
    normalized.includes("image generee") ||
    normalized.includes("image genere par ia") ||
    normalized.includes("generated image") ||
    normalized.includes("ai generated") ||
    normalized.includes(" ia ")
  );
}

function isInside(baseDir, targetPath) {
  const relative = path.relative(baseDir, targetPath);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function resolveTargetPath(targetPath) {
  const raw = String(targetPath ?? "").trim();
  if (!raw) return "";
  if (path.isAbsolute(raw) && !raw.startsWith("/")) return path.resolve(raw);
  const normalized = raw.replace(/\\/g, "/");
  if (normalized.startsWith("/")) {
    return path.resolve(root, "public", normalized.slice(1));
  }
  return path.resolve(root, normalized);
}

function hasWebpSignature(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 12) return false;
  return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
}

function csvEscape(value) {
  const normalized = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${normalized.replace(/"/g, '""')}"`;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function auditEvidenceField(fieldKey, value) {
  const issues = [];
  const allowNo = fieldKey === "trackingAvailable";

  if (isBlankOrPlaceholder(value, { allowNo })) {
    issues.push("missing_or_placeholder");
  }

  if (fieldKey === "trackingAvailable" && !looksBooleanAnswer(value)) {
    issues.push("tracking_answer_not_clear_yes_no");
  }

  if (fieldKey === "trackingAvailable" && falseValues.has(normalize(value))) {
    issues.push("tracking_not_available");
  }

  if (fieldKey === "deliveryEstimateForCustomer" && hasClientLeak(value)) {
    issues.push("customer_delivery_text_mentions_supplier");
  }

  if (fieldKey === "finalDecision" && normalize(value) !== "ready_review") {
    issues.push("final_decision_not_ready_review");
  }

  if (fieldKey === "reviewedByMouss" && !looksPositive(value)) {
    issues.push("missing_human_review_mouss");
  }

  if (["imageProof", "imageRightsProof"].includes(fieldKey) && hasGeneratedImageLanguage(value)) {
    issues.push("generated_image_not_allowed_for_exact_product_gallery");
  }

  return {
    fieldKey,
    label: fieldLabels[fieldKey] ?? fieldKey,
    value: value ?? "",
    ok: issues.length === 0,
    issues,
  };
}

function auditImage(product, image, productReadyForReview) {
  const targetAbsolutePath = resolveTargetPath(image.targetPath);
  const issues = [];
  const warnings = [];
  let exists = false;
  let sizeBytes = 0;
  let webpSignatureOk = false;

  if (isBlankOrPlaceholder(image.proof)) {
    issues.push("missing_image_proof");
  }

  if (hasGeneratedImageLanguage(image.proof)) {
    issues.push("generated_image_not_allowed_for_exact_product_gallery");
  }

  if (!targetAbsolutePath) {
    issues.push("missing_target_path");
  } else {
    const insideFieldDepot = isInside(fieldDepotRoot, targetAbsolutePath);
    const insidePartnerUploads = isInside(partnerUploadsRoot, targetAbsolutePath);

    if (!insideFieldDepot && !insidePartnerUploads) {
      issues.push("target_path_outside_allowed_depots");
    }

    if (path.extname(targetAbsolutePath).toLowerCase() !== ".webp") {
      issues.push("target_extension_not_webp");
    }

    exists = fs.existsSync(targetAbsolutePath);

    if (!exists) {
      issues.push("missing_webp_file");
    } else {
      const stat = fs.statSync(targetAbsolutePath);
      sizeBytes = stat.size;
      if (sizeBytes < minimumWebpBytes) {
        issues.push("webp_file_too_small");
      }

      webpSignatureOk = hasWebpSignature(targetAbsolutePath);
      if (!webpSignatureOk) {
        issues.push("invalid_webp_signature");
      }

      if (insidePartnerUploads && !productReadyForReview) {
        warnings.push("public_upload_present_before_ready_review");
      }
    }
  }

  return {
    productId: product.productId,
    productName: product.productName,
    role: image.role ?? "",
    expectedFileName: image.expectedFileName ?? "",
    proof: image.proof ?? "",
    targetPath: image.targetPath ?? "",
    targetAbsolutePath,
    exists,
    sizeBytes,
    webpSignatureOk,
    status: issues.length === 0 ? "IMAGE_READY_FOR_HUMAN_REVIEW_HOLD" : "HOLD_IMAGE_INCOMPLETE",
    ok: issues.length === 0,
    issues,
    warnings,
  };
}

function auditProduct(product) {
  const evidence = product.evidence ?? {};
  const evidenceFields = requiredEvidenceFields.map((fieldKey) =>
    auditEvidenceField(fieldKey, evidence[fieldKey]),
  );
  const evidenceIssues = evidenceFields.flatMap((field) =>
    field.issues.map((issue) => `${field.fieldKey}:${issue}`),
  );
  const evidenceReady = evidenceIssues.length === 0;
  const images = (product.images ?? []).map((image) => auditImage(product, image, evidenceReady));
  const imageIssues = images.flatMap((image) =>
    image.issues.map((issue) => `${image.role || image.expectedFileName}:${issue}`),
  );
  const imageWarnings = images.flatMap((image) =>
    image.warnings.map((warning) => `${image.role || image.expectedFileName}:${warning}`),
  );
  const blockers = [...evidenceIssues, ...imageIssues];
  const status = blockers.length === 0 ? "READY_HUMAN_REVIEW_HOLD" : "HOLD_FIELD_KIT_INCOMPLETE";

  return {
    productId: product.productId,
    productName: product.productName,
    declaredStatus: product.status ?? "",
    status,
    evidenceFieldCount: evidenceFields.length,
    evidenceOkCount: evidenceFields.filter((field) => field.ok).length,
    evidenceMissingOrInvalidCount: evidenceFields.filter((field) => !field.ok).length,
    imageCount: images.length,
    imageReadyCount: images.filter((image) => image.ok).length,
    missingImageFileCount: images.filter((image) => image.issues.includes("missing_webp_file")).length,
    invalidImageFileCount: images.filter((image) =>
      image.issues.some((issue) => !["missing_webp_file", "missing_image_proof"].includes(issue)),
    ).length,
    blockerCount: blockers.length,
    warningCount: imageWarnings.length,
    blockers,
    warnings: imageWarnings,
    nextAction:
      blockers.length === 0
        ? "revue humaine Mouss HOLD avant toute copie publique ou publication"
        : "remplir toutes les preuves, deposer les WebP exacts, puis relancer cet audit",
    publicationAllowed: false,
    paymentAllowed: false,
    supplierOrderAllowed: false,
    catalogWriteAllowed: false,
    evidenceFields,
    images,
  };
}

function markdown(summary) {
  const rows = summary.products.map(
    (product) =>
      `| ${mdCell(product.productName)} | ${mdCell(product.status)} | ${product.evidenceOkCount}/${product.evidenceFieldCount} | ${product.imageReadyCount}/${product.imageCount} | ${product.blockerCount} | ${mdCell(product.nextAction)} |`,
  );
  const blockerRows = summary.products.flatMap((product) =>
    product.blockers.slice(0, 18).map((blocker) => `| ${mdCell(product.productName)} | ${mdCell(blocker)} |`),
  );

  return `${[
    "# Maxi Trouvailles - Audit kit terrain validation produits",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Produits controles: ${summary.productCount}`,
    `- Produits prets revue humaine HOLD: ${summary.readyReviewCount}`,
    `- Produits en HOLD: ${summary.holdCount}`,
    `- Preuves manquantes/invalides: ${summary.evidenceMissingOrInvalidCount}`,
    `- Images manquantes/invalides: ${summary.imageMissingOrInvalidCount}`,
    `- Fichiers WebP manquants: ${summary.missingImageFileCount}`,
    `- Warnings: ${summary.warningCount}`,
    "- Publication: bloquee.",
    "- Paiement: bloque.",
    "- Commande fournisseur: bloquee.",
    "",
    "## Produits",
    "",
    "| Produit | Statut | Preuves OK | Images OK | Blocages | Prochaine action |",
    "|---|---|---:|---:|---:|---|",
    ...rows,
    "",
    "## Blocages principaux",
    "",
    blockerRows.length ? "| Produit | Blocage |" : "Aucun blocage automatique, revue humaine HOLD requise.",
    blockerRows.length ? "|---|---|" : "",
    ...blockerRows,
    "",
    "## Regles controlees",
    "",
    "- Decision finale requise: `READY_REVIEW`.",
    "- Validation Mouss obligatoire.",
    "- Images exactes: preuve renseignee, fichier WebP present, signature valide, taille suffisante.",
    "- Les chemins images doivent rester dans `business-maxi-trouvailles/depots-photos` ou `public/uploads/partner-products`.",
    "- Les images generees ne debloquent jamais une galerie produit exacte.",
    "- Cet audit reste en lecture seule et ne publie rien.",
    "",
    "## Sources",
    "",
    `- Kit terrain: ${summary.sources.fieldKitPath}`,
    `- Fichier a remplir: ${summary.sources.fillAllPath}`,
    "",
  ]
    .join("\n")}\n`;
}

function csv(summary) {
  const headers = [
    "productId",
    "productName",
    "status",
    "section",
    "key",
    "ok",
    "issues",
    "targetPath",
  ];
  const rows = summary.products.flatMap((product) => [
    ...product.evidenceFields.map((field) => ({
      productId: product.productId,
      productName: product.productName,
      status: product.status,
      section: "evidence",
      key: field.fieldKey,
      ok: field.ok,
      issues: field.issues,
      targetPath: "",
    })),
    ...product.images.map((image) => ({
      productId: product.productId,
      productName: product.productName,
      status: product.status,
      section: "image",
      key: image.role || image.expectedFileName,
      ok: image.ok,
      issues: image.issues,
      targetPath: image.targetPath,
    })),
  ]);

  return `${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
    .join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const fillAllPath = latestFileUnder(actionRoot, "A_REMPLIR_TOUTES_PREUVES_IMAGES_");
const fieldKitPath = latestFileUnder(actionRoot, "KIT_TERRAIN_VALIDATION_PRODUITS_");

if (!fillAllPath) {
  throw new Error("No A_REMPLIR_TOUTES_PREUVES_IMAGES_*.json field kit file found.");
}

const fillAll = readJson(fillAllPath);
const products = (fillAll.products ?? []).map(auditProduct);
const readyReviewCount = products.filter((product) => product.status === "READY_HUMAN_REVIEW_HOLD").length;
const evidenceMissingOrInvalidCount = products.reduce(
  (sum, product) => sum + product.evidenceMissingOrInvalidCount,
  0,
);
const imageMissingOrInvalidCount = products.reduce(
  (sum, product) => sum + (product.imageCount - product.imageReadyCount),
  0,
);
const missingImageFileCount = products.reduce((sum, product) => sum + product.missingImageFileCount, 0);
const invalidImageFileCount = products.reduce((sum, product) => sum + product.invalidImageFileCount, 0);
const blockerCount = products.reduce((sum, product) => sum + product.blockerCount, 0);
const warningCount = products.reduce((sum, product) => sum + product.warningCount, 0);
const outputDir = path.join(actionRoot, `audit-kit-terrain-validation-produits-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_product_validation_field_kit_audit",
  status:
    products.length > 0 && blockerCount === 0
      ? "READY_HUMAN_REVIEW_HOLD"
      : "HOLD_FIELD_KIT_INCOMPLETE",
  productCount: products.length,
  readyReviewCount,
  holdCount: products.length - readyReviewCount,
  evidenceMissingOrInvalidCount,
  imageMissingOrInvalidCount,
  missingImageFileCount,
  invalidImageFileCount,
  blockerCount,
  warningCount,
  products,
  outputDirRelative: relativePath(outputDir),
  sources: {
    fieldKitPath: relativePath(fieldKitPath),
    fillAllPath: relativePath(fillAllPath),
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

const jsonPath = path.join(outputDir, `AUDIT_KIT_TERRAIN_VALIDATION_PRODUITS_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_KIT_TERRAIN_VALIDATION_PRODUITS_${dateKey}.md`);
const csvPath = path.join(outputDir, `AUDIT_KIT_TERRAIN_VALIDATION_PRODUITS_${dateKey}.csv`);

summary.files = {
  json: relativePath(jsonPath),
  md: relativePath(mdPath),
  csv: relativePath(csvPath),
};

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      status: summary.status,
      productCount: summary.productCount,
      readyReviewCount: summary.readyReviewCount,
      holdCount: summary.holdCount,
      evidenceMissingOrInvalidCount: summary.evidenceMissingOrInvalidCount,
      imageMissingOrInvalidCount: summary.imageMissingOrInvalidCount,
      missingImageFileCount: summary.missingImageFileCount,
      files: summary.files,
      safety: summary.safety,
    },
    null,
    2,
  ),
);

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
  const matches = collectFiles(dir, (name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  const todayKey = datePartsParis().dateKey;
  return matches.find((match) => match.fullPath.includes(todayKey))?.fullPath ?? matches[0]?.fullPath ?? null;
}

function readJson(filePath, fallback = null) {
  if (!filePath || !fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relativePath(filePath) {
  return filePath ? path.relative(root, filePath) : "";
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function argValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? "";
}

function centsFromPriceLabel(value) {
  const normalized = String(value ?? "").replace(",", ".");
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  return match ? Math.round(Number(match[1]) * 100) : 0;
}

function marginSnapshot(product) {
  const supplierCents =
    centsFromPriceLabel(product?.supplier?.supplierPrice) ||
    Number(product?.supplier?.supplierPriceCents ?? 0);
  const saleCents =
    centsFromPriceLabel(product?.supplier?.salePrice) ||
    Number(product?.supplier?.salePriceCents ?? 0);
  const marginCents = Math.max(0, saleCents - supplierCents);
  const marginRate = saleCents > 0 ? marginCents / saleCents : 0;

  return {
    supplierCents,
    saleCents,
    marginCents,
    marginRate,
    marginPercent: Math.round(marginRate * 1000) / 10,
  };
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function formatEuroFromCents(value) {
  return `${(Math.max(0, Number(value) || 0) / 100).toFixed(2)} EUR`;
}

function findProductInList(list, productId) {
  return (list ?? []).find((item) => item.id === productId || item.productId === productId);
}

function markdown(summary) {
  const fieldRows = summary.evidenceFields.map(
    (field) =>
      `| ${mdCell(field.label)} | ${mdCell(field.key)} | ${field.ok ? "OK" : "A remplir"} | ${mdCell(field.instruction)} | ${mdCell(field.value || field.currentValue || "")} |`,
  );
  const imageRows = summary.imageTasks.map(
    (image) =>
      `| ${image.order ?? image.imageIndex ?? ""} | ${mdCell(image.role)} | ${mdCell(image.status ?? image.stagingStatus)} | ${mdCell(image.requiredShot ?? image.targetPublicUrl)} | ${mdCell(image.stagingRelativePath ?? image.targetPublicUrl)} |`,
  );
  const blockerRows = summary.blockers.map((blocker) => `- ${blocker}`);
  const commandRows = summary.commandsToRunAfterFill.map((command) => `- \`${command}\``);

  return `${[
    `# Cockpit validation produit - ${summary.product.name}`,
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Verdict",
    "",
    `- Publication autorisee: ${summary.gates.publicationAllowed ? "oui" : "non"}`,
    `- Paiement autorise: ${summary.gates.paymentAllowed ? "oui" : "non"}`,
    `- Commande partenaire autorisee: ${summary.gates.supplierOrderAllowed ? "oui" : "non"}`,
    `- Revue humaine possible: ${summary.gates.readyReviewAllowed ? "oui" : "non"}`,
    "",
    "## Produit",
    "",
    `- ID: ${summary.product.id}`,
    `- Slug: ${summary.product.slug}`,
    `- Categorie: ${summary.product.categoryId}`,
    `- Score shortlist: ${summary.product.score}`,
    `- Prix boutique prevu: ${formatEuroFromCents(summary.margin.saleCents)}`,
    `- Marge brute estimee interne: ${formatEuroFromCents(summary.margin.marginCents)} (${summary.margin.marginPercent}%)`,
    "",
    "## Validation fournisseur interne",
    "",
    `- Lien fournisseur interne: ${summary.supplierForInternalValidation.url || "a renseigner"}`,
    `- SKU fournisseur: ${summary.supplierForInternalValidation.sku || "a renseigner"}`,
    `- Prix fournisseur vu: ${summary.supplierForInternalValidation.supplierPrice || "a verifier"}`,
    `- Stock vu: ${summary.supplierForInternalValidation.stock ?? "a verifier"}`,
    `- Livraison vue: ${summary.supplierForInternalValidation.currentDeliveryEstimate || "a verifier"}`,
    `- Regle: ces informations servent uniquement a la validation interne et ne doivent jamais apparaitre cote client.`,
    "",
    "## Texte client sur",
    "",
    `- Titre: ${summary.customerSafeDraft.title}`,
    `- Description courte: ${summary.customerSafeDraft.shortDescription}`,
    `- Livraison: ${summary.customerSafeDraft.deliveryCopy}`,
    `- Confiance: ${summary.customerSafeDraft.trustCopy}`,
    "",
    "## Preuves obligatoires",
    "",
    "| Champ | Cle | Statut | Consigne | Valeur actuelle |",
    "|---|---|---|---|---|",
    ...fieldRows,
    "",
    "## Images exactes attendues",
    "",
    "| Ordre | Role | Statut | Photo/preuve attendue | Chemin |",
    "|---:|---|---|---|---|",
    ...imageRows,
    "",
    "## Blocages actuels",
    "",
    ...(blockerRows.length ? blockerRows : ["- Aucun"]),
    "",
    "## Commandes a relancer apres remplissage",
    "",
    ...commandRows,
    "",
    "## Garde-fous",
    "",
    "- Ne pas publier.",
    "- Ne pas commander chez le partenaire.",
    "- Ne pas payer.",
    "- Ne pas copier les images dans `public/uploads` tant que les droits et la correspondance exacte ne sont pas prouves.",
    "- Ne jamais afficher le lien partenaire au client.",
    "",
    "## Sources",
    "",
    ...Object.entries(summary.sources).map(([key, value]) => `- ${key}: ${value || "absent"}`),
    "",
  ].join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const shortlistPath = latestFileUnder(actionRoot, "SHORTLIST_GO_HUMAIN_PARTENAIRES_");
const proofExportPath = latestFileUnder(actionRoot, "A_REMPLIR_PREUVES_PARTENAIRES_NOW_");
const proofAuditPath = latestFileUnder(actionRoot, "AUDIT_PREUVES_PARTENAIRES_NOW_");
const photoDropPath = latestFileUnder(photoDropRoot, "MANIFEST_DEPOT_PHOTOS_SPRINT_");
const localFileAuditPath = latestFileUnder(actionRoot, "AUDIT_FICHIERS_LOCAUX_IMAGES_SPRINT_");
const imageGateAuditPath = latestFileUnder(actionRoot, "AUDIT_GATES_IMAGES_SPRINT_");
const publicSurfacePath = latestFileUnder(actionRoot, "AUDIT_SURFACE_PUBLIQUE_DROPSHIPPING_");

const shortlist = readJson(shortlistPath, {});
const proofExport = readJson(proofExportPath, {});
const proofAudit = readJson(proofAuditPath, {});
const photoDrop = readJson(photoDropPath, {});
const localFileAudit = readJson(localFileAuditPath, {});
const imageGateAudit = readJson(imageGateAuditPath, {});
const publicSurface = readJson(publicSurfacePath, {});

const requestedProductId = argValue("product");
const selectedProductId =
  requestedProductId ||
  shortlist?.evidenceSprint?.[0]?.id ||
  proofExport?.products?.[0]?.id;

if (!selectedProductId) {
  throw new Error("No product available for validation cockpit.");
}

const proofProduct = findProductInList(proofExport.products, selectedProductId);
const auditProduct = findProductInList(proofAudit.products, selectedProductId);
const shortlistProduct = findProductInList(shortlist.candidates, selectedProductId);
const photoProduct = (photoDrop.products ?? []).find(
  (product) => product.productId === selectedProductId,
);
const localFileProduct = (localFileAudit.products ?? []).find(
  (product) => product.productId === selectedProductId,
);
const imageGateProduct = (imageGateAudit.products ?? []).find(
  (product) => product.id === selectedProductId,
);
const publicSurfaceProduct = (publicSurface.productAudits ?? []).find(
  (product) => product.id === selectedProductId,
);

if (!proofProduct && !shortlistProduct) {
  throw new Error(`Cannot find product ${selectedProductId} in proof export or shortlist.`);
}

const product = {
  id: selectedProductId,
  slug: proofProduct?.slug ?? slugify(shortlistProduct?.name),
  name: proofProduct?.name ?? shortlistProduct?.name,
  categoryId: proofProduct?.categoryId ?? shortlistProduct?.categoryId,
  priority: proofProduct?.priority ?? shortlistProduct?.priority ?? 0,
  status: proofProduct?.status ?? shortlistProduct?.status ?? "HOLD",
  score: shortlistProduct?.score ?? 0,
};
const margin = marginSnapshot(proofProduct ?? shortlistProduct);
const supplierForInternalValidation = proofProduct?.supplier ?? shortlistProduct?.supplier ?? {};
const evidenceFields = (proofProduct?.missingFields ?? auditProduct?.fields ?? []).map((field) => ({
  key: field.key,
  label: field.label,
  instruction: field.instruction ?? "Remplir uniquement avec une preuve visible.",
  value: field.value ?? field.currentValue ?? "",
  currentValue: field.currentValue ?? field.value ?? "",
  ok: Boolean(field.ok),
  issues: field.issues ?? [],
}));
const imageTasks = photoProduct?.imageTasks?.length
  ? photoProduct.imageTasks
  : localFileProduct?.images ?? imageGateProduct?.targetImages ?? [];
const blockers = Array.from(
  new Set([
    ...(proofProduct?.blockers ?? []),
    ...(auditProduct?.blockers ?? []),
    ...(localFileProduct?.images ?? []).flatMap((image) => image.blockers ?? []),
    ...(imageGateProduct?.blockers ?? []),
    ...(publicSurfaceProduct?.publicationBlockers ?? []),
  ]),
);
const localFilesReady =
  Number(localFileProduct?.imageCount ?? imageTasks.length) > 0 &&
  Number(localFileProduct?.missingLocalFileCount ?? imageTasks.length) === 0 &&
  Number(localFileProduct?.invalidLocalFileCount ?? 0) === 0 &&
  Number(localFileProduct?.hardFailureCount ?? 0) === 0;

const gates = {
  readyReviewAllowed:
    auditProduct?.missingOrInvalidFieldCount === 0 &&
    imageGateProduct?.reviewAllowed === true &&
    localFilesReady,
  publicationAllowed: false,
  paymentAllowed: false,
  supplierOrderAllowed: false,
  imageGateReviewAllowed: Boolean(imageGateProduct?.reviewAllowed),
};

const cockpitSlug = `${String(shortlistProduct?.shortlistRank ?? product.priority).padStart(2, "0")}-${product.slug}`;
const outputDir = path.join(actionRoot, `cockpit-validation-produit-${dateKey}`, cockpitSlug);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_single_product_validation_cockpit",
  status: gates.readyReviewAllowed ? "READY_REVIEW_HOLD" : "HOLD_MISSING_EVIDENCE",
  product,
  margin,
  supplierForInternalValidation,
  customerSafeDraft: {
    title: product.name,
    shortDescription:
      "Accessoire pratique en validation interne. Mise en vente uniquement apres controle des images, du stock, du delai et du partenaire logistique.",
    deliveryCopy: "Livraison estimee affichee seulement apres validation France/Europe.",
    trustCopy: "Paiement securise sur Maxi Trouvaille, service client Maxi Trouvaille, suivi colis.",
  },
  evidenceFields,
  evidenceFieldCount: evidenceFields.length,
  evidenceFieldMissingCount: evidenceFields.filter((field) => !field.ok).length,
  imageTasks,
  imageTaskCount: imageTasks.length,
  blockers,
  gates,
  commandsToRunAfterFill: [
    "npm run catalog:audit-fast-proof-now-export",
    "npm run catalog:audit-sprint-image-local-files",
    "npm run catalog:audit-sprint-image-gates",
    "npm run catalog:audit-sprint-image-human-review",
    "npm run catalog:audit-public-dropshipping-surface",
    "npm run catalog:audit-all-partner-gates",
    "npm run catalog:audit-checkout-eligibility",
    "npm run catalog:test-checkout-guards",
  ],
  outputDir,
  outputDirRelative: relativePath(outputDir),
  sources: {
    shortlistPath: relativePath(shortlistPath),
    proofExportPath: relativePath(proofExportPath),
    proofAuditPath: relativePath(proofAuditPath),
    photoDropPath: relativePath(photoDropPath),
    localFileAuditPath: relativePath(localFileAuditPath),
    imageGateAuditPath: relativePath(imageGateAuditPath),
    publicSurfacePath: relativePath(publicSurfacePath),
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

const jsonPath = path.join(outputDir, `COCKPIT_VALIDATION_PRODUIT_${dateKey}.json`);
const mdPath = path.join(outputDir, `COCKPIT_VALIDATION_PRODUIT_${dateKey}.md`);
const fillPath = path.join(outputDir, `A_REMPLIR_PREUVES_${slugify(product.name).toUpperCase()}_${dateKey}.json`);

const fillTemplate = {
  productId: product.id,
  productName: product.name,
  supplierForInternalValidation,
  status: "HOLD",
  finalDecision: "HOLD",
  reviewedByMouss: false,
  evidenceFields: Object.fromEntries(
    evidenceFields.map((field) => [field.key, field.value || field.currentValue || ""]),
  ),
  imageFilesToDeposit: imageTasks.map((image) => ({
    role: image.role,
    expectedFileName: image.expectedFileName ?? "",
    stagingRelativePath: image.stagingRelativePath ?? "",
    proof: "",
  })),
  notes: [
    "Remplir uniquement avec preuves visibles.",
    "Ne pas publier automatiquement.",
    "Ne pas commander chez le partenaire.",
    "Ne pas payer.",
  ],
};

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(fillPath, `${JSON.stringify(fillTemplate, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      status: summary.status,
      productId: product.id,
      evidenceFieldMissingCount: summary.evidenceFieldMissingCount,
      imageTaskCount: summary.imageTaskCount,
      blockerCount: summary.blockers.length,
      files: {
        jsonPath,
        mdPath,
        fillPath,
      },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

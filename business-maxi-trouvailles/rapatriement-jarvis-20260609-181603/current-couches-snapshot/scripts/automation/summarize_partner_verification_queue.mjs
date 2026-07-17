import fs from "node:fs";
import path from "node:path";

const quickProductsPath = path.join(process.cwd(), "data", "quick-products.json");
const topArg = process.argv.find((arg) => arg.startsWith("--top="));
const topLimit = topArg ? Math.max(1, Number(topArg.split("=")[1]) || 15) : 15;

const validPartnerCategories = new Set([
  "dropshipping-accessoires",
  "dropshipping-animaux",
  "dropshipping-auto-moto",
  "dropshipping-beaute",
  "dropshipping-cuisine",
  "dropshipping-enfant",
  "dropshipping-high-tech",
  "dropshipping-maison",
  "dropshipping-mode",
]);

function readProducts() {
  const content = fs.readFileSync(quickProductsPath, "utf8");
  const products = JSON.parse(content);

  if (!Array.isArray(products)) {
    throw new Error("data/quick-products.json must contain an array of products.");
  }

  return products;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isPartnerProduct(product) {
  return Boolean(
    product?.dropshipping?.enabled ||
      String(product?.categoryId ?? "").startsWith("dropshipping-"),
  );
}

function hasCategoryPlaceholder(value) {
  return typeof value === "string" && value.includes("/uploads/category-images/");
}

function parseDeliveryWindowDays(value) {
  const text = normalizeText(value);

  if (!text) {
    return { ok: false, reason: "delai_absent" };
  }

  if (
    text.includes("verifier") ||
    text.includes("confirmer") ||
    text.includes("estime") ||
    text.includes("a valider")
  ) {
    return { ok: false, reason: "delai_non_prouve" };
  }

  const dayNumbers = [...text.matchAll(/\d+/g)].map((match) => Number(match[0]));
  if (dayNumbers.length === 0) {
    return { ok: false, reason: "delai_sans_nombre" };
  }

  const minDays = Math.min(...dayNumbers);
  const maxDays = Math.max(...dayNumbers);

  if (minDays < 3) {
    return { ok: false, reason: "delai_trop_court_a_verifier", minDays, maxDays };
  }

  if (maxDays > 7) {
    return { ok: false, reason: "delai_superieur_7_jours", minDays, maxDays };
  }

  return { ok: true, minDays, maxDays };
}

function calculateMarginPercent(product) {
  const sale = Number(product?.dropshipping?.salePriceCents ?? product?.price ?? 0);
  const supplier = Number(product?.dropshipping?.supplierPriceCents ?? 0);

  if (!Number.isFinite(sale) || !Number.isFinite(supplier) || sale <= 0 || supplier <= 0) {
    return null;
  }

  return Math.round(((sale - supplier) / sale) * 100);
}

function supplierReliability(product) {
  const dropshipping = product.dropshipping ?? {};
  const supplierName = normalizeText(dropshipping.supplierName);
  const validationStatus = normalizeText(product.internalSourcing?.validationStatus);
  const checks = Array.isArray(dropshipping.validationGate?.checks)
    ? dropshipping.validationGate.checks.map(normalizeText).join(" ")
    : "";

  if (!dropshipping.supplierUrl || !/^https?:\/\//i.test(dropshipping.supplierUrl)) {
    return { ok: false, reason: "lien_fournisseur_absent" };
  }

  if (
    supplierName.includes("a verifier") ||
    supplierName.includes("annonce exacte") ||
    supplierName.includes("fournisseur partenaire")
  ) {
    return { ok: false, reason: "vendeur_non_valide" };
  }

  if (validationStatus.includes("hold") || validationStatus.includes("verifier")) {
    return { ok: false, reason: "validation_fournisseur_hold" };
  }

  if (!checks.includes("vendeur fiable") && !checks.includes("supplier reliable")) {
    return { ok: false, reason: "preuve_vendeur_fiable_absente" };
  }

  return { ok: true };
}

function detectRiskFlags(product) {
  const categoryId = String(product.categoryId ?? "");
  const text = normalizeText(
    [
      product.name,
      product.shortDescription,
      product.description,
      ...(Array.isArray(product.features) ? product.features : []),
    ].join(" "),
  );
  const flags = [];

  if (categoryId === "dropshipping-enfant" || /\b(enfant|jouet|bebe|lanceur)\b/.test(text)) {
    flags.push("controle_securite_enfant");
  }

  if (/\b(usb|rechargeable|batterie|led|lampe|tondeuse|humidificateur|240w)\b/.test(text)) {
    flags.push("controle_electrique_ou_batterie");
  }

  if (categoryId === "dropshipping-beaute" || /\b(cuir chevelu|manucure|ongles|barbe|cheveux)\b/.test(text)) {
    flags.push("controle_hygiene_beaute");
  }

  if (categoryId === "dropshipping-auto-moto" || /\b(voiture|pare-brise|tableau de bord|coffre)\b/.test(text)) {
    flags.push("controle_usage_auto");
  }

  if (categoryId === "dropshipping-animaux" || /\b(chat|chien|animal|animaux)\b/.test(text)) {
    flags.push("controle_confort_animal");
  }

  if (/\b(alimentaire|cuisson|gourde|gamelle|silicone|evier|air fryer)\b/.test(text)) {
    flags.push("controle_matiere_contact");
  }

  return [...new Set(flags)];
}

function getBlockers(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  const marginPercent = calculateMarginPercent(product);
  const delivery = parseDeliveryWindowDays(product.dropshipping?.deliveryEstimate);
  const supplier = supplierReliability(product);
  const sourceVerification = product.sourceVerification ?? {};
  const internalStatus = normalizeText(product.internalSourcing?.validationStatus);
  const descriptionText = normalizeText(
    [
      product.shortDescription,
      product.description,
      ...(Array.isArray(product.features) ? product.features : []),
      product.imageValidation?.nextAction,
    ].join(" "),
  );
  const blockers = [];

  if (!product.name || String(product.name).trim().length < 8) {
    blockers.push("titre_incoherent_ou_trop_court");
  }

  if (!product.description || String(product.description).trim().length < 90) {
    blockers.push("description_incomplete");
  }

  if (
    descriptionText.includes("a verifier") ||
    descriptionText.includes("a valider") ||
    descriptionText.includes("a confirmer") ||
    descriptionText.includes("hold")
  ) {
    blockers.push("fiche_contient_elements_a_confirmer");
  }

  if (!product.image || hasCategoryPlaceholder(product.image)) {
    blockers.push("image_principale_absente_ou_generique");
  }

  if (images.length === 0 || images.some(hasCategoryPlaceholder)) {
    blockers.push("galerie_absente_ou_generique");
  }

  if (product.imageValidation?.status !== "verified_source_images") {
    blockers.push("images_non_verifiees");
  }

  if (!product.imageValidation?.sourceUrl) {
    blockers.push("source_images_absente");
  }

  if (!validPartnerCategories.has(product.categoryId)) {
    blockers.push("categorie_partenaire_incorrecte");
  }

  if (!(Number(product.dropshipping?.supplierStock ?? product.stock ?? 0) > 0)) {
    blockers.push("stock_indisponible");
  }

  if (marginPercent === null) {
    blockers.push("marge_incalculable");
  } else if (marginPercent < 30) {
    blockers.push("marge_inferieure_30");
  }

  if (!delivery.ok) {
    blockers.push(delivery.reason);
  }

  if (!supplier.ok) {
    blockers.push(supplier.reason);
  }

  if (internalStatus.includes("hold") || internalStatus.includes("verifier")) {
    blockers.push("validation_interne_hold");
  }

  if (sourceVerification.deliveryStatus === "hold") {
    blockers.push("preuve_livraison_hold");
  }

  if (sourceVerification.priceStatus === "hold") {
    blockers.push("preuve_prix_hold");
  }

  if (sourceVerification.rightsStatus === "hold") {
    blockers.push("droits_images_hold");
  }

  if (!product.seo?.title || !product.seo?.description) {
    blockers.push("seo_incomplet");
  }

  if (!product.imageAlt && !product.seo?.imageAlt) {
    blockers.push("alt_image_incomplet");
  }

  return [...new Set(blockers)];
}

function priorityScore(product, blockers, riskFlags) {
  const marginPercent = calculateMarginPercent(product);
  const stock = Number(product.dropshipping?.supplierStock ?? product.stock ?? 0);
  const sourceRank = Number(product.sourceVerification?.sourceRank ?? 99);
  let score = 100;

  score -= blockers.length * 9;
  score -= riskFlags.length * 6;

  if (marginPercent >= 40) {
    score += 8;
  } else if (marginPercent >= 30) {
    score += 3;
  }

  if (stock >= 80) {
    score += 7;
  } else if (stock >= 50) {
    score += 5;
  } else if (stock > 0) {
    score += 2;
  }

  if (sourceRank <= 5) {
    score += 8;
  } else if (sourceRank <= 10) {
    score += 5;
  }

  if (product.imageValidation?.status === "verified_source_images") {
    score += 6;
  }

  if (product.seo?.title && product.seo?.description && (product.imageAlt || product.seo?.imageAlt)) {
    score += 6;
  }

  return Math.max(0, score);
}

function countBy(values) {
  const counts = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([, a], [, b]) => b - a));
}

function summarizeProduct(product) {
  const blockers = getBlockers(product);
  const riskFlags = detectRiskFlags(product);
  const score = priorityScore(product, blockers, riskFlags);
  const marginPercent = calculateMarginPercent(product);
  const delivery = parseDeliveryWindowDays(product.dropshipping?.deliveryEstimate);
  const supplier = supplierReliability(product);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    status: product.status ?? "published",
    categoryId: product.categoryId,
    priorityScore: score,
    marginPercent,
    supplierStock: product.dropshipping?.supplierStock ?? product.stock ?? 0,
    imageStatus: product.imageValidation?.status ?? "unknown",
    delivery,
    supplier,
    riskFlags,
    blockerCount: blockers.length,
    blockers,
    suggestedNextAction:
      blockers.length === 0
        ? "publier_apres_recontrole_final"
        : "verifier_sources_livraison_vendeur_prix_droits_puis_recontroler",
  };
}

const products = readProducts();
const partnerProducts = products.filter(isPartnerProduct);
const summaries = partnerProducts.map(summarizeProduct);
const readyToPublish = summaries.filter((summary) => summary.blockerCount === 0);
const drafts = summaries.filter((summary) => summary.status === "draft");
const verificationQueue = summaries
  .filter((summary) => summary.status === "draft" && summary.blockerCount > 0)
  .sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }

    if (a.blockerCount !== b.blockerCount) {
      return a.blockerCount - b.blockerCount;
    }

    return String(a.slug).localeCompare(String(b.slug));
  })
  .slice(0, topLimit);

const output = {
  ok: true,
  checkedAt: new Date().toISOString(),
  mode: "read_only",
  partnerProductCount: partnerProducts.length,
  draftPartnerCount: drafts.length,
  readyToPublishCount: readyToPublish.length,
  publishedPartnerCount: summaries.filter((summary) => summary.status === "published").length,
  categories: countBy(summaries.map((summary) => summary.categoryId)),
  blockers: countBy(summaries.flatMap((summary) => summary.blockers)),
  riskFlags: countBy(summaries.flatMap((summary) => summary.riskFlags)),
  verificationQueue,
  readyToPublish,
  safety: {
    noWrite: true,
    noPayment: true,
    noOrder: true,
    noAccountLogin: true,
    noExternalPublication: true,
    noProductPublication: true,
  },
};

console.log(JSON.stringify(output, null, 2));

import fs from "node:fs";
import path from "node:path";

const quickProductsPath = path.join(process.cwd(), "data", "quick-products.json");
const applyChanges = process.argv.includes("--apply");

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

function hasReliableSupplier(product) {
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

function hasUnresolvedConfirmationText(product) {
  const text = normalizeText(
    [
      product.shortDescription,
      product.description,
      ...(Array.isArray(product.features) ? product.features : []),
      product.imageValidation?.nextAction,
    ].join(" "),
  );

  return (
    text.includes("a verifier") ||
    text.includes("a confirmer") ||
    text.includes("a valider") ||
    text.includes("hold")
  );
}

function buildSeo(product) {
  const title = String(product.name ?? "").trim();
  const description = String(product.shortDescription || product.description || "").trim();
  const category = String(product.categoryId ?? "").replace(/^dropshipping-/, "");
  const keywords = Array.from(
    new Set(
      [
        title,
        category,
        "maxi trouvaille",
        "produit partenaire",
        "livraison rapide",
      ]
        .join(" ")
        .split(/\s+/)
        .map((word) => normalizeText(word).replace(/[^a-z0-9-]/g, ""))
        .filter((word) => word.length >= 3)
        .slice(0, 12),
    ),
  );

  return {
    title: `${title} | Maxi Trouvaille`.slice(0, 65),
    description: description.slice(0, 155),
    h1: title,
    h2: `Pourquoi choisir ${title}`,
    keywords,
    imageAlt: `${title} - ${category} Maxi Trouvaille`.trim(),
  };
}

function auditProduct(product, duplicateSlugs, duplicateIds) {
  const problems = [];
  const images = Array.isArray(product.images) ? product.images : [];
  const marginPercent = calculateMarginPercent(product);
  const delivery = parseDeliveryWindowDays(product.dropshipping?.deliveryEstimate);
  const supplier = hasReliableSupplier(product);
  const internalValidationStatus = normalizeText(product.internalSourcing?.validationStatus);
  const sourceVerification = product.sourceVerification ?? {};

  if (duplicateSlugs.has(product.slug)) {
    problems.push("slug_duplique");
  }

  if (duplicateIds.has(product.id)) {
    problems.push("id_duplique");
  }

  if (!product.name || String(product.name).trim().length < 8) {
    problems.push("titre_incoherent_ou_trop_court");
  }

  if (!product.description || String(product.description).trim().length < 90) {
    problems.push("description_incomplete");
  }

  if (hasUnresolvedConfirmationText(product)) {
    problems.push("fiche_contient_elements_a_confirmer");
  }

  if (!Array.isArray(product.features) || product.features.length < 3) {
    problems.push("points_forts_incomplets");
  }

  if (!product.image || hasCategoryPlaceholder(product.image)) {
    problems.push("image_principale_absente_ou_generique");
  }

  if (images.length === 0 || images.some(hasCategoryPlaceholder)) {
    problems.push("galerie_absente_ou_generique");
  }

  if (product.imageValidation?.status !== "verified_source_images") {
    problems.push("images_non_verifiees");
  }

  if (!product.imageValidation?.sourceUrl) {
    problems.push("source_images_absente");
  }

  if (!validPartnerCategories.has(product.categoryId)) {
    problems.push("categorie_partenaire_incorrecte");
  }

  if (!(Number(product.dropshipping?.supplierStock ?? product.stock ?? 0) > 0)) {
    problems.push("stock_indisponible");
  }

  if (marginPercent === null) {
    problems.push("marge_incalculable");
  } else if (marginPercent < 30) {
    problems.push("marge_inferieure_30");
  }

  if (!delivery.ok) {
    problems.push(delivery.reason);
  }

  if (!supplier.ok) {
    problems.push(supplier.reason);
  }

  if (internalValidationStatus.includes("hold") || internalValidationStatus.includes("verifier")) {
    problems.push("validation_interne_hold");
  }

  if (sourceVerification.deliveryStatus === "hold") {
    problems.push("preuve_livraison_hold");
  }

  if (sourceVerification.priceStatus === "hold") {
    problems.push("preuve_prix_hold");
  }

  if (sourceVerification.rightsStatus === "hold") {
    problems.push("droits_images_hold");
  }

  const readyToPublish = problems.length === 0;
  const seo = buildSeo(product);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    status: product.status ?? "published",
    categoryId: product.categoryId,
    marginPercent,
    delivery,
    stock: product.dropshipping?.supplierStock ?? product.stock ?? 0,
    readyToPublish,
    problems,
    seo,
    nextAction: readyToPublish
      ? "publier_automatiquement"
      : "laisser_en_brouillon_corriger_recontroler",
  };
}

function buildDuplicateSets(products) {
  const slugCounts = new Map();
  const idCounts = new Map();

  for (const product of products) {
    if (product.slug) {
      slugCounts.set(product.slug, (slugCounts.get(product.slug) ?? 0) + 1);
    }

    if (product.id) {
      idCounts.set(product.id, (idCounts.get(product.id) ?? 0) + 1);
    }
  }

  return {
    duplicateSlugs: new Set([...slugCounts].filter(([, count]) => count > 1).map(([slug]) => slug)),
    duplicateIds: new Set([...idCounts].filter(([, count]) => count > 1).map(([id]) => id)),
  };
}

function countProblems(audits) {
  return audits.reduce((acc, audit) => {
    for (const problem of audit.problems) {
      acc[problem] = (acc[problem] ?? 0) + 1;
    }

    return acc;
  }, {});
}

function maybeApply(products, audits) {
  if (!applyChanges) {
    return { applied: false, updatedCount: 0, updatedSlugs: [] };
  }

  const readyById = new Map(
    audits.filter((audit) => audit.readyToPublish).map((audit) => [audit.id, audit]),
  );

  if (readyById.size === 0) {
    return { applied: true, updatedCount: 0, updatedSlugs: [] };
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "backups", `quick-products-before-publish-ready-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(quickProductsPath, path.join(backupDir, "quick-products.json.bak"));

  const updatedProducts = products.map((product) => {
    const audit = readyById.get(product.id);

    if (!audit) {
      return product;
    }

    return {
      ...product,
      status: "published",
      badge: product.badge || "Produit valide",
      dropshipping: {
        ...product.dropshipping,
        syncStatus: "ready",
        lastSyncAt: new Date().toISOString().slice(0, 10),
      },
      seo: audit.seo,
      imageAlt: audit.seo.imageAlt,
      internalSourcing: {
        ...product.internalSourcing,
        publicationStatus: "AUTO_PUBLISHED_AFTER_FULL_CONTROLS",
        publicationCheckedAt: new Date().toISOString(),
      },
    };
  });

  fs.writeFileSync(quickProductsPath, `${JSON.stringify(updatedProducts, null, 2)}\n`, "utf8");

  return {
    applied: true,
    updatedCount: readyById.size,
    updatedSlugs: [...readyById.values()].map((audit) => audit.slug),
    backupDir,
  };
}

const products = readProducts();
const partnerProducts = products.filter(isPartnerProduct);
const { duplicateSlugs, duplicateIds } = buildDuplicateSets(products);
const audits = partnerProducts.map((product) =>
  auditProduct(product, duplicateSlugs, duplicateIds),
);
const applySummary = maybeApply(products, audits);

const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  mode: applyChanges ? "apply" : "audit",
  partnerProductCount: partnerProducts.length,
  readyToPublishCount: audits.filter((audit) => audit.readyToPublish).length,
  blockedCount: audits.filter((audit) => !audit.readyToPublish).length,
  problemCounts: countProblems(audits),
  readyToPublish: audits.filter((audit) => audit.readyToPublish),
  blocked: audits
    .filter((audit) => !audit.readyToPublish)
    .sort((a, b) => b.problems.length - a.problems.length || (b.marginPercent ?? 0) - (a.marginPercent ?? 0)),
  apply: applySummary,
  safety: {
    noPayment: true,
    noOrder: true,
    noAccountLogin: true,
    noExternalPublication: true,
    publishOnlyFullyValidatedProducts: true,
  },
};

console.log(JSON.stringify(summary, null, 2));

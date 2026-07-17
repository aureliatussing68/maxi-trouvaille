import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const quickProductsPath = path.join(root, "data", "quick-products.json");
const outputDir = path.join(root, "business-maxi-trouvailles", "file-validation-fournisseurs");
const topArg = process.argv.find((arg) => arg.startsWith("--top="));
const topLimit = topArg ? Math.max(1, Number(topArg.split("=")[1]) || 12) : 12;

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

const blockerLabels = {
  delai_non_prouve: "Verifier et noter un delai France/Europe reel, idealement 3 a 7 jours.",
  delai_superieur_7_jours: "Remplacer par un fournisseur plus rapide ou garder hors publication.",
  delai_absent: "Renseigner une preuve de delai avant publication.",
  vendeur_non_valide: "Remplacer le libelle fournisseur par le vendeur exact et valider sa fiabilite.",
  validation_fournisseur_hold: "Lever le HOLD fournisseur avec une preuve de vendeur fiable.",
  preuve_vendeur_fiable_absente: "Ajouter une preuve de fiabilite vendeur.",
  preuve_livraison_hold: "Ajouter une preuve de livraison France/Europe.",
  preuve_prix_hold: "Recontroler prix fournisseur, frais et marge.",
  droits_images_hold: "Valider le droit d'usage des images ou remplacer les visuels.",
  validation_interne_hold: "Faire la revue humaine finale avant publication.",
  fiche_contient_elements_a_confirmer: "Retirer les mentions a verifier seulement apres preuve exacte.",
  images_non_verifiees: "Corriger les images pour la variante exacte.",
  source_images_absente: "Renseigner la source exacte des images.",
  image_principale_absente_ou_generique: "Remplacer l'image principale par la photo exacte.",
  galerie_absente_ou_generique: "Ajouter une galerie exacte ou laisser une seule image exacte.",
  marge_inferieure_30: "Recalculer prix ou ecarter le produit.",
  marge_incalculable: "Renseigner prix fournisseur et prix boutique.",
  categorie_partenaire_incorrecte: "Corriger la categorie dropshipping.",
  stock_indisponible: "Verifier stock fournisseur ou garder hors publication.",
  seo_incomplet: "Completer title, description et alt image.",
  alt_image_incomplet: "Ajouter un alt image propre.",
};

function readProducts() {
  const products = JSON.parse(fs.readFileSync(quickProductsPath, "utf8"));

  if (!Array.isArray(products)) {
    throw new Error("data/quick-products.json must contain an array.");
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
  const blockers = [];
  const images = Array.isArray(product.images) ? product.images : [];
  const marginPercent = calculateMarginPercent(product);
  const delivery = parseDeliveryWindowDays(product.dropshipping?.deliveryEstimate);
  const supplier = supplierReliability(product);
  const internalStatus = normalizeText(product.internalSourcing?.validationStatus);
  const sourceVerification = product.sourceVerification ?? {};

  if (!product.name || String(product.name).trim().length < 8) {
    blockers.push("titre_incoherent_ou_trop_court");
  }

  if (!product.description || String(product.description).trim().length < 90) {
    blockers.push("description_incomplete");
  }

  if (hasUnresolvedConfirmationText(product)) {
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

function laneFor(blockers, riskFlags) {
  if (blockers.length === 0) {
    return "lane_0_ready_review";
  }

  if (
    blockers.every((blocker) =>
      [
        "delai_non_prouve",
        "validation_fournisseur_hold",
        "validation_interne_hold",
        "fiche_contient_elements_a_confirmer",
      ].includes(blocker),
    ) &&
    riskFlags.length === 0
  ) {
    return "lane_1_plus_rapide_a_valider";
  }

  if (
    blockers.includes("preuve_livraison_hold") ||
    blockers.includes("preuve_prix_hold") ||
    blockers.includes("droits_images_hold")
  ) {
    return "lane_2_preuves_prix_livraison_droits";
  }

  if (blockers.includes("vendeur_non_valide") || blockers.includes("validation_fournisseur_hold")) {
    return "lane_3_vendeur_a_recontroler";
  }

  return "lane_4_risque_ou_fiche_a_retravailler";
}

function priorityScore(product, blockers, riskFlags) {
  const marginPercent = calculateMarginPercent(product);
  const stock = Number(product.dropshipping?.supplierStock ?? product.stock ?? 0);
  const imageCount = Array.isArray(product.images) ? product.images.length : 0;
  let score = 100;

  score -= blockers.length * 8;
  score -= riskFlags.length * 5;

  if (marginPercent >= 40) {
    score += 10;
  } else if (marginPercent >= 30) {
    score += 4;
  }

  if (stock >= 80) {
    score += 8;
  } else if (stock >= 50) {
    score += 5;
  } else if (stock > 0) {
    score += 2;
  }

  if (product.imageValidation?.status === "verified_source_images") {
    score += 8;
  }

  if (imageCount >= 4) {
    score += 4;
  }

  return Math.max(0, score);
}

function nextActions(blockers) {
  return blockers.map((blocker) => blockerLabels[blocker] ?? `Traiter le blocage: ${blocker}`);
}

function summarizeProduct(product) {
  const blockers = getBlockers(product);
  const riskFlags = detectRiskFlags(product);
  const score = priorityScore(product, blockers, riskFlags);
  const margin = calculateMarginPercent(product);
  const delivery = parseDeliveryWindowDays(product.dropshipping?.deliveryEstimate);
  const lane = laneFor(blockers, riskFlags);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    status: product.status ?? "published",
    categoryId: product.categoryId,
    lane,
    priorityScore: score,
    marginPercent: margin,
    supplierStock: product.dropshipping?.supplierStock ?? product.stock ?? 0,
    supplierPriceCents: product.dropshipping?.supplierPriceCents ?? null,
    salePriceCents: product.dropshipping?.salePriceCents ?? product.price ?? null,
    supplierUrl: product.dropshipping?.supplierUrl ?? null,
    supplierSku: product.dropshipping?.supplierSku ?? null,
    imageStatus: product.imageValidation?.status ?? "unknown",
    imageCount: Array.isArray(product.images) ? product.images.length : 0,
    imageSourceUrl: product.imageValidation?.sourceUrl ?? null,
    delivery,
    riskFlags,
    blockers,
    nextActions: nextActions(blockers),
    publicationDecision:
      blockers.length === 0 ? "ready_review_before_publication" : "hold_until_all_actions_done",
  };
}

function countBy(values) {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function csv(products) {
  const headers = [
    "priorityScore",
    "lane",
    "name",
    "categoryId",
    "marginPercent",
    "supplierStock",
    "supplierUrl",
    "supplierSku",
    "blockers",
    "nextActions",
  ];
  const rows = products.map((product) =>
    headers.map((header) => csvEscape(product[header])).join(","),
  );

  return `${headers.join(",")}\n${rows.join("\n")}\n`;
}

function markdown(payload) {
  const lines = [
    "# Tableau d'action brouillons partenaires - Maxi Trouvaille",
    "",
    `Date: ${payload.generatedAt}`,
    "",
    "## Synthese",
    "",
    `- Produits partenaires: ${payload.partnerProductCount}`,
    `- Brouillons partenaires: ${payload.draftPartnerCount}`,
    `- Prets publication directe: ${payload.readyReviewCount}`,
    `- Top prioritaire affiche: ${payload.topLimit}`,
    "",
    "## Files de travail",
    "",
    ...Object.entries(payload.byLane).map(([lane, count]) => `- ${lane}: ${count}`),
    "",
    "## Top produits a debloquer",
    "",
    "| # | Produit | File | Score | Bloquants principaux |",
    "|---|---|---|---:|---|",
    ...payload.topQueue.map((product, index) =>
      [
        `| ${index + 1}`,
        product.name,
        product.lane,
        product.priorityScore,
        `${product.blockers.slice(0, 4).join(", ")} |`,
      ].join(" | "),
    ),
    "",
    "## Bloquants globaux",
    "",
    ...Object.entries(payload.blockers).map(([blocker, count]) => `- ${blocker}: ${count}`),
    "",
    "## Prochain pas",
    "",
    "Traiter d'abord la file `lane_1_plus_rapide_a_valider`, puis completer les preuves livraison/prix/droits des fiches en `lane_2_preuves_prix_livraison_droits`.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

const products = readProducts();
const partnerProducts = products.filter(isPartnerProduct);
const summaries = partnerProducts
  .map(summarizeProduct)
  .sort((a, b) => {
    const laneCompare = a.lane.localeCompare(b.lane);
    if (laneCompare !== 0) {
      return laneCompare;
    }

    return b.priorityScore - a.priorityScore || a.name.localeCompare(b.name, "fr");
  });

const generatedAt = new Date().toISOString();
const dateKey = generatedAt.slice(0, 10).replace(/-/g, "");
const payload = {
  ok: true,
  generatedAt,
  mode: "read_only_publication_action_board",
  quickProductsPath,
  partnerProductCount: partnerProducts.length,
  draftPartnerCount: summaries.filter((product) => product.status === "draft").length,
  readyReviewCount: summaries.filter((product) => product.publicationDecision === "ready_review_before_publication").length,
  topLimit,
  byLane: countBy(summaries.map((product) => product.lane)),
  byCategory: countBy(summaries.map((product) => product.categoryId)),
  blockers: countBy(summaries.flatMap((product) => product.blockers)),
  riskFlags: countBy(summaries.flatMap((product) => product.riskFlags)),
  topQueue: summaries.filter((product) => product.status === "draft").slice(0, topLimit),
  products: summaries,
  safety: {
    noWriteToCatalog: true,
    noPublication: true,
    noSupplierOrder: true,
    noPayment: true,
  },
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `ACTION_BOARD_PARTENAIRES_${dateKey}.json`);
const mdPath = path.join(outputDir, `ACTION_BOARD_PARTENAIRES_${dateKey}.md`);
const csvPath = path.join(outputDir, `ACTION_BOARD_PARTENAIRES_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(payload), "utf8");
fs.writeFileSync(csvPath, csv(summaries), "utf8");

console.log(
  JSON.stringify(
    {
      ok: payload.ok,
      mode: payload.mode,
      partnerProductCount: payload.partnerProductCount,
      draftPartnerCount: payload.draftPartnerCount,
      readyReviewCount: payload.readyReviewCount,
      byLane: payload.byLane,
      blockers: payload.blockers,
      files: { jsonPath, mdPath, csvPath },
      safety: payload.safety,
    },
    null,
    2,
  ),
);

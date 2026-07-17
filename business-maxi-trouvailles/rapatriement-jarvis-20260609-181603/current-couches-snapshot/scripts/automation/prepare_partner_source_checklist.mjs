import fs from "node:fs";
import path from "node:path";

const quickProductsPath = path.join(process.cwd(), "data", "quick-products.json");
const topArg = process.argv.find((arg) => arg.startsWith("--top="));
const formatArg = process.argv.find((arg) => arg.startsWith("--format="));
const topLimit = topArg ? Math.max(1, Number(topArg.split("=")[1]) || 12) : 12;
const outputFormat = formatArg ? String(formatArg.split("=")[1] ?? "json") : "json";

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

function getUrlHost(value) {
  try {
    return new URL(String(value)).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function getUrlKind(value) {
  const url = String(value ?? "");
  const normalized = normalizeText(url);

  if (!url || !/^https?:\/\//i.test(url)) {
    return "missing";
  }

  if (
    normalized.includes("searchtext=") ||
    normalized.includes("/wholesale") ||
    normalized.includes("search?")
  ) {
    return "search_or_listing_to_confirm";
  }

  if (/\/item\/\d+\.html/i.test(url) || /\/item\/\d+/i.test(url)) {
    return "candidate_product_page";
  }

  return "page_to_confirm";
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

function isVerifiedStatus(value) {
  const status = normalizeText(value);

  return (
    status.includes("verified") ||
    status.includes("valide") ||
    status.includes("proof_ok") ||
    status.includes("ok")
  );
}

function calculateMarginPercent(product) {
  const sale = Number(product?.dropshipping?.salePriceCents ?? product?.price ?? 0);
  const supplier = Number(product?.dropshipping?.supplierPriceCents ?? 0);

  if (!Number.isFinite(sale) || !Number.isFinite(supplier) || sale <= 0 || supplier <= 0) {
    return null;
  }

  return Math.round(((sale - supplier) / sale) * 100);
}

function supplierNeedsProof(product) {
  const dropshipping = product.dropshipping ?? {};
  const supplierName = normalizeText(dropshipping.supplierName);
  const validationStatus = normalizeText(product.internalSourcing?.validationStatus);
  const checks = Array.isArray(dropshipping.validationGate?.checks)
    ? dropshipping.validationGate.checks.map(normalizeText).join(" ")
    : "";

  if (!dropshipping.supplierUrl || !/^https?:\/\//i.test(dropshipping.supplierUrl)) {
    return "lien_fournisseur_absent";
  }

  if (
    supplierName.includes("a verifier") ||
    supplierName.includes("annonce exacte") ||
    supplierName.includes("fournisseur partenaire")
  ) {
    return "vendeur_a_identifier";
  }

  if (validationStatus.includes("hold") || validationStatus.includes("verifier")) {
    return "validation_interne_hold";
  }

  if (!checks.includes("vendeur fiable") && !checks.includes("supplier reliable")) {
    return "preuve_vendeur_fiable_absente";
  }

  return null;
}

function buildEvidenceTasks(product) {
  const dropshipping = product.dropshipping ?? {};
  const sourceVerification = product.sourceVerification ?? {};
  const imageValidation = product.imageValidation ?? {};
  const delivery = parseDeliveryWindowDays(dropshipping.deliveryEstimate);
  const supplierIssue = supplierNeedsProof(product);
  const supplierUrlKind = getUrlKind(dropshipping.supplierUrl);
  const tasks = [];

  if (supplierUrlKind !== "candidate_product_page") {
    tasks.push({
      id: "supplier_listing",
      label: "Trouver la fiche fournisseur exacte",
      reason: supplierUrlKind,
      expectedEvidence: "URL produit publique stable + identifiant annonce/SKU.",
    });
  }

  if (supplierIssue) {
    tasks.push({
      id: "seller_reliability",
      label: "Prouver le vendeur fiable",
      reason: supplierIssue,
      expectedEvidence: "Nom vendeur, anciennete/avis visibles, note ou signal public exploitable.",
    });
  }

  if (!delivery.ok || !isVerifiedStatus(sourceVerification.deliveryStatus)) {
    tasks.push({
      id: "delivery_window",
      label: "Prouver livraison France/Europe 3 a 7 jours",
      reason: sourceVerification.deliveryStatus ?? delivery.reason,
      expectedEvidence: "Capture ou note publique sans connexion confirmant pays, delai et transporteur.",
    });
  }

  if (!isVerifiedStatus(sourceVerification.priceStatus)) {
    tasks.push({
      id: "supplier_price",
      label: "Prouver le prix fournisseur actuel",
      reason: sourceVerification.priceStatus ?? "prix_non_prouve",
      expectedEvidence: "Prix produit + variante exacte + devise + frais visibles.",
    });
  }

  if (!dropshipping.supplierSku && !dropshipping.validationGate?.candidateId) {
    tasks.push({
      id: "variant_match",
      label: "Relier la variante exacte a la fiche boutique",
      reason: "sku_ou_candidate_id_absent",
      expectedEvidence: "SKU/candidateId et variante couleur/taille/matiere coherents avec la fiche.",
    });
  }

  if (
    imageValidation.status !== "verified_source_images" ||
    !imageValidation.sourceUrl ||
    !isVerifiedStatus(sourceVerification.rightsStatus)
  ) {
    tasks.push({
      id: "image_rights",
      label: "Verifier coherence et droits images",
      reason: sourceVerification.rightsStatus ?? imageValidation.status ?? "images_non_prouvees",
      expectedEvidence: "Source images publique, correspondance produit, statut droits/usage a valider.",
    });
  }

  return tasks;
}

function buildChecklistItem(product) {
  const tasks = buildEvidenceTasks(product);
  const marginPercent = calculateMarginPercent(product);
  const sourceVerification = product.sourceVerification ?? {};
  const dropshipping = product.dropshipping ?? {};
  const supplierStock = Number(dropshipping.supplierStock ?? product.stock ?? 0);
  const sourceRank = Number(sourceVerification.sourceRank ?? 99);
  let priorityScore = 100 - tasks.length * 12;

  if (marginPercent !== null && marginPercent >= 40) {
    priorityScore += 8;
  } else if (marginPercent !== null && marginPercent >= 30) {
    priorityScore += 3;
  }

  if (supplierStock >= 80) {
    priorityScore += 7;
  } else if (supplierStock >= 40) {
    priorityScore += 4;
  } else if (supplierStock > 0) {
    priorityScore += 2;
  }

  if (sourceRank <= 5) {
    priorityScore += 6;
  } else if (sourceRank <= 10) {
    priorityScore += 3;
  }

  return {
    slug: product.slug,
    name: product.name,
    status: product.status ?? "published",
    categoryId: product.categoryId,
    priorityScore: Math.max(0, priorityScore),
    marginPercent,
    supplierStock,
    supplier: {
      name: dropshipping.supplierName ?? null,
      host: getUrlHost(dropshipping.supplierUrl),
      urlKind: getUrlKind(dropshipping.supplierUrl),
      sku: dropshipping.supplierSku ?? null,
      candidateId: dropshipping.validationGate?.candidateId ?? null,
    },
    publicEvidence: {
      sourceRank: sourceVerification.sourceRank ?? null,
      sourceSignal: sourceVerification.sourceSignal ?? null,
      sourcePriceRange: sourceVerification.sourcePriceRange ?? null,
      productHost: getUrlHost(sourceVerification.productUrl ?? dropshipping.supplierUrl),
      evidenceHost: getUrlHost(sourceVerification.evidenceUrl),
      detailHost: getUrlHost(sourceVerification.findNicheDetailUrl),
      deliveryStatus: sourceVerification.deliveryStatus ?? null,
      priceStatus: sourceVerification.priceStatus ?? null,
      rightsStatus: sourceVerification.rightsStatus ?? null,
    },
    tasks,
    suggestedNextAction:
      tasks.length === 0
        ? "recontrole_final_avant_publication_manuelle"
        : "collecter_preuves_publiques_puis_relancer_catalog_proof_checklist",
  };
}

function renderMarkdown(output) {
  const lines = [
    "# Checklist preuves partenaires",
    "",
    `Date: ${output.checkedAt}`,
    "",
    `Mode: ${output.mode}`,
    `Produits partenaires en brouillon: ${output.draftPartnerCount}`,
    `Produits dans cette checklist: ${output.items.length}`,
    "",
    "Actions bloquees: publication, paiement, commande, connexion compte, suppression.",
    "",
  ];

  output.items.forEach((item, index) => {
    lines.push(`## ${index + 1}. ${item.name}`);
    lines.push("");
    lines.push(`- Slug: \`${item.slug}\``);
    lines.push(`- Score reprise: ${item.priorityScore}`);
    lines.push(`- Marge estimee: ${item.marginPercent ?? "n/a"}%`);
    lines.push(`- Stock fournisseur: ${item.supplierStock}`);
    lines.push(`- Source: ${item.supplier.host ?? "n/a"} (${item.supplier.urlKind})`);
    lines.push(`- Preuve externe: ${item.publicEvidence.evidenceHost ?? "n/a"}`);
    lines.push(`- Action conseillee: ${item.suggestedNextAction}`);
    lines.push("");

    item.tasks.forEach((task) => {
      lines.push(`- [ ] ${task.label} - ${task.expectedEvidence} (${task.reason})`);
    });

    lines.push("");
  });

  return lines.join("\n");
}

const products = readProducts();
const partnerDrafts = products
  .filter(isPartnerProduct)
  .filter((product) => (product.status ?? "published") === "draft");
const items = partnerDrafts
  .map(buildChecklistItem)
  .sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }

    if (a.tasks.length !== b.tasks.length) {
      return a.tasks.length - b.tasks.length;
    }

    return String(a.slug).localeCompare(String(b.slug));
  })
  .slice(0, topLimit);

const output = {
  ok: true,
  checkedAt: new Date().toISOString(),
  mode: "read_only_source_proof_preparation",
  partnerProductCount: products.filter(isPartnerProduct).length,
  draftPartnerCount: partnerDrafts.length,
  items,
  safety: {
    noWrite: true,
    noPayment: true,
    noOrder: true,
    noAccountLogin: true,
    noExternalPublication: true,
    noProductPublication: true,
    noDeletion: true,
  },
};

if (outputFormat === "markdown" || outputFormat === "md") {
  console.log(renderMarkdown(output));
} else {
  console.log(JSON.stringify(output, null, 2));
}

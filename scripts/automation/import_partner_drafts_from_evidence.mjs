import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const evidenceDir = path.join(
  root,
  "business-maxi-trouvailles",
  "produits-a-valider",
  "brouillons-directs",
);
const quickProductsPath = path.join(root, "data", "quick-products.json");
const applyChanges = process.argv.includes("--apply");
const inputArg = process.argv.find((arg) => arg.startsWith("--input="));
const backlogArg = process.argv.find((arg) => arg.startsWith("--backlog="));

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function latestFile(dir, prefix) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Directory not found: ${dir}`);
  }

  const matches = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith(".json"))
    .map((entry) => {
      const fullPath = path.join(dir, entry.name);
      return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (matches.length === 0) {
    throw new Error(`No ${prefix}*.json file found in ${dir}`);
  }

  return matches[0].fullPath;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 72);
}

function shortHash(value) {
  let hash = 0;
  for (const char of String(value)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash.toString(36).slice(0, 6);
}

function isUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isMissingText(value) {
  const text = normalizeText(value);
  return (
    text.length < 3 ||
    text.includes("a renseigner") ||
    text.includes("a verifier") ||
    text.includes("a valider") ||
    text.includes("unknown") ||
    text.includes("todo")
  );
}

function parseDeliveryWindowDays(value) {
  const text = normalizeText(value);

  if (!text) {
    return { ok: false, reason: "delai_absent" };
  }

  if (text.includes("verifier") || text.includes("confirmer") || text.includes("a valider")) {
    return { ok: false, reason: "delai_non_prouve" };
  }

  const numbers = [...text.matchAll(/\d+/g)].map((match) => Number(match[0]));
  if (numbers.length === 0) {
    return { ok: false, reason: "delai_sans_nombre" };
  }

  const minDays = Math.min(...numbers);
  const maxDays = Math.max(...numbers);

  if (minDays < 2) {
    return { ok: false, reason: "delai_trop_beau_a_recontroler", minDays, maxDays };
  }

  if (maxDays > 14) {
    return { ok: false, reason: "delai_trop_long", minDays, maxDays };
  }

  return { ok: true, minDays, maxDays };
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function calculateSalePriceCents(supplierPriceCents) {
  const targetMarginPrice = Math.ceil(supplierPriceCents / 0.6);
  const handlingPrice = supplierPriceCents + 150;
  const rawTarget = Math.max(targetMarginPrice, handlingPrice);
  return Math.ceil((rawTarget + 10) / 100) * 100 - 10;
}

function marginPercent(salePriceCents, supplierPriceCents) {
  return Math.round(((salePriceCents - supplierPriceCents) / salePriceCents) * 100);
}

function duplicateInfo(entry, existingProducts) {
  const slug = `${slugify(entry.name)}-hold`;
  const normalizedName = normalizeText(entry.name);
  const normalizedSku = normalizeText(entry.supplierSku);
  const matches = [];

  for (const product of existingProducts) {
    const sameSku =
      normalizedSku &&
      normalizeText(product?.dropshipping?.supplierSku).replace(/^ae /, "") === normalizedSku;
    const sameSlug = normalizeText(product.slug) === normalizeText(slug);
    const sameName = normalizeText(product.name) === normalizedName;

    if (sameSku || sameSlug || sameName) {
      matches.push({
        id: product.id,
        slug: product.slug,
        name: product.name,
        reason: sameSku ? "same_supplier_sku" : sameSlug ? "same_slug" : "same_name",
      });
    }
  }

  return { slug, matches };
}

function validateEntry(entry, existingProducts) {
  const blockers = [];
  const exactImageUrls = uniqueValues(entry.exactImageUrls ?? []);
  const supplierPriceCents = Number(entry.supplierPriceCents);
  const supplierStock = Number(entry.supplierStock);
  const delivery = parseDeliveryWindowDays(entry.deliveryToFrance);
  const duplicates = duplicateInfo(entry, existingProducts);

  if (!entry.readyForQuickProductsDraft) {
    blockers.push("readyForQuickProductsDraft_false");
  }

  if (!entry.name || String(entry.name).trim().length < 8) {
    blockers.push("titre_absent_ou_trop_court");
  }

  if (!validPartnerCategories.has(entry.targetCategoryId)) {
    blockers.push("categorie_partenaire_invalide");
  }

  if (!isUrl(entry.exactProductUrl)) {
    blockers.push("url_produit_exacte_invalide");
  }

  if (isMissingText(entry.exactVariant)) {
    blockers.push("variante_exacte_absente");
  }

  if (exactImageUrls.length === 0) {
    blockers.push("images_exactes_absentes");
  }

  for (const imageUrl of exactImageUrls) {
    if (!isUrl(imageUrl)) {
      blockers.push("image_url_invalide");
    }

    if (imageUrl.includes("/uploads/category-images/") || imageUrl.includes("placeholder")) {
      blockers.push("image_generique_refusee");
    }
  }

  if (isMissingText(entry.supplierName)) {
    blockers.push("nom_fournisseur_absent");
  }

  if (isMissingText(entry.supplierSku)) {
    blockers.push("sku_fournisseur_absent");
  }

  if (!Number.isInteger(supplierPriceCents) || supplierPriceCents <= 0) {
    blockers.push("prix_fournisseur_invalide");
  }

  if (!Number.isInteger(supplierStock) || supplierStock <= 0) {
    blockers.push("stock_fournisseur_invalide");
  }

  if (!delivery.ok) {
    blockers.push(delivery.reason);
  }

  if (isMissingText(entry.deliveryEvidence)) {
    blockers.push("preuve_livraison_absente");
  }

  if (isMissingText(entry.imageRightsEvidence) || String(entry.imageRightsEvidence).trim().length < 12) {
    blockers.push("preuve_droits_images_absente");
  }

  if (duplicates.matches.length > 0) {
    blockers.push("doublon_catalogue_probable");
  }

  return {
    id: entry.id,
    name: entry.name,
    targetCategoryId: entry.targetCategoryId,
    readyForDraftImport: blockers.length === 0,
    blockers: [...new Set(blockers)],
    duplicateMatches: duplicates.matches,
    delivery,
    slug: duplicates.slug,
    imageCount: exactImageUrls.length,
  };
}

function buildProduct(entry, backlogEntry, audit) {
  const exactImageUrls = uniqueValues(entry.exactImageUrls);
  const supplierPriceCents = Number(entry.supplierPriceCents);
  const supplierStock = Number(entry.supplierStock);
  const salePriceCents = calculateSalePriceCents(supplierPriceCents);
  const marginCents = salePriceCents - supplierPriceCents;
  const today = new Date().toISOString().slice(0, 10);
  const idDate = today.replace(/-/g, "");
  const id = `ali_partner_${idDate}_${slugify(entry.name).replace(/-/g, "_")}_${shortHash(
    `${entry.id}:${entry.supplierSku}:${entry.exactProductUrl}`,
  )}`;

  return {
    id,
    slug: audit.slug,
    name: entry.name,
    categoryId: entry.targetCategoryId,
    condition: "Neuf - fournisseur partenaire",
    stock: supplierStock,
    badge: "Dropshipping HOLD",
    image: exactImageUrls[0],
    images: exactImageUrls,
    shortDescription: `Produit partenaire prepare pour Maxi Trouvaille, variante ${entry.exactVariant}.`,
    description:
      "Produit partenaire integre en brouillon avec preuves fournisseur renseignees. La publication reste bloquee jusqu au recontrole humain final: vendeur, delai, stock, prix, conformite, droits images et variante exacte.",
    features: [
      `Variante exacte: ${entry.exactVariant}`,
      `Livraison fournisseur constatee: ${entry.deliveryToFrance}`,
      "Produit expedie par partenaire logistique apres validation",
      "Paiement client Maxi Trouvaille uniquement apres publication validee",
      "Publication bloquee tant que le controle final n est pas fait",
    ],
    livraisonDisponible: "colissimo uniquement",
    source: "internal",
    status: "draft",
    compareAtPrice: Math.max(salePriceCents + 300, Math.ceil(salePriceCents * 1.2)),
    dropshipping: {
      enabled: true,
      supplierName: entry.supplierName,
      supplierUrl: entry.exactProductUrl,
      supplierSku: entry.supplierSku,
      supplierPriceCents,
      supplierStock,
      deliveryEstimate: entry.deliveryToFrance,
      isPromotion: false,
      isNew: true,
      logisticsPartnerLabel: "partenaire logistique",
      salePriceCents,
      marginCents,
      syncStatus: "manual_hold",
      lastSyncAt: today,
      validationGate: {
        source: "Evidence template Maxi Trouvaille",
        checkedAt: today,
        checks: [
          "URL produit exacte renseignee",
          "Variante exacte renseignee",
          "Images exactes renseignees",
          "Prix, stock et delai renseignes",
          "Import en brouillon HOLD uniquement",
        ],
        candidateId: entry.id,
        candidateCategory: entry.targetCategoryId,
        note: "Publication interdite tant que le controle humain final n est pas valide.",
      },
    },
    internalSourcing: {
      evidenceUrl: entry.exactProductUrl,
      evidenceNote: entry.deliveryEvidence,
      markupPercent: marginPercent(salePriceCents, supplierPriceCents),
      pricingRule: `Prix fournisseur ${supplierPriceCents} cents, prix boutique calcule ${salePriceCents} cents, marge brute estimee ${marginPercent(
        salePriceCents,
        supplierPriceCents,
      )}% avant frais/retours/taxes.`,
      validationStatus:
        "DRAFT_HOLD_PUBLICATION - preuves import renseignees, controle humain final obligatoire avant publication.",
      sourceCandidateId: backlogEntry?.id ?? entry.id,
      importedFromEvidenceAt: new Date().toISOString(),
    },
    price: salePriceCents,
    imageValidation: {
      status: "verified_source_images",
      checkedAt: today,
      sourceUrl: entry.exactProductUrl,
      imageCount: exactImageUrls.length,
      reason: "Images exactes renseignees dans le template de preuves pour la variante choisie.",
      nextAction:
        "Recontroler droits images, variante exacte, prix, stock et delai avant passage en published.",
    },
    sourceVerification: {
      status: "evidence_collected_draft_hold",
      checkedAt: today,
      productUrl: entry.exactProductUrl,
      deliveryEvidence: entry.deliveryEvidence,
      imageRightsEvidence: entry.imageRightsEvidence,
      complianceNotes: entry.complianceNotes ?? "",
      deliveryStatus: "evidence_collected",
      priceStatus: "evidence_collected",
      rightsStatus: "evidence_collected",
    },
    seo: {
      title: `${entry.name} | Maxi Trouvaille`.slice(0, 65),
      description: `Produit partenaire Maxi Trouvaille: ${entry.name}. Livraison estimee et suivi colis apres validation.`,
      h1: entry.name,
      h2: `Pourquoi choisir ${entry.name}`,
      keywords: [
        ...new Set(
          `${entry.name} ${entry.targetCategoryId.replace("dropshipping-", "")} maxi trouvaille produit partenaire`
            .split(/\s+/)
            .map((word) => normalizeText(word))
            .filter((word) => word.length >= 3),
        ),
      ].slice(0, 12),
      imageAlt: `${entry.name} - produit partenaire Maxi Trouvaille`,
    },
    imageAlt: `${entry.name} - produit partenaire Maxi Trouvaille`,
  };
}

function countBlockers(audits) {
  return audits.reduce((acc, audit) => {
    for (const blocker of audit.blockers) {
      acc[blocker] = (acc[blocker] ?? 0) + 1;
    }

    return acc;
  }, {});
}

function markdownReport(summary) {
  const lines = [
    "# Import preuves vers brouillons - Maxi Trouvaille",
    "",
    `Date: ${summary.checkedAt}`,
    "",
    `Mode: ${summary.mode}`,
    "",
    "## Synthese",
    "",
    `- Entrees analysees: ${summary.entryCount}`,
    `- Pretes pour import brouillon: ${summary.readyCount}`,
    `- Bloquees: ${summary.blockedCount}`,
    `- Produits importes: ${summary.importedCount}`,
    `- Ecriture catalogue: ${summary.apply.applied ? "oui" : "non"}`,
    "",
    "## Bloquants principaux",
    "",
    ...Object.entries(summary.blockers).map(([blocker, count]) => `- ${blocker}: ${count}`),
    "",
    "## Entrees pretes",
    "",
    ...summary.ready.map((entry) => `- ${entry.name} (${entry.targetCategoryId})`),
    "",
    "## Garde-fous",
    "",
    "- Import en `draft` uniquement.",
    "- Aucun produit publie.",
    "- Aucune commande fournisseur.",
    "- Aucun paiement.",
    "- Backup automatique avant ecriture en mode apply.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

const inputPath = inputArg ? path.resolve(root, inputArg.split("=")[1]) : latestFile(evidenceDir, "evidence_template_");
const backlogPath = backlogArg ? path.resolve(root, backlogArg.split("=")[1]) : latestFile(evidenceDir, "backlog_brouillons_directs_");
const evidence = readJson(inputPath);
const backlogPayload = readJson(backlogPath);
const existingProducts = readJson(quickProductsPath);

if (!Array.isArray(evidence.entries)) {
  throw new Error("Evidence file must contain an entries array.");
}

if (!Array.isArray(existingProducts)) {
  throw new Error("data/quick-products.json must contain an array.");
}

const backlogEntries = new Map((backlogPayload.backlog ?? []).map((entry) => [entry.id, entry]));
const audits = evidence.entries.map((entry) => validateEntry(entry, existingProducts));
const readyAudits = audits.filter((audit) => audit.readyForDraftImport);
const readyProducts = readyAudits.map((audit) => {
  const entry = evidence.entries.find((item) => item.id === audit.id);
  return buildProduct(entry, backlogEntries.get(audit.id), audit);
});

let applySummary = { applied: false, backupPath: null, importedCount: 0 };

if (applyChanges && readyProducts.length > 0) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(root, "backups", `quick-products-before-evidence-import-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, "quick-products.json.bak");
  fs.copyFileSync(quickProductsPath, backupPath);
  fs.writeFileSync(
    quickProductsPath,
    `${JSON.stringify([...readyProducts, ...existingProducts], null, 2)}\n`,
    "utf8",
  );
  applySummary = { applied: true, backupPath, importedCount: readyProducts.length };
}

const checkedAt = new Date().toISOString();
const reportDate = checkedAt.slice(0, 10).replace(/-/g, "");
const summary = {
  ok: true,
  checkedAt,
  mode: applyChanges ? "apply" : "dry_run",
  inputPath,
  backlogPath,
  quickProductsPath,
  entryCount: evidence.entries.length,
  readyCount: readyAudits.length,
  blockedCount: audits.length - readyAudits.length,
  importedCount: applySummary.importedCount,
  blockers: countBlockers(audits),
  ready: readyAudits,
  blocked: audits.filter((audit) => !audit.readyForDraftImport),
  apply: applySummary,
  safety: {
    draftsOnly: true,
    noPublication: true,
    noSupplierOrder: true,
    noPayment: true,
    backupBeforeWrite: true,
  },
};

fs.mkdirSync(evidenceDir, { recursive: true });
const modeSuffix = applyChanges ? "apply" : "dry_run";
const summaryPath = path.join(evidenceDir, `import_evidence_${modeSuffix}_${reportDate}.json`);
const mdPath = path.join(evidenceDir, `import_evidence_${modeSuffix}_${reportDate}.md`);
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      entryCount: summary.entryCount,
      readyCount: summary.readyCount,
      blockedCount: summary.blockedCount,
      importedCount: summary.importedCount,
      blockers: summary.blockers,
      files: { summaryPath, mdPath },
      apply: summary.apply,
      safety: summary.safety,
    },
    null,
    2,
  ),
);

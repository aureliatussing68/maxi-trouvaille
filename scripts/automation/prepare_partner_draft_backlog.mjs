import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const selectionPath = path.join(
  root,
  "business-maxi-trouvailles",
  "produits-a-valider",
  "selection_couche_006_20260527.json",
);
const quickProductsPath = path.join(root, "data", "quick-products.json");
const outputDir = path.join(
  root,
  "business-maxi-trouvailles",
  "produits-a-valider",
  "brouillons-directs",
);

const batchArg = process.argv.find((arg) => arg.startsWith("--batch="));
const immediateBatchSize = batchArg ? Math.max(1, Number(batchArg.split("=")[1]) || 30) : 30;

const categoryMap = {
  animaux: "dropshipping-animaux",
  "auto-moto": "dropshipping-auto-moto",
  "gadgets-jouets": "dropshipping-enfant",
  "high-tech": "dropshipping-high-tech",
  jardin: "dropshipping-maison",
  "jeux-video-gaming": "dropshipping-high-tech",
  "maison-deco": "dropshipping-maison",
  "outillage-electricite": "dropshipping-high-tech",
  "sport-loisirs": "dropshipping-accessoires",
  telephonie: "dropshipping-high-tech",
};

const categoryPriority = {
  "dropshipping-high-tech": 18,
  "dropshipping-accessoires": 15,
  "dropshipping-auto-moto": 14,
  "dropshipping-maison": 13,
  "dropshipping-animaux": 10,
  "dropshipping-enfant": 6,
};

const strongCommercialWords = new Set([
  "support",
  "cable",
  "usb",
  "charge",
  "organisateur",
  "rangement",
  "lampe",
  "led",
  "kit",
  "portable",
  "compact",
  "rechargeable",
  "bureau",
  "voiture",
  "sport",
  "voyage",
  "nettoyage",
]);

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function words(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((word) => word.length >= 3);
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function jaccardScore(a, b) {
  const aWords = new Set(words(a));
  const bWords = new Set(words(b));

  if (aWords.size === 0 || bWords.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const word of aWords) {
    if (bWords.has(word)) {
      intersection += 1;
    }
  }

  const union = new Set([...aWords, ...bWords]).size;
  return intersection / union;
}

function detectRiskFlags(candidate, targetCategoryId) {
  const text = normalizeText([candidate.name, candidate.category].join(" "));
  const flags = [];

  if (targetCategoryId === "dropshipping-enfant" || /\b(enfant|jouet|bebe|drone|stylo 3d)\b/.test(text)) {
    flags.push("controle_securite_enfant");
  }

  if (/\b(usb|charge|rechargeable|led|batterie|lampe|clavier|camera|drone|imprimante)\b/.test(text)) {
    flags.push("controle_electrique_batterie");
  }

  if (/\b(voiture|moto|pneus|recul|siege)\b/.test(text)) {
    flags.push("controle_usage_auto");
  }

  if (/\b(chat|chien|animaux|animal|gamelle|toilettage)\b/.test(text)) {
    flags.push("controle_confort_animal");
  }

  if (/\b(gourde|silicone|evier|cuisine|brosse|gamelle)\b/.test(text)) {
    flags.push("controle_matiere_contact");
  }

  return [...new Set(flags)];
}

function commercialScore(candidate, targetCategoryId, riskFlags) {
  const candidateWords = words(candidate.name);
  const commercialHits = candidateWords.filter((word) => strongCommercialWords.has(word)).length;
  const priority = categoryPriority[targetCategoryId] ?? 8;
  const riskPenalty = riskFlags.length * 4;

  return Math.max(0, 50 + priority + commercialHits * 3 - riskPenalty);
}

function detectDuplicates(candidate, existingProducts) {
  const candidateName = normalizeText(candidate.name);
  const matches = [];

  for (const product of existingProducts) {
    const productName = normalizeText(product.name);
    const productSlug = normalizeText(product.slug);
    const score = Math.max(
      jaccardScore(candidateName, productName),
      jaccardScore(candidateName, productSlug),
    );
    const sharedWords = words(candidateName).filter((word) => words(productName).includes(word));
    const isLikelyDuplicate =
      score >= 0.48 ||
      (sharedWords.length >= 3 && (candidateName.includes(productName) || productName.includes(candidateName)));

    if (isLikelyDuplicate) {
      matches.push({
        id: product.id,
        slug: product.slug,
        name: product.name,
        status: product.status ?? "published",
        categoryId: product.categoryId,
        score: Number(score.toFixed(2)),
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 3);
}

function buildDraftTemplate(candidate, targetCategoryId) {
  const slug = `${slugify(candidate.name)}-partenaire-hold`;

  return {
    id: `pending_${candidate.id}`,
    slug,
    name: candidate.name,
    categoryId: targetCategoryId,
    condition: "Neuf - fournisseur partenaire",
    stock: 0,
    badge: "Dropshipping HOLD",
    image: null,
    images: [],
    shortDescription: `Brouillon interne pour ${candidate.name}. A ne pas publier avant preuve fournisseur complete.`,
    description:
      "Brouillon dropshipping en attente de validation. La fiche finale doit reprendre uniquement la variante exacte, les photos exactes, le prix fournisseur reel, le delai France/Europe et les conditions fournisseur verifiees.",
    features: [
      "Brouillon direct prepare pour Maxi Trouvaille",
      "Image exacte obligatoire avant ecriture catalogue",
      "Variante exacte obligatoire avant vente",
      "Prix, stock et delai fournisseur a prouver",
    ],
    livraisonDisponible: "colissimo uniquement",
    source: "internal",
    status: "draft",
    dropshipping: {
      enabled: false,
      supplierName: "A renseigner apres validation",
      supplierUrl: null,
      supplierSku: null,
      supplierPriceCents: null,
      supplierStock: null,
      deliveryEstimate: "A prouver avant publication",
      isPromotion: false,
      isNew: true,
      logisticsPartnerLabel: "partenaire logistique",
      salePriceCents: null,
      marginCents: null,
      syncStatus: "manual_hold",
    },
    imageValidation: {
      status: "hold",
      sourceUrl: null,
      imageCount: 0,
      nextAction:
        "Ajouter URL produit exacte, images exactes de la bonne variante, preuve droits images, prix, stock et delai avant integration catalogue.",
    },
    sourceVerification: {
      status: "blocked_until_exact_evidence",
      deliveryStatus: "missing",
      priceStatus: "missing",
      rightsStatus: "missing",
    },
  };
}

function buildBacklogEntry(candidate, existingProducts) {
  const targetCategoryId = categoryMap[candidate.category] ?? "dropshipping-nouveautes";
  const duplicateMatches = detectDuplicates(candidate, existingProducts);
  const riskFlags = detectRiskFlags(candidate, targetCategoryId);
  const score = commercialScore(candidate, targetCategoryId, riskFlags);
  const importBlockers = [
    "url_produit_exacte_absente",
    "images_exactes_variante_absentes",
    "preuve_droits_images_absente",
    "prix_fournisseur_reel_absent",
    "delai_livraison_france_absent",
    "stock_fournisseur_non_prouve",
    "validation_humaine_mouss_absente",
  ];

  return {
    id: candidate.id,
    sourceStatus: candidate.status,
    catalogWriteStatus:
      duplicateMatches.length > 0 ? "possible_duplicate_review_required" : "blocked_until_exact_evidence",
    safeToWriteQuickProducts: false,
    reason:
      duplicateMatches.length > 0
        ? "Produit proche deja present: verifier avant de creer un doublon."
        : "Pret pour collecte de preuves, mais pas encore ecrit dans data/quick-products.json.",
    name: candidate.name,
    sourceCategory: candidate.category,
    targetCategoryId,
    supplierSearchUrl: candidate.supplierSearchUrl,
    deliveryTarget: candidate.deliveryTarget,
    sellingAngle: candidate.sellingAngle,
    commercialScore: score,
    riskFlags,
    duplicateMatches,
    importBlockers,
    requiredEvidence: {
      exactProductUrl: "",
      exactVariant: "",
      exactImageUrls: [],
      supplierName: "",
      supplierSku: "",
      supplierPriceCents: null,
      supplierStock: null,
      deliveryToFrance: "",
      deliveryEvidence: "",
      imageRightsEvidence: "",
      complianceNotes: "",
      moussValidation: false,
    },
    marginPolicy: {
      mode: "fixed_plus_percent_then_psychological_rounding",
      targetMarginPercent: 40,
      minimumGrossMarginPercent: 30,
      fixedHandlingCents: 150,
      rounding: "finish_price_with_90_when_possible",
    },
    draftTemplate: buildDraftTemplate(candidate, targetCategoryId),
  };
}

function countBy(entries, key) {
  return entries.reduce((acc, entry) => {
    const value = entry[key] ?? "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function markdownReport(payload) {
  const lines = [
    "# Couche brouillons directs - Maxi Trouvaille",
    "",
    `Date: ${payload.generatedAt}`,
    "",
    "But: preparer beaucoup de brouillons produits sans casser le catalogue public.",
    "",
    "## Synthese",
    "",
    `- Candidats source analyses: ${payload.sourceCandidateCount}`,
    `- Brouillons backlog crees: ${payload.backlogCount}`,
    `- Lot immediat prioritaire: ${payload.immediateBatch.length}`,
    `- Produits deja dans le catalogue rapide: ${payload.currentQuickProductCount}`,
    `- Ecriture dans data/quick-products.json: non`,
    "",
    "## Garde-fous",
    "",
    "- Aucune publication produit.",
    "- Aucune commande fournisseur.",
    "- Aucun paiement fournisseur.",
    "- Aucun produit sans photo exacte ajoute au catalogue public.",
    "- Les fiches restent bloquees jusqu aux preuves: URL produit exacte, variante, images exactes, prix, stock, delai France/Europe, droits images.",
    "",
    "## Lot immediat prioritaire",
    "",
    "| # | Produit | Categorie cible | Score | Statut |",
    "|---|---|---|---:|---|",
    ...payload.immediateBatch.map(
      (entry, index) =>
        `| ${index + 1} | ${entry.name} | ${entry.targetCategoryId} | ${entry.commercialScore} | ${entry.catalogWriteStatus} |`,
    ),
    "",
    "## Repartition par categorie cible",
    "",
    ...Object.entries(payload.categories).map(([category, count]) => `- ${category}: ${count}`),
    "",
    "## Prochaine action",
    "",
    "Ouvrir le fichier JSON, completer les preuves des produits du lot immediat, puis importer uniquement les fiches dont toutes les preuves sont remplies.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

function evidenceTemplate(entries) {
  return {
    generatedAt: new Date().toISOString(),
    mode: "evidence_template_for_future_catalog_import",
    instructions:
      "Completer seulement avec des preuves reelles. Ne pas mettre de fausses URLs ni de photos generiques.",
    entries: entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      targetCategoryId: entry.targetCategoryId,
      exactProductUrl: "",
      exactVariant: "",
      exactImageUrls: [],
      supplierName: "",
      supplierSku: "",
      supplierPriceCents: null,
      supplierStock: null,
      deliveryToFrance: "",
      deliveryEvidence: "",
      imageRightsEvidence: "",
      complianceNotes: "",
      moussValidation: false,
      readyForQuickProductsDraft: false,
    })),
  };
}

const selection = readJson(selectionPath, null);
if (!selection || !Array.isArray(selection.candidates)) {
  throw new Error(`Selection candidates not found or invalid: ${selectionPath}`);
}

const existingProducts = readJson(quickProductsPath, []);
if (!Array.isArray(existingProducts)) {
  throw new Error("data/quick-products.json must contain an array.");
}

const generatedAt = new Date().toISOString();
const dateKey = generatedAt.slice(0, 10).replace(/-/g, "");
const backlog = selection.candidates
  .map((candidate) => buildBacklogEntry(candidate, existingProducts))
  .sort((a, b) => {
    if (a.catalogWriteStatus !== b.catalogWriteStatus) {
      return a.catalogWriteStatus === "blocked_until_exact_evidence" ? -1 : 1;
    }

    if (b.commercialScore !== a.commercialScore) {
      return b.commercialScore - a.commercialScore;
    }

    return a.name.localeCompare(b.name, "fr");
  });

const immediateBatch = backlog.slice(0, immediateBatchSize);
const payload = {
  generatedAt,
  mode: "direct_draft_backlog_no_catalog_write",
  sourceSelectionPath: selectionPath,
  quickProductsPath,
  sourceCandidateCount: selection.candidates.length,
  currentQuickProductCount: existingProducts.length,
  backlogCount: backlog.length,
  immediateBatchSize,
  categories: countBy(backlog, "targetCategoryId"),
  statuses: countBy(backlog, "catalogWriteStatus"),
  immediateBatch,
  backlog,
  safety: {
    noQuickProductsWrite: true,
    noPublication: true,
    noSupplierOrder: true,
    noPayment: true,
    exactImagesRequiredBeforeCatalogWrite: true,
  },
};

fs.mkdirSync(outputDir, { recursive: true });

const jsonPath = path.join(outputDir, `backlog_brouillons_directs_${dateKey}.json`);
const mdPath = path.join(outputDir, `backlog_brouillons_directs_${dateKey}.md`);
const templatePath = path.join(outputDir, `evidence_template_brouillons_directs_${dateKey}.json`);

fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(payload), "utf8");
fs.writeFileSync(templatePath, `${JSON.stringify(evidenceTemplate(immediateBatch), null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: payload.mode,
      sourceCandidateCount: payload.sourceCandidateCount,
      backlogCount: payload.backlogCount,
      immediateBatchCount: payload.immediateBatch.length,
      categories: payload.categories,
      statuses: payload.statuses,
      files: {
        jsonPath,
        mdPath,
        templatePath,
      },
      safety: payload.safety,
    },
    null,
    2,
  ),
);

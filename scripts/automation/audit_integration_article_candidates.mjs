import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const quickProductsPath = path.join(root, "data", "quick-products.json");
const outputRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "audit-integration-articles",
);

const allowedCategoryIds = new Set([
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

const forbiddenLeakPattern =
  /\b(aliexpress|ali\s*express|ae01|supplier|fournisseur:\s*https?|api[_-]?key|token|secret|password|sk-)/i;

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
  if (/[",\n\r;]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function hasText(value) {
  return String(value ?? "").trim().length > 0;
}

function parseTargetMargin(product) {
  const pricingRule = product.internalSourcing?.pricingRule ?? "";
  const match = pricingRule.match(/marge cible ([0-9]+(?:\.[0-9]+)?) EUR \(([0-9]+)%\)/i);

  if (!match) {
    return {
      targetMarginCents: null,
      targetMarginRate: null,
      label: "a verifier",
    };
  }

  return {
    targetMarginCents: Math.round(Number(match[1]) * 100),
    targetMarginRate: Number(match[2]),
    label: `${match[1]} EUR (${match[2]}%)`,
  };
}

function blockerList(product) {
  const blockers = [];
  const image = product.image ?? "";
  const images = Array.isArray(product.images) ? product.images : [];
  const dropshipping = product.dropshipping ?? {};
  const imageStatus = String(product.imageValidation?.status ?? "");
  const sourceStatus = String(product.sourceVerification?.status ?? "");
  const internalStatus = String(product.internalSourcing?.validationStatus ?? "");
  const textForLeakScan = [
    product.name,
    product.shortDescription,
    product.description,
    ...(Array.isArray(product.features) ? product.features : []),
    product.imageAlt,
    product.seo?.description,
    product.seo?.imageAlt,
    dropshipping.supplierName,
    dropshipping.supplierUrl,
    dropshipping.supplierSku,
    product.sourceVerification?.productUrl,
    product.sourceVerification?.evidenceUrl,
  ].join(" ");

  if (product.status !== "draft") blockers.push("status_not_draft");
  if (product.source !== "internal") blockers.push("source_not_internal");
  if (!allowedCategoryIds.has(product.categoryId)) blockers.push("category_not_in_dropshipping_focus");
  if (!dropshipping.enabled) blockers.push("dropshipping_disabled");
  if (hasText(dropshipping.supplierUrl)) blockers.push("supplier_url_present_before_proof");
  if (hasText(dropshipping.supplierSku)) blockers.push("supplier_sku_present_before_proof");
  if ((dropshipping.supplierPriceCents ?? 0) !== 0) blockers.push("supplier_price_present_before_proof");
  if ((dropshipping.supplierStock ?? 0) !== 0) blockers.push("supplier_stock_present_before_proof");
  if ((dropshipping.marginCents ?? 0) !== 0) blockers.push("validated_margin_present_before_proof");
  if (product.stock !== 0) blockers.push("stock_not_zero_while_hold");
  if (!Number.isFinite(product.price) || product.price <= 0) blockers.push("target_price_missing");
  if (!image.startsWith("/uploads/category-images/")) blockers.push("main_image_not_local_category_placeholder");
  if (images.some((entry) => !String(entry).startsWith("/uploads/category-images/"))) {
    blockers.push("gallery_contains_non_category_placeholder");
  }
  if (/^https?:\/\//i.test(image) || images.some((entry) => /^https?:\/\//i.test(String(entry)))) {
    blockers.push("remote_image_present");
  }
  if (!imageStatus.toLowerCase().includes("hold")) blockers.push("image_validation_not_hold");
  if (hasText(product.imageValidation?.sourceUrl)) blockers.push("image_source_url_present_before_proof");
  if (!sourceStatus.toLowerCase().includes("hold")) blockers.push("source_verification_not_hold");
  if (hasText(product.sourceVerification?.productUrl)) blockers.push("source_product_url_present_before_proof");
  if (hasText(product.sourceVerification?.evidenceUrl)) blockers.push("source_evidence_url_present_before_proof");
  if (internalStatus !== "HOLD_INTEGRATION_ARTICLES") blockers.push("internal_status_not_integration_hold");
  if (!hasText(product.internalSourcing?.pricingRule)) blockers.push("pricing_rule_missing");
  if (!hasText(dropshipping.validationGate?.note)) blockers.push("validation_gate_note_missing");
  if (forbiddenLeakPattern.test(textForLeakScan)) blockers.push("forbidden_leak_term_detected");

  return blockers;
}

function nextAction(product, blockers) {
  if (blockers.length > 0) {
    return "Corriger le garde-fou integration avant sourcing.";
  }

  const categoryActions = {
    "dropshipping-accessoires": "Chercher fournisseur Europe/France avec lot exact, photos propres et livraison suivie.",
    "dropshipping-animaux": "Verifier matiere, usage animal, photos exactes et delai court.",
    "dropshipping-auto-moto": "Verifier compatibilite auto, fixation exacte, stock Europe et photos variante.",
    "dropshipping-cuisine": "Verifier contact matiere, dimensions exactes, quantite vendue et droits image.",
    "dropshipping-enfant": "Verifier conformite/securite enfant avant toute priorisation.",
    "dropshipping-high-tech": "Verifier batterie/norme/cable fourni, stock Europe et photos exactes.",
    "dropshipping-maison": "Verifier dimensions, usage reel, photos exactes et delai France/Europe.",
    "dropshipping-mode": "Verifier taille, tissu, couleur, conditionnement et photos exactes.",
  };

  return categoryActions[product.categoryId] ?? "Chercher fournisseur exact et preuves completes.";
}

function scoreCandidate(product, blockers) {
  const margin = parseTargetMargin(product);
  const categoryBonus = {
    "dropshipping-accessoires": 18,
    "dropshipping-cuisine": 16,
    "dropshipping-maison": 15,
    "dropshipping-animaux": 14,
    "dropshipping-auto-moto": 12,
    "dropshipping-high-tech": 10,
    "dropshipping-mode": 9,
    "dropshipping-enfant": 6,
  }[product.categoryId] ?? 8;
  const marginBonus = Math.min(30, Math.round((margin.targetMarginCents ?? 0) / 50));
  const blockerPenalty = blockers.length * 8;

  return Math.max(0, 50 + categoryBonus + marginBonus - blockerPenalty);
}

function markdownReport(payload) {
  const lines = [
    "# Audit integration articles HOLD",
    "",
    `Date: ${payload.generatedAt}`,
    "",
    "## Synthese",
    "",
    `- Candidats integration: ${payload.integrationCandidateCount}`,
    `- Echecs garde-fou: ${payload.failureCount}`,
    `- Candidats prets pour sourcing manuel: ${payload.readyForManualSourcingCount}`,
    `- Statut: ${payload.ok ? "OK_HOLD" : "FAIL_HOLD_GUARD"}`,
    "",
    "## Top sourcing manuel",
    "",
    "| # | Produit | Categorie | Score | Prix cible | Marge cible | Action |",
    "|---|---|---|---:|---:|---:|---|",
    ...payload.sourcingBoard.slice(0, 12).map(
      (item, index) =>
        `| ${index + 1} | ${item.name} | ${item.categoryId} | ${item.priorityScore} | ${item.targetSalePrice} | ${item.targetMargin} | ${item.nextAction} |`,
    ),
    "",
    "## Garde-fous controles",
    "",
    "- Statut `draft` obligatoire.",
    "- Stock catalogue a 0 tant que HOLD.",
    "- Image locale de categorie uniquement, jamais image distante ni fournisseur.",
    "- `imageValidation` et `sourceVerification` doivent rester en HOLD.",
    "- Fournisseur exact, SKU, prix fournisseur reel, stock et marge validee doivent rester vides tant que les preuves manquent.",
    "- Aucune chaine sensible ni lien fournisseur interdit dans les artefacts.",
    "",
  ];

  if (payload.failures.length > 0) {
    lines.push("## Echecs", "");
    for (const failure of payload.failures) {
      lines.push(`- ${failure.name}: ${failure.blockers.join(", ")}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function csvReport(payload) {
  const header = [
    "id",
    "name",
    "categoryId",
    "priorityScore",
    "targetSalePrice",
    "targetMargin",
    "status",
    "blockers",
    "nextAction",
    "image",
  ];
  const rows = payload.sourcingBoard.map((item) =>
    [
      item.id,
      item.name,
      item.categoryId,
      item.priorityScore,
      item.targetSalePrice,
      item.targetMargin,
      item.status,
      item.blockers.join("|"),
      item.nextAction,
      item.image,
    ]
      .map(csvEscape)
      .join(";"),
  );

  return `${header.join(";")}\n${rows.join("\n")}\n`;
}

const generatedAt = new Date().toISOString();
const dateKey = localDateKey();
const quickProducts = readJson(quickProductsPath);

if (!Array.isArray(quickProducts)) {
  throw new Error("data/quick-products.json must contain an array.");
}

const integrationCandidates = quickProducts.filter(
  (product) =>
    String(product.id ?? "").startsWith("integration_articles_") ||
    product.internalSourcing?.validationStatus === "HOLD_INTEGRATION_ARTICLES",
);

const rows = integrationCandidates.map((product) => {
  const blockers = blockerList(product);
  const margin = parseTargetMargin(product);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    categoryId: product.categoryId,
    status: blockers.length === 0 ? "HOLD_READY_FOR_MANUAL_SOURCING" : "HOLD_GUARD_FAILURE",
    targetSalePrice: `${((product.price ?? 0) / 100).toFixed(2)} EUR`,
    targetMargin: margin.label,
    priorityScore: scoreCandidate(product, blockers),
    blockers,
    nextAction: nextAction(product, blockers),
    image: product.image,
  };
});

const failures = rows.filter((row) => row.blockers.length > 0);
const sourcingBoard = [...rows].sort((a, b) => {
  if (a.status !== b.status) return a.status === "HOLD_READY_FOR_MANUAL_SOURCING" ? -1 : 1;
  if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
  return a.name.localeCompare(b.name, "fr");
});

const payload = {
  generatedAt,
  mode: "read_only_integration_article_hold_audit",
  quickProductsPath,
  integrationCandidateCount: integrationCandidates.length,
  readyForManualSourcingCount: rows.filter((row) => row.status === "HOLD_READY_FOR_MANUAL_SOURCING").length,
  failureCount: failures.length,
  ok: integrationCandidates.length > 0 && failures.length === 0,
  failures,
  sourcingBoard,
  safety: {
    readOnly: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noExternalAccount: true,
  },
};

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const jsonPath = path.join(outputDir, `AUDIT_INTEGRATION_ARTICLES_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_INTEGRATION_ARTICLES_${dateKey}.md`);
const csvPath = path.join(outputDir, `AUDIT_INTEGRATION_ARTICLES_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(payload), "utf8");
fs.writeFileSync(csvPath, csvReport(payload), "utf8");

console.log(
  JSON.stringify(
    {
      ok: payload.ok,
      mode: payload.mode,
      integrationCandidateCount: payload.integrationCandidateCount,
      readyForManualSourcingCount: payload.readyForManualSourcingCount,
      failureCount: payload.failureCount,
      files: { jsonPath, mdPath, csvPath },
      safety: payload.safety,
    },
    null,
    2,
  ),
);

if (!payload.ok) {
  process.exitCode = 1;
}

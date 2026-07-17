import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessDir = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessDir, "tableaux-action");
const packsRoot = path.join(
  businessDir,
  "file-validation-fournisseurs",
  "packs-validation-tous-partenaires",
);

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

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
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

function latestFile(dir, predicate, label) {
  const matches = collectFiles(dir, predicate)
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (matches.length === 0) {
    throw new Error(`No ${label} found under ${dir}`);
  }

  return matches[0].fullPath;
}

function euro(cents) {
  if (!Number.isFinite(cents)) {
    return "a verifier";
  }

  return `${(cents / 100).toFixed(2)} EUR`;
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function csv(records) {
  const headers = [
    "priority",
    "id",
    "name",
    "categoryId",
    "currentStatus",
    "recommendedDefault",
    "supplierUrl",
    "supplierSku",
    "supplierPriceCents",
    "salePriceCents",
    "supplierStock",
    "deliveryEstimate",
    "evidenceGaps",
    "riskFlags",
  ];

  return `${headers.join(",")}\n${records
    .map((record) => headers.map((header) => csvEscape(record[header])).join(","))
    .join("\n")}\n`;
}

const decisionOptions = [
  {
    value: "keep_validate",
    label: "Garder et verifier",
    meaning:
      "Le produit reste interessant, mais il faut prouver le fournisseur exact, la variante, les images, le prix, le stock et le delai.",
    result: "HOLD jusqu'a preuves completes et validation humaine.",
  },
  {
    value: "replace",
    label: "Remplacer",
    meaning:
      "On garde l'idee commerciale, mais on cherche un meilleur produit ou un fournisseur plus fiable.",
    result: "HOLD, aucune suppression ni publication automatique.",
  },
  {
    value: "remove",
    label: "Retirer",
    meaning:
      "Le produit ne merite pas d'effort business ou comporte trop de risque pour la boutique.",
    result: "HOLD, retrait a appliquer seulement apres validation explicite.",
  },
  {
    value: "later",
    label: "Plus tard",
    meaning: "On reporte la decision pour concentrer le travail sur des produits plus faciles a prouver.",
    result: "HOLD sans action catalogue.",
  },
];

function issueSummary(packet) {
  const gaps = packet.evidenceGaps ?? [];
  const riskFlags = packet.riskFlags ?? [];
  const supplier = packet.supplier ?? {};
  const issues = [];

  if (supplier.urlExactEnough === false) {
    issues.push("lien fournisseur non exact");
  }
  if (!supplier.sku) {
    issues.push("SKU fournisseur manquant");
  }
  if (gaps.includes("images_exactes_et_droits")) {
    issues.push("images et droits non prouves");
  }
  if (riskFlags.length > 0) {
    issues.push(`risques: ${riskFlags.join(", ")}`);
  }

  return issues.length > 0 ? issues.join(" | ") : "decision business a confirmer";
}

function formToFill(record) {
  return {
    productId: record.id,
    productName: record.name,
    checkedAt: "",
    decision: "",
    decisionOptions: decisionOptions.map((option) => option.value),
    reason: "",
    ifKeepValidate: {
      exactSupplierProductUrl: "",
      supplierSellerName: "",
      supplierSku: "",
      exactVariantChosen: "",
      supplierPriceCents: record.supplierPriceCents,
      supplierStock: record.supplierStock,
      deliveryFranceEuropeProof: "",
      deliveryEstimateForCustomer: "",
      trackingAvailable: "",
      pricingProof: "",
      shippingProof: "",
      imageProof: "",
      imageRightsProof: "",
    },
    ifReplace: {
      replacementProductIdea: "",
      targetCategory: record.categoryId,
      reasonReplacementCouldSell: "",
      quickSupplierSearchNotes: "",
    },
    ifRemove: {
      removeReason: "",
      keepHistoricalNote: true,
    },
    ifLater: {
      revisitAfter: "",
      blockingReason: "",
    },
    finalDecision: "HOLD",
    reviewedByMouss: false,
  };
}

function toRecord(action, packet, index) {
  const supplier = packet?.supplier ?? {};
  const priority = action.priority ?? packet?.rank ?? index + 1;

  return {
    priority,
    id: action.id ?? packet?.id,
    slug: packet?.slug ?? slugify(action.name ?? packet?.name),
    name: action.name ?? packet?.name,
    categoryId: packet?.categoryId ?? "a-verifier",
    origin: packet?.origin ?? "src/lib/catalog.ts",
    currentStatus: action.status ?? packet?.publicationStatus ?? packet?.status ?? "HOLD",
    currentPublicationStatus: packet?.publicationStatus ?? "HOLD",
    recommendedDefault: "later",
    recommendedReason:
      "Produit statique sans preuve fournisseur exacte: garder en attente tant que Mouss n'a pas choisi l'effort business.",
    supplierUrl: supplier.url ?? "",
    supplierUrlExactEnough: supplier.urlExactEnough === true,
    supplierSku: supplier.sku ?? "",
    supplierPriceCents: supplier.supplierPriceCents ?? null,
    salePriceCents: supplier.salePriceCents ?? null,
    supplierStock: supplier.supplierStock ?? null,
    deliveryEstimate: supplier.deliveryEstimate ?? "",
    evidenceGaps: packet?.evidenceGaps ?? action.requiredProofs ?? [],
    riskFlags: packet?.riskFlags ?? [],
    businessIssue: issueSummary(packet ?? {}),
    options: decisionOptions,
    formToFill: null,
    safety: {
      readOnly: true,
      noCatalogWrite: true,
      noPublication: true,
      noPayment: true,
      noSupplierOrder: true,
      customerMustNeverSeeSupplierUrl: true,
      finalDecisionMustStayHoldUntilReviewed: true,
    },
  };
}

function cardMarkdown(record) {
  const optionRows = record.options.map(
    (option) => `| ${option.value} | ${option.label} | ${option.result} |`,
  );

  return `${[
    `# Decision statique - ${record.name}`,
    "",
    `Priorite: ${record.priority}`,
    `Produit: ${record.id}`,
    `Categorie: ${record.categoryId}`,
    `Statut actuel: ${record.currentStatus}`,
    `Recommandation par defaut: ${record.recommendedDefault}`,
    "",
    "## Pourquoi cette decision existe",
    "",
    record.businessIssue,
    "",
    "## Contexte fournisseur interne",
    "",
    `- URL fournisseur interne: ${record.supplierUrl || "a verifier"}`,
    `- URL exacte: ${record.supplierUrlExactEnough ? "oui" : "non"}`,
    `- SKU fournisseur: ${record.supplierSku || "a verifier"}`,
    `- Prix fournisseur: ${euro(record.supplierPriceCents)}`,
    `- Prix boutique: ${euro(record.salePriceCents)}`,
    `- Stock fournisseur: ${record.supplierStock ?? "a verifier"}`,
    `- Delai actuel: ${record.deliveryEstimate || "a verifier"}`,
    "",
    "## Options",
    "",
    "| Valeur | Choix | Resultat |",
    "|---|---|---|",
    ...optionRows,
    "",
    "## Bloc a remplir",
    "",
    "```json",
    JSON.stringify(record.formToFill, null, 2),
    "```",
    "",
    "## Garde-fous",
    "",
    "- Ce fichier ne publie rien.",
    "- Ce fichier ne modifie pas le catalogue.",
    "- Ce fichier ne commande pas fournisseur.",
    "- Ce fichier ne lance aucun paiement.",
    "- Les liens fournisseur restent internes et ne doivent jamais apparaitre cote client.",
    "",
  ].join("\n")}\n`;
}

function markdown(summary) {
  const rows = summary.decisions.map(
    (record) =>
      `| ${record.priority} | ${mdCell(record.name)} | ${mdCell(record.categoryId)} | ${mdCell(record.currentStatus)} | ${mdCell(record.recommendedDefault)} | ${mdCell(record.businessIssue)} |`,
  );

  return `${[
    "# Maxi Trouvailles - Decisions statiques partenaires",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Produits a decider: ${summary.decisionCount}`,
    "- Action appliquee au catalogue: aucune",
    "- Statut business: HOLD pour tous les produits",
    "",
    "## Tableau",
    "",
    "| Priorite | Produit | Categorie | Statut | Defaut | Blocage principal |",
    "|---:|---|---|---|---|---|",
    ...rows,
    "",
    "## Comment remplir",
    "",
    "1. Ouvrir la fiche du produit dans le dossier `fiches`.",
    "2. Choisir `keep_validate`, `replace`, `remove` ou `later`.",
    "3. Ajouter une raison courte et des preuves reelles si le produit est garde.",
    "4. Laisser `finalDecision` a `HOLD` tant que Mouss n'a pas valide.",
    "",
    "## Regles strictes",
    "",
    "- Aucune publication automatique.",
    "- Aucune commande fournisseur.",
    "- Aucun paiement.",
    "- Aucun lien AliExpress ou fournisseur visible cote client.",
    "- Si un doute existe sur les images, le produit reste HOLD.",
    "",
    "## Sources",
    "",
    `- Actions: ${summary.sources.nextActionsPath}`,
    `- Packs: ${summary.sources.packsPath}`,
    "",
  ].join("\n")}\n`;
}

const nextActionsPath = latestFile(
  actionRoot,
  (name) => name.startsWith("QUOI_FAIRE_MAINTENANT_PARTENAIRES_") && name.endsWith(".json"),
  "QUOI_FAIRE_MAINTENANT_PARTENAIRES_*.json",
);
const packsPath = latestFile(
  packsRoot,
  (name) => name === "PACKS_VALIDATION_TOUS_PARTENAIRES.json",
  "PACKS_VALIDATION_TOUS_PARTENAIRES.json",
);

const nextActions = readJson(nextActionsPath);
const packs = readJson(packsPath);
const actions = Array.isArray(nextActions.nextActions)
  ? nextActions.nextActions.filter((action) => action.lane === "decision_statique")
  : [];
const packets = Array.isArray(packs.packets) ? packs.packets : [];
const packetById = new Map(packets.map((packet) => [packet.id, packet]));

const staticActions =
  actions.length > 0
    ? actions
    : packets
        .filter((packet) => packet.origin === "src/lib/catalog.ts")
        .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

if (staticActions.length === 0) {
  throw new Error("No static partner decisions found.");
}

const decisions = staticActions.map((action, index) => {
  const packet = packetById.get(action.id) ?? action;
  const record = toRecord(action, packet, index);
  record.formToFill = formToFill(record);
  return record;
});

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `decisions-statiques-${dateKey}`);
const cardsDir = path.join(outputDir, "fiches");
fs.mkdirSync(cardsDir, { recursive: true });

for (const record of decisions) {
  const fileName = `${String(record.priority).padStart(2, "0")}-${slugify(record.name)}.md`;
  fs.writeFileSync(path.join(cardsDir, fileName), cardMarkdown(record), "utf8");
}

const fillTemplate = {
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  instructions:
    "Remplir uniquement avec des decisions et preuves reelles. Ne pas publier, payer ou commander depuis ce fichier.",
  decisionOptions,
  products: decisions.map((record) => record.formToFill),
  safety: {
    readOnly: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

const summary = {
  ok: true,
  generatedAt: fillTemplate.generatedAt,
  generatedAtLocal: localLabel,
  mode: "read_only_static_partner_decision_board",
  decisionCount: decisions.length,
  outputDir,
  decisions,
  fillTemplatePath: path.join(outputDir, `A_REMPLIR_DECISIONS_STATIQUES_${dateKey}.json`),
  cardDir: cardsDir,
  sources: {
    nextActionsPath,
    packsPath,
  },
  safety: fillTemplate.safety,
};

const jsonPath = path.join(outputDir, `DECISIONS_STATIQUES_PARTENAIRES_${dateKey}.json`);
const mdPath = path.join(outputDir, `DECISIONS_STATIQUES_PARTENAIRES_${dateKey}.md`);
const csvPath = path.join(outputDir, `DECISIONS_STATIQUES_PARTENAIRES_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(decisions), "utf8");
fs.writeFileSync(summary.fillTemplatePath, `${JSON.stringify(fillTemplate, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      decisionCount: summary.decisionCount,
      outputDir,
      files: {
        jsonPath,
        mdPath,
        csvPath,
        fillTemplatePath: summary.fillTemplatePath,
        cardsDir,
      },
      products: decisions.map((record) => ({
        priority: record.priority,
        id: record.id,
        name: record.name,
        recommendedDefault: record.recommendedDefault,
      })),
      safety: summary.safety,
    },
    null,
    2,
  ),
);

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessDir = path.join(root, "business-maxi-trouvailles");
const formsRoot = path.join(
  businessDir,
  "file-validation-fournisseurs",
  "packs-validation-tous-partenaires",
);
const outputRoot = path.join(businessDir, "tableaux-action");
const INTERNAL_SOURCE_REDACTED = "INTERNAL_SOURCE_REDACTED";

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

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function slugify(value) {
  return normalizeText(value)
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

function latestFile(predicate, label) {
  const matches = collectFiles(formsRoot, predicate)
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (matches.length === 0) {
    throw new Error(`No ${label} found under ${formsRoot}`);
  }

  return matches[0].fullPath;
}

function euro(cents) {
  if (!Number.isFinite(cents)) {
    return "a verifier";
  }

  return `${(cents / 100).toFixed(2)} EUR`;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function productRisk(form) {
  const text = normalizeText(`${form.name} ${form.categoryId}`);
  const riskFlags = [];
  let penalty = 0;

  if (text.includes("gourde") || text.includes("silicone")) {
    riskFlags.push("controle_contact_alimentaire");
    penalty += 15;
  }
  if (text.includes("led") || text.includes("usb") || text.includes("rechargeable")) {
    riskFlags.push("controle_electrique_ou_batterie");
    penalty += 18;
  }
  if (text.includes("voiture") || text.includes("auto moto")) {
    riskFlags.push("controle_usage_auto");
    penalty += 8;
  }

  return {
    riskFlags,
    penalty,
    label: riskFlags.length > 0 ? riskFlags.join(", ") : "risque faible",
  };
}

function categoryPotential(form) {
  const text = normalizeText(`${form.name} ${form.categoryId}`);

  if (text.includes("support pc")) {
    return { score: 76, reason: "panier moyen correct, usage clair bureau/teletravail, faible complexite produit" };
  }
  if (text.includes("pochette") || text.includes("cables")) {
    return { score: 74, reason: "accessoire universel, faible SAV, bon usage voyage/bureau" };
  }
  if (text.includes("filet") || text.includes("coffre")) {
    return { score: 68, reason: "prix d'appel simple et besoin auto facile a comprendre" };
  }
  if (text.includes("lampe")) {
    return { score: 65, reason: "produit maison utile mais verification electrique obligatoire" };
  }
  if (text.includes("gourde")) {
    return { score: 62, reason: "produit pratique mais risque contact alimentaire a clarifier" };
  }

  return { score: 60, reason: "potentiel commercial a confirmer" };
}

function deliverySignal(deliveryEstimate) {
  const text = normalizeText(deliveryEstimate);

  if (text.includes("7") && text.includes("15")) {
    return { score: 4, status: "delai deja cadre mais a prouver" };
  }
  if (text.includes("court") || text.includes("europe")) {
    return { score: 2, status: "signal livraison rapide mais encore a verifier" };
  }

  return { score: 0, status: "delai a clarifier" };
}

function supplierSnapshot(form) {
  const supplier = form.supplierContext ?? {};
  const supplierPriceCents = supplier.supplierPriceCents ?? null;
  const salePriceCents = supplier.salePriceCents ?? null;
  const marginCents =
    Number.isFinite(supplierPriceCents) && Number.isFinite(salePriceCents)
      ? salePriceCents - supplierPriceCents
      : null;
  const marginRate =
    Number.isFinite(marginCents) && Number.isFinite(salePriceCents) && salePriceCents > 0
      ? marginCents / salePriceCents
      : null;

  return {
    url: supplier.url ? INTERNAL_SOURCE_REDACTED : "",
    sku: supplier.sku ?? "",
    supplierPriceCents,
    salePriceCents,
    marginCents,
    marginRate,
    supplierStock: supplier.supplierStock ?? null,
    deliveryEstimate: supplier.currentDeliveryEstimate ?? "",
  };
}

function scoreCandidate(form, auditProduct) {
  const supplier = supplierSnapshot(form);
  const risk = productRisk(form);
  const potential = categoryPotential(form);
  const delivery = deliverySignal(supplier.deliveryEstimate);
  const blockerCount = auditProduct?.blockerCount ?? 99;
  const marginPercent = supplier.marginRate ? Math.round(supplier.marginRate * 1000) / 10 : 0;
  const marginScore = Math.min(12, Math.max(0, marginPercent * 0.3));
  const stockScore =
    supplier.supplierStock >= 60 ? 8 : supplier.supplierStock >= 40 ? 6 : supplier.supplierStock >= 20 ? 4 : 0;
  const basketScore = supplier.salePriceCents >= 1500 ? 5 : supplier.salePriceCents >= 900 ? 3 : 1;
  const blockerPenalty = Math.min(14, blockerCount);
  const priorityPenalty = Math.max(0, (form.priority ?? 99) - 5) * 0.5;
  const score = Math.round(
    potential.score +
      marginScore +
      stockScore +
      basketScore +
      delivery.score -
      risk.penalty -
      blockerPenalty -
      priorityPenalty,
  );

  return {
    score,
    marginPercent,
    components: {
      potential: potential.score,
      marginScore: Math.round(marginScore),
      stockScore,
      basketScore,
      deliveryScore: delivery.score,
      riskPenalty: risk.penalty,
      blockerPenalty,
      priorityPenalty,
    },
    reasons: {
      potential: potential.reason,
      risk: risk.label,
      delivery: delivery.status,
    },
    riskFlags: risk.riskFlags,
    blockerCount,
    blockers: auditProduct?.blockers ?? [],
    supplier,
  };
}

function checklistFor(record) {
  return [
    "ouvrir le lien fournisseur exact et confirmer que ce n'est pas une page recherche",
    "noter le nom vendeur et la variante exacte vendue",
    "verifier prix produit, frais livraison, stock et delai France/Europe",
    "confirmer suivi colis disponible",
    "verifier que les images montrent exactement la variante vendue",
    "decider si les images fournisseur sont utilisables ou si elles doivent etre remplacees",
    "laisser finalDecision a HOLD tant que Mouss n'a pas valide",
  ].concat(record.riskFlags.map((flag) => `controle supplementaire obligatoire: ${flag}`));
}

function toSprintTemplate(record) {
  return {
    rank: record.shortlistRank,
    productId: record.id,
    productName: record.name,
    checkedAt: "",
    supplierProductUrl: record.supplier.url,
    supplierSellerName: "",
    supplierSku: record.supplier.sku,
    exactVariantChosen: "",
    supplierPriceCentsChecked: record.supplier.supplierPriceCents,
    shippingPriceCentsChecked: "",
    salePriceCentsCurrent: record.supplier.salePriceCents,
    stockChecked: record.supplier.supplierStock,
    deliveryFranceEuropeProof: "",
    deliveryEstimateForCustomer: "",
    trackingAvailable: "",
    imageExactProof: "",
    imageRightsDecision: "",
    riskChecks: record.riskFlags,
    notesForMouss: "",
    finalDecision: "HOLD",
    reviewedByMouss: false,
  };
}

function sprintCard(record) {
  const checklist = checklistFor(record).map((item) => `- [ ] ${item}`);

  return `${[
    `# Sprint preuve GO humain - ${record.name}`,
    "",
    `Rang shortlist: ${record.shortlistRank}`,
    `Score interne: ${record.score}`,
    `Categorie: ${record.categoryId}`,
    `Statut: ${record.status}`,
    "",
    "## Pourquoi prioriser",
    "",
    `- Potentiel: ${record.reasons.potential}`,
    `- Marge estimee: ${record.marginPercent}% (${euro(record.supplier.marginCents)})`,
    `- Risque: ${record.reasons.risk}`,
    `- Livraison: ${record.reasons.delivery}`,
    "",
    "## Checklist courte",
    "",
    ...checklist,
    "",
    "## Bloc a remplir",
    "",
    "```json",
    JSON.stringify(toSprintTemplate(record), null, 2),
    "```",
    "",
    "## Garde-fous",
    "",
    "- Ne pas publier.",
    "- Ne pas payer.",
    "- Ne pas commander fournisseur.",
    "- Ne pas afficher le fournisseur au client.",
    "",
  ].join("\n")}\n`;
}

function csv(records) {
  const headers = [
    "shortlistRank",
    "inEvidenceSprint",
    "score",
    "priority",
    "id",
    "name",
    "categoryId",
    "marginPercent",
    "marginCents",
    "supplierStock",
    "blockerCount",
    "riskFlags",
    "recommendedAction",
  ];

  return `${headers.join(",")}\n${records
    .map((record) => headers.map((header) => csvEscape(record[header])).join(","))
    .join("\n")}\n`;
}

function markdown(summary) {
  const rows = summary.candidates.map(
    (record) =>
      `| ${record.shortlistRank} | ${record.inEvidenceSprint ? "oui" : "attente"} | ${record.score} | ${mdCell(record.name)} | ${mdCell(record.categoryId)} | ${record.marginPercent}% | ${record.blockerCount} | ${mdCell(record.reasons.risk)} | ${mdCell(record.recommendedAction)} |`,
  );

  return `${[
    "# Maxi Trouvailles - Shortlist GO humain partenaires",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Candidats analyses: ${summary.candidateCount}`,
    `- Produits en sprint preuves: ${summary.evidenceSprintCount}`,
    "- Action appliquee au catalogue: aucune",
    "- Statut: HOLD pour tous les produits",
    "",
    "## Classement",
    "",
    "| Rang | Sprint | Score | Produit | Categorie | Marge | Bloquants | Risque | Action |",
    "|---:|---|---:|---|---|---:|---:|---|---|",
    ...rows,
    "",
    "## Sprint recommande",
    "",
    ...summary.evidenceSprint.map(
      (record) => `- ${record.shortlistRank}. ${record.name}: remplir la fiche sprint et garder ` + "`finalDecision` a `HOLD`.",
    ),
    "",
    "## Commandes apres remplissage manuel",
    "",
    "```powershell",
    ...summary.commandsAfterManualFill,
    "```",
    "",
    "## Garde-fous",
    "",
    "- Lecture seule: aucun produit n'est publie.",
    "- Aucun paiement, aucune commande fournisseur, aucun deploiement.",
    "- Les liens fournisseur restent internes.",
    "- Une fiche remplie devient seulement candidate a revue humaine.",
    "",
    "## Sources",
    "",
    `- Formulaires rapides: ${summary.sources.formsPath}`,
    `- Audit formulaires rapides: ${summary.sources.auditPath}`,
    "",
  ].join("\n")}\n`;
}

const formsPath = latestFile(
  (name) => name.startsWith("FORMULAIRES_PREUVES_RAPIDES_") && name.endsWith(".json"),
  "FORMULAIRES_PREUVES_RAPIDES_*.json",
);
const auditPath = latestFile(
  (name) => name.startsWith("AUDIT_FORMULAIRES_PREUVES_RAPIDES_") && name.endsWith(".json"),
  "AUDIT_FORMULAIRES_PREUVES_RAPIDES_*.json",
);

const formsData = readJson(formsPath);
const auditData = readJson(auditPath);
const forms = Array.isArray(formsData.forms) ? formsData.forms : [];
const auditById = new Map((auditData.products ?? []).map((product) => [product.id, product]));

if (forms.length === 0) {
  throw new Error("Fast forms file must contain a non-empty forms array.");
}

const scored = forms
  .map((form) => {
    const auditProduct = auditById.get(form.id);
    const score = scoreCandidate(form, auditProduct);
    return {
      priority: form.priority,
      id: form.id,
      name: form.name,
      categoryId: form.categoryId,
      status: form.status,
      ...score,
    };
  })
  .sort((a, b) => b.score - a.score || a.priority - b.priority)
  .map((record, index) => ({
    ...record,
    shortlistRank: index + 1,
    inEvidenceSprint: index < 3,
    recommendedAction:
      index < 3
        ? "remplir preuves exactes maintenant, puis audit rapide"
        : "garder en attente jusqu'a preuve ou remplacement",
  }));

const evidenceSprint = scored.filter((record) => record.inEvidenceSprint);
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(outputRoot, `shortlist-go-humain-${dateKey}`);
const cardsDir = path.join(outputDir, "fiches-sprint");
fs.mkdirSync(cardsDir, { recursive: true });

for (const record of evidenceSprint) {
  const fileName = `${String(record.shortlistRank).padStart(2, "0")}-${slugify(record.name)}.md`;
  fs.writeFileSync(path.join(cardsDir, fileName), sprintCard(record), "utf8");
}

const sprintTemplate = {
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  instructions:
    "Remplir uniquement avec des preuves fournisseur reelles. Garder finalDecision a HOLD avant validation explicite.",
  products: evidenceSprint.map(toSprintTemplate),
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
  generatedAt: sprintTemplate.generatedAt,
  generatedAtLocal: localLabel,
  mode: "read_only_fast_partner_go_shortlist",
  candidateCount: scored.length,
  evidenceSprintCount: evidenceSprint.length,
  candidates: scored,
  evidenceSprint,
  commandsAfterManualFill: [
    "npm run catalog:audit-fast-evidence-forms",
    "npm run catalog:business-next-actions",
    "npm run catalog:audit-all-partner-gates",
    "npm run catalog:audit-checkout-eligibility",
    "npm run catalog:test-checkout-guards",
  ],
  sources: {
    formsPath,
    auditPath,
  },
  files: {
    outputDir,
    cardsDir,
  },
  safety: sprintTemplate.safety,
};

const jsonPath = path.join(outputDir, `SHORTLIST_GO_HUMAIN_PARTENAIRES_${dateKey}.json`);
const mdPath = path.join(outputDir, `SHORTLIST_GO_HUMAIN_PARTENAIRES_${dateKey}.md`);
const csvPath = path.join(outputDir, `SHORTLIST_GO_HUMAIN_PARTENAIRES_${dateKey}.csv`);
const templatePath = path.join(outputDir, `A_REMPLIR_SPRINT_PREUVES_GO_HUMAIN_${dateKey}.json`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(scored), "utf8");
fs.writeFileSync(templatePath, `${JSON.stringify(sprintTemplate, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      candidateCount: summary.candidateCount,
      evidenceSprintCount: summary.evidenceSprintCount,
      top: evidenceSprint.map((record) => ({
        rank: record.shortlistRank,
        id: record.id,
        name: record.name,
        score: record.score,
        riskFlags: record.riskFlags,
      })),
      files: {
        jsonPath,
        mdPath,
        csvPath,
        templatePath,
        cardsDir,
      },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

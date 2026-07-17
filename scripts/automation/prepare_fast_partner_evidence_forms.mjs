import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packsRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "file-validation-fournisseurs",
  "packs-validation-tous-partenaires",
);
const inputArg = process.argv.find((arg) => arg.startsWith("--input="));
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Math.max(1, Number(limitArg.split("=")[1]) || 5) : 5;

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
    localDate: `${byType.year}-${byType.month}-${byType.day}`,
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

function latestWorkplanFile() {
  if (!fs.existsSync(packsRoot)) {
    throw new Error(`Packs root not found: ${packsRoot}`);
  }

  const matches = collectFiles(
    packsRoot,
    (name) => name.startsWith("PLAN_TRAVAIL_PREUVES_TOUS_PARTENAIRES_") && name.endsWith(".json"),
  )
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (matches.length === 0) {
    throw new Error(`No PLAN_TRAVAIL_PREUVES_TOUS_PARTENAIRES_*.json found under ${packsRoot}`);
  }

  return matches[0].fullPath;
}

function resolveInputFile() {
  if (!inputArg) {
    return latestWorkplanFile();
  }

  const inputPath = path.resolve(root, inputArg.split("=")[1]);
  const stat = fs.statSync(inputPath);
  if (stat.isDirectory()) {
    const matches = fs
      .readdirSync(inputPath, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.startsWith("PLAN_TRAVAIL_PREUVES_TOUS_PARTENAIRES_") &&
          entry.name.endsWith(".json"),
      )
      .map((entry) => {
        const fullPath = path.join(inputPath, entry.name);
        return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    if (matches.length === 0) {
      throw new Error(`No workplan JSON found in ${inputPath}`);
    }

    return matches[0].fullPath;
  }

  return inputPath;
}

function formFor(task) {
  return {
    productId: task.id,
    productName: task.name,
    priority: task.priority,
    source: task.origin,
    checkedAt: "",
    decision: "continue_validation",
    exactSupplierProductUrl: task.supplierUrl || "",
    supplierSellerName: "",
    supplierSku: task.supplierSku || "",
    exactVariantChosen: "",
    supplierPriceCents: task.supplierPriceCents ?? null,
    supplierStock: task.supplierStock ?? null,
    deliveryFranceEuropeProof: "",
    deliveryEstimateForCustomer: "",
    trackingAvailable: "",
    pricingProof: "",
    shippingProof: "",
    imageProof: "",
    imageRightsProof: "",
    complianceNotes: "",
    finalDecision: "HOLD",
    reviewedByMouss: false,
  };
}

function questionsFor(task) {
  return [
    `Le lien fournisseur ouvre-t-il exactement le produit vendu: ${task.supplierUrl || "a verifier"} ?`,
    "Quelle variante exacte sera vendue sur Maxi Trouvailles ?",
    "Le prix fournisseur, le stock et les frais visibles sont-ils encore identiques ou meilleurs ?",
    "Le delai France/Europe est-il clairement indique avec suivi colis ?",
    "Les images montrent-elles exactement la variante vendue, sans logo ou marque visible interdite ?",
    "Les droits/usage image sont-ils acceptables ou faut-il remplacer les images ?",
    "Mouss valide-t-il seulement une revue humaine, sans publication automatique ?",
  ];
}

function formRecord(task) {
  return {
    id: task.id,
    slug: task.slug,
    name: task.name,
    priority: task.priority,
    categoryId: task.categoryId,
    workLane: task.workLane,
    status: task.status,
    supplierContext: {
      url: task.supplierUrl,
      sku: task.supplierSku,
      supplierPriceCents: task.supplierPriceCents,
      salePriceCents: task.salePriceCents,
      supplierStock: task.supplierStock,
      currentDeliveryEstimate: task.currentDeliveryEstimate,
    },
    questions: questionsFor(task),
    formToFill: formFor(task),
    safety: {
      keepFinalDecisionHoldUntilReviewed: true,
      noPublication: true,
      noPayment: true,
      noSupplierOrder: true,
    },
  };
}

function markdownForm(record) {
  return `${[
    `# Formulaire preuves rapides - ${record.name}`,
    "",
    `Priorite: ${record.priority}`,
    `Categorie: ${record.categoryId}`,
    `Statut: ${record.status}`,
    "",
    "## Contexte fournisseur actuel",
    "",
    `- URL: ${record.supplierContext.url || "a verifier"}`,
    `- SKU: ${record.supplierContext.sku || "a verifier"}`,
    `- Prix fournisseur actuel: ${record.supplierContext.supplierPriceCents ?? "a verifier"}`,
    `- Prix boutique actuel: ${record.supplierContext.salePriceCents ?? "a verifier"}`,
    `- Stock actuel: ${record.supplierContext.supplierStock ?? "a verifier"}`,
    `- Delai actuel: ${record.supplierContext.currentDeliveryEstimate || "a verifier"}`,
    "",
    "## Questions a verifier",
    "",
    ...record.questions.map((question, index) => `${index + 1}. ${question}`),
    "",
    "## Bloc a remplir",
    "",
    "```json",
    JSON.stringify(record.formToFill, null, 2),
    "```",
    "",
    "## Garde-fous",
    "",
    "- Garder `finalDecision` a `HOLD` tant que Mouss n'a pas valide.",
    "- Ne pas publier.",
    "- Ne pas payer.",
    "- Ne pas commander fournisseur.",
    "",
  ].join("\n")}\n`;
}

function markdownIndex(summary) {
  const rows = summary.forms.map(
    (form) =>
      `| ${form.priority} | ${form.name} | ${form.categoryId} | ${form.supplierContext.sku || "a verifier"} | ${form.supplierContext.url || "a verifier"} |`,
  );

  return `${[
    "# Formulaires preuves rapides",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Formulaires generes: ${summary.formCount}`,
    `- Source workplan: ${summary.workplanPath}`,
    "",
    "## Produits",
    "",
    "| Priorite | Produit | Categorie | SKU actuel | URL fournisseur |",
    "|---:|---|---|---|---|",
    ...rows,
    "",
    "## Regle",
    "",
    "Ces formulaires sont faits pour copier des preuves reelles. Ils ne donnent jamais une autorisation de publication ou de commande.",
    "",
  ].join("\n")}\n`;
}

const workplanPath = resolveInputFile();
const workplan = readJson(workplanPath);
const tasks = Array.isArray(workplan.tasks) ? workplan.tasks : [];
const quickTasks = tasks
  .filter((task) => task.workLane === "B_VALIDATION_RAPIDE")
  .sort((a, b) => a.priority - b.priority)
  .slice(0, limit);

if (quickTasks.length === 0) {
  throw new Error("No B_VALIDATION_RAPIDE tasks found in workplan.");
}

const forms = quickTasks.map(formRecord);
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(path.dirname(workplanPath), `formulaires-preuves-rapides-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

for (const record of forms) {
  const filePath = path.join(
    outputDir,
    `${String(record.priority).padStart(2, "0")}-${slugify(record.name)}.md`,
  );
  fs.writeFileSync(filePath, markdownForm(record), "utf8");
}

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_fast_partner_evidence_forms",
  workplanPath,
  outputDir,
  limit,
  formCount: forms.length,
  forms,
  safety: {
    readOnly: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

const jsonPath = path.join(outputDir, `FORMULAIRES_PREUVES_RAPIDES_${dateKey}.json`);
const mdPath = path.join(outputDir, `FORMULAIRES_PREUVES_RAPIDES_${dateKey}.md`);
const templatePath = path.join(outputDir, `A_REMPLIR_TEMPLATE_PREUVES_RAPIDES_${dateKey}.json`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownIndex(summary), "utf8");
fs.writeFileSync(
  templatePath,
  `${JSON.stringify(
    {
      generatedAt: summary.generatedAt,
      generatedAtLocal: summary.generatedAtLocal,
      instructions:
        "Copier uniquement des preuves reelles. Ne pas publier, payer ou commander depuis ce fichier.",
      products: forms.map((form) => ({
        id: form.id,
        name: form.name,
        priority: form.priority,
        fill: form.formToFill,
      })),
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      formCount: summary.formCount,
      outputDir,
      files: { jsonPath, mdPath, templatePath },
      products: forms.map((form) => ({
        priority: form.priority,
        id: form.id,
        name: form.name,
      })),
      safety: summary.safety,
    },
    null,
    2,
  ),
);

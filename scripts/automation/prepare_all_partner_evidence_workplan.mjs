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
const quickLimitArg = process.argv.find((arg) => arg.startsWith("--quick="));
const quickLimit = quickLimitArg ? Math.max(1, Number(quickLimitArg.split("=")[1]) || 5) : 5;

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

function latestPacketDir() {
  if (!fs.existsSync(packsRoot)) {
    throw new Error(`Packs root not found: ${packsRoot}`);
  }

  const dirs = fs
    .readdirSync(packsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const fullPath = path.join(packsRoot, entry.name);
      return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const dir of dirs) {
    if (fs.existsSync(path.join(dir.fullPath, "PACKS_VALIDATION_TOUS_PARTENAIRES.json"))) {
      return dir.fullPath;
    }
  }

  throw new Error(`No PACKS_VALIDATION_TOUS_PARTENAIRES.json found under ${packsRoot}`);
}

function resolveInputDir() {
  if (!inputArg) {
    return latestPacketDir();
  }

  const inputPath = path.resolve(root, inputArg.split("=")[1]);
  const stat = fs.statSync(inputPath);
  return stat.isDirectory() ? inputPath : path.dirname(inputPath);
}

function latestFile(dir, prefix) {
  const matches = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith(".json"))
    .map((entry) => {
      const fullPath = path.join(dir, entry.name);
      return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (matches.length === 0) {
    throw new Error(`No ${prefix}*.json found in ${dir}`);
  }

  return matches[0].fullPath;
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function csv(rows) {
  const headers = [
    "priority",
    "workLane",
    "name",
    "origin",
    "categoryId",
    "supplierUrl",
    "supplierSku",
    "status",
    "nextAction",
    "fieldsToFill",
  ];

  return `${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
    .join("\n")}\n`;
}

function workLane(packet, audit) {
  if (packet.origin === "src/lib/catalog.ts") {
    return "A_DECISION_STATIQUE";
  }

  if (
    packet.supplier?.urlExactEnough === true &&
    packet.evidenceGaps.length <= 1 &&
    (packet.riskFlags ?? []).length <= 1 &&
    audit.blockerCount <= 12
  ) {
    return "B_VALIDATION_RAPIDE";
  }

  return "C_RECONTROLE_COMPLET";
}

function fieldsFor(packet, lane) {
  const baseFields = [
    "checkedAt",
    "supplierSellerName",
    "exactVariantChosen",
    "deliveryFranceEuropeProof",
    "deliveryEstimateForCustomer",
    "trackingAvailable",
    "pricingProof",
    "shippingProof",
    "imageProof",
    "imageRightsProof",
    "finalDecision",
    "reviewedByMouss",
  ];

  if (lane === "A_DECISION_STATIQUE") {
    return [
      "decision",
      "exactSupplierProductUrl si garder",
      "supplierSku si garder",
      ...baseFields,
      "complianceNotes si remplacer/retirer/plus tard",
    ];
  }

  if (packet.evidenceGaps.includes("preuve_prix")) {
    baseFields.splice(6, 0, "supplierPriceCents");
  }

  if (packet.evidenceGaps.includes("preuve_livraison")) {
    baseFields.splice(7, 0, "pays expedition / transporteur");
  }

  return baseFields;
}

function nextActionFor(packet, lane) {
  if (lane === "A_DECISION_STATIQUE") {
    return "Decider garder, remplacer, retirer ou plus tard avant toute recherche fournisseur.";
  }

  if (lane === "B_VALIDATION_RAPIDE") {
    return "Verifier le vendeur exact, le delai France/Europe, le suivi, les images et les droits.";
  }

  return "Recontroler prix, livraison, droits images et risques avant de tenter une revue humaine.";
}

function guideStepsFor(packet, lane) {
  if (lane === "A_DECISION_STATIQUE") {
    return [
      "Choisir une decision: keep_validate, replace, remove ou later.",
      "Si keep_validate: remplacer la recherche fournisseur par une URL article exacte.",
      "Renseigner SKU fournisseur, vendeur exact, variante exacte et preuves image.",
      "Si replace/remove/later: remplir complianceNotes avec la raison et garder HOLD.",
      "Ne jamais publier depuis ce guide.",
    ];
  }

  return [
    "Ouvrir le lien fournisseur uniquement pour verifier, pas pour acheter.",
    "Noter vendeur exact, variante vendue, stock et prix courant.",
    "Verifier que le delai France/Europe est clair et que le suivi colis est disponible.",
    "Verifier que les images correspondent exactement a la variante vendue.",
    "Renseigner les preuves dans le template JSON, puis relancer l'audit evidence.",
    "Garder finalDecision a HOLD tant que Mouss n'a pas valide.",
  ];
}

function taskFromPacket(packet, audit) {
  const lane = workLane(packet, audit);
  return {
    priority: packet.rank,
    id: packet.id,
    slug: packet.slug,
    name: packet.name,
    origin: packet.origin,
    categoryId: packet.categoryId,
    status: audit.status,
    workLane: lane,
    supplierUrl: packet.supplier?.url ?? "",
    supplierUrlExactEnough: packet.supplier?.urlExactEnough ?? false,
    supplierSku: packet.supplier?.sku ?? "",
    supplierPriceCents: packet.supplier?.supplierPriceCents ?? null,
    salePriceCents: packet.supplier?.salePriceCents ?? null,
    supplierStock: packet.supplier?.supplierStock ?? null,
    currentDeliveryEstimate: packet.supplier?.deliveryEstimate ?? "",
    evidenceGaps: packet.evidenceGaps ?? [],
    riskFlags: packet.riskFlags ?? [],
    blockers: audit.blockers ?? [],
    fieldsToFill: fieldsFor(packet, lane),
    nextAction: nextActionFor(packet, lane),
    guideSteps: guideStepsFor(packet, lane),
    safety: {
      noPublication: true,
      noPayment: true,
      noSupplierOrder: true,
      keepHold: true,
    },
  };
}

function taskSort(a, b) {
  const laneOrder = {
    A_DECISION_STATIQUE: 0,
    B_VALIDATION_RAPIDE: 1,
    C_RECONTROLE_COMPLET: 2,
  };
  return laneOrder[a.workLane] - laneOrder[b.workLane] || a.priority - b.priority;
}

function markdownGuide(task) {
  return `${[
    `# Guide preuve fournisseur - ${task.name}`,
    "",
    `Priorite: ${task.priority}`,
    `File: ${task.workLane}`,
    `Origine: ${task.origin}`,
    `Statut: ${task.status}`,
    "",
    "## Donnees utiles",
    "",
    `- ID: ${task.id}`,
    `- Slug: ${task.slug}`,
    `- Categorie: ${task.categoryId}`,
    `- URL fournisseur actuelle: ${task.supplierUrl || "a verifier"}`,
    `- URL exacte: ${task.supplierUrlExactEnough}`,
    `- SKU fournisseur: ${task.supplierSku || "a verifier"}`,
    `- Prix fournisseur: ${task.supplierPriceCents ?? "a verifier"}`,
    `- Prix boutique: ${task.salePriceCents ?? "a verifier"}`,
    `- Stock fournisseur: ${task.supplierStock ?? "a verifier"}`,
    `- Delai actuel: ${task.currentDeliveryEstimate || "a verifier"}`,
    "",
    "## Champs a remplir",
    "",
    ...task.fieldsToFill.map((field) => `- ${field}`),
    "",
    "## Etapes",
    "",
    ...task.guideSteps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Bloquants actuels",
    "",
    ...task.blockers.map((blocker) => `- ${blocker}`),
    "",
    "## Garde-fous",
    "",
    "- Ne pas publier.",
    "- Ne pas payer.",
    "- Ne pas commander fournisseur.",
    "- Garder en HOLD tant que les preuves et la revue Mouss ne sont pas completes.",
    "",
  ].join("\n")}\n`;
}

function markdownIndex(summary) {
  const laneLines = Object.entries(summary.byWorkLane).map(([lane, count]) => `- ${lane}: ${count}`);
  const priorityRows = summary.priorityNow.map(
    (task) =>
      `| ${task.priority} | ${task.workLane} | ${task.name} | ${task.origin} | ${task.nextAction} |`,
  );

  return `${[
    "# Plan travail preuves tous partenaires",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Packs analyses: ${summary.taskCount}`,
    `- Priorites immediates: ${summary.priorityNow.length}`,
    `- Decisions statiques: ${summary.byWorkLane.A_DECISION_STATIQUE ?? 0}`,
    `- Validations rapides: ${summary.byWorkLane.B_VALIDATION_RAPIDE ?? 0}`,
    `- Recontroles complets: ${summary.byWorkLane.C_RECONTROLE_COMPLET ?? 0}`,
    "",
    "## Files",
    "",
    ...laneLines,
    "",
    "## A traiter en premier",
    "",
    "| Priorite | File | Produit | Origine | Action |",
    "|---:|---|---|---|---|",
    ...priorityRows,
    "",
    "## Regle",
    "",
    "Ce plan organise la validation humaine. Il ne publie rien et ne commande rien.",
    "",
  ].join("\n")}\n`;
}

const inputDir = resolveInputDir();
const packetPath = path.join(inputDir, "PACKS_VALIDATION_TOUS_PARTENAIRES.json");
const auditPath = latestFile(inputDir, "AUDIT_PREUVES_PACKS_TOUS_PARTENAIRES_");
const packetPayload = readJson(packetPath);
const auditPayload = readJson(auditPath);

if (!Array.isArray(packetPayload.packets)) {
  throw new Error("PACKS_VALIDATION_TOUS_PARTENAIRES.json must contain packets.");
}

if (!Array.isArray(auditPayload.products)) {
  throw new Error("AUDIT_PREUVES_PACKS_TOUS_PARTENAIRES must contain products.");
}

const auditById = new Map(auditPayload.products.map((product) => [product.id, product]));
const tasks = packetPayload.packets
  .map((packet) => {
    const audit = auditById.get(packet.id);
    if (!audit) {
      throw new Error(`No evidence audit found for ${packet.id}`);
    }

    return taskFromPacket(packet, audit);
  })
  .sort(taskSort);

const decisions = tasks.filter((task) => task.workLane === "A_DECISION_STATIQUE");
const quick = tasks.filter((task) => task.workLane === "B_VALIDATION_RAPIDE").slice(0, quickLimit);
const priorityNow = [...decisions, ...quick].sort(taskSort);
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(inputDir, `plan-travail-preuves-${dateKey}`);

fs.mkdirSync(outputDir, { recursive: true });

for (const task of priorityNow) {
  const guidePath = path.join(
    outputDir,
    `${String(task.priority).padStart(2, "0")}-${slugify(task.name)}.md`,
  );
  fs.writeFileSync(guidePath, markdownGuide(task), "utf8");
}

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_all_partner_evidence_workplan",
  inputDir,
  packetPath,
  auditPath,
  quickLimit,
  taskCount: tasks.length,
  priorityNowCount: priorityNow.length,
  byWorkLane: tasks.reduce((acc, task) => {
    acc[task.workLane] = (acc[task.workLane] ?? 0) + 1;
    return acc;
  }, {}),
  priorityNow,
  tasks,
  outputDir,
  safety: {
    readOnly: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

const jsonPath = path.join(outputDir, `PLAN_TRAVAIL_PREUVES_TOUS_PARTENAIRES_${dateKey}.json`);
const mdPath = path.join(outputDir, `PLAN_TRAVAIL_PREUVES_TOUS_PARTENAIRES_${dateKey}.md`);
const csvPath = path.join(outputDir, `PLAN_TRAVAIL_PREUVES_TOUS_PARTENAIRES_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownIndex(summary), "utf8");
fs.writeFileSync(csvPath, csv(tasks), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      taskCount: summary.taskCount,
      priorityNowCount: summary.priorityNowCount,
      byWorkLane: summary.byWorkLane,
      outputDir,
      files: { jsonPath, mdPath, csvPath },
      priorityNow: priorityNow.map((task) => ({
        priority: task.priority,
        id: task.id,
        name: task.name,
        workLane: task.workLane,
      })),
      safety: summary.safety,
    },
    null,
    2,
  ),
);

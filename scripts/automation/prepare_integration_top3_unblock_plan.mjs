import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const businessGateRoot = path.join(actionRoot, "audit-top3-business-gate-sourcing-integration-articles");
const outputRoot = path.join(actionRoot, "plan-deblocage-top3-sourcing-integration-articles");

const proofZoneByLabel = new Map([
  ["URL produit exacte", "Source produit exacte"],
  ["Nom vendeur ou partenaire", "Partenaire logistique"],
  ["SKU/reference fournisseur", "Reference produit"],
  ["Variante exacte vendue", "Variante"],
  ["Prix fournisseur reel en centimes", "Prix et marge"],
]);
const forbiddenPattern = /\b(aliexpress|ali\s*express|alicdn|ae-pic|temu|dhgate|1688)\b/i;
const externalUrlPattern = /https?:\/\//i;
const sensitivePattern =
  /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|bearer|secret|password)\b\s*[:=]\s*["']?[^"',;\s]{8,}/i;
const keyLikePattern = /\b(sk|pk)_(live|test)_[A-Za-z0-9]{12,}\b|\bsk-[A-Za-z0-9]{12,}\b/i;

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

function walkFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return [];

  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath, predicate));
      continue;
    }

    if (!predicate || predicate(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function latestFile(dir, pattern, label) {
  const files = walkFiles(dir, (filePath) => pattern.test(filePath));
  if (files.length === 0) {
    throw new Error(`No ${label} found under ${dir}`);
  }

  const todayKey = datePartsParis().dateKey;
  const matches = files
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return matches.find((match) => match.filePath.includes(todayKey))?.filePath ?? matches[0].filePath;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  if (/[",\n\r;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function isSafeOutput(value) {
  const serialized = JSON.stringify(value);
  return (
    !externalUrlPattern.test(serialized) &&
    !forbiddenPattern.test(serialized) &&
    !sensitivePattern.test(serialized) &&
    !keyLikePattern.test(serialized)
  );
}

function internalAdminHref(productId, stepType, stepOrder) {
  return `/admin/preuves-partenaires?status=hold&q=${encodeURIComponent(productId)}#top3-${stepType}-${stepOrder}`;
}

function proofExpectedResult(label) {
  if (label === "URL produit exacte") {
    return "Reference produit exacte renseignee dans l'atelier interne, non exportee au client.";
  }

  if (label === "Nom vendeur ou partenaire") {
    return "Nom du partenaire renseigne dans la preuve interne, garde hors surface publique.";
  }

  if (label === "SKU/reference fournisseur") {
    return "Reference produit partenaire verifiee et rattachee au meme article.";
  }

  if (label === "Variante exacte vendue") {
    return "Variante cible confirmee pour eviter tout ecart de couleur, taille ou lot.";
  }

  if (label === "Prix fournisseur reel en centimes") {
    return "Cout reel saisi en interne pour calcul marge et prix cible avant revue.";
  }

  return "Preuve critique completee dans l'atelier interne.";
}

function proofRejectionRisk(label) {
  if (label === "URL produit exacte") return "Refuser si la page ne montre pas exactement le meme article.";
  if (label === "Nom vendeur ou partenaire") return "Refuser si le partenaire n'est pas identifiable.";
  if (label === "SKU/reference fournisseur") return "Refuser si la reference ne correspond pas a la variante vendue.";
  if (label === "Variante exacte vendue") return "Refuser si la variante est ambigue ou differente.";
  if (label === "Prix fournisseur reel en centimes") return "Refuser si le cout est estime ou incomplet.";
  return "Refuser si la preuve reste incomplete.";
}

function parseImageLabel(label) {
  const [rolePart, ...fileParts] = String(label ?? "").split(":");
  const role = rolePart.trim() || "image";
  const expectedFileName = fileParts.join(":").trim();
  return { role, expectedFileName };
}

function buildSteps(gate) {
  const steps = [];
  for (const product of [...(gate.productSummaries ?? [])].sort((a, b) => a.top3Rank - b.top3Rank)) {
    for (const label of product.missingProofLabels ?? []) {
      const stepOrder = steps.length + 1;
      steps.push({
        stepOrder,
        top3Rank: product.top3Rank,
        productId: product.productId,
        productName: product.productName,
        categoryId: product.categoryId,
        stepType: "proof",
        zone: proofZoneByLabel.get(label) ?? "Preuve critique",
        label,
        expectedResult: proofExpectedResult(label),
        rejectionRisk: proofRejectionRisk(label),
        status: "TO_DO_HOLD",
        adminHref: internalAdminHref(product.productId, "proof", stepOrder),
        nextAction: "Remplir la preuve manuelle, confirmer meme article, puis garder HOLD.",
      });
    }

    for (const label of product.missingImageLabels ?? []) {
      const { role, expectedFileName } = parseImageLabel(label);
      const stepOrder = steps.length + 1;
      steps.push({
        stepOrder,
        top3Rank: product.top3Rank,
        productId: product.productId,
        productName: product.productName,
        categoryId: product.categoryId,
        stepType: "image",
        zone: "Images exactes et droits",
        role,
        expectedFileName,
        label: `WebP ${role} - ${expectedFileName}`,
        expectedResult: "Fichier WebP exact depose dans le dossier local prepare, avec droits et variante confirmes.",
        rejectionRisk: "Refuser si l'image est approximative, generique, mauvaise variante ou sans droits.",
        status: "TO_DO_HOLD",
        adminHref: internalAdminHref(product.productId, "image", stepOrder),
        nextAction: "Deposer le WebP exact local, verifier droits et variante, puis garder HOLD.",
      });
    }
  }

  return steps;
}

function markdown(summary) {
  const rows = summary.steps.map(
    (step) =>
      `| ${step.stepOrder} | ${step.top3Rank} | ${mdCell(step.productName)} | ${step.stepType} | ${mdCell(
        step.label,
      )} | ${mdCell(step.status)} |`,
  );

  return `${[
    "# Maxi Trouvailles - Plan deblocage top 3 sourcing integration",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Produits top 3: ${summary.productCount}`,
    `- Actions terrain: ${summary.stepCount}`,
    `- Preuves a remplir: ${summary.proofStepCount}`,
    `- Images WebP a deposer: ${summary.imageStepCount}`,
    `- Actions restantes: ${summary.remainingStepCount}`,
    `- Gate source: ${summary.gateStatus}`,
    "",
    "## Ordre d'execution",
    "",
    "| # | Top 3 | Produit | Type | Action | Statut |",
    "|---:|---:|---|---|---|---|",
    ...rows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule cote catalogue.",
    "- Aucune valeur fournisseur brute exportee.",
    "- Aucun telechargement image.",
    "- Aucune copie publique.",
    "- Aucun paiement, achat, publication ou commande fournisseur.",
    "- Validation humaine Mouss obligatoire avant tout deblocage.",
    "",
  ].join("\n")}\n`;
}

function toCsv(summary) {
  const headers = [
    "step_order",
    "top3_rank",
    "product_id",
    "product_name",
    "category_id",
    "step_type",
    "zone",
    "label",
    "expected_file_name",
    "status",
    "admin_href",
    "next_action",
    "expected_result",
    "rejection_risk",
  ];
  const rows = summary.steps.map((step) =>
    [
      step.stepOrder,
      step.top3Rank,
      step.productId,
      step.productName,
      step.categoryId,
      step.stepType,
      step.zone,
      step.label,
      step.expectedFileName ?? "",
      step.status,
      step.adminHref,
      step.nextAction,
      step.expectedResult,
      step.rejectionRisk,
    ]
      .map(csvEscape)
      .join(";"),
  );

  return `${headers.join(";")}\n${rows.join("\n")}${rows.length > 0 ? "\n" : ""}`;
}

const { dateKey, localLabel } = datePartsParis();
const gatePath = latestFile(
  businessGateRoot,
  /AUDIT_TOP3_BUSINESS_GATE_SOURCING_INTEGRATION_\d+\.json$/,
  "top3 business gate",
);
const gate = readJson(gatePath);
const steps = buildSteps(gate);
const proofStepCount = steps.filter((step) => step.stepType === "proof").length;
const imageStepCount = steps.filter((step) => step.stepType === "image").length;
const remainingStepCount = steps.filter((step) => step.status === "TO_DO_HOLD").length;
const structuralFailures = [];

if (gate.ok !== true) {
  structuralFailures.push({ code: "gate_not_ok", message: "Le gate business top 3 n'est pas OK structurellement." });
}

if (!["HOLD_TOP3_BUSINESS_GATE_BLOCKED", "READY_TOP3_BUSINESS_GATE_HUMAN_REVIEW_HOLD"].includes(gate.status)) {
  structuralFailures.push({ code: "gate_status_invalid", message: "Statut gate business non exploitable.", status: gate.status });
}

const summary = {
  ok: structuralFailures.length === 0 && isSafeOutput(steps),
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_integration_top3_unblock_plan",
  status:
    structuralFailures.length === 0 && remainingStepCount === 0
      ? "READY_TOP3_UNBLOCK_PLAN_HUMAN_REVIEW_HOLD"
      : structuralFailures.length === 0
        ? "HOLD_TOP3_UNBLOCK_PLAN_READY"
        : "FAIL_TOP3_UNBLOCK_PLAN_GUARDS",
  productCount: gate.productCount ?? 0,
  stepCount: steps.length,
  proofStepCount,
  imageStepCount,
  readyStepCount: steps.length - remainingStepCount,
  remainingStepCount,
  gateStatus: gate.status,
  gateBusinessBlockerCount: gate.businessBlockerCount ?? 0,
  structuralFailureCount: structuralFailures.length,
  structuralFailures,
  steps,
  sources: {
    businessGatePath: rel(gatePath),
  },
  safety: {
    readOnlyInputs: true,
    noCatalogWrite: true,
    noSupplierValueExport: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noImageDownload: true,
    noImageFileCreated: true,
    noPublicImageWrite: true,
    manualValidationRequired: true,
  },
};

if (!isSafeOutput(summary)) {
  summary.ok = false;
  summary.status = "FAIL_TOP3_UNBLOCK_PLAN_SENSITIVE_OUTPUT";
}

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const jsonPath = path.join(outputDir, `PLAN_DEBLOCAGE_TOP3_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `PLAN_DEBLOCAGE_TOP3_SOURCING_INTEGRATION_${dateKey}.md`);
const csvPath = path.join(outputDir, `plan-deblocage-top3-sourcing-integration-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, toCsv(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      status: summary.status,
      productCount: summary.productCount,
      stepCount: summary.stepCount,
      proofStepCount: summary.proofStepCount,
      imageStepCount: summary.imageStepCount,
      remainingStepCount: summary.remainingStepCount,
      structuralFailureCount: summary.structuralFailureCount,
      files: { jsonPath, mdPath, csvPath },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

if (!summary.ok) {
  process.exitCode = 1;
}

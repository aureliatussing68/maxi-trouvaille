import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessRoot = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessRoot, "tableaux-action");
const proofIntakeRoot = path.join(
  actionRoot,
  "preuves-internes-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const proofIntakeAuditRoot = path.join(
  actionRoot,
  "audit-preuves-internes-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const webpContractsRoot = path.join(
  actionRoot,
  "contrats-validation-webp-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const webpContractsAuditRoot = path.join(
  actionRoot,
  "audit-contrats-validation-webp-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const businessGateRoot = path.join(
  actionRoot,
  "audit-lot-actif-business-gate-prochaine-vague-sourcing-integration-articles",
);
const outputRoot = path.join(
  actionRoot,
  "revue-mouss-lot-actif-prochaine-vague-sourcing-integration-articles",
);

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
    if (!predicate || predicate(fullPath)) files.push(fullPath);
  }

  return files;
}

function latestFile(dir, pattern, label) {
  const files = walkFiles(dir, (filePath) => pattern.test(filePath));
  if (files.length === 0) throw new Error(`No ${label} found under ${dir}`);

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
  if (/[",\n\r;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function addIssue(issues, scope, code, message, details = {}) {
  issues.push({ scope, code, message, ...details });
}

function top(values, count = 3) {
  return (values ?? []).slice(0, count);
}

function markdown(summary) {
  const rows = summary.products.map(
    (product) =>
      `| ${product.rank} | ${mdCell(product.productName)} | ${product.reviewDecision} | ${product.proofTodoCount} | ${product.webpMissingCount} | ${product.blockedContractCount} | ${mdCell(product.nextMoussAction)} |`,
  );

  return `${[
    "# Revue Mouss lot actif prochaine vague",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Lot actif: ${summary.activeBatchId}`,
    `- Produits: ${summary.productCount}`,
    `- Produits prets revue: ${summary.readyForMoussReviewCount}`,
    `- Produits bloques HOLD: ${summary.blockedProductCount}`,
    `- Preuves a remplir: ${summary.proofTodoCount}`,
    `- WebP manquants: ${summary.webpMissingCount}`,
    `- Contrats WebP bloques: ${summary.blockedContractCount}`,
    `- Blocages business: ${summary.businessBlockerCount}`,
    "",
    "## Produits",
    "",
    "| Rang | Produit | Decision | Preuves TODO | WebP manquants | Contrats HOLD | Action Mouss |",
    "|---:|---|---|---:|---:|---:|---|",
    ...rows,
    "",
    "## Regles",
    "",
    "- Ne rien publier depuis ce board.",
    "- Ne pas commander fournisseur.",
    "- Ne pas copier d'image en public.",
    "- Valider seulement apres preuves internes, WebP exacts et droits image.",
    "- Garder les fournisseurs hors surface client.",
    "",
  ].join("\n")}\n`;
}

function csv(products) {
  const headers = [
    "rank",
    "batch_id",
    "product_id",
    "product_name",
    "category_id",
    "review_decision",
    "proof_todo_count",
    "webp_missing_count",
    "blocked_contract_count",
    "business_blocker_count",
    "next_mouss_action",
    "proof_files",
    "contract_files",
  ];

  return `${headers.join(";")}\n${products
    .map((product) =>
      [
        product.rank,
        product.batchId,
        product.productId,
        product.productName,
        product.categoryId,
        product.reviewDecision,
        product.proofTodoCount,
        product.webpMissingCount,
        product.blockedContractCount,
        product.businessBlockerCount,
        product.nextMoussAction,
        product.proofFiles,
        product.contractFiles,
      ]
        .map(csvEscape)
        .join(";"),
    )
    .join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const proofIntakePath = latestFile(
  proofIntakeRoot,
  /PROOF_INTAKE_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch proof intake",
);
const proofIntakeAuditPath = latestFile(
  proofIntakeAuditRoot,
  /AUDIT_PROOF_INTAKE_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch proof intake audit",
);
const webpContractsPath = latestFile(
  webpContractsRoot,
  /WEBP_VALIDATION_CONTRACTS_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch webp validation contracts",
);
const webpContractsAuditPath = latestFile(
  webpContractsAuditRoot,
  /AUDIT_WEBP_VALIDATION_CONTRACTS_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch webp validation contracts audit",
);
const businessGatePath = latestFile(
  businessGateRoot,
  /AUDIT_ACTIVE_BATCH_BUSINESS_GATE_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch business gate",
);

const proofIntake = readJson(proofIntakePath);
const proofIntakeAudit = readJson(proofIntakeAuditPath);
const webpContracts = readJson(webpContractsPath);
const webpContractsAudit = readJson(webpContractsAuditPath);
const businessGate = readJson(businessGatePath);
const issues = [];

if (proofIntake.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_PROOF_INTAKE_READY") {
  addIssue(issues, "proof_intake", "proof_intake_status_invalid", "Les preuves internes doivent etre pretes en HOLD.", {
    status: proofIntake.status,
  });
}
if (proofIntakeAudit.status !== "OK_NEXT_WAVE_ACTIVE_BATCH_PROOF_INTAKE_GUARDED") {
  addIssue(issues, "proof_intake_audit", "proof_intake_audit_not_ok", "L'audit preuves internes doit etre OK.", {
    status: proofIntakeAudit.status,
  });
}
if (webpContracts.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_WEBP_VALIDATION_CONTRACTS_READY") {
  addIssue(issues, "webp_contracts", "webp_contracts_status_invalid", "Les contrats WebP doivent etre prets en HOLD.", {
    status: webpContracts.status,
  });
}
if (webpContractsAudit.status !== "OK_NEXT_WAVE_ACTIVE_BATCH_WEBP_VALIDATION_CONTRACTS_GUARDED") {
  addIssue(issues, "webp_contracts_audit", "webp_contracts_audit_not_ok", "L'audit contrats WebP doit etre OK.", {
    status: webpContractsAudit.status,
  });
}
if (businessGate.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_BUSINESS_GATE_BLOCKED") {
  addIssue(issues, "business_gate", "business_gate_status_unexpected", "Le gate business doit rester bloque tant que les preuves manquent.", {
    status: businessGate.status,
  });
}

const products = (businessGate.productSummaries ?? []).map((gateProduct) => {
  const proofProduct = (proofIntake.products ?? []).find((product) => product.productId === gateProduct.productId);
  const proofRows = (proofIntake.proofs ?? []).filter((proof) => proof.productId === gateProduct.productId);
  const contractProduct = (webpContracts.products ?? []).find((product) => product.productId === gateProduct.productId);
  const contractRows = (webpContracts.contracts ?? []).filter((contract) => contract.productId === gateProduct.productId);
  const proofTodoCount = proofRows.filter((proof) => proof.status === "TO_FILL_HOLD").length;
  const webpMissingCount = contractRows.filter((contract) => contract.webpFileState === "missing").length;
  const blockedContractCount = contractRows.filter((contract) => contract.decision?.status === "BLOCKED_HOLD").length;
  const readyForMouss =
    proofTodoCount === 0 &&
    webpMissingCount === 0 &&
    blockedContractCount === 0 &&
    gateProduct.missingProofCount === 0 &&
    gateProduct.missingImageCount === 0 &&
    gateProduct.invalidImageCount === 0;

  return {
    rank: gateProduct.rank,
    batchId: gateProduct.batchId,
    productId: gateProduct.productId,
    productName: gateProduct.productName,
    categoryId: gateProduct.categoryId,
    reviewDecision: readyForMouss ? "READY_FOR_MOUSS_REVIEW_HOLD" : "BLOCKED_MOUSS_REVIEW_HOLD",
    readyForMouss,
    proofTodoCount,
    proofFileCount: proofProduct?.proofFileCount ?? proofRows.length,
    webpMissingCount,
    webpValidCount: contractRows.filter((contract) => contract.webpFileState === "present_valid_header").length,
    webpInvalidCount: contractRows.filter((contract) => contract.webpFileState === "present_invalid_header").length,
    blockedContractCount,
    businessBlockerCount:
      (gateProduct.missingProofCount ?? 0) + (gateProduct.missingImageCount ?? 0) + (gateProduct.invalidImageCount ?? 0),
    missingProofLabels: gateProduct.missingProofLabels ?? [],
    missingImageLabels: gateProduct.missingImageLabels ?? [],
    proofFiles: proofRows.map((proof) => proof.proofPath),
    contractFiles: contractRows.map((contract) => contract.contractPath),
    nextMoussAction: readyForMouss
      ? "relire preuves, WebP exacts, droits image et confirmer la fiche en revue humaine HOLD"
      : [
          proofTodoCount > 0 ? `${proofTodoCount} preuves internes a remplir` : "",
          webpMissingCount > 0 ? `${webpMissingCount} WebP exacts a deposer` : "",
          blockedContractCount > 0 ? `${blockedContractCount} contrats WebP bloques` : "",
        ]
          .filter(Boolean)
          .join(", "),
  };
});

if (products.length !== 4 || proofIntake.proofTaskCount !== 20 || webpContracts.contractFileCount !== 12) {
  addIssue(issues, "review_scope", "review_scope_invalid", "La revue Mouss doit couvrir 4 produits, 20 preuves et 12 contrats WebP.", {
    productCount: products.length,
    proofTaskCount: proofIntake.proofTaskCount,
    contractFileCount: webpContracts.contractFileCount,
  });
}

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: issues.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_mouss_review_board_integration_next_wave_active_batch",
  status:
    issues.length === 0
      ? "HOLD_NEXT_WAVE_ACTIVE_BATCH_MOUSS_REVIEW_BOARD_READY"
      : "FAIL_NEXT_WAVE_ACTIVE_BATCH_MOUSS_REVIEW_BOARD",
  activeBatchId: businessGate.activeBatchId,
  productCount: products.length,
  readyForMoussReviewCount: products.filter((product) => product.readyForMouss).length,
  blockedProductCount: products.filter((product) => !product.readyForMouss).length,
  proofTodoCount: products.reduce((sum, product) => sum + product.proofTodoCount, 0),
  proofFileCount: proofIntake.proofFileCount ?? 0,
  webpMissingCount: products.reduce((sum, product) => sum + product.webpMissingCount, 0),
  webpValidCount: products.reduce((sum, product) => sum + product.webpValidCount, 0),
  webpInvalidCount: products.reduce((sum, product) => sum + product.webpInvalidCount, 0),
  contractFileCount: webpContracts.contractFileCount ?? 0,
  blockedContractCount: products.reduce((sum, product) => sum + product.blockedContractCount, 0),
  businessBlockerCount: businessGate.businessBlockerCount ?? 0,
  structuralFailureCount: issues.length,
  structuralFailures: issues,
  topMoussActions: top(products, 4).map((product) => ({
    productId: product.productId,
    productName: product.productName,
    action: product.nextMoussAction,
  })),
  products,
  sources: {
    proofIntakePath: rel(proofIntakePath),
    proofIntakeAuditPath: rel(proofIntakeAuditPath),
    webpContractsPath: rel(webpContractsPath),
    webpContractsAuditPath: rel(webpContractsAuditPath),
    businessGatePath: rel(businessGatePath),
  },
  safety: {
    readOnlyBoard: true,
    noCatalogWrite: true,
    noPublicImageWrite: true,
    noImageDownload: true,
    noImageGeneration: true,
    noSupplierValueExport: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noMessageSent: true,
    manualValidationRequired: true,
  },
};

const jsonPath = path.join(outputDir, `MOUSS_REVIEW_BOARD_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `revue-mouss-lot-actif-prochaine-vague-sourcing-${dateKey}.md`);
const csvPath = path.join(outputDir, `revue-mouss-lot-actif-produits-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(products), "utf8");

console.log(
  JSON.stringify(
    {
      status: summary.status,
      ok: summary.ok,
      activeBatchId: summary.activeBatchId,
      productCount: summary.productCount,
      readyForMoussReviewCount: summary.readyForMoussReviewCount,
      blockedProductCount: summary.blockedProductCount,
      proofTodoCount: summary.proofTodoCount,
      webpMissingCount: summary.webpMissingCount,
      blockedContractCount: summary.blockedContractCount,
      businessBlockerCount: summary.businessBlockerCount,
      outputDir: rel(outputDir),
    },
    null,
    2,
  ),
);

if (!summary.ok) process.exitCode = 1;

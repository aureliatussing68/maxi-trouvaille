import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessRoot = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessRoot, "tableaux-action");
const webpDepositRoot = path.join(
  actionRoot,
  "depots-webp-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const webpDepositAuditRoot = path.join(
  actionRoot,
  "audit-depots-webp-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const outputRoot = path.join(
  actionRoot,
  "contrats-validation-webp-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const allowedDepositPrefix = "business-maxi-trouvailles/depots-images-exactes/integration-articles/";

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

function normalizeRel(value) {
  return String(value ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function resolveInsideRoot(relativePath) {
  const normalized = normalizeRel(relativePath);
  const absolutePath = path.resolve(root, normalized);
  const rootPath = path.resolve(root);
  if (!absolutePath.startsWith(`${rootPath}${path.sep}`)) {
    throw new Error(`Refusing to write outside workspace: ${relativePath}`);
  }

  return absolutePath;
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

function isSafeDepositPath(value, dateKey) {
  const text = normalizeRel(value);
  return text.startsWith(`${allowedDepositPrefix}${dateKey}/`) && !text.includes("..") && !path.isAbsolute(text);
}

function sidecarPathForImage(image) {
  const targetPath = normalizeRel(image.targetPath);
  return targetPath.replace(/\.webp$/i, ".validation-contract.json");
}

function webpFileState(targetPath) {
  const absolutePath = resolveInsideRoot(targetPath);
  if (!fs.existsSync(absolutePath)) return "missing";
  const buffer = fs.readFileSync(absolutePath);
  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return isWebp ? "present_valid_header" : "present_invalid_header";
}

function buildContract({ image, dateKey, generatedAt, localLabel }) {
  const sidecarPath = sidecarPathForImage(image);
  const webpState = webpFileState(image.targetPath);

  return {
    schemaVersion: "maxi-webp-validation-contract-v1",
    generatedAt,
    generatedAtLocal: localLabel,
    status: "WEBP_VALIDATION_CONTRACT_HOLD",
    batchId: image.batchId,
    productId: image.productId,
    productName: image.productName,
    categoryId: image.categoryId,
    productRank: image.productRank,
    imageOrder: image.order,
    imageRole: image.role,
    expectedWebpFileName: image.expectedFileName,
    targetPath: image.targetPath,
    contractPath: sidecarPath,
    webpFileState: webpState,
    requiredProofs: {
      exactSupplierProductUrl: "TO_FILL_HOLD",
      supplierSellerIdentity: "TO_FILL_HOLD",
      skuOrVariantReference: "TO_FILL_HOLD",
      supplierPrice: "TO_FILL_HOLD",
      stockAndDelayFranceEurope: "TO_FILL_HOLD",
      imageRightsEvidence: "TO_FILL_HOLD",
      sameArticleConfirmation: "TO_FILL_HOLD",
      moussHumanValidation: "TO_FILL_HOLD",
    },
    acceptanceChecks: {
      webpFileExistsAndValidHeader: webpState === "present_valid_header",
      exactProductSameModelConfirmed: false,
      exactVariantConfirmed: false,
      skuMatchesSupplierProof: false,
      supplierPriceRecordedInternally: false,
      stockAndDelayRecordedInternally: false,
      imageRightsConfirmed: false,
      moussValidationApproved: false,
      noApproximateImage: true,
      noPublicCopy: true,
      noMarketplaceClientLeak: true,
    },
    decision: {
      status: "BLOCKED_HOLD",
      reason:
        "Attente du vrai fichier WebP exact, des preuves fournisseur/image, des droits image et de la validation humaine Mouss.",
      mayCopyToPublicUploads: false,
      mayPublishProduct: false,
      mayOrderSupplier: false,
    },
    safety: {
      noCatalogWrite: true,
      noPublicImageWrite: true,
      noImageDownload: true,
      noImageGeneration: true,
      noSupplierValueExport: true,
      noPublication: true,
      noPayment: true,
      noSupplierOrder: true,
      manualValidationRequired: true,
    },
  };
}

function markdown(summary) {
  const rows = summary.products.map(
    (product) =>
      `| ${product.rank} | ${mdCell(product.productName)} | ${product.contractFileCount} | ${product.blockedContractCount} | ${product.validWebpFileCount} | ${product.missingWebpFileCount} |`,
  );

  return `${[
    "# Contrats validation WebP lot actif",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Lot actif: ${summary.activeBatchId}`,
    `- Produits: ${summary.productCount}`,
    `- Contrats WebP: ${summary.contractFileCount}`,
    `- Contrats bloques HOLD: ${summary.blockedContractCount}`,
    `- WebP valides presents: ${summary.validWebpFileCount}`,
    `- WebP manquants: ${summary.missingWebpFileCount}`,
    `- WebP invalides: ${summary.invalidWebpFileCount}`,
    "",
    "## Produits",
    "",
    "| Rang | Produit | Contrats | HOLD | WebP valides | WebP manquants |",
    "|---:|---|---:|---:|---:|---:|",
    ...rows,
    "",
    "## Garde-fous",
    "",
    "- Les contrats sont locaux et internes.",
    "- Ils ne remplacent pas la validation Mouss.",
    "- Aucun WebP n'est cree automatiquement.",
    "- Aucune copie vers public/uploads.",
    "- Aucun fournisseur n'est expose au client.",
    "",
  ].join("\n")}\n`;
}

function contractsCsv(contracts) {
  const headers = [
    "product_rank",
    "batch_id",
    "product_id",
    "product_name",
    "image_order",
    "image_role",
    "expected_webp_file",
    "webp_file_state",
    "contract_status",
    "decision_status",
    "target_path",
    "contract_path",
  ];

  return `${headers.join(";")}\n${contracts
    .map((contract) =>
      [
        contract.productRank,
        contract.batchId,
        contract.productId,
        contract.productName,
        contract.imageOrder,
        contract.imageRole,
        contract.expectedWebpFileName,
        contract.webpFileState,
        contract.status,
        contract.decision.status,
        contract.targetPath,
        contract.contractPath,
      ]
        .map(csvEscape)
        .join(";"),
    )
    .join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const generatedAt = new Date().toISOString();
const webpDepositPath = latestFile(
  webpDepositRoot,
  /WEBP_DEPOSIT_INTAKE_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch webp deposit intake",
);
const webpDepositAuditPath = latestFile(
  webpDepositAuditRoot,
  /AUDIT_WEBP_DEPOSIT_INTAKE_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch webp deposit audit",
);

const webpDeposit = readJson(webpDepositPath);
const webpDepositAudit = readJson(webpDepositAuditPath);
const issues = [];

if (webpDeposit.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_WEBP_DEPOSIT_INTAKE_READY") {
  addIssue(issues, "webp_deposit", "webp_deposit_status_invalid", "L'intake depot WebP doit etre pret en HOLD.", {
    status: webpDeposit.status,
  });
}

if (webpDepositAudit.status !== "OK_NEXT_WAVE_ACTIVE_BATCH_WEBP_DEPOSIT_INTAKE_GUARDED") {
  addIssue(issues, "webp_deposit_audit", "webp_deposit_audit_not_ok", "L'audit depot WebP doit etre OK.", {
    status: webpDepositAudit.status,
  });
}

const contracts = [];
for (const image of webpDeposit.images ?? []) {
  if (!isSafeDepositPath(image.targetPath, dateKey)) {
    addIssue(issues, image.productId, "target_path_invalid", "Chemin WebP cible invalide.", {
      targetPath: image.targetPath,
    });
    continue;
  }

  const contract = buildContract({ image, dateKey, generatedAt, localLabel });
  if (!isSafeDepositPath(contract.contractPath, dateKey)) {
    addIssue(issues, image.productId, "contract_path_invalid", "Chemin contrat WebP invalide.", {
      contractPath: contract.contractPath,
    });
    continue;
  }

  const absoluteContractPath = resolveInsideRoot(contract.contractPath);
  fs.mkdirSync(path.dirname(absoluteContractPath), { recursive: true });
  if (!fs.existsSync(absoluteContractPath)) {
    fs.writeFileSync(absoluteContractPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
  }

  contracts.push(readJson(absoluteContractPath));
}

if ((webpDeposit.productCount ?? 0) !== 4 || contracts.length !== 12) {
  addIssue(issues, "contracts", "contract_scope_invalid", "Les contrats WebP doivent couvrir 4 produits et 12 images.", {
    productCount: webpDeposit.productCount,
    contractCount: contracts.length,
  });
}

const productSummaries = (webpDeposit.products ?? []).map((product) => {
  const productContracts = contracts.filter((contract) => contract.productId === product.productId);
  return {
    rank: product.rank,
    productId: product.productId,
    productName: product.productName,
    categoryId: product.categoryId,
    contractFileCount: productContracts.length,
    blockedContractCount: productContracts.filter((contract) => contract.decision?.status === "BLOCKED_HOLD").length,
    validWebpFileCount: productContracts.filter((contract) => contract.webpFileState === "present_valid_header").length,
    missingWebpFileCount: productContracts.filter((contract) => contract.webpFileState === "missing").length,
    invalidWebpFileCount: productContracts.filter((contract) => contract.webpFileState === "present_invalid_header").length,
    contractPaths: productContracts.map((contract) => contract.contractPath),
  };
});

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: issues.length === 0,
  generatedAt,
  generatedAtLocal: localLabel,
  mode: "local_hold_integration_next_wave_active_batch_webp_validation_contracts",
  status:
    issues.length === 0
      ? "HOLD_NEXT_WAVE_ACTIVE_BATCH_WEBP_VALIDATION_CONTRACTS_READY"
      : "FAIL_NEXT_WAVE_ACTIVE_BATCH_WEBP_VALIDATION_CONTRACTS",
  activeBatchId: webpDeposit.activeBatchId,
  productCount: webpDeposit.productCount ?? 0,
  imageTaskCount: webpDeposit.imageTaskCount ?? 0,
  contractFileCount: contracts.length,
  blockedContractCount: contracts.filter((contract) => contract.decision?.status === "BLOCKED_HOLD").length,
  validWebpFileCount: contracts.filter((contract) => contract.webpFileState === "present_valid_header").length,
  missingWebpFileCount: contracts.filter((contract) => contract.webpFileState === "missing").length,
  invalidWebpFileCount: contracts.filter((contract) => contract.webpFileState === "present_invalid_header").length,
  structuralFailureCount: issues.length,
  structuralFailures: issues,
  products: productSummaries,
  contracts,
  sources: {
    webpDepositPath: rel(webpDepositPath),
    webpDepositAuditPath: rel(webpDepositAuditPath),
  },
  safety: {
    localSidecarsOnly: true,
    noCatalogWrite: true,
    noPublicImageWrite: true,
    noImageDownload: true,
    noImageGeneration: true,
    noSupplierValueExport: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    manualValidationRequired: true,
  },
};

const jsonPath = path.join(
  outputDir,
  `WEBP_VALIDATION_CONTRACTS_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`,
);
const mdPath = path.join(outputDir, `contrats-validation-webp-lot-actif-prochaine-vague-sourcing-${dateKey}.md`);
const csvPath = path.join(outputDir, `contrats-validation-webp-lot-actif-items-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, contractsCsv(contracts), "utf8");

console.log(
  JSON.stringify(
    {
      status: summary.status,
      ok: summary.ok,
      activeBatchId: summary.activeBatchId,
      productCount: summary.productCount,
      contractFileCount: summary.contractFileCount,
      blockedContractCount: summary.blockedContractCount,
      validWebpFileCount: summary.validWebpFileCount,
      missingWebpFileCount: summary.missingWebpFileCount,
      invalidWebpFileCount: summary.invalidWebpFileCount,
      outputDir: rel(outputDir),
    },
    null,
    2,
  ),
);

if (!summary.ok) process.exitCode = 1;

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const activeBatchRoot = path.join(actionRoot, "lot-actif-prochaine-vague-sourcing-integration-articles");
const businessGateRoot = path.join(
  actionRoot,
  "audit-lot-actif-business-gate-prochaine-vague-sourcing-integration-articles",
);
const outputRoot = path.join(actionRoot, "micro-packs-lot-actif-prochaine-vague-sourcing-integration-articles");
const allowedBusinessGateStatuses = new Set([
  "HOLD_NEXT_WAVE_ACTIVE_BATCH_BUSINESS_GATE_BLOCKED",
  "READY_NEXT_WAVE_ACTIVE_BATCH_BUSINESS_GATE_HUMAN_REVIEW_HOLD",
]);

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

function addIssue(issues, scope, code, message, details = {}) {
  issues.push({ scope, code, message, ...details });
}

function productFileStem(rank, product) {
  const rankLabel = String(rank).padStart(2, "0");
  return `${rankLabel}-${product.slug ?? product.productId}`;
}

function localProofPath(dateKey, product, proof) {
  return [
    "business-maxi-trouvailles",
    "preuves-internes",
    "integration-articles",
    dateKey,
    product.slug ?? product.productId,
    `${proof.key}.md`,
  ].join("/");
}

function buildProductPack(product, order, dateKey) {
  const proofTasks = (product.proofTasks ?? []).map((proof) => ({
    taskId: proof.taskId,
    order: proof.order,
    key: proof.key,
    zone: proof.zone,
    label: proof.label,
    status: "TO_FILL_HOLD",
    expectedFormat: proof.expectedFormat,
    rejectIf: proof.rejectIf,
    adminHref: product.adminProofHref,
    manualValue: "",
    evidenceNote: "",
    localProofPath: localProofPath(dateKey, product, proof),
    checkedSameArticle: "",
    moussValidation: "",
    finalDecision: "TO_DECIDE_HOLD",
  }));

  const imageTasks = (product.imageTasks ?? []).map((image) => ({
    taskId: image.taskId,
    order: image.order,
    role: image.role,
    label: image.label,
    status: "TO_DEPOSIT_HOLD",
    expectedFileName: image.expectedFileName,
    depositDirRelative: image.depositDirRelative,
    localFilePath: `${image.depositDirRelative}/${image.expectedFileName}`,
    checkedSameArticle: "",
    rightsConfirmed: "",
    variantConfirmed: "",
    moussValidation: "",
    finalDecision: "TO_DECIDE_HOLD",
  }));

  const proofActions = proofTasks.map((proof) => ({
    actionOrder: order * 100 + proof.order,
    actionType: "proof",
    productId: product.productId,
    productName: product.productName,
    categoryId: product.categoryId,
    label: proof.label,
    status: proof.status,
    nextAction: `Remplir preuve interne: ${proof.label}`,
    adminHref: proof.adminHref,
    targetPath: proof.localProofPath,
    rejectIf: proof.rejectIf,
  }));
  const imageActions = imageTasks.map((image) => ({
    actionOrder: order * 100 + 50 + image.order,
    actionType: "image",
    productId: product.productId,
    productName: product.productName,
    categoryId: product.categoryId,
    label: image.label,
    status: image.status,
    nextAction: `Deposer WebP exact: ${image.expectedFileName}`,
    adminHref: product.adminProofHref,
    targetPath: image.localFilePath,
    rejectIf: "Refuser si l'image ne montre pas exactement la variante vendue ou si les droits image ne sont pas confirmes.",
  }));

  return {
    packId: `${product.productId}#micro-pack`,
    rank: product.nextWaveRank ?? order,
    batchId: product.batchId,
    productId: product.productId,
    slug: product.slug,
    productName: product.productName,
    categoryId: product.categoryId,
    status: "HOLD_ACTIVE_BATCH_MICRO_PACK_READY",
    targetSalePrice: product.targetSalePrice,
    targetMargin: product.targetMargin,
    adminProofHref: product.adminProofHref,
    sourceImagePlaceholder: product.sourceImagePlaceholder,
    proofTaskCount: proofTasks.length,
    imageTaskCount: imageTasks.length,
    actionCount: proofActions.length + imageActions.length,
    proofTasks,
    imageTasks,
    actions: [...proofActions, ...imageActions],
    blockers: [
      "preuve fournisseur exacte manquante",
      "SKU ou variante exacte manquante",
      "prix fournisseur reel manquant",
      "WebP exact manquant",
      "droits image non confirmes",
      "validation Mouss manquante",
    ],
    safety: {
      holdOnly: true,
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
}

function productMarkdown(pack) {
  const proofRows = pack.proofTasks.map(
    (proof) =>
      `| ${proof.order} | ${mdCell(proof.label)} | ${mdCell(proof.expectedFormat)} | ${proof.status} | ${mdCell(proof.localProofPath)} |`,
  );
  const imageRows = pack.imageTasks.map(
    (image) =>
      `| ${image.order} | ${mdCell(image.role)} | ${mdCell(image.expectedFileName)} | ${mdCell(image.depositDirRelative)} | ${image.status} |`,
  );
  const actionRows = pack.actions.map(
    (action) =>
      `| ${action.actionOrder} | ${action.actionType} | ${mdCell(action.label)} | ${action.status} | ${mdCell(action.targetPath)} |`,
  );

  return `${[
    `# Micro-pack lot actif - ${pack.productName}`,
    "",
    `Statut: ${pack.status}`,
    `Lot: ${pack.batchId}`,
    `Produit: ${pack.productId}`,
    `Categorie: ${pack.categoryId}`,
    `Lien admin interne: ${pack.adminProofHref}`,
    "",
    "## Preuves a remplir",
    "",
    "| Ordre | Preuve | Format attendu | Statut | Chemin local suggere |",
    "|---:|---|---|---|---|",
    ...proofRows,
    "",
    "## WebP exacts a deposer",
    "",
    "| Ordre | Role | Fichier attendu | Dossier depot | Statut |",
    "|---:|---|---|---|---|",
    ...imageRows,
    "",
    "## Actions terrain",
    "",
    "| Ordre | Type | Action | Statut | Cible |",
    "|---:|---|---|---|---|",
    ...actionRows,
    "",
    "## Garde-fous",
    "",
    "- Ne pas publier.",
    "- Ne pas commander fournisseur.",
    "- Ne pas copier dans public/uploads.",
    "- Ne pas utiliser d'image approximative.",
    "- Garder les valeurs fournisseur uniquement dans les preuves internes.",
    "- Validation Mouss obligatoire avant toute suite.",
    "",
  ].join("\n")}\n`;
}

function summaryMarkdown(summary) {
  const productRows = summary.products.map(
    (product) =>
      `| ${product.rank} | ${mdCell(product.productName)} | ${product.proofTaskCount} | ${product.imageTaskCount} | ${product.actionCount} | ${mdCell(product.relativeMdPath)} |`,
  );

  return `${[
    "# Micro-packs lot actif prochaine vague",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Lot actif: ${summary.activeBatchId}`,
    `- Produits: ${summary.productCount}`,
    `- Preuves a remplir: ${summary.proofTaskCount}`,
    `- WebP exacts a deposer: ${summary.imageTaskCount}`,
    `- Actions terrain: ${summary.actionCount}`,
    `- Gate business source: ${summary.businessGateStatus}`,
    `- Blocages gate source: ${summary.businessGateBusinessBlockerCount}`,
    "",
    "## Fiches",
    "",
    "| Rang | Produit | Preuves | WebP | Actions | Fiche |",
    "|---:|---|---:|---:|---:|---|",
    ...productRows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule cote catalogue.",
    "- Aucune valeur fournisseur brute remplie.",
    "- Aucune image creee, telechargee ou copiee.",
    "- Aucune publication, aucun paiement, aucune commande fournisseur.",
    "- Tout reste en HOLD jusqu'a validation humaine Mouss.",
    "",
  ].join("\n")}\n`;
}

function actionsCsv(actions) {
  const headers = [
    "action_order",
    "batch_id",
    "product_rank",
    "product_id",
    "product_name",
    "category_id",
    "action_type",
    "label",
    "status",
    "next_action",
    "admin_href",
    "target_path",
    "reject_if",
  ];
  return `${headers.join(";")}\n${actions
    .map((action) =>
      [
        action.actionOrder,
        action.batchId,
        action.productRank,
        action.productId,
        action.productName,
        action.categoryId,
        action.actionType,
        action.label,
        action.status,
        action.nextAction,
        action.adminHref,
        action.targetPath,
        action.rejectIf,
      ]
        .map(csvEscape)
        .join(";"),
    )
    .join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const activeBatchPath = latestFile(
  activeBatchRoot,
  /ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch",
);
const businessGatePath = latestFile(
  businessGateRoot,
  /AUDIT_ACTIVE_BATCH_BUSINESS_GATE_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch business gate",
);
const activeBatch = readJson(activeBatchPath);
const businessGate = readJson(businessGatePath);
const issues = [];

if (activeBatch.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_READY") {
  addIssue(issues, "active_batch", "active_batch_status_invalid", "Le lot actif doit rester en HOLD pret.", {
    status: activeBatch.status,
  });
}

if (!allowedBusinessGateStatuses.has(businessGate.status) || businessGate.failureCount !== 0) {
  addIssue(issues, "business_gate", "business_gate_not_usable", "Le gate business lot actif n'est pas exploitable.", {
    status: businessGate.status,
    failureCount: businessGate.failureCount,
  });
}

if ((businessGate.sensitiveFindingCount ?? 0) !== 0) {
  addIssue(issues, "business_gate", "business_gate_sensitive_findings", "Le gate business lot actif signale une fuite.", {
    sensitiveFindingCount: businessGate.sensitiveFindingCount,
  });
}

const packs = (activeBatch.products ?? []).map((product, index) => buildProductPack(product, index + 1, dateKey));
const allActions = packs
  .flatMap((pack) =>
    pack.actions.map((action) => ({
      ...action,
      batchId: pack.batchId,
      productRank: pack.rank,
    })),
  )
  .sort((a, b) => a.actionOrder - b.actionOrder);

if (packs.length !== 4 || allActions.length !== 32) {
  addIssue(issues, "micro_packs", "micro_pack_scope_invalid", "Les micro-packs doivent couvrir 4 produits et 32 actions.", {
    packCount: packs.length,
    actionCount: allActions.length,
  });
}

const outputDir = path.join(outputRoot, dateKey);
const productDir = path.join(outputDir, "fiches-produits");
fs.mkdirSync(productDir, { recursive: true });

for (const pack of packs) {
  const stem = productFileStem(pack.rank, pack);
  const jsonPath = path.join(productDir, `${stem}.json`);
  const mdPath = path.join(productDir, `${stem}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdPath, productMarkdown(pack), "utf8");
  pack.relativeJsonPath = rel(jsonPath);
  pack.relativeMdPath = rel(mdPath);
}

const summary = {
  ok: issues.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_integration_next_wave_active_batch_micro_packs",
  status: issues.length === 0 ? "HOLD_NEXT_WAVE_ACTIVE_BATCH_MICRO_PACKS_READY" : "FAIL_NEXT_WAVE_ACTIVE_BATCH_MICRO_PACKS",
  activeBatchId: activeBatch.activeBatchId,
  productCount: packs.length,
  proofTaskCount: packs.reduce((total, pack) => total + pack.proofTaskCount, 0),
  imageTaskCount: packs.reduce((total, pack) => total + pack.imageTaskCount, 0),
  actionCount: allActions.length,
  businessGateStatus: businessGate.status,
  businessGateBusinessBlockerCount: businessGate.businessBlockerCount ?? 0,
  structuralFailureCount: issues.length,
  structuralFailures: issues,
  products: packs.map((pack) => ({
    rank: pack.rank,
    batchId: pack.batchId,
    productId: pack.productId,
    slug: pack.slug,
    productName: pack.productName,
    categoryId: pack.categoryId,
    status: pack.status,
    proofTaskCount: pack.proofTaskCount,
    imageTaskCount: pack.imageTaskCount,
    actionCount: pack.actionCount,
    adminProofHref: pack.adminProofHref,
    relativeJsonPath: pack.relativeJsonPath,
    relativeMdPath: pack.relativeMdPath,
  })),
  actions: allActions,
  sources: {
    activeBatchPath: rel(activeBatchPath),
    businessGatePath: rel(businessGatePath),
  },
  safety: {
    readOnlyInputs: true,
    noCatalogWrite: true,
    noSupplierValueExport: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noExternalContact: true,
    noImageDownload: true,
    noImageFileCreated: true,
    noPublicImageWrite: true,
    manualValidationRequired: true,
    businessGateRequired: true,
  },
};

const jsonPath = path.join(outputDir, `MICRO_PACKS_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `micro-packs-lot-actif-prochaine-vague-sourcing-${dateKey}.md`);
const csvPath = path.join(outputDir, `micro-packs-lot-actif-actions-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, summaryMarkdown(summary), "utf8");
fs.writeFileSync(csvPath, actionsCsv(allActions), "utf8");

console.log(
  JSON.stringify(
    {
      status: summary.status,
      ok: summary.ok,
      activeBatchId: summary.activeBatchId,
      productCount: summary.productCount,
      proofTaskCount: summary.proofTaskCount,
      imageTaskCount: summary.imageTaskCount,
      actionCount: summary.actionCount,
      productPackCount: packs.length,
      businessGateStatus: summary.businessGateStatus,
      outputDir: rel(outputDir),
    },
    null,
    2,
  ),
);

if (!summary.ok) {
  process.exitCode = 1;
}

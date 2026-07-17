import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const auditIntegrationRoot = path.join(actionRoot, "audit-integration-articles");
const top3Root = path.join(actionRoot, "top3-sourcing-integration-articles");
const outputRoot = path.join(actionRoot, "prochaine-vague-sourcing-integration-articles");

const proofTemplates = [
  {
    key: "exact_product_reference",
    zone: "Source produit exacte",
    label: "Reference produit exacte",
    expectedFormat: "Reference interne complete, a garder hors surface client.",
    rejectIf: "Refuser si la fiche ne montre pas exactement le meme article.",
  },
  {
    key: "partner_name",
    zone: "Partenaire logistique",
    label: "Nom vendeur ou partenaire",
    expectedFormat: "Nom du partenaire identifie, conserve uniquement dans les preuves internes.",
    rejectIf: "Refuser si le partenaire n'est pas identifiable.",
  },
  {
    key: "supplier_sku",
    zone: "Reference produit",
    label: "SKU/reference fournisseur",
    expectedFormat: "Reference produit ou variante exacte reliee au meme article.",
    rejectIf: "Refuser si la reference ne correspond pas a la variante cible.",
  },
  {
    key: "exact_variant",
    zone: "Variante",
    label: "Variante exacte vendue",
    expectedFormat: "Couleur, taille, lot et option confirmes avant toute revue.",
    rejectIf: "Refuser si la variante est ambigue ou differente.",
  },
  {
    key: "real_supplier_price_cents",
    zone: "Prix et marge",
    label: "Prix fournisseur reel en centimes",
    expectedFormat: "Prix reel saisi en centimes pour verifier marge et prix cible.",
    rejectIf: "Refuser si le cout est estime, incomplet ou non relie a la variante.",
  },
];

const imageRoles = [
  { role: "main", label: "Image principale exacte" },
  { role: "detail-1", label: "Image detail exacte" },
  { role: "variant", label: "Image variante exacte" },
];

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

function slugSafe(value) {
  return (
    String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "article"
  );
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

function internalAdminHref(productId) {
  return `/admin/preuves-partenaires?status=hold&q=${encodeURIComponent(productId)}#next-wave-sourcing`;
}

function top3ProductIds(top3) {
  return new Set((top3.rows ?? []).map((row) => row.productId).filter(Boolean));
}

function selectRows(integrationAudit, excludedIds, limit = 12) {
  return [...(integrationAudit.sourcingBoard ?? [])]
    .filter((row) => row.status === "HOLD_READY_FOR_MANUAL_SOURCING")
    .filter((row) => !excludedIds.has(row.id))
    .sort(
      (a, b) =>
        (b.priorityScore ?? 0) - (a.priorityScore ?? 0) ||
        String(a.name ?? "").localeCompare(String(b.name ?? ""), "fr"),
    )
    .slice(0, limit);
}

function imageFileName(slug, role) {
  return `${slugSafe(slug)}-${role}.webp`;
}

function buildProducts(rows, dateKey) {
  return rows.map((row, index) => {
    const slug = slugSafe(row.slug || `${row.name}-partenaire-hold`);
    const imageDepositDirRelative = `business-maxi-trouvailles/depots-images-exactes/integration-articles/${dateKey}/${slug}`;
    const expectedImageFiles = imageRoles.map((item) => imageFileName(slug, item.role));

    return {
      nextWaveRank: index + 1,
      productId: row.id,
      slug,
      productName: row.name,
      categoryId: row.categoryId,
      status: "HOLD_NEXT_WAVE_SOURCING_READY",
      sourceStatus: row.status,
      priorityScore: row.priorityScore,
      targetSalePrice: row.targetSalePrice,
      targetMargin: row.targetMargin,
      sourceImagePlaceholder: row.image,
      adminProofHref: internalAdminHref(row.id),
      nextAction:
        "Remplir les preuves internes, deposer uniquement des WebP exacts locaux, puis garder HOLD pour revue Mouss.",
      blockers: [
        "image exacte non prouvee",
        "fournisseur exact non prouve",
        "SKU ou variante non prouvee",
        "stock et delai France/Europe non prouves",
        "droits image non prouves",
        "validation Mouss manquante",
      ],
      proofTasks: proofTemplates.map((template, proofIndex) => ({
        taskId: `${row.id}#proof-${proofIndex + 1}`,
        order: proofIndex + 1,
        key: template.key,
        zone: template.zone,
        label: template.label,
        expectedFormat: template.expectedFormat,
        rejectIf: template.rejectIf,
        status: "TO_FILL_HOLD",
      })),
      imageTasks: imageRoles.map((item, imageIndex) => ({
        taskId: `${row.id}#image-${imageIndex + 1}`,
        order: imageIndex + 1,
        role: item.role,
        label: item.label,
        expectedFileName: expectedImageFiles[imageIndex],
        depositDirRelative: imageDepositDirRelative,
        status: "TO_DEPOSIT_HOLD",
      })),
      expectedImageFiles,
      imageDepositDirRelative,
    };
  });
}

function flattenProofTasks(products) {
  return products.flatMap((product) =>
    product.proofTasks.map((task) => ({
      productRank: product.nextWaveRank,
      productId: product.productId,
      productName: product.productName,
      categoryId: product.categoryId,
      priorityScore: product.priorityScore,
      targetSalePrice: product.targetSalePrice,
      targetMargin: product.targetMargin,
      adminProofHref: product.adminProofHref,
      imageDepositDirRelative: product.imageDepositDirRelative,
      ...task,
    })),
  );
}

function flattenImageTasks(products) {
  return products.flatMap((product) =>
    product.imageTasks.map((task) => ({
      productRank: product.nextWaveRank,
      productId: product.productId,
      productName: product.productName,
      categoryId: product.categoryId,
      priorityScore: product.priorityScore,
      targetSalePrice: product.targetSalePrice,
      targetMargin: product.targetMargin,
      adminProofHref: product.adminProofHref,
      ...task,
    })),
  );
}

function markdown(summary) {
  const rows = summary.products.map(
    (product) =>
      `| ${product.nextWaveRank} | ${mdCell(product.productName)} | ${mdCell(
        product.categoryId,
      )} | ${product.priorityScore} | ${mdCell(product.targetSalePrice)} | ${mdCell(
        product.targetMargin,
      )} | ${product.proofTasks.length} | ${product.imageTasks.length} | ${mdCell(product.status)} |`,
  );

  return `${[
    "# Maxi Trouvailles - Prochaine vague sourcing integration",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Produits prepares: ${summary.productCount}`,
    `- Preuves internes a remplir: ${summary.proofTaskCount}`,
    `- Images WebP exactes attendues: ${summary.imageTaskCount}`,
    `- Actions totales: ${summary.totalTaskCount}`,
    `- Produits top 3 exclus: ${summary.top3ExcludedCount}`,
    "",
    "## Produits",
    "",
    "| Rang | Produit | Categorie | Score | Prix cible | Marge cible | Preuves | Images | Statut |",
    "|---:|---|---|---:|---|---|---:|---:|---|",
    ...rows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule cote catalogue.",
    "- Aucun telechargement image.",
    "- Aucune copie publique.",
    "- Aucun paiement, achat, publication ou commande fournisseur.",
    "- Les valeurs fournisseur restent en preuves internes et ne sont pas exposees client.",
    "- Validation humaine Mouss obligatoire avant tout deblocage.",
    "",
  ].join("\n")}\n`;
}

function productsCsv(summary) {
  const headers = [
    "next_wave_rank",
    "product_id",
    "slug",
    "product_name",
    "category_id",
    "status",
    "priority_score",
    "target_sale_price",
    "target_margin",
    "proof_task_count",
    "image_task_count",
    "image_deposit_dir",
    "admin_href",
    "next_action",
  ];

  const rows = summary.products.map((product) =>
    [
      product.nextWaveRank,
      product.productId,
      product.slug,
      product.productName,
      product.categoryId,
      product.status,
      product.priorityScore,
      product.targetSalePrice,
      product.targetMargin,
      product.proofTasks.length,
      product.imageTasks.length,
      product.imageDepositDirRelative,
      product.adminProofHref,
      product.nextAction,
    ]
      .map(csvEscape)
      .join(";"),
  );

  return `${headers.join(";")}\n${rows.join("\n")}\n`;
}

function proofCsv(tasks) {
  const headers = [
    "product_rank",
    "product_id",
    "product_name",
    "category_id",
    "proof_order",
    "proof_key",
    "zone",
    "label",
    "status",
    "expected_format",
    "reject_if",
    "admin_href",
  ];

  const rows = tasks.map((task) =>
    [
      task.productRank,
      task.productId,
      task.productName,
      task.categoryId,
      task.order,
      task.key,
      task.zone,
      task.label,
      task.status,
      task.expectedFormat,
      task.rejectIf,
      task.adminProofHref,
    ]
      .map(csvEscape)
      .join(";"),
  );

  return `${headers.join(";")}\n${rows.join("\n")}\n`;
}

function imageCsv(tasks) {
  const headers = [
    "product_rank",
    "product_id",
    "product_name",
    "category_id",
    "image_order",
    "role",
    "label",
    "expected_file_name",
    "deposit_dir",
    "status",
    "admin_href",
  ];

  const rows = tasks.map((task) =>
    [
      task.productRank,
      task.productId,
      task.productName,
      task.categoryId,
      task.order,
      task.role,
      task.label,
      task.expectedFileName,
      task.depositDirRelative,
      task.status,
      task.adminProofHref,
    ]
      .map(csvEscape)
      .join(";"),
  );

  return `${headers.join(";")}\n${rows.join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const integrationAuditPath = latestFile(auditIntegrationRoot, /AUDIT_INTEGRATION_ARTICLES_\d{8}\.json$/, "integration audit");
const top3Path = latestFile(top3Root, /TOP3_SOURCING_INTEGRATION_\d{8}\.json$/, "top 3 sourcing sprint");
const integrationAudit = readJson(integrationAuditPath);
const top3 = readJson(top3Path);
const excludedIds = top3ProductIds(top3);
const rows = selectRows(integrationAudit, excludedIds, 12);
const products = buildProducts(rows, dateKey);
const proofTasks = flattenProofTasks(products);
const imageTasks = flattenImageTasks(products);
const safeDraft = {
  products,
  proofTasks,
  imageTasks,
};
const structuralFailures = [];

if (integrationAudit.ok !== true || integrationAudit.failureCount !== 0) {
  structuralFailures.push({
    code: "source_integration_audit_not_ok",
    message: "L'audit integration articles source n'est pas exploitable.",
  });
}

if (products.length !== 12) {
  structuralFailures.push({
    code: "next_wave_product_count_invalid",
    message: "La prochaine vague doit contenir 12 produits.",
    value: products.length,
  });
}

if (!isSafeOutput(safeDraft)) {
  structuralFailures.push({
    code: "unsafe_output_detected",
    message: "Le plan contient une valeur externe, marketplace ou sensible.",
  });
}

const summary = {
  ok: structuralFailures.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_integration_next_wave_sourcing_plan",
  status:
    structuralFailures.length === 0
      ? "HOLD_NEXT_WAVE_SOURCING_READY"
      : "BLOCKED_NEXT_WAVE_SOURCING_REVIEW_REQUIRED",
  productCount: products.length,
  proofTaskCount: proofTasks.length,
  imageTaskCount: imageTasks.length,
  totalTaskCount: proofTasks.length + imageTasks.length,
  top3ExcludedCount: excludedIds.size,
  sourceIntegrationCandidateCount: integrationAudit.integrationCandidateCount ?? 0,
  sourceReadyForManualSourcingCount: integrationAudit.readyForManualSourcingCount ?? 0,
  sourceIntegrationFailureCount: integrationAudit.failureCount ?? 0,
  structuralFailureCount: structuralFailures.length,
  structuralFailures,
  products,
  proofTasks,
  imageTasks,
  sources: {
    integrationAuditPath: rel(integrationAuditPath),
    top3Path: rel(top3Path),
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
    top3Excluded: true,
    manualValidationRequired: true,
  },
};

const jsonPath = path.join(outputDir, `NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `maxi-prochaine-vague-sourcing-integration-${dateKey}.md`);
const productsCsvPath = path.join(outputDir, `maxi-prochaine-vague-sourcing-integration-produits-${dateKey}.csv`);
const proofsCsvPath = path.join(outputDir, `maxi-prochaine-vague-sourcing-integration-preuves-${dateKey}.csv`);
const imagesCsvPath = path.join(outputDir, `maxi-prochaine-vague-sourcing-integration-images-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(productsCsvPath, productsCsv(summary), "utf8");
fs.writeFileSync(proofsCsvPath, proofCsv(proofTasks), "utf8");
fs.writeFileSync(imagesCsvPath, imageCsv(imageTasks), "utf8");

console.log(
  JSON.stringify(
    {
      status: summary.status,
      ok: summary.ok,
      productCount: summary.productCount,
      proofTaskCount: summary.proofTaskCount,
      imageTaskCount: summary.imageTaskCount,
      totalTaskCount: summary.totalTaskCount,
      outputDir: rel(outputDir),
    },
    null,
    2,
  ),
);

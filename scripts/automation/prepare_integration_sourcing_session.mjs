import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packetRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "sourcing-integration-articles",
);
const intakeAuditRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "audit-sourcing-integration-articles",
);
const executionBoardRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "execution-integration-articles",
);
const outputRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "session-sourcing-integration-articles",
);

const forbiddenSupplierPattern = /\b(aliexpress|ali\s*express|temu|wish|shein)\b/i;
const sensitivePattern = /\b(api[_-]?key|bearer\s+[a-z0-9._-]+|password|secret|sk-[a-z0-9])/i;

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function walkFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
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

function findLatestFile(dir, pattern) {
  const files = walkFiles(dir, (filePath) => pattern.test(filePath));

  if (files.length === 0) {
    return null;
  }

  return files
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0].filePath;
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
  if (/[",\n\r;]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function euroToCents(value) {
  const match = String(value ?? "").match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!match) return null;

  const amount = Number(match[1].replace(",", "."));
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function centsToEuro(cents) {
  if (!Number.isFinite(cents)) return "";

  return `${(cents / 100).toFixed(2)} EUR`;
}

function maxSupplierCost(packet) {
  const sale = euroToCents(packet.targetSalePrice);
  const margin = euroToCents(packet.targetMargin);

  if (!sale || !margin) return null;

  return Math.max(0, sale - margin);
}

function adminAnchorId(value) {
  return (
    String(value ?? "")
      .trim()
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "produit"
  );
}

function adminProofHref(packet, zone = "") {
  const params = new URLSearchParams({
    status: "hold",
    q: packet.id || packet.slug || packet.name,
  });

  if (zone) {
    params.set("zone", zone);
  }

  return `/admin/preuves-partenaires?${params.toString()}#top-verification-${adminAnchorId(
    packet.id || packet.slug || packet.name,
  )}`;
}

const proofFieldTemplates = [
  {
    zone: "Fournisseur / SKU",
    key: "exactProductUrl",
    label: "URL produit exacte",
    expectedFormat: "URL https de la fiche article exacte",
    rejectIf: "URL de recherche, marketplace interdite, produit similaire ou variante floue",
  },
  {
    zone: "Fournisseur / SKU",
    key: "partnerName",
    label: "Nom vendeur ou partenaire",
    expectedFormat: "Nom stable du vendeur, boutique ou partenaire",
    rejectIf: "Vendeur inconnu, nom generique ou preuve absente",
  },
  {
    zone: "Fournisseur / SKU",
    key: "supplierSku",
    label: "SKU/reference fournisseur",
    expectedFormat: "SKU, item id ou reference fournisseur stable",
    rejectIf: "Reference absente ou non reutilisable pour une commande manuelle",
  },
  {
    zone: "Fournisseur / SKU",
    key: "exactVariant",
    label: "Variante exacte vendue",
    expectedFormat: "Couleur, taille, dimensions, lot et accessoires inclus",
    rejectIf: "Variante non identique aux images ou a la description Maxi",
  },
  {
    zone: "Prix / stock / marge",
    key: "supplierPriceCents",
    label: "Prix fournisseur reel en centimes",
    expectedFormat: "Nombre entier en centimes, hors invention",
    rejectIf: "Prix absent, prix estime ou marge cible non tenable",
  },
  {
    zone: "Prix / stock / marge",
    key: "supplierStock",
    label: "Stock fournisseur visible",
    expectedFormat: "Nombre entier ou stock visible documente",
    rejectIf: "Stock flou, rupture, precommande ou volume non fiable",
  },
  {
    zone: "Livraison / suivi",
    key: "deliveryToFrance",
    label: "Delai France/Europe",
    expectedFormat: "Delai clair vers France/Europe avec transporteur si possible",
    rejectIf: "Delai absent, trop vague ou incompatible avec une boutique fiable",
  },
  {
    zone: "Livraison / suivi",
    key: "trackingAvailable",
    label: "Suivi colis disponible",
    expectedFormat: "true/oui si suivi confirme",
    rejectIf: "Aucun suivi fiable",
  },
  {
    zone: "Livraison / suivi",
    key: "deliveryEvidence",
    label: "Preuve livraison",
    expectedFormat: "Capture, texte fournisseur ou page indiquant le delai",
    rejectIf: "Preuve absente ou non reliee au meme article",
  },
  {
    zone: "Images / droits",
    key: "imageRightsEvidence",
    label: "Droits images ou permission d usage",
    expectedFormat: "Permission, licence, photos propres ou droit d usage documente",
    rejectIf: "Photo non autorisee, image approximative ou autre produit",
  },
  {
    zone: "Validation Mouss",
    key: "moussValidation",
    label: "Validation humaine Mouss",
    expectedFormat: "true/oui seulement apres revue humaine",
    rejectIf: "Validation absente",
  },
];

const categoryFocus = {
  "dropshipping-accessoires": [
    "Confirmer quantite exacte du lot.",
    "Verifier dimensions et compatibilite usage quotidien.",
  ],
  "dropshipping-animaux": [
    "Verifier taille, matiere et absence de risque animal.",
    "Refuser si la fiche ne distingue pas clairement chat/chien ou dimensions.",
  ],
  "dropshipping-auto-moto": [
    "Verifier compatibilite vehicule et mode de fixation.",
    "Refuser si le produit touche a la securite sans preuve claire.",
  ],
  "dropshipping-cuisine": [
    "Verifier dimensions et matiere.",
    "Refuser si contact alimentaire ambigu ou non documente.",
  ],
  "dropshipping-enfant": [
    "Verifier securite enfant et conformite.",
    "Refuser si le risque usage enfant n'est pas documente.",
  ],
  "dropshipping-high-tech": [
    "Verifier batterie, cable, voltage, normes et garantie.",
    "Refuser si un composant electrique reste flou.",
  ],
  "dropshipping-maison": [
    "Verifier dimensions, fixation et accessoires inclus.",
    "Confirmer que les photos avant/apres ne trompent pas sur le resultat.",
  ],
  "dropshipping-mode": [
    "Verifier taille, tissu, couleur et fermeture.",
    "Refuser si la photo ne montre pas la variante exacte.",
  ],
};

function intakeRowForPacket(intakeAudit, packet) {
  return (intakeAudit?.rows ?? []).find((row) => row.id === packet.id) ?? null;
}

function executionRowForPacket(executionBoard, packet) {
  return (executionBoard?.rows ?? []).find((row) => row.id === packet.id) ?? null;
}

function buildProductSession(packet, intakeRow, executionRow) {
  const supplierMaxCostCents = maxSupplierCost(packet);
  const fields = proofFieldTemplates.map((field, index) => ({
    order: index + 1,
    ...field,
    required: true,
    currentValue: packet.requiredEvidence?.[field.key] ?? "",
    adminHref: adminProofHref(packet, field.zone),
    status: "TO_FILL_HOLD",
  }));
  const imageTasks = (packet.expectedImageFiles ?? []).map((fileName, index) => ({
    order: index + 1,
    fileName,
    role: index === 0 ? "main" : index === 1 ? "detail" : "variant",
    depositPath: path.join(packet.imageDepositDir, fileName),
    expected: "WebP exact du produit et de la variante vendue",
    status: "MISSING_HOLD",
  }));

  return {
    priority: packet.priority,
    id: packet.id,
    slug: packet.slug,
    name: packet.name,
    categoryId: packet.categoryId,
    priorityScore: executionRow?.priorityScore ?? packet.priorityScore,
    lane: executionRow?.lane ?? "lane_1_packet_a_remplir",
    packetStatus: packet.currentStatus,
    intakeStatus: intakeRow?.status ?? "HOLD_IMAGES_OR_EVIDENCE_MISSING",
    evidenceProgress: intakeRow
      ? `${intakeRow.evidenceFilledCount}/${intakeRow.requiredEvidenceCount}`
      : "0/10",
    imageProgress: intakeRow
      ? `${intakeRow.imageChecks?.filter((check) => check.validWebP).length ?? 0}/${intakeRow.imageChecks?.length ?? imageTasks.length}`
      : `0/${imageTasks.length}`,
    targetSalePrice: packet.targetSalePrice,
    targetMargin: packet.targetMargin,
    supplierMaxCost: centsToEuro(supplierMaxCostCents),
    imageDepositDir: packet.imageDepositDir,
    searchHints: packet.searchHints ?? [],
    fields,
    imageTasks,
    categoryFocus: categoryFocus[packet.categoryId] ?? [],
    rejectionRules: packet.rejectionRules ?? [],
    sessionChecklist: [
      "Verifier que la fiche fournisseur correspond au meme article exact.",
      "Remplir les champs fournisseur/SKU/variante avant prix et stock.",
      "Comparer le prix fournisseur au cout max cible avant de continuer.",
      "Verifier delai France/Europe et suivi colis.",
      "Documenter les droits images avant tout depot WebP.",
      "Deposer uniquement des WebP exacts dans le dossier prevu.",
      "Relancer audit intake avant de demander revue humaine.",
    ],
    adminLinks: {
      proof: adminProofHref(packet),
      imageZone: adminProofHref(packet, "Images / droits"),
      supplierZone: adminProofHref(packet, "Fournisseur / SKU"),
      marginZone: adminProofHref(packet, "Prix / stock / marge"),
      deliveryZone: adminProofHref(packet, "Livraison / suivi"),
      validationZone: adminProofHref(packet, "Validation Mouss"),
    },
    nextCommand: "npm run catalog:audit-integration-sourcing-packets",
    safety: {
      noCatalogWrite: true,
      noPublication: true,
      noPayment: true,
      noSupplierOrder: true,
      noExternalContact: true,
      noImageDownload: true,
      manualValidationRequired: true,
    },
  };
}

function productMarkdown(product) {
  const lines = [
    `# Session sourcing terrain - ${product.name}`,
    "",
    `Priorite: ${product.priority}`,
    `Categorie: ${product.categoryId}`,
    `Lane: ${product.lane}`,
    `Statut intake: ${product.intakeStatus}`,
    `Prix cible: ${product.targetSalePrice}`,
    `Marge cible: ${product.targetMargin}`,
    `Cout fournisseur max cible: ${product.supplierMaxCost || "a calculer"}`,
    "",
    "## Ordre de travail",
    "",
    ...product.sessionChecklist.map((item) => `- [ ] ${item}`),
    "",
    "## Recherches manuelles",
    "",
    ...product.searchHints.map((hint) => `- ${hint}`),
    "",
    "## Champs de preuve",
    "",
    "| Zone | Champ | Format attendu | Rejet si |",
    "|---|---|---|---|",
    ...product.fields.map(
      (field) =>
        `| ${field.zone} | ${field.label} | ${field.expectedFormat} | ${field.rejectIf} |`,
    ),
    "",
    "## Images WebP exactes",
    "",
    `Dossier: ${product.imageDepositDir}`,
    "",
    ...product.imageTasks.map(
      (task) => `- [ ] ${task.fileName} (${task.role}) - ${task.expected}`,
    ),
    "",
    "## Focus categorie",
    "",
    ...product.categoryFocus.map((item) => `- ${item}`),
    "",
    "## Rejets",
    "",
    ...product.rejectionRules.map((rule) => `- ${rule}`),
    "",
    "## Garde-fous",
    "",
    "- Ne pas publier.",
    "- Ne pas payer.",
    "- Ne pas commander.",
    "- Ne pas contacter un fournisseur automatiquement.",
    "- Ne pas telecharger ou copier une image fournisseur sans droits.",
    "- Garder HOLD jusqu'a validation humaine Mouss.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

function markdownReport(payload) {
  const lines = [
    "# Session sourcing integration articles",
    "",
    `Date: ${payload.generatedAt}`,
    `Statut: ${payload.status}`,
    "",
    "## Synthese",
    "",
    `- Packets source: ${payload.packetCount}`,
    `- Produits session: ${payload.productCount}`,
    `- Champs preuve a remplir: ${payload.evidenceFieldCount}`,
    `- Images WebP attendues: ${payload.expectedImageCount}`,
    `- Source packets: ${payload.sources.packetsPath}`,
    `- Audit intake: ${payload.sources.intakeAuditPath ?? "absent"}`,
    `- Board execution: ${payload.sources.executionBoardPath ?? "absent"}`,
    "",
    "## Produits",
    "",
    "| # | Produit | Lane | Preuves | Images | Cout max cible | Action |",
    "|---|---|---|---:|---:|---:|---|",
    ...payload.products.map(
      (product) =>
        `| ${product.priority} | ${product.name} | ${product.lane} | ${product.evidenceProgress} | ${product.imageProgress} | ${product.supplierMaxCost || "n/a"} | Remplir session terrain puis relancer audit intake |`,
    ),
    "",
    "## Garde-fous",
    "",
    "- Lecture seule cote catalogue.",
    "- Aucun fournisseur contacte.",
    "- Aucun achat, paiement, commande ou publication.",
    "- Aucun lien fournisseur externe n'est ajoute a la surface client.",
    "- Images exactes et droits requis avant revue humaine.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

function evidenceFieldsCsv(products) {
  const headers = [
    "priority",
    "product_id",
    "product_name",
    "category_id",
    "proof_zone",
    "field_key",
    "field_label",
    "required",
    "expected_format",
    "current_value",
    "reject_if",
    "admin_href",
    "image_deposit_dir",
  ];
  const rows = products.flatMap((product) =>
    product.fields.map((field) => [
      product.priority,
      product.id,
      product.name,
      product.categoryId,
      field.zone,
      field.key,
      field.label,
      String(field.required),
      field.expectedFormat,
      field.currentValue,
      field.rejectIf,
      field.adminHref,
      product.imageDepositDir,
    ]),
  );

  return `${headers.join(";")}\n${rows.map((row) => row.map(csvEscape).join(";")).join("\n")}\n`;
}

function imageTasksCsv(products) {
  const headers = [
    "priority",
    "product_id",
    "product_name",
    "category_id",
    "file_name",
    "role",
    "deposit_path",
    "expected",
    "status",
  ];
  const rows = products.flatMap((product) =>
    product.imageTasks.map((task) => [
      product.priority,
      product.id,
      product.name,
      product.categoryId,
      task.fileName,
      task.role,
      task.depositPath,
      task.expected,
      task.status,
    ]),
  );

  return `${headers.join(";")}\n${rows.map((row) => row.map(csvEscape).join(";")).join("\n")}\n`;
}

function assertNoLeaks(payload) {
  const serialized = JSON.stringify(payload);
  if (forbiddenSupplierPattern.test(serialized)) {
    throw new Error("Forbidden supplier marketplace name detected in sourcing session payload.");
  }

  if (sensitivePattern.test(serialized)) {
    throw new Error("Sensitive token-like string detected in sourcing session payload.");
  }
}

const dateKey = localDateKey();
const generatedAt = new Date().toISOString();
const packetsPath = findLatestFile(
  packetRoot,
  /PACKETS_SOURCING_INTEGRATION_\d+\.json$/,
);

if (!packetsPath) {
  throw new Error(`No integration sourcing packets found in ${packetRoot}`);
}

const intakeAuditPath = findLatestFile(
  intakeAuditRoot,
  /AUDIT_SOURCING_INTEGRATION_\d+\.json$/,
);
const executionBoardPath = findLatestFile(
  executionBoardRoot,
  /EXECUTION_INTEGRATION_ARTICLES_\d+\.json$/,
);
const packetPayload = readJson(packetsPath);
const intakeAudit = intakeAuditPath ? readJson(intakeAuditPath) : null;
const executionBoard = executionBoardPath ? readJson(executionBoardPath) : null;
const packets = packetPayload.packets ?? [];
const products = packets.map((packet) =>
  buildProductSession(
    packet,
    intakeRowForPacket(intakeAudit, packet),
    executionRowForPacket(executionBoard, packet),
  ),
);
const outputDir = path.join(outputRoot, dateKey);
const productDir = path.join(outputDir, "produits");

fs.mkdirSync(productDir, { recursive: true });

const payload = {
  generatedAt,
  mode: "read_only_integration_sourcing_terrain_session",
  status: "HOLD_SOURCING_SESSION",
  packetCount: packets.length,
  productCount: products.length,
  evidenceFieldCount: products.reduce((sum, product) => sum + product.fields.length, 0),
  expectedImageCount: products.reduce((sum, product) => sum + product.imageTasks.length, 0),
  sources: {
    packetsPath,
    intakeAuditPath,
    executionBoardPath,
  },
  products,
  safety: {
    readOnly: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noExternalContact: true,
    noImageDownload: true,
    manualValidationRequired: true,
  },
};

assertNoLeaks(payload);

for (const product of products) {
  fs.writeFileSync(
    path.join(productDir, `${product.slug}.md`),
    productMarkdown(product),
    "utf8",
  );
  fs.writeFileSync(
    path.join(productDir, `${product.slug}.json`),
    `${JSON.stringify(product, null, 2)}\n`,
    "utf8",
  );
}

const jsonPath = path.join(outputDir, `SESSION_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `SESSION_SOURCING_INTEGRATION_${dateKey}.md`);
const evidenceCsvPath = path.join(
  outputDir,
  `SESSION_SOURCING_INTEGRATION_CHAMPS_PREUVES_${dateKey}.csv`,
);
const imagesCsvPath = path.join(
  outputDir,
  `SESSION_SOURCING_INTEGRATION_IMAGES_${dateKey}.csv`,
);

fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(payload), "utf8");
fs.writeFileSync(evidenceCsvPath, evidenceFieldsCsv(products), "utf8");
fs.writeFileSync(imagesCsvPath, imageTasksCsv(products), "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: payload.mode,
      status: payload.status,
      packetCount: payload.packetCount,
      productCount: payload.productCount,
      evidenceFieldCount: payload.evidenceFieldCount,
      expectedImageCount: payload.expectedImageCount,
      files: {
        jsonPath,
        mdPath,
        evidenceCsvPath,
        imagesCsvPath,
        productDir,
      },
      safety: payload.safety,
    },
    null,
    2,
  ),
);

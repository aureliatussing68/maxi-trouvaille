import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const quickProductsPath = path.join(root, "data", "quick-products.json");
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const outputRoot = path.join(actionRoot, "execution-integration-articles");

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
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

function latestFile(folder, regex) {
  const files = walkFiles(folder, (filePath) => regex.test(filePath));

  if (files.length === 0) return null;

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

function categoryLabel(categoryId) {
  return String(categoryId ?? "")
    .replace(/^dropshipping-/, "")
    .replace(/-/g, " ");
}

function priceLabel(cents) {
  return `${((Number(cents) || 0) / 100).toFixed(2)} EUR`;
}

function parseTargetMargin(product) {
  const pricingRule = product.internalSourcing?.pricingRule ?? "";
  const match = pricingRule.match(/marge cible ([0-9]+(?:\.[0-9]+)?) EUR \(([0-9]+)%\)/i);

  if (!match) return "a confirmer";
  return `${match[1]} EUR (${match[2]}%)`;
}

function normalizeProofZone(value) {
  const text = String(value ?? "").toLowerCase();

  if (text.includes("image") || text.includes("webp") || text.includes("rights")) return "Images / droits";
  if (text.includes("delivery") || text.includes("tracking")) return "Livraison / suivi";
  if (text.includes("price") || text.includes("stock") || text.includes("margin")) return "Prix / stock / marge";
  if (text.includes("url") || text.includes("partner") || text.includes("sku") || text.includes("variant")) {
    return "Fournisseur / SKU";
  }
  if (text.includes("mouss")) return "Validation Mouss";
  return "Preuves generales";
}

function rowScore(product, auditRow, packetRow, intakeRow) {
  const baseScore = Number(auditRow?.priorityScore ?? packetRow?.priorityScore ?? 50);
  const categoryBonus = {
    "dropshipping-maison": 7,
    "dropshipping-cuisine": 6,
    "dropshipping-accessoires": 5,
    "dropshipping-beaute": 5,
    "dropshipping-animaux": 4,
    "dropshipping-auto-moto": 3,
    "dropshipping-high-tech": 2,
    "dropshipping-mode": 2,
    "dropshipping-enfant": -4,
  }[product.categoryId] ?? 0;
  const packetBonus = packetRow ? 15 : 0;
  const intakePenalty = intakeRow?.status === "READY_FOR_HUMAN_REVIEW_HOLD" ? -20 : 0;

  return Math.max(0, baseScore + categoryBonus + packetBonus + intakePenalty);
}

function laneFor(product, packetRow, intakeRow) {
  if (intakeRow?.status === "READY_FOR_HUMAN_REVIEW_HOLD") return "lane_0_revue_humaine_hold";
  if (packetRow) return "lane_1_packet_a_remplir";
  if (product.categoryId === "dropshipping-enfant") return "lane_4_controle_securite";
  return "lane_2_sourcing_prioritaire";
}

function nextActionFor(product, auditRow, packetRow, intakeRow) {
  if (intakeRow?.status === "READY_FOR_HUMAN_REVIEW_HOLD") {
    return "Relancer les gates image/publication puis demander revue humaine Mouss, sans publier.";
  }

  if (packetRow) {
    return "Remplir le CSV sourcing, chercher fournisseur France/Europe exact et deposer les WebP exacts attendus.";
  }

  if (auditRow?.nextAction) return auditRow.nextAction;

  return `Preparer packet sourcing pour ${categoryLabel(product.categoryId)} et garder la fiche en HOLD.`;
}

function countBy(items, selector) {
  return items.reduce((acc, item) => {
    const key = selector(item) || "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function buildRows({ products, integrationAudit, packetsPayload, intakePayload }) {
  const auditRows = new Map((integrationAudit?.sourcingBoard ?? []).map((row) => [row.id, row]));
  const packetRows = new Map((packetsPayload?.packets ?? []).map((row) => [row.id, row]));
  const intakeRows = new Map((intakePayload?.rows ?? []).map((row) => [row.id, row]));

  return products
    .map((product) => {
      const auditRow = auditRows.get(product.id);
      const packetRow = packetRows.get(product.id);
      const intakeRow = intakeRows.get(product.id);
      const blockers = intakeRow?.blockers ?? [
        "exact_product_url_missing",
        "supplier_sku_missing",
        "supplier_price_missing",
        "image_missing",
        "mouss_validation_missing",
      ];
      const proofZones = [...new Set(blockers.map(normalizeProofZone))];
      const lane = laneFor(product, packetRow, intakeRow);

      return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        categoryId: product.categoryId,
        categoryLabel: categoryLabel(product.categoryId),
        lane,
        priorityScore: rowScore(product, auditRow, packetRow, intakeRow),
        productStatus: product.status ?? "draft",
        holdStatus: product.internalSourcing?.validationStatus ?? "HOLD",
        targetSalePrice: priceLabel(product.price),
        targetMargin: parseTargetMargin(product),
        packetReady: Boolean(packetRow),
        intakeStatus: intakeRow?.status ?? "WAITING_PACKET",
        evidenceFilled: intakeRow ? `${intakeRow.evidenceFilledCount}/${intakeRow.requiredEvidenceCount}` : "0/10",
        validImages: intakeRow
          ? `${intakeRow.imageChecks.filter((check) => check.validWebP).length}/${intakeRow.imageChecks.length}`
          : "0/0",
        proofZones,
        nextAction: nextActionFor(product, auditRow, packetRow, intakeRow),
        imageDepositDir: packetRow?.imageDepositDir ?? "",
        sourceImage: product.image,
      };
    })
    .sort((a, b) => {
      if (a.lane !== b.lane) return a.lane.localeCompare(b.lane);
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      return a.name.localeCompare(b.name, "fr");
    });
}

function markdownReport(payload) {
  const lines = [
    "# Tableau execution integration articles",
    "",
    `Date: ${payload.generatedAt}`,
    "",
    "## Synthese",
    "",
    `- Fiches integration: ${payload.integrationCount}`,
    `- Packets actifs: ${payload.packetCount}`,
    `- En HOLD intake: ${payload.intakeHoldCount}`,
    `- Prets revue humaine HOLD: ${payload.readyReviewHoldCount}`,
    `- WebP valides: ${payload.validWebPCount}/${payload.expectedWebPCount}`,
    `- Statut global: ${payload.status}`,
    "",
    "## Lanes",
    "",
    ...Object.entries(payload.byLane).map(([lane, count]) => `- ${lane}: ${count}`),
    "",
    "## Categories",
    "",
    ...Object.entries(payload.byCategory).map(([category, count]) => `- ${category}: ${count}`),
    "",
    "## Top actions",
    "",
    "| # | Produit | Lane | Score | Prix | Marge cible | Preuves | Images | Action |",
    "|---|---|---|---:|---:|---:|---:|---:|---|",
    ...payload.rows.slice(0, 12).map(
      (row, index) =>
        `| ${index + 1} | ${row.name} | ${row.lane} | ${row.priorityScore} | ${row.targetSalePrice} | ${row.targetMargin} | ${row.evidenceFilled} | ${row.validImages} | ${row.nextAction} |`,
    ),
    "",
    "## Garde-fous",
    "",
    "- Lecture seule cote catalogue.",
    "- Aucun fournisseur contacte.",
    "- Aucun paiement, achat, commande ou publication.",
    "- Aucun lien fournisseur externe dans ce board.",
    "- Les fiches restent en `draft`/HOLD jusqu aux preuves completes et validation Mouss.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

function csvReport(rows) {
  const header = [
    "lane",
    "priorityScore",
    "id",
    "name",
    "categoryId",
    "productStatus",
    "holdStatus",
    "targetSalePrice",
    "targetMargin",
    "packetReady",
    "intakeStatus",
    "evidenceFilled",
    "validImages",
    "proofZones",
    "nextAction",
    "imageDepositDir",
  ];
  const body = rows.map((row) =>
    [
      row.lane,
      row.priorityScore,
      row.id,
      row.name,
      row.categoryId,
      row.productStatus,
      row.holdStatus,
      row.targetSalePrice,
      row.targetMargin,
      row.packetReady,
      row.intakeStatus,
      row.evidenceFilled,
      row.validImages,
      row.proofZones.join("|"),
      row.nextAction,
      row.imageDepositDir,
    ]
      .map(csvEscape)
      .join(";"),
  );

  return `${header.join(";")}\n${body.join("\n")}\n`;
}

const dateKey = localDateKey();
const generatedAt = new Date().toISOString();
const products = readJson(quickProductsPath, []).filter((product) =>
  String(product.id ?? "").startsWith("integration_articles_"),
);
const integrationAuditPath = latestFile(
  path.join(actionRoot, "audit-integration-articles"),
  /AUDIT_INTEGRATION_ARTICLES_\d+\.json$/,
);
const packetsPath = latestFile(
  path.join(actionRoot, "sourcing-integration-articles"),
  /PACKETS_SOURCING_INTEGRATION_\d+\.json$/,
);
const intakePath = latestFile(
  path.join(actionRoot, "audit-sourcing-integration-articles"),
  /AUDIT_SOURCING_INTEGRATION_\d+\.json$/,
);

const integrationAudit = readJson(integrationAuditPath, null);
const packetsPayload = readJson(packetsPath, null);
const intakePayload = readJson(intakePath, null);
const rows = buildRows({ products, integrationAudit, packetsPayload, intakePayload });

const readyReviewHoldCount = rows.filter((row) => row.intakeStatus === "READY_FOR_HUMAN_REVIEW_HOLD").length;
const intakeHoldCount = rows.filter((row) => row.intakeStatus.includes("HOLD")).length;
const packetCount = rows.filter((row) => row.packetReady).length;
const expectedWebPCount = intakePayload?.expectedImageFileCount ?? 0;
const validWebPCount = intakePayload?.validWebPCount ?? 0;

const payload = {
  generatedAt,
  mode: "read_only_integration_execution_board",
  sourceFiles: {
    quickProductsPath,
    integrationAuditPath,
    packetsPath,
    intakePath,
  },
  status: readyReviewHoldCount > 0 ? "READY_REVIEW_HOLD_EXISTS" : "HOLD_EXECUTION_BOARD",
  integrationCount: products.length,
  packetCount,
  intakeHoldCount,
  readyReviewHoldCount,
  expectedWebPCount,
  validWebPCount,
  byLane: countBy(rows, (row) => row.lane),
  byCategory: countBy(rows, (row) => row.categoryId),
  proofZoneCounts: countBy(rows.flatMap((row) => row.proofZones), (zone) => zone),
  rows,
  safety: {
    readOnly: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noExternalContact: true,
  },
};

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const jsonPath = path.join(outputDir, `EXECUTION_INTEGRATION_ARTICLES_${dateKey}.json`);
const mdPath = path.join(outputDir, `EXECUTION_INTEGRATION_ARTICLES_${dateKey}.md`);
const csvPath = path.join(outputDir, `EXECUTION_INTEGRATION_ARTICLES_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(payload), "utf8");
fs.writeFileSync(csvPath, csvReport(rows), "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: payload.mode,
      status: payload.status,
      integrationCount: payload.integrationCount,
      packetCount: payload.packetCount,
      intakeHoldCount: payload.intakeHoldCount,
      readyReviewHoldCount: payload.readyReviewHoldCount,
      expectedWebPCount: payload.expectedWebPCount,
      validWebPCount: payload.validWebPCount,
      files: { jsonPath, mdPath, csvPath },
      safety: payload.safety,
    },
    null,
    2,
  ),
);

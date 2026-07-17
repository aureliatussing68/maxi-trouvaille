import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packetRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "sourcing-integration-articles",
);
const outputRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "audit-sourcing-integration-articles",
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

function findLatestPacketsPath() {
  const files = walkFiles(packetRoot, (filePath) => /PACKETS_SOURCING_INTEGRATION_\d+\.json$/.test(filePath));

  if (files.length === 0) {
    throw new Error(`No integration sourcing packets found in ${packetRoot}`);
  }

  return files
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0].filePath;
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ";" && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function readCsvById(filePath) {
  if (!fs.existsSync(filePath)) return new Map();

  const lines = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return new Map();

  const headers = parseCsvLine(lines[0]);
  const rows = new Map();

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    if (row.id) {
      rows.set(row.id, row);
    }
  }

  return rows;
}

function hasValue(value) {
  return String(value ?? "").trim().length > 0;
}

function isTrue(value) {
  return ["true", "oui", "yes", "1", "validated", "valide"].includes(String(value ?? "").trim().toLowerCase());
}

function isHttpUrl(value) {
  return /^https?:\/\/[^\s]+$/i.test(String(value ?? "").trim());
}

function numberFrom(value) {
  const normalized = String(value ?? "").replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidWebP(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const buffer = fs.readFileSync(filePath);

  return (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
  if (/[",\n\r;]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function evidenceFromPacketAndCsv(packet, csvRow) {
  const packetEvidence = packet.requiredEvidence ?? {};

  return {
    exactProductUrl: csvRow?.exactProductUrl || packetEvidence.exactProductUrl || "",
    partnerName: csvRow?.partnerName || packetEvidence.partnerName || "",
    supplierSku: csvRow?.supplierSku || packetEvidence.supplierSku || "",
    exactVariant: csvRow?.exactVariant || packetEvidence.exactVariant || "",
    supplierPriceCents: csvRow?.supplierPriceCents || packetEvidence.supplierPriceCents || "",
    supplierStock: csvRow?.supplierStock || packetEvidence.supplierStock || "",
    deliveryToFrance: csvRow?.deliveryToFrance || packetEvidence.deliveryToFrance || "",
    trackingAvailable: csvRow?.trackingAvailable || packetEvidence.trackingAvailable || "",
    imageRightsEvidence: csvRow?.imageRightsEvidence || packetEvidence.imageRightsEvidence || "",
    moussValidation: csvRow?.moussValidation || packetEvidence.moussValidation || false,
  };
}

function evaluatePacket(packet, csvRow) {
  const evidence = evidenceFromPacketAndCsv(packet, csvRow);
  const blockers = [];
  const warnings = [];

  if (!isHttpUrl(evidence.exactProductUrl)) blockers.push("exact_product_url_missing");
  if (forbiddenSupplierPattern.test(evidence.exactProductUrl)) blockers.push("supplier_marketplace_not_allowed_for_integration_focus");
  if (!hasValue(evidence.partnerName)) blockers.push("partner_name_missing");
  if (!hasValue(evidence.supplierSku)) blockers.push("supplier_sku_missing");
  if (!hasValue(evidence.exactVariant)) blockers.push("exact_variant_missing");

  const supplierPrice = numberFrom(evidence.supplierPriceCents);
  const supplierStock = numberFrom(evidence.supplierStock);
  if (!supplierPrice || supplierPrice <= 0) blockers.push("supplier_price_missing");
  if (supplierStock === null || supplierStock <= 0) blockers.push("supplier_stock_missing");
  if (!hasValue(evidence.deliveryToFrance)) blockers.push("delivery_france_europe_missing");
  if (!isTrue(evidence.trackingAvailable)) blockers.push("tracking_not_confirmed");
  if (!hasValue(evidence.imageRightsEvidence)) blockers.push("image_rights_missing");
  if (!isTrue(evidence.moussValidation)) blockers.push("mouss_validation_missing");

  const evidenceText = Object.values(evidence).join(" ");
  if (sensitivePattern.test(evidenceText)) blockers.push("sensitive_string_detected");

  const imageChecks = (packet.expectedImageFiles ?? []).map((fileName) => {
    const filePath = path.join(packet.imageDepositDir, fileName);
    const exists = fs.existsSync(filePath);
    const validWebP = exists && isValidWebP(filePath);

    if (!exists) {
      blockers.push(`image_missing:${fileName}`);
    } else if (!validWebP) {
      blockers.push(`image_invalid_webp:${fileName}`);
    }

    return {
      fileName,
      filePath,
      exists,
      validWebP,
      sizeBytes: exists ? fs.statSync(filePath).size : 0,
    };
  });

  if (!fs.existsSync(packet.imageDepositDir)) {
    blockers.push("image_deposit_dir_missing");
  }

  if ((packet.expectedImageFiles ?? []).length === 0) {
    blockers.push("expected_image_files_missing");
  }

  if (!csvRow) {
    warnings.push("csv_row_not_filled_yet");
  }

  const status =
    blockers.length === 0
      ? "READY_FOR_HUMAN_REVIEW_HOLD"
      : imageChecks.some((check) => !check.exists || !check.validWebP)
        ? "HOLD_IMAGES_OR_EVIDENCE_MISSING"
        : "HOLD_EVIDENCE_MISSING";

  return {
    id: packet.id,
    slug: packet.slug,
    name: packet.name,
    categoryId: packet.categoryId,
    priority: packet.priority,
    priorityScore: packet.priorityScore,
    targetSalePrice: packet.targetSalePrice,
    targetMargin: packet.targetMargin,
    status,
    blockers: [...new Set(blockers)],
    warnings,
    evidenceFilledCount: Object.values(evidence).filter((value) => hasValue(value) || value === true).length,
    requiredEvidenceCount: Object.keys(evidence).length,
    imageChecks,
    nextAction:
      status === "READY_FOR_HUMAN_REVIEW_HOLD"
        ? "Relancer les gates image/publication puis demander revue humaine Mouss, sans publication automatique."
        : "Completer le CSV, verifier fournisseur France/Europe, puis deposer les WebP exacts attendus.",
  };
}

function countBlockers(rows) {
  const counts = {};

  for (const row of rows) {
    for (const blocker of row.blockers) {
      const key = blocker.split(":")[0];
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  return counts;
}

function markdownReport(payload) {
  const lines = [
    "# Audit intake packets sourcing integration",
    "",
    `Date: ${payload.generatedAt}`,
    "",
    "## Synthese",
    "",
    `- Packets audites: ${payload.packetCount}`,
    `- Prets revue humaine HOLD: ${payload.readyForHumanReviewHoldCount}`,
    `- En HOLD preuves/images manquantes: ${payload.holdCount}`,
    `- Fichiers WebP attendus: ${payload.expectedImageFileCount}`,
    `- Fichiers WebP valides: ${payload.validWebPCount}`,
    `- Statut global: ${payload.status}`,
    "",
    "## Tableau",
    "",
    "| # | Produit | Statut | Preuves | Images OK | Prochaine action |",
    "|---|---|---|---:|---:|---|",
    ...payload.rows.map((row) => {
      const validImages = row.imageChecks.filter((check) => check.validWebP).length;
      return `| ${row.priority} | ${row.name} | ${row.status} | ${row.evidenceFilledCount}/${row.requiredEvidenceCount} | ${validImages}/${row.imageChecks.length} | ${row.nextAction} |`;
    }),
    "",
    "## Garde-fous",
    "",
    "- Lecture seule cote catalogue.",
    "- Aucun fournisseur contacte automatiquement.",
    "- Aucun paiement, achat, commande ou publication.",
    "- Le statut `READY_FOR_HUMAN_REVIEW_HOLD` ne publie rien; il ouvre seulement une revue humaine.",
    "",
  ];

  if (Object.keys(payload.blockerCounts).length > 0) {
    lines.push("## Bloquants", "");
    for (const [blocker, count] of Object.entries(payload.blockerCounts)) {
      lines.push(`- ${blocker}: ${count}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function csvReport(payload) {
  const header = [
    "priority",
    "id",
    "name",
    "status",
    "evidenceFilled",
    "validImages",
    "blockers",
    "nextAction",
  ];
  const rows = payload.rows.map((row) =>
    [
      row.priority,
      row.id,
      row.name,
      row.status,
      `${row.evidenceFilledCount}/${row.requiredEvidenceCount}`,
      `${row.imageChecks.filter((check) => check.validWebP).length}/${row.imageChecks.length}`,
      row.blockers.join("|"),
      row.nextAction,
    ]
      .map(csvEscape)
      .join(";"),
  );

  return `${header.join(";")}\n${rows.join("\n")}\n`;
}

const generatedAt = new Date().toISOString();
const dateKey = localDateKey();
const packetsPath = findLatestPacketsPath();
const packetsPayload = readJson(packetsPath);
const csvPath = packetsPath.replace(/PACKETS_SOURCING_INTEGRATION_\d+\.json$/, `PACKETS_SOURCING_INTEGRATION_${dateKey}.csv`);
const csvRows = readCsvById(csvPath);
const rows = (packetsPayload.packets ?? []).map((packet) => evaluatePacket(packet, csvRows.get(packet.id)));

const expectedImageFileCount = rows.reduce((total, row) => total + row.imageChecks.length, 0);
const validWebPCount = rows.reduce(
  (total, row) => total + row.imageChecks.filter((check) => check.validWebP).length,
  0,
);
const readyForHumanReviewHoldCount = rows.filter((row) => row.status === "READY_FOR_HUMAN_REVIEW_HOLD").length;
const holdCount = rows.length - readyForHumanReviewHoldCount;
const structuralFailures = rows.filter((row) =>
  row.blockers.some((blocker) => ["expected_image_files_missing", "image_deposit_dir_missing"].includes(blocker)),
);

const payload = {
  generatedAt,
  mode: "read_only_integration_sourcing_packet_intake_audit",
  packetsPath,
  csvPath,
  packetCount: rows.length,
  readyForHumanReviewHoldCount,
  holdCount,
  expectedImageFileCount,
  validWebPCount,
  status: structuralFailures.length > 0 ? "STRUCTURE_TO_FIX" : "HOLD_MISSING_EVIDENCE",
  blockerCounts: countBlockers(rows),
  structuralFailures: structuralFailures.map((row) => ({ id: row.id, name: row.name, blockers: row.blockers })),
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

const jsonPath = path.join(outputDir, `AUDIT_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_SOURCING_INTEGRATION_${dateKey}.md`);
const outputCsvPath = path.join(outputDir, `AUDIT_SOURCING_INTEGRATION_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(payload), "utf8");
fs.writeFileSync(outputCsvPath, csvReport(payload), "utf8");

console.log(
  JSON.stringify(
    {
      ok: structuralFailures.length === 0,
      mode: payload.mode,
      packetCount: payload.packetCount,
      readyForHumanReviewHoldCount: payload.readyForHumanReviewHoldCount,
      holdCount: payload.holdCount,
      expectedImageFileCount: payload.expectedImageFileCount,
      validWebPCount: payload.validWebPCount,
      status: payload.status,
      files: { jsonPath, mdPath, csvPath: outputCsvPath },
      safety: payload.safety,
    },
    null,
    2,
  ),
);

if (structuralFailures.length > 0) {
  process.exitCode = 1;
}

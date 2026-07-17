import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const boardRoot = path.join(actionRoot, "pilotage-sourcing-integration-articles");
const boardAuditRoot = path.join(actionRoot, "audit-pilotage-sourcing-integration-articles");
const outputRoot = path.join(actionRoot, "top3-sourcing-integration-articles");

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

function latestFile(dir, pattern) {
  const files = walkFiles(dir, (filePath) => pattern.test(filePath));
  if (files.length === 0) {
    throw new Error(`No file matching ${pattern} found under ${dir}`);
  }

  return files
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0].filePath;
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

function proofLabel(proof) {
  return `${proof.zone} - ${proof.label}`;
}

function sprintAction(row) {
  if (row.nextProofs?.some((proof) => proof.key === "exactProductUrl")) {
    return "Verifier la fiche produit exacte et garder HOLD si un seul doute existe.";
  }

  if (row.missingZones?.includes("Images / droits")) {
    return "Traiter droits image et depot WebP exact avant toute autre validation.";
  }

  if (row.missingZones?.includes("Prix / stock / marge")) {
    return "Prouver prix fournisseur, stock et marge cible dans le formulaire terrain.";
  }

  return "Completer les preuves restantes puis relancer les audits HOLD.";
}

function validateNoLeaks(summary) {
  const serialized = JSON.stringify(summary);
  const findings = [];
  const checks = [
    ["external_url", /https?:\/\//i],
    ["marketplace_marker", /\b(aliexpress|ali\s*express|alicdn|ae-pic|temu|dhgate|1688)\b/i],
    ["sensitive_assignment", /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)\b\s*[:=]/i],
    ["key_like_value", /\b(sk|pk)_(live|test)_[A-Za-z0-9]{12,}\b|\bsk-[A-Za-z0-9]{12,}\b/i],
  ];

  for (const [type, regex] of checks) {
    if (regex.test(serialized)) {
      findings.push(type);
    }
  }

  return findings;
}

function buildSprintRows(board) {
  return [...(board.rows ?? [])]
    .sort((a, b) => a.rank - b.rank || b.priorityScore - a.priorityScore)
    .slice(0, 3)
    .map((row) => ({
      sprintRank: row.rank,
      productId: row.productId,
      slug: row.slug,
      name: row.name,
      categoryId: row.categoryId,
      priorityScore: row.priorityScore,
      targetSalePrice: row.targetSalePrice,
      targetMargin: row.targetMargin,
      supplierMaxCost: row.supplierMaxCost,
      missingFieldCount: row.missingFieldCount,
      missingZones: row.missingZones ?? [],
      firstProofs: (row.nextProofs ?? []).slice(0, 4).map((proof) => ({
        zone: proof.zone,
        key: proof.key,
        label: proof.label,
        adminHref: proof.adminHref,
        status: proof.status,
      })),
      expectedImageFiles: row.expectedImageFiles ?? [],
      imageProgress: row.imageProgress,
      imageDepositDirRelative: row.imageDepositDirRelative,
      adminProofHref: row.adminProofHref,
      sprintAction: sprintAction(row),
      keepHoldUntil: [
        "image exacte prouvee",
        "fournisseur exact prouve",
        "SKU ou variante prouvee",
        "prix fournisseur et marge verifies",
        "stock et delai France/Europe verifies",
        "droits image verifies",
        "validation humaine Mouss",
      ],
      safetyStatus: "HOLD_TOP3_SOURCING_NO_PUBLICATION",
    }));
}

function markdown(summary) {
  const rows = summary.rows.map(
    (row) =>
      `| ${row.sprintRank} | ${mdCell(row.name)} | ${mdCell(row.categoryId)} | ${row.priorityScore} | ${mdCell(
        row.supplierMaxCost,
      )} | ${row.missingFieldCount} | ${row.imageProgress} | ${mdCell(row.sprintAction)} |`,
  );
  const proofRows = summary.rows.flatMap((row) =>
    row.firstProofs.map(
      (proof) =>
        `| ${row.sprintRank} | ${mdCell(row.name)} | ${mdCell(proof.zone)} | ${mdCell(
          proof.label,
        )} | ${mdCell(proof.adminHref)} |`,
    ),
  );
  const imageRows = summary.rows.flatMap((row) =>
    row.expectedImageFiles.map(
      (fileName) => `| ${row.sprintRank} | ${mdCell(row.name)} | ${mdCell(fileName)} | ${mdCell(row.imageDepositDirRelative)} |`,
    ),
  );

  return `${[
    "# Maxi Trouvailles - Sprint top 3 sourcing integration",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Statut: ${summary.status}`,
    `- Produits sprint: ${summary.productCount}`,
    `- Champs de preuve sprint: ${summary.totalMissingFieldCount}`,
    `- Images WebP attendues sprint: ${summary.expectedImageCount}`,
    `- Audit board source: ${summary.sourceAuditStatus}`,
    "",
    "## Produits",
    "",
    "| # | Produit | Categorie | Score | Cout max fournisseur | Preuves | Images | Action sprint |",
    "|---:|---|---|---:|---:|---:|---:|---|",
    ...rows,
    "",
    "## Preuves a remplir",
    "",
    "| # | Produit | Zone | Champ | Lien admin |",
    "|---:|---|---|---|---|",
    ...proofRows,
    "",
    "## WebP exacts attendus",
    "",
    "| # | Produit | Fichier attendu | Dossier depot |",
    "|---:|---|---|---|",
    ...imageRows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule.",
    "- Aucune ecriture catalogue.",
    "- Aucune publication.",
    "- Aucun paiement.",
    "- Aucune commande fournisseur.",
    "- Aucun telechargement ou generation image.",
    "- Garder HOLD jusqu'a validation humaine Mouss.",
    "",
  ].join("\n")}\n`;
}

function csv(summary) {
  const headers = [
    "sprintRank",
    "productId",
    "name",
    "categoryId",
    "priorityScore",
    "targetSalePrice",
    "targetMargin",
    "supplierMaxCost",
    "missingFieldCount",
    "missingZones",
    "firstProofs",
    "expectedImageFiles",
    "imageDepositDirRelative",
    "adminProofHref",
    "sprintAction",
    "safetyStatus",
  ];

  const lines = summary.rows.map((row) =>
    headers
      .map((header) => {
        const value =
          header === "firstProofs"
            ? row.firstProofs.map(proofLabel)
            : Array.isArray(row[header])
              ? row[header].join(" | ")
              : row[header];
        return csvEscape(value);
      })
      .join(";"),
  );

  return `${headers.join(";")}\n${lines.join("\n")}${lines.length ? "\n" : ""}`;
}

const { dateKey, localLabel } = datePartsParis();
const boardPath = latestFile(boardRoot, /PILOTAGE_SOURCING_INTEGRATION_\d+\.json$/);
const boardAuditPath = latestFile(boardAuditRoot, /AUDIT_PILOTAGE_SOURCING_INTEGRATION_\d+\.json$/);
const board = readJson(boardPath);
const boardAudit = readJson(boardAuditPath);
const rows = buildSprintRows(board);

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_integration_top3_sourcing_sprint",
  status: "HOLD_TOP3_SOURCING_READY",
  sourceAuditStatus: boardAudit.status ?? "absent",
  productCount: rows.length,
  totalMissingFieldCount: rows.reduce((sum, row) => sum + row.missingFieldCount, 0),
  expectedImageCount: rows.reduce((sum, row) => sum + row.expectedImageFiles.length, 0),
  rows,
  sources: {
    boardPath: rel(boardPath),
    boardAuditPath: rel(boardAuditPath),
  },
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

if (boardAudit.ok !== true || boardAudit.failureCount !== 0 || boardAudit.sensitiveFindingCount !== 0) {
  summary.ok = false;
  summary.status = "FAIL_TOP3_SOURCE_AUDIT_NOT_GUARDED";
}

const leakFindings = validateNoLeaks(summary);
if (leakFindings.length > 0) {
  summary.ok = false;
  summary.status = "FAIL_TOP3_SOURCING_SENSITIVE_OUTPUT";
  summary.leakFindings = leakFindings;
}

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const jsonPath = path.join(outputDir, `TOP3_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `TOP3_SOURCING_INTEGRATION_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-top3-sourcing-integration-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      status: summary.status,
      productCount: summary.productCount,
      totalMissingFieldCount: summary.totalMissingFieldCount,
      expectedImageCount: summary.expectedImageCount,
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

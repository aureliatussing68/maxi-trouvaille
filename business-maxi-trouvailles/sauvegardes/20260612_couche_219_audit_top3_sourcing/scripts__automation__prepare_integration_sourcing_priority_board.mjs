import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const sessionRoot = path.join(actionRoot, "session-sourcing-integration-articles");
const sessionAuditRoot = path.join(actionRoot, "audit-session-sourcing-integration-articles");
const executionRoot = path.join(actionRoot, "execution-integration-articles");
const intakeAuditRoot = path.join(actionRoot, "audit-sourcing-integration-articles");
const outputRoot = path.join(actionRoot, "pilotage-sourcing-integration-articles");

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function countBy(items, selector) {
  return items.reduce((acc, item) => {
    const key = selector(item) || "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function toRelative(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function shortPath(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function missingFields(product) {
  return (product.fields ?? [])
    .filter((field) => field.required && String(field.status ?? "").toUpperCase().includes("HOLD"))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "fr"))
    .map((field) => ({
      zone: field.zone,
      key: field.key,
      label: field.label,
      expectedFormat: field.expectedFormat,
      rejectIf: field.rejectIf,
      adminHref: field.adminHref,
      status: field.status,
    }));
}

function immediateAction(product, missing) {
  if (missing.some((field) => field.key === "exactProductUrl")) {
    return "Trouver une fiche produit exacte France/Europe ou garder HOLD.";
  }

  if (missing.some((field) => field.zone === "Images / droits")) {
    return "Verifier droits image puis deposer les WebP exacts dans le dossier local.";
  }

  if (missing.some((field) => field.zone === "Prix / stock / marge")) {
    return "Controler prix fournisseur, stock visible et marge cible avant toute revue.";
  }

  if (missing.some((field) => field.zone === "Livraison / suivi")) {
    return "Prouver delai France/Europe et suivi colis.";
  }

  if (product.imageProgress !== "3/3") {
    return "Deposer les WebP exacts manquants puis relancer les audits.";
  }

  return "Garder HOLD et demander revue Mouss seulement apres preuves completes.";
}

function buildRows({ session, sessionAudit, execution, intake }) {
  const auditRows = new Map((sessionAudit.rows ?? []).map((row) => [row.id, row]));
  const executionRows = new Map((execution.rows ?? []).map((row) => [row.id, row]));
  const intakeRows = new Map((intake.rows ?? []).map((row) => [row.id, row]));

  return [...(session.products ?? [])]
    .sort((a, b) => a.priority - b.priority || b.priorityScore - a.priorityScore)
    .map((product, index) => {
      const auditRow = auditRows.get(product.id);
      const executionRow = executionRows.get(product.id);
      const intakeRow = intakeRows.get(product.id);
      const missing = missingFields(product);
      const imageTasks = product.imageTasks ?? [];
      const blockerCount = intakeRow?.blockers?.length ?? missing.length + imageTasks.length;

      return {
        rank: index + 1,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        categoryId: product.categoryId,
        lane: product.lane,
        priorityScore: product.priorityScore,
        targetSalePrice: product.targetSalePrice,
        targetMargin: product.targetMargin,
        supplierMaxCost: product.supplierMaxCost || "a calculer",
        packetStatus: product.packetStatus,
        intakeStatus: product.intakeStatus,
        sessionStatus: auditRow?.status ?? "HOLD_SESSION_READY_TO_FILL",
        evidenceProgress: product.evidenceProgress,
        imageProgress: product.imageProgress,
        missingFieldCount: missing.length,
        imageTaskCount: imageTasks.length,
        blockerCount,
        missingZones: [...new Set(missing.map((field) => field.zone))],
        nextProofs: missing.slice(0, 3),
        imageDepositDir: product.imageDepositDir,
        imageDepositDirRelative: shortPath(product.imageDepositDir),
        expectedImageFiles: imageTasks.map((task) => task.expectedFileName),
        adminProofHref: product.adminLinks?.proof ?? missing[0]?.adminHref ?? "",
        immediateAction: immediateAction(product, missing),
        executionNextAction: executionRow?.nextAction ?? product.nextCommand ?? "",
        safetyStatus: "HOLD_SOURCING_NO_PUBLICATION",
      };
    });
}

function buildProofLanes(rows) {
  const fields = rows.flatMap((row) =>
    row.nextProofs.map((field) => ({
      rank: row.rank,
      productId: row.productId,
      productName: row.name,
      categoryId: row.categoryId,
      supplierMaxCost: row.supplierMaxCost,
      zone: field.zone,
      fieldKey: field.key,
      fieldLabel: field.label,
      adminHref: field.adminHref,
      status: field.status,
    })),
  );

  return {
    byZone: countBy(fields, (field) => field.zone),
    firstProofs: fields.slice(0, 20),
  };
}

function validateNoLeaks(summary) {
  const serialized = JSON.stringify(summary);
  const findings = [];
  const patterns = [
    { type: "external_url", regex: /https?:\/\//i },
    { type: "marketplace_marker", regex: /\b(aliexpress|ali\s*express|alicdn|ae-pic|temu|dhgate|1688)\b/i },
    { type: "sensitive_value", regex: /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)\b\s*[:=]/i },
    { type: "stripe_like_key", regex: /\b(sk|pk)_(live|test)_[A-Za-z0-9]{12,}\b|\bsk-[A-Za-z0-9]{12,}\b/i },
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(serialized)) {
      findings.push(pattern.type);
    }
  }

  return findings;
}

function markdown(summary) {
  const rows = summary.rows.map(
    (row) =>
      `| ${row.rank} | ${mdCell(row.name)} | ${mdCell(row.categoryId)} | ${row.priorityScore} | ${mdCell(
        row.supplierMaxCost,
      )} | ${row.missingFieldCount} | ${row.imageProgress} | ${mdCell(row.missingZones.join(", "))} | ${mdCell(
        row.immediateAction,
      )} |`,
  );

  const proofRows = summary.proofLanes.firstProofs.map(
    (proof) =>
      `| ${proof.rank} | ${mdCell(proof.productName)} | ${mdCell(proof.zone)} | ${mdCell(
        proof.fieldLabel,
      )} | ${mdCell(proof.supplierMaxCost)} | ${mdCell(proof.adminHref)} |`,
  );

  return `${[
    "# Maxi Trouvailles - Pilotage sourcing integration",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Produits en session: ${summary.productCount}`,
    `- Champs de preuve a remplir: ${summary.totalMissingFieldCount}`,
    `- Images WebP exactes attendues: ${summary.expectedImageCount}`,
    `- Images WebP exactes valides: ${summary.validImageCount}`,
    `- Statut: ${summary.status}`,
    "",
    "## Categories",
    "",
    ...Object.entries(summary.byCategory).map(([category, count]) => `- ${category}: ${count}`),
    "",
    "## Zones prochaines preuves",
    "",
    ...Object.entries(summary.proofLanes.byZone).map(([zone, count]) => `- ${zone}: ${count}`),
    "",
    "## Produits",
    "",
    "| # | Produit | Categorie | Score | Cout max fournisseur | Preuves manquantes | Images | Zones | Action immediate |",
    "|---:|---|---|---:|---:|---:|---:|---|---|",
    ...rows,
    "",
    "## Premieres preuves a remplir",
    "",
    "| Produit # | Produit | Zone | Champ | Cout max fournisseur | Lien admin |",
    "|---:|---|---|---|---:|---|",
    ...proofRows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule cote catalogue.",
    "- Aucune publication.",
    "- Aucun paiement.",
    "- Aucune commande fournisseur.",
    "- Aucun telechargement ou generation image.",
    "- Garder toutes les fiches en HOLD tant que les preuves exactes et la validation Mouss manquent.",
    "",
  ].join("\n")}\n`;
}

function csv(summary) {
  const headers = [
    "rank",
    "productId",
    "name",
    "categoryId",
    "priorityScore",
    "targetSalePrice",
    "targetMargin",
    "supplierMaxCost",
    "evidenceProgress",
    "imageProgress",
    "missingFieldCount",
    "imageTaskCount",
    "missingZones",
    "imageDepositDirRelative",
    "adminProofHref",
    "immediateAction",
  ];
  const lines = summary.rows.map((row) =>
    headers
      .map((header) => {
        const value = Array.isArray(row[header]) ? row[header].join(" | ") : row[header];
        return csvEscape(value);
      })
      .join(";"),
  );

  return `${headers.join(";")}\n${lines.join("\n")}${lines.length ? "\n" : ""}`;
}

const { dateKey, localLabel } = datePartsParis();
const sessionPath = latestFile(sessionRoot, /SESSION_SOURCING_INTEGRATION_\d+\.json$/);
const sessionAuditPath = latestFile(sessionAuditRoot, /AUDIT_SESSION_SOURCING_INTEGRATION_\d+\.json$/);
const executionPath = latestFile(executionRoot, /EXECUTION_INTEGRATION_ARTICLES_\d+\.json$/);
const intakePath = latestFile(intakeAuditRoot, /AUDIT_SOURCING_INTEGRATION_\d+\.json$/);

const session = readJson(sessionPath);
const sessionAudit = readJson(sessionAuditPath);
const execution = readJson(executionPath);
const intake = readJson(intakePath);
const rows = buildRows({ session, sessionAudit, execution, intake });
const proofLanes = buildProofLanes(rows);
const expectedImageCount = rows.reduce((sum, row) => sum + row.imageTaskCount, 0);
const validImageCount = rows.reduce((sum, row) => {
  const [valid] = String(row.imageProgress).split("/").map((value) => Number(value) || 0);
  return sum + valid;
}, 0);

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_integration_sourcing_priority_board",
  status: "HOLD_PRIORITY_BOARD_READY",
  productCount: rows.length,
  totalMissingFieldCount: rows.reduce((sum, row) => sum + row.missingFieldCount, 0),
  expectedImageCount,
  validImageCount,
  byCategory: countBy(rows, (row) => row.categoryId),
  byLane: countBy(rows, (row) => row.lane),
  proofLanes,
  rows,
  sources: {
    sessionPath: toRelative(sessionPath),
    sessionAuditPath: toRelative(sessionAuditPath),
    executionPath: toRelative(executionPath),
    intakePath: toRelative(intakePath),
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

const leakFindings = validateNoLeaks(summary);
if (leakFindings.length > 0) {
  summary.ok = false;
  summary.status = "FAIL_PRIORITY_BOARD_SENSITIVE_OUTPUT";
  summary.leakFindings = leakFindings;
}

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const jsonPath = path.join(outputDir, `PILOTAGE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `PILOTAGE_SOURCING_INTEGRATION_${dateKey}.md`);
const csvPath = path.join(outputDir, `PILOTAGE_SOURCING_INTEGRATION_${dateKey}.csv`);

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
      validImageCount: summary.validImageCount,
      proofZoneCount: Object.keys(summary.proofLanes.byZone).length,
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

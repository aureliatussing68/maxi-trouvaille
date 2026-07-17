import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");

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

function latestDirectoryUnder(dirPath, prefix) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return null;
  }

  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.startsWith(prefix) &&
        !entry.name.startsWith("public-image-copy-gate-audit-"),
    )
    .map((entry) => path.join(dirPath, entry.name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] ?? null;
}

function latestFileUnder(dirPath, prefix) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return null;
  }

  return fs
    .readdirSync(dirPath)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((name) => path.join(dirPath, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] ?? null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  const headers = [
    "decision",
    "name",
    "slug",
    "sourceFile",
    "targetPublicPath",
    "targetLocalPath",
    "blockers",
    "nextAction",
  ];

  return `${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
    .join("\n")}\n`;
}

function markdown(summary) {
  const rows =
    summary.items.length === 0
      ? ["| HOLD | Aucun candidat pret | - | - | Aucune copie publique |"]
      : summary.items.map(
          (item) =>
            `| ${item.decision} | ${item.name} | ${item.sourceFile} | ${item.targetPublicPath} | ${item.nextAction} |`,
        );

  return `${[
    "# Gate copie publique images exactes",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Audit depot source: ${summary.sourceDepositAudit}`,
    "",
    "## Synthese",
    "",
    `- Statut technique: ${summary.ok ? "OK" : "ECHEC"}`,
    `- Mode: ${summary.mode}`,
    `- Candidats copie apres Mouss: ${summary.readyCopyCandidateCount}`,
    `- Bloques/HOLD: ${summary.blockedCount}`,
    `- Copie appliquee: ${summary.copyApplied ? "OUI" : "NON"}`,
    "",
    "| Decision | Produit | Source depot | Cible publique | Action |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    "## Garde-fous",
    "",
    "- Dry-run uniquement.",
    "- Validation humaine Mouss obligatoire.",
    "- Aucune copie dans `public/uploads`.",
    "- Aucune modification catalogue.",
    "- Aucune publication.",
    "- Aucun paiement.",
    "- Aucune commande partenaire.",
    "",
  ].join("\n")}\n`;
}

function targetLocalPathFromPublic(targetPublicPath) {
  return `public${targetPublicPath}`.replace(/\//g, path.sep);
}

const depositAuditDir = latestDirectoryUnder(actionRoot, "public-image-deposit-files-audit-");
const depositAuditPath = latestFileUnder(depositAuditDir, "AUDIT_DEPOT_WEBP_IMAGES_PUBLIQUES_");

if (!depositAuditPath) {
  throw new Error("Audit depot WebP introuvable.");
}

const depositAudit = readJson(depositAuditPath);
const sourceItems = Array.isArray(depositAudit.items) ? depositAudit.items : [];
const readyItems = sourceItems.filter((item) => item.readyForCopyAfterMouss === true);
const blockedItems = sourceItems.filter((item) => item.readyForCopyAfterMouss !== true);
const items = [
  ...readyItems.map((item) => ({
    decision: "PENDING_MOUSS_VALIDATION",
    name: item.name,
    slug: item.slug,
    sourceFile: item.expectedFilePath,
    targetPublicPath: `/uploads/partner-products/${item.expectedFileName}`,
    targetLocalPath: targetLocalPathFromPublic(`/uploads/partner-products/${item.expectedFileName}`),
    blockers: ["human_validation_mouss_required", "dry_run_only"],
    nextAction: "Faire valider par Mouss avant toute copie publique manuelle.",
  })),
  ...blockedItems.map((item) => ({
    decision: "HOLD",
    name: item.name,
    slug: item.slug,
    sourceFile: item.expectedFilePath,
    targetPublicPath: `/uploads/partner-products/${item.expectedFileName}`,
    targetLocalPath: targetLocalPathFromPublic(`/uploads/partner-products/${item.expectedFileName}`),
    blockers: item.blockers ?? ["hold"],
    nextAction: "Completer depot WebP exact, checklist et revue humaine avant copie.",
  })),
];
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `public-image-copy-gate-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "dry_run_public_image_copy_gate",
  sourceDepositAudit: rel(depositAuditPath),
  readyCopyCandidateCount: readyItems.length,
  blockedCount: blockedItems.length,
  copyApplied: false,
  humanValidationRequired: true,
  items,
  safety: {
    dryRunOnly: true,
    readOnlyInputs: true,
    noCatalogWrite: true,
    noImageDownload: true,
    noImageFileCreated: true,
    noPublicImageWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    requiresMoussValidation: true,
  },
};

const jsonPath = path.join(outputDir, `GATE_COPIE_IMAGES_PUBLIQUES_${dateKey}.json`);
const mdPath = path.join(outputDir, `GATE_COPIE_IMAGES_PUBLIQUES_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-gate-copie-images-publiques-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, toCsv(items), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      readyCopyCandidateCount: summary.readyCopyCandidateCount,
      blockedCount: summary.blockedCount,
      copyApplied: summary.copyApplied,
      files: { jsonPath, mdPath, csvPath },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

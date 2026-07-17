import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const singleCockpitScript = path.join(root, "scripts", "automation", "prepare_single_product_validation_cockpit.mjs");

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

function collectFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, predicate, out);
    } else if (predicate(entry.name, fullPath)) {
      out.push(fullPath);
    }
  }
  return out;
}

function latestFileUnder(dir, prefix) {
  const matches = collectFiles(dir, (name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  const todayKey = datePartsParis().dateKey;
  return matches.find((match) => match.fullPath.includes(todayKey))?.fullPath ?? matches[0]?.fullPath ?? null;
}

function readJson(filePath, fallback = null) {
  if (!filePath || !fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relativePath(filePath) {
  return filePath ? path.relative(root, filePath) : "";
}

function numberArg(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function markdown(summary) {
  const rows = summary.products.map(
    (product) =>
      `| ${product.rank} | ${mdCell(product.name)} | ${product.status} | ${product.evidenceFieldMissingCount} | ${product.imageTaskCount} | ${product.blockerCount} | ${product.outputDirRelative} |`,
  );

  return `${[
    "# Maxi Trouvailles - Batch cockpits validation produits",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Mode: ${summary.mode}`,
    "",
    "## Synthese",
    "",
    `- Cockpits produits generes: ${summary.productCount}`,
    `- Preuves manquantes cumulees: ${summary.totalEvidenceMissing}`,
    `- Images exactes attendues cumulees: ${summary.totalImageTasks}`,
    `- Publication: aucune`,
    `- Paiement/commande fournisseur: aucun`,
    "",
    "## Produits",
    "",
    "| Rang | Produit | Statut | Preuves manquantes | Images attendues | Blocages | Dossier |",
    "|---:|---|---|---:|---:|---:|---|",
    ...rows,
    "",
    "## Commandes a relancer apres remplissage",
    "",
    "- `npm run catalog:audit-fast-proof-now-export`",
    "- `npm run catalog:audit-sprint-image-local-files`",
    "- `npm run catalog:audit-sprint-image-gates`",
    "- `npm run catalog:audit-sprint-image-human-review`",
    "- `npm run catalog:audit-public-dropshipping-surface`",
    "- `npm run catalog:audit-checkout-eligibility`",
    "",
    "## Garde-fous",
    "",
    "- Cockpits internes uniquement.",
    "- Aucune publication, aucun paiement, aucune commande fournisseur.",
    "- Aucun telechargement ou copie d'image publique.",
    "- Les liens fournisseurs restent reserves a la validation interne.",
    "",
    "## Sources",
    "",
    `- Shortlist: ${summary.sources.shortlistPath}`,
    "",
  ].join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const limit = numberArg("limit", 3);
const shortlistPath = latestFileUnder(actionRoot, "SHORTLIST_GO_HUMAIN_PARTENAIRES_");
const shortlist = readJson(shortlistPath, {});
const candidates = (shortlist.evidenceSprint ?? shortlist.candidates ?? []).slice(0, limit);

if (!candidates.length) {
  throw new Error("No shortlist candidates available for batch cockpit generation.");
}

const products = [];
for (const candidate of candidates) {
  const result = spawnSync(process.execPath, [singleCockpitScript, `--product=${candidate.id}`], {
    cwd: root,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      `Cockpit generation failed for ${candidate.id}: ${result.stderr || result.stdout}`,
    );
  }

  const parsed = JSON.parse(result.stdout);
  products.push({
    rank: products.length + 1,
    id: parsed.productId,
    name: candidate.name,
    score: candidate.score ?? 0,
    status: parsed.status,
    evidenceFieldMissingCount: parsed.evidenceFieldMissingCount,
    imageTaskCount: parsed.imageTaskCount,
    blockerCount: parsed.blockerCount,
    outputDirRelative: relativePath(path.dirname(parsed.files.jsonPath)),
    files: {
      jsonPath: relativePath(parsed.files.jsonPath),
      mdPath: relativePath(parsed.files.mdPath),
      fillPath: relativePath(parsed.files.fillPath),
    },
  });
}

const outputDir = path.join(actionRoot, `cockpits-validation-produits-batch-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_product_validation_cockpit_batch",
  limit,
  productCount: products.length,
  totalEvidenceMissing: products.reduce((sum, product) => sum + product.evidenceFieldMissingCount, 0),
  totalImageTasks: products.reduce((sum, product) => sum + product.imageTaskCount, 0),
  products,
  outputDirRelative: relativePath(outputDir),
  sources: {
    shortlistPath: relativePath(shortlistPath),
  },
  safety: {
    readOnly: true,
    noCatalogWrite: true,
    noPublicUploadsWrite: true,
    noImageDownload: true,
    noImageGeneration: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noMessageSent: true,
    manualValidationRequired: true,
  },
};

const jsonPath = path.join(outputDir, `COCKPITS_VALIDATION_PRODUITS_BATCH_${dateKey}.json`);
const mdPath = path.join(outputDir, `COCKPITS_VALIDATION_PRODUITS_BATCH_${dateKey}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      productCount: summary.productCount,
      totalEvidenceMissing: summary.totalEvidenceMissing,
      totalImageTasks: summary.totalImageTasks,
      files: {
        jsonPath,
        mdPath,
      },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

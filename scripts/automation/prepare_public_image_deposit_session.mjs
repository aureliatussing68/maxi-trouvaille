import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const sessionLimit = 12;
const immediateLimit = 5;

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

function latestDirectoryUnder(dirPath, prefix, options = {}) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return null;
  }

  const excludeIncludes = options.excludeIncludes ?? [];

  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.startsWith(prefix) &&
        !excludeIncludes.some((excluded) => entry.name.includes(excluded)),
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

function slugSafe(value) {
  const slug = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);

  return slug || "produit-hold";
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(items) {
  const headers = [
    "rank",
    "sessionLane",
    "status",
    "name",
    "slug",
    "expectedFileName",
    "dropFolder",
    "checklistPath",
    "targetPublicPath",
    "nextAction",
  ];

  return `${headers.join(",")}\n${items
    .map((item) => headers.map((header) => csvEscape(item[header])).join(","))
    .join("\n")}\n`;
}

function laneFor(item) {
  if (item.blockers?.some((blocker) => blocker !== "expected_webp_missing")) {
    return "P0_CORRIGER_DEPOT";
  }

  if (item.status === "READY_COPY_AFTER_MOUSS") {
    return "P0_ATTEND_VALIDATION_MOUSS";
  }

  if (item.status === "READY_HUMAN_REVIEW") {
    return "P1_REVIEW_HUMAINE";
  }

  return "P2_DEPOSER_WEBP";
}

function nextActionFor(item) {
  switch (item.sessionLane) {
    case "P0_CORRIGER_DEPOT":
      return "Corriger le dossier depot: retirer fichiers en trop, renommer ou remplacer par le WebP exact attendu.";
    case "P0_ATTEND_VALIDATION_MOUSS":
      return "Ne rien copier automatiquement: attendre validation humaine Mouss avant action publique.";
    case "P1_REVIEW_HUMAINE":
      return "Relire la photo exacte et cocher la checklist seulement si les preuves sont completes.";
    default:
      return `Deposer manuellement ${item.expectedFileName} dans le dossier depot-manuel, puis relancer les audits.`;
  }
}

function markdown(summary) {
  const rows = summary.items.map(
    (item) =>
      `| ${item.rank} | ${item.sessionLane} | ${item.name} | ${item.expectedFileName} | ${item.dropFolder} | ${item.nextAction} |`,
  );

  return `${[
    "# Session depot WebP images publiques exactes",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Audit depot source: ${summary.sourceDepositAudit}`,
    `Pack source: ${summary.sourceProofPack}`,
    "",
    "## Synthese",
    "",
    `- Produits en session: ${summary.itemCount}`,
    `- A ouvrir maintenant: ${summary.immediateItems.length}`,
    `- WebP manquants: ${summary.counts.P2_DEPOSER_WEBP ?? 0}`,
    `- Depots a corriger: ${summary.counts.P0_CORRIGER_DEPOT ?? 0}`,
    `- Prets revue humaine: ${summary.counts.P1_REVIEW_HUMAINE ?? 0}`,
    `- Prets copie apres Mouss: ${summary.counts.P0_ATTEND_VALIDATION_MOUSS ?? 0}`,
    "",
    "## Ordre de travail",
    "",
    "| Rang | Lane | Produit | WebP attendu | Dossier depot | Action |",
    "|---:|---|---|---|---|---|",
    ...rows,
    "",
    "## Commandes apres depot",
    "",
    "```powershell",
    "npm run catalog:audit-public-image-deposit-files",
    "npm run catalog:audit-public-image-proof-pack",
    "npm run catalog:public-image-action-board",
    "npm run catalog:audit-public-image-action-board",
    "npm run catalog:audit-public-dropshipping-surface",
    "npm run catalog:audit-checkout-eligibility",
    "```",
    "",
    "## Garde-fous",
    "",
    "- Aucun telechargement image.",
    "- Aucune copie dans `public/uploads`.",
    "- Aucune modification catalogue.",
    "- Aucune publication.",
    "- Aucun paiement.",
    "- Aucune commande partenaire.",
    "",
  ].join("\n")}\n`;
}

function sessionCard(item) {
  return `${[
    `# Session depot WebP - ${item.name}`,
    "",
    `Rang: ${item.rank}`,
    `Lane: ${item.sessionLane}`,
    `Statut depot: ${item.status}`,
    `Produit: ${item.name}`,
    `Slug: ${item.slug}`,
    `WebP attendu: ${item.expectedFileName}`,
    `Dossier depot: ${item.dropFolder}`,
    `Fichier attendu complet: ${item.expectedFilePath}`,
    `Checklist: ${item.checklistPath}`,
    `Cible publique apres validation Mouss: ${item.targetPublicPath}`,
    "",
    "## Action maintenant",
    "",
    item.nextAction,
    "",
    "## Garde-fous",
    "",
    "- Ne pas utiliser une image approximative.",
    "- Ne pas copier vers `public/uploads/partner-products` sans validation Mouss.",
    "- Ne pas publier la fiche.",
    "- Ne pas commander ni payer un partenaire.",
    "",
  ].join("\n")}\n`;
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] ?? 0) + 1;
    return acc;
  }, {});
}

const depositAuditDir = latestDirectoryUnder(actionRoot, "public-image-deposit-files-audit-");
const proofPackDir = latestDirectoryUnder(actionRoot, "public-image-proof-pack-", {
  excludeIncludes: ["-audit-"],
});
const depositAuditPath = latestFileUnder(depositAuditDir, "AUDIT_DEPOT_WEBP_IMAGES_PUBLIQUES_");
const proofPackPath = latestFileUnder(proofPackDir, "PACK_PREUVES_IMAGES_PUBLIQUES_");

if (!depositAuditPath || !proofPackPath) {
  throw new Error("Audit depot WebP ou pack preuves images introuvable.");
}

const depositAudit = readJson(depositAuditPath);
const proofPack = readJson(proofPackPath);
const packBySlug = new Map((proofPack.items ?? []).map((item) => [item.slug, item]));
const rankedItems = (depositAudit.items ?? [])
  .map((item, index) => {
    const packItem = packBySlug.get(item.slug) ?? {};
    const sessionLane = laneFor(item);

    return {
      rankSeed: index + 1,
      sessionLane,
      status: item.status,
      name: item.name,
      slug: item.slug,
      expectedFileName: item.expectedFileName,
      dropFolder: item.dropFolder,
      expectedFilePath: item.expectedFilePath,
      checklistPath: packItem.checklistPath ?? "",
      targetPublicPath: packItem.targetPublicPath ?? "",
      blockers: item.blockers ?? [],
      nextAction: "",
    };
  })
  .sort((a, b) => {
    const laneOrder = {
      P0_CORRIGER_DEPOT: 0,
      P0_ATTEND_VALIDATION_MOUSS: 1,
      P1_REVIEW_HUMAINE: 2,
      P2_DEPOSER_WEBP: 3,
    };

    return (laneOrder[a.sessionLane] ?? 9) - (laneOrder[b.sessionLane] ?? 9) || a.rankSeed - b.rankSeed;
  })
  .slice(0, sessionLimit)
  .map((item, index) => {
    const ranked = { ...item, rank: index + 1 };
    ranked.nextAction = nextActionFor(ranked);
    return ranked;
  });

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `public-image-deposit-session-${dateKey}`);
const cardsDir = path.join(outputDir, "fiches-session");
fs.mkdirSync(cardsDir, { recursive: true });

for (const item of rankedItems) {
  fs.writeFileSync(path.join(cardsDir, `DEPOT_${slugSafe(item.slug)}.md`), sessionCard(item), "utf8");
}

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "manual_public_image_deposit_session",
  sourceDepositAudit: rel(depositAuditPath),
  sourceProofPack: rel(proofPackPath),
  itemCount: rankedItems.length,
  immediateItems: rankedItems.slice(0, immediateLimit),
  counts: countBy(rankedItems, "sessionLane"),
  items: rankedItems,
  safety: {
    readOnlyInputs: true,
    noCatalogWrite: true,
    noImageDownload: true,
    noImageFileCreated: true,
    noPublicImageWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

const jsonPath = path.join(outputDir, `SESSION_DEPOT_WEBP_IMAGES_PUBLIQUES_${dateKey}.json`);
const mdPath = path.join(outputDir, `SESSION_DEPOT_WEBP_IMAGES_PUBLIQUES_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-session-depot-webp-images-publiques-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, toCsv(rankedItems), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      itemCount: summary.itemCount,
      counts: summary.counts,
      files: { jsonPath, mdPath, csvPath, cardsDir },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

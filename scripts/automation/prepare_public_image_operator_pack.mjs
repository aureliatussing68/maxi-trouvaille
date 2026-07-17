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

function latestDirectoryUnder(dirPath, prefix, excludedPrefix = null) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return null;
  }

  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.startsWith(prefix) &&
        (!excludedPrefix || !entry.name.startsWith(excludedPrefix)),
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
    "rank",
    "name",
    "slug",
    "operatorStatus",
    "expectedFileName",
    "dropFolder",
    "checklistPath",
    "targetPublicPath",
    "gateDecision",
    "blockers",
    "nextAction",
  ];

  return `${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
    .join("\n")}\n`;
}

function markdown(summary) {
  const rows = summary.items.map(
    (item) =>
      `| ${item.rank} | ${item.operatorStatus} | ${item.name} | ${item.expectedFileName} | ${item.dropFolder} | ${item.checklistPath} | ${item.gateDecision} |`,
  );

  const steps = summary.items.flatMap((item) => [
    `### ${item.rank}. ${item.name}`,
    "",
    `- Statut: ${item.operatorStatus}`,
    `- Fichier exact attendu: \`${item.expectedFileName}\``,
    `- Dossier depot: \`${item.dropFolder}\``,
    `- Checklist: \`${item.checklistPath}\``,
    `- Cible publique future: \`${item.targetPublicPath}\``,
    `- Decision gate: \`${item.gateDecision}\``,
    `- Blocages: ${item.blockers.join(", ")}`,
    `- Action: ${item.nextAction}`,
    "",
  ]);

  return `${[
    "# Pack operateur depot images publiques exactes",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Session source: ${summary.sourceDepositSession}`,
    `Gate source: ${summary.sourceCopyGate}`,
    "",
    "## Synthese",
    "",
    `- Statut technique: ${summary.ok ? "OK" : "ECHEC"}`,
    `- Fiches dans le pack: ${summary.itemCount}`,
    `- Actions depot a faire: ${summary.todoDepositCount}`,
    `- Candidates copie apres Mouss: ${summary.readyCopyCandidateCount}`,
    `- Copie publique appliquee: ${summary.copyApplied ? "OUI" : "NON"}`,
    "",
    "| Rang | Statut | Produit | WebP attendu | Dossier depot | Checklist | Gate |",
    "|---:|---|---|---|---|---|---|",
    ...rows,
    "",
    "## Mode operatoire",
    "",
    "1. Deposer uniquement la photo WebP exacte du meme article dans le dossier indique.",
    "2. Remplir la checklist locale avec preuve image, droits, meme variante et validation Mouss.",
    "3. Relancer les audits depot, session et gate copie publique.",
    "4. Ne jamais copier dans `public/uploads` tant que le gate reste HOLD.",
    "",
    "## Actions produit",
    "",
    ...steps,
    "## Garde-fous",
    "",
    "- Aucun telechargement image.",
    "- Aucune creation image.",
    "- Aucune copie publique.",
    "- Aucune modification catalogue.",
    "- Aucune publication.",
    "- Aucun paiement.",
    "- Aucune commande partenaire.",
    "",
  ].join("\n")}\n`;
}

const sessionDir = latestDirectoryUnder(actionRoot, "public-image-deposit-session-", "public-image-deposit-session-audit-");
const gateDir = latestDirectoryUnder(actionRoot, "public-image-copy-gate-", "public-image-copy-gate-audit-");
const sessionPath = latestFileUnder(sessionDir, "SESSION_DEPOT_WEBP_IMAGES_PUBLIQUES_");
const gatePath = latestFileUnder(gateDir, "GATE_COPIE_IMAGES_PUBLIQUES_");

if (!sessionPath) {
  throw new Error("Session depot images publiques introuvable.");
}

if (!gatePath) {
  throw new Error("Gate copie images publiques introuvable.");
}

const session = readJson(sessionPath);
const gate = readJson(gatePath);
const gateBySlug = new Map((Array.isArray(gate.items) ? gate.items : []).map((item) => [item.slug, item]));
const sourceItems = Array.isArray(session.items) ? session.items : [];
const items = sourceItems
  .map((item, index) => {
    const gateItem = gateBySlug.get(item.slug);
    const blockers = [...new Set([...(item.blockers ?? []), ...(gateItem?.blockers ?? [])])];
    const gateDecision = gateItem?.decision ?? "HOLD";

    return {
      rank: item.rank ?? index + 1,
      rankSeed: item.rankSeed ?? index + 1,
      name: item.name,
      slug: item.slug,
      operatorStatus: gateDecision === "PENDING_MOUSS_VALIDATION" ? "REVUE_MOUSS_AVANT_COPIE" : "A_DEPOSER_WEBP",
      expectedFileName: item.expectedFileName,
      dropFolder: item.dropFolder,
      expectedFilePath: item.expectedFilePath,
      checklistPath: item.checklistPath,
      targetPublicPath: item.targetPublicPath,
      gateDecision,
      blockers,
      nextAction:
        gateDecision === "PENDING_MOUSS_VALIDATION"
          ? "Faire valider Mouss avant toute copie publique manuelle."
          : `Deposer ${item.expectedFileName} dans depot-manuel, remplir la checklist, puis relancer les audits.`,
    };
  })
  .sort((a, b) => a.rank - b.rank || a.rankSeed - b.rankSeed);

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `public-image-operator-pack-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "manual_public_image_operator_pack",
  sourceDepositSession: rel(sessionPath),
  sourceCopyGate: rel(gatePath),
  itemCount: items.length,
  todoDepositCount: items.filter((item) => item.operatorStatus === "A_DEPOSER_WEBP").length,
  readyCopyCandidateCount: items.filter((item) => item.operatorStatus === "REVUE_MOUSS_AVANT_COPIE").length,
  copyApplied: false,
  items,
  safety: {
    readOnlyInputs: true,
    noCatalogWrite: true,
    noImageDownload: true,
    noImageFileCreated: true,
    noPublicImageWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noMessageSent: true,
    requiresMoussValidation: true,
  },
};

const jsonPath = path.join(outputDir, `PACK_OPERATEUR_DEPOT_IMAGES_PUBLIQUES_${dateKey}.json`);
const mdPath = path.join(outputDir, `PACK_OPERATEUR_DEPOT_IMAGES_PUBLIQUES_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-pack-operateur-depot-images-publiques-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, toCsv(items), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      itemCount: summary.itemCount,
      todoDepositCount: summary.todoDepositCount,
      readyCopyCandidateCount: summary.readyCopyCandidateCount,
      copyApplied: summary.copyApplied,
      files: { jsonPath, mdPath, csvPath },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessDir = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessDir, "tableaux-action");
const workpackRoot = path.join(actionRoot, "top3-webp-sourcing-integration-articles");
const workpackAuditRoot = path.join(actionRoot, "audit-top3-webp-sourcing-integration-articles");
const depotAuditRoot = path.join(actionRoot, "audit-top3-webp-depot-files-sourcing-integration-articles");
const outputRoot = path.join(actionRoot, "session-depot-top3-webp-sourcing-integration-articles");
const allowedDepositRootRelative = "business-maxi-trouvailles/depots-images-exactes/integration-articles";

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

function normalizeRelative(value) {
  return String(value ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function absFromRelative(relativePath) {
  return path.join(root, normalizeRelative(relativePath).replace(/\//g, path.sep));
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

function byProduct(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    const key = task.productId;
    const current = groups.get(key) ?? {
      top3Rank: task.top3Rank,
      productId: task.productId,
      productName: task.productName,
      productSlug: task.productSlug,
      categoryId: task.categoryId,
      imageDepositDirRelative: normalizeRelative(task.imageDepositDirRelative),
      adminProofHref: task.adminProofHref,
      tasks: [],
    };
    current.tasks.push(task);
    groups.set(key, current);
  }

  return [...groups.values()].sort((a, b) => a.top3Rank - b.top3Rank);
}

function productReadme(group, sessionDateKey) {
  const rows = group.tasks.map((task) => `| ${task.role} | ${task.expectedFileName} | ${task.expectedTargetPathRelative} |`);

  return `${[
    `# Depot WebP top 3 - ${group.productName}`,
    "",
    "Ce dossier sert uniquement a deposer les WebP exacts du produit apres preuve meme article, droits image et validation Mouss.",
    "",
    `Produit: ${group.productName}`,
    `Produit ID: ${group.productId}`,
    `Categorie: ${group.categoryId}`,
    `Statut session: HOLD_TOP3_WEBP_DEPOT_SESSION_READY`,
    "",
    "## Fichiers attendus ici",
    "",
    "| Role | Fichier exact | Chemin attendu |",
    "|---|---|---|",
    ...rows,
    "",
    "## Checklist avant depot",
    "",
    "- [ ] meme article exact prouve",
    "- [ ] variante exacte confirmee",
    "- [ ] droits image utilisables notes",
    "- [ ] fichier converti en WebP depuis la source autorisee",
    "- [ ] nom de fichier respecte au caractere pres",
    "- [ ] aucune URL fournisseur ou marketplace dans le dossier",
    "- [ ] validation humaine Mouss avant toute copie publique",
    "",
    "## Commandes apres depot",
    "",
    "```powershell",
    "npm run catalog:audit-integration-top3-webp-depot-files",
    "npm run catalog:daily-execution-board",
    "npm run catalog:audit-daily-execution-board",
    "```",
    "",
    "## Interdits",
    "",
    "- ne pas telecharger automatiquement;",
    "- ne pas copier dans `public/uploads`;",
    "- ne pas publier;",
    "- ne pas commander fournisseur;",
    "- ne pas exposer le fournisseur ou la marketplace cote client.",
    "",
    `Session: ${sessionDateKey}`,
    "",
  ].join("\n")}\n`;
}

function sessionMarkdown(session) {
  const groupBlocks = session.groups.flatMap((group) => [
    `### ${group.top3Rank}. ${group.productName}`,
    "",
    `- Dossier: \`${group.imageDepositDirRelative}\``,
    `- Fichiers attendus: ${group.imageTaskCount}`,
    `- Consigne: \`${group.instructionPathRelative}\``,
    "",
    "| Role | Fichier | Statut |",
    "|---|---|---|",
    ...group.tasks.map(
      (task) => `| ${mdCell(task.role)} | ${mdCell(task.expectedFileName)} | ${mdCell(task.status)} |`,
    ),
    "",
  ]);

  return `${[
    "# Session depot WebP top 3 integration",
    "",
    `Date locale: ${session.generatedAtLocal}`,
    `Statut: ${session.status}`,
    "",
    "## Synthese",
    "",
    `- Produits: ${session.productCount}`,
    `- Dossiers prepares: ${session.groupCount}`,
    `- WebP attendus: ${session.imageTaskCount}`,
    `- WebP deja valides selon dernier audit depot: ${session.depotAudit.readyImageCount}`,
    `- WebP manquants selon dernier audit depot: ${session.depotAudit.missingCount}`,
    `- WebP invalides selon dernier audit depot: ${session.depotAudit.invalidImageCount}`,
    "- Copie publique: aucune",
    "- Telechargement image: aucun",
    "- Publication: aucune",
    "",
    "## Ordre de depot",
    "",
    "| Ordre | Produit | Role | Fichier attendu | Dossier |",
    "|---:|---|---|---|---|",
    ...session.items.map(
      (item) =>
        `| ${item.sessionOrder} | ${mdCell(item.productName)} | ${mdCell(item.role)} | ${mdCell(item.expectedFileName)} | ${mdCell(item.imageDepositDirRelative)} |`,
    ),
    "",
    "## Dossiers produits",
    "",
    ...groupBlocks,
    "## Commandes",
    "",
    "```powershell",
    "npm run catalog:audit-integration-top3-webp-depot-files",
    "npm run catalog:audit-integration-top3-webp-depot-session",
    "npm run catalog:daily-execution-board",
    "npm run catalog:audit-daily-execution-board",
    "```",
    "",
  ].join("\n")}\n`;
}

function sessionCsv(session) {
  const headers = [
    "session_order",
    "top3_rank",
    "product_id",
    "product_name",
    "category_id",
    "role",
    "expected_file_name",
    "expected_target_path",
    "deposit_folder",
    "instruction_path",
    "status",
  ];

  return `${headers.join(";")}\n${session.items
    .map((item) =>
      [
        item.sessionOrder,
        item.top3Rank,
        item.productId,
        item.productName,
        item.categoryId,
        item.role,
        item.expectedFileName,
        item.expectedTargetPathRelative,
        item.imageDepositDirRelative,
        item.instructionPathRelative,
        item.status,
      ]
        .map(csvEscape)
        .join(";"),
    )
    .join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const workpackPath = latestFile(workpackRoot, /TOP3_WEBP_SOURCING_INTEGRATION_\d+\.json$/, "top3 webp workpack");
const workpackAuditPath = latestFile(
  workpackAuditRoot,
  /AUDIT_TOP3_WEBP_SOURCING_INTEGRATION_\d+\.json$/,
  "top3 webp workpack audit",
);
const depotAuditPath = latestFile(
  depotAuditRoot,
  /AUDIT_TOP3_WEBP_DEPOT_FILES_SOURCING_INTEGRATION_\d+\.json$/,
  "top3 webp depot files audit",
);
const workpack = readJson(workpackPath);
const workpackAudit = readJson(workpackAuditPath);
const depotAudit = readJson(depotAuditPath);
const imageTasks = Array.isArray(workpack.imageTasks) ? workpack.imageTasks : [];
const groups = byProduct(imageTasks).map((group) => {
  const groupDir = absFromRelative(group.imageDepositDirRelative);
  fs.mkdirSync(groupDir, { recursive: true });
  const instructionPath = path.join(groupDir, `A_DEPOSER_TOP3_WEBP_${group.productSlug}_${dateKey}.md`);
  const groupTasks = group.tasks.map((task) => ({
    rank: task.rank,
    top3Rank: task.top3Rank,
    productId: task.productId,
    productName: task.productName,
    categoryId: task.categoryId,
    role: task.role,
    expectedFileName: task.expectedFileName,
    expectedTargetPathRelative: normalizeRelative(task.expectedTargetPathRelative),
    status: "HOLD_WAITING_EXACT_WEBP_DEPOSIT",
  }));

  fs.writeFileSync(instructionPath, productReadme({ ...group, tasks: groupTasks }, dateKey), "utf8");

  return {
    top3Rank: group.top3Rank,
    productId: group.productId,
    productName: group.productName,
    productSlug: group.productSlug,
    categoryId: group.categoryId,
    imageDepositDirRelative: group.imageDepositDirRelative,
    instructionPathRelative: rel(instructionPath),
    imageTaskCount: groupTasks.length,
    tasks: groupTasks,
  };
});
const items = groups.flatMap((group) =>
  group.tasks.map((task) => ({
    sessionOrder: task.rank,
    top3Rank: task.top3Rank,
    productId: task.productId,
    productName: task.productName,
    productSlug: group.productSlug,
    categoryId: task.categoryId,
    role: task.role,
    expectedFileName: task.expectedFileName,
    expectedTargetPathRelative: task.expectedTargetPathRelative,
    imageDepositDirRelative: group.imageDepositDirRelative,
    instructionPathRelative: group.instructionPathRelative,
    status: task.status,
  })),
);

const session = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "manual_integration_top3_webp_depot_session",
  status: "HOLD_TOP3_WEBP_DEPOT_SESSION_READY",
  productCount: groups.length,
  groupCount: groups.length,
  imageTaskCount: items.length,
  instructionFileCount: groups.length,
  depotAudit: {
    status: depotAudit.status,
    readyImageCount: depotAudit.readyImageCount ?? 0,
    missingCount: depotAudit.missingCount ?? 0,
    invalidImageCount: depotAudit.invalidImageCount ?? 0,
    failureCount: depotAudit.failureCount ?? 0,
    sensitiveFindingCount: depotAudit.sensitiveFindingCount ?? 0,
  },
  workpackAudit: {
    status: workpackAudit.status,
    failureCount: workpackAudit.failureCount ?? 0,
    sensitiveFindingCount: workpackAudit.sensitiveFindingCount ?? 0,
  },
  sources: {
    workpackPath: rel(workpackPath),
    workpackAuditPath: rel(workpackAuditPath),
    depotAuditPath: rel(depotAuditPath),
    allowedDepositRootRelative,
  },
  safety: {
    readOnlyInputs: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noExternalContact: true,
    noImageDownload: true,
    noImageFileCreated: true,
    noPublicImageWrite: true,
    manualValidationRequired: true,
  },
  groups,
  items,
};

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const jsonPath = path.join(outputDir, `SESSION_DEPOT_TOP3_WEBP_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `SESSION_DEPOT_TOP3_WEBP_SOURCING_INTEGRATION_${dateKey}.md`);
const csvPath = path.join(outputDir, `session-depot-top3-webp-sourcing-integration-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, sessionMarkdown(session), "utf8");
fs.writeFileSync(csvPath, sessionCsv(session), "utf8");

console.log(
  JSON.stringify(
    {
      ok: session.ok,
      mode: session.mode,
      status: session.status,
      productCount: session.productCount,
      groupCount: session.groupCount,
      imageTaskCount: session.imageTaskCount,
      instructionFileCount: session.instructionFileCount,
      depotAudit: session.depotAudit,
      files: { jsonPath, mdPath, csvPath },
      safety: session.safety,
    },
    null,
    2,
  ),
);

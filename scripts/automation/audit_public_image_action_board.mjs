import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const boardPrefix = "public-image-action-board-";
const allowedLanes = new Set([
  "REMPLACER_IMAGE",
  "PROUVER_IMAGE_LOCALE",
  "PROUVER_DROITS_IMAGE",
  "CONTROLER_IMAGE",
]);
const requiredSafetyFlags = [
  "readOnly",
  "noCatalogWrite",
  "noImageDownload",
  "noPublication",
  "noPayment",
  "noSupplierOrder",
  "redactedRemoteImages",
];
const leakPattern =
  /(https?:\/\/|aliexpress|alicdn|ae-pic|temu|supplierUrl|sourceUrl|productUrl|exactProductUrl)/i;

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
        !entry.name.startsWith("public-image-action-board-audit-"),
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

function collectFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return collectFiles(entryPath);
    }
    return [entryPath];
  });
}

function isTargetPublicPath(value) {
  return /^\/uploads\/partner-products\/[^?#]+\.webp$/i.test(String(value ?? ""));
}

function isTargetLocalPath(value) {
  const normalized = String(value ?? "").replace(/\\/g, "/");
  return /^public\/uploads\/partner-products\/[^?#]+\.webp$/i.test(normalized);
}

function assertCondition(condition, code, message, details = {}) {
  if (!condition) {
    return { code, message, details };
  }
  return null;
}

function findLeaks(files) {
  return files
    .map((filePath) => {
      const content = fs.readFileSync(filePath, "utf8");
      if (!leakPattern.test(content)) {
        return null;
      }

      return {
        file: rel(filePath),
        message: "Marqueur externe ou champ fournisseur detecte dans un artefact genere.",
      };
    })
    .filter(Boolean);
}

const boardDir = latestDirectoryUnder(actionRoot, boardPrefix);
const boardJsonPath = latestFileUnder(boardDir, "PUBLIC_IMAGE_ACTION_BOARD_");
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `public-image-action-board-audit-${dateKey}`);

fs.mkdirSync(outputDir, { recursive: true });

const failures = [];

if (!boardDir || !boardJsonPath) {
  failures.push({
    code: "board_missing",
    message: "Aucun board images publiques exactes n'a ete trouve.",
    details: {},
  });
} else {
  const board = readJson(boardJsonPath);
  const items = Array.isArray(board.items) ? board.items : [];
  const files = collectFiles(boardDir).filter((filePath) =>
    [".json", ".md", ".csv"].includes(path.extname(filePath).toLowerCase()),
  );
  const leaks = findLeaks(files);

  failures.push(
    assertCondition(board.ok === true, "board_not_ok", "Le board n'est pas marque OK."),
    assertCondition(
      board.mode === "read_only_public_image_action_board",
      "board_mode_invalid",
      "Le mode du board n'est pas le mode lecture seule attendu.",
      { mode: board.mode },
    ),
    assertCondition(
      typeof board.sourceAudit === "string" && board.sourceAudit.length > 0,
      "source_audit_missing",
      "Le board ne reference pas son audit source.",
    ),
    assertCondition(items.length > 0, "items_missing", "Aucun produit a traiter dans le board."),
    assertCondition(
      board.itemCount === items.length,
      "item_count_mismatch",
      "Le compteur itemCount ne correspond pas a items.length.",
      { itemCount: board.itemCount, itemsLength: items.length },
    ),
    ...requiredSafetyFlags.map((flag) =>
      assertCondition(
        board.safety?.[flag] === true,
        `safety_${flag}_missing`,
        `Garde-fou absent ou faux: ${flag}.`,
      ),
    ),
    ...items.flatMap((item, index) => [
      assertCondition(
        allowedLanes.has(item.lane),
        "lane_invalid",
        "Lane image inconnue.",
        { index, lane: item.lane, slug: item.slug },
      ),
      assertCondition(
        isTargetPublicPath(item.targetPublicPath),
        "target_public_path_invalid",
        "Le WebP public cible doit rester dans /uploads/partner-products.",
        { index, slug: item.slug, targetPublicPath: item.targetPublicPath },
      ),
      assertCondition(
        isTargetLocalPath(item.targetLocalPath),
        "target_local_path_invalid",
        "Le chemin local cible doit rester dans public/uploads/partner-products.",
        { index, slug: item.slug, targetLocalPath: item.targetLocalPath },
      ),
      assertCondition(
        Array.isArray(item.imageBlockers) && item.imageBlockers.length > 0,
        "image_blockers_missing",
        "Une fiche du board n'a pas de bloqueur image.",
        { index, slug: item.slug },
      ),
      assertCondition(
        !leakPattern.test(JSON.stringify(item)),
        "item_leak_marker",
        "Une fiche du board contient un marqueur externe ou fournisseur.",
        { index, slug: item.slug },
      ),
    ]),
    ...leaks.map((leak) => ({
      code: "artifact_leak_marker",
      message: leak.message,
      details: { file: leak.file },
    })),
  );
}

const cleanFailures = failures.filter(Boolean);
const summary = {
  ok: cleanFailures.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_public_image_action_board_audit",
  boardDir: boardDir ? rel(boardDir) : null,
  boardJson: boardJsonPath ? rel(boardJsonPath) : null,
  failures: cleanFailures,
  safety: {
    readOnly: true,
    noCatalogWrite: true,
    noImageDownload: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noExternalApiCall: true,
  },
};

const jsonPath = path.join(outputDir, `AUDIT_PUBLIC_IMAGE_ACTION_BOARD_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_PUBLIC_IMAGE_ACTION_BOARD_${dateKey}.md`);
const mdRows =
  summary.failures.length === 0
    ? ["| OK | Aucun blocage audit | - |"]
    : summary.failures.map(
        (failure) =>
          `| ${failure.code} | ${failure.message} | ${JSON.stringify(failure.details)} |`,
      );

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(
  mdPath,
  `${[
    "# Audit board images publiques exactes",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Board: ${summary.boardJson ?? "absent"}`,
    `Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "| Code | Message | Details |",
    "|---|---|---|",
    ...mdRows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule cote catalogue.",
    "- Aucun telechargement image.",
    "- Aucune publication.",
    "- Aucun paiement.",
    "- Aucune commande fournisseur.",
    "- Aucun appel API externe.",
    "",
  ].join("\n")}\n`,
  "utf8",
);

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      board: summary.boardJson,
      failureCount: summary.failures.length,
      files: { jsonPath, mdPath },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

if (!summary.ok) {
  process.exitCode = 1;
}

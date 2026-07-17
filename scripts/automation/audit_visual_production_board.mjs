import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessDir = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessDir, "tableaux-action");
const outputRoot = actionRoot;
const forbiddenClientTerms = [
  "AliExpress",
  "supplier_url",
  "prix_fournisseur",
  "lien_fournisseur",
];

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
  if (!fs.existsSync(dir)) {
    return out;
  }

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

function latestFileUnder(dir, predicate, label) {
  const matches = collectFiles(dir, predicate)
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (matches.length === 0) {
    throw new Error(`No ${label} found under ${dir}`);
  }

  const todayKey = datePartsParis().dateKey;
  return matches.find((match) => match.fullPath.includes(todayKey))?.fullPath ?? matches[0].fullPath;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relativePath(filePath) {
  return path.relative(root, filePath);
}

function resolveSourcePath(sourcePath) {
  return path.isAbsolute(sourcePath) ? sourcePath : path.join(root, sourcePath);
}

function visualItemsByLane(items, lane) {
  return items.filter((item) => item.lane === lane);
}

function contiguousPriorityFailures(items) {
  const failures = [];
  const priorities = items.map((item) => item.priority);
  const unique = new Set(priorities);

  if (unique.size !== priorities.length) {
    failures.push("DUPLICATE_PRIORITIES");
  }

  for (let index = 0; index < priorities.length; index += 1) {
    if (priorities[index] !== index + 1) {
      failures.push(`PRIORITY_NOT_CONTIGUOUS_AT_${index + 1}`);
      break;
    }
  }

  return failures;
}

function sourceSyncFailures(board, photoWorkOrder, categoryIntake) {
  const failures = [];
  const items = board.items ?? [];
  const productItems = visualItemsByLane(items, "photo_produit_exacte");
  const categoryItems = visualItemsByLane(items, "image_categorie_dropshipping");
  const sourceProductTasks = photoWorkOrder.tasks ?? [];
  const sourceCategoryItems = (categoryIntake.items ?? []).filter(
    (item) => !item.humanReviewReady,
  );

  if (productItems.length !== sourceProductTasks.length) {
    failures.push("PRODUCT_PHOTO_COUNT_MISMATCH");
  }

  if (categoryItems.length !== sourceCategoryItems.length) {
    failures.push("CATEGORY_IMAGE_COUNT_MISMATCH");
  }

  const productFiles = new Set(sourceProductTasks.map((task) => task.expectedFileName));
  const categoryFiles = new Set(sourceCategoryItems.map((item) => item.expectedFileName));

  for (const item of productItems) {
    if (!productFiles.has(item.expectedFileName)) {
      failures.push(`PRODUCT_FILE_NOT_IN_SOURCE:${item.expectedFileName}`);
    }
  }

  for (const item of categoryItems) {
    if (!categoryFiles.has(item.expectedFileName)) {
      failures.push(`CATEGORY_FILE_NOT_IN_SOURCE:${item.expectedFileName}`);
    }
  }

  return failures;
}

function contentFailures(board) {
  const failures = [];
  const serialized = JSON.stringify(board);

  for (const term of forbiddenClientTerms) {
    if (serialized.includes(term)) {
      failures.push(`FORBIDDEN_CLIENT_TERM:${term}`);
    }
  }

  for (const item of board.items ?? []) {
    if (!item.expectedFileName?.endsWith(".webp")) {
      failures.push(`EXPECTED_FILE_NOT_WEBP:${item.expectedFileName}`);
    }
    if (!item.dropFolderRelative?.startsWith("business-maxi-trouvailles")) {
      failures.push(`DROP_FOLDER_OUTSIDE_WORKSPACE:${item.expectedFileName}`);
    }
    if (!item.safetyStatus?.startsWith("HOLD")) {
      failures.push(`SAFETY_STATUS_NOT_HOLD:${item.expectedFileName}`);
    }
  }

  return failures;
}

function safetyFailures(board) {
  const safety = board.safety ?? {};
  const requiredTrue = [
    "readOnly",
    "noPublicUploadsWrite",
    "noImageGeneration",
    "noImageDownload",
    "noCatalogWrite",
    "noPublication",
    "noPayment",
    "noSupplierOrder",
    "manualValidationRequired",
  ];

  return requiredTrue
    .filter((key) => safety[key] !== true)
    .map((key) => `SAFETY_FLAG_NOT_TRUE:${key}`);
}

function markdown(audit) {
  const failureRows = audit.failures.length
    ? audit.failures.map((failure) => `| ${failure} |`)
    : ["| Aucun |"];

  return `${[
    "# Maxi Trouvailles - Audit tableau visuels exacts",
    "",
    `Date locale: ${audit.generatedAtLocal}`,
    `Statut: ${audit.status}`,
    "",
    "## Synthese",
    "",
    `- Visuels dans le board: ${audit.metrics.itemCount}`,
    `- Photos produits: ${audit.metrics.productPhotoCount}`,
    `- Images categories: ${audit.metrics.categoryImageCount}`,
    `- Echecs: ${audit.failureCount}`,
    "- Lecture seule: oui",
    "- Copie publique: aucune",
    "- Publication: aucune",
    "",
    "## Echecs",
    "",
    "| Echec |",
    "|---|",
    ...failureRows,
    "",
    "## Sources",
    "",
    `- Board: ${audit.sources.visualBoardPath}`,
    `- Ordre photos: ${audit.sources.photoWorkOrderPath}`,
    `- Suivi categories: ${audit.sources.categoryIntakePath}`,
    "",
  ].join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const visualBoardPath = latestFileUnder(
  actionRoot,
  (name) => name.startsWith("VISUELS_EXACTS_A_PRODUIRE_") && name.endsWith(".json"),
  "visual production board",
);
const board = readJson(visualBoardPath);
const photoWorkOrderPath = resolveSourcePath(board.sources?.photoWorkOrderPath ?? "");
const categoryIntakePath = resolveSourcePath(board.sources?.categoryIntakePath ?? "");
const photoWorkOrder = readJson(photoWorkOrderPath);
const categoryIntake = readJson(categoryIntakePath);
const items = board.items ?? [];
const productItems = visualItemsByLane(items, "photo_produit_exacte");
const categoryItems = visualItemsByLane(items, "image_categorie_dropshipping");

const failures = [
  ...(board.ok === true ? [] : ["BOARD_OK_NOT_TRUE"]),
  ...(board.status === "HOLD_VISUELS_EXACTS_A_PRODUIRE" || items.length === 0
    ? []
    : ["BOARD_STATUS_NOT_HOLD"]),
  ...(board.itemCount === items.length ? [] : ["ITEM_COUNT_MISMATCH"]),
  ...(board.counts?.productPhotos === productItems.length
    ? []
    : ["PRODUCT_COUNT_FIELD_MISMATCH"]),
  ...(board.counts?.categoryImages === categoryItems.length
    ? []
    : ["CATEGORY_COUNT_FIELD_MISMATCH"]),
  ...contiguousPriorityFailures(items),
  ...sourceSyncFailures(board, photoWorkOrder, categoryIntake),
  ...contentFailures(board),
  ...safetyFailures(board),
];

const audit = {
  ok: failures.length === 0,
  mode: "read_only_visual_production_board_audit",
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  status: failures.length === 0
    ? "OK_VISUAL_PRODUCTION_BOARD_GUARDED"
    : "HOLD_VISUAL_PRODUCTION_BOARD_AUDIT_FAILURE",
  failureCount: failures.length,
  failures,
  metrics: {
    itemCount: items.length,
    productPhotoCount: productItems.length,
    categoryImageCount: categoryItems.length,
    sourceProductTaskCount: photoWorkOrder.tasks?.length ?? 0,
    sourceCategoryItemCount: (categoryIntake.items ?? []).filter(
      (item) => !item.humanReviewReady,
    ).length,
  },
  safety: {
    readOnly: true,
    noPublicUploadsWrite: true,
    noImageGeneration: true,
    noImageDownload: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
  sources: {
    visualBoardPath: relativePath(visualBoardPath),
    photoWorkOrderPath: relativePath(photoWorkOrderPath),
    categoryIntakePath: relativePath(categoryIntakePath),
  },
};

const outputDir = path.join(outputRoot, `audit-production-visuels-exacts-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `AUDIT_VISUELS_EXACTS_A_PRODUIRE_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_VISUELS_EXACTS_A_PRODUIRE_${dateKey}.md`);

fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(audit), "utf8");

console.log(
  JSON.stringify(
    {
      ok: audit.ok,
      status: audit.status,
      failureCount: audit.failureCount,
      metrics: audit.metrics,
      files: {
        jsonPath,
        mdPath,
      },
      safety: audit.safety,
    },
    null,
    2,
  ),
);

if (!audit.ok) {
  process.exitCode = 1;
}

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessDir = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessDir, "tableaux-action");
const dropRoot = path.join(businessDir, "depots-images-categories");

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

function tryLatestFileUnder(dir, predicate) {
  const matches = collectFiles(dir, predicate)
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  const todayKey = datePartsParis().dateKey;
  return matches.find((match) => match.fullPath.includes(todayKey))?.fullPath ?? null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relativePath(filePath) {
  return path.relative(root, filePath);
}

function csvEscape(value) {
  const normalized = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${normalized.replace(/"/g, '""')}"`;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function parseWebpDimensions(buffer) {
  if (buffer.length < 30) return { width: null, height: null };
  const chunk = buffer.subarray(12, 16).toString("ascii");
  if (chunk === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  if (chunk === "VP8 " && buffer.length >= 30) {
    const start = 20;
    if (
      buffer[start + 3] === 0x9d &&
      buffer[start + 4] === 0x01 &&
      buffer[start + 5] === 0x2a
    ) {
      return {
        width: buffer.readUInt16LE(start + 6) & 0x3fff,
        height: buffer.readUInt16LE(start + 8) & 0x3fff,
      };
    }
  }
  if (chunk === "VP8L" && buffer.length >= 25 && buffer[20] === 0x2f) {
    const b1 = buffer[21];
    const b2 = buffer[22];
    const b3 = buffer[23];
    const b4 = buffer[24];
    return {
      width: 1 + (((b2 & 0x3f) << 8) | b1),
      height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
    };
  }
  return { width: null, height: null };
}

function inspectWebp(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      isWebp: false,
      status: "missing",
      bytes: 0,
      width: null,
      height: null,
      ratio: null,
    };
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    return {
      exists: true,
      isWebp: false,
      status: "not_a_file",
      bytes: 0,
      width: null,
      height: null,
      ratio: null,
    };
  }

  const buffer = fs.readFileSync(filePath);
  const isWebp =
    buffer.length >= 20 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";
  const dimensions = isWebp ? parseWebpDimensions(buffer) : { width: null, height: null };
  const ratio =
    dimensions.width && dimensions.height
      ? Number((dimensions.width / dimensions.height).toFixed(3))
      : null;

  return {
    exists: true,
    isWebp,
    status: isWebp ? "present_valid_webp_signature" : "present_invalid_webp_signature",
    bytes: stat.size,
    width: dimensions.width,
    height: dimensions.height,
    ratio,
  };
}

function stageStatus(item, inspection) {
  const blockers = [];
  const warnings = [];

  if (!inspection.exists) {
    blockers.push("MISSING_WEBP_IN_DROP_FOLDER");
  } else if (!inspection.isWebp) {
    blockers.push("INVALID_WEBP_SIGNATURE");
  }

  if (inspection.isWebp) {
    if (!inspection.width || !inspection.height) {
      blockers.push("UNKNOWN_WEBP_DIMENSIONS");
    } else {
      if (inspection.width < 900) blockers.push("WIDTH_BELOW_900PX");
      if (inspection.ratio < 1.5 || inspection.ratio > 1.72) {
        blockers.push("RATIO_NOT_CLOSE_TO_16_10");
      }
    }
    if (inspection.bytes < 10_000) warnings.push("FILE_UNUSUALLY_SMALL");
    if (inspection.bytes > 450_000) warnings.push("FILE_HEAVY_OPTIMIZE_BEFORE_PUBLIC_COPY");
  }

  if ((item.extraFiles ?? []).length > 0) {
    blockers.push("EXTRA_FILES_IN_DROP_FOLDER");
  }

  if (blockers.length > 0) {
    return {
      intakeStatus: "HOLD_INTAKE_BLOCKED",
      humanReviewReady: false,
      blockers,
      warnings,
      nextAction: "deposer ou corriger le WebP exact dans le dossier depot",
    };
  }

  return {
    intakeStatus: "READY_FOR_HUMAN_VISUAL_REVIEW_HOLD",
    humanReviewReady: true,
    blockers,
    warnings,
    nextAction: "faire revue mobile/desktop puis validation Mouss avant toute copie publique",
  };
}

function normalizeItem(item, batchLabel, rank) {
  const inspection = inspectWebp(item.stagingAbsolutePath);
  const gate = stageStatus(item, inspection);
  const expectedFileName = item.expectedFileName ?? item.proposedImageFileName;

  return {
    rank,
    batchLabel,
    categoryId: item.categoryId,
    categorySlug: item.categorySlug,
    categoryName: item.categoryName,
    expectedFileName,
    currentImageUrl: item.currentImageUrl,
    proposedPublicUrl: item.proposedPublicUrl,
    dropFolderRelative: item.dropFolderRelative,
    stagingRelativePath: relativePath(item.stagingAbsolutePath),
    stagingStatus: inspection.status,
    stagingFilePresent: inspection.exists,
    stagingWebpValid: inspection.isWebp,
    stagingBytes: inspection.bytes,
    stagingWidth: inspection.width,
    stagingHeight: inspection.height,
    stagingRatio: inspection.ratio,
    extraFiles: item.extraFiles ?? [],
    intakeStatus: gate.intakeStatus,
    humanReviewReady: gate.humanReviewReady,
    blockers: gate.blockers,
    warnings: gate.warnings,
    nextAction: gate.nextAction,
    visualDirection: item.visualDirection,
    safetyStatus: "HOLD_CATEGORY_IMAGE_INTAKE_REQUIRED",
  };
}

function markdown(summary) {
  const rows = summary.items.map(
    (item) =>
      `| ${item.rank} | ${mdCell(item.batchLabel)} | ${mdCell(item.categoryName)} | ${mdCell(item.expectedFileName)} | ${mdCell(item.intakeStatus)} | ${mdCell(item.blockers)} | ${mdCell(item.nextAction)} |`,
  );

  const batchRows = summary.batches.map(
    (batch) =>
      `| ${mdCell(batch.label)} | ${batch.itemCount} | ${batch.presentValidWebpCount} | ${batch.missingCount} | ${mdCell(batch.manifestRelativePath)} |`,
  );

  return `${[
    "# Maxi Trouvailles - Suivi depots images categories",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Lots suivis: ${summary.batchCount}`,
    `- WebP attendus: ${summary.expectedImageCount}`,
    `- WebP presents et valides: ${summary.presentValidWebpCount}`,
    `- WebP manquants: ${summary.missingCount}`,
    `- Fichiers invalides: ${summary.invalidFileCount}`,
    `- Prets pour revue humaine: ${summary.humanReviewReadyCount}`,
    "- Copie publique: aucune",
    "- Modification catalogue: aucune",
    "- Publication: aucune",
    "",
    "## Lots",
    "",
    "| Lot | Attendus | Valides | Manquants | Manifest |",
    "|---|---:|---:|---:|---|",
    ...batchRows,
    "",
    "## Files attendues",
    "",
    "| Rang | Lot | Categorie | Fichier attendu | Statut | Bloquants | Prochaine action |",
    "|---:|---|---|---|---|---|---|",
    ...rows,
    "",
    "## Regles",
    "",
    "- ne rien copier dans `public/uploads/category-images` sans validation Mouss;",
    "- garder les categories en HOLD tant que les WebP sont manquants;",
    "- relancer ce suivi apres depot de fichiers;",
    "- verifier mobile et desktop avant tout remplacement public.",
    "",
  ].join("\n")}\n`;
}

function csv(summary) {
  const headers = [
    "rank",
    "batchLabel",
    "categoryId",
    "categoryName",
    "expectedFileName",
    "intakeStatus",
    "stagingStatus",
    "stagingRelativePath",
    "stagingBytes",
    "stagingWidth",
    "stagingHeight",
    "stagingRatio",
    "blockers",
    "warnings",
    "nextAction",
    "proposedPublicUrl",
    "currentImageUrl",
  ];

  return `${headers.join(",")}\n${summary.items
    .map((item) => headers.map((header) => csvEscape(item[header])).join(","))
    .join("\n")}\n`;
}

const firstBatchManifestPath = latestFileUnder(
  dropRoot,
  (name) =>
    name.startsWith("MANIFEST_DEPOT_IMAGES_CATEGORIES_") &&
    !name.includes("NEXT_BATCH") &&
    name.endsWith(".json"),
  "MANIFEST_DEPOT_IMAGES_CATEGORIES_*.json",
);
const nextBatchManifestPath = tryLatestFileUnder(
  dropRoot,
  (name) => name.startsWith("MANIFEST_DEPOT_IMAGES_CATEGORIES_NEXT_BATCH_") && name.endsWith(".json"),
);
const roadmapPath = tryLatestFileUnder(
  actionRoot,
  (name) => name.startsWith("ROADMAP_IMAGES_CATEGORIES_") && name.endsWith(".json"),
);

const firstBatch = readJson(firstBatchManifestPath);
const manifests = [
  {
    label: "P1 sprint unicite",
    manifestPath: firstBatchManifestPath,
    manifest: firstBatch,
  },
];

if (nextBatchManifestPath) {
  manifests.push({
    label: "P2 next batch",
    manifestPath: nextBatchManifestPath,
    manifest: readJson(nextBatchManifestPath),
  });
}

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `suivi-depots-images-categories-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

let rankCounter = 0;
const items = manifests.flatMap((batch) =>
  (batch.manifest.items ?? []).map((item) => normalizeItem(item, batch.label, ++rankCounter)),
);

const batches = manifests.map((batch) => {
  const batchItems = items.filter((item) => item.batchLabel === batch.label);
  return {
    label: batch.label,
    manifestPath: batch.manifestPath,
    manifestRelativePath: relativePath(batch.manifestPath),
    itemCount: batchItems.length,
    presentValidWebpCount: batchItems.filter((item) => item.stagingWebpValid).length,
    missingCount: batchItems.filter((item) => !item.stagingFilePresent).length,
    invalidFileCount: batchItems.filter((item) => item.stagingFilePresent && !item.stagingWebpValid).length,
  };
});

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_category_image_intake_status",
  batchCount: batches.length,
  expectedImageCount: items.length,
  presentValidWebpCount: items.filter((item) => item.stagingWebpValid).length,
  missingCount: items.filter((item) => !item.stagingFilePresent).length,
  invalidFileCount: items.filter((item) => item.stagingFilePresent && !item.stagingWebpValid).length,
  humanReviewReadyCount: items.filter((item) => item.humanReviewReady).length,
  outputDir,
  outputDirRelative: relativePath(outputDir),
  batches,
  items,
  sources: {
    firstBatchManifestPath,
    nextBatchManifestPath,
    roadmapPath,
  },
  safety: {
    readOnly: true,
    noPublicUploadsWrite: true,
    noImageGeneration: true,
    noImageDownload: true,
    noImageReplacement: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    manualValidationRequired: true,
  },
};

const jsonPath = path.join(outputDir, `SUIVI_DEPOTS_IMAGES_CATEGORIES_${dateKey}.json`);
const mdPath = path.join(outputDir, `SUIVI_DEPOTS_IMAGES_CATEGORIES_${dateKey}.md`);
const csvPath = path.join(outputDir, `SUIVI_DEPOTS_IMAGES_CATEGORIES_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      batchCount: summary.batchCount,
      expectedImageCount: summary.expectedImageCount,
      presentValidWebpCount: summary.presentValidWebpCount,
      missingCount: summary.missingCount,
      invalidFileCount: summary.invalidFileCount,
      humanReviewReadyCount: summary.humanReviewReadyCount,
      files: {
        jsonPath,
        mdPath,
        csvPath,
      },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

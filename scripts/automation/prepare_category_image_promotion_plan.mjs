import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessDir = path.join(root, "business-maxi-trouvailles");
const dropRoot = path.join(businessDir, "depots-images-categories");
const actionRoot = path.join(businessDir, "tableaux-action");
const publicCategoryImageDir = path.join(root, "public", "uploads", "category-images");

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

function latestFileUnder(dir, prefix, label) {
  const matches = collectFiles(
    dir,
    (name) => name.startsWith(prefix) && name.endsWith(".json"),
  )
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

function futurePublicPath(item) {
  return path.join(publicCategoryImageDir, item.expectedFileName);
}

function statusFor(item, staging) {
  const blockers = [];
  const warnings = [];

  if (!staging.exists) {
    blockers.push("MISSING_WEBP_IN_DROP_FOLDER");
  } else if (!staging.isWebp) {
    blockers.push("INVALID_WEBP_SIGNATURE");
  }

  if (staging.isWebp) {
    if (!staging.width || !staging.height) {
      blockers.push("UNKNOWN_WEBP_DIMENSIONS");
    } else {
      if (staging.width < 900) blockers.push("WIDTH_BELOW_900PX");
      if (staging.ratio < 1.5 || staging.ratio > 1.72) {
        blockers.push("RATIO_NOT_CLOSE_TO_16_10");
      }
    }

    if (staging.bytes < 10_000) warnings.push("FILE_UNUSUALLY_SMALL");
    if (staging.bytes > 450_000) warnings.push("FILE_HEAVY_OPTIMIZE_BEFORE_PUBLIC_COPY");
  }

  if ((item.extraFiles ?? []).length > 0) {
    blockers.push("EXTRA_FILES_IN_DROP_FOLDER");
  }

  if (blockers.length > 0) {
    return {
      mechanicalReady: false,
      promotionStatus: "HOLD_MECHANICAL_BLOCKERS",
      blockers,
      warnings,
    };
  }

  return {
    mechanicalReady: true,
    promotionStatus: "READY_FOR_HUMAN_VISUAL_REVIEW_HOLD",
    blockers,
    warnings,
  };
}

function mainReadme(summary) {
  const rows = summary.items.map(
    (item) =>
      `| ${item.rank} | ${mdCell(item.categoryName)} | ${mdCell(item.expectedFileName)} | ${mdCell(item.promotionStatus)} | ${item.stagingWidth ?? ""} | ${item.stagingHeight ?? ""} | ${item.stagingRatio ?? ""} | ${mdCell(item.blockers)} | ${mdCell(item.futureActionLabel)} |`,
  );

  const futureBlocks = summary.items.flatMap((item) => [
    `## ${item.rank}. ${item.categoryName}`,
    "",
    `Statut: ${item.promotionStatus}`,
    `Fichier depot: ${item.stagingRelativePath}`,
    `Destination publique future proposee: ${item.futurePublicPathRelative}`,
    `URL categorie future proposee: ${item.proposedPublicUrl}`,
    "",
    "Actions futures a faire uniquement apres validation Mouss:",
    "",
    `- sauvegarder l'image categorie actuelle: ${item.currentImageUrl}`,
    `- copier le WebP valide vers: ${item.futurePublicPathRelative}`,
    `- faire pointer la categorie vers: ${item.proposedPublicUrl}`,
    "- verifier la page categories sur mobile et desktop;",
    "- relancer les audits categories et le build.",
    "",
    "Checks humains obligatoires:",
    "",
    "- [ ] image reconnaissable en 1 seconde sur mobile",
    "- [ ] rendu propre desktop",
    "- [ ] difference nette avec l'image actuelle partagee",
    "- [ ] aucun logo marketplace, fournisseur ou marque visible",
    "- [ ] aucune promesse trompeuse ou objet hors categorie",
    "- [ ] validation Mouss explicite",
    "",
  ]);

  return `${[
    "# Maxi Trouvailles - Plan de promotion images categories",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "Ce document prepare une future copie publique, mais ne l'execute pas.",
    "",
    "## Synthese",
    "",
    `- Categories controlees: ${summary.itemCount}`,
    `- Mecaniquement pretes pour revue humaine: ${summary.mechanicalReadyCount}`,
    `- Bloquees avant revue humaine: ${summary.mechanicalBlockedCount}`,
    "- Copie vers public/uploads/category-images: aucune",
    "- Modification catalogue: aucune",
    "- Publication: aucune",
    "",
    "## Statuts",
    "",
    "| Rang | Categorie | Fichier | Statut | Largeur | Hauteur | Ratio | Bloquants | Action future |",
    "|---:|---|---|---|---:|---:|---:|---|---|",
    ...rows,
    "",
    "## Plan futur non execute",
    "",
    ...futureBlocks,
    "## Source",
    "",
    `- Manifest depot: ${summary.sources.dropManifestPath}`,
    "",
  ].join("\n")}\n`;
}

function csv(summary) {
  const headers = [
    "rank",
    "categoryId",
    "categorySlug",
    "categoryName",
    "expectedFileName",
    "promotionStatus",
    "mechanicalReady",
    "blockers",
    "warnings",
    "stagingRelativePath",
    "futurePublicPathRelative",
    "proposedPublicUrl",
    "currentImageUrl",
    "stagingWidth",
    "stagingHeight",
    "stagingRatio",
  ];

  return `${headers.join(",")}\n${summary.items
    .map((item) => headers.map((header) => csvEscape(item[header])).join(","))
    .join("\n")}\n`;
}

const dropManifestPath = latestFileUnder(
  dropRoot,
  "MANIFEST_DEPOT_IMAGES_CATEGORIES_",
  "MANIFEST_DEPOT_IMAGES_CATEGORIES_*.json",
);
const dropManifest = readJson(dropManifestPath);
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `plan-promotion-images-categories-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const items = (dropManifest.items ?? []).map((item) => {
  const staging = inspectWebp(item.stagingAbsolutePath);
  const futurePath = futurePublicPath(item);
  const status = statusFor(item, staging);

  return {
    rank: item.rank,
    categoryId: item.categoryId,
    categorySlug: item.categorySlug,
    categoryName: item.categoryName,
    currentImageUrl: item.currentImageUrl,
    proposedPublicUrl: item.proposedPublicUrl,
    expectedFileName: item.expectedFileName,
    stagingAbsolutePath: item.stagingAbsolutePath,
    stagingRelativePath: relativePath(item.stagingAbsolutePath),
    stagingStatus: staging.status,
    stagingFilePresent: staging.exists,
    stagingWebpValid: staging.isWebp,
    stagingBytes: staging.bytes,
    stagingWidth: staging.width,
    stagingHeight: staging.height,
    stagingRatio: staging.ratio,
    futurePublicPathAbsolute: futurePath,
    futurePublicPathRelative: relativePath(futurePath),
    futureActionLabel: status.mechanicalReady
      ? "revue humaine puis copie publique manuelle"
      : "deposer/corriger le WebP avant revue",
    promotionStatus: status.promotionStatus,
    mechanicalReady: status.mechanicalReady,
    blockers: status.blockers,
    warnings: status.warnings,
    manualValidationRequired: true,
  };
});

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_category_image_promotion_plan_no_public_copy",
  itemCount: items.length,
  mechanicalReadyCount: items.filter((item) => item.mechanicalReady).length,
  mechanicalBlockedCount: items.filter((item) => !item.mechanicalReady).length,
  outputDir,
  outputDirRelative: relativePath(outputDir),
  items,
  sources: {
    dropManifestPath,
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

const manifestPath = path.join(outputDir, `PLAN_PROMOTION_IMAGES_CATEGORIES_${dateKey}.json`);
const readmePath = path.join(outputDir, `PLAN_PROMOTION_IMAGES_CATEGORIES_${dateKey}.md`);
const csvPath = path.join(outputDir, `PLAN_PROMOTION_IMAGES_CATEGORIES_${dateKey}.csv`);

fs.writeFileSync(manifestPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(readmePath, mainReadme(summary), "utf8");
fs.writeFileSync(csvPath, csv(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      itemCount: summary.itemCount,
      mechanicalReadyCount: summary.mechanicalReadyCount,
      mechanicalBlockedCount: summary.mechanicalBlockedCount,
      files: {
        manifestPath,
        readmePath,
        csvPath,
      },
      items: items.map((item) => ({
        rank: item.rank,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        expectedFileName: item.expectedFileName,
        promotionStatus: item.promotionStatus,
        blockers: item.blockers,
      })),
      safety: summary.safety,
    },
    null,
    2,
  ),
);

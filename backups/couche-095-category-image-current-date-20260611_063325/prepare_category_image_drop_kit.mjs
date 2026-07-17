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

function latestFile(prefix, label) {
  const matches = collectFiles(
    actionRoot,
    (name) => name.startsWith(prefix) && name.endsWith(".json"),
  )
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (matches.length === 0) {
    throw new Error(`No ${label} found under ${actionRoot}`);
  }
  return matches[0].fullPath;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);
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

function inspectWebp(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      isWebp: false,
      status: "missing",
      bytes: 0,
      width: null,
      height: null,
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
    };
  }

  const buffer = fs.readFileSync(filePath);
  const isWebp =
    buffer.length >= 20 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";

  const dimensions = isWebp ? parseWebpDimensions(buffer) : { width: null, height: null };
  return {
    exists: true,
    isWebp,
    status: isWebp ? "present_valid_webp_signature" : "present_invalid_webp_signature",
    bytes: stat.size,
    width: dimensions.width,
    height: dimensions.height,
  };
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

function extraFiles(dir, expectedName) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name !== "A_DEPOSER_ICI.md" && name !== expectedName)
    .sort();
}

function categoryReadme(item) {
  return `${[
    `# Depot image categorie - ${item.categoryName}`,
    "",
    "Ce dossier sert uniquement a deposer un WebP candidat avant controle. Il ne remplace aucune image publique.",
    "",
    `Categorie: ${item.categoryId}`,
    `Slug: ${item.categorySlug}`,
    `Image actuelle partagee: ${item.currentImageUrl}`,
    `Nouveau fichier attendu: ${item.expectedFileName}`,
    `Chemin public futur propose: ${item.proposedPublicUrl}`,
    `Statut depot: ${item.stagingStatus}`,
    "",
    "## Direction visuelle",
    "",
    item.visualDirection,
    "",
    "## Fichier attendu ici",
    "",
    `- ${item.expectedFileName}`,
    "",
    "## Checklist avant validation",
    "",
    "- [ ] fichier WebP depose avec le nom exact",
    "- [ ] signature WebP valide",
    "- [ ] ratio 16/10",
    "- [ ] largeur minimum 900 px",
    "- [ ] image reconnaissable sur mobile",
    "- [ ] difference nette avec l'image actuelle partagee",
    "- [ ] aucun logo Amazon, AliExpress, marketplace ou marque visible",
    "- [ ] validation Mouss avant copie publique",
    "",
    "## A ne pas faire",
    "",
    "- ne pas copier manuellement dans `public/uploads/category-images` sans controle;",
    "- ne pas modifier `src/lib/catalog.ts`; ",
    "- ne pas publier;",
    "- ne pas generer ou utiliser une image cheap/pixelisee.",
    "",
  ].join("\n")}\n`;
}

function mainReadme(summary) {
  const rows = summary.items.map(
    (item) =>
      `| ${item.rank} | ${mdCell(item.categoryName)} | ${mdCell(item.expectedFileName)} | ${mdCell(item.stagingStatus)} | ${mdCell(item.dropFolderRelative)} |`,
  );

  return `${[
    "# Maxi Trouvailles - Kit depot images categories",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Categories avec dossier depot: ${summary.itemCount}`,
    `- WebP attendus: ${summary.expectedImageCount}`,
    `- WebP presents et valides: ${summary.presentValidWebpCount}`,
    `- Fichiers invalides: ${summary.invalidStagingFileCount}`,
    `- Fichiers hors liste: ${summary.extraFileCount}`,
    "- Copie vers public/uploads/category-images: aucune",
    "- Modification catalogue: aucune",
    "",
    "## Dossiers",
    "",
    "| Rang | Categorie | Fichier attendu | Statut | Dossier depot |",
    "|---:|---|---|---|---|",
    ...rows,
    "",
    "## Mode d'emploi",
    "",
    "1. Ouvrir le dossier de la categorie.",
    "2. Deposer un WebP au nom exact indique dans `A_DEPOSER_ICI.md`.",
    "3. Relancer `npm run catalog:category-image-drop-kit`.",
    "4. Garder le remplacement en HOLD tant que la revue mobile/desktop et la validation Mouss ne sont pas faites.",
    "",
    "## Source",
    "",
    `- Sprint unicite: ${summary.sources.sprintPath}`,
    "",
  ].join("\n")}\n`;
}

function checklist(summary) {
  const blocks = summary.items.flatMap((item) => [
    `## ${item.rank}. ${item.categoryName}`,
    "",
    `Fichier attendu: ${item.expectedFileName}`,
    `Dossier depot: ${item.dropFolderRelative}`,
    `Destination future: ${item.proposedPublicUrl}`,
    "",
    item.visualDirection,
    "",
    "- [ ] WebP present",
    "- [ ] signature WebP valide",
    "- [ ] ratio 16/10",
    "- [ ] largeur minimum 900 px",
    "- [ ] pas de logo marketplace/marque visible",
    "- [ ] mobile lisible",
    "- [ ] desktop propre",
    "- [ ] validation Mouss",
    "",
  ]);

  return `${[
    "# Checklist depot images categories",
    "",
    "Cette checklist ne donne pas le droit de publier. Elle prepare seulement une future validation humaine.",
    "",
    ...blocks,
  ].join("\n")}\n`;
}

function csv(summary) {
  const headers = [
    "rank",
    "categoryId",
    "categorySlug",
    "categoryName",
    "expectedFileName",
    "stagingStatus",
    "stagingRelativePath",
    "proposedPublicUrl",
    "currentImageUrl",
    "visualDirection",
  ];

  return `${headers.join(",")}\n${summary.items
    .map((item) => headers.map((header) => csvEscape(item[header])).join(","))
    .join("\n")}\n`;
}

const sprintPath = latestFile("SPRINT_UNICITE_IMAGES_CATEGORIES_", "SPRINT_UNICITE_IMAGES_CATEGORIES_*.json");
const sprint = readJson(sprintPath);
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(dropRoot, `depot-images-categories-${dateKey}`);
const categoriesDir = path.join(outputDir, "categories");
fs.mkdirSync(categoriesDir, { recursive: true });

const items = (sprint.sprint ?? []).map((item) => {
  const folderName = `${String(item.rank).padStart(2, "0")}-${slugify(item.categoryName)}-${item.categoryId}`;
  const categoryDir = path.join(categoriesDir, folderName);
  fs.mkdirSync(categoryDir, { recursive: true });
  const expectedFileName = item.proposedImageFileName;
  const stagingAbsolutePath = path.join(categoryDir, expectedFileName);
  const staging = inspectWebp(stagingAbsolutePath);
  const prepared = {
    rank: item.rank,
    categoryId: item.categoryId,
    categorySlug: item.categorySlug,
    categoryName: item.categoryName,
    currentImageUrl: item.currentImageUrl,
    proposedPublicUrl: item.proposedPublicUrl,
    expectedFileName,
    proposedLocalPath: item.proposedLocalPath,
    visualDirection: item.visualDirection,
    dropFolderAbsolute: categoryDir,
    dropFolderRelative: relativePath(categoryDir),
    stagingAbsolutePath,
    stagingRelativePath: relativePath(stagingAbsolutePath),
    stagingStatus: staging.status,
    stagingFilePresent: staging.exists,
    stagingWebpValid: staging.isWebp,
    stagingBytes: staging.bytes,
    stagingWidth: staging.width,
    stagingHeight: staging.height,
    extraFiles: extraFiles(categoryDir, expectedFileName),
    safetyStatus: "HOLD_CATEGORY_IMAGE_VALIDATION_REQUIRED",
  };
  fs.writeFileSync(path.join(categoryDir, "A_DEPOSER_ICI.md"), categoryReadme(prepared), "utf8");
  return prepared;
});

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "manual_category_image_drop_kit_no_public_copy",
  itemCount: items.length,
  expectedImageCount: items.length,
  presentValidWebpCount: items.filter((item) => item.stagingWebpValid).length,
  invalidStagingFileCount: items.filter((item) => item.stagingFilePresent && !item.stagingWebpValid).length,
  extraFileCount: items.reduce((sum, item) => sum + item.extraFiles.length, 0),
  outputDir,
  outputDirRelative: relativePath(outputDir),
  items,
  sources: {
    sprintPath,
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

const manifestPath = path.join(outputDir, `MANIFEST_DEPOT_IMAGES_CATEGORIES_${dateKey}.json`);
const readmePath = path.join(outputDir, `A_LIRE_DEPOT_IMAGES_CATEGORIES_${dateKey}.md`);
const checklistPath = path.join(outputDir, `CHECKLIST_DEPOT_IMAGES_CATEGORIES_${dateKey}.md`);
const csvPath = path.join(outputDir, `NOMS_FICHIERS_IMAGES_CATEGORIES_${dateKey}.csv`);

fs.writeFileSync(manifestPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(readmePath, mainReadme(summary), "utf8");
fs.writeFileSync(checklistPath, checklist(summary), "utf8");
fs.writeFileSync(csvPath, csv(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      itemCount: summary.itemCount,
      expectedImageCount: summary.expectedImageCount,
      presentValidWebpCount: summary.presentValidWebpCount,
      invalidStagingFileCount: summary.invalidStagingFileCount,
      extraFileCount: summary.extraFileCount,
      files: {
        manifestPath,
        readmePath,
        checklistPath,
        csvPath,
        categoriesDir,
      },
      items: items.map((item) => ({
        rank: item.rank,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        expectedFileName: item.expectedFileName,
        stagingStatus: item.stagingStatus,
      })),
      safety: summary.safety,
    },
    null,
    2,
  ),
);

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const catalogPath = path.join(root, "src", "lib", "catalog.ts");
const businessDir = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessDir, "tableaux-action");
const categoryImagePublicBase = "/uploads/category-images";
const minRecommendedBytes = 30_000;
const maxRecommendedBytes = 260_000;
const minRecommendedWidth = 900;
const minRecommendedHeight = 560;

const creativeBriefByFile = {
  "accessoires.webp": "Sacs, montres, bijoux et accessoires mode varies, rendu boutique premium leger.",
  "agencement-magasin.webp": "Boutique moderne, rayons propres, organisation magasin et circulation claire.",
  "animaux.webp": "Chien, chat et accessoires animalerie propres, ambiance chaleureuse sans marque visible.",
  "auto-moto.webp": "Voiture et moto cote a cote, accessoires auto modernes, lumiere propre.",
  "beaute-sante.webp": "Soins, maquillage, parfum, bien-etre et accessoires beaute, rendu lumineux.",
  "bricolage.webp": "Outils en action, etabli bricolage, travaux maison propres et rassurants.",
  "colis-surprise-palettes.webp": "Cartons ouverts, colis mysteres et objets qui debordent, ambiance destockage surprise.",
  "cuisine.webp": "Robot cuisine, ustensiles, vaisselle, mugs et cuisine moderne reconnaissable.",
  "deco.webp": "Salon moderne, decoration interieure, ambiance maison design et claire.",
  "dropshipping.webp": "Selection produits partenaires variee, ecommerce moderne, sans marketplace ni logo.",
  "dropshipping-nouveautes.webp": "Produits nouveaux et tendance, mise en avant nouveautes, style ecommerce propre.",
  "dropshipping-promotions.webp": "Promotions visuelles propres, etiquettes prix sans marque, ambiance bonnes affaires.",
  "electricite.webp": "Cables, prises, ampoules LED et materiel electrique, propre et identifiable.",
  "espace-revendeur.webp": "Palettes, cartons en gros, stock professionnel, ambiance entrepot ou revente.",
  "gadgets.webp": "Gadgets high-tech, objets insolites et accessoires modernes, rendu premium leger.",
  "high-tech.webp": "Ecrans, ordinateurs, objets connectes et technologie moderne, sans logo visible.",
  "informatique.webp": "PC, clavier, setup bureau et composants informatique propres.",
  "jardin.webp": "Plantes, tondeuse, arrosoir, pots et jardin exterieur lumineux.",
  "jeux-video.webp": "Console, manette gaming, setup gaming et accessoires gamer, sans marque lisible.",
  "jouets.webp": "Jouets enfants, univers colore, figurines et jeux, rendu joyeux mais propre.",
  "livre-media.webp": "Livres, mangas, BD, DVD, CD, vinyles ou etagere media clairement reconnaissable.",
  "maison.webp": "Pieces maison, rangement et confort interieur, ambiance claire et utile.",
  "mannequins-bustes.webp": "Mannequins vitrine et bustes presentation vetements, rendu magasin professionnel.",
  "mobilier-professionnel.webp": "Bureau pro, etageres, mobilier commerce ou entrepot, propre et fonctionnel.",
  "outillage.webp": "Perceuse, outils, caisse a outils et bricolage, visuel solide et net.",
  "presentoirs.webp": "Rayonnages et presentoirs magasin, mise en avant produits claire.",
  "produits-partenaires.webp": "Collaboration, selection produits premium partenaires, pas de logo marketplace.",
  "puericulture.webp": "Bebe, poussette, jouets bebe, siege auto et biberons, ambiance douce et rassurante.",
  "sport-loisirs.webp": "Tennis, velo, ballon, fitness, camping et activite exterieure.",
  "telephonie.webp": "Smartphones, accessoires telephone et ecouteurs, rendu moderne sans logo.",
  "vetements.webp": "Portants vetements, mode homme/femme, ambiance boutique textile.",
};

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

function readCatalogSource() {
  const text = fs.readFileSync(catalogPath, "utf8");
  return ts.createSourceFile(catalogPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function findVariable(sourceFile, variableName) {
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === variableName) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    (ts.isAsExpression(current) ||
      ts.isSatisfiesExpression?.(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isTypeAssertionExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

function propertyNameText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}

function constStringMap(sourceFile) {
  const map = new Map();
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))
    ) {
      map.set(node.name.text, node.initializer.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return map;
}

function evaluateString(node, constants) {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isIdentifier(node)) {
    return constants.get(node.text);
  }
  if (ts.isTemplateExpression(node)) {
    let value = node.head.text;
    for (const span of node.templateSpans) {
      const expressionValue = evaluateString(span.expression, constants);
      if (expressionValue === undefined) return undefined;
      value += expressionValue + span.literal.text;
    }
    return value;
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = evaluateString(node.left, constants);
    const right = evaluateString(node.right, constants);
    if (left === undefined || right === undefined) return undefined;
    return `${left}${right}`;
  }
  return undefined;
}

function extractStringArray(sourceFile, variableName, constants) {
  const variable = findVariable(sourceFile, variableName);
  const initializer = unwrapExpression(variable?.initializer);
  if (!initializer || !ts.isArrayLiteralExpression(initializer)) {
    return [];
  }
  return initializer.elements
    .map((element) => evaluateString(element, constants))
    .filter((value) => typeof value === "string");
}

function extractImageMap(sourceFile, constants) {
  const variable = findVariable(sourceFile, "categoryImageById");
  const initializer = unwrapExpression(variable?.initializer);
  if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
    throw new Error("categoryImageById object not found");
  }

  const imageById = new Map();
  for (const property of initializer.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const key = propertyNameText(property.name);
    if (!key) continue;
    imageById.set(key, evaluateString(property.initializer, constants));
  }

  return imageById;
}

function extractRawCategories(sourceFile, constants) {
  const variable = findVariable(sourceFile, "rawCategories");
  const initializer = unwrapExpression(variable?.initializer);
  if (!initializer || !ts.isArrayLiteralExpression(initializer)) {
    throw new Error("rawCategories array not found");
  }

  return initializer.elements
    .filter((element) => ts.isObjectLiteralExpression(element))
    .map((objectNode) => {
      const category = {};
      for (const property of objectNode.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const key = propertyNameText(property.name);
        if (!key) continue;
        category[key] = evaluateString(property.initializer, constants);
      }
      return category;
    })
    .filter((category) => category.id && category.slug && category.name);
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
  if (buffer.length < 30) {
    return { width: null, height: null };
  }

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

function localPathFromPublicUrl(publicUrl) {
  return path.join(root, "public", String(publicUrl).replace(/^\//, ""));
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

function categoryWarnings(record, duplicateCount) {
  const warnings = [];
  if (!record.hasDedicatedMapping) warnings.push("fallback_image_mapping");
  if (duplicateCount > 1) warnings.push("shared_image_asset");
  if (record.file.exists && record.file.bytes < minRecommendedBytes) warnings.push("file_size_low");
  if (record.file.exists && record.file.bytes > maxRecommendedBytes) warnings.push("file_size_high");
  if (
    record.file.exists &&
    record.file.width !== null &&
    record.file.height !== null &&
    (record.file.width < minRecommendedWidth || record.file.height < minRecommendedHeight)
  ) {
    warnings.push("dimensions_low");
  }
  if (!creativeBriefByFile[path.basename(record.localPath)]) warnings.push("creative_brief_missing");
  return warnings;
}

function categoryFailures(record) {
  const failures = [];
  if (!record.imageUrl) failures.push("image_url_missing");
  if (!String(record.imageUrl).startsWith(categoryImagePublicBase)) failures.push("image_outside_category_folder");
  if (!record.file.exists) failures.push("local_file_missing");
  if (record.file.exists && !record.file.isWebp) failures.push("invalid_webp_signature");
  if (record.file.exists && path.extname(record.localPath).toLowerCase() !== ".webp") {
    failures.push("not_webp_extension");
  }
  return failures;
}

function productionPriority(record) {
  if (record.failures.length > 0) return "P0_CORRIGER_AVANT_PUBLICATION";
  if (record.warnings.includes("fallback_image_mapping")) return "P1_IMAGE_DEDIEE_A_PREPARER";
  if (record.warnings.includes("dimensions_low") || record.warnings.includes("file_size_low")) {
    return "P2_REFAIRE_QUALITE";
  }
  if (record.warnings.includes("shared_image_asset")) return "P3_REVOIR_UNICITE_VISUELLE";
  return "OK";
}

function markdown(summary) {
  const rows = summary.categories.map(
    (category) =>
      `| ${mdCell(category.id)} | ${mdCell(category.name)} | ${mdCell(category.imageFileName)} | ${category.file.exists ? "oui" : "non"} | ${category.file.width ?? "?"}x${category.file.height ?? "?"} | ${category.file.bytes} | ${mdCell(category.priority)} | ${mdCell(category.warnings.join(", "))} | ${mdCell(category.failures.join(", "))} |`,
  );

  const duplicateRows = summary.sharedImageGroups.map(
    (group) => `| ${mdCell(group.imageFileName)} | ${group.categoryIds.length} | ${mdCell(group.categoryIds.join(", "))} |`,
  );

  return `${[
    "# Maxi Trouvailles - Audit images categories",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Categories analysees: ${summary.categoryCount}`,
    `- Categories visibles: ${summary.visibleCategoryCount}`,
    `- Categories cachees/navigation: ${summary.hiddenCategoryCount}`,
    `- Images uniques referencees: ${summary.uniqueImageCount}`,
    `- Fichiers WebP presents et valides: ${summary.validWebpFileCount}`,
    `- Echecs bloquants: ${summary.failureCount}`,
    `- Avertissements: ${summary.warningCount}`,
    "- Images generees: aucune",
    "- Modification catalogue: aucune",
    "",
    "## Categories",
    "",
    "| ID | Nom | Image | Presente | Dimensions | Octets | Priorite | Avertissements | Echecs |",
    "|---|---|---|---|---|---:|---|---|---|",
    ...rows,
    "",
    "## Images partagees",
    "",
    duplicateRows.length
      ? "| Image | Categories | IDs |\n|---|---:|---|\n" + duplicateRows.join("\n")
      : "Aucune image partagee.",
    "",
    "## Regles production",
    "",
    "- garder les titres et descriptions categories existants;",
    "- utiliser des images WebP propres, modernes, realistes ou semi-realistes;",
    "- ne jamais afficher de logo marketplace, fournisseur ou marque visible;",
    "- viser un ratio 16/10, largeur au moins 900 px, poids raisonnable;",
    "- tester mobile et desktop avant remplacement public.",
    "",
  ].join("\n")}\n`;
}

function productionManifestMarkdown(summary) {
  const byFile = new Map();
  for (const category of summary.categories) {
    if (!byFile.has(category.imageFileName)) {
      byFile.set(category.imageFileName, {
        imageFileName: category.imageFileName,
        imageUrl: category.imageUrl,
        localPath: category.localPath,
        categoryNames: [],
        categoryIds: [],
        brief: category.creativeBrief,
        priority: category.priority,
      });
    }
    const group = byFile.get(category.imageFileName);
    group.categoryNames.push(category.name);
    group.categoryIds.push(category.id);
    if (priorityRank(category.priority) < priorityRank(group.priority)) {
      group.priority = category.priority;
    }
  }

  const blocks = Array.from(byFile.values())
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.imageFileName.localeCompare(b.imageFileName))
    .map((item) =>
      [
        `## ${item.imageFileName}`,
        "",
        `Priorite: ${item.priority}`,
        `Categories: ${item.categoryNames.join(", ")}`,
        `Chemin cible: ${item.imageUrl}`,
        `Fichier local: ${relativePath(item.localPath)}`,
        "",
        "Brief visuel:",
        "",
        item.brief,
        "",
        "Contraintes:",
        "",
        "- WebP optimise, ratio 16/10;",
        "- image reconnaissable en mobile;",
        "- aucun logo marketplace ou marque lisible;",
        "- style ecommerce moderne, premium mais leger;",
        "- pas d'image pixelisee ou cheap.",
        "",
      ].join("\n"),
    );

  return `${[
    "# Manifest production images categories",
    "",
    "Ce manifeste sert a refaire ou verifier les images categorie. Il ne genere aucune image automatiquement.",
    "",
    ...blocks,
  ].join("\n")}\n`;
}

function priorityRank(priority) {
  if (priority.startsWith("P0")) return 0;
  if (priority.startsWith("P1")) return 1;
  if (priority.startsWith("P2")) return 2;
  if (priority.startsWith("P3")) return 3;
  return 9;
}

function csv(summary) {
  const headers = [
    "id",
    "slug",
    "name",
    "parentId",
    "visible",
    "imageUrl",
    "imageFileName",
    "localPath",
    "exists",
    "isWebp",
    "width",
    "height",
    "bytes",
    "priority",
    "warnings",
    "failures",
    "creativeBrief",
  ];
  return `${headers.join(",")}\n${summary.categories
    .map((category) => headers.map((header) => csvEscape(category[header])).join(","))
    .join("\n")}\n`;
}

const sourceFile = readCatalogSource();
const constants = constStringMap(sourceFile);
const imageById = extractImageMap(sourceFile, constants);
const rawCategories = extractRawCategories(sourceFile, constants);
const hiddenNavigationIds = new Set(extractStringArray(sourceFile, "hiddenNavigationCategoryIds", constants));
const mainCategoryIds = new Set(extractStringArray(sourceFile, "mainCategoryIds", constants));

const fallbackImage = imageById.get("dropshipping");
const baseRecords = rawCategories.map((category) => {
  const hasDedicatedMapping = imageById.has(category.id);
  const imageUrl = imageById.get(category.id) ?? fallbackImage;
  const localPath = localPathFromPublicUrl(imageUrl);
  const file = inspectWebp(localPath);
  const imageFileName = path.basename(localPath);
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    parentId: category.parentId ?? "",
    visible: !hiddenNavigationIds.has(category.id),
    hiddenNavigation: hiddenNavigationIds.has(category.id),
    isMainCategory: mainCategoryIds.has(category.id),
    hasDedicatedMapping,
    imageUrl,
    imageFileName,
    localPath,
    localPathRelative: relativePath(localPath),
    file,
    creativeBrief: creativeBriefByFile[imageFileName] ?? "Brief a completer avant remplacement.",
  };
});

const groupsByImage = new Map();
for (const record of baseRecords) {
  const key = record.imageUrl;
  if (!groupsByImage.has(key)) groupsByImage.set(key, []);
  groupsByImage.get(key).push(record);
}

const categories = baseRecords.map((record) => {
  const duplicateCount = groupsByImage.get(record.imageUrl)?.length ?? 1;
  const warnings = categoryWarnings(record, duplicateCount);
  const failures = categoryFailures(record);
  const priority = productionPriority({ ...record, warnings, failures });
  return {
    ...record,
    sharedWithCategoryIds: (groupsByImage.get(record.imageUrl) ?? [])
      .filter((item) => item.id !== record.id)
      .map((item) => item.id),
    warnings,
    failures,
    warningCount: warnings.length,
    failureCount: failures.length,
    priority,
  };
});

const sharedImageGroups = Array.from(groupsByImage.entries())
  .map(([imageUrl, records]) => ({
    imageUrl,
    imageFileName: path.basename(imageUrl),
    categoryIds: records.map((record) => record.id),
    categoryNames: records.map((record) => record.name),
  }))
  .filter((group) => group.categoryIds.length > 1)
  .sort((a, b) => b.categoryIds.length - a.categoryIds.length || a.imageFileName.localeCompare(b.imageFileName));

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `audit-images-categories-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: categories.every((category) => category.failureCount === 0),
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_category_image_audit",
  categoryCount: categories.length,
  visibleCategoryCount: categories.filter((category) => category.visible).length,
  hiddenCategoryCount: categories.filter((category) => !category.visible).length,
  uniqueImageCount: groupsByImage.size,
  validWebpFileCount: new Set(
    categories
      .filter((category) => category.file.exists && category.file.isWebp)
      .map((category) => category.imageUrl),
  ).size,
  failureCount: categories.reduce((sum, category) => sum + category.failureCount, 0),
  warningCount: categories.reduce((sum, category) => sum + category.warningCount, 0),
  sharedImageGroupCount: sharedImageGroups.length,
  categories,
  sharedImageGroups,
  sources: {
    catalogPath,
    categoryImageFolder: path.join(root, "public", "uploads", "category-images"),
  },
  recommendations: {
    imageFormat: "webp",
    targetRatio: "16/10",
    minWidth: minRecommendedWidth,
    minHeight: minRecommendedHeight,
    maxRecommendedBytes,
    noMarketplaceLogo: true,
    noBrandLogoUnlessOwned: true,
  },
  safety: {
    readOnly: true,
    noImageGeneration: true,
    noImageDownload: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

const jsonPath = path.join(outputDir, `AUDIT_IMAGES_CATEGORIES_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_IMAGES_CATEGORIES_${dateKey}.md`);
const csvPath = path.join(outputDir, `AUDIT_IMAGES_CATEGORIES_${dateKey}.csv`);
const manifestPath = path.join(outputDir, `MANIFEST_PRODUCTION_IMAGES_CATEGORIES_${dateKey}.md`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(summary), "utf8");
fs.writeFileSync(manifestPath, productionManifestMarkdown(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      categoryCount: summary.categoryCount,
      visibleCategoryCount: summary.visibleCategoryCount,
      hiddenCategoryCount: summary.hiddenCategoryCount,
      uniqueImageCount: summary.uniqueImageCount,
      validWebpFileCount: summary.validWebpFileCount,
      failureCount: summary.failureCount,
      warningCount: summary.warningCount,
      sharedImageGroupCount: summary.sharedImageGroupCount,
      files: {
        jsonPath,
        mdPath,
        csvPath,
        manifestPath,
      },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

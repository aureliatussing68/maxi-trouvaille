import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessDir = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessDir, "tableaux-action");
const dropRoot = path.join(businessDir, "depots-photos");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

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

function expectedFileName(task) {
  const fromPublicUrl = String(task.targetPublicUrl ?? "")
    .split("/")
    .filter(Boolean)
    .pop();
  if (fromPublicUrl) {
    return fromPublicUrl;
  }

  return `image-${String(task.order ?? 0).padStart(2, "0")}-${slugify(task.role)}.webp`;
}

function inspectWebp(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      isWebp: false,
      status: "missing",
      bytes: 0,
    };
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    return {
      exists: true,
      isWebp: false,
      status: "not_a_file",
      bytes: 0,
    };
  }

  const header = Buffer.alloc(12);
  const fd = fs.openSync(filePath, "r");
  const bytesRead = fs.readSync(fd, header, 0, 12, 0);
  fs.closeSync(fd);

  const isWebp =
    bytesRead >= 12 &&
    header.subarray(0, 4).toString("ascii") === "RIFF" &&
    header.subarray(8, 12).toString("ascii") === "WEBP";

  return {
    exists: true,
    isWebp,
    status: isWebp ? "present_valid_webp_signature" : "present_invalid_webp_signature",
    bytes: stat.size,
  };
}

function extraFiles(productDir, allowedNames) {
  if (!fs.existsSync(productDir)) {
    return [];
  }

  return fs
    .readdirSync(productDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name !== "A_DEPOSER_ICI.md" && !allowedNames.has(name))
    .sort();
}

function productReadme(product) {
  const rows = product.imageTasks.map(
    (task) =>
      `| ${task.order} | ${mdCell(task.expectedFileName)} | ${mdCell(task.role)} | ${mdCell(task.requiredShot)} | ${mdCell(task.stagingStatus)} | ${mdCell(task.targetPublicUrl)} |`,
  );

  return `${[
    `# Depot photos - ${product.productName}`,
    "",
    "Ce dossier sert uniquement a deposer les WebP exacts avant controle. Il ne publie rien sur le site.",
    "",
    `Produit: ${product.productId}`,
    `Statut passerelle: ${product.humanGateStatus}`,
    `Dossier cible public apres validation: ${product.targetFolderPublic}`,
    "",
    "## Fichiers attendus ici",
    "",
    "| Ordre | Nom exact a deposer | Role | Photo/preuve attendue | Statut actuel | Destination publique future |",
    "|---:|---|---|---|---|---|",
    ...rows,
    "",
    "## Regles",
    "",
    "- deposer uniquement des fichiers `.webp` avec les noms exacts ci-dessus;",
    "- utiliser une photo du produit exact ou une image dont les droits sont prouves;",
    "- ne pas ajouter de logo fournisseur, marketplace ou marque trompeuse;",
    "- ne pas laisser croire qu'un accessoire non inclus est vendu;",
    "- garder la fiche en HOLD jusqu'a validation Mouss.",
    "",
    "## A ne pas faire",
    "",
    "- ne pas copier manuellement dans `public/uploads` sans controle;",
    "- ne pas publier;",
    "- ne pas commander fournisseur;",
    "- ne pas afficher AliExpress au client.",
    "",
  ].join("\n")}\n`;
}

function mainReadme(summary) {
  const productRows = summary.products.map(
    (product) =>
      `| ${product.rank} | ${mdCell(product.productName)} | ${product.imageCount} | ${product.presentValidWebpCount} | ${mdCell(product.dropFolderRelative)} |`,
  );

  return `${[
    "# Maxi Trouvailles - Kit depot photos sprint",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Produits avec dossier depot: ${summary.productCount}`,
    `- WebP attendus: ${summary.expectedImageCount}`,
    `- WebP presents et valides dans ce depot: ${summary.presentValidWebpCount}`,
    `- Fichiers presents avec signature invalide: ${summary.invalidStagingFileCount}`,
    `- Fichiers hors liste: ${summary.extraFileCount}`,
    "- Copie vers public/uploads: aucune",
    "- Publication: aucune",
    "",
    "## Dossiers produits",
    "",
    "| Rang | Produit | WebP attendus | WebP valides deja presents | Dossier depot |",
    "|---:|---|---:|---:|---|",
    ...productRows,
    "",
    "## Mode d'emploi",
    "",
    "1. Ouvrir le dossier produit dans `business-maxi-trouvailles/depots-photos`.",
    "2. Utiliser `ORDRE_TRAVAIL_PHOTOS_MANQUANTES_*.md` pour traiter seulement les WebP absents ou invalides.",
    "3. Exporter les photos exactes en WebP.",
    "4. Renommer chaque fichier avec le nom exact indique dans `A_DEPOSER_ICI.md`.",
    "5. Relancer `npm run catalog:photo-drop-kit` pour controler les signatures WebP.",
    "6. Garder les produits en HOLD tant que droits, variante exacte et validation Mouss ne sont pas remplis.",
    "",
    "## Source",
    "",
    `- Sprint photo du jour: ${summary.sources.photoSprintPath}`,
    "",
  ].join("\n")}\n`;
}

function checklist(summary) {
  const blocks = summary.products.flatMap((product) => [
    `## ${product.rank}. ${product.productName}`,
    "",
    `Dossier depot: ${product.dropFolderRelative}`,
    "",
    ...product.imageTasks.flatMap((task) => [
      `### ${product.rank}.${task.order} - ${task.expectedFileName}`,
      "",
      `Role: ${task.role}`,
      `A photographier/verifier: ${task.requiredShot}`,
      `Destination future: ${task.targetPublicUrl}`,
      "",
      "- [ ] fichier WebP depose avec le nom exact",
      "- [ ] signature WebP valide",
      "- [ ] produit exact visible",
      "- [ ] variante exacte confirmee",
      "- [ ] droits image ou photo propre confirmes",
      "- [ ] aucun accessoire trompeur",
      "- [ ] validation Mouss avant toute copie publique",
      "",
    ]),
  ]);

  return `${[
    "# Checklist avant copie publique - Photos sprint",
    "",
    "Cette checklist ne donne pas le droit de publier. Elle sert a verifier le depot avant une future validation humaine.",
    "",
    ...blocks,
  ].join("\n")}\n`;
}

function missingPhotoTasks(summary) {
  return summary.products.flatMap((product) =>
    product.imageTasks
      .filter((task) => !task.stagingWebpValid)
      .map((task) => ({
        productRank: product.rank,
        productId: product.productId,
        productName: product.productName,
        categoryId: product.categoryId,
        order: task.order,
        expectedFileName: task.expectedFileName,
        role: task.role,
        requiredShot: task.requiredShot,
        stagingStatus: task.stagingStatus,
        stagingRelativePath: task.stagingRelativePath,
        dropFolderRelative: product.dropFolderRelative,
        targetPublicUrl: task.targetPublicUrl,
        targetAbsolutePath: task.targetAbsolutePath,
        action:
          task.stagingStatus === "missing"
            ? "Deposer le WebP exact avec ce nom."
            : "Remplacer par un WebP exact avec signature valide.",
      })),
  );
}

function missingPhotoWorkOrder(summary) {
  const tasks = missingPhotoTasks(summary);
  const productRows = summary.products.map((product) => {
    const missingCount = product.imageTasks.filter((task) => !task.stagingWebpValid)
      .length;
    return `| ${product.rank} | ${mdCell(product.productName)} | ${missingCount}/${product.imageCount} | ${mdCell(product.dropFolderRelative)} |`;
  });
  const taskBlocks = tasks.flatMap((task, index) => [
    `## ${index + 1}. ${task.productName}`,
    "",
    `Fichier exact attendu: ${task.expectedFileName}`,
    "",
    `Dossier depot: ${task.dropFolderRelative}`,
    "",
    `Role image: ${task.role}`,
    "",
    `Photo a produire: ${task.requiredShot}`,
    "",
    `Etat actuel: ${task.stagingStatus}`,
    "",
    `Action: ${task.action}`,
    "",
    "- [ ] image du produit exact",
    "- [ ] bonne variante uniquement",
    "- [ ] WebP renomme avec le nom exact",
    "- [ ] droits image ou photo propre confirmes",
    "- [ ] aucune copie publique avant revue humaine",
    "",
  ]);

  return `${[
    "# Ordre de travail - Photos produit manquantes",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "Ce document liste uniquement les WebP absents ou invalides dans le depot photo. Il ne publie rien.",
    "",
    "## Synthese",
    "",
    `- Produits concernes: ${summary.productCount}`,
    `- WebP exacts a produire ou corriger: ${tasks.length}`,
    `- WebP valides deja presents: ${summary.presentValidWebpCount}`,
    `- Fichiers invalides: ${summary.invalidStagingFileCount}`,
    `- Fichiers hors liste: ${summary.extraFileCount}`,
    "",
    "## Vue par produit",
    "",
    "| Rang | Produit | Manquants ou invalides | Dossier depot |",
    "|---:|---|---:|---|",
    ...productRows,
    "",
    tasks.length ? "## Travail a faire" : "## Travail a faire",
    "",
    ...(tasks.length
      ? taskBlocks
      : ["Aucun WebP manquant ou invalide dans le depot courant.", ""]),
    "## Rappel HOLD",
    "",
    "- garder les fiches en HOLD;",
    "- relancer `npm run catalog:photo-drop-kit` apres depot;",
    "- relancer `npm run catalog:audit-photo-checklist`; puis `npm run catalog:audit-sprint-image-human-review`;",
    "- attendre validation Mouss avant toute copie publique.",
    "",
  ].join("\n")}\n`;
}

function missingPhotoWorkOrderCsv(summary) {
  const headers = [
    "priority",
    "productRank",
    "productId",
    "productName",
    "imageOrder",
    "expectedFileName",
    "role",
    "requiredShot",
    "stagingStatus",
    "stagingRelativePath",
    "dropFolderRelative",
    "action",
  ];
  const rows = missingPhotoTasks(summary).map((task, index) => ({
    priority: index + 1,
    imageOrder: task.order,
    ...task,
  }));

  return `${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
    .join("\n")}\n`;
}

function csv(summary) {
  const headers = [
    "productRank",
    "productId",
    "productName",
    "imageOrder",
    "expectedFileName",
    "role",
    "requiredShot",
    "stagingStatus",
    "stagingRelativePath",
    "targetPublicUrl",
    "targetAbsolutePath",
  ];
  const rows = summary.products.flatMap((product) =>
    product.imageTasks.map((task) => ({
      productRank: product.rank,
      productId: product.productId,
      productName: product.productName,
      imageOrder: task.order,
      expectedFileName: task.expectedFileName,
      role: task.role,
      requiredShot: task.requiredShot,
      stagingStatus: task.stagingStatus,
      stagingRelativePath: task.stagingRelativePath,
      targetPublicUrl: task.targetPublicUrl,
      targetAbsolutePath: task.targetAbsolutePath,
    })),
  );

  return `${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
    .join("\n")}\n`;
}

const photoSprintPath = latestFile("PHOTO_SPRINT_DU_JOUR_", "PHOTO_SPRINT_DU_JOUR_*.json");
const photoSprint = readJson(photoSprintPath);
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(dropRoot, `depot-photos-sprint-${dateKey}`);
const productsDir = path.join(outputDir, "produits");

fs.mkdirSync(productsDir, { recursive: true });

const products = (photoSprint.products ?? []).map((product) => {
  const folderName = `${String(product.rank).padStart(2, "0")}-${slugify(product.productName)}`;
  const productDir = path.join(productsDir, folderName);
  fs.mkdirSync(productDir, { recursive: true });

  const imageTasks = (product.imageTasks ?? []).map((task) => {
    const fileName = expectedFileName(task);
    const stagingAbsolutePath = path.join(productDir, fileName);
    const staging = inspectWebp(stagingAbsolutePath);
    return {
      order: task.order,
      productId: task.productId,
      productName: task.productName,
      role: task.role,
      requiredShot: task.requiredShot,
      expectedFileName: fileName,
      stagingAbsolutePath,
      stagingRelativePath: relativePath(stagingAbsolutePath),
      stagingStatus: staging.status,
      stagingFilePresent: staging.exists,
      stagingWebpValid: staging.isWebp,
      stagingBytes: staging.bytes,
      targetPublicUrl: task.targetPublicUrl,
      targetAbsolutePath: task.targetAbsolutePath,
      currentGateStatus: task.currentGateStatus,
      keepHoldUntil: task.keepHoldUntil ?? [],
    };
  });

  const allowedNames = new Set(imageTasks.map((task) => task.expectedFileName));
  const extras = extraFiles(productDir, allowedNames);
  const preparedProduct = {
    rank: product.rank,
    productId: product.productId,
    productName: product.productName,
    categoryId: product.categoryId,
    targetFolderPublic: product.targetFolderPublic,
    humanGateStatus: product.humanGateStatus,
    dropFolderAbsolute: productDir,
    dropFolderRelative: relativePath(productDir),
    imageCount: imageTasks.length,
    presentValidWebpCount: imageTasks.filter((task) => task.stagingWebpValid).length,
    invalidStagingFileCount: imageTasks.filter((task) => task.stagingFilePresent && !task.stagingWebpValid).length,
    extraFiles: extras,
    imageTasks,
  };

  fs.writeFileSync(path.join(productDir, "A_DEPOSER_ICI.md"), productReadme(preparedProduct), "utf8");
  return preparedProduct;
});

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "manual_photo_drop_kit_no_public_copy",
  productCount: products.length,
  expectedImageCount: products.reduce((sum, product) => sum + product.imageCount, 0),
  presentValidWebpCount: products.reduce((sum, product) => sum + product.presentValidWebpCount, 0),
  invalidStagingFileCount: products.reduce((sum, product) => sum + product.invalidStagingFileCount, 0),
  extraFileCount: products.reduce((sum, product) => sum + product.extraFiles.length, 0),
  missingImageCount: products.reduce(
    (sum, product) =>
      sum + product.imageTasks.filter((task) => !task.stagingWebpValid).length,
    0,
  ),
  outputDir,
  outputDirRelative: relativePath(outputDir),
  products,
  sources: {
    photoSprintPath,
  },
  safety: {
    noPublicUploadsWrite: true,
    noImageDownload: true,
    noImageGeneration: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    manualValidationRequired: true,
  },
};

const manifestPath = path.join(outputDir, `MANIFEST_DEPOT_PHOTOS_SPRINT_${dateKey}.json`);
const readmePath = path.join(outputDir, `A_LIRE_DEPOT_PHOTOS_SPRINT_${dateKey}.md`);
const checklistPath = path.join(outputDir, `CHECKLIST_AVANT_COPIE_PHOTOS_${dateKey}.md`);
const csvPath = path.join(outputDir, `NOMS_FICHIERS_ATTENDUS_PHOTOS_${dateKey}.csv`);
const workOrderMdPath = path.join(outputDir, `ORDRE_TRAVAIL_PHOTOS_MANQUANTES_${dateKey}.md`);
const workOrderCsvPath = path.join(outputDir, `ORDRE_TRAVAIL_PHOTOS_MANQUANTES_${dateKey}.csv`);
const workOrderJsonPath = path.join(outputDir, `ORDRE_TRAVAIL_PHOTOS_MANQUANTES_${dateKey}.json`);
const workOrder = {
  ok: true,
  generatedAt: summary.generatedAt,
  generatedAtLocal: summary.generatedAtLocal,
  mode: "manual_missing_photo_work_order_no_public_copy",
  missingImageCount: summary.missingImageCount,
  tasks: missingPhotoTasks(summary),
  sources: {
    manifestPath: relativePath(manifestPath),
  },
  safety: summary.safety,
};

fs.writeFileSync(manifestPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(readmePath, mainReadme(summary), "utf8");
fs.writeFileSync(checklistPath, checklist(summary), "utf8");
fs.writeFileSync(csvPath, csv(summary), "utf8");
fs.writeFileSync(workOrderMdPath, missingPhotoWorkOrder(summary), "utf8");
fs.writeFileSync(workOrderCsvPath, missingPhotoWorkOrderCsv(summary), "utf8");
fs.writeFileSync(workOrderJsonPath, `${JSON.stringify(workOrder, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      productCount: summary.productCount,
      expectedImageCount: summary.expectedImageCount,
      presentValidWebpCount: summary.presentValidWebpCount,
      missingImageCount: summary.missingImageCount,
      invalidStagingFileCount: summary.invalidStagingFileCount,
      extraFileCount: summary.extraFileCount,
      files: {
        manifestPath,
        readmePath,
        checklistPath,
        csvPath,
        workOrderMdPath,
        workOrderCsvPath,
        workOrderJsonPath,
        productsDir,
      },
      products: products.map((product) => ({
        productId: product.productId,
        productName: product.productName,
        imageCount: product.imageCount,
        presentValidWebpCount: product.presentValidWebpCount,
        dropFolder: product.dropFolderRelative,
      })),
      safety: summary.safety,
    },
    null,
    2,
  ),
);

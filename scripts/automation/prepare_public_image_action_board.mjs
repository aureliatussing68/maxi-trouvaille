import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const outputRoot = actionRoot;

const imageBlockerIds = new Set([
  "exact_images_not_verified",
  "image_rights_not_ready",
  "image_missing",
  "image_remote_not_local",
  "supplier_cdn_image",
  "stock_visual_image",
  "image_not_exact_product_photo",
  "placeholder_or_hold_image",
  "image_not_in_exact_product_depot",
  "image_not_webp",
]);

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

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

function latestDirectoryUnder(dirPath, prefix) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return null;
  }

  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => path.join(dirPath, entry.name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] ?? null;
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

function isLocalPartnerWebp(image) {
  return /^\/uploads\/partner-products\/[^?#]+\.webp(?:\?.*)?$/i.test(
    String(image ?? ""),
  );
}

function safeImageLabel(image) {
  const value = String(image ?? "");

  if (/^https?:\/\//i.test(value)) {
    return "[image distante masquee]";
  }

  return value || "[image absente]";
}

function imageBlockers(product) {
  return (product.publicationBlockers ?? []).filter((blocker) =>
    imageBlockerIds.has(blocker),
  );
}

function laneFor(blockers) {
  if (
    blockers.some((blocker) =>
      [
        "image_remote_not_local",
        "supplier_cdn_image",
        "stock_visual_image",
        "image_not_exact_product_photo",
        "placeholder_or_hold_image",
        "image_not_in_exact_product_depot",
        "image_not_webp",
      ].includes(blocker),
    )
  ) {
    return "REMPLACER_IMAGE";
  }

  if (blockers.includes("exact_images_not_verified")) {
    return "PROUVER_IMAGE_LOCALE";
  }

  if (blockers.includes("image_rights_not_ready")) {
    return "PROUVER_DROITS_IMAGE";
  }

  return "CONTROLER_IMAGE";
}

function priorityFor(product, blockers) {
  const urgentBlockers = [
    "image_remote_not_local",
    "supplier_cdn_image",
    "image_not_exact_product_photo",
    "placeholder_or_hold_image",
    "image_not_webp",
  ];
  const urgentScore = blockers.some((blocker) => urgentBlockers.includes(blocker)) ? 0 : 20;
  const staticBoost = product.origin === "src/lib/catalog.ts" ? 0 : 5;
  const categoryBoost = product.categoryId?.includes("high-tech") ? 0 : 3;

  return urgentScore + staticBoost + categoryBoost + blockers.length;
}

function targetPaths(product) {
  const safeSlug = slugSafe(product.slug || product.id || product.name);
  const publicPath = isLocalPartnerWebp(product.image)
    ? product.image
    : `/uploads/partner-products/${safeSlug}.webp`;
  const localPath = `public${publicPath}`.replace(/\//g, path.sep);
  const proofFolder = path.join(
    "business-maxi-trouvailles",
    "preuves-images-publiques",
    safeSlug,
  );

  return {
    safeSlug,
    publicPath,
    localPath,
    proofFolder,
    proofChecklistPath: path.join(proofFolder, `PREUVE_IMAGE_${safeSlug}.md`),
  };
}

function nextActionFor(lane) {
  switch (lane) {
    case "REMPLACER_IMAGE":
      return "Deposer une photo WebP locale du meme article exact, puis garder HOLD jusqu a revue humaine.";
    case "PROUVER_IMAGE_LOCALE":
      return "Verifier que le WebP local represente le produit exact, la variante et la galerie attendue.";
    case "PROUVER_DROITS_IMAGE":
      return "Ajouter la preuve de droit image ou remplacer par une photo propre Maxi Trouvaille.";
    default:
      return "Controler photo, droits, variante et validation Mouss avant toute publication.";
  }
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  const headers = [
    "priority",
    "lane",
    "name",
    "slug",
    "categoryId",
    "status",
    "imageBlockers",
    "currentImage",
    "targetPublicPath",
    "targetLocalPath",
    "proofChecklistPath",
    "nextAction",
  ];

  return `${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
    .join("\n")}\n`;
}

function markdown(summary) {
  const rows =
    summary.items.length === 0
      ? ["| - | EMPTY | Aucun produit image a corriger | - | - |"]
      : summary.items.slice(0, 30).map(
          (item) =>
            `| ${item.priority} | ${item.lane} | ${item.name} | ${item.targetPublicPath} | ${item.nextAction} |`,
        );

  return `${[
    "# Maxi Trouvailles - Board images publiques exactes",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Source audit: ${summary.sourceAudit}`,
    "",
    "## Synthese",
    "",
    `- Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    `- Produits image a traiter: ${summary.itemCount}`,
    `- Remplacements image: ${summary.counts.REMPLACER_IMAGE ?? 0}`,
    `- Preuves image locale: ${summary.counts.PROUVER_IMAGE_LOCALE ?? 0}`,
    `- Preuves droits image: ${summary.counts.PROUVER_DROITS_IMAGE ?? 0}`,
    "",
    "## Priorites",
    "",
    "| Priorite | Lane | Produit | WebP cible | Action |",
    "|---:|---|---|---|---|",
    ...rows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule cote catalogue.",
    "- Aucun telechargement image.",
    "- Aucune publication.",
    "- Aucun paiement.",
    "- Aucune commande fournisseur.",
    "- Les chemins cibles restent dans `public/uploads/partner-products`.",
    "",
  ].join("\n")}\n`;
}

function workcard(item) {
  return `${[
    `# Fiche terrain image exacte - ${item.name}`,
    "",
    `Produit: ${item.name}`,
    `Slug: ${item.slug}`,
    `Categorie: ${item.categoryId}`,
    `Statut catalogue: ${item.status}`,
    `Lane: ${item.lane}`,
    `Image actuelle: ${item.currentImage}`,
    `WebP public cible: ${item.targetPublicPath}`,
    `Chemin local cible: ${item.targetLocalPath}`,
    "",
    "## Checklist avant revue",
    "",
    "- Meme article exact que la fiche.",
    "- Meme variante vendue: couleur, taille, lot et accessoire inclus.",
    "- Fichier WebP local lisible.",
    "- Droits image prouves ou photo propre Maxi Trouvaille.",
    "- Aucun logo ou watermark fournisseur visible.",
    "- Validation humaine Mouss avant publication.",
    "",
    "## Commandes apres depot",
    "",
    "```powershell",
    "npm run catalog:test-public-image-contract",
    "npm run catalog:audit-public-dropshipping-surface",
    "npm run catalog:hold-public-unverified-images",
    "npm run catalog:audit-checkout-eligibility",
    "```",
    "",
  ].join("\n")}\n`;
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] ?? 0) + 1;
    return acc;
  }, {});
}

const latestAuditPath = latestFileUnder(
  latestDirectoryUnder(actionRoot, "surface-publique-dropshipping-"),
  "AUDIT_SURFACE_PUBLIQUE_DROPSHIPPING_",
);

if (!latestAuditPath) {
  throw new Error("Aucun audit surface publique dropshipping trouve.");
}

const surfaceAudit = readJson(latestAuditPath, {});
const candidateProducts = Array.isArray(surfaceAudit.productAudits)
  ? surfaceAudit.productAudits
  : [];
const items = candidateProducts
  .map((product) => {
    const blockers = imageBlockers(product);
    if (blockers.length === 0) {
      return null;
    }

    const targets = targetPaths(product);
    const lane = laneFor(blockers);

    return {
      priority: priorityFor(product, blockers),
      lane,
      id: product.id,
      slug: product.slug,
      name: product.name,
      origin: product.origin,
      categoryId: product.categoryId,
      status: product.status,
      visible: Boolean(product.visible),
      purchasable: Boolean(product.purchasable),
      imageBlockers: blockers,
      currentImage: safeImageLabel(product.image),
      targetPublicPath: targets.publicPath,
      targetLocalPath: targets.localPath,
      proofFolder: targets.proofFolder,
      proofChecklistPath: targets.proofChecklistPath,
      nextAction: nextActionFor(lane),
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name, "fr"));

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(outputRoot, `public-image-action-board-${dateKey}`);
const workcardsDir = path.join(outputDir, "fiches-terrain");
fs.mkdirSync(workcardsDir, { recursive: true });

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_public_image_action_board",
  sourceAudit: path.relative(root, latestAuditPath).replace(/\\/g, "/"),
  itemCount: items.length,
  counts: countBy(items, "lane"),
  topItems: items.slice(0, 12),
  items,
  safety: {
    readOnly: true,
    noCatalogWrite: true,
    noImageDownload: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    redactedRemoteImages: true,
  },
};

const jsonPath = path.join(outputDir, `PUBLIC_IMAGE_ACTION_BOARD_${dateKey}.json`);
const mdPath = path.join(outputDir, `PUBLIC_IMAGE_ACTION_BOARD_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-images-publiques-a-corriger-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, toCsv(items), "utf8");

for (const item of items.slice(0, 12)) {
  const filePath = path.join(workcardsDir, `IMAGE_${slugSafe(item.slug)}.md`);
  fs.writeFileSync(filePath, workcard(item), "utf8");
}

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      itemCount: summary.itemCount,
      counts: summary.counts,
      files: { jsonPath, mdPath, csvPath, workcardsDir },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

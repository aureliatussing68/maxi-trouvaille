import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessDir = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessDir, "tableaux-action");
const partnerUploadsRoot = path.resolve(root, "public", "uploads", "partner-products");
const minimumWebpBytes = 4096;

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

function csvEscape(value) {
  const normalized = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${normalized.replace(/"/g, '""')}"`;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function targetPathFromImage(image) {
  if (image.targetAbsolutePath) {
    return path.resolve(image.targetAbsolutePath);
  }

  const publicUrl = String(image.targetPublicUrl ?? "");
  if (!publicUrl.startsWith("/")) {
    return "";
  }

  return path.resolve(root, "public", publicUrl.replace(/^\//, ""));
}

function isInsidePartnerUploads(filePath) {
  const relative = path.relative(partnerUploadsRoot, filePath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function hasWebpSignature(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 12) {
    return false;
  }

  return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
}

function auditImage(product, image) {
  const targetAbsolutePath = targetPathFromImage(image);
  const failures = [];
  const blockers = [];
  const exists = targetAbsolutePath ? fs.existsSync(targetAbsolutePath) : false;
  let sizeBytes = 0;
  let webpSignatureOk = false;

  if (!targetAbsolutePath) {
    failures.push("chemin_local_cible_absent");
  } else {
    if (!isInsidePartnerUploads(targetAbsolutePath)) {
      failures.push("chemin_hors_uploads_partner_products");
    }
    if (path.extname(targetAbsolutePath).toLowerCase() !== ".webp") {
      failures.push("extension_non_webp");
    }
  }

  if (!exists) {
    blockers.push("fichier_local_manquant");
  } else {
    const stat = fs.statSync(targetAbsolutePath);
    sizeBytes = stat.size;
    if (sizeBytes < minimumWebpBytes) {
      failures.push("fichier_webp_trop_leger");
    }
    webpSignatureOk = hasWebpSignature(targetAbsolutePath);
    if (!webpSignatureOk) {
      failures.push("signature_webp_invalide");
    }
  }

  const status = failures.length
    ? "BLOCK_INVALID_LOCAL_FILE"
    : exists
      ? "LOCAL_FILE_PRESENT"
      : "HOLD_LOCAL_FILE_MISSING";

  return {
    productId: product.productId,
    productName: product.productName,
    imageIndex: image.index,
    role: image.role,
    targetPublicUrl: image.targetPublicUrl,
    targetAbsolutePath,
    exists,
    sizeBytes,
    webpSignatureOk,
    status,
    failures,
    blockers,
  };
}

function auditProduct(product) {
  const images = product.images.map((image) => auditImage(product, image));
  const hardFailureCount = images.reduce((sum, image) => sum + image.failures.length, 0);
  const missingLocalFileCount = images.filter((image) => image.status === "HOLD_LOCAL_FILE_MISSING").length;
  const presentLocalFileCount = images.filter((image) => image.status === "LOCAL_FILE_PRESENT").length;
  const invalidLocalFileCount = images.filter((image) => image.status === "BLOCK_INVALID_LOCAL_FILE").length;
  let status = "LOCAL_FILES_READY_FOR_DECISION_AUDIT";

  if (hardFailureCount > 0) {
    status = "BLOCK_INVALID_LOCAL_FILES";
  } else if (missingLocalFileCount > 0) {
    status = "HOLD_LOCAL_FILES_MISSING";
  } else if (product.actionMode === "HOLD_OR_REPLACE_FIRST") {
    status = "HOLD_COMPATIBILITY_PROOF_REQUIRED";
  }

  return {
    productId: product.productId,
    productName: product.productName,
    actionMode: product.actionMode,
    fieldPriority: product.fieldPriority,
    status,
    imageCount: product.images.length,
    presentLocalFileCount,
    missingLocalFileCount,
    invalidLocalFileCount,
    hardFailureCount,
    images,
  };
}

function markdown(summary) {
  const rows = summary.products.map(
    (product) =>
      `| ${mdCell(product.productName)} | ${mdCell(product.status)} | ${product.presentLocalFileCount}/${product.imageCount} | ${product.missingLocalFileCount} | ${product.invalidLocalFileCount} |`,
  );

  return `${[
    "# Maxi Trouvailles - Audit fichiers locaux images sprint",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Produits controles: ${summary.productCount}`,
    `- Fichiers attendus: ${summary.expectedLocalFileCount}`,
    `- Fichiers presents: ${summary.presentLocalFileCount}`,
    `- Fichiers manquants: ${summary.missingLocalFileCount}`,
    `- Fichiers invalides: ${summary.invalidLocalFileCount}`,
    `- Produits candidats revue locale: ${summary.localReviewCandidateCount}`,
    `- Echecs durs: ${summary.hardFailureCount}`,
    "",
    "## Tableau",
    "",
    "| Produit | Statut | Presents | Manquants | Invalides |",
    "|---|---|---:|---:|---:|",
    ...rows,
    "",
    "## Regles controlees",
    "",
    "- Chemin obligatoire dans `public/uploads/partner-products`.",
    "- Extension `.webp` obligatoire.",
    `- Taille minimale: ${summary.minimumWebpBytes} octets.`,
    "- Signature WebP `RIFF/WEBP` obligatoire si le fichier existe.",
    "- Les fichiers manquants gardent la fiche en HOLD, sans echec dur.",
    "",
    "## Sources",
    "",
    `- Checklist terrain: ${summary.sources.checklistPath}`,
    "",
  ].join("\n")}\n`;
}

function csv(summary) {
  const headers = [
    "productId",
    "productName",
    "productStatus",
    "imageIndex",
    "role",
    "imageStatus",
    "exists",
    "sizeBytes",
    "webpSignatureOk",
    "targetPublicUrl",
    "failures",
    "blockers",
  ];
  const rows = summary.products.flatMap((product) =>
    product.images.map((image) => ({
      productId: product.productId,
      productName: product.productName,
      productStatus: product.status,
      imageIndex: image.imageIndex,
      role: image.role,
      imageStatus: image.status,
      exists: image.exists,
      sizeBytes: image.sizeBytes,
      webpSignatureOk: image.webpSignatureOk,
      targetPublicUrl: image.targetPublicUrl,
      failures: image.failures,
      blockers: image.blockers,
    })),
  );

  return `${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
    .join("\n")}\n`;
}

const checklistPath = latestFile("CHECKLIST_TERRAIN_IMAGES_SPRINT_", "CHECKLIST_TERRAIN_IMAGES_SPRINT_*.json");
const checklist = readJson(checklistPath);
const products = (checklist.products ?? []).map(auditProduct);

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `audit-fichiers-locaux-images-sprint-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: products.every((product) => product.hardFailureCount === 0),
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_sprint_image_local_file_audit",
  productCount: products.length,
  expectedLocalFileCount: products.reduce((sum, product) => sum + product.imageCount, 0),
  presentLocalFileCount: products.reduce((sum, product) => sum + product.presentLocalFileCount, 0),
  missingLocalFileCount: products.reduce((sum, product) => sum + product.missingLocalFileCount, 0),
  invalidLocalFileCount: products.reduce((sum, product) => sum + product.invalidLocalFileCount, 0),
  localReviewCandidateCount: products.filter((product) => product.status === "LOCAL_FILES_READY_FOR_DECISION_AUDIT").length,
  hardFailureCount: products.reduce((sum, product) => sum + product.hardFailureCount, 0),
  minimumWebpBytes,
  products,
  sources: {
    checklistPath,
  },
  safety: {
    readOnly: true,
    noImageDownload: true,
    noImageGeneration: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

const jsonPath = path.join(outputDir, `AUDIT_FICHIERS_LOCAUX_IMAGES_SPRINT_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_FICHIERS_LOCAUX_IMAGES_SPRINT_${dateKey}.md`);
const csvPath = path.join(outputDir, `AUDIT_FICHIERS_LOCAUX_IMAGES_SPRINT_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      productCount: summary.productCount,
      expectedLocalFileCount: summary.expectedLocalFileCount,
      presentLocalFileCount: summary.presentLocalFileCount,
      missingLocalFileCount: summary.missingLocalFileCount,
      invalidLocalFileCount: summary.invalidLocalFileCount,
      localReviewCandidateCount: summary.localReviewCandidateCount,
      hardFailureCount: summary.hardFailureCount,
      files: {
        jsonPath,
        mdPath,
        csvPath,
      },
      products: products.map((product) => ({
        productId: product.productId,
        productName: product.productName,
        status: product.status,
        presentLocalFileCount: product.presentLocalFileCount,
        missingLocalFileCount: product.missingLocalFileCount,
        invalidLocalFileCount: product.invalidLocalFileCount,
      })),
      safety: summary.safety,
    },
    null,
    2,
  ),
);

if (!summary.ok) {
  process.exitCode = 1;
}

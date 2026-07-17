import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessDir = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessDir, "tableaux-action");

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

function imageStatusMap(product) {
  return new Map((product.images ?? []).map((image) => [Number(image.imageIndex), image]));
}

function productReadiness(localProduct, decisionProduct, checklistProduct) {
  const blockers = [];
  const failures = [];
  const localImages = imageStatusMap(localProduct);
  const decisionImages = imageStatusMap(decisionProduct);

  if (localProduct.hardFailureCount > 0) {
    failures.push("audit_fichiers_locaux_echec_dur");
  }
  if (decisionProduct.failureCount > 0) {
    failures.push("audit_decisions_echec_dur");
  }
  if (localProduct.status !== "LOCAL_FILES_READY_FOR_DECISION_AUDIT") {
    blockers.push("fichiers_webp_locaux_non_prets");
  }
  if (decisionProduct.status !== "READY_REVIEW_HOLD") {
    blockers.push("decisions_images_non_pretes");
  }
  if (checklistProduct?.actionMode === "HOLD_OR_REPLACE_FIRST") {
    blockers.push("produit_a_garder_hold_ou_remplacer_avant_revue");
  }

  const imageGates = [];
  const imageIndexes = new Set([...localImages.keys(), ...decisionImages.keys()]);

  for (const index of [...imageIndexes].sort((a, b) => a - b)) {
    const localImage = localImages.get(index);
    const decisionImage = decisionImages.get(index);
    const imageBlockers = [];
    const imageFailures = [];

    if (!localImage) {
      imageFailures.push("image_absente_audit_local");
    } else if (localImage.status !== "LOCAL_FILE_PRESENT") {
      imageBlockers.push("fichier_local_non_present");
    }

    if (!decisionImage) {
      imageFailures.push("image_absente_audit_decision");
    } else if (decisionImage.status !== "READY_REVIEW_HOLD") {
      imageBlockers.push("decision_image_non_prete");
    }

    imageGates.push({
      imageIndex: index,
      role: localImage?.role ?? decisionImage?.role ?? "",
      targetPublicUrl: localImage?.targetPublicUrl ?? decisionImage?.targetPublicUrl ?? "",
      localStatus: localImage?.status ?? "MISSING",
      decisionStatus: decisionImage?.status ?? "MISSING",
      status:
        imageFailures.length > 0
          ? "BLOCK_IMAGE_GATE_FAILURE"
          : imageBlockers.length > 0
            ? "HOLD_IMAGE_GATE"
            : "READY_IMAGE_HUMAN_REVIEW",
      failures: imageFailures,
      blockers: imageBlockers,
    });
  }

  const imageFailureCount = imageGates.reduce((sum, image) => sum + image.failures.length, 0);
  const imageBlockerCount = imageGates.reduce((sum, image) => sum + image.blockers.length, 0);
  const status =
    failures.length + imageFailureCount > 0
      ? "BLOCK_HUMAN_REVIEW_GATE"
      : blockers.length + imageBlockerCount > 0
        ? "HOLD_HUMAN_REVIEW_GATE"
        : "READY_HUMAN_REVIEW_HOLD";

  return {
    productId: localProduct.productId,
    productName: localProduct.productName,
    categoryId: checklistProduct?.categoryId ?? "",
    actionMode: checklistProduct?.actionMode ?? "",
    status,
    localFileStatus: localProduct.status,
    decisionStatus: decisionProduct.status,
    readyImageCount: imageGates.filter((image) => image.status === "READY_IMAGE_HUMAN_REVIEW").length,
    imageCount: imageGates.length,
    failureCount: failures.length + imageFailureCount,
    blockerCount: blockers.length + imageBlockerCount,
    failures,
    blockers,
    requiredBeforeHumanReview: [
      "tous les WebP locaux existent et sont valides",
      "chaque image a une decision READY_REVIEW_HOLD",
      "droits images documentes",
      "variante exacte confirmee",
      "validation Mouss presente",
      "aucun produit marque HOLD_OR_REPLACE_FIRST",
    ],
    imageGates,
  };
}

function markdown(summary) {
  const rows = summary.products.map(
    (product) =>
      `| ${mdCell(product.productName)} | ${mdCell(product.status)} | ${product.readyImageCount}/${product.imageCount} | ${product.failureCount} | ${product.blockerCount} |`,
  );

  return `${[
    "# Maxi Trouvailles - Passerelle revue humaine images sprint",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Produits controles: ${summary.productCount}`,
    `- Produits prets revue humaine: ${summary.readyHumanReviewCount}`,
    `- Produits HOLD revue humaine: ${summary.holdHumanReviewCount}`,
    `- Produits bloques erreur: ${summary.blockHumanReviewCount}`,
    `- Images pretes revue: ${summary.readyImageCount}/${summary.imageCount}`,
    `- Echecs durs: ${summary.hardFailureCount}`,
    `- Blocages HOLD: ${summary.blockerCount}`,
    "",
    "## Tableau",
    "",
    "| Produit | Statut | Images pretes | Echecs | Blocages |",
    "|---|---|---:|---:|---:|",
    ...rows,
    "",
    "## Conditions de passage",
    "",
    "- WebP locaux valides.",
    "- Decisions images en `READY_REVIEW_HOLD`.",
    "- Droits images documentes.",
    "- Variante exacte confirmee.",
    "- Validation Mouss presente.",
    "- Aucun produit auto/compatibilite en `HOLD_OR_REPLACE_FIRST`.",
    "",
    "## Sources",
    "",
    `- Audit fichiers locaux: ${summary.sources.localFilesAuditPath}`,
    `- Audit decisions images: ${summary.sources.decisionAuditPath}`,
    `- Checklist terrain: ${summary.sources.checklistPath}`,
    "",
  ].join("\n")}\n`;
}

function csv(summary) {
  const headers = [
    "productId",
    "productName",
    "status",
    "localFileStatus",
    "decisionStatus",
    "readyImageCount",
    "imageCount",
    "failureCount",
    "blockerCount",
    "failures",
    "blockers",
  ];

  return `${headers.join(",")}\n${summary.products
    .map((product) => headers.map((header) => csvEscape(product[header])).join(","))
    .join("\n")}\n`;
}

const localFilesAuditPath = latestFile(
  "AUDIT_FICHIERS_LOCAUX_IMAGES_SPRINT_",
  "AUDIT_FICHIERS_LOCAUX_IMAGES_SPRINT_*.json",
);
const decisionAuditPath = latestFile(
  "AUDIT_DECISIONS_REMPLACEMENT_IMAGES_SPRINT_",
  "AUDIT_DECISIONS_REMPLACEMENT_IMAGES_SPRINT_*.json",
);
const checklistPath = latestFile("CHECKLIST_TERRAIN_IMAGES_SPRINT_", "CHECKLIST_TERRAIN_IMAGES_SPRINT_*.json");

const localFilesAudit = readJson(localFilesAuditPath);
const decisionAudit = readJson(decisionAuditPath);
const checklist = readJson(checklistPath);
const decisionById = new Map((decisionAudit.products ?? []).map((product) => [product.productId, product]));
const checklistById = new Map((checklist.products ?? []).map((product) => [product.productId, product]));

const products = (localFilesAudit.products ?? []).map((localProduct) => {
  const decisionProduct = decisionById.get(localProduct.productId);
  if (!decisionProduct) {
    throw new Error(`Missing decision audit for ${localProduct.productId}`);
  }
  return productReadiness(localProduct, decisionProduct, checklistById.get(localProduct.productId));
});

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `passerelle-revue-humaine-images-sprint-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: products.every((product) => product.failureCount === 0),
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_sprint_image_human_review_readiness_gate",
  productCount: products.length,
  imageCount: products.reduce((sum, product) => sum + product.imageCount, 0),
  readyImageCount: products.reduce((sum, product) => sum + product.readyImageCount, 0),
  readyHumanReviewCount: products.filter((product) => product.status === "READY_HUMAN_REVIEW_HOLD").length,
  holdHumanReviewCount: products.filter((product) => product.status === "HOLD_HUMAN_REVIEW_GATE").length,
  blockHumanReviewCount: products.filter((product) => product.status === "BLOCK_HUMAN_REVIEW_GATE").length,
  hardFailureCount: products.reduce((sum, product) => sum + product.failureCount, 0),
  blockerCount: products.reduce((sum, product) => sum + product.blockerCount, 0),
  products,
  sources: {
    localFilesAuditPath,
    decisionAuditPath,
    checklistPath,
  },
  safety: {
    readOnly: true,
    noImageDownload: true,
    noImageGeneration: true,
    noCatalogWrite: true,
    noHumanApprovalByScript: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

const jsonPath = path.join(outputDir, `PASSERELLE_REVUE_HUMAINE_IMAGES_SPRINT_${dateKey}.json`);
const mdPath = path.join(outputDir, `PASSERELLE_REVUE_HUMAINE_IMAGES_SPRINT_${dateKey}.md`);
const csvPath = path.join(outputDir, `PASSERELLE_REVUE_HUMAINE_IMAGES_SPRINT_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      productCount: summary.productCount,
      readyHumanReviewCount: summary.readyHumanReviewCount,
      holdHumanReviewCount: summary.holdHumanReviewCount,
      blockHumanReviewCount: summary.blockHumanReviewCount,
      readyImageCount: summary.readyImageCount,
      imageCount: summary.imageCount,
      hardFailureCount: summary.hardFailureCount,
      blockerCount: summary.blockerCount,
      files: {
        jsonPath,
        mdPath,
        csvPath,
      },
      products: products.map((product) => ({
        productId: product.productId,
        productName: product.productName,
        status: product.status,
        localFileStatus: product.localFileStatus,
        decisionStatus: product.decisionStatus,
        readyImageCount: product.readyImageCount,
        imageCount: product.imageCount,
        blockerCount: product.blockerCount,
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

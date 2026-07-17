import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessDir = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessDir, "tableaux-action");
const quickProductsPath = path.join(root, "data", "quick-products.json");

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

function latestLocalPlanFile() {
  const matches = collectFiles(
    actionRoot,
    (name) => name.startsWith("PLAN_LOCAL_IMAGES_SPRINT_") && name.endsWith(".json"),
  )
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (matches.length === 0) {
    throw new Error(`No PLAN_LOCAL_IMAGES_SPRINT_*.json found under ${actionRoot}`);
  }

  return matches[0].fullPath;
}

function supplierImageHost(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    return host.includes("alicdn.com") || host.includes("aliexpress.com") || host.includes("alitools.io")
      ? host
      : "";
  } catch {
    return "";
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

const REMOTE_IMAGE_SOURCE_REDACTED = "REMOTE_IMAGE_SOURCE_REDACTED";
const REMOTE_IMAGE_HOST_REDACTED = "REMOTE_IMAGE_HOST_REDACTED";

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function currentImages(product) {
  if (!product) {
    return [];
  }

  return unique([product.image, ...(Array.isArray(product.images) ? product.images : [])]);
}

function refreshTargetImage(image) {
  const exists = fs.existsSync(image.targetAbsolutePath);
  const stat = exists ? fs.statSync(image.targetAbsolutePath) : null;
  return {
    ...image,
    exists,
    sizeBytes: stat?.size ?? null,
    ready: exists && (stat?.size ?? 0) >= 5000,
  };
}

function auditPlan(plan, product) {
  const images = currentImages(product);
  const supplierDomainImages = images
    .map((url) => supplierImageHost(url))
    .filter(Boolean)
    .map(() => ({
      url: REMOTE_IMAGE_SOURCE_REDACTED,
      host: REMOTE_IMAGE_HOST_REDACTED,
    }));
  const targetImages = plan.targetImages.map(refreshTargetImage);
  const targetPublicUrls = new Set(targetImages.map((image) => image.targetPublicUrl));
  const missingTargets = targetImages.filter((image) => !image.exists);
  const notReadyTargets = targetImages.filter((image) => !image.ready);
  const catalogImagesUsingTargets = images.filter((image) => targetPublicUrls.has(image));
  const blockers = [];

  if (!product) {
    blockers.push("produit_introuvable");
  }
  if (supplierDomainImages.length > 0) {
    blockers.push("catalogue_pointe_encore_vers_domaine_fournisseur");
  }
  if (missingTargets.length > 0) {
    blockers.push("fichiers_webp_locaux_manquants");
  }
  if (notReadyTargets.length > 0) {
    blockers.push("fichiers_webp_locaux_non_prets");
  }
  if (catalogImagesUsingTargets.length !== targetImages.length) {
    blockers.push("catalogue_pas_encore_aligne_sur_images_locales");
  }
  if (product?.image && !targetPublicUrls.has(product.image)) {
    blockers.push("image_principale_pas_locale_cible");
  }
  blockers.push("decision_droits_images_absente");

  const hardFailures =
    product?.status === "published" && supplierDomainImages.length > 0
      ? ["produit_publie_avec_domaine_image_fournisseur"]
      : [];

  return {
    id: plan.id,
    name: plan.name,
    status: product?.status ?? "missing",
    reviewGateStatus: blockers.length === 0 ? "READY_IMAGE_REVIEW_HOLD" : "BLOCK_REVIEW_IMAGE_GATE",
    reviewAllowed: blockers.length === 0,
    catalogUpdateAllowed: false,
    publicationAllowed: false,
    blockers: [...new Set(blockers)],
    hardFailures,
    currentImageCount: images.length,
    supplierDomainImageCount: supplierDomainImages.length,
    supplierDomainImages,
    targetImageCount: targetImages.length,
    missingLocalTargetCount: missingTargets.length,
    notReadyLocalTargetCount: notReadyTargets.length,
    catalogImagesUsingTargetsCount: catalogImagesUsingTargets.length,
    targetImages: targetImages.map((image) => ({
      index: image.index,
      role: image.role,
      targetPublicUrl: image.targetPublicUrl,
      exists: image.exists,
      ready: image.ready,
      sizeBytes: image.sizeBytes,
    })),
  };
}

function csv(items) {
  const headers = [
    "id",
    "name",
    "status",
    "reviewGateStatus",
    "reviewAllowed",
    "supplierDomainImageCount",
    "missingLocalTargetCount",
    "notReadyLocalTargetCount",
    "catalogImagesUsingTargetsCount",
    "blockers",
    "hardFailures",
  ];

  return `${headers.join(",")}\n${items
    .map((item) => headers.map((header) => csvEscape(item[header])).join(","))
    .join("\n")}\n`;
}

function markdown(summary) {
  const rows = summary.products.map(
    (item) =>
      `| ${mdCell(item.name)} | ${mdCell(item.status)} | ${mdCell(item.reviewGateStatus)} | ${item.supplierDomainImageCount} | ${item.missingLocalTargetCount} | ${item.catalogImagesUsingTargetsCount}/${item.targetImageCount} | ${mdCell(item.blockers.join(", "))} |`,
  );

  return `${[
    "# Maxi Trouvailles - Audit gates images sprint",
    "",
    `Date locale: ${summary.checkedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Produits controles: ${summary.productCount}`,
    `- Revue image autorisee: ${summary.reviewAllowedCount}`,
    `- Revue image bloquee: ${summary.blockedReviewCount}`,
    `- Images domaine fournisseur dans catalogue: ${summary.supplierDomainImageCount}`,
    `- Fichiers locaux manquants: ${summary.missingLocalTargetCount}`,
    `- Echecs durs: ${summary.hardFailureCount}`,
    "",
    "## Gates",
    "",
    "| Produit | Statut produit | Gate | Images fournisseur | Locaux manquants | Catalogue local | Bloquants |",
    "|---|---|---|---:|---:|---:|---|",
    ...rows,
    "",
    "## Regle",
    "",
    "- `BLOCK_REVIEW_IMAGE_GATE` bloque la revue humaine et la publication.",
    "- Un produit publie avec domaine fournisseur image serait un echec dur.",
    "- L'audit reste en lecture seule et ne modifie pas le catalogue.",
    "",
    "## Sources",
    "",
    `- Plan local images: ${summary.sources.localPlanPath}`,
    `- Catalogue brouillons rapides: ${summary.sources.quickProductsPath}`,
    "",
  ].join("\n")}\n`;
}

const localPlanPath = latestLocalPlanFile();
const localPlan = readJson(localPlanPath);
const quickProducts = readJson(quickProductsPath);
const productsById = new Map(quickProducts.map((product) => [product.id, product]));
const plans = Array.isArray(localPlan.products) ? localPlan.products : [];

if (plans.length === 0) {
  throw new Error("Local image plan must contain a non-empty products array.");
}

const auditedProducts = plans.map((plan) => auditPlan(plan, productsById.get(plan.id)));
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `audit-gates-images-sprint-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: auditedProducts.every((product) => product.hardFailures.length === 0),
  checkedAt: new Date().toISOString(),
  checkedAtLocal: localLabel,
  mode: "read_only_sprint_image_review_gate_audit",
  productCount: auditedProducts.length,
  reviewAllowedCount: auditedProducts.filter((product) => product.reviewAllowed).length,
  blockedReviewCount: auditedProducts.filter((product) => !product.reviewAllowed).length,
  supplierDomainImageCount: auditedProducts.reduce((sum, product) => sum + product.supplierDomainImageCount, 0),
  missingLocalTargetCount: auditedProducts.reduce((sum, product) => sum + product.missingLocalTargetCount, 0),
  hardFailureCount: auditedProducts.reduce((sum, product) => sum + product.hardFailures.length, 0),
  products: auditedProducts,
  sources: {
    localPlanPath,
    quickProductsPath,
  },
  safety: {
    readOnly: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

const jsonPath = path.join(outputDir, `AUDIT_GATES_IMAGES_SPRINT_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_GATES_IMAGES_SPRINT_${dateKey}.md`);
const csvPath = path.join(outputDir, `AUDIT_GATES_IMAGES_SPRINT_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(auditedProducts), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      productCount: summary.productCount,
      reviewAllowedCount: summary.reviewAllowedCount,
      blockedReviewCount: summary.blockedReviewCount,
      supplierDomainImageCount: summary.supplierDomainImageCount,
      missingLocalTargetCount: summary.missingLocalTargetCount,
      hardFailureCount: summary.hardFailureCount,
      files: { jsonPath, mdPath, csvPath },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

if (!summary.ok) {
  process.exitCode = 1;
}

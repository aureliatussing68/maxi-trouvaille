import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const quickProductsPath = path.join(root, "data", "quick-products.json");
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const outputDir = path.join(actionRoot, `public-image-hold-${dateKey}`);
const applyMode = process.argv.includes("--apply");

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isPublished(product) {
  return (product.status ?? "published") === "published";
}

function productImageCandidates(product) {
  return Array.from(
    new Set(
      [product.image, ...(Array.isArray(product.images) ? product.images : [])]
        .map((image) => String(image ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function safeImageLabel(image) {
  const value = String(image ?? "");

  if (/^https?:\/\//i.test(value)) {
    return "[image distante masquee]";
  }

  return value;
}

function isRiskyPublicImage(product) {
  const name = normalizeText(product.name);
  const slug = normalizeText(product.slug);
  const reasons = [];
  const images = productImageCandidates(product);

  if (images.length === 0) {
    reasons.push("image_absente");
  }

  for (const image of images) {
    if (/^https?:\/\//i.test(image)) {
      reasons.push("image_distante_non_locale");
    }

    if (/aliexpress|alicdn|ae-pic|temu/i.test(image)) {
      reasons.push("image_cdn_fournisseur");
    }

    if (/^https?:\/\/images\.unsplash\.com\//i.test(image) || /unsplash/i.test(image)) {
      reasons.push("image_unsplash_generique");
    }

    if (image.startsWith("/uploads/generated-products/")) {
      reasons.push("image_generee_non_preuve_exacte");
    }

    if (image.startsWith("/uploads/category-images/")) {
      reasons.push("image_categorie_utilisee_comme_photo_produit");
    }

    if (/placeholder|hold|a-verifier/i.test(image)) {
      reasons.push("image_placeholder");
    }

    if (
      image &&
      !image.startsWith("/uploads/partner-products/") &&
      !image.startsWith("/uploads/quick-products/")
    ) {
      reasons.push("image_hors_depot_produit_exact");
    }

    if (image && !/\.webp(?:\?.*)?$/i.test(image)) {
      reasons.push("image_non_webp");
    }
  }

  if (name.includes("a verifier") || slug.includes("a-verifier")) {
    reasons.push("fiche_a_verifier_visible_client");
  }

  return Array.from(new Set(reasons));
}

function updateProduct(product, reasons) {
  const previousValidation = product.internalSourcing?.validationStatus ?? "";
  const holdNote =
    "HOLD - image publique non prouvee exacte. Repasser en ligne seulement apres photo locale exacte, droits image et validation Mouss.";

  return {
    ...product,
    status: "draft",
    badge: product.badge || "HOLD image",
    internalSourcing: {
      ...(product.internalSourcing ?? {}),
      validationStatus: holdNote,
      previousValidationStatus: previousValidation || undefined,
      imageHoldReasons: reasons,
      imageHoldAppliedAt: new Date().toISOString(),
    },
    imageValidation: {
      ...(product.imageValidation ?? {}),
      status: "hold_public_image_not_exact",
      nextAction:
        "Remplacer par une photo locale exacte du produit vendu ou garder la fiche en brouillon.",
      holdReasons: reasons,
    },
  };
}

function markdownReport(summary) {
  const lines = [
    "# HOLD images publiques non prouvees",
    "",
    `Date: ${summary.checkedAt}`,
    `Mode: ${summary.applyMode ? "APPLY" : "DRY_RUN"}`,
    `Statut: ${summary.status}`,
    "",
    "## Resume",
    "",
    `- Produits publies audites: ${summary.publishedQuickProductCount}`,
    `- Produits a passer en HOLD: ${summary.toHoldCount}`,
    `- Produits passes en HOLD: ${summary.appliedHoldCount}`,
    `- Produits deja retires du public: ${summary.alreadyHeldCount}`,
    "",
    "## Produits concernes",
    "",
  ];

  for (const product of summary.toHold) {
    lines.push(
      `- ${product.name}`,
      `  - Slug: ${product.slug}`,
      `  - Image: ${product.image}`,
      `  - Raisons: ${product.reasons.join(", ")}`,
    );
  }

  if (summary.alreadyHeld.length > 0) {
    lines.push("", "## Deja en HOLD image", "");
    for (const product of summary.alreadyHeld) {
      lines.push(
      `- ${product.name}`,
      `  - Slug: ${product.slug}`,
      `  - Image: ${product.image}`,
      `  - Raisons: ${product.reasons.join(", ") || "hold_public_image_not_exact"}`,
      );
    }
  }

  lines.push(
    "",
    "## Garde-fous",
    "",
    "- Aucun produit fournisseur commande.",
    "- Aucun paiement.",
    "- Aucune publication forcee.",
    "- Les fiches douteuses passent en brouillon/HOLD local.",
    "",
  );

  return `${lines.join("\n")}\n`;
}

function writeReport(summary) {
  fs.mkdirSync(outputDir, { recursive: true });
  const modeLabel = summary.applyMode ? "APPLY" : "DRY_RUN";
  const jsonPath = path.join(outputDir, `PUBLIC_IMAGE_HOLD_AUDIT_${dateKey}_${modeLabel}.json`);
  const mdPath = path.join(outputDir, `PUBLIC_IMAGE_HOLD_AUDIT_${dateKey}_${modeLabel}.md`);

  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdPath, markdownReport(summary), "utf8");

  return { jsonPath, mdPath };
}

function backupQuickProducts() {
  const backupDir = path.join(
    root,
    "backups",
    `auto-public-image-hold-${dateKey}-${Date.now()}`,
  );
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, "quick-products.json.bak");
  fs.copyFileSync(quickProductsPath, backupPath);
  return backupPath;
}

const quickProducts = readJson(quickProductsPath, []);

if (!Array.isArray(quickProducts)) {
  throw new Error("data/quick-products.json must contain an array.");
}

const toHold = quickProducts
  .map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    status: product.status ?? "published",
    image: safeImageLabel(product.image),
    reasons: isPublished(product) ? isRiskyPublicImage(product) : [],
  }))
  .filter((product) => product.reasons.length > 0);

const alreadyHeld = quickProducts
  .filter((product) => product.imageValidation?.status === "hold_public_image_not_exact")
  .map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    status: product.status ?? "published",
    image: safeImageLabel(product.image),
    reasons: product.imageValidation?.holdReasons ?? product.internalSourcing?.imageHoldReasons ?? [],
  }));

let appliedHoldCount = 0;
let backupPath = null;

if (applyMode && toHold.length > 0) {
  const byId = new Map(toHold.map((product) => [product.id, product.reasons]));
  backupPath = backupQuickProducts();
  const updated = quickProducts.map((product) => {
    const reasons = byId.get(product.id);

    if (!reasons) {
      return product;
    }

    appliedHoldCount += 1;
    return updateProduct(product, reasons);
  });

  fs.writeFileSync(quickProductsPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
}

const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  mode: "public_customer_image_hold_audit",
  applyMode,
  status:
    toHold.length > 0
      ? "HOLD_PUBLIC_IMAGES_NOT_PROVEN"
      : alreadyHeld.length > 0
        ? "OK_PUBLIC_IMAGES_HELD_RISKS_REMOVED"
        : "OK_PUBLIC_IMAGES",
  publishedQuickProductCount: quickProducts.filter(isPublished).length,
  toHoldCount: toHold.length,
  appliedHoldCount,
  alreadyHeldCount: alreadyHeld.length,
  toHold,
  alreadyHeld,
  backupPath,
  outputDir,
  safety: {
    noSupplierOrder: true,
    noPayment: true,
    noPublication: true,
    noDeletion: true,
    onlyDraftHoldLocalProducts: applyMode,
  },
};

const files = writeReport(summary);

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      status: summary.status,
      applyMode: summary.applyMode,
      publishedQuickProductCount: summary.publishedQuickProductCount,
      toHoldCount: summary.toHoldCount,
      appliedHoldCount: summary.appliedHoldCount,
      alreadyHeldCount: summary.alreadyHeldCount,
      products: summary.toHold.map((product) => ({
        slug: product.slug,
        name: product.name,
        reasons: product.reasons,
      })),
      backupPath: summary.backupPath,
      files,
      safety: summary.safety,
    },
    null,
    2,
  ),
);

import fs from "node:fs";
import path from "node:path";

const quickProductsPath = path.join(process.cwd(), "data", "quick-products.json");

function readProducts() {
  const content = fs.readFileSync(quickProductsPath, "utf8");
  const products = JSON.parse(content);

  if (!Array.isArray(products)) {
    throw new Error("data/quick-products.json must contain an array of products.");
  }

  return products;
}

function isPartnerProduct(product) {
  return Boolean(
    product?.dropshipping?.enabled ||
      String(product?.categoryId ?? "").startsWith("dropshipping-"),
  );
}

function includesHold(value) {
  return typeof value === "string" && value.toLowerCase().includes("hold");
}

function needsManualCheck(value) {
  if (typeof value !== "string") {
    return true;
  }

  const normalized = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  return (
    normalized.includes("a verifier") ||
    normalized.includes("a confirmer") ||
    normalized.includes("estime")
  );
}

function auditProduct(product) {
  const problems = [];
  const status = product.status ?? "published";
  const dropshipping = product.dropshipping ?? {};
  const validationStatus = product.internalSourcing?.validationStatus;

  if (includesHold(validationStatus) && status === "published") {
    problems.push("produit_published_malgre_validation_hold");
  }

  if (status === "published" && product.imageValidation?.status !== "verified_source_images") {
    problems.push("published_sans_images_verifiees");
  }

  if (status === "published" && !dropshipping.supplierUrl) {
    problems.push("published_sans_lien_fournisseur");
  }

  if (status === "published" && !(dropshipping.supplierPriceCents > 0)) {
    problems.push("published_sans_prix_fournisseur");
  }

  if (status === "published" && needsManualCheck(dropshipping.deliveryEstimate)) {
    problems.push("published_avec_delai_a_verifier");
  }

  if (status === "published" && !dropshipping.validationGate) {
    problems.push("published_sans_gate_validation");
  }

  return problems;
}

const products = readProducts();
const partnerProducts = products.filter(isPartnerProduct);
const failures = partnerProducts
  .map((product) => ({
    id: product.id,
    slug: product.slug,
    status: product.status ?? "published",
    problems: auditProduct(product),
  }))
  .filter((entry) => entry.problems.length > 0);

const draftHoldCount = partnerProducts.filter(
  (product) => (product.status ?? "published") === "draft" && includesHold(product.internalSourcing?.validationStatus),
).length;

const summary = {
  ok: failures.length === 0,
  checkedAt: new Date().toISOString(),
  partnerProductCount: partnerProducts.length,
  draftHoldCount,
  publishedPartnerCount: partnerProducts.filter(
    (product) => (product.status ?? "published") === "published",
  ).length,
  failureCount: failures.length,
  failures,
};

console.log(JSON.stringify(summary, null, 2));

if (failures.length > 0) {
  process.exitCode = 1;
}

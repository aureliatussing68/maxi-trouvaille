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

function hasCategoryPlaceholder(value) {
  return typeof value === "string" && value.includes("/uploads/category-images/");
}

function auditProduct(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  const problems = [];

  if (!product.image || hasCategoryPlaceholder(product.image)) {
    problems.push("image_principale_generique_ou_absente");
  }

  if (images.length === 0 || images.some(hasCategoryPlaceholder)) {
    problems.push("galerie_generique_ou_absente");
  }

  if (!product.imageValidation) {
    problems.push("image_validation_absente");
  } else if (product.imageValidation.status === "hold") {
    problems.push("image_validation_hold");
  } else if (product.imageValidation.status !== "verified_source_images") {
    problems.push(`image_validation_statut_inattendu:${product.imageValidation.status}`);
  }

  if (!product.imageValidation?.sourceUrl) {
    problems.push("source_image_absente");
  }

  return problems;
}

const products = readProducts();
const partnerProducts = products.filter(isPartnerProduct);
const failures = partnerProducts
  .map((product) => ({
    id: product.id,
    slug: product.slug,
    status: product.status,
    problems: auditProduct(product),
  }))
  .filter((entry) => entry.problems.length > 0);

const summary = {
  ok: failures.length === 0,
  checkedAt: new Date().toISOString(),
  partnerProductCount: partnerProducts.length,
  failureCount: failures.length,
  failures,
};

console.log(JSON.stringify(summary, null, 2));

if (failures.length > 0) {
  process.exitCode = 1;
}

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

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function extractHoldReason(product) {
  const value = product.internalSourcing?.validationStatus;

  if (typeof value !== "string" || value.trim().length === 0) {
    return "validation_manquante";
  }

  return value.replace(/^HOLD\s*-\s*/i, "").trim();
}

const products = readProducts();
const partnerProducts = products.filter(isPartnerProduct);

const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  partnerProductCount: partnerProducts.length,
  byStatus: countBy(partnerProducts, (product) => product.status ?? "published"),
  byCategory: countBy(partnerProducts, (product) => product.categoryId ?? "sans_categorie"),
  byImageValidation: countBy(
    partnerProducts,
    (product) => product.imageValidation?.status ?? "absent",
  ),
  draftHoldItems: partnerProducts
    .filter((product) => (product.status ?? "published") === "draft")
    .map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      categoryId: product.categoryId,
      imageValidation: product.imageValidation?.status ?? "absent",
      supplierUrlPresent: Boolean(product.dropshipping?.supplierUrl),
      supplierPricePresent: Boolean(product.dropshipping?.supplierPriceCents),
      deliveryEstimatePresent: Boolean(product.dropshipping?.deliveryEstimate),
      holdReason: extractHoldReason(product),
    })),
};

console.log(JSON.stringify(summary, null, 2));

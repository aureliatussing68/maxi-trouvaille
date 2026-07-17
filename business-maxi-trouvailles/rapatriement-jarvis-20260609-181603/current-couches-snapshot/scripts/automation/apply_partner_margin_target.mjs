import fs from "node:fs";
import path from "node:path";

const quickProductsPath = path.join(process.cwd(), "data", "quick-products.json");
const applyChanges = process.argv.includes("--apply");
const targetMarginPercent = 40;

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

function calculateMarginPercent(product) {
  const sale = Number(product?.dropshipping?.salePriceCents ?? product?.price ?? 0);
  const supplier = Number(product?.dropshipping?.supplierPriceCents ?? 0);

  if (!Number.isFinite(sale) || !Number.isFinite(supplier) || sale <= 0 || supplier <= 0) {
    return null;
  }

  return Math.round(((sale - supplier) / sale) * 100);
}

function roundUpToTenCents(cents) {
  return Math.ceil(cents / 10) * 10;
}

function recommendedSalePriceCents(supplierPriceCents) {
  const raw = supplierPriceCents / (1 - targetMarginPercent / 100);
  return roundUpToTenCents(raw);
}

function updatePricingRule(product, nextSalePriceCents, nextMarginCents, nextMarginPercent) {
  const currentRule = String(product.internalSourcing?.pricingRule ?? "").trim();
  const nextRule = `Marge cible ${targetMarginPercent}% appliquee automatiquement: prix fournisseur ${(
    product.dropshipping.supplierPriceCents / 100
  ).toFixed(2)} EUR, prix boutique ${(nextSalePriceCents / 100).toFixed(
    2,
  )} EUR, marge brute estimee ${nextMarginPercent}% avant frais/retours/taxes.`;

  if (!currentRule) {
    return nextRule;
  }

  if (currentRule.includes(`Marge cible ${targetMarginPercent}% appliquee automatiquement`)) {
    return currentRule;
  }

  return `${currentRule} ${nextRule}`;
}

function buildUpdates(products) {
  return products
    .filter(isPartnerProduct)
    .map((product) => {
      const supplierPriceCents = Number(product.dropshipping?.supplierPriceCents ?? 0);
      const currentSalePriceCents = Number(product.dropshipping?.salePriceCents ?? product.price ?? 0);
      const currentMarginPercent = calculateMarginPercent(product);

      if (
        !Number.isFinite(supplierPriceCents) ||
        supplierPriceCents <= 0 ||
        !Number.isFinite(currentSalePriceCents) ||
        currentSalePriceCents <= 0
      ) {
        return null;
      }

      const nextSalePriceCents = recommendedSalePriceCents(supplierPriceCents);
      const nextMarginCents = nextSalePriceCents - supplierPriceCents;
      const nextMarginPercent = Math.round((nextMarginCents / nextSalePriceCents) * 100);

      if ((currentMarginPercent ?? 0) >= targetMarginPercent) {
        return null;
      }

      return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        status: product.status ?? "published",
        categoryId: product.categoryId,
        supplierPriceCents,
        oldSalePriceCents: currentSalePriceCents,
        oldMarginPercent: currentMarginPercent,
        nextSalePriceCents,
        nextMarginCents,
        nextMarginPercent,
      };
    })
    .filter(Boolean);
}

function applyUpdates(products, updates) {
  if (!applyChanges || updates.length === 0) {
    return { applied: applyChanges, updatedCount: 0, backupDir: null };
  }

  const updatesById = new Map(updates.map((update) => [update.id, update]));
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "backups", `quick-products-before-margin-target-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(quickProductsPath, path.join(backupDir, "quick-products.json.bak"));

  const updatedProducts = products.map((product) => {
    const update = updatesById.get(product.id);

    if (!update) {
      return product;
    }

    return {
      ...product,
      price: update.nextSalePriceCents,
      dropshipping: {
        ...product.dropshipping,
        salePriceCents: update.nextSalePriceCents,
        marginCents: update.nextMarginCents,
        syncStatus: product.dropshipping?.syncStatus ?? "manual",
      },
      internalSourcing: {
        ...product.internalSourcing,
        markupPercent: Math.round(((update.nextSalePriceCents - update.supplierPriceCents) / update.supplierPriceCents) * 100),
        pricingRule: updatePricingRule(
          product,
          update.nextSalePriceCents,
          update.nextMarginCents,
          update.nextMarginPercent,
        ),
        pricingUpdatedAt: new Date().toISOString(),
      },
    };
  });

  fs.writeFileSync(quickProductsPath, `${JSON.stringify(updatedProducts, null, 2)}\n`, "utf8");

  return { applied: true, updatedCount: updates.length, backupDir };
}

const products = readProducts();
const updates = buildUpdates(products);
const applySummary = applyUpdates(products, updates);

console.log(
  JSON.stringify(
    {
      ok: true,
      checkedAt: new Date().toISOString(),
      mode: applyChanges ? "apply" : "audit",
      targetMarginPercent,
      updateCount: updates.length,
      updates,
      apply: applySummary,
      safety: {
        noPublication: true,
        noPayment: true,
        noOrder: true,
        noAccountLogin: true,
        draftProductsOnlyExpected: true,
      },
    },
    null,
    2,
  ),
);

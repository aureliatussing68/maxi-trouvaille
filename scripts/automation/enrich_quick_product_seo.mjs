import fs from "node:fs";
import path from "node:path";

const quickProductsPath = path.join(process.cwd(), "data", "quick-products.json");
const applyChanges = process.argv.includes("--apply");

function readProducts() {
  const content = fs.readFileSync(quickProductsPath, "utf8");
  const products = JSON.parse(content);

  if (!Array.isArray(products)) {
    throw new Error("data/quick-products.json must contain an array of products.");
  }

  return products;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleanText(value, fallback = "") {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function buildKeywords(product) {
  const source = [
    product.name,
    product.categoryId,
    product.shortDescription,
    ...(Array.isArray(product.features) ? product.features : []),
  ].join(" ");

  return Array.from(
    new Set(
      normalizeText(source)
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 3)
        .filter((word) => !["avec", "pour", "dans", "une", "des", "les", "par"].includes(word))
        .slice(0, 14),
    ),
  );
}

function buildSeo(product) {
  const name = cleanText(product.name, "Produit Maxi Trouvaille");
  const category = cleanText(String(product.categoryId ?? "").replace(/^dropshipping-/, ""));
  const description = cleanText(product.shortDescription || product.description, name).slice(0, 155);

  return {
    title: `${name} | Maxi Trouvaille`.slice(0, 65),
    description,
    h1: name,
    h2: `Pourquoi choisir ${name}`.slice(0, 90),
    keywords: buildKeywords(product),
    imageAlt: `${name} - ${category || "produit"} Maxi Trouvaille`.trim(),
  };
}

function buildUpdates(products) {
  return products.map((product) => {
    const nextSeo = buildSeo(product);
    const currentSeo = product.seo ?? {};
    const nextProduct = {
      ...product,
      seo: {
        ...currentSeo,
        ...nextSeo,
      },
      imageAlt: product.imageAlt || nextSeo.imageAlt,
    };

    return {
      id: product.id,
      slug: product.slug,
      changed:
        JSON.stringify(product.seo ?? null) !== JSON.stringify(nextProduct.seo) ||
        product.imageAlt !== nextProduct.imageAlt,
      product: nextProduct,
      seo: nextSeo,
    };
  });
}

function applyUpdates(products, updates) {
  const changedUpdates = updates.filter((update) => update.changed);

  if (!applyChanges || changedUpdates.length === 0) {
    return { applied: applyChanges, updatedCount: 0, backupDir: null };
  }

  const byId = new Map(changedUpdates.map((update) => [update.id, update.product]));
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "backups", `quick-products-before-seo-enrich-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(quickProductsPath, path.join(backupDir, "quick-products.json.bak"));

  const updatedProducts = products.map((product) => byId.get(product.id) ?? product);
  fs.writeFileSync(quickProductsPath, `${JSON.stringify(updatedProducts, null, 2)}\n`, "utf8");

  return { applied: true, updatedCount: changedUpdates.length, backupDir };
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
      productCount: products.length,
      missingSeoBefore: products.filter((product) => !product.seo).length,
      missingImageAltBefore: products.filter((product) => !product.imageAlt).length,
      updateCount: updates.filter((update) => update.changed).length,
      examples: updates.slice(0, 8).map((update) => ({
        slug: update.slug,
        seo: update.seo,
      })),
      apply: applySummary,
      safety: {
        noPublication: true,
        noPayment: true,
        noOrder: true,
        noAccountLogin: true,
      },
    },
    null,
    2,
  ),
);

import { promises as fs } from "fs";
import path from "path";
import { getProductBySlug, getProductsByCategory, products, type Product } from "@/lib/catalog";
import { mergeProducts, sanitizeQuickProducts } from "@/lib/quick-products";

const quickProductsPath = path.join(process.cwd(), "data", "quick-products.json");

export async function readQuickProducts(): Promise<Product[]> {
  try {
    const content = await fs.readFile(quickProductsPath, "utf8");
    return sanitizeQuickProducts(JSON.parse(content));
  } catch {
    return [];
  }
}

export async function writeQuickProducts(quickProducts: Product[]) {
  await fs.mkdir(path.dirname(quickProductsPath), { recursive: true });
  await fs.writeFile(
    quickProductsPath,
    JSON.stringify(sanitizeQuickProducts(quickProducts), null, 2),
    "utf8",
  );
}

export async function getAllProducts() {
  return mergeProducts(await readQuickProducts());
}

export async function getCatalogProductById(id: string) {
  const staticProduct = products.find((product) => product.id === id);
  if (staticProduct) {
    return staticProduct;
  }

  const quickProducts = await readQuickProducts();
  return quickProducts.find((product) => product.id === id);
}

export async function getCatalogProductBySlug(slug: string) {
  const staticProduct = getProductBySlug(slug);
  if (staticProduct) {
    return staticProduct;
  }

  const quickProducts = await readQuickProducts();
  return quickProducts.find((product) => product.slug === slug);
}

export async function getCatalogProductsByCategory(categoryId: string) {
  const quickProducts = await readQuickProducts();
  return [
    ...getProductsByCategory(categoryId),
    ...quickProducts.filter((product) => product.categoryId === categoryId),
  ];
}

export async function decrementQuickProductStock(
  items: Array<{ productId: string; quantity: number }>,
) {
  const quickProducts = await readQuickProducts();
  const decrements = new Map(
    items.map((item) => [
      item.productId,
      Math.max(0, Math.trunc(Number(item.quantity)) || 0),
    ]),
  );

  const updatedProducts = quickProducts.map((product) => {
    const quantity = decrements.get(product.id);
    if (!quantity) {
      return product;
    }

    const nextStock = Math.max(0, product.stock - quantity);
    return {
      ...product,
      stock: nextStock,
      badge: nextStock > 0 ? product.badge : "Rupture",
      features: product.features.map((feature) =>
        feature.startsWith("Quantite disponible :")
          ? `Quantite disponible : ${nextStock}`
          : feature,
      ),
    };
  });

  await writeQuickProducts(updatedProducts);
  return updatedProducts;
}

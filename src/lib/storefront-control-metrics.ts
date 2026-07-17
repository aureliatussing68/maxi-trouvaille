import {
  categories,
  isDropshippingCategory,
  isDropshippingProduct,
} from "@/lib/catalog";
import { getAllProducts, getPublicProducts } from "@/lib/catalog-server";

export type StorefrontControlMetrics = {
  publicProductCount: number;
  partnerCandidateCount: number;
  partnerCategoryCount: number;
};

export async function getStorefrontControlMetrics(): Promise<StorefrontControlMetrics> {
  const [publicProducts, catalogProducts] = await Promise.all([
    getPublicProducts(),
    getAllProducts(),
  ]);

  return {
    publicProductCount: publicProducts.length,
    partnerCandidateCount: catalogProducts.filter(isDropshippingProduct).length,
    partnerCategoryCount: categories.filter(isDropshippingCategory).length,
  };
}

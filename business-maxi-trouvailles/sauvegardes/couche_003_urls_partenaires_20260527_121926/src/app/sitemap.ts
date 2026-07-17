import type { MetadataRoute } from "next";
import { categories, isPublicCategory } from "@/lib/catalog";
import { getPublicProducts } from "@/lib/catalog-server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const products = await getPublicProducts();
  const staticRoutes = [
    "",
    "/boutique",
    "/dropshipping",
    "/categories",
    "/livraison",
    "/suivi-colis",
    "/faq",
    "/contact",
    "/retours-remboursements",
    "/conditions-generales-vente",
    "/conditions-dropshipping",
    "/mentions-legales",
    "/politique-confidentialite",
  ];

  return [
    ...staticRoutes.map((route) => ({
      url: `${siteUrl}${route}`,
      lastModified: new Date(),
    })),
    ...categories
      .filter(isPublicCategory)
      .map((category) => ({
        url: `${siteUrl}/categories/${category.slug}`,
        lastModified: new Date(),
      })),
    ...products.map((product) => ({
      url: `${siteUrl}/produit/${product.slug}`,
      lastModified: new Date(),
    })),
  ];
}

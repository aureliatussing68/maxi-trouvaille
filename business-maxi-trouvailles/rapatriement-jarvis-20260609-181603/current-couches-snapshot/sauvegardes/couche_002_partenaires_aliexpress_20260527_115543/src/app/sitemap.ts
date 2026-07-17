import type { MetadataRoute } from "next";
import { categories } from "@/lib/catalog";
import { getAllProducts } from "@/lib/catalog-server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const products = await getAllProducts();
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
    ...categories.map((category) => ({
      url: `${siteUrl}/categories/${category.slug}`,
      lastModified: new Date(),
    })),
    ...products
      .filter((product) => (product.status ?? "published") === "published")
      .map((product) => ({
        url: `${siteUrl}/produit/${product.slug}`,
        lastModified: new Date(),
      })),
  ];
}

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
    { path: "", priority: 1, changeFrequency: "daily" },
    { path: "/boutique", priority: 0.95, changeFrequency: "daily" },
    { path: "/produits-partenaires", priority: 0.95, changeFrequency: "daily" },
    { path: "/nouveautes", priority: 0.92, changeFrequency: "daily" },
    { path: "/promotions", priority: 0.92, changeFrequency: "daily" },
    { path: "/categories", priority: 0.9, changeFrequency: "daily" },
    { path: "/livraison", priority: 0.75, changeFrequency: "weekly" },
    { path: "/suivi-colis", priority: 0.75, changeFrequency: "weekly" },
    { path: "/faq", priority: 0.7, changeFrequency: "weekly" },
    { path: "/contact", priority: 0.7, changeFrequency: "weekly" },
    { path: "/a-propos", priority: 0.6, changeFrequency: "monthly" },
    { path: "/retours-remboursements", priority: 0.5, changeFrequency: "monthly" },
    { path: "/conditions-generales-vente", priority: 0.45, changeFrequency: "monthly" },
    { path: "/conditions-produits-partenaires", priority: 0.55, changeFrequency: "monthly" },
    { path: "/mentions-legales", priority: 0.4, changeFrequency: "monthly" },
    { path: "/politique-confidentialite", priority: 0.4, changeFrequency: "monthly" },
  ] as const satisfies ReadonlyArray<{
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }>;

  return [
    ...staticRoutes.map((route) => ({
      url: `${siteUrl}${route.path}`,
      lastModified: new Date(),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...categories
      .filter(isPublicCategory)
      .map((category) => ({
        url: `${siteUrl}/categories/${category.slug}`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: category.parentId ? 0.75 : 0.85,
      })),
    ...products.map((product) => ({
      url: `${siteUrl}/produit/${product.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}

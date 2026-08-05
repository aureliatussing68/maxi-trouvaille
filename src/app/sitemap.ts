import type { MetadataRoute } from "next";
import { categories, isPublicCategory } from "@/lib/catalog";
import { getPublicProducts } from "@/lib/catalog-server";
import { HISTORIQUE_PRIX_VERIFIE } from "@/lib/product-display";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  const products = await getPublicProducts();

  /** Identifiants de categorie effectivement portes par au moins une fiche publiee. */
  const categoriesPeuplees = new Set(
    products.map((product) => product.categoryId),
  );

  /** Vrai si ce rayon contient des fiches, ou si l'un de ses sous-rayons en contient. */
  const categorieNonVide = (categoryId: string) =>
    categoriesPeuplees.has(categoryId) ||
    categories.some(
      (enfant) =>
        enfant.parentId === categoryId && categoriesPeuplees.has(enfant.id),
    );
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
    {
      path: "/retours-remboursements",
      priority: 0.5,
      changeFrequency: "monthly",
    },
    {
      path: "/conditions-generales-vente",
      priority: 0.45,
      changeFrequency: "monthly",
    },
    {
      path: "/conditions-produits-partenaires",
      priority: 0.55,
      changeFrequency: "monthly",
    },
    { path: "/mentions-legales", priority: 0.4, changeFrequency: "monthly" },
    {
      path: "/politique-confidentialite",
      priority: 0.4,
      changeFrequency: "monthly",
    },
  ] as const satisfies ReadonlyArray<{
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }>;

  return [
    // « /promotions » sort du sitemap tant que HISTORIQUE_PRIX_VERIFIE vaut
    // false. Sans historique de prix verifie, aucun prix barre n'est affiche,
    // donc cette page ne contient RIEN. La laisser indexee revient a faire
    // referencer par Google une page qui promet des promotions et n'en montre
    // aucune. Elle y reviendra d'elle-meme le jour ou l'historique sera etabli.
    ...staticRoutes
      .filter(
        (route) => route.path !== "/promotions" || HISTORIQUE_PRIX_VERIFIE,
      )
      .map((route) => ({
        url: `${siteUrl}${route.path}`,
        lastModified: new Date(),
        changeFrequency: route.changeFrequency,
        priority: route.priority,
      })),
    // Une categorie n'entre dans le sitemap que si elle a REELLEMENT quelque
    // chose a montrer, directement ou via une sous-categorie.
    //
    // Sans ce filtre, le sitemap declarait a Google des rayons vides :
    // « promotions-partenaires » et « nouveautes-partenaires » sont des vues
    // filtrees et non des univers de produits, aucune fiche ne porte leur
    // identifiant. Faire indexer une page qui promet des produits et n'en
    // affiche aucun degrade le referencement de tout le site, et deçoit le
    // visiteur qui y atterrit.
    ...categories
      .filter(isPublicCategory)
      .filter((category) => categorieNonVide(category.id))
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

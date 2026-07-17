import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/api/admin/",
        "/avis/laisser",
        "/offline",
        "/panier",
        "/paiement",
        "/dropshipping",
        "/conditions-dropshipping",
        "/categories/colis-surprise-palettes",
        "/categories/palettes-destockage",
        "/categories/colis-mysteres",
        "/categories/colis-au-poids",
        "/categories/lots-bonnes-affaires",
        "/categories/colis-surprise",
        "/*?adminPreview=1",
      ],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}

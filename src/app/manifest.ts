import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Maxi Trouvaille",
    short_name: "Maxi",
    description:
      "Boutique Maxi Trouvaille : trouvailles à petits prix, paiement sécurisé, suivi colis et service client.",
    id: "/",
    start_url: "/",
    scope: "/",
    lang: "fr-FR",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#171717",
    orientation: "portrait-primary",
    categories: ["shopping", "lifestyle", "business"],
    shortcuts: [
      {
        name: "Boutique",
        short_name: "Boutique",
        description: "Ouvrir la boutique produits partenaires Maxi Trouvaille.",
        url: "/boutique",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
          },
        ],
      },
      {
        name: "Produits partenaires",
        short_name: "Partenaires",
        description: "Ouvrir les rayons produits partenaires Maxi Trouvaille.",
        url: "/produits-partenaires",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
          },
        ],
      },
      {
        name: "Nouveautés",
        short_name: "Nouveautés",
        description: "Voir les derniers produits ajoutés sur Maxi Trouvaille.",
        url: "/nouveautes",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
          },
        ],
      },
      {
        name: "Promotions",
        short_name: "Promos",
        description: "Voir les promotions en cours sur Maxi Trouvaille.",
        url: "/promotions",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
          },
        ],
      },
      {
        name: "Suivi colis",
        short_name: "Suivi",
        description: "Accéder au suivi colis Maxi Trouvaille.",
        url: "/suivi-colis",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
          },
        ],
      },
    ],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

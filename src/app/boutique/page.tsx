import type { Metadata } from "next";
import { CategoryGrid } from "@/components/CategoryGrid";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";
import { HeroCarousel } from "@/components/HeroCarousel";
import { PageHeader } from "@/components/PageHeader";
import { ShopProductExplorer } from "@/components/ShopProductExplorer";
import { isAdminModeEnabled } from "@/lib/admin";
import {
  countProductsByCategory,
  homeShowcaseCategoryIds,
} from "@/lib/catalog";
import { getPublicProducts } from "@/lib/catalog-server";
import { getApprovedReviewSummaryMap } from "@/lib/product-reviews";
import { getProductStatsMap } from "@/lib/product-stats";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Boutique",
  description:
    "Toute la boutique Maxi Trouvaille : recherchez parmi nos produits malins à petits prix, paiement sécurisé et livraison suivie.",
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialQuery = typeof params.q === "string" ? params.q : "";
  const publicProducts = await getPublicProducts();
  const productIds = publicProducts.map((product) => product.id);
  const statsMap = await getProductStatsMap(productIds);
  const reviewSummaryMap = await getApprovedReviewSummaryMap(productIds);
  const adminMode = isAdminModeEnabled();
  const statsByProductId = Object.fromEntries(statsMap.entries());
  const reviewSummaryByProductId = Object.fromEntries(reviewSummaryMap.entries());
  const productCountByCategoryId = countProductsByCategory(
    publicProducts,
    homeShowcaseCategoryIds,
  );

  return (
    <>
      <PageHeader
        eyebrow="Boutique"
        title="Toute la boutique Maxi Trouvaille"
        description="Recherchez un produit, filtrez par rayon et commandez en quelques clics. Paiement sécurisé et livraison suivie."
      />
      {/* Bandeau qui defile, juste sous l'en-tete : il separe nettement
          l'accroche de l'outil de recherche. Volontairement fin (128 px sur
          telephone) pour que la barre de recherche reste visible sans defiler.
          Cout reseau nul : ce sont les 4 memes fichiers que la grille des rayons
          en bas de cette page, donc rien de neuf a telecharger. */}
      <HeroCarousel variant="band" />
      <section className="container-page py-8">
        <ShopProductExplorer
          products={publicProducts}
          statsByProductId={statsByProductId}
          reviewSummaryByProductId={reviewSummaryByProductId}
          showAdminControls={adminMode}
          initialQuery={initialQuery}
        />
      </section>
      <section className="container-page border-t border-line py-10">
        <div className="mb-6">
          <p className="text-sm font-black uppercase text-teal">Nos rayons</p>
          <h2 className="mt-2 text-2xl font-black">Explorez par univers</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            {homeShowcaseCategoryIds.length} rayons, {publicProducts.length}{" "}
            produits en ligne.
          </p>
        </div>
        {/* Le bouton "Voir toutes les catégories" qui trainait dans l'en-tete de
            cette section est devenu la derniere tuile de la grille : un seul
            chemin vers la meme page, et la derniere ligne n'a plus de trou. */}
        <CategoryGrid
          compact
          featuredOnly
          productCountByCategoryId={productCountByCategoryId}
          trailingTile={{
            href: "/categories",
            label: "Toutes les catégories",
            hint: "Voir la liste",
          }}
        />
        <CustomerSupportQuickLinks className="mt-10" />
      </section>
    </>
  );
}

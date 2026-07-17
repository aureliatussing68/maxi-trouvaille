import type { Metadata } from "next";
import Link from "next/link";
import { CategoryGrid } from "@/components/CategoryGrid";
import { PageHeader } from "@/components/PageHeader";
import { ShopProductExplorer } from "@/components/ShopProductExplorer";
import { isAdminModeEnabled } from "@/lib/admin";
import { getPublicProducts } from "@/lib/catalog-server";
import { getApprovedReviewSummaryMap } from "@/lib/product-reviews";
import { getProductStatsMap } from "@/lib/product-stats";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Boutique dropshipping",
  description:
    "Boutique dropshipping Maxi Trouvaille : produits partenaires verifies avant publication.",
};

export default async function ShopPage() {
  const allProducts = await getPublicProducts();
  const productIds = allProducts.map((product) => product.id);
  const statsMap = await getProductStatsMap(
    productIds,
  );
  const reviewSummaryMap = await getApprovedReviewSummaryMap(productIds);
  const adminMode = isAdminModeEnabled();
  const statsByProductId = Object.fromEntries(statsMap.entries());
  const reviewSummaryByProductId = Object.fromEntries(reviewSummaryMap.entries());

  return (
    <>
      <PageHeader
        eyebrow="Boutique dropshipping"
        title="Produits partenaires Maxi Trouvaille"
        description="La boutique publique affiche uniquement les produits dropshipping assez verifies pour etre vendus. Les fiches douteuses restent en HOLD."
      />
      <section className="container-page border-b border-line py-8">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase text-teal">
              Rayons dropshipping
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Nouveautés, promotions et catégories prioritaires
            </h2>
          </div>
          <Link
            href="/categories"
            className="text-sm font-black text-teal hover:text-foreground"
          >
            Voir toutes les catégories
          </Link>
        </div>
        <CategoryGrid compact featuredOnly />
      </section>
      <section className="container-page py-10">
        <div className="mb-7 rounded-lg border border-line bg-paper p-5 shadow-sm">
          <p className="text-base font-black">
          Trouvailles prêtes à commander et sélections partenaires.
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Pour l&apos;instant, les produits personnels et les fiches sans image
            exacte sont mises en suspens. Les prochains ajouts publics seront
            uniquement des produits partenaires validés.
          </p>
        </div>
        <ShopProductExplorer
          products={allProducts}
          statsByProductId={statsByProductId}
          reviewSummaryByProductId={reviewSummaryByProductId}
          showAdminControls={adminMode}
        />
      </section>
    </>
  );
}

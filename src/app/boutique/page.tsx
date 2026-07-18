import type { Metadata } from "next";
import Link from "next/link";
import { CategoryGrid } from "@/components/CategoryGrid";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";
import { PageHeader } from "@/components/PageHeader";
import { ShopProductExplorer } from "@/components/ShopProductExplorer";
import { isAdminModeEnabled } from "@/lib/admin";
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

  return (
    <>
      <PageHeader
        eyebrow="Boutique"
        title="Toute la boutique Maxi Trouvaille"
        description="Recherchez un produit, filtrez par rayon et commandez en quelques clics. Paiement sécurisé et livraison suivie."
      />
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
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase text-teal">Nos rayons</p>
            <h2 className="mt-2 text-2xl font-black">
              Explorez par univers
            </h2>
          </div>
          <Link
            href="/categories"
            className="focus-ring inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm font-black text-teal hover:bg-[#f1eadf] hover:text-foreground"
          >
            Voir toutes les catégories
          </Link>
        </div>
        <CategoryGrid compact featuredOnly />
        <CustomerSupportQuickLinks className="mt-10" />
      </section>
    </>
  );
}

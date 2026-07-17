import type { Metadata } from "next";
import Link from "next/link";
import { CategoryGrid } from "@/components/CategoryGrid";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";
import { MobilePresentationPathPanel } from "@/components/MobilePresentationPathPanel";
import { PageHeader } from "@/components/PageHeader";
import { PartnerArticlePreviewPanel } from "@/components/PartnerArticlePreviewPanel";
import {
  buildPartnerDemoCategoryCards,
  PartnerDemoPathPanel,
} from "@/components/PartnerDemoPathPanel";
import { PartnerLaunchBoard } from "@/components/PartnerLaunchBoard";
import { PartnerMobileShowcasePanel } from "@/components/PartnerMobileShowcasePanel";
import { ShopProductExplorer } from "@/components/ShopProductExplorer";
import { StorefrontReadinessPanel } from "@/components/StorefrontReadinessPanel";
import { isAdminModeEnabled } from "@/lib/admin";
import {
  categories,
  isDropshippingCategory,
  isDropshippingProduct,
} from "@/lib/catalog";
import { getAllProducts, getPublicProducts } from "@/lib/catalog-server";
import { getApprovedReviewSummaryMap } from "@/lib/product-reviews";
import { getProductStatsMap } from "@/lib/product-stats";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Boutique produits partenaires",
  description:
    "Boutique Maxi Trouvaille : produits partenaires verifies avant publication.",
};

export default async function ShopPage() {
  const [publicProducts, catalogProducts] = await Promise.all([
    getPublicProducts(),
    getAllProducts(),
  ]);
  const productIds = publicProducts.map((product) => product.id);
  const statsMap = await getProductStatsMap(
    productIds,
  );
  const reviewSummaryMap = await getApprovedReviewSummaryMap(productIds);
  const adminMode = isAdminModeEnabled();
  const statsByProductId = Object.fromEntries(statsMap.entries());
  const reviewSummaryByProductId = Object.fromEntries(reviewSummaryMap.entries());
  const partnerCandidateCount = catalogProducts.filter(isDropshippingProduct).length;
  const partnerCategoryCount = categories.filter(isDropshippingCategory).length;
  const demoCategoryCards = buildPartnerDemoCategoryCards({
    catalogProducts,
    publicProducts,
  });

  return (
    <>
      <PageHeader
        eyebrow="Boutique partenaires"
        title="Produits partenaires Maxi Trouvaille"
        description="La boutique publique affiche uniquement les produits partenaires assez verifies pour etre vendus, avec paiement Maxi Trouvaille et suivi colis."
      />
      <section className="container-page border-b border-line py-8">
        <MobilePresentationPathPanel
          categoryCount={partnerCategoryCount}
          candidateCount={partnerCandidateCount}
          publicProductCount={publicProducts.length}
        />
      </section>
      <section className="container-page border-b border-line py-8">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase text-teal">
              Rayons partenaires
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Nouveautés, promotions et catégories prioritaires
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
      </section>
      <section className="container-page py-10">
        <StorefrontReadinessPanel
          className="mb-10"
          publicProductCount={publicProducts.length}
          partnerCandidateCount={partnerCandidateCount}
          categoryCount={partnerCategoryCount}
        />
        <PartnerDemoPathPanel
          className="mb-10"
          cards={demoCategoryCards}
          candidateCount={partnerCandidateCount}
          publicProductCount={publicProducts.length}
        />
        <PartnerMobileShowcasePanel
          className="mb-10"
          publicProductCount={publicProducts.length}
          partnerCandidateCount={partnerCandidateCount}
          categoryCount={partnerCategoryCount}
        />
        <PartnerLaunchBoard
          className="mb-10"
          candidateCount={partnerCandidateCount}
          publicProductCount={publicProducts.length}
        />
        <PartnerArticlePreviewPanel className="mb-10" />
        <CustomerSupportQuickLinks className="mb-10" />
        <ShopProductExplorer
          products={publicProducts}
          candidateCount={partnerCandidateCount}
          statsByProductId={statsByProductId}
          reviewSummaryByProductId={reviewSummaryByProductId}
          showAdminControls={adminMode}
        />
      </section>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { CategoryGrid } from "@/components/CategoryGrid";
import { PageHeader } from "@/components/PageHeader";
import { ProductCard } from "@/components/ProductCard";
import { isAdminModeEnabled } from "@/lib/admin";
import { getAllProducts } from "@/lib/catalog-server";
import { getApprovedReviewSummaryMap } from "@/lib/product-reviews";
import { getProductStatsMap } from "@/lib/product-stats";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Boutique",
  description:
    "Arrivages Maxi Trouvaille : palettes, colis mystères, colis au poids, lots et bonnes affaires.",
};

export default async function ShopPage() {
  const allProducts = await getAllProducts();
  const productIds = allProducts.map((product) => product.id);
  const statsMap = await getProductStatsMap(
    productIds,
  );
  const reviewSummaryMap = await getApprovedReviewSummaryMap(productIds);
  const adminMode = isAdminModeEnabled();

  return (
    <>
      <PageHeader
        eyebrow="Boutique"
        title="Arrivages Maxi Trouvaille"
        description="Découvrez nos palettes, colis mystères et lots de déstockage. Les produits peuvent être neufs, quasi neufs ou d'occasion selon les arrivages."
      />
      <section className="container-page border-b border-line py-8">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase text-teal">
              Rayons principaux
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Palettes, colis et lots
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
            Découvrez nos palettes, colis mystères et lots de déstockage.
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Que vous soyez particulier ou revendeur, Maxi Trouvaille vous propose
            des arrivages réguliers, des prix attractifs et des opportunités à
            saisir. Les contenus mystères restent aléatoires et non garantis.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {allProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              stats={statsMap.get(product.id)}
              reviewSummary={reviewSummaryMap.get(product.id)}
              showAdminControls={adminMode}
            />
          ))}
        </div>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { CategoryGrid } from "@/components/CategoryGrid";
import { PageHeader } from "@/components/PageHeader";
import { ProductCard } from "@/components/ProductCard";
import { isAdminModeEnabled } from "@/lib/admin";
import { getPublicProducts } from "@/lib/catalog-server";
import { getApprovedReviewSummaryMap } from "@/lib/product-reviews";
import { getProductStatsMap } from "@/lib/product-stats";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Boutique",
  description:
    "Arrivages Maxi Trouvaille : produits utiles, produits partenaires, promotions et nouveautes.",
};

export default async function ShopPage() {
  const allProducts = await getPublicProducts();
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
        description="Découvrez les produits utiles, les produits partenaires, les promotions et les nouveautés."
      />
      <section className="container-page border-b border-line py-8">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase text-teal">
              Rayons principaux
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Catégories à fort potentiel
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
            Produits disponibles maintenant et offres à venir sont clairement séparés.
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Les produits issus de fournisseurs partenaires affichent une livraison
            estimée et restent traités manuellement au début. Les fiches en
            brouillon restent en validation avant publication.
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

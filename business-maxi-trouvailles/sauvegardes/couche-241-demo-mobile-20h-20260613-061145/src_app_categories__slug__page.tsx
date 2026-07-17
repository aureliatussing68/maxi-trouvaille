import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CategoryGrid } from "@/components/CategoryGrid";
import { PageHeader } from "@/components/PageHeader";
import { ProductCard } from "@/components/ProductCard";
import {
  categories,
  getCategoryBySlug,
  getSubcategoriesByParentId,
  isPublicCategory,
} from "@/lib/catalog";
import { getPublicCatalogProductsByCategory } from "@/lib/catalog-server";
import { getApprovedReviewSummaryMap } from "@/lib/product-reviews";
import { getProductStatsMap } from "@/lib/product-stats";

export const dynamic = "force-dynamic";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

const legacyCategoryRedirects: Record<string, string> = {
  dropshipping: "produits-partenaires",
  "dropshipping-nouveautes": "nouveautes-partenaires",
  "dropshipping-promotions": "promotions-partenaires",
  "dropshipping-maison": "maison-partenaires",
  "dropshipping-cuisine": "cuisine-partenaires",
  "dropshipping-beaute": "beaute-partenaires",
  "dropshipping-high-tech": "high-tech-partenaires",
  "dropshipping-accessoires": "accessoires-partenaires",
  "dropshipping-auto-moto": "auto-moto-partenaires",
  "dropshipping-animaux": "animaux-partenaires",
  "dropshipping-enfant": "enfant-partenaires",
  "dropshipping-mode": "mode-partenaires",
};

export function generateStaticParams() {
  return categories
    .filter(isPublicCategory)
    .map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  return {
    title: category && isPublicCategory(category) ? category.name : "Categorie",
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const legacyRedirect = legacyCategoryRedirects[slug];
  if (legacyRedirect) {
    redirect(`/categories/${legacyRedirect}`);
  }

  const category = getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  if (!isPublicCategory(category)) {
    redirect("/categories");
  }

  const subcategories = getSubcategoriesByParentId(category.id);
  const categoryProducts = await getPublicCatalogProductsByCategory(category.id);
  const productIds = categoryProducts.map((product) => product.id);
  const statsMap = await getProductStatsMap(
    productIds,
  );
  const reviewSummaryMap = await getApprovedReviewSummaryMap(productIds);

  return (
    <>
      <PageHeader
        eyebrow="Categorie"
        title={category.name}
        description={category.description}
      />
      <section className="container-page py-10">
        {subcategories.length > 0 ? (
          <div className="mb-10">
            <div className="mb-6">
              <p className="text-sm font-black uppercase text-teal">
                Sous-catégories
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Explorer ce rayon
              </h2>
            </div>
            <CategoryGrid items={subcategories} compact />
          </div>
        ) : null}
        {categoryProducts.length > 0 ? (
          <>
            {subcategories.length > 0 ? (
              <div className="mb-6">
                <p className="text-sm font-black uppercase text-teal">
                  Produits du rayon
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Arrivages disponibles
                </h2>
              </div>
            ) : null}
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {categoryProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  stats={statsMap.get(product.id)}
                  reviewSummary={reviewSummaryMap.get(product.id)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-line bg-paper p-8 text-center shadow-sm">
            <h2 className="text-2xl font-black">Produits partenaires en validation</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
              Ce rayon est pret. Les fiches dropshipping apparaîtront ici quand
              les images exactes, le stock, le delai et le partenaire logistique seront validés.
            </p>
            <Link
              href="/boutique"
              className="focus-ring mt-6 inline-flex min-h-11 items-center rounded-md bg-foreground px-5 py-2.5 text-sm font-black text-white hover:bg-[#2b2b2b]"
            >
              Retour boutique
            </Link>
          </div>
        )}
      </section>
    </>
  );
}

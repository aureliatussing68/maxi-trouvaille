import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { ProductCard } from "@/components/ProductCard";
import {
  categories,
  getCategoryBySlug,
} from "@/lib/catalog";
import { getCatalogProductsByCategory } from "@/lib/catalog-server";

export const dynamic = "force-dynamic";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  return {
    title: category ? category.name : "Categorie",
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const categoryProducts = await getCatalogProductsByCategory(category.id);

  return (
    <>
      <PageHeader
        eyebrow="Categorie"
        title={category.name}
        description={category.description}
      />
      <section className="container-page py-10">
        {categoryProducts.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {categoryProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-line bg-paper p-8 text-center shadow-sm">
            <h2 className="text-2xl font-black">Arrivage a venir</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
              Cette categorie est prete. Les vrais produits pourront etre ajoutes
              dans le catalogue des que les stocks sont disponibles.
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

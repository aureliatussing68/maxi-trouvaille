import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeEuro,
  Camera,
  Headphones,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { CategoryGrid } from "@/components/CategoryGrid";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";
import { PageHeader } from "@/components/PageHeader";
import { PartnerArticlePreviewPanel } from "@/components/PartnerArticlePreviewPanel";
import {
  PartnerCategoryDemoGuidePanel,
  PartnerCategoryRelayPanel,
  PartnerCategorySafePanel,
} from "@/components/PartnerMobileShowcasePanel";
import { ProductCard } from "@/components/ProductCard";
import {
  categories,
  getCategoryBySlug,
  getSubcategoriesByParentId,
  isDropshippingCategory,
  isDropshippingProduct,
  isPublicCategory,
} from "@/lib/catalog";
import {
  getCatalogProductsByCategory,
  getPublicCatalogProductsByCategory,
} from "@/lib/catalog-server";
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
  "colis-surprise-palettes": "produits-partenaires",
  "palettes-destockage": "promotions-partenaires",
  "colis-mysteres": "nouveautes-partenaires",
  "colis-au-poids": "promotions-partenaires",
  "lots-bonnes-affaires": "promotions-partenaires",
  "colis-surprise": "nouveautes-partenaires",
};

const validationSignals = [
  {
    icon: Camera,
    title: "Images exactes",
    text: "Les visuels produits sont publiés uniquement quand la photo exacte est validée.",
  },
  {
    icon: BadgeEuro,
    title: "Prix et stock",
    text: "Prix cible, disponibilité et conditions sont contrôlés avant affichage.",
  },
  {
    icon: Truck,
    title: "Livraison suivie",
    text: "Délai client et suivi colis Maxi Trouvaille sont préparés avant publication.",
  },
];

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
  const [categoryProducts, categoryCatalogProducts] = await Promise.all([
    getPublicCatalogProductsByCategory(category.id),
    getCatalogProductsByCategory(category.id),
  ]);
  const isPartnerCategory = isDropshippingCategory(category);
  const partnerCandidateCount = categoryCatalogProducts.filter(
    isDropshippingProduct,
  ).length;
  const partnerRelayItems = isPartnerCategory
    ? categories
        .filter((item) => item.parentId === "dropshipping" && item.slug !== category.slug)
        .slice(0, 6)
        .map((item, index) => ({
          href: `/categories/${item.slug}`,
          label: item.name,
          description: item.description,
          emphasis: index < 2 ? "Prioritaire" : "Rayon",
        }))
    : [];
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
        {isPartnerCategory ? (
          <div className="mb-10 grid gap-6">
            <PartnerCategorySafePanel
              categoryName={category.name}
              candidateCount={partnerCandidateCount}
              publicProductCount={categoryProducts.length}
              subcategoryCount={subcategories.length}
            />
            <PartnerCategoryDemoGuidePanel
              categoryName={category.name}
              candidateCount={partnerCandidateCount}
              publicProductCount={categoryProducts.length}
              subcategoryCount={subcategories.length}
            />
            <PartnerCategoryRelayPanel
              categoryName={category.name}
              items={partnerRelayItems}
            />
          </div>
        ) : null}
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
          <section className="grid gap-6 rounded-lg border border-line bg-[#faf7f0] p-5 shadow-sm sm:p-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="inline-flex items-center gap-2 rounded-md bg-[#eef8f6] px-3 py-2 text-sm font-black text-teal">
                <ShieldCheck size={16} aria-hidden="true" />
                Lancement maîtrisé
              </p>
              <h2 className="mt-4 text-2xl font-black">
                {category.name}: rayon prêt à montrer
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">
                {partnerCandidateCount > 0
                  ? `${partnerCandidateCount} fiches de ce rayon restent en validation. Elles seront publiées uniquement après validation des images exactes, du stock, du délai, des droits image et du partenaire logistique.`
                  : "Les produits de ce rayon seront publiés uniquement après validation des images exactes, du stock, du délai, des droits image et du partenaire logistique."}{" "}
                La page peut être montrée sans exposer de fiche non validée.
              </p>
            </div>

            <PartnerArticlePreviewPanel
              categorySlug={category.slug}
              className="bg-white"
            />

            <div className="grid gap-3 md:grid-cols-3">
              {validationSignals.map((signal) => {
                const Icon = signal.icon;

                return (
                  <article
                    key={signal.title}
                    className="rounded-lg border border-line bg-white p-4"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 text-base font-black">{signal.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {signal.text}
                    </p>
                  </article>
                );
              })}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Link
                href="/boutique"
                className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
              >
                Retour boutique
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link
                href="/suivi-colis"
                className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-black hover:bg-[#f1eadf]"
              >
                <Truck size={17} aria-hidden="true" />
                Suivi colis
              </Link>
              <Link
                href="/contact"
                className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-black hover:bg-[#f1eadf]"
              >
                <Headphones size={17} aria-hidden="true" />
                Service client
              </Link>
            </div>
          </section>
        )}
        <CustomerSupportQuickLinks className="mt-10" />
      </section>
    </>
  );
}

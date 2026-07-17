import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  BadgePercent,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { CategoryGrid } from "@/components/CategoryGrid";
import { PageHeader } from "@/components/PageHeader";
import { ProductCard } from "@/components/ProductCard";
import {
  categories,
  isDropshippingProduct,
  isNewProduct,
  isPromotionProduct,
} from "@/lib/catalog";
import { getPublicProducts } from "@/lib/catalog-server";
import { getApprovedReviewSummaryMap } from "@/lib/product-reviews";
import { getProductStatsMap } from "@/lib/product-stats";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Produits partenaires",
  description:
    "Produits partenaires, promotions et nouveautes vendus par Maxi Trouvaille avec paiement securise et suivi colis.",
};

export default async function PartnerProductsPage() {
  const allProducts = await getPublicProducts();
  const partnerProducts = allProducts.filter(isDropshippingProduct);
  const highlightedProducts = [
    ...partnerProducts.filter(isPromotionProduct),
    ...partnerProducts.filter(
      (product) => isNewProduct(product) && !isPromotionProduct(product),
    ),
    ...partnerProducts,
  ].filter(
    (product, index, source) =>
      source.findIndex((item) => item.id === product.id) === index,
  );
  const productIds = highlightedProducts.map((product) => product.id);
  const [statsMap, reviewSummaryMap] = await Promise.all([
    getProductStatsMap(productIds),
    getApprovedReviewSummaryMap(productIds),
  ]);
  const partnerCategories = categories.filter(
    (category) => category.parentId === "dropshipping",
  );

  return (
    <>
      <PageHeader
        eyebrow="Produits partenaires"
        title="Produits partenaires Maxi Trouvaille"
        description="Produits vendus sur Maxi Trouvaille : paiement securise, service client Maxi Trouvaille, suivi colis et expedition par partenaire logistique."
      />

      <section className="container-page border-b border-line py-8">
        <div className="grid gap-4 md:grid-cols-3">
          <TrustItem
            icon={<ShieldCheck size={22} aria-hidden="true" />}
            title="Paiement sécurisé"
            text="Le client paie uniquement sur Maxi Trouvaille via Stripe."
          />
          <TrustItem
            icon={<Truck size={22} aria-hidden="true" />}
            title="Livraison estimée"
            text="Chaque fiche affiche un délai propre et un suivi colis dès expédition."
          />
          <TrustItem
            icon={<PackageCheck size={22} aria-hidden="true" />}
            title="Validation humaine"
            text="La commande fournisseur reste validée manuellement au début."
          />
        </div>
      </section>

      <section className="container-page py-10">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase text-teal">Rayons</p>
            <h2 className="mt-2 text-2xl font-black">
              Promotions et nouveautés en avant
            </h2>
          </div>
          <Link
            href="/categories/produits-partenaires"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
          >
            Toutes les sous-catégories
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <CategoryGrid items={partnerCategories} compact />
      </section>

      <section className="container-page pb-12">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="flex items-center gap-2 text-sm font-black uppercase text-teal">
              <BadgePercent size={16} aria-hidden="true" />
              Sélection partenaire
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Produits partenaires disponibles
            </h2>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-md bg-[#eff6ff] px-3 py-2 text-sm font-black text-[#1d4ed8]">
            <Sparkles size={16} aria-hidden="true" />
            Nouveautés
          </span>
        </div>

        {highlightedProducts.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {highlightedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                stats={statsMap.get(product.id)}
                reviewSummary={reviewSummaryMap.get(product.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-line bg-paper p-8 text-center shadow-sm">
            <h2 className="text-2xl font-black">Produits partenaires à venir</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
              La catégorie est prête. Les imports validés apparaîtront ici.
            </p>
          </div>
        )}
      </section>
    </>
  );
}

function TrustItem({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-lg border border-line bg-paper p-5 shadow-sm">
      <div className="flex items-center gap-3 text-teal">
        {icon}
        <h2 className="text-base font-black">{title}</h2>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">{text}</p>
    </article>
  );
}

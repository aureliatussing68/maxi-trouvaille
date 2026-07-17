import Link from "next/link";
import { ArrowRight, Boxes, ShieldCheck, Truck } from "lucide-react";
import { CategoryGrid } from "@/components/CategoryGrid";
import { HeroCarousel } from "@/components/HeroCarousel";
import { ProductCard } from "@/components/ProductCard";
import { isProductPurchasable } from "@/lib/catalog";
import { getPublicProducts } from "@/lib/catalog-server";
import { getApprovedReviewSummaryMap } from "@/lib/product-reviews";
import { getProductStatsMap } from "@/lib/product-stats";

const quickSignals = [
  {
    icon: Boxes,
    title: "Dropshipping encadré",
    text: "Produits partenaires préparés avant mise en vente.",
  },
  {
    icon: ShieldCheck,
    title: "Validation humaine",
    text: "Aucun achat partenaire lancé sans contrôle manuel.",
  },
  {
    icon: Truck,
    title: "Suivi colis",
    text: "Livraison estimée et service client Maxi Trouvaille.",
  },
];

export default async function Home() {
  const products = (await getPublicProducts())
    .filter(isProductPurchasable)
    .slice(0, 6);
  const productIds = products.map((product) => product.id);
  const [statsMap, reviewSummaryMap] = await Promise.all([
    getProductStatsMap(productIds),
    getApprovedReviewSummaryMap(productIds),
  ]);

  return (
    <>
      <section className="relative min-h-[calc(100svh-4rem)] overflow-hidden bg-[#171717] text-white">
        <HeroCarousel />
        <div className="container-page relative flex min-h-[calc(100svh-4rem)] items-center py-14">
          <div className="max-w-2xl">
            <h1 className="text-balance text-5xl font-black leading-[0.98] sm:text-7xl">
              Maxi Trouvaille
            </h1>
            <p className="mt-5 max-w-xl text-xl font-black leading-8 text-white/92 sm:text-2xl">
              Boutique dropshipping en préparation: produits utiles, prix clairs
              et expédition par partenaires logistiques.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/produits-partenaires"
                className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand px-5 py-3 text-sm font-black text-foreground hover:bg-[#ffd166]"
              >
                Voir le dropshipping
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                href="/categories/nouveautes-partenaires"
                className="focus-ring inline-flex min-h-12 items-center justify-center rounded-md border border-white/45 px-5 py-3 text-sm font-black text-white hover:bg-white/10"
              >
                Nouveautés
              </Link>
              <Link
                href="/categories/promotions-partenaires"
                className="focus-ring inline-flex min-h-12 items-center justify-center rounded-md border border-white/45 px-5 py-3 text-sm font-black text-white hover:bg-white/10"
              >
                Promotions
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-paper">
        <div className="container-page grid gap-3 py-5 md:grid-cols-3">
          {quickSignals.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="flex gap-3 rounded-lg border border-line p-4"
              >
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-black">{item.title}</h2>
                  <p className="mt-1 text-sm leading-5 text-muted">
                    {item.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="container-page py-10">
        <div className="mb-6">
          <p className="text-sm font-black uppercase text-teal">Rayons principaux</p>
          <h2 className="mt-2 text-2xl font-black">Rayons dropshipping prioritaires</h2>
        </div>
        <CategoryGrid compact featuredOnly />
      </section>

      {products.length > 0 ? (
        <section className="container-page border-t border-line py-10">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-black uppercase text-teal">
                Sélection du moment
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Produits à découvrir maintenant
              </h2>
            </div>
            <Link
              href="/boutique"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
            >
              Voir toute la boutique
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                stats={statsMap.get(product.id)}
                reviewSummary={reviewSummaryMap.get(product.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-t border-line bg-paper">
        <div className="container-page flex flex-col justify-between gap-4 py-8 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-black uppercase text-teal">
              Sélection du moment
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Produits partenaires en validation
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Les fiches dropshipping restent en préparation tant que les images,
              le prix, le stock, le delai et le partenaire logistique ne sont pas prouves.
              Le site est volontairement strict pour éviter les mauvaises commandes.
            </p>
          </div>
          <Link
            href="/produits-partenaires"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
          >
            Voir la sélection
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}

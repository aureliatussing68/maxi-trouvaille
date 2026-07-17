import Link from "next/link";
import {
  ArrowRight,
  CreditCard,
  Headphones,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { CategoryGrid } from "@/components/CategoryGrid";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";
import { HeroCarousel } from "@/components/HeroCarousel";
import { ProductCard } from "@/components/ProductCard";
import { isProductPurchasable, isPromotionProduct } from "@/lib/catalog";
import { getPublicProducts } from "@/lib/catalog-server";
import { getApprovedReviewSummaryMap } from "@/lib/product-reviews";
import { getProductStatsMap } from "@/lib/product-stats";

const quickSignals = [
  {
    icon: CreditCard,
    title: "Paiement sécurisé",
    text: "Carte bancaire via Stripe, sans création de compte obligatoire.",
  },
  {
    icon: Truck,
    title: "Livraison suivie",
    text: "Expédition avec numéro de suivi, livraison estimée 7 à 14 jours ouvrés.",
  },
  {
    icon: Headphones,
    title: "Service client",
    text: "Une question sur une commande ? Réponse rapide par la messagerie du site.",
  },
];

const customerSignals = [
  {
    icon: Sparkles,
    title: "Nouveautés régulières",
    text: "De nouveaux produits malins ajoutés au fil des semaines dans chaque rayon.",
    href: "/nouveautes",
    cta: "Voir les nouveautés",
  },
  {
    icon: CreditCard,
    title: "Paiement simple",
    text: "Panier, adresse, paiement par carte : trois étapes et c'est commandé.",
    href: "/paiement",
    cta: "Voir le paiement",
  },
  {
    icon: Truck,
    title: "Suivi colis",
    text: "Retrouvez votre suivi directement depuis Maxi Trouvaille, avec un interlocuteur unique.",
    href: "/suivi-colis",
    cta: "Suivre un colis",
  },
  {
    icon: Headphones,
    title: "Service client",
    text: "Les questions livraison, paiement et commande passent par Maxi Trouvaille.",
    href: "/contact",
    cta: "Contacter",
  },
];

export default async function Home() {
  const publicProducts = await getPublicProducts();
  const purchasable = publicProducts.filter(isProductPurchasable);
  const products = purchasable.slice(0, 8);
  const promoCount = purchasable.filter(isPromotionProduct).length;
  const productIds = products.map((product) => product.id);
  const [statsMap, reviewSummaryMap] = await Promise.all([
    getProductStatsMap(productIds),
    getApprovedReviewSummaryMap(productIds),
  ]);

  return (
    <>
      <section className="relative min-h-[78svh] overflow-hidden bg-[#171717] text-white sm:min-h-[calc(86svh-4rem)]">
        <HeroCarousel />
        <div className="container-page relative flex min-h-[78svh] items-center py-12 sm:min-h-[calc(86svh-4rem)] sm:py-14">
          <div className="max-w-2xl">
            <h1 className="text-balance text-5xl font-black leading-[0.98] sm:text-7xl">
              Maxi Trouvaille
            </h1>
            <p className="mt-5 max-w-xl text-xl font-black leading-8 text-white/92 sm:text-2xl">
              Les trouvailles malignes du moment, à petits prix : maison,
              cuisine, high-tech, auto, animaux et plus encore.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/boutique"
                className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand px-5 py-3 text-sm font-black text-foreground hover:bg-[#ffd166]"
              >
                Voir la boutique
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                href="/promotions"
                className="focus-ring inline-flex min-h-12 items-center justify-center rounded-md border border-white/45 px-5 py-3 text-sm font-black text-white hover:bg-white/10"
              >
                Promotions
              </Link>
              <Link
                href="/suivi-colis"
                className="focus-ring inline-flex min-h-12 items-center justify-center rounded-md border border-white/45 px-5 py-3 text-sm font-black text-white hover:bg-white/10"
              >
                Suivi colis
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
          <p className="text-sm font-black uppercase text-teal">Nos rayons</p>
          <h2 className="mt-2 text-2xl font-black">
            Trouvez votre bonheur par univers
          </h2>
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
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
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

      <section className="border-y border-line bg-[#faf7f0]">
        <div className="container-page py-10">
          <div className="mb-6 max-w-3xl">
            <p className="text-sm font-black uppercase text-teal">
              Acheter en confiance
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Une boutique simple, du panier au colis
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Des rayons clairs, un paiement sécurisé par carte, un suivi colis
              et un service client identifié : tout se passe sur Maxi
              Trouvaille.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {customerSignals.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="focus-ring group flex min-h-52 flex-col justify-between rounded-lg border border-line bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#d5c8b7] hover:shadow-md"
                >
                  <span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    <span className="mt-4 block text-base font-black group-hover:text-teal">
                      {item.title}
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-muted">
                      {item.text}
                    </span>
                  </span>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-teal">
                    {item.cta}
                    <ArrowRight size={15} aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {promoCount > 0 ? (
        <section className="border-t border-line bg-paper">
          <div className="container-page flex flex-col justify-between gap-4 py-8 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-black uppercase text-teal">
                Bons plans
              </p>
              <h2 className="mt-2 text-2xl font-black">
                {promoCount} produit{promoCount > 1 ? "s" : ""} en promotion en
                ce moment
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                Prix barrés, petites séries et bonnes affaires : la sélection
                promo est mise à jour régulièrement.
              </p>
            </div>
            <Link
              href="/promotions"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
            >
              Voir les promotions
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : null}

      <section className="container-page py-10">
        <ShieldCheckStrip />
        <CustomerSupportQuickLinks className="mt-8" />
      </section>
    </>
  );
}

function ShieldCheckStrip() {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-line bg-paper p-5 sm:flex-row sm:items-center">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
        <ShieldCheck size={20} aria-hidden="true" />
      </span>
      <p className="text-sm leading-6 text-muted">
        <span className="font-black text-foreground">
          Commande protégée :
        </span>{" "}
        paiement par carte sécurisé, droit de rétractation de 14 jours et
        service client basé en France. Voir nos{" "}
        <Link href="/cgv" className="font-black text-teal underline">
          conditions générales de vente
        </Link>
        .
      </p>
    </div>
  );
}

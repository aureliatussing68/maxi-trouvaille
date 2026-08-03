import Link from "next/link";
import {
  BadgePercent,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";
import { PageHeader } from "@/components/PageHeader";
import { ProductCard } from "@/components/ProductCard";
import {
  isDropshippingProduct,
  isNewProduct,
  isPromotionProduct,
} from "@/lib/catalog";
import { getPublicProducts } from "@/lib/catalog-server";
import type { PublicProduct } from "@/lib/public-product";
import { getApprovedReviewSummaryMap } from "@/lib/product-reviews";
import { getProductStatsMap } from "@/lib/product-stats";

type CampaignKind = "new" | "promotion";

type CampaignConfig = {
  badge: string;
  description: string;
  icon: LucideIcon;
  name: string;
  title: string;
  matchesProduct: (product: PublicProduct) => boolean;
};

const campaignConfigs: Record<CampaignKind, CampaignConfig> = {
  new: {
    badge: "Nouveautés",
    description:
      "Les derniers produits arrivés chez Maxi Trouvaille : des trouvailles malignes ajoutées régulièrement, à découvrir en premier.",
    icon: Sparkles,
    name: "Nouveautés",
    title: "Les nouveautés du moment",
    matchesProduct: isNewProduct,
  },
  promotion: {
    badge: "Promotions",
    description:
      "Prix barrés et bonnes affaires : la sélection promo Maxi Trouvaille, mise à jour régulièrement.",
    icon: BadgePercent,
    name: "Promotions",
    title: "Toutes les promotions",
    matchesProduct: isPromotionProduct,
  },
};

const trustCards: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: CreditCard,
    title: "Paiement sécurisé",
    text: "Carte bancaire via Stripe, vos données ne passent jamais par nos serveurs.",
  },
  {
    icon: Truck,
    title: "Livraison suivie",
    text: "Numéro de suivi et réception estimée 7 à 14 jours ouvrés.",
  },
  {
    icon: ShieldCheck,
    title: "Achat protégé",
    text: "Rétractation 14 jours et service client Maxi Trouvaille.",
  },
];

export async function PartnerCampaignLanding({ kind }: { kind: CampaignKind }) {
  const config = campaignConfigs[kind];
  const publicProducts = await getPublicProducts();
  const campaignProducts = publicProducts
    .filter(isDropshippingProduct)
    .filter(config.matchesProduct)
    .slice(0, 48);
  const productIds = campaignProducts.map((product) => product.id);
  const [statsMap, reviewSummaryMap] = await Promise.all([
    getProductStatsMap(productIds),
    getApprovedReviewSummaryMap(productIds),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={config.badge}
        title={config.title}
        description={config.description}
      />

      <section className="container-page py-8">
        {campaignProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {campaignProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                stats={statsMap.get(product.id)}
                reviewSummary={reviewSummaryMap.get(product.id)}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-line bg-paper p-5 text-sm leading-6 text-muted">
            De nouveaux produits arrivent très bientôt. En attendant, découvrez
            la{" "}
            <Link href="/boutique" className="font-black text-teal underline">
              boutique complète
            </Link>
            .
          </p>
        )}
      </section>

      <section className="container-page border-t border-line py-10">
        <div className="grid gap-3 md:grid-cols-3">
          {trustCards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.title}
                className="rounded-lg border border-line bg-paper p-4 shadow-sm"
              >
                <Icon className="text-teal" size={22} aria-hidden="true" />
                <h2 className="mt-3 text-base font-bold">{card.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{card.text}</p>
              </div>
            );
          })}
        </div>
        <CustomerSupportQuickLinks className="mt-10" />
      </section>
    </>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  CreditCard,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { CategoryGrid } from "@/components/CategoryGrid";
import { CustomerJourneyPanel } from "@/components/CustomerJourneyPanel";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";
import { MobilePresentationPathPanel } from "@/components/MobilePresentationPathPanel";
import { PageHeader } from "@/components/PageHeader";
import { PartnerArticlePreviewPanel } from "@/components/PartnerArticlePreviewPanel";
import { ProductCard } from "@/components/ProductCard";
import { StorefrontReadinessPanel } from "@/components/StorefrontReadinessPanel";
import {
  categories,
  getCategoryBySlug,
  isDropshippingCategory,
  isDropshippingProduct,
  isNewProduct,
  isPromotionProduct,
  type Product,
} from "@/lib/catalog";
import { getAllProducts, getPublicProducts } from "@/lib/catalog-server";
import { getApprovedReviewSummaryMap } from "@/lib/product-reviews";
import { getProductStatsMap } from "@/lib/product-stats";

type CampaignKind = "new" | "promotion";

type CampaignConfig = {
  badge: string;
  categorySlug: string;
  ctaLabel: string;
  description: string;
  emptyTitle: string;
  icon: LucideIcon;
  kind: CampaignKind;
  name: string;
  title: string;
  titleWhenReady: string;
  matchesProduct: (product: Product) => boolean;
};

const campaignConfigs: Record<CampaignKind, CampaignConfig> = {
  new: {
    badge: "Nouveautés partenaires",
    categorySlug: "nouveautes-partenaires",
    ctaLabel: "Voir les nouveautés",
    description:
      "Nouveautés produits partenaires préparées par Maxi Trouvaille, avec paiement Maxi Trouvaille, suivi colis et publication seulement après validation complète.",
    emptyTitle: "Les nouveautés arrivent après validation",
    icon: Sparkles,
    kind: "new",
    name: "Nouveautés",
    title: "Nouveautés produits partenaires",
    titleWhenReady: "Nouveautés validées",
    matchesProduct: isNewProduct,
  },
  promotion: {
    badge: "Promotions partenaires",
    categorySlug: "promotions-partenaires",
    ctaLabel: "Voir les promotions",
    description:
      "Promotions produits partenaires préparées par Maxi Trouvaille, avec paiement Maxi Trouvaille, suivi colis et offres publiées seulement quand la validation est complète.",
    emptyTitle: "Les promotions restent en validation",
    icon: BadgePercent,
    kind: "promotion",
    name: "Promotions",
    title: "Promotions produits partenaires",
    titleWhenReady: "Promotions validées",
    matchesProduct: isPromotionProduct,
  },
};

const emptyCampaignTrustCards: Array<{
  icon: LucideIcon;
  title: string;
  text: string;
}> = [
  {
    icon: ShieldCheck,
    title: "Validation avant vente",
    text: "Chaque fiche attend image exacte, prix clair, stock suivi et validation humaine avant d'apparaitre comme achetable.",
  },
  {
    icon: CreditCard,
    title: "Paiement Maxi Trouvaille",
    text: "Le parcours reste sous l'identite Maxi Trouvaille, avec une fiche lisible avant toute action de paiement.",
  },
  {
    icon: Truck,
    title: "Suivi colis centralise",
    text: "Les informations de livraison et de service client restent regroupees dans le parcours Maxi Trouvaille.",
  },
];

export async function PartnerCampaignLanding({ kind }: { kind: CampaignKind }) {
  const config = campaignConfigs[kind];
  const Icon = config.icon;
  const [publicProducts, catalogProducts] = await Promise.all([
    getPublicProducts(),
    getAllProducts(),
  ]);
  const partnerProducts = publicProducts.filter(isDropshippingProduct);
  const campaignProducts = partnerProducts
    .filter(config.matchesProduct)
    .slice(0, 6);
  const partnerCandidateCount = catalogProducts.filter(isDropshippingProduct).length;
  const campaignCandidateCount = catalogProducts.filter(
    (product) => isDropshippingProduct(product) && config.matchesProduct(product),
  ).length;
  const partnerCategoryCount = categories.filter(isDropshippingCategory).length;
  const campaignCategory = getCategoryBySlug(config.categorySlug);
  const productIds = campaignProducts.map((product) => product.id);
  const [statsMap, reviewSummaryMap] = await Promise.all([
    getProductStatsMap(productIds),
    getApprovedReviewSummaryMap(productIds),
  ]);
  const statusText =
    campaignProducts.length > 0
      ? `${campaignProducts.length} article${
          campaignProducts.length > 1 ? "s" : ""
        } prêt${campaignProducts.length > 1 ? "s" : ""}`
      : "Validation active";

  return (
    <>
      <PageHeader
        eyebrow={config.badge}
        title={config.title}
        description={config.description}
      />

      <section className="container-page border-b border-line py-8">
        <div className="grid gap-5 rounded-lg border border-line bg-paper p-5 shadow-sm lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-md bg-[#eef8f6] px-3 py-2 text-sm font-black uppercase text-teal">
              <Icon size={16} aria-hidden="true" />
              Vitrine mobile
            </p>
            <h2 className="mt-4 text-2xl font-black leading-tight sm:text-3xl">
              {config.name} lisibles, vente protégée.
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">
              Le visiteur peut ouvrir le rayon, comprendre le paiement Maxi
              Trouvaille, retrouver le suivi colis et voir que les articles ne
              sont proposés qu&apos;après validation.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Link
                href={`/categories/${config.categorySlug}`}
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
              >
                {config.ctaLabel}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                href="/paiement"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-black hover:bg-[#f1eadf]"
              >
                <CreditCard size={16} aria-hidden="true" />
                Paiement
              </Link>
              <Link
                href="/suivi-colis"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-black hover:bg-[#f1eadf]"
              >
                <Truck size={16} aria-hidden="true" />
                Suivi colis
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <StatusCard
              icon={PackageCheck}
              label="Fiches préparées"
              value={`${campaignCandidateCount} contrôle${
                campaignCandidateCount > 1 ? "s" : ""
              }`}
            />
            <StatusCard icon={ShieldCheck} label="Vente protégée" value={statusText} />
            <StatusCard
              icon={Truck}
              label="Service client"
              value="Maxi Trouvaille"
            />
          </div>
        </div>

        <MobilePresentationPathPanel
          className="mt-8"
          categoryCount={partnerCategoryCount}
          candidateCount={campaignCandidateCount || partnerCandidateCount}
          publicProductCount={campaignProducts.length}
        />
      </section>

      <section className="container-page border-b border-line py-10">
        <StorefrontReadinessPanel
          publicProductCount={campaignProducts.length}
          partnerCandidateCount={campaignCandidateCount || partnerCandidateCount}
          categoryCount={partnerCategoryCount}
        />
        <PartnerArticlePreviewPanel
          categorySlug={config.categorySlug}
          className="mt-10"
        />
        <CustomerJourneyPanel className="mt-10" />
        <CustomerSupportQuickLinks className="mt-10" />
      </section>

      <section className="container-page py-10">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase text-teal">
              Rayon prioritaire
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {campaignCategory?.name ?? config.name}
            </h2>
          </div>
          <Link
            href="/produits-partenaires"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
          >
            Tous les produits partenaires
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        {campaignCategory ? (
          <CategoryGrid items={[campaignCategory]} compact variant="simple" />
        ) : null}
      </section>

      <section className="container-page pb-12">
        <div className="mb-7">
          <p className="text-sm font-black uppercase text-teal">
            Sélection du moment
          </p>
          <h2 className="mt-2 text-2xl font-black">
            {campaignProducts.length > 0
              ? config.titleWhenReady
              : config.emptyTitle}
          </h2>
        </div>

        {campaignProducts.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
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
          <div className="grid gap-5 rounded-lg border border-[#fed7aa] bg-[#fff7ed] p-5">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase text-[#9a3412]">
                Sélection en vérification
              </p>
              <h3 className="mt-2 text-xl font-black text-foreground">
                Le rayon reste propre, aucun article n&apos;est poussé trop tôt.
              </h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#9a3412]">
                La sélection reste volontairement limitée tant que les preuves
                importantes ne sont pas terminées. Le visiteur voit un parcours
                clair, mais la vente reste fermée jusqu&apos;à validation complète.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {emptyCampaignTrustCards.map((card) => {
                const TrustIcon = card.icon;

                return (
                  <article
                    key={card.title}
                    className="rounded-md border border-[#fed7aa] bg-white p-4"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                      <TrustIcon size={19} aria-hidden="true" />
                    </span>
                    <h4 className="mt-3 text-base font-black text-foreground">
                      {card.title}
                    </h4>
                    <p className="mt-2 text-sm font-semibold leading-6 text-muted">
                      {card.text}
                    </p>
                  </article>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Link
                href="/paiement"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
              >
                <CreditCard size={16} aria-hidden="true" />
                Paiement
              </Link>
              <Link
                href="/suivi-colis"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#fed7aa] bg-white px-4 text-sm font-black hover:bg-[#f1eadf]"
              >
                <Truck size={16} aria-hidden="true" />
                Suivi colis
              </Link>
              <Link
                href="/produits-partenaires"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#fed7aa] bg-white px-4 text-sm font-black hover:bg-[#f1eadf]"
              >
                <PackageCheck size={16} aria-hidden="true" />
                Produits partenaires
              </Link>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-md border border-line bg-[#fbfaf7] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-teal">{value}</p>
          <h3 className="mt-1 text-base font-black">{label}</h3>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
          <Icon size={19} aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  CreditCard,
  Headphones,
  RotateCcw,
  Sparkles,
  Truck,
} from "lucide-react";
import { CategoryGrid } from "@/components/CategoryGrid";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";
import { HeroCarousel } from "@/components/HeroCarousel";
import { ProductCard } from "@/components/ProductCard";
import { ProductShelf, type ProductShelfItem } from "@/components/ProductShelf";
import {
  countProductsByCategory,
  homeShowcaseCategoryIds,
  isPromotionProduct,
} from "@/lib/catalog";
import { getPublicProducts } from "@/lib/catalog-server";
import type { PublicProduct } from "@/lib/public-product";
import { SERVICE_PROMISE } from "@/lib/copy";
import {
  buildHomeShowcasePool,
  getParisDayIndex,
  selectHomeShowcase,
} from "@/lib/home-rotation";
import {
  getApprovedReviewSummaryMap,
  type ProductReviewSummary,
} from "@/lib/product-reviews";

// La vitrine change une fois par jour (heure de Paris). Sans revalidation, la
// page d'accueil resterait gelee au dernier deploiement et la rotation ne se
// verrait jamais. Effet de bord utile : les nouveaux produits apparaissent sur
// l'accueil dans l'heure, sans redeploiement.
export const revalidate = 3600;

/**
 * UN seul bandeau de reassurance sur la page.
 *
 * Avant, la moitie basse de l'accueil repetait quatre fois le meme message :
 * quatorze cartes de reassurance en tout, "Suivi colis" quatre fois, "Service
 * client" trois fois — avec trois promesses differentes et legerement
 * contradictoires. Cette accumulation est exactement ce qui fait "site bricole
 * au fil du temps". Il ne reste qu'un bandeau ici, et une seule section d'aide
 * juste avant le pied de page.
 */
const quickSignals = [
  {
    icon: CreditCard,
    title: "Paiement sécurisé",
    text: "Carte bancaire, sans création de compte obligatoire.",
    href: "/paiement",
  },
  {
    icon: Truck,
    title: "Livraison suivie",
    text: "Un numéro sur chaque commande, suivi colis en un clic.",
    href: "/suivi-colis",
  },
  {
    icon: RotateCcw,
    title: "14 jours pour changer d'avis",
    text: "Droit de rétractation, procédure simple et claire.",
    href: "/retours-remboursements",
  },
  {
    icon: Headphones,
    title: "Service client",
    text: SERVICE_PROMISE,
    href: "/contact",
  },
];

// Une panne de base de donnees ne doit jamais casser la page d'accueil : la
// carte produit masque deja d'elle-meme les avis et compteurs absents.
async function loadReviewSummaries(productIds: string[]) {
  if (productIds.length === 0) {
    return new Map<string, ProductReviewSummary>();
  }

  try {
    return await getApprovedReviewSummaryMap(productIds);
  } catch {
    return new Map<string, ProductReviewSummary>();
  }
}

export default async function Home() {
  const publicProducts = await getPublicProducts();
  // Verdict d'achat deja rendu par le serveur (getPublicProducts) : il n'a plus
  // besoin d'etre recalcule, et surtout il n'oblige plus a transporter le
  // dossier de sourcing jusqu'ici.
  const purchasable = publicProducts.filter((product) => product.isPurchasable);
  const promoCount = purchasable.filter(isPromotionProduct).length;
  // Chiffres reels du catalogue, recalcules a chaque revalidation : rien en dur.
  const productCountByCategoryId = countProductsByCategory(
    publicProducts,
    homeShowcaseCategoryIds,
  );
  const shopProductCount = publicProducts.length;

  const showcasePool = buildHomeShowcasePool(purchasable);
  const reviewSummaryMap = await loadReviewSummaries(
    showcasePool.map((product) => product.id),
  );
  // Seul signal client authentique du site : un avis reellement approuve.
  // Ce groupe est vide aujourd'hui, la rotation est donc parfaitement equitable.
  const reviewedProductIds = new Set(
    [...reviewSummaryMap.entries()]
      .filter(([, summary]) => summary.totalReviews > 0)
      .map(([productId]) => productId),
  );

  const showcase = selectHomeShowcase({
    pool: showcasePool,
    dayIndex: getParisDayIndex(),
    featuredIds: reviewedProductIds,
  });

  // La vitrine ne recoit aucun compteur de vues : a la premiere visite ils
  // afficheraient "1 vue" sur chaque carte, ce qui dessert la boutique.
  const toShelfItem = (product: PublicProduct): ProductShelfItem => ({
    product,
    reviewSummary: reviewSummaryMap.get(product.id),
  });

  const products = showcase.grid;

  return (
    <>
      {/* Hero volontairement court : le haut du carrousel de produits doit
          apparaitre sans avoir a faire defiler la page. */}
      <section className="relative min-h-[38svh] overflow-hidden bg-[#171717] text-white sm:min-h-[calc(56svh-4rem)]">
        <HeroCarousel />
        {/* pb-16 sur mobile : reserve la bande du bas au libelle du diaporama. */}
        <div className="container-page relative flex min-h-[38svh] items-center py-8 pb-16 sm:min-h-[calc(56svh-4rem)] sm:py-12">
          <div className="max-w-2xl">
            <h1 className="text-balance text-4xl font-black leading-[0.98] sm:text-6xl">
              Maxi Trouvaille
            </h1>
            {/* Graisse normale, pas 900 : quand tout est en gras maximum, plus
                rien ne ressort. Le titre reste seul en tete d'affiche. */}
            <p className="mt-4 max-w-lg text-base font-medium leading-6 text-white/90 sm:mt-5 sm:text-xl sm:leading-8">
              Les trouvailles malignes du moment, à petits prix : maison,
              cuisine, high-tech, auto, animaux et plus encore.
            </p>
            {/* Une seule action principale. "Suivi colis" est un service
                apres-vente : le mettre au meme niveau que "Voir la boutique"
                dans les trois premieres secondes disait au client "ici on gere
                des problemes de livraison". Il est reste dans le menu, la barre
                du bas et le pied de page. */}
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 sm:mt-8">
              <Link
                href="/boutique"
                className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand px-6 py-3 text-[15px] font-bold text-foreground shadow-lg shadow-black/20 transition hover:bg-[#ffd166]"
              >
                Voir la boutique
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                href="/promotions"
                className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-white/85 underline-offset-4 transition hover:text-white hover:underline"
              >
                Voir les promotions
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Le carrousel passe avant le bandeau de reassurance : c'est la premiere
          chose que le client doit voir en arrivant.
          Le carrousel ET la grille sont dans UNE seule section. Avant, deux
          blocs faisaient exactement le meme travail a 2 000 px d'intervalle,
          avec deux titres differents pour les memes cartes. */}
      {showcase.shelf.length > 0 ? (
        <section
          className="container-page py-7 sm:py-10"
          aria-roledescription="carrousel"
          aria-labelledby="trouvailles-du-jour-titre"
        >
          <ProductShelf
            items={showcase.shelf.map(toShelfItem)}
            label={`Les trouvailles du jour, ${showcase.shelf.length} produits`}
            header={
              <>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal">
                  Chaque jour
                </p>
                <h2
                  id="trouvailles-du-jour-titre"
                  className="mt-2 text-[26px] font-black leading-tight sm:text-3xl"
                >
                  Les trouvailles du jour
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-muted">
                  Une sélection en stock, renouvelée chaque jour.{" "}
                  <span className="lg:hidden">Faites glisser.</span>
                  <span className="hidden lg:inline">
                    Utilisez les flèches pour voir la suite.
                  </span>
                </p>
              </>
            }
          />

          {products.length > 0 ? (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  reviewSummary={reviewSummaryMap.get(product.id)}
                  variant="showcase"
                />
              ))}
            </div>
          ) : null}

          <div className="mt-7 flex justify-center">
            <Link
              href="/boutique"
              className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-line bg-paper px-6 text-sm font-bold shadow-sm transition hover:bg-[#f1eadf]"
            >
              Voir toute la boutique
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : null}

      <section
        className="border-y border-line bg-paper"
        aria-label="Nos engagements : paiement, livraison, retours et service client"
      >
        <div className="container-page grid grid-cols-2 gap-x-4 gap-y-5 py-6 lg:grid-cols-4">
          {quickSignals.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                className="focus-ring group flex gap-3 rounded-md transition"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold leading-4 group-hover:text-teal">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-[13px] leading-5 text-muted">
                    {item.text}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="container-page py-10">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal">
            Nos rayons
          </p>
          <h2 className="mt-2 text-[26px] font-black leading-tight sm:text-3xl">
            Trouvez votre bonheur par univers
          </h2>
          {/* Les deux nombres viennent du catalogue, ils ne sont pas ecrits en
              dur : ils suivent tout seuls les ajouts de produits. */}
          <p className="mt-2 text-sm leading-6 text-muted">
            {homeShowcaseCategoryIds.length} rayons, {shopProductCount} produits
            en ligne. Ouvrez un rayon pour voir tous ses produits.
          </p>
        </div>
        {/* Nouveautes et Promotions sortent de la grille : ce sont des vues
            filtrees de la boutique, pas des univers de produits. En tuile,
            elles se faisaient passer pour des rayons. */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:max-w-lg">
          <Link
            href="/nouveautes"
            className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-line bg-paper px-3 text-sm font-bold hover:bg-[#f1eadf]"
          >
            <Sparkles size={16} aria-hidden="true" />
            Nouveautés
          </Link>
          <Link
            href="/promotions"
            className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-line bg-paper px-3 text-sm font-bold hover:bg-[#f1eadf]"
          >
            <BadgePercent size={16} aria-hidden="true" />
            Promotions
          </Link>
        </div>
        <CategoryGrid
          compact
          featuredOnly
          productCountByCategoryId={productCountByCategoryId}
          trailingTile={{
            href: "/boutique",
            label: "Toute la boutique",
            hint: `${shopProductCount} produits`,
          }}
        />
      </section>

      {promoCount > 0 ? (
        <section className="border-t border-line bg-[#faf7f0]">
          <div className="container-page flex flex-col justify-between gap-4 py-8 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal">
                Bons plans
              </p>
              <h2 className="mt-2 text-[26px] font-black leading-tight sm:text-3xl">
                {promoCount} produit{promoCount > 1 ? "s" : ""} à prix réduit en
                ce moment
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                Une vraie sélection, pas tout le catalogue : seules les remises
                d&apos;au moins 30 % apparaissent ici.
              </p>
            </div>
            <Link
              href="/promotions"
              className="focus-ring inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-foreground px-5 text-sm font-bold text-white shadow-sm hover:bg-[#2b2b2b]"
            >
              Voir les promotions
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : null}

      <section className="container-page py-10">
        <CustomerSupportQuickLinks />
      </section>
    </>
  );
}

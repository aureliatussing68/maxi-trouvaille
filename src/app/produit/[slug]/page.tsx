import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Boxes,
  CheckCircle2,
  LockKeyhole,
  MessageCircle,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductEngagement } from "@/components/ProductEngagement";
import { ProductMessageForm } from "@/components/ProductMessageForm";
import { ReviewSummaryBadge } from "@/components/ReviewStars";
import { isAdminModeEnabled } from "@/lib/admin";
import {
  getCategoryById,
  getProductImageAlt,
  getProductBadges,
  getProductSeoDescription,
  getProductSeoTitle,
  getPublicDeliveryEstimate,
  isComingSoonProduct,
  isDropshippingProduct,
  isPublicProduct,
  isProductPurchasable,
  type ProductBadgeTone,
} from "@/lib/catalog";
import {
  getCatalogProductBySlug,
  getPublicCatalogProductBySlug,
  getPublicProducts,
} from "@/lib/catalog-server";
import { formatPrice } from "@/lib/format";
import {
  getDisplayDeliveryEstimate,
  getDisplayProductName,
  getPublicDescription,
  getPublicFeatures,
  getStockLabel,
  shouldShowReferencePrice,
} from "@/lib/product-display";
import {
  getApprovedReviewsForProduct,
  getApprovedReviewSummary,
} from "@/lib/product-reviews";
import { getProductStats } from "@/lib/product-stats";

export const dynamicParams = false;

type ProductPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{
    adminMessage?: string | string[];
    adminPreview?: string | string[];
  }>;
};

export async function generateStaticParams() {
  const publicProducts = await getPublicProducts();
  return publicProducts.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const adminMode = isAdminModeEnabled() && query.adminPreview === "1";
  const product = adminMode
    ? await getCatalogProductBySlug(slug)
    : await getPublicCatalogProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return {
    // Le titre et la description partagent le meme nettoyage que la page :
    // ni suffixe commercial invente dans le nom, ni note fournisseur
    // invendable dans l'extrait affiche par Google.
    title: getDisplayProductName({ name: getProductSeoTitle(product) }),
    description: getPublicDescription(getProductSeoDescription(product)),
    robots: adminMode
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
          },
        }
      : undefined,
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: ProductPageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const adminMode = isAdminModeEnabled() && query.adminPreview === "1";
  const product = adminMode
    ? await getCatalogProductBySlug(slug)
    : await getPublicCatalogProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const category = getCategoryById(product.categoryId);
  const canShowProductImages = isPublicProduct(product);
  const galleryImages = canShowProductImages
    ? product.images?.length
      ? product.images
      : [product.image]
    : [];
  const showUpdatedMessage = query.adminMessage === "updated";
  const badges = getProductBadges(product);
  const isComingSoon = isComingSoonProduct(product);
  const isDropshipping = isDropshippingProduct(product);
  const canPurchase = isProductPurchasable(product);
  const deliveryEstimate = getDisplayDeliveryEstimate(
    getPublicDeliveryEstimate(product),
  );
  const displayName = getDisplayProductName(product);
  const showReferencePrice = shouldShowReferencePrice(product);
  const stockLabel = getStockLabel(product);
  const stats = await getProductStats(product.id);
  const reviewSummary = await getApprovedReviewSummary(product.id);
  const reviews = await getApprovedReviewsForProduct(product.id);

  return (
    <>
    <section className="container-page grid gap-8 py-8 sm:py-10 lg:grid-cols-[1fr_440px]">
      <div className="grid h-fit gap-3">
        {/* Carre, comme les fichiers sources : le produit est montre entier,
            sans recadrage haut et bas. */}
        <div className="relative aspect-square overflow-hidden rounded-lg border border-line bg-photo shadow-sm">
          {canShowProductImages ? (
            <Image
              src={product.image}
              alt={getProductImageAlt(product)}
              fill
              sizes="(min-width: 1024px) 640px, 100vw"
              className="object-contain"
              priority
            />
          ) : (
            <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 p-6 text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-md border border-[#fed7aa] bg-[#fff7ed] text-[#9a3412]">
                <LockKeyhole size={26} aria-hidden="true" />
              </span>
              <div>
                <p className="text-lg font-black">Photos en préparation</p>
                <p className="mt-2 max-w-md text-sm font-bold leading-6 text-muted">
                  Les photos de ce produit arrivent très bientôt. Ce produit
                  sera disponible à la vente une fois sa fiche complète.
                </p>
              </div>
            </div>
          )}
        </div>
        {canShowProductImages && galleryImages.length > 1 ? (
          <div className="grid grid-cols-5 gap-3">
            {galleryImages.slice(1).map((image, index) => (
              <div
                key={image}
                className="relative aspect-square overflow-hidden rounded-md border border-line bg-photo transition hover:border-[#d9cfbd]"
              >
                <Image
                  src={image}
                  alt={getProductImageAlt(product, `photo ${index + 2}`)}
                  fill
                  sizes="120px"
                  className="object-contain"
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="h-fit rounded-lg border border-line bg-paper p-6 shadow-sm">
        {showUpdatedMessage ? (
          <div className="mb-5 rounded-md border border-teal/20 bg-[#eef8f6] p-3 text-sm font-bold text-teal">
            Produit modifié avec succès
          </div>
        ) : null}
        {!canShowProductImages ? (
          <div className="mb-5 rounded-md border border-[#fed7aa] bg-[#fff7ed] p-3 text-sm font-bold leading-6 text-[#9a3412]">
            Prévisualisation contrôlée: image, achat et publication restent
            bloqués jusqu aux preuves complètes.
          </div>
        ) : null}
        <Link
          href={category ? `/categories/${category.slug}` : "/categories"}
          className="text-sm font-bold uppercase text-teal hover:text-foreground"
        >
          {category?.name ?? "Categorie"}
        </Link>
        <div className="mt-3 flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span
              key={`${product.id}-${badge.label}`}
              className={`rounded-md px-2.5 py-1 text-xs font-bold ${getBadgeClassName(
                badge.tone,
              )}`}
            >
              {badge.label}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <h1 className="text-2xl font-black leading-[1.12] sm:text-3xl">
            {displayName}
          </h1>
          <ProductEngagement productId={product.id} initialStats={stats} />
        </div>
        <div className="mt-3">
          <ReviewSummaryBadge summary={reviewSummary} />
        </div>
        {adminMode ? (
          <Link
            href={`/admin/produits/${product.slug}/modifier`}
            className="focus-ring mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-bold hover:bg-[#f1eadf]"
          >
            <Pencil size={15} aria-hidden="true" />
            Modifier
          </Link>
        ) : null}

        {/* Le prix passe AVANT la description : c'est l'information que le
            client cherche en arrivant sur la fiche. */}
        {isComingSoon ? (
          <div className="mt-5 rounded-lg border border-[#fed7aa] bg-[#fff7ed] p-4 text-sm font-bold leading-6 text-[#9a3412]">
            Bientôt disponible sur Maxi Trouvaille
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <div className="text-[40px] font-black leading-none tracking-tight">
              {formatPrice(product.price)}
            </div>
            {showReferencePrice && product.compareAtPrice ? (
              <div className="pb-1 text-base font-medium text-muted line-through">
                {formatPrice(product.compareAtPrice)}
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-sm">
          <Boxes size={17} aria-hidden="true" className={stockLabel.tone === "ok" ? "text-teal" : "text-rose"} />
          <span
            className={
              stockLabel.tone === "ok"
                ? "font-semibold text-teal"
                : "font-bold text-rose"
            }
          >
            {isComingSoon ? "Achat ouvert prochainement" : stockLabel.label}
          </span>
        </div>

        {isComingSoon ? null : (
          <AddToCartButton
            productId={product.id}
            className="mt-5 w-full py-3.5 text-base"
            label="Ajouter au panier"
            disabled={!canPurchase}
          />
        )}

        {/* Les mentions logistiques passent SOUS le bouton, et une seule fois.
            Repetees sur chaque carte de la boutique, elles martelaient au
            client "tu vas attendre deux semaines" et "ce n'est pas nous qui
            expedions" — le contraire de ce qui donne envie d'acheter. Ici,
            au moment ou il en a besoin, elles rassurent. */}
        <div className="mt-5 grid gap-2.5 rounded-lg border border-line bg-[#fbfaf7] p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-teal">
            <ShieldCheck size={17} aria-hidden="true" />
            Paiement sécurisé sur Maxi Trouvaille
          </div>
          <div className="flex items-start gap-2 text-muted">
            <Truck size={17} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>{deliveryEstimate}</span>
          </div>
          <div className="flex items-start gap-2 text-muted">
            <Store size={17} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>
              {isDropshipping
                ? "Expédié par notre partenaire logistique, suivi et service client assurés par Maxi Trouvaille"
                : product.source === "internal"
                  ? "Vendu et expédié par Maxi Trouvaille"
                  : "Annonce vendeur externe"}
            </span>
          </div>
          <div className="flex items-start gap-2 text-muted">
            <RotateCcw size={17} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>{`${product.condition} · 14 jours pour changer d'avis`}</span>
          </div>
        </div>

        {/* Simple lien texte : en bouton pleine largeur, il avait exactement le
            meme poids que "Ajouter au panier" et lui volait l'attention. */}
        <Link
          href="#message-produit"
          className="focus-ring mt-4 inline-flex items-center gap-2 rounded-md py-1 text-sm font-semibold text-teal underline-offset-4 hover:underline"
        >
          <MessageCircle size={16} aria-hidden="true" />
          Une question sur ce produit ?
        </Link>

        <p className="mt-5 text-sm leading-6 text-muted">
          {getPublicDescription(product.description)}
        </p>

        <div className="mt-7 border-t border-line pt-6">
          <h2 className="text-lg font-black">Points clés</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-muted">
            {getPublicFeatures(product.features).map((feature) => (
              <li key={feature} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 shrink-0 text-teal" size={18} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
    <ProductMessageForm
      product={{
        id: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
      }}
    />
    <section className="container-page pb-12">
      <div className="rounded-lg border border-line bg-paper p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-bold uppercase text-teal">Avis clients</p>
            <h2 className="mt-2 text-2xl font-black">Ce que disent nos clients</h2>
          </div>
          <ReviewSummaryBadge summary={reviewSummary} />
        </div>

        {reviews.length > 0 ? (
          <div className="mt-6 grid gap-4">
            {reviews.map((review) => (
              <article key={review.id} className="rounded-md border border-line p-4">
                <ReviewSummaryBadge
                  summary={{ averageRating: review.rating, totalReviews: 1 }}
                  compact
                />
                <p className="mt-3 text-sm leading-6 text-muted">
                  {review.comment}
                </p>
                {review.adminReply ? (
                  <div className="mt-3 rounded-md bg-[#eef8f6] p-3 text-sm leading-6 text-[#115e59]">
                    <strong>Réponse Maxi Trouvaille : </strong>
                    {review.adminReply}
                  </div>
                ) : null}
                <div className="mt-3 text-xs font-bold text-muted">
                  {review.customerName} -{" "}
                  {new Date(review.createdAt).toLocaleDateString("fr-FR")}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-md bg-[#f6f1e8] p-4 text-sm font-bold text-muted">
            Pas encore d&apos;avis sur ce produit. Vous l&apos;avez commandé ?
            Partagez votre expérience, elle aidera les prochains clients.
          </p>
        )}
      </div>
    </section>
    </>
  );
}

function getBadgeClassName(tone: ProductBadgeTone) {
  switch (tone) {
    case "coming-soon":
      return "badge-pulse-soft bg-[#fff7ed] text-[#9a3412] ring-1 ring-[#fed7aa]";
    case "dropshipping":
      return "bg-[#eef8f6] text-teal ring-1 ring-[#bfe7df]";
    case "new":
      return "bg-[#eff6ff] text-[#1d4ed8] ring-1 ring-[#bfdbfe]";
    case "promotion":
      return "bg-[#fff1f2] text-rose ring-1 ring-[#fecdd3]";
    case "stock":
      return "bg-[#f6f1e8] text-muted ring-1 ring-line";
    case "default":
    default:
      return "bg-brand text-foreground";
  }
}

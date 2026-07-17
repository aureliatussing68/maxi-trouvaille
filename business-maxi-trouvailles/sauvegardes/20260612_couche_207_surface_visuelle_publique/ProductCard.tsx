"use client";

import Image from "next/image";
import Link from "next/link";
import { LockKeyhole, MessageCircle, Pencil, Store, Tag, Truck } from "lucide-react";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductStatsBadges } from "@/components/ProductEngagement";
import { ReviewSummaryBadge } from "@/components/ReviewStars";
import {
  getClientCategoryNameById,
  getClientProductBadges,
  getClientProductImageAlt,
  getClientPublicDeliveryEstimate,
  isClientComingSoonProduct,
  isClientDropshippingProduct,
  isClientProductPurchasable,
  type Product,
  type ProductBadgeTone,
} from "@/lib/catalog-client";
import { formatPrice } from "@/lib/format";
import type { ProductStats } from "@/lib/product-stats";
import type { ProductReviewSummary } from "@/lib/product-reviews";

export function ProductCard({
  product,
  stats,
  reviewSummary,
  showAdminControls = false,
}: {
  product: Product;
  stats?: ProductStats;
  reviewSummary?: ProductReviewSummary;
  showAdminControls?: boolean;
}) {
  const categoryName = getClientCategoryNameById(product.categoryId);
  const badges = getClientProductBadges(product);
  const isComingSoon = isClientComingSoonProduct(product);
  const isDropshipping = isClientDropshippingProduct(product);
  const canRenderPublicProduct =
    (product.status ?? "published") === "published" && !product.isTestProduct;
  const canPurchase = isClientProductPurchasable(product);
  const deliveryEstimate = getClientPublicDeliveryEstimate(product);

  if (!canRenderPublicProduct) {
    const cardTitle = showAdminControls
      ? product.name
      : "Produit en contrôle qualité";
    const cardDescription = showAdminControls
      ? "Image masquée tant que la fiche n a pas toutes ses preuves: photo exacte, droits image, stock, délai et validation humaine."
      : "Photo, droits image, stock, délai et validation humaine doivent être confirmés avant affichage public.";

    return (
      <article className="overflow-hidden rounded-lg border border-dashed border-line bg-[#faf7f0] shadow-sm">
        <div className="flex aspect-[4/3] items-center justify-center bg-[#f1eadf] p-5 text-center">
          <span className="inline-flex items-center gap-2 rounded-md border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-sm font-black text-[#9a3412]">
            <LockKeyhole size={16} aria-hidden="true" />
            Fiche en validation
          </span>
        </div>
        <div className="grid gap-3 p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-teal">
            <Store size={14} aria-hidden="true" />
            {categoryName ?? "Produit partenaire"}
          </div>
          <h2 className="text-lg font-black leading-6">{cardTitle}</h2>
          <p className="text-sm leading-6 text-muted">{cardDescription}</p>
          {showAdminControls ? (
            <Link
              href={`/admin/produits/${product.slug}/modifier`}
              className="focus-ring inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
            >
              <Pencil size={15} aria-hidden="true" />
              Modifier la fiche
            </Link>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article className="overflow-hidden rounded-lg border border-line bg-paper shadow-sm">
      <Link href={`/produit/${product.slug}`} className="group block">
        <div className="relative aspect-[4/3] overflow-hidden bg-[#ede7db]">
          <Image
            src={product.image}
            alt={getClientProductImageAlt(product)}
            fill
            sizes="(min-width: 1024px) 360px, 100vw"
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span
                key={`${product.id}-${badge.label}`}
                className={`rounded-md px-2.5 py-1 text-xs font-black ${getBadgeClassName(
                  badge.tone,
                )}`}
              >
                {badge.label}
              </span>
            ))}
          </div>
        </div>
      </Link>

      <div className="grid gap-4 p-4">
        <div className="grid gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-teal">
            <Tag size={14} aria-hidden="true" />
            {categoryName ?? "Categorie"}
          </div>
          <Link href={`/produit/${product.slug}`} className="hover:text-teal">
            <h2 className="text-lg font-black leading-6">{product.name}</h2>
          </Link>
          <p className="text-sm leading-6 text-muted">{product.shortDescription}</p>
          <div className="flex items-center gap-2 text-xs font-bold text-muted">
            <Store size={14} aria-hidden="true" />
            {isDropshipping
              ? "Produit expédié par partenaire logistique"
              : product.source === "internal"
                ? "Vendu par Maxi Trouvaille"
                : "Annonce vendeur"}
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted">
            <Truck size={14} aria-hidden="true" />
            {deliveryEstimate}
          </div>
          <ReviewSummaryBadge summary={reviewSummary} compact />
          <ProductStatsBadges stats={stats} />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {isComingSoon ? (
              <div className="rounded-md border border-[#fed7aa] bg-[#fff7ed] p-3 text-sm font-black text-[#9a3412]">
                Bientôt disponible sur Maxi Trouvailles
              </div>
            ) : (
              <>
                <div className="text-2xl font-black">{formatPrice(product.price)}</div>
                {product.compareAtPrice ? (
                  <div className="text-sm font-semibold text-muted line-through">
                    {formatPrice(product.compareAtPrice)}
                  </div>
                ) : null}
                <div className="mt-1 text-xs font-bold text-muted">
                  {product.stock > 0
                    ? `Quantite disponible : ${product.stock}`
                    : "Rupture de stock"}
                </div>
              </>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {isComingSoon ? null : (
              <AddToCartButton
                productId={product.id}
                label="Ajouter"
                disabled={!canPurchase}
              />
            )}
            <Link
              href={`/produit/${product.slug}#message-produit`}
              className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
            >
              <MessageCircle size={15} aria-hidden="true" />
              Envoyer un message
            </Link>
            {showAdminControls ? (
              <Link
                href={`/admin/produits/${product.slug}/modifier`}
                className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
              >
                <Pencil size={15} aria-hidden="true" />
                Modifier
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </article>
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

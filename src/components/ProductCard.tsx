"use client";

import Image from "next/image";
import Link from "next/link";
import { LockKeyhole, Pencil, Store } from "lucide-react";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ReviewSummaryBadge } from "@/components/ReviewStars";
import {
  getClientCategoryNameById,
  getClientProductImageAlt,
  isClientComingSoonProduct,
  isClientProductPurchasable,
  isClientPublicProduct,
  type Product,
} from "@/lib/catalog-client";
import { formatPrice } from "@/lib/format";
import {
  getDisplayProductName,
  getRealDiscountPercent,
  getStockLabel,
  shouldShowReferencePrice,
} from "@/lib/product-display";
import type { ProductStats } from "@/lib/product-stats";
import type { ProductReviewSummary } from "@/lib/product-reviews";

/**
 * Carte produit unique pour tout le site : vitrine de l'accueil, grille de la
 * boutique, rayons, promotions, nouveautes.
 *
 * Principe de dessin : la PHOTO porte la carte. Elle est carree, comme les
 * fichiers sources (800x800 a 1200x1200), donc affichee sans aucun recadrage —
 * plus de produit decapite ni de mot coupe en deux. Sous la photo, seulement ce
 * qui sert a decider : le nom, le prix, le bouton. Tout le reste (description,
 * mentions logistiques, delai, stock detaille) vit sur la fiche produit, ou le
 * client va justement chercher le detail.
 *
 * La variante "showcase" ne change plus la mise en page — les deux etaient
 * devenues incoherentes entre elles. Elle se contente d'alleger encore : pas de
 * bouton d'administration dans la vitrine.
 */
export type ProductCardVariant = "default" | "showcase";

export function ProductCard({
  product,
  reviewSummary,
  showAdminControls = false,
  variant = "default",
  priority = false,
}: {
  product: Product;
  /** Conserve pour compatibilite : plus affiche sur la carte. */
  stats?: ProductStats;
  reviewSummary?: ProductReviewSummary;
  showAdminControls?: boolean;
  variant?: ProductCardVariant;
  /** Premieres cartes visibles : la photo est chargee en priorite. */
  priority?: boolean;
}) {
  const isShowcase = variant === "showcase";
  const categoryName = getClientCategoryNameById(product.categoryId);
  const displayName = getDisplayProductName(product);
  const discountPercent = getRealDiscountPercent(product);
  const showReferencePrice = shouldShowReferencePrice(product);
  const isComingSoon = isClientComingSoonProduct(product);
  const canRenderPublicProduct = isClientPublicProduct(product);
  const canPurchase = isClientProductPurchasable(product);
  const stockLabel = getStockLabel(product);

  if (!canRenderPublicProduct) {
    const cardTitle = showAdminControls
      ? displayName
      : "Produit en contrôle qualité";
    const cardDescription = showAdminControls
      ? "Image masquée tant que la fiche n'a pas toutes ses preuves : photo exacte, droits image, stock, délai et validation humaine."
      : "Photo, droits image, stock, délai et validation humaine doivent être confirmés avant affichage public.";

    return (
      <article className="flex h-full flex-col overflow-hidden rounded-lg border border-dashed border-line bg-[#faf7f0]">
        <div className="flex aspect-square items-center justify-center bg-[#f1eadf] p-5 text-center">
          <span className="inline-flex items-center gap-2 rounded-md border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-xs font-bold text-[#9a3412]">
            <LockKeyhole size={15} aria-hidden="true" />
            Fiche en validation
          </span>
        </div>
        <div className="grid gap-2 p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-teal">
            <Store size={13} aria-hidden="true" />
            {categoryName ?? "Produit partenaire"}
          </div>
          <h2 className="text-base font-bold leading-5">{cardTitle}</h2>
          <p className="text-sm leading-6 text-muted">{cardDescription}</p>
          {showAdminControls ? (
            <Link
              href={`/admin/produits/${product.slug}/modifier`}
              className="focus-ring inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-bold hover:bg-[#f1eadf]"
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
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-paper shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#d9cfbd] hover:shadow-lg">
      <Link
        href={`/produit/${product.slug}`}
        className="focus-ring block"
        aria-label={displayName}
      >
        {/* Carre, comme les fichiers sources : zero recadrage, le produit est
            montre entier. C'est aussi le format qui donne le plus de surface a
            la photo dans une grille a deux colonnes sur telephone. */}
        <div className="relative aspect-square overflow-hidden bg-photo">
          <Image
            src={product.image}
            alt={getClientProductImageAlt(product)}
            fill
            sizes="(min-width: 1280px) 270px, (min-width: 768px) 33vw, 50vw"
            className="object-cover transition duration-300 group-hover:scale-[1.04]"
            priority={priority}
          />
          {/* Une seule pastille, et seulement quand elle dit quelque chose :
              la remise reelle quand elle est significative, ou l'etat "a
              venir". Trois pastilles de trois couleurs sur chaque photo ne
              renseignaient plus personne et cachaient le produit. */}
          {isComingSoon ? (
            <span className="absolute left-3 top-3 rounded-md bg-[#fff7ed] px-2.5 py-1 text-[11px] font-bold text-[#9a3412] ring-1 ring-[#fed7aa]">
              À venir
            </span>
          ) : showReferencePrice ? (
            <span className="absolute left-3 top-3 rounded-md bg-rose px-2.5 py-1 text-[11px] font-bold tracking-wide text-white shadow-sm">
              -{discountPercent}%
            </span>
          ) : null}
          {stockLabel.tone === "out" ? (
            <span className="absolute inset-x-0 bottom-0 bg-foreground/85 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-white">
              Rupture de stock
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <Link
          href={`/produit/${product.slug}`}
          className="focus-ring rounded-md transition group-hover:text-teal"
        >
          <h2 className="line-clamp-2 text-sm font-semibold leading-5 sm:text-[15px] sm:leading-[1.35]">
            {displayName}
          </h2>
        </Link>

        <div className="mt-1.5">
          <ReviewSummaryBadge summary={reviewSummary} compact />
        </div>

        {/* Bloc prix + action colle en bas : d'une carte a l'autre, les prix
            et les boutons sont alignes sur la meme ligne, l'oeil peut balayer
            la rangee. */}
        <div className="mt-auto pt-3">
          {isComingSoon ? (
            <p className="rounded-md border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-xs font-bold leading-5 text-[#9a3412]">
              Bientôt disponible
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-xl font-black leading-none tracking-tight sm:text-2xl">
                  {formatPrice(product.price)}
                </span>
                {showReferencePrice && product.compareAtPrice ? (
                  <span className="text-sm font-medium text-muted line-through">
                    {formatPrice(product.compareAtPrice)}
                  </span>
                ) : null}
              </div>
              {stockLabel.tone === "low" ? (
                <p className="mt-1.5 text-[11px] font-bold text-rose">
                  {stockLabel.label}
                </p>
              ) : null}
              <AddToCartButton
                productId={product.id}
                className="mt-3 w-full"
                label="Ajouter"
                disabled={!canPurchase}
              />
            </>
          )}
          {showAdminControls && !isShowcase ? (
            <Link
              href={`/admin/produits/${product.slug}/modifier`}
              className="focus-ring mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-bold hover:bg-[#f1eadf]"
            >
              <Pencil size={15} aria-hidden="true" />
              Modifier
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

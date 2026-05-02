"use client";

import Image from "next/image";
import Link from "next/link";
import { Pencil, Store, Tag } from "lucide-react";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductStatsBadges } from "@/components/ProductEngagement";
import { getCategoryById, type Product } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import type { ProductStats } from "@/lib/product-stats";

export function ProductCard({
  product,
  stats,
  showAdminControls = false,
}: {
  product: Product;
  stats?: ProductStats;
  showAdminControls?: boolean;
}) {
  const category = getCategoryById(product.categoryId);

  return (
    <article className="overflow-hidden rounded-lg border border-line bg-paper shadow-sm">
      <Link href={`/produit/${product.slug}`} className="group block">
        <div className="relative aspect-[4/3] overflow-hidden bg-[#ede7db]">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 360px, 100vw"
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
          <span className="absolute left-3 top-3 rounded-md bg-brand px-2.5 py-1 text-xs font-black text-foreground">
            {product.stock > 0 ? product.badge : "Rupture de stock"}
          </span>
        </div>
      </Link>

      <div className="grid gap-4 p-4">
        <div className="grid gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-teal">
            <Tag size={14} aria-hidden="true" />
            {category?.name ?? "Categorie"}
          </div>
          <Link href={`/produit/${product.slug}`} className="hover:text-teal">
            <h2 className="text-lg font-black leading-6">{product.name}</h2>
          </Link>
          <p className="text-sm leading-6 text-muted">{product.shortDescription}</p>
          <div className="flex items-center gap-2 text-xs font-bold text-muted">
            <Store size={14} aria-hidden="true" />
            {product.source === "internal"
              ? "Vendu par Maxi Trouvaille"
              : "Annonce vendeur"}
          </div>
          <ProductStatsBadges stats={stats} />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
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
          </div>
          <div className="flex flex-col gap-2">
            <AddToCartButton
              productId={product.id}
              label="Ajouter"
              disabled={product.stock <= 0}
            />
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

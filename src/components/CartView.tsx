"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { ShippingSelector } from "@/components/ShippingSelector";
import { useShippingSelection } from "@/components/useShippingSelection";
import { formatPrice } from "@/lib/format";

export function CartView() {
  const { detailedItems, subtotal, updateQuantity, removeItem } = useCart();
  const shippingProducts = detailedItems.map((item) => item.product);
  const {
    selection,
    setSelection,
    availableMethods,
    shippingPrice: shipping,
    validation,
  } = useShippingSelection(shippingProducts);
  const total = subtotal + shipping;

  if (detailedItems.length === 0) {
    return (
      <div className="container-page py-12">
        <div className="rounded-lg border border-line bg-paper p-8 text-center shadow-sm">
          <ShoppingBag className="mx-auto mb-4 text-teal" size={42} aria-hidden="true" />
          <h1 className="text-2xl font-black">Votre panier est vide</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
            Les produits de test et les futures trouvailles apparaitront ici avant
            le paiement.
          </p>
          <Link
            href="/boutique"
            className="focus-ring mt-6 inline-flex min-h-11 items-center rounded-md bg-foreground px-5 py-2.5 text-sm font-black text-white hover:bg-[#2b2b2b]"
          >
            Voir la boutique
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_360px]">
      <section className="grid gap-4">
        {detailedItems.map((item) => (
          <article
            key={item.productId}
            className="grid gap-4 rounded-lg border border-line bg-paper p-4 shadow-sm sm:grid-cols-[128px_1fr]"
          >
            <div className="relative aspect-square overflow-hidden rounded-md bg-[#ede7db]">
              <Image
                src={item.product.image}
                alt={item.product.name}
                fill
                sizes="128px"
                className="object-cover"
              />
            </div>

            <div className="grid gap-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black">{item.product.name}</h2>
                  <p className="mt-1 text-sm text-muted">{item.product.condition}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black">
                    {formatPrice(item.lineTotal)}
                  </div>
                  <div className="text-sm text-muted">
                    {formatPrice(item.product.price)} / unite
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex h-11 items-center rounded-md border border-line">
                  <button
                    type="button"
                    className="focus-ring flex h-11 w-11 items-center justify-center rounded-l-md hover:bg-[#f1eadf]"
                    aria-label="Retirer une unite"
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-10 text-center text-sm font-black">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    className="focus-ring flex h-11 w-11 items-center justify-center rounded-r-md hover:bg-[#f1eadf]"
                    aria-label="Ajouter une unite"
                    disabled={item.quantity >= item.product.stock}
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <button
                  type="button"
                  className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-bold text-rose hover:bg-[#fff1f2]"
                  onClick={() => removeItem(item.productId)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Retirer
                </button>
              </div>
              <p className="text-xs font-bold text-muted">
                Stock disponible : {item.product.stock}
              </p>
            </div>
          </article>
        ))}
        <ShippingSelector
          selection={selection}
          onChange={setSelection}
          availableMethods={availableMethods}
          error={validation.ok ? undefined : validation.error}
        />
      </section>

      <aside className="h-fit rounded-lg border border-line bg-paper p-5 shadow-sm">
        <h2 className="text-xl font-black">Recapitulatif</h2>
        <div className="mt-5 grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted">Sous-total</span>
            <span className="font-bold">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted">Livraison</span>
            <span className="font-bold">{formatPrice(shipping)}</span>
          </div>
          <div className="border-t border-line pt-3">
            <div className="flex justify-between gap-4 text-lg">
              <span className="font-black">Total</span>
              <span className="font-black">{formatPrice(total)}</span>
            </div>
          </div>
        </div>
        {validation.ok ? (
          <Link
            href="/paiement"
            className="focus-ring mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-foreground px-5 py-3 text-sm font-black text-white hover:bg-[#2b2b2b]"
          >
            Continuer vers le paiement
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="mt-6 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-md bg-muted/35 px-5 py-3 text-sm font-black text-muted"
          >
            Choisissez votre livraison
          </button>
        )}
        <Link
          href="/boutique"
          className="focus-ring mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-line px-5 py-3 text-sm font-black hover:bg-[#f1eadf]"
        >
          Continuer mes trouvailles
        </Link>
      </aside>
    </div>
  );
}

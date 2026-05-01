"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useEffect } from "react";
import { useCart } from "@/components/CartProvider";

export function OrderSuccess() {
  const { clearCart, items } = useCart();

  useEffect(() => {
    async function decrementStockAndClearCart() {
      if (items.length > 0) {
        await fetch("/api/admin/products/decrement", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ items }),
        });
      }

      clearCart();
    }

    decrementStockAndClearCart();
  }, [clearCart, items]);

  return (
    <div className="container-page py-12">
      <div className="rounded-lg border border-line bg-paper p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto mb-4 text-teal" size={46} aria-hidden="true" />
        <h1 className="text-2xl font-black">Paiement test confirme</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
          Le panier local a ete vide. Pour une vraie mise en ligne, il faudra
          brancher les webhooks Stripe et la gestion des commandes.
        </p>
        <Link
          href="/boutique"
          className="focus-ring mt-6 inline-flex min-h-11 items-center rounded-md bg-foreground px-5 py-2.5 text-sm font-black text-white hover:bg-[#2b2b2b]"
        >
          Retour boutique
        </Link>
      </div>
    </div>
  );
}

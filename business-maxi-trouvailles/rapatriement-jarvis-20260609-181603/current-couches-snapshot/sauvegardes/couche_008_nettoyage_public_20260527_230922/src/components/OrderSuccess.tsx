"use client";

import Link from "next/link";
import { CheckCircle2, MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/CartProvider";

export function OrderSuccess({ sessionId }: { sessionId?: string }) {
  const { clearCart, items } = useCart();
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState(
    "Le lien d'avis sera disponible apres validation du paiement Stripe.",
  );
  const reviewRequestStarted = useRef(false);

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

  useEffect(() => {
    if (!sessionId || reviewRequestStarted.current) {
      return;
    }

    reviewRequestStarted.current = true;

    fetch("/api/reviews/purchase-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
    })
      .then((response) => response.json())
      .then((data: { reviewUrl?: string; error?: string }) => {
        if (data.reviewUrl) {
          setReviewUrl(data.reviewUrl);
          setReviewMessage(
            "Votre achat est confirme. Vous pouvez laisser un avis pour les produits achetes.",
          );
        } else if (data.error) {
          setReviewMessage(data.error);
        }
      })
      .catch(() => {
        setReviewMessage("Lien d'avis indisponible pour le moment.");
      });
  }, [sessionId]);

  return (
    <div className="container-page py-12">
      <div className="rounded-lg border border-line bg-paper p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto mb-4 text-teal" size={46} aria-hidden="true" />
        <h1 className="text-2xl font-black">Paiement test confirme</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
          Le panier local a ete vide. Pour une vraie mise en ligne, il faudra
          brancher les webhooks Stripe et la gestion des commandes.
        </p>
        <div className="mx-auto mt-5 max-w-md rounded-md bg-[#f6f1e8] p-3 text-sm font-bold text-muted">
          {reviewMessage}
        </div>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          {reviewUrl ? (
            <Link
              href={reviewUrl}
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-5 py-2.5 text-sm font-black text-white hover:bg-[#2b2b2b]"
            >
              <MessageSquare size={17} aria-hidden="true" />
              Laisser un avis
            </Link>
          ) : null}
          <Link
            href="/boutique"
            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md border border-line px-5 py-2.5 text-sm font-black hover:bg-[#f1eadf]"
          >
            Retour boutique
          </Link>
        </div>
      </div>
    </div>
  );
}

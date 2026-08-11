"use client";

import Link from "next/link";
import { CheckCircle2, MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { SHIPPING_STORAGE_KEY } from "@/lib/shipping";

export function OrderSuccess({ sessionId }: { sessionId?: string }) {
  const { clearCart } = useCart();
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState(
    "Le lien d'avis sera disponible apres confirmation de la commande.",
  );
  const reviewRequestStarted = useRef(false);

  useEffect(() => {
    clearCart();

    // La commande est passee : l'adresse et le mode de livraison memorises
    // dans le navigateur n'ont plus d'usage. Les garder indefiniment etait
    // le seul stockage local qui survivait a son propre besoin.
    try {
      window.localStorage.removeItem(SHIPPING_STORAGE_KEY);
    } catch {
      // Navigateur sans stockage local : rien a effacer.
    }
  }, [clearCart]);

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
            "Votre commande est confirmee. Vous pouvez laisser un avis pour les produits achetes.",
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
        <CheckCircle2
          className="mx-auto mb-4 text-teal"
          size={46}
          aria-hidden="true"
        />
        <h1 className="text-2xl font-black">Paiement confirmé</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
          Votre commande est prise en compte. Les informations de suivi seront
          ajoutees des que la preparation sera confirmee.
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

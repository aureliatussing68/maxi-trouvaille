"use client";

import Link from "next/link";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { ShippingSelector } from "@/components/ShippingSelector";
import { useShippingSelection } from "@/components/useShippingSelection";
import { formatPrice } from "@/lib/format";

export function CheckoutView() {
  const { detailedItems, items, subtotal } = useCart();
  const shippingProducts = detailedItems.map((item) => item.product);
  const {
    selection,
    setSelection,
    availableMethods,
    selectedMethod,
    shippingPrice: shipping,
    validation,
  } = useShippingSelection(shippingProducts);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items, shipping: selection }),
      });

      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Impossible de demarrer le paiement test.");
      }

      window.location.assign(data.url);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Impossible de demarrer le paiement test.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (detailedItems.length === 0) {
    return (
      <div className="container-page py-12">
        <div className="rounded-lg border border-line bg-paper p-8 text-center shadow-sm">
          <CreditCard className="mx-auto mb-4 text-teal" size={42} aria-hidden="true" />
          <h1 className="text-2xl font-black">Aucun article a payer</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
            Ajoutez une trouvaille au panier pour tester le tunnel de paiement.
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

  return (
    <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_380px]">
      <section className="grid gap-5">
        <div className="rounded-lg border border-line bg-paper p-5 shadow-sm">
          <div className="flex items-start gap-3 rounded-lg bg-[#eef8f6] p-4 text-sm leading-6 text-[#115e59]">
            <ShieldCheck className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
            <p>
              Le paiement est prepare pour Stripe Checkout en mode test. Une cle
              secrete commencant par <strong>sk_test_</strong> est obligatoire
              pour ouvrir la page Stripe.
            </p>
          </div>

          <h1 className="mt-6 text-2xl font-black">Paiement test</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Maxi Trouvaille utilise un tunnel heberge par Stripe pour eviter de
            manipuler les donnees bancaires dans le site. Les paiements reels
            restent bloques dans le code tant qu&apos;une cle de test n&apos;est pas fournie.
          </p>
        </div>

        <ShippingSelector
          selection={selection}
          onChange={setSelection}
          availableMethods={availableMethods}
          error={validation.ok ? undefined : validation.error}
        />

        {error ? (
          <div className="mt-5 rounded-lg border border-[#fecdd3] bg-[#fff1f2] p-4 text-sm font-semibold leading-6 text-rose">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={startCheckout}
          disabled={isLoading || !validation.ok}
          className="focus-ring mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-black text-white transition hover:bg-[#2b2b2b] disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto"
        >
          {isLoading ? <Loader2 className="animate-spin" size={18} /> : <CreditCard size={18} />}
          Ouvrir Stripe Checkout test
        </button>
      </section>

      <aside className="h-fit rounded-lg border border-line bg-paper p-5 shadow-sm">
        <h2 className="text-xl font-black">Votre commande</h2>
        <div className="mt-5 grid gap-4">
          {detailedItems.map((item) => (
            <div key={item.productId} className="flex justify-between gap-4 text-sm">
              <div>
                <div className="font-bold">{item.product.name}</div>
                <div className="text-muted">Quantite {item.quantity}</div>
              </div>
              <div className="font-bold">{formatPrice(item.lineTotal)}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-3 border-t border-line pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted">Sous-total</span>
            <span className="font-bold">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted">
              Livraison{selectedMethod ? ` - ${selectedMethod.shortLabel}` : ""}
            </span>
            <span className="font-bold">{formatPrice(shipping)}</span>
          </div>
          <div className="flex justify-between gap-4 text-lg">
            <span className="font-black">Total</span>
            <span className="font-black">{formatPrice(subtotal + shipping)}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

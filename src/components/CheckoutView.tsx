"use client";

import Link from "next/link";
import {
  CreditCard,
  Loader2,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { type CartLine, useCart } from "@/components/CartProvider";
import { ShippingSelector } from "@/components/ShippingSelector";
import { useShippingSelection } from "@/components/useShippingSelection";
import { clampQuantity, formatPrice } from "@/lib/format";
import { isClientProductPurchasable, type Product } from "@/lib/catalog-client";

type DetailedCartLine = CartLine & {
  product: Product;
  lineTotal: number;
};

function buildDetailedCartItems(
  items: CartLine[],
  products: Product[],
): DetailedCartLine[] {
  const productMap = new Map(products.map((product) => [product.id, product]));

  return items
    .map((item) => {
      const product = productMap.get(item.productId);
      if (!product || !isClientProductPurchasable(product)) {
        return null;
      }

      const quantity = clampQuantity(item.quantity, product.stock);

      return {
        productId: item.productId,
        quantity,
        product,
        lineTotal: product.price * quantity,
      };
    })
    .filter((line): line is DetailedCartLine => Boolean(line));
}

export function CheckoutView({ products }: { products: Product[] }) {
  const { items } = useCart();
  const detailedItems = useMemo(
    () => buildDetailedCartItems(items, products),
    [items, products],
  );
  const subtotal = detailedItems.reduce(
    (total, item) => total + item.lineTotal,
    0,
  );
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
  // Demarre a false, toujours : un consentement pre-coche est nul.
  const [conditionsAcceptees, setConditionsAcceptees] = useState(false);
  const blockedItems = detailedItems.filter(
    (item) => !isClientProductPurchasable(item.product),
  );

  async function startCheckout() {
    if (blockedItems.length > 0) {
      setError(
        "Retirez les produits non disponibles avant de passer au paiement.",
      );
      return;
    }

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
        throw new Error(
          data.error ?? "Impossible de démarrer le paiement sécurisé.",
        );
      }

      window.location.assign(data.url);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Impossible de démarrer le paiement sécurisé.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (detailedItems.length === 0) {
    return (
      <div className="container-page py-12">
        <div className="rounded-lg border border-line bg-paper p-8 text-center shadow-sm">
          <CreditCard
            className="mx-auto mb-4 text-teal"
            size={42}
            aria-hidden="true"
          />
          <h1 className="text-2xl font-black">Paiement Maxi Trouvaille prêt</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
            Le paiement s&apos;ouvre seulement quand un article validé est dans
            le panier. Les rayons restent consultables pendant que les fiches
            partenaires passent les contrôles image, stock, délai et
            préparation.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/produits-partenaires"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-5 py-2.5 text-sm font-black text-white hover:bg-[#2b2b2b]"
            >
              <ShoppingBag size={17} aria-hidden="true" />
              Voir les rayons
            </Link>
            <Link
              href="/suivi-colis"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-5 py-2.5 text-sm font-black hover:bg-[#f1eadf]"
            >
              <Truck size={17} aria-hidden="true" />
              Suivi colis
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_380px]">
      <section className="grid gap-5">
        <div className="rounded-lg border border-line bg-paper p-5 shadow-sm">
          <div className="flex items-start gap-3 rounded-lg bg-[#eef8f6] p-4 text-sm leading-6 text-[#115e59]">
            <ShieldCheck
              className="mt-0.5 shrink-0"
              size={20}
              aria-hidden="true"
            />
            <p>
              Le paiement Maxi Trouvaille passe par un prestataire sécurisé.
              Maxi Trouvaille ne stocke pas vos donnees bancaires.
            </p>
          </div>

          <h1 className="mt-6 text-2xl font-black">Paiement sécurisé</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Maxi Trouvaille utilise un tunnel heberge sécurisé pour eviter de
            manipuler les donnees bancaires dans le site. La commande reste
            contrôlée avant préparation.
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

        {blockedItems.length > 0 ? (
          <div className="mt-5 rounded-lg border border-[#fed7aa] bg-[#fff7ed] p-4 text-sm font-semibold leading-6 text-[#9a3412]">
            Un produit du panier est marqué À venir. Le paiement s&apos;ouvrira
            quand la fiche sera validée.
          </div>
        ) : null}

        <p className="mt-5 rounded-lg border border-line bg-[#f8f5ef] p-4 text-sm font-semibold leading-6 text-foreground">
          Livraison en France métropolitaine uniquement. Nous ne livrons pas
          l&apos;outre-mer ni l&apos;étranger.
        </p>

        {/*
          Case a cocher OBLIGATOIRE et NON pre-cochee.

          Sans elle, les CGV affirmaient que le client « reconnait en avoir pris
          connaissance avant de payer » alors qu'aucun ecran ne les lui montrait :
          c'est une clause noire au sens de l'article R212-1 1° du code de la
          consommation, interdite en toutes circonstances. Consequence civile la
          plus lourde : les CGV deviennent inopposables, donc les clauses de
          livraison, de retour et de responsabilite tombent le jour d'un litige.

          Ne jamais la pre-cocher : un consentement pre-coche est nul.
        */}
        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm leading-6 text-muted">
          <input
            type="checkbox"
            checked={conditionsAcceptees}
            onChange={(event) => setConditionsAcceptees(event.target.checked)}
            className="focus-ring mt-1 h-5 w-5 shrink-0 cursor-pointer rounded border-line accent-foreground"
          />
          <span>
            J&apos;ai lu et j&apos;accepte les{" "}
            <a
              className="font-semibold underline"
              href="/conditions-generales-vente"
              target="_blank"
              rel="noopener noreferrer"
            >
              conditions générales de vente
            </a>{" "}
            et la{" "}
            <a
              className="font-semibold underline"
              href="/politique-confidentialite"
              target="_blank"
              rel="noopener noreferrer"
            >
              politique de confidentialité
            </a>
            .
          </span>
        </label>

        <button
          type="button"
          onClick={startCheckout}
          disabled={
            isLoading ||
            !validation.ok ||
            blockedItems.length > 0 ||
            !conditionsAcceptees
          }
          className="focus-ring mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-black text-white transition hover:bg-[#2b2b2b] disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto"
        >
          {isLoading ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <CreditCard size={18} />
          )}
          Continuer vers le paiement sécurisé
        </button>

        {!conditionsAcceptees ? (
          <p className="mt-3 text-sm leading-6 text-muted">
            Cochez la case ci-dessus pour continuer.
          </p>
        ) : null}
      </section>

      <aside className="h-fit rounded-lg border border-line bg-paper p-5 shadow-sm">
        <h2 className="text-xl font-black">Votre commande</h2>
        <div className="mt-5 grid gap-4">
          {detailedItems.map((item) => (
            <div
              key={item.productId}
              className="flex justify-between gap-4 text-sm"
            >
              <div>
                <div className="font-bold">{item.product.name}</div>
                <div className="text-muted">Quantité {item.quantity}</div>
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
            <span className="font-black">
              {formatPrice(subtotal + shipping)}
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}

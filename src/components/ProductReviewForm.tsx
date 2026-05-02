"use client";

import { Loader2, Send, Star } from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import type { Product } from "@/lib/catalog";

type ProductReviewFormProps = {
  token: string;
  products: Product[];
  reviewedProductIds: string[];
};

export function ProductReviewForm({
  token,
  products,
  reviewedProductIds,
}: ProductReviewFormProps) {
  const availableProducts = useMemo(
    () => products.filter((product) => !reviewedProductIds.includes(product.id)),
    [products, reviewedProductIds],
  );
  const [productId, setProductId] = useState(availableProducts[0]?.id ?? "");
  const [rating, setRating] = useState(5);
  const [customerName, setCustomerName] = useState("");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState(
    availableProducts.length > 0
      ? "Votre avis sera visible apres validation admin."
      : "Tous les produits de cette commande ont deja un avis.",
  );
  const [isSending, setIsSending] = useState(false);
  const [submittedProductIds, setSubmittedProductIds] = useState<string[]>([]);

  const selectableProducts = availableProducts.filter(
    (product) => !submittedProductIds.includes(product.id),
  );
  const canSubmit = Boolean(productId) && customerName.trim() && comment.trim();

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSending(true);
    setMessage("Envoi de l'avis...");

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          productId,
          rating,
          customerName,
          comment,
        }),
      });
      const data = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Avis impossible.");
      }

      const nextSubmitted = [...submittedProductIds, productId];
      const remainingProduct = availableProducts.find(
        (product) => !nextSubmitted.includes(product.id),
      );

      setSubmittedProductIds(nextSubmitted);
      setProductId(remainingProduct?.id ?? "");
      setComment("");
      setMessage(data.message ?? "Avis envoye pour validation.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Avis impossible.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <form
      onSubmit={submitReview}
      className="grid gap-5 rounded-lg border border-line bg-paper p-5 shadow-sm"
    >
      <div>
        <p className="text-sm font-black uppercase text-teal">Avis apres achat</p>
        <h1 className="mt-2 text-3xl font-black">Laisser un avis</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{message}</p>
      </div>

      <label className="grid gap-2 text-sm font-bold">
        Produit achete
        <select
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          disabled={selectableProducts.length === 0}
          className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
        >
          {selectableProducts.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-bold">Note</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className="focus-ring flex h-11 w-11 items-center justify-center rounded-md border border-line bg-paper text-brand hover:bg-[#f1eadf]"
              aria-label={`${value} etoile${value > 1 ? "s" : ""}`}
            >
              <Star
                size={22}
                fill={value <= rating ? "currentColor" : "none"}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </fieldset>

      <label className="grid gap-2 text-sm font-bold">
        Nom ou prenom affiche
        <input
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
          maxLength={80}
          className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
          placeholder="Ex : Aurelia"
        />
      </label>

      <label className="grid gap-2 text-sm font-bold">
        Commentaire
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={1200}
          rows={6}
          className="focus-ring rounded-md border border-line px-3 py-3 text-base"
          placeholder="Votre retour sur le produit, emballage ou achat..."
        />
      </label>

      <button
        type="submit"
        disabled={isSending || !canSubmit || selectableProducts.length === 0}
        className="focus-ring inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-black text-white hover:bg-[#2b2b2b] disabled:cursor-not-allowed disabled:opacity-65 sm:w-fit"
      >
        {isSending ? (
          <Loader2 className="animate-spin" size={18} aria-hidden="true" />
        ) : (
          <Send size={18} aria-hidden="true" />
        )}
        Envoyer l&apos;avis
      </button>
    </form>
  );
}

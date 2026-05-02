"use client";

import Link from "next/link";
import { Check, EyeOff, Loader2, MessageSquare, Trash2 } from "lucide-react";
import { useState } from "react";
import { ReviewSummaryBadge } from "@/components/ReviewStars";
import type { ReviewAdminItem, ReviewStatus } from "@/lib/product-reviews";

export function AdminReviewsPanel({
  initialReviews,
}: {
  initialReviews: ReviewAdminItem[];
}) {
  const [reviews, setReviews] = useState(initialReviews);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>(
    Object.fromEntries(
      initialReviews.map((review) => [review.id, review.adminReply]),
    ),
  );

  async function updateReview(reviewId: string, status?: ReviewStatus) {
    setBusyId(reviewId);

    try {
      const response = await fetch(
        `/api/admin/reviews/${encodeURIComponent(reviewId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            adminReply: replies[reviewId] ?? "",
          }),
        },
      );
      const data = (await response.json()) as { review?: ReviewAdminItem };

      if (response.ok && data.review) {
        setReviews((currentReviews) =>
          currentReviews.map((review) =>
            review.id === reviewId
              ? {
                  ...review,
                  ...data.review,
                  productName: review.productName,
                  productSlug: review.productSlug,
                }
              : review,
          ),
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  async function removeReview(reviewId: string) {
    setBusyId(reviewId);

    try {
      const response = await fetch(
        `/api/admin/reviews/${encodeURIComponent(reviewId)}`,
        { method: "DELETE" },
      );

      if (response.ok) {
        setReviews((currentReviews) =>
          currentReviews.filter((review) => review.id !== reviewId),
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  if (reviews.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-paper p-8 text-center shadow-sm">
        <h1 className="text-2xl font-black">Aucun avis pour le moment</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
          Les avis apparaitront ici apres un achat valide et l&apos;envoi du
          formulaire client.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {reviews.map((review) => (
        <article
          key={review.id}
          className="rounded-lg border border-line bg-paper p-5 shadow-sm"
        >
          <div className="flex flex-col justify-between gap-4 lg:flex-row">
            <div>
              <p className="text-sm font-black uppercase text-teal">
                {review.status === "approved"
                  ? "Valide"
                  : review.status === "hidden"
                    ? "Masque"
                    : "En attente"}
              </p>
              <h2 className="mt-2 text-xl font-black">{review.customerName}</h2>
              <ReviewSummaryBadge
                summary={{ averageRating: review.rating, totalReviews: 1 }}
              />
              <p className="mt-3 text-sm leading-6 text-muted">{review.comment}</p>
              <div className="mt-3 text-xs font-bold text-muted">
                {new Date(review.createdAt).toLocaleDateString("fr-FR")} -{" "}
                {review.productSlug ? (
                  <Link
                    href={`/produit/${review.productSlug}`}
                    className="text-teal hover:text-foreground"
                  >
                    {review.productName}
                  </Link>
                ) : (
                  review.productName
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button
                type="button"
                onClick={() => updateReview(review.id, "approved")}
                disabled={busyId === review.id}
                className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#eef8f6]"
              >
                <Check size={16} aria-hidden="true" />
                Valider
              </button>
              <button
                type="button"
                onClick={() => updateReview(review.id, "hidden")}
                disabled={busyId === review.id}
                className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
              >
                <EyeOff size={16} aria-hidden="true" />
                Masquer
              </button>
              <button
                type="button"
                onClick={() => removeReview(review.id)}
                disabled={busyId === review.id}
                className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-[#fecdd3] px-3 text-sm font-black text-rose hover:bg-[#fff1f2]"
              >
                {busyId === review.id ? (
                  <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                ) : (
                  <Trash2 size={16} aria-hidden="true" />
                )}
                Supprimer
              </button>
            </div>
          </div>

          <label className="mt-5 grid gap-2 text-sm font-bold">
            Reponse admin
            <textarea
              value={replies[review.id] ?? ""}
              onChange={(event) =>
                setReplies((currentReplies) => ({
                  ...currentReplies,
                  [review.id]: event.target.value,
                }))
              }
              rows={3}
              className="focus-ring rounded-md border border-line px-3 py-3 text-base"
              placeholder="Repondre publiquement a cet avis..."
            />
          </label>
          <button
            type="button"
            onClick={() => updateReview(review.id)}
            disabled={busyId === review.id}
            className="focus-ring mt-3 inline-flex min-h-10 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-black text-white hover:bg-[#2b2b2b] disabled:cursor-not-allowed disabled:opacity-65"
          >
            <MessageSquare size={16} aria-hidden="true" />
            Enregistrer la reponse
          </button>
        </article>
      ))}
    </div>
  );
}

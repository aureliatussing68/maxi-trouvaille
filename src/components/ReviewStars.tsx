import { Star } from "lucide-react";
import type { ProductReviewSummary } from "@/lib/product-reviews";

function formatRating(value: number) {
  return value.toLocaleString("fr-FR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  });
}

export function ReviewStars({
  rating,
  total,
  compact = false,
}: {
  rating: number;
  total?: number;
  compact?: boolean;
}) {
  const roundedRating = Math.round(rating);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-muted">
      <span className="inline-flex items-center gap-0.5 text-brand" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={compact ? 14 : 17}
            fill={star <= roundedRating ? "currentColor" : "none"}
          />
        ))}
      </span>
      <span>
        {rating > 0 ? formatRating(rating) : "Aucune note"}
        {typeof total === "number" ? ` (${total} avis)` : ""}
      </span>
    </div>
  );
}

export function ReviewSummaryBadge({
  summary,
  compact = false,
}: {
  summary?: ProductReviewSummary;
  compact?: boolean;
}) {
  const safeSummary = summary ?? { averageRating: 0, totalReviews: 0 };
  return (
    <ReviewStars
      rating={safeSummary.averageRating}
      total={safeSummary.totalReviews}
      compact={compact}
    />
  );
}

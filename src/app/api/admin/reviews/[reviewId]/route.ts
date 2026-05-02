import { NextResponse } from "next/server";
import { isAdminModeEnabled } from "@/lib/admin";
import {
  deleteReview,
  updateReviewAdmin,
  type ReviewStatus,
} from "@/lib/product-reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminReviewRouteProps = {
  params: Promise<{ reviewId: string }>;
};

function requireAdmin() {
  return isAdminModeEnabled();
}

export async function PATCH(request: Request, { params }: AdminReviewRouteProps) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Admin desactive." }, { status: 403 });
  }

  const { reviewId } = await params;
  let payload: { status?: ReviewStatus; adminReply?: unknown };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
  }

  const review = await updateReviewAdmin({
    reviewId: decodeURIComponent(reviewId),
    status: payload.status,
    adminReply: payload.adminReply,
  });

  if (!review) {
    return NextResponse.json({ error: "Avis introuvable." }, { status: 404 });
  }

  return NextResponse.json({ review });
}

export async function DELETE(_request: Request, { params }: AdminReviewRouteProps) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Admin desactive." }, { status: 403 });
  }

  const { reviewId } = await params;
  const deleted = await deleteReview(decodeURIComponent(reviewId));

  if (!deleted) {
    return NextResponse.json({ error: "Avis introuvable." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

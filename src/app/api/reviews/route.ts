import { NextResponse } from "next/server";
import { getCatalogProductById } from "@/lib/catalog-server";
import { createProductReview } from "@/lib/product-reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: {
    token?: unknown;
    productId?: unknown;
    rating?: unknown;
    customerName?: unknown;
    comment?: unknown;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
  }

  const token = typeof payload.token === "string" ? payload.token : "";
  const productId = typeof payload.productId === "string" ? payload.productId : "";

  if (!token || !productId) {
    return NextResponse.json({ error: "Lien d'avis invalide." }, { status: 400 });
  }

  const product = await getCatalogProductById(productId);
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }

  const result = await createProductReview({
    token,
    productId,
    rating: payload.rating,
    customerName: payload.customerName,
    comment: payload.comment,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    review: result.review,
    message: "Avis envoye. Il sera publie apres validation admin.",
  });
}

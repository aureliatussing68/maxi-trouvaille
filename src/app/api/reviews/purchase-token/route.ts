import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createReviewPurchaseToken } from "@/lib/product-reviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeApiVersion = "2026-04-22.dahlia";

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

function getReviewProductIds(metadata: Stripe.Metadata | null | undefined) {
  return String(metadata?.reviewProductIds ?? "")
    .split(",")
    .map((productId) => productId.trim())
    .filter(Boolean);
}

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return NextResponse.json(
      { error: "Stripe n'est pas encore configure pour generer un lien d'avis." },
      { status: 400 },
    );
  }

  let payload: { sessionId?: unknown };

  try {
    payload = (await request.json()) as { sessionId?: unknown };
  } catch {
    return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
  }

  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";
  if (!sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Session Stripe invalide." }, { status: 400 });
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: stripeApiVersion,
  });
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    return NextResponse.json(
      { error: "Le paiement doit etre valide avant de laisser un avis." },
      { status: 403 },
    );
  }

  const productIds = getReviewProductIds(session.metadata);
  if (productIds.length === 0) {
    return NextResponse.json(
      { error: "Aucun produit eligible aux avis sur cette commande." },
      { status: 400 },
    );
  }

  const token = await createReviewPurchaseToken({
    checkoutSessionId: session.id,
    productIds,
    customerEmail: session.customer_details?.email ?? session.customer_email ?? "",
  });

  if (!token) {
    return NextResponse.json(
      { error: "Base de donnees avis non configuree." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    reviewUrl: `${getSiteUrl()}/avis/laisser?token=${encodeURIComponent(
      token.token,
    )}`,
  });
}

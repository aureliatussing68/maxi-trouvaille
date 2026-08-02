import { NextResponse } from "next/server";
import Stripe from "stripe";
import { markDropshippingOrderPaid } from "@/lib/dropshipping-server";
import type { DropshippingOrder } from "@/lib/dropshipping-shared";
import { sendCheckoutConfirmationEmail } from "@/lib/order-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeApiVersion = "2026-04-22.dahlia";

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret || webhookSecret.includes("remplacez_moi")) {
    return NextResponse.json(
      { error: "Webhook Stripe non configure." },
      { status: 400 },
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Signature Stripe absente." },
      { status: 400 },
    );
  }

  const stripe = new Stripe(secretKey, { apiVersion: stripeApiVersion });
  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json(
      { error: "Signature Stripe invalide." },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    let paidOrder: DropshippingOrder | null = null;

    if (session.id && session.metadata?.hasDropshippingItems === "true") {
      try {
        paidOrder = await markDropshippingOrderPaid(session.id);
      } catch {
        return NextResponse.json(
          {
            error:
              "Paiement confirme, mais traitement stock local a relancer.",
          },
          { status: 500 },
        );
      }
    }

    // Email de confirmation client : totalement isole du traitement
    // paiement/stock ci-dessus. Un echec d'email ne doit jamais changer le
    // code HTTP renvoye a Stripe, sinon Stripe rejoue l'evenement en boucle
    // et la commande est retraitee. Sans cle d'envoi configuree, l'appel ne
    // fait strictement rien.
    if (session.id) {
      try {
        await sendCheckoutConfirmationEmail({
          session,
          order: paidOrder,
          stripe,
        });
      } catch {
        // Silence volontaire : le paiement reste valide.
      }
    }
  }

  return NextResponse.json({ received: true });
}

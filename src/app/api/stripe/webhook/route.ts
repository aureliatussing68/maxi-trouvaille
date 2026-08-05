import { NextResponse } from "next/server";
import Stripe from "stripe";
import { markDropshippingOrderPaid } from "@/lib/dropshipping-server";
import type { DropshippingOrder } from "@/lib/dropshipping-shared";
import { recordEmailFailureIfReal } from "@/lib/email-incidents";
import {
  sendCheckoutConfirmationEmail,
  sendNewOrderAlertEmail,
} from "@/lib/order-emails";

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
    let storageFailed = false;

    if (session.id && session.metadata?.hasDropshippingItems === "true") {
      try {
        paidOrder = await markDropshippingOrderPaid(session.id);
      } catch {
        // On NE sort PAS ici. Auparavant, un echec d'enregistrement renvoyait
        // un 500 immediat : la commande n'etait ni stockee NI signalee par
        // email, et le commercant n'apprenait rien. Or c'est exactement le
        // moment ou il a le plus besoin d'etre prevenu. On note l'echec, on
        // envoie les emails, et on renvoie le 500 a la toute fin pour que
        // Stripe reessaie l'enregistrement.
        storageFailed = true;
      }
    }

    // Emails : totalement isoles du traitement paiement/stock ci-dessus.
    // Un echec d'email ne doit jamais changer le code HTTP renvoye a Stripe,
    // sinon Stripe rejoue l'evenement en boucle et la commande est retraitee.
    // Sans cle d'envoi configuree, ces appels ne font strictement rien.
    if (session.id) {
      // Chaque envoi est isole ET trace. Le `catch` ne renvoie plus au
      // silence : un echec laisse une trace durable (table email_incidents)
      // et une ligne de niveau ERREUR dans les journaux d'execution.
      // Sans cette trace, un client pouvait payer, ne rien recevoir, et
      // personne ne l'apprenait jamais.
      try {
        const confirmation = await sendCheckoutConfirmationEmail({
          session,
          order: paidOrder,
          stripe,
        });

        await recordEmailFailureIfReal({
          kind: "confirmation-client",
          reason: confirmation.sent ? "" : confirmation.reason,
          recipient: session.customer_details?.email ?? "",
          orderReference: paidOrder?.orderNumber ?? session.id,
        });
      } catch (error) {
        console.error(
          "[webhook] email de confirmation client impossible :",
          error,
        );
      }

      // Alerte interne, envoyee separement : si l'email client echoue, le
      // commercant doit quand meme recevoir l'adresse de livraison.
      try {
        const alerte = await sendNewOrderAlertEmail({
          session,
          order: paidOrder,
          stripe,
        });

        await recordEmailFailureIfReal({
          kind: "alerte-commercant",
          reason: alerte.sent ? "" : alerte.reason,
          orderReference: paidOrder?.orderNumber ?? session.id,
        });
      } catch (error) {
        console.error("[webhook] alerte commercant impossible :", error);
      }
    }

    if (storageFailed) {
      console.error(
        `[webhook] enregistrement de la commande IMPOSSIBLE pour la session ${session.id} — paiement encaisse, fiche non ecrite. Stripe va reessayer.`,
      );
    }

    if (storageFailed) {
      return NextResponse.json(
        { error: "Paiement confirme, mais traitement stock local a relancer." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ received: true });
}

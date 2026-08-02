/**
 * Branchement des emails clients sur les commandes.
 *
 * Toutes les fonctions de ce fichier :
 * - commencent par verifier que l'envoi d'emails est actif (sans cle
 *   configuree, elles ne font strictement rien) ;
 * - ne jettent JAMAIS d'exception (un email rate ne doit jamais faire
 *   echouer un paiement ni une mise a jour de commande) ;
 * - ne posent leur marqueur anti-doublon qu'APRES un envoi reussi.
 */

import type Stripe from "stripe";
import {
  markDropshippingOrderEmailSent,
  readDropshippingOrders,
} from "@/lib/dropshipping-server";
import type { DropshippingOrder } from "@/lib/dropshipping-shared";
import {
  PUBLIC_DELIVERY_ESTIMATE,
  renderCustomerReplyEmail,
  renderOrderConfirmationEmail,
  renderShippingEmail,
  type OrderEmailLine,
} from "@/lib/email-templates";
import { getEmailSettings, isEmailSendingEnabled, sendEmail } from "@/lib/mailer";
import { getShippingMethodById } from "@/lib/shipping";

export type EmailDispatchResult = {
  sent: boolean;
  reason: string;
};

function skipped(reason: string): EmailDispatchResult {
  return { sent: false, reason };
}

function cleanValue(value: unknown, maxLength = 250) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function toCents(value: unknown) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function getCommonDeliveryEstimate(lines: OrderEmailLine[]) {
  const values = Array.from(
    new Set(
      lines
        .map((line) => cleanValue(line.deliveryEstimate, 120))
        .filter((value) => value.length > 0),
    ),
  );

  return values.length === 1 ? values[0] : "";
}

function toOrderEmailLines(order: DropshippingOrder): OrderEmailLine[] {
  return order.lines.map((line) => ({
    name: line.productName,
    quantity: line.quantity,
    unitPriceCents: line.soldPriceCents,
    deliveryEstimate: line.deliveryEstimate,
  }));
}

/**
 * Email de confirmation d'une commande dropshipping enregistree.
 * Le marqueur confirmationEmailSentAt evite le doublon si Stripe rejoue
 * l'evenement (fiable seulement quand une vraie base Postgres est branchee).
 */
export async function sendDropshippingOrderConfirmationEmail(
  order: DropshippingOrder,
  options?: { totalPaidCents?: number | null },
): Promise<EmailDispatchResult> {
  try {
    if (!isEmailSendingEnabled()) {
      return skipped("emails_inactifs");
    }

    if (order.confirmationEmailSentAt) {
      return skipped("deja_envoye");
    }

    const to = cleanValue(order.customer?.email, 180);

    if (!to) {
      return skipped("email_client_absent");
    }

    const settings = getEmailSettings();
    const lines = toOrderEmailLines(order);
    const itemsTotalCents = toCents(order.soldTotalCents);
    const shippingPriceCents = toCents(order.shippingPriceCents);
    const totalPaidCents =
      toCents(options?.totalPaidCents) ??
      (itemsTotalCents === null
        ? null
        : itemsTotalCents + (shippingPriceCents ?? 0));

    const content = renderOrderConfirmationEmail({
      customerName: order.customer?.name,
      orderNumber: order.orderNumber,
      orderDateIso: order.createdAt,
      lines,
      itemsTotalCents,
      shippingPriceCents,
      totalPaidCents,
      shippingMethodLabel: order.shippingAddress?.methodLabel,
      shippingAddress: {
        name: order.customer?.name,
        street: order.shippingAddress?.street,
        postalCode: order.shippingAddress?.postalCode,
        city: order.shippingAddress?.city,
        country: order.shippingAddress?.country,
      },
      deliveryEstimate: getCommonDeliveryEstimate(lines) || PUBLIC_DELIVERY_ESTIMATE,
      siteUrl: settings.siteUrl,
      supportEmail: settings.replyTo,
    });

    const result = await sendEmail({ to, ...content });

    if (!result.sent) {
      return skipped(result.reason);
    }

    await markDropshippingOrderEmailSent(order.id, "confirmationEmailSentAt").catch(
      () => null,
    );

    return { sent: true, reason: "confirmation_envoyee" };
  } catch {
    return skipped("erreur_interne");
  }
}

type StripeFallbackOrder = {
  to: string;
  customerName: string;
  lines: OrderEmailLine[];
  itemsTotalCents: number | null;
  shippingPriceCents: number | null;
  totalPaidCents: number | null;
  shippingMethodLabel: string;
  street: string;
  postalCode: string;
  city: string;
};

async function buildFallbackFromSession(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
): Promise<StripeFallbackOrder | null> {
  const metadata = session.metadata ?? {};
  const to = cleanValue(
    session.customer_email || metadata.shippingEmail || session.customer_details?.email,
    180,
  );

  if (!to) {
    return null;
  }

  const method = getShippingMethodById(metadata.shippingMethod);
  const lines: OrderEmailLine[] = [];
  let itemsTotalCents = 0;
  let shippingFromLineItems: number | null = null;

  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 50,
    });

    for (const item of lineItems.data) {
      const label = cleanValue(item.description, 220);
      const amount = toCents(item.amount_total) ?? 0;

      if (/^livraison\s*[-–]/i.test(label)) {
        shippingFromLineItems = (shippingFromLineItems ?? 0) + amount;
        continue;
      }

      const quantity = Math.max(1, Math.trunc(Number(item.quantity)) || 1);
      lines.push({
        name: label || "Article",
        quantity,
        totalPriceCents: amount,
      });
      itemsTotalCents += amount;
    }
  } catch {
    // Le detail des articles n'est pas indispensable : on envoie quand meme
    // une confirmation avec le montant paye et l'adresse de livraison.
  }

  return {
    to,
    customerName: cleanValue(
      metadata.shippingName || session.customer_details?.name,
      160,
    ),
    lines,
    itemsTotalCents: lines.length > 0 ? itemsTotalCents : null,
    shippingPriceCents: shippingFromLineItems ?? toCents(metadata.shippingPriceCents),
    totalPaidCents: toCents(session.amount_total),
    shippingMethodLabel: method?.label ?? "",
    street: cleanValue(metadata.shippingStreet, 250),
    postalCode: cleanValue(metadata.shippingPostalCode, 20),
    city: cleanValue(metadata.shippingCity, 120),
  };
}

/**
 * Point d'entree unique appele par le webhook Stripe.
 * Couvre les commandes dropshipping (fiche commande enregistree) ET les
 * commandes de stock interne (aucune fiche : on repart des donnees Stripe).
 */
export async function sendCheckoutConfirmationEmail({
  session,
  order,
  stripe,
}: {
  session: Stripe.Checkout.Session;
  order: DropshippingOrder | null;
  stripe: Stripe;
}): Promise<EmailDispatchResult> {
  try {
    if (!isEmailSendingEnabled()) {
      return skipped("emails_inactifs");
    }

    if (order) {
      return await sendDropshippingOrderConfirmationEmail(order, {
        totalPaidCents: session.amount_total,
      });
    }

    const fallback = await buildFallbackFromSession(session, stripe);

    if (!fallback) {
      return skipped("email_client_absent");
    }

    const settings = getEmailSettings();
    const content = renderOrderConfirmationEmail({
      customerName: fallback.customerName,
      orderDateIso: new Date().toISOString(),
      lines: fallback.lines,
      itemsTotalCents: fallback.itemsTotalCents,
      shippingPriceCents: fallback.shippingPriceCents,
      totalPaidCents: fallback.totalPaidCents,
      shippingMethodLabel: fallback.shippingMethodLabel,
      shippingAddress: {
        name: fallback.customerName,
        street: fallback.street,
        postalCode: fallback.postalCode,
        city: fallback.city,
        country: fallback.street || fallback.city ? "France" : "",
      },
      deliveryEstimate: PUBLIC_DELIVERY_ESTIMATE,
      siteUrl: settings.siteUrl,
      supportEmail: settings.replyTo,
    });

    const result = await sendEmail({ to: fallback.to, ...content });

    return result.sent
      ? { sent: true, reason: "confirmation_envoyee" }
      : skipped(result.reason);
  } catch {
    return skipped("erreur_interne");
  }
}

/**
 * Email d'expedition, declenche depuis l'admin au passage en statut expedie.
 * Le marqueur shippingEmailSentAt garantit un seul envoi par commande.
 */
export async function sendDropshippingShippingEmail(
  order: DropshippingOrder,
): Promise<EmailDispatchResult> {
  try {
    if (!isEmailSendingEnabled()) {
      return skipped("emails_inactifs");
    }

    if (order.status !== "expedie") {
      return skipped("statut_non_expedie");
    }

    if (order.paymentStatus !== "paid") {
      return skipped("commande_non_payee");
    }

    if (order.shippingEmailSentAt) {
      return skipped("deja_envoye");
    }

    // Relecture de la fiche stockee : la commande recue en argument vient
    // d'un patch admin et pourrait ne pas porter le marqueur le plus recent.
    const storedOrders = await readDropshippingOrders().catch(
      () => [] as DropshippingOrder[],
    );
    const storedOrder = storedOrders.find((item) => item.id === order.id);

    if (storedOrder?.shippingEmailSentAt) {
      return skipped("deja_envoye");
    }

    const to = cleanValue(order.customer?.email, 180);

    if (!to) {
      return skipped("email_client_absent");
    }

    const settings = getEmailSettings();
    const content = renderShippingEmail({
      customerName: order.customer?.name,
      orderNumber: order.orderNumber,
      trackingNumber: order.trackingNumber,
      shippingMethodLabel: order.shippingAddress?.methodLabel,
      shippingAddress: {
        name: order.customer?.name,
        street: order.shippingAddress?.street,
        postalCode: order.shippingAddress?.postalCode,
        city: order.shippingAddress?.city,
        country: order.shippingAddress?.country,
      },
      lines: toOrderEmailLines(order),
      siteUrl: settings.siteUrl,
      supportEmail: settings.replyTo,
    });

    const result = await sendEmail({ to, ...content });

    if (!result.sent) {
      return skipped(result.reason);
    }

    await markDropshippingOrderEmailSent(order.id, "shippingEmailSentAt").catch(
      () => null,
    );

    return { sent: true, reason: "expedition_envoyee" };
  } catch {
    return skipped("erreur_interne");
  }
}

/**
 * Reponse a un message client. Gabarit pret a etre appele plus tard par la
 * reponse automatique : aucun appel automatique n'existe aujourd'hui.
 */
export async function sendCustomerReplyEmail(input: {
  to: string;
  customerName?: string;
  productName?: string;
  productUrl?: string;
  originalMessage?: string;
  replyText: string;
}): Promise<EmailDispatchResult> {
  try {
    if (!isEmailSendingEnabled()) {
      return skipped("emails_inactifs");
    }

    const to = cleanValue(input.to, 180);
    const replyText = cleanValue(input.replyText, 4000);

    if (!to) {
      return skipped("email_client_absent");
    }

    if (!replyText) {
      return skipped("reponse_vide");
    }

    const settings = getEmailSettings();
    const content = renderCustomerReplyEmail({
      customerName: input.customerName,
      productName: input.productName,
      productUrl: input.productUrl,
      originalMessage: input.originalMessage,
      replyText,
      siteUrl: settings.siteUrl,
      supportEmail: settings.replyTo,
    });

    const result = await sendEmail({ to, ...content });

    return result.sent
      ? { sent: true, reason: "reponse_envoyee" }
      : skipped(result.reason);
  } catch {
    return skipped("erreur_interne");
  }
}

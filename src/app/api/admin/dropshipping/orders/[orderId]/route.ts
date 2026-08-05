import { NextResponse } from "next/server";
import { isAdminModeEnabled } from "@/lib/admin";
import { adminApiUnavailable } from "@/lib/admin-api";
import { updateDropshippingOrder } from "@/lib/dropshipping-server";
import { sanitizeDropshippingStatus } from "@/lib/dropshipping-shared";
import { sendDropshippingShippingEmail } from "@/lib/order-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  if (!isAdminModeEnabled()) {
    return adminApiUnavailable();
  }

  const { orderId } = await context.params;
  const payload = (await request.json()) as {
    status?: unknown;
    trackingNumber?: unknown;
    supplierOrderReference?: unknown;
    internalNote?: unknown;
    prepareFollowUp?: unknown;
  };

  const order = await updateDropshippingOrder(orderId, {
    status: payload.status
      ? sanitizeDropshippingStatus(payload.status)
      : undefined,
    trackingNumber:
      typeof payload.trackingNumber === "string"
        ? payload.trackingNumber.trim()
        : undefined,
    supplierOrderReference:
      typeof payload.supplierOrderReference === "string"
        ? payload.supplierOrderReference.trim()
        : undefined,
    internalNote:
      typeof payload.internalNote === "string"
        ? payload.internalNote.trim()
        : undefined,
    followUpMessagePreparedAt: payload.prepareFollowUp
      ? new Date().toISOString()
      : undefined,
  });

  if (!order) {
    return NextResponse.json(
      { error: "Commande introuvable." },
      { status: 404 },
    );
  }

  // Email d'expedition : un seul envoi par commande (marqueur
  // shippingEmailSentAt), uniquement si la commande est payee et passee en
  // "expedie". Isole dans son try/catch : un email rate ne doit jamais
  // annuler la mise a jour de la commande. Inerte sans cle d'envoi.
  // Le resultat de l'envoi est desormais RECUPERE et RENVOYE. Auparavant il
  // etait jete : l'email d'expedition pouvait echouer sans laisser la moindre
  // trace applicative, et l'ecran d'administration affichait un succes.
  let emailExpedition: { sent: boolean; reason: string } = {
    sent: false,
    reason: "non_tente",
  };

  try {
    emailExpedition = await sendDropshippingShippingEmail(order);
  } catch (error) {
    console.error("[admin] email d'expedition impossible :", error);
    emailExpedition = { sent: false, reason: "erreur_interne" };
  }

  return NextResponse.json({ order, emailExpedition });
}

import { NextResponse } from "next/server";
import { isAdminModeEnabled } from "@/lib/admin";
import { adminApiUnavailable } from "@/lib/admin-api";
import { sendCustomerReplyEmail } from "@/lib/order-emails";
import { updateProductMessageSupport } from "@/lib/product-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ messageId: string }>;
};

const allowedStatuses = ["escalade", "brouillon", "envoye"];

export async function PATCH(request: Request, context: RouteContext) {
  if (!isAdminModeEnabled()) {
    return adminApiUnavailable();
  }

  const { messageId } = await context.params;
  const payload = (await request.json()) as {
    supportDraft?: unknown;
    supportStatus?: unknown;
  };

  const supportStatus =
    typeof payload.supportStatus === "string" &&
    allowedStatuses.includes(payload.supportStatus)
      ? payload.supportStatus
      : undefined;

  const supportDraft =
    typeof payload.supportDraft === "string" && payload.supportDraft.trim()
      ? payload.supportDraft.trim()
      : undefined;

  if (!supportStatus && !supportDraft) {
    return NextResponse.json({ error: "Rien a mettre a jour." }, { status: 400 });
  }

  const message = await updateProductMessageSupport(messageId, {
    supportDraft,
    supportStatus,
    // La date d'envoi n'est posee que lorsque Mustapha valide reellement.
    supportSentAt:
      supportStatus === "envoye" ? new Date().toISOString() : undefined,
  });

  if (!message) {
    return NextResponse.json({ error: "Message introuvable." }, { status: 404 });
  }

  // Envoi reel de la reponse au client, UNIQUEMENT si le service d'envoi est
  // configure (RESEND_API_KEY). Sans cle, sendCustomerReplyEmail renvoie
  // { sent: false } sans rien contacter : l'admin retombe alors sur
  // l'ouverture du logiciel de messagerie, exactement comme avant.
  // Isole dans un try/catch : un email en echec n'annule jamais la mise a jour.
  let emailSent = false;
  let emailReason = "non_demande";

  if (supportStatus === "envoye") {
    try {
      const dispatch = await sendCustomerReplyEmail({
        to: message.customerEmail,
        customerName: message.customerName,
        productName: message.productName,
        productUrl: message.productUrl,
        originalMessage: message.message,
        replyText: supportDraft ?? message.supportDraft ?? "",
      });
      emailSent = dispatch.sent;
      emailReason = dispatch.reason;
    } catch {
      emailSent = false;
      emailReason = "erreur_interne";
    }
  }

  return NextResponse.json({ message, emailSent, emailReason });
}

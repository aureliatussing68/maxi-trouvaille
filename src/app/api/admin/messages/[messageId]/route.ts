import { NextResponse } from "next/server";
import { isAdminModeEnabled } from "@/lib/admin";
import { adminApiUnavailable } from "@/lib/admin-api";
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

  return NextResponse.json({ message });
}

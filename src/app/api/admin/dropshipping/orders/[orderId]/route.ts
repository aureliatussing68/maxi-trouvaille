import { NextResponse } from "next/server";
import { isAdminModeEnabled } from "@/lib/admin";
import { adminApiUnavailable } from "@/lib/admin-api";
import { updateDropshippingOrder } from "@/lib/dropshipping-server";
import { sanitizeDropshippingStatus } from "@/lib/dropshipping-shared";

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
    status: payload.status ? sanitizeDropshippingStatus(payload.status) : undefined,
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
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }

  return NextResponse.json({ order });
}

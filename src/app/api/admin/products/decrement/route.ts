import { NextResponse } from "next/server";
import { decrementQuickProductStock } from "@/lib/catalog-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    items?: Array<{ productId?: unknown; quantity?: unknown }>;
  };

  const items = Array.isArray(payload.items)
    ? payload.items
        .filter(
          (item) =>
            typeof item.productId === "string" &&
            Number.isFinite(Number(item.quantity)),
        )
        .map((item) => ({
          productId: String(item.productId),
          quantity: Number(item.quantity),
        }))
    : [];

  // Future production hardening: this should be triggered by a Stripe webhook
  // after payment confirmation, not only by the browser success page.
  const products = await decrementQuickProductStock(items);

  return NextResponse.json({ products });
}

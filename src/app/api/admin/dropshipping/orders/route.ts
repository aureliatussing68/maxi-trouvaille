import { NextResponse } from "next/server";
import { isAdminModeEnabled } from "@/lib/admin";
import { adminApiUnavailable } from "@/lib/admin-api";
import { readDropshippingOrders } from "@/lib/dropshipping-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAdminModeEnabled()) {
    return adminApiUnavailable();
  }

  return NextResponse.json({ orders: await readDropshippingOrders() });
}

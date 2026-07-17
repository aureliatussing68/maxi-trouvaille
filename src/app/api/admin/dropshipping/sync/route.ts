import { NextResponse } from "next/server";
import { isAdminModeEnabled } from "@/lib/admin";
import { adminApiUnavailable } from "@/lib/admin-api";
import { getAllProducts } from "@/lib/catalog-server";
import {
  buildDropshippingAlerts,
  dropshippingAutomationJobs,
} from "@/lib/dropshipping-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAdminModeEnabled()) {
    return adminApiUnavailable();
  }

  const products = await getAllProducts();

  return NextResponse.json({
    mode: "semi-automatique",
    jobs: dropshippingAutomationJobs,
    alerts: buildDropshippingAlerts(products),
  });
}

export async function POST() {
  if (!isAdminModeEnabled()) {
    return adminApiUnavailable();
  }

  return NextResponse.json(
    {
      error:
        "Synchronisation automatique non activee. Ajoutez un connecteur fournisseur reel avant execution.",
    },
    { status: 409 },
  );
}

import { NextResponse } from "next/server";
import { isProductPurchasable } from "@/lib/catalog";
import { getPublicProducts } from "@/lib/catalog-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const items = (await getPublicProducts())
    .filter(isProductPurchasable)
    .map((product) => ({
      id: product.id,
      stock: product.stock,
    }));

  return NextResponse.json(
    { items },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

import { NextResponse } from "next/server";
import { getPublicProducts } from "@/lib/catalog-server";
// Meme regle que isProductPurchasable() cote catalogue : le verdict est calcule
// sur le serveur puis transporte avec la fiche publique (voir
// src/lib/public-product.ts), sans exposer le dossier de sourcing.
import { isPublicProductPurchasable } from "@/lib/public-product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const items = (await getPublicProducts())
    .filter(isPublicProductPurchasable)
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

import { NextResponse } from "next/server";
import { getCatalogProductById } from "@/lib/catalog-server";
import {
  normalizeStatsVisitorId,
  setProductFavorite,
} from "@/lib/product-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductFavoriteRouteProps = {
  params: Promise<{ productId: string }>;
};

export async function POST(
  request: Request,
  { params }: ProductFavoriteRouteProps,
) {
  const { productId } = await params;
  const product = await getCatalogProductById(decodeURIComponent(productId));

  if (!product) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }

  let payload: { visitorId?: unknown; favorite?: unknown };

  try {
    payload = (await request.json()) as {
      visitorId?: unknown;
      favorite?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
  }

  const visitorId = normalizeStatsVisitorId(payload.visitorId);
  if (!visitorId) {
    return NextResponse.json({ error: "Visiteur invalide." }, { status: 400 });
  }

  const result = await setProductFavorite(
    product.id,
    visitorId,
    payload.favorite === true,
  );

  return NextResponse.json(result);
}

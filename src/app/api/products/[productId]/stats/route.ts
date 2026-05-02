import { NextResponse } from "next/server";
import { getCatalogProductById } from "@/lib/catalog-server";
import {
  getProductStats,
  normalizeStatsVisitorId,
  registerProductView,
} from "@/lib/product-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductStatsRouteProps = {
  params: Promise<{ productId: string }>;
};

async function getProduct(productId: string) {
  return getCatalogProductById(decodeURIComponent(productId));
}

export async function GET(_request: Request, { params }: ProductStatsRouteProps) {
  const { productId } = await params;
  const product = await getProduct(productId);

  if (!product) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }

  return NextResponse.json({
    stats: await getProductStats(product.id),
  });
}

export async function POST(request: Request, { params }: ProductStatsRouteProps) {
  const { productId } = await params;
  const product = await getProduct(productId);

  if (!product) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }

  let payload: { visitorId?: unknown };

  try {
    payload = (await request.json()) as { visitorId?: unknown };
  } catch {
    return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
  }

  const visitorId = normalizeStatsVisitorId(payload.visitorId);
  if (!visitorId) {
    return NextResponse.json({ error: "Visiteur invalide." }, { status: 400 });
  }

  const result = await registerProductView(product.id, visitorId);
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { createProductMessage } from "@/lib/product-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;

  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Message invalide." }, { status: 400 });
  }

  const customerName = getText(payload.customerName, 120);
  const customerEmail = getText(payload.customerEmail, 180);
  const message = getText(payload.message, 2000);
  const productId = getText(payload.productId, 120);
  const productName = getText(payload.productName, 220);
  const productUrl = getText(payload.productUrl, 500);
  const productPrice = Math.max(0, Math.trunc(Number(payload.productPrice)) || 0);

  if (!customerName || !customerEmail || !message || !productId || !productName) {
    return NextResponse.json(
      { error: "Nom, email, message et produit sont obligatoires." },
      { status: 400 },
    );
  }

  if (!isEmail(customerEmail)) {
    return NextResponse.json(
      { error: "Adresse email invalide." },
      { status: 400 },
    );
  }

  const savedMessage = await createProductMessage({
    customerName,
    customerEmail,
    message,
    productId,
    productName,
    productPrice,
    productUrl,
  });

  return NextResponse.json({ message: savedMessage });
}

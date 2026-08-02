import { NextResponse } from "next/server";
import {
  createProductMessage,
  updateProductMessageSupport,
} from "@/lib/product-messages";
import { triageProductMessage } from "@/lib/support-ai";

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

  // Le message est deja enregistre a ce stade. Le classement et le brouillon
  // sont un bonus : ils sont isoles dans leur propre try/catch, ne changent
  // jamais le code HTTP, et n'empechent jamais le client de voir un succes.
  let autoReply: string | null = null;

  try {
    const triage = await triageProductMessage({
      customerName,
      message,
      productName,
    });

    if (triage) {
      const now = new Date().toISOString();
      await updateProductMessageSupport(savedMessage.id, {
        supportCategory: triage.category,
        supportStatus: triage.status,
        supportDraft: triage.draft,
        supportDraftSource: triage.source,
        supportDraftModel: triage.model,
        supportReason: triage.reason,
        supportDraftAt: now,
        supportSentAt: triage.autoSend ? now : undefined,
      });

      if (triage.autoSend) {
        autoReply = triage.draft;
      }
    }
  } catch {
    // Silencieux : un incident cote assistant ne doit rien changer pour le client.
  }

  // Sans reponse automatique, la reponse JSON est exactement celle d'avant.
  return NextResponse.json(
    autoReply ? { message: savedMessage, autoReply } : { message: savedMessage },
  );
}

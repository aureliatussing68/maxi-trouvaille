import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sonde temporaire de diagnostic : expose UNIQUEMENT le prefixe de la cle
// (sk_test_/sk_live_) et l'etat du drapeau live. Jamais la cle elle-meme.
export async function GET() {
  const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
  return NextResponse.json({
    prefixe_cle_secrete: secretKey.slice(0, 8) || "ABSENTE",
    longueur_cle: secretKey.length,
    drapeau_live: process.env.STRIPE_ENABLE_LIVE_PAYMENTS ?? "ABSENT",
    prefixe_cle_publique: (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "").slice(0, 8) || "ABSENTE",
  });
}

import type { Metadata } from "next";
import Link from "next/link";
import { XCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Paiement annule",
};

export default function PaymentCancelledPage() {
  return (
    <div className="container-page py-12">
      <div className="rounded-lg border border-line bg-paper p-8 text-center shadow-sm">
        <XCircle className="mx-auto mb-4 text-rose" size={46} aria-hidden="true" />
        <h1 className="text-2xl font-black">Paiement test annule</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
          Aucun paiement n&apos;a ete valide. Votre panier reste disponible pour
          continuer le test.
        </p>
        <Link
          href="/panier"
          className="focus-ring mt-6 inline-flex min-h-11 items-center rounded-md bg-foreground px-5 py-2.5 text-sm font-black text-white hover:bg-[#2b2b2b]"
        >
          Retour au panier
        </Link>
      </div>
    </div>
  );
}

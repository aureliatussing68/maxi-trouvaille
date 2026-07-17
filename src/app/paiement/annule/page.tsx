import type { Metadata } from "next";
import Link from "next/link";
import { XCircle } from "lucide-react";
import { CustomerJourneyPanel } from "@/components/CustomerJourneyPanel";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";

export const metadata: Metadata = {
  title: "Paiement annule",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PaymentCancelledPage() {
  return (
    <section className="container-page py-12">
      <div className="rounded-lg border border-line bg-paper p-8 text-center shadow-sm">
        <XCircle className="mx-auto mb-4 text-rose" size={46} aria-hidden="true" />
        <h1 className="text-2xl font-black">Paiement annulé</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
          Aucun paiement n&apos;a ete confirme. Votre panier reste disponible
          pour reprendre votre commande quand vous le souhaitez, avec le
          paiement Maxi Trouvaille et le service client au meme endroit.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/panier"
            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-5 py-2.5 text-sm font-black text-white hover:bg-[#2b2b2b]"
          >
            Retour au panier
          </Link>
          <Link
            href="/contact"
            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-white px-5 py-2.5 text-sm font-black hover:bg-[#f1eadf]"
          >
            Service client
          </Link>
        </div>
      </div>

      <CustomerJourneyPanel className="mt-10" />
      <CustomerSupportQuickLinks className="mt-10" />
    </section>
  );
}

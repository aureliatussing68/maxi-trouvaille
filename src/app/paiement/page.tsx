import type { Metadata } from "next";
import { CreditCard, ShieldCheck, Truck } from "lucide-react";
import { CheckoutView } from "@/components/CheckoutView";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";
import { PageHeader } from "@/components/PageHeader";
import { getPublicProducts } from "@/lib/catalog-server";

export const metadata: Metadata = {
  title: "Paiement",
  description:
    "Paiement sécurisé Maxi Trouvaille par carte bancaire via Stripe, avec livraison suivie.",
  robots: {
    index: false,
    follow: true,
  },
};

export const dynamic = "force-dynamic";

export default async function PaymentPage() {
  const products = await getPublicProducts();

  return (
    <>
      <PageHeader
        eyebrow="Paiement"
        title="Finalisez votre commande"
        description="Adresse de livraison, récapitulatif et paiement par carte sécurisé : c'est la dernière étape avant l'expédition."
      />
      <CheckoutView products={products} />
      <section className="container-page border-t border-line py-10">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-line bg-paper p-4 shadow-sm">
            <CreditCard className="text-teal" size={22} aria-hidden="true" />
            <h2 className="mt-3 text-base font-black">Carte bancaire sécurisée</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Paiement via Stripe : vos données bancaires ne passent jamais par
              nos serveurs.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-paper p-4 shadow-sm">
            <Truck className="text-teal" size={22} aria-hidden="true" />
            <h2 className="mt-3 text-base font-black">Livraison suivie</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Frais affichés avant paiement, numéro de suivi dès
              l&apos;expédition.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-paper p-4 shadow-sm">
            <ShieldCheck className="text-teal" size={22} aria-hidden="true" />
            <h2 className="mt-3 text-base font-black">Achat protégé</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Rétractation 14 jours et service client Maxi Trouvaille à votre
              écoute.
            </p>
          </div>
        </div>
        <CustomerSupportQuickLinks className="mt-10" />
      </section>
    </>
  );
}

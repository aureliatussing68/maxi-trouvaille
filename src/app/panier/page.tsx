import type { Metadata } from "next";
import { CreditCard, ShieldCheck, Truck } from "lucide-react";
import { CartView } from "@/components/CartView";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";
import { PageHeader } from "@/components/PageHeader";
import { getPublicProducts } from "@/lib/catalog-server";

export const metadata: Metadata = {
  title: "Panier",
  description:
    "Votre panier Maxi Trouvaille : vérifiez vos articles, la livraison et le total avant le paiement sécurisé.",
  robots: {
    index: false,
    follow: true,
  },
};

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const products = await getPublicProducts();

  return (
    <>
      <PageHeader
        eyebrow="Panier"
        title="Votre sélection"
        description="Vérifiez vos articles, la livraison et le total avant de passer au paiement sécurisé."
      />
      <CartView products={products} />
      <section className="container-page border-t border-line py-10">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-line bg-paper p-4 shadow-sm">
            <CreditCard className="text-teal" size={22} aria-hidden="true" />
            <h2 className="mt-3 text-base font-black">Paiement sécurisé</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Carte bancaire via Stripe, vos données bancaires ne passent
              jamais par nos serveurs.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-paper p-4 shadow-sm">
            <Truck className="text-teal" size={22} aria-hidden="true" />
            <h2 className="mt-3 text-base font-black">Livraison suivie</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Numéro de suivi dès l&apos;expédition, réception estimée 7 à 14
              jours ouvrés.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-paper p-4 shadow-sm">
            <ShieldCheck className="text-teal" size={22} aria-hidden="true" />
            <h2 className="mt-3 text-base font-black">Retours 14 jours</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Droit de rétractation de 14 jours et service client basé en
              France.
            </p>
          </div>
        </div>
        <CustomerSupportQuickLinks className="mt-10" />
      </section>
    </>
  );
}

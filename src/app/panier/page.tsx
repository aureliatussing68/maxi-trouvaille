import type { Metadata } from "next";
import { PackageCheck, ShieldCheck, ShoppingBag } from "lucide-react";
import { CartView } from "@/components/CartView";
import { CustomerJourneyPanel } from "@/components/CustomerJourneyPanel";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";
import { PageHeader } from "@/components/PageHeader";
import { isDropshippingProduct } from "@/lib/catalog";
import { getAllProducts, getPublicProducts } from "@/lib/catalog-server";

export const metadata: Metadata = {
  title: "Panier",
  description:
    "Panier Maxi Trouvaille avec paiement contrôlé, disponible seulement après validation des articles.",
  robots: {
    index: false,
    follow: true,
  },
};

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const [products, catalogProducts] = await Promise.all([
    getPublicProducts(),
    getAllProducts(),
  ]);
  const partnerCandidateCount = catalogProducts.filter(isDropshippingProduct).length;

  return (
    <>
      <PageHeader
        eyebrow="Panier"
        title="Votre selection"
        description="Verifiez les articles, la livraison et le total avant de passer au paiement Maxi Trouvaille."
      />
      <section className="container-page border-b border-line py-8">
        <CartGuardSummary candidateCount={partnerCandidateCount} />
      </section>
      <section className="container-page border-b border-line py-10">
        <CustomerJourneyPanel />
        <CustomerSupportQuickLinks className="mt-10" />
      </section>
      <CartView products={products} />
    </>
  );
}

function CartGuardSummary({ candidateCount }: { candidateCount: number }) {
  const countLabel =
    candidateCount > 0
      ? `${candidateCount} fiche${candidateCount > 1 ? "s" : ""} en contrôle`
      : "File en préparation";

  return (
    <section className="grid gap-3 md:grid-cols-3">
      <div className="rounded-lg border border-line bg-paper p-4 shadow-sm">
        <ShoppingBag className="text-teal" size={22} aria-hidden="true" />
        <h2 className="mt-3 text-base font-black">Panier sous garde</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Aucun article non prouvé ne reste achetable dans le panier public.
        </p>
      </div>
      <div className="rounded-lg border border-line bg-paper p-4 shadow-sm">
        <PackageCheck className="text-teal" size={22} aria-hidden="true" />
        <h2 className="mt-3 text-base font-black">{countLabel}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Les fiches attendent photo exacte et données de vente complètes.
        </p>
      </div>
      <div className="rounded-lg border border-line bg-paper p-4 shadow-sm">
        <ShieldCheck className="text-teal" size={22} aria-hidden="true" />
        <h2 className="mt-3 text-base font-black">Achat verrouillé</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Paiement, stock et livraison par partenaire logistique restent sous
          contrôle Maxi Trouvaille.
        </p>
      </div>
    </section>
  );
}

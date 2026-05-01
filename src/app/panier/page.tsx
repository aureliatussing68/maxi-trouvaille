import type { Metadata } from "next";
import { CartView } from "@/components/CartView";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Panier",
};

export default function CartPage() {
  return (
    <>
      <PageHeader
        eyebrow="Panier"
        title="Votre selection"
        description="Verifiez les articles avant de passer au paiement Stripe en mode test."
      />
      <CartView />
    </>
  );
}

import type { Metadata } from "next";
import { LegalDocument } from "@/components/LegalDocument";
import { LegalTrustPanel } from "@/components/LegalTrustPanel";
import { ServiceReadinessPanel } from "@/components/ServiceReadinessPanel";
import { getStorefrontControlMetrics } from "@/lib/storefront-control-metrics";

export const metadata: Metadata = {
  title: "Conditions generales de vente",
  description:
    "Conditions generales de vente Maxi Trouvaille pour les produits partenaires, le paiement, la livraison et le service client.",
};

export default async function TermsPage() {
  const metrics = await getStorefrontControlMetrics();

  return (
    <div className="container-page grid gap-8 py-10">
      <ServiceReadinessPanel metrics={metrics} />
      <LegalTrustPanel />
      <LegalDocument documentKey="cgv" />
    </div>
  );
}

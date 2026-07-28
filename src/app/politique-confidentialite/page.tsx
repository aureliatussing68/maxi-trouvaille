import type { Metadata } from "next";
import { LegalDocument } from "@/components/LegalDocument";
import { LegalTrustPanel } from "@/components/LegalTrustPanel";
import { ServiceReadinessPanel } from "@/components/ServiceReadinessPanel";
import { getStorefrontControlMetrics } from "@/lib/storefront-control-metrics";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Politique de confidentialité Maxi Trouvaille pour les commandes, paiements, livraisons, suivi colis et support client.",
};

export default async function PrivacyPage() {
  const metrics = await getStorefrontControlMetrics();

  return (
    <div className="container-page grid gap-8 py-10">
      <ServiceReadinessPanel metrics={metrics} />
      <LegalTrustPanel />
      <LegalDocument documentKey="privacy" />
    </div>
  );
}

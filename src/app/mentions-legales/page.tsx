import type { Metadata } from "next";
import { LegalDocument } from "@/components/LegalDocument";
import { LegalTrustPanel } from "@/components/LegalTrustPanel";
import { ServiceReadinessPanel } from "@/components/ServiceReadinessPanel";
import { getStorefrontControlMetrics } from "@/lib/storefront-control-metrics";

export const metadata: Metadata = {
  title: "Mentions legales",
  description:
    "Mentions legales Maxi Trouvaille pour une boutique centree produits partenaires, service client et suivi colis.",
};

export default async function LegalNoticePage() {
  const metrics = await getStorefrontControlMetrics();

  return (
    <div className="container-page grid gap-8 py-10">
      <ServiceReadinessPanel metrics={metrics} />
      <LegalTrustPanel />
      <LegalDocument documentKey="mentions" />
    </div>
  );
}

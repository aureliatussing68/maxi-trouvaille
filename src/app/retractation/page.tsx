import type { Metadata } from "next";
import { LegalDocument } from "@/components/LegalDocument";
import { LegalTrustPanel } from "@/components/LegalTrustPanel";

export const metadata: Metadata = {
  title: "Droit de rétractation",
  description:
    "Délai de 14 jours, modalités de retour, remboursement et formulaire type de rétractation Maxi Trouvaille.",
};

export default function WithdrawalPage() {
  return (
    <div className="container-page grid gap-8 py-10">
      <LegalTrustPanel />
      <LegalDocument documentKey="retractation" />
    </div>
  );
}

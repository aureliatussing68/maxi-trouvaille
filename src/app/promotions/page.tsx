import type { Metadata } from "next";
import { PartnerCampaignLanding } from "@/components/PartnerCampaignLanding";

export const metadata: Metadata = {
  title: "Promotions produits partenaires",
  description:
    "Promotions produits partenaires Maxi Trouvaille avec paiement Maxi Trouvaille, suivi colis et validation avant mise en vente.",
};

export default function PromotionsPage() {
  return <PartnerCampaignLanding kind="promotion" />;
}

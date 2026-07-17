import type { Metadata } from "next";
import { PartnerCampaignLanding } from "@/components/PartnerCampaignLanding";

export const metadata: Metadata = {
  title: "Nouveautés produits partenaires",
  description:
    "Nouveautés produits partenaires Maxi Trouvaille avec paiement Maxi Trouvaille, suivi colis et validation avant mise en vente.",
};

export default function NewProductsPage() {
  return <PartnerCampaignLanding kind="new" />;
}

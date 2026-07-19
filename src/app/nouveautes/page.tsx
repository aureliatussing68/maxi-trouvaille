import type { Metadata } from "next";
import { PartnerCampaignLanding } from "@/components/PartnerCampaignLanding";

export const metadata: Metadata = {
  title: "Nouveautés",
  description:
    "Les derniers produits arrivés chez Maxi Trouvaille : trouvailles malignes à petits prix, ajoutées régulièrement.",
};

export default function NewProductsPage() {
  return <PartnerCampaignLanding kind="new" />;
}

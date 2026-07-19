import type { Metadata } from "next";
import { PartnerCampaignLanding } from "@/components/PartnerCampaignLanding";

export const metadata: Metadata = {
  title: "Promotions",
  description:
    "Prix barrés et bonnes affaires : la sélection promo Maxi Trouvaille, mise à jour régulièrement.",
};

export default function PromotionsPage() {
  return <PartnerCampaignLanding kind="promotion" />;
}

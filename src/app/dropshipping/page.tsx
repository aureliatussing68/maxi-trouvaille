import { permanentRedirect } from "next/navigation";

export default function LegacyPartnerProductsAliasPage() {
  permanentRedirect("/produits-partenaires");
}

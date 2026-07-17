import { permanentRedirect } from "next/navigation";

export default function LegacyDropshippingTermsPage() {
  permanentRedirect("/conditions-produits-partenaires");
}

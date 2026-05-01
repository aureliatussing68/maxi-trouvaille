import type { Metadata } from "next";
import { LegalDocument } from "@/components/LegalDocument";

export const metadata: Metadata = {
  title: "Politique de confidentialite",
};

export default function PrivacyPage() {
  return <LegalDocument documentKey="privacy" />;
}

import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { QuickProductImportForm } from "@/components/QuickProductImportForm";

export const metadata: Metadata = {
  title: "Ajout rapide produits",
};

export default function QuickAddProductPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Ajout rapide de produits"
        description="Ajoutez des images pour generer une fiche produit en brouillon/HOLD, puis verifiez les images exactes et les preuves avant validation."
      />
      <QuickProductImportForm />
    </>
  );
}

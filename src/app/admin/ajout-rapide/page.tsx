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
        description="Collez les informations depuis Leboncoin et enchainez les ajouts sans rechargement."
      />
      <QuickProductImportForm />
    </>
  );
}

import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { QuickProductImportForm } from "@/components/QuickProductImportForm";
import { isAdminModeEnabled } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Ajout rapide produits",
};

export const dynamic = "force-dynamic";

function lockedAdminState() {
  return (
    <PageHeader
      eyebrow="Admin"
      title="Ajout rapide indisponible"
      description="Activez ADMIN_MODE=true dans l'environnement local pour ouvrir cet atelier."
    />
  );
}

export default function QuickAddProductPage() {
  if (!isAdminModeEnabled()) {
    return lockedAdminState();
  }

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

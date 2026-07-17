import type { Metadata } from "next";
import { CategoryGrid } from "@/components/CategoryGrid";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Catégories",
  description: "Toutes les catégories préparées pour Maxi Trouvaille.",
};

export default function CategoriesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Catégories"
        title="Des rayons prêts pour tous les arrivages"
        description="Produits partenaires, promotions, nouveautés, maison, high-tech, accessoires et bonnes affaires."
      />
      <section className="container-page py-10">
        <CategoryGrid />
      </section>
    </>
  );
}

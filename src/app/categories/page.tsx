import type { Metadata } from "next";
import { CategoryGrid } from "@/components/CategoryGrid";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Categories",
  description: "Toutes les categories preparees pour Maxi Trouvaille.",
};

export default function CategoriesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Categories"
        title="Des rayons prets pour tous les arrivages"
        description="Vetements, maison, deco, high-tech, accessoires, jouets, bricolage, electricite, gadgets et colis surprise."
      />
      <section className="container-page py-10">
        <CategoryGrid />
      </section>
    </>
  );
}

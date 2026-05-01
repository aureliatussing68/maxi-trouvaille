import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { ProductCard } from "@/components/ProductCard";
import { isAdminModeEnabled } from "@/lib/admin";
import { getAllProducts } from "@/lib/catalog-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Boutique",
  description: "Catalogue Maxi Trouvaille pret a recevoir les vrais produits.",
};

export default async function ShopPage() {
  const allProducts = await getAllProducts();
  const adminMode = isAdminModeEnabled();

  return (
    <>
      <PageHeader
        eyebrow="Boutique"
        title="Toutes les trouvailles"
        description="Le catalogue est pret pour les arrivages. Pour l'instant, un produit fictif sert a tester l'affichage, le panier et le paiement Stripe test."
      />
      <section className="container-page py-10">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {allProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              showAdminControls={adminMode}
            />
          ))}
        </div>
      </section>
    </>
  );
}

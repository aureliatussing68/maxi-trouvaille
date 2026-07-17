import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ProductImageManager } from "@/components/ProductImageManager";
import { isAdminModeEnabled } from "@/lib/admin";
import { getCategoryById } from "@/lib/catalog";
import { readQuickProducts } from "@/lib/catalog-server";
import { defaultProductImage } from "@/lib/quick-products";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ajout images produits",
};

function lockedAdminState() {
  return (
    <PageHeader
      eyebrow="Admin"
      title="Ajout images indisponible"
      description="Activez ADMIN_MODE=true dans l'environnement local pour ouvrir cet atelier."
    />
  );
}

export default async function ProductImagesPage() {
  if (!isAdminModeEnabled()) {
    return lockedAdminState();
  }

  const products = (await readQuickProducts()).slice(0, 14).map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price,
    categoryName: getCategoryById(product.categoryId)?.name ?? "Categorie",
    image: product.image || defaultProductImage,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Ajout images produits"
        description="Ajoutez rapidement les photos des 14 derniers produits crees. Chaque image est sauvegardee directement sur le bon produit."
      />
      <section className="container-page pt-8">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/pilotage"
            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
          >
            Retour pilotage
          </Link>
          <Link
            href="/admin/photos-produits"
            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
          >
            Atelier photos sprint
          </Link>
        </div>
      </section>
      <ProductImageManager products={products} />
    </>
  );
}

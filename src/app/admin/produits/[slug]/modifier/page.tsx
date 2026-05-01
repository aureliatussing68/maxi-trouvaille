import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductEditForm } from "@/components/ProductEditForm";
import { isAdminModeEnabled } from "@/lib/admin";
import { getCatalogProductBySlug, readQuickProducts } from "@/lib/catalog-server";

export const dynamic = "force-dynamic";

type EditProductPageProps = {
  params: Promise<{ slug: string }>;
};

export const metadata = {
  title: "Modifier un produit",
};

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { slug } = await params;
  const adminMode = isAdminModeEnabled();

  if (!adminMode) {
    return (
      <section className="container-page py-12">
        <div className="max-w-2xl rounded-lg border border-line bg-paper p-6 shadow-sm">
          <p className="text-sm font-black uppercase text-rose">Admin desactive</p>
          <h1 className="mt-3 text-3xl font-black">Modification indisponible</h1>
          <p className="mt-4 text-muted">
            Activez `ADMIN_MODE=true` dans `.env.local`, puis redemarrez le serveur
            local pour afficher les outils admin.
          </p>
        </div>
      </section>
    );
  }

  const quickProduct = (await readQuickProducts()).find(
    (product) => product.slug === slug,
  );

  if (quickProduct) {
    return <ProductEditForm product={quickProduct} />;
  }

  const product = await getCatalogProductBySlug(slug);
  if (!product) {
    notFound();
  }

  return (
    <section className="container-page py-12">
      <div className="max-w-2xl rounded-lg border border-line bg-paper p-6 shadow-sm">
        <p className="text-sm font-black uppercase text-teal">
          Produit catalogue modele
        </p>
        <h1 className="mt-3 text-3xl font-black">
          Ce produit n&apos;est pas modifiable ici
        </h1>
        <p className="mt-4 leading-7 text-muted">
          L&apos;edition admin simple modifie uniquement les produits ajoutes dans
          `quick-products.json`. Les produits du catalogue code seront geres dans une
          interface admin plus complete plus tard.
        </p>
        <Link
          href={`/produit/${product.slug}`}
          className="focus-ring mt-6 inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-teal"
        >
          Revenir a la fiche produit
        </Link>
      </div>
    </section>
  );
}

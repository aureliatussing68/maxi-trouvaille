import Link from "next/link";
import type { Metadata } from "next";
import { ProductReviewForm } from "@/components/ProductReviewForm";
import type { Product } from "@/lib/catalog";
import { getCatalogProductById } from "@/lib/catalog-server";
import {
  getReviewedProductIdsForToken,
  getReviewTokenDetails,
} from "@/lib/product-reviews";

export const dynamic = "force-dynamic";

type LeaveReviewPageProps = {
  searchParams?: Promise<{ token?: string | string[] }>;
};

export const metadata: Metadata = {
  title: "Laisser un avis",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LeaveReviewPage({
  searchParams,
}: LeaveReviewPageProps) {
  const query = searchParams ? await searchParams : {};
  const token = typeof query.token === "string" ? query.token : "";
  const tokenDetails = token ? await getReviewTokenDetails(token) : null;

  if (!tokenDetails) {
    return (
      <section className="container-page py-12">
        <div className="max-w-2xl rounded-lg border border-line bg-paper p-6 shadow-sm">
          <p className="text-sm font-bold uppercase text-rose">Lien invalide</p>
          <h1 className="mt-3 text-3xl font-black">Avis indisponible</h1>
          <p className="mt-4 text-sm leading-6 text-muted">
            Ce lien d&apos;avis est invalide ou expire. Le service client Maxi
            Trouvaille peut aider a retrouver la commande concernée.
          </p>
          <Link
            href="/contact"
            className="focus-ring mt-6 inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-sm font-bold text-white hover:bg-teal"
          >
            Contacter le service client
          </Link>
        </div>
      </section>
    );
  }

  // Seuls l'identifiant et le nom traversent vers le formulaire (client) : la
  // fiche complete — prix d'achat, marge, lien et reference fournisseur — reste
  // cote serveur.
  const products = (
    await Promise.all(
      tokenDetails.productIds.map((productId) => getCatalogProductById(productId)),
    )
  )
    .filter((product): product is Product => Boolean(product))
    .map((product) => ({ id: product.id, name: product.name }));
  const reviewedProductIds = await getReviewedProductIdsForToken(token);

  return (
    <section className="container-page py-10">
      <div className="max-w-2xl">
        <ProductReviewForm
          token={token}
          products={products}
          reviewedProductIds={reviewedProductIds}
        />
      </div>
    </section>
  );
}

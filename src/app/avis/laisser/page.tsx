import Link from "next/link";
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

export const metadata = {
  title: "Laisser un avis",
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
          <p className="text-sm font-black uppercase text-rose">Lien invalide</p>
          <h1 className="mt-3 text-3xl font-black">Avis indisponible</h1>
          <p className="mt-4 text-sm leading-6 text-muted">
            Ce lien d&apos;avis est invalide, expire ou la base de donnees avis
            n&apos;est pas encore configuree.
          </p>
          <Link
            href="/boutique"
            className="focus-ring mt-6 inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-teal"
          >
            Retour boutique
          </Link>
        </div>
      </section>
    );
  }

  const products = (
    await Promise.all(
      tokenDetails.productIds.map((productId) => getCatalogProductById(productId)),
    )
  ).filter((product): product is Product => Boolean(product));
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

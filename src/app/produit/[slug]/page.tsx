import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Boxes,
  CheckCircle2,
  Pencil,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductEngagement } from "@/components/ProductEngagement";
import { isAdminModeEnabled } from "@/lib/admin";
import {
  getCategoryById,
  products,
} from "@/lib/catalog";
import { getCatalogProductBySlug } from "@/lib/catalog-server";
import { formatPrice } from "@/lib/format";
import { getProductStats } from "@/lib/product-stats";

export const dynamic = "force-dynamic";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ adminMessage?: string | string[] }>;
};

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCatalogProductBySlug(slug);

  return {
    title: product ? product.name : "Produit",
    description: product?.shortDescription,
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: ProductPageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const product = await getCatalogProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const category = getCategoryById(product.categoryId);
  const galleryImages = product.images?.length ? product.images : [product.image];
  const adminMode = isAdminModeEnabled();
  const showUpdatedMessage = query.adminMessage === "updated";
  const stats = await getProductStats(product.id);

  return (
    <section className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_440px]">
      <div className="grid h-fit gap-3">
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-[#ede7db] shadow-sm">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 640px, 100vw"
            className="object-cover"
            priority
          />
        </div>
        {galleryImages.length > 1 ? (
          <div className="grid grid-cols-5 gap-3">
            {galleryImages.slice(1).map((image, index) => (
              <div
                key={image}
                className="relative aspect-square overflow-hidden rounded-md border border-line bg-[#ede7db]"
              >
                <Image
                  src={image}
                  alt={`${product.name} photo ${index + 2}`}
                  fill
                  sizes="120px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="h-fit rounded-lg border border-line bg-paper p-6 shadow-sm">
        {showUpdatedMessage ? (
          <div className="mb-5 rounded-md border border-teal/20 bg-[#eef8f6] p-3 text-sm font-black text-teal">
            Produit modifié avec succès
          </div>
        ) : null}
        <Link
          href={category ? `/categories/${category.slug}` : "/categories"}
          className="text-sm font-black uppercase text-teal hover:text-foreground"
        >
          {category?.name ?? "Categorie"}
        </Link>
        <h1 className="mt-3 text-3xl font-black leading-[1.08]">{product.name}</h1>
        {adminMode ? (
          <Link
            href={`/admin/produits/${product.slug}/modifier`}
            className="focus-ring mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
          >
            <Pencil size={15} aria-hidden="true" />
            Modifier
          </Link>
        ) : null}
        <p className="mt-4 text-sm leading-6 text-muted">{product.description}</p>

        <ProductEngagement productId={product.id} initialStats={stats} />

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <div className="text-4xl font-black">{formatPrice(product.price)}</div>
          {product.compareAtPrice ? (
            <div className="pb-1 text-base font-semibold text-muted line-through">
              {formatPrice(product.compareAtPrice)}
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted">
            <Store size={18} aria-hidden="true" />
            {product.source === "internal"
              ? "Vendu par Maxi Trouvaille"
              : "Annonce vendeur externe"}
          </div>
          <div className="flex items-center gap-2 text-muted">
            <ShieldCheck size={18} aria-hidden="true" />
            {product.condition}
          </div>
          <div className="flex items-center gap-2 text-muted">
            <Truck size={18} aria-hidden="true" />
            Livraison test estimee au panier
          </div>
          <div className={product.stock > 0 ? "flex items-center gap-2 text-muted" : "flex items-center gap-2 font-black text-rose"}>
            <Boxes size={18} aria-hidden="true" />
            {product.stock > 0
              ? `Quantite disponible : ${product.stock}`
              : "Rupture de stock"}
          </div>
        </div>

        <AddToCartButton
          productId={product.id}
          className="mt-7 w-full"
          label="Ajouter au panier"
          disabled={product.stock <= 0}
        />

        <div className="mt-7 border-t border-line pt-6">
          <h2 className="text-lg font-black">Points cles</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-muted">
            {product.features.map((feature) => (
              <li key={feature} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 shrink-0 text-teal" size={18} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

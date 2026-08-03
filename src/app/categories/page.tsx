import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeEuro, Headphones, ShieldCheck, Truck } from "lucide-react";
import { CategoryGrid } from "@/components/CategoryGrid";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";
import { PageHeader } from "@/components/PageHeader";
import {
  countProductsByCategory,
  homeShowcaseCategoryIds,
} from "@/lib/catalog";
import { getPublicProducts } from "@/lib/catalog-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nos rayons",
  description:
    "Maison, cuisine, beauté, high-tech, accessoires, auto-moto, animaux, enfant, mode : tous les rayons Maxi Trouvaille.",
};

export default async function CategoriesPage() {
  const publicProducts = await getPublicProducts();
  const productCountByCategoryId = countProductsByCategory(
    publicProducts,
    homeShowcaseCategoryIds,
  );

  return (
    <>
      <PageHeader
        eyebrow="Nos rayons"
        title="Trouvez votre bonheur par univers"
        description="Maison, cuisine, beauté, high-tech, accessoires, outillage, auto-moto, animaux, enfant, mode, gaming : chaque rayon regroupe des produits malins à petits prix."
      />
      <section className="container-page py-10">
        <div className="mb-8 grid gap-3 rounded-lg border border-line bg-paper p-4 shadow-sm md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-black uppercase text-teal">
              <ShieldCheck size={16} aria-hidden="true" />
              Achat en confiance
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Des rayons clairs, un paiement sécurisé.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Parcourez les rayons, ajoutez au panier et payez par carte en
              toute sécurité. Chaque commande est suivie jusqu&apos;à la
              livraison.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
            <Link
              href="/boutique"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
            >
              Voir la boutique
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link
              href="/contact"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-black hover:bg-[#f1eadf]"
            >
              <Headphones size={17} aria-hidden="true" />
              Service client
            </Link>
          </div>
        </div>
        {/* Cette page, intitulee "Nos rayons", n'affichait qu'UNE seule tuile :
            "Produits partenaires", avec la photo de poignee de main. Elle
            montre desormais les memes rayons que l'accueil et le bas de la
            boutique, avec le nombre reel de produits de chacun. */}
        <CategoryGrid
          compact
          featuredOnly
          productCountByCategoryId={productCountByCategoryId}
          trailingTile={{
            href: "/boutique",
            label: "Toute la boutique",
            hint: `${publicProducts.length} produits`,
          }}
        />
        <CustomerSupportQuickLinks className="mt-8" />
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-line bg-paper p-4 shadow-sm">
            <BadgeEuro className="text-teal" size={22} aria-hidden="true" />
            <h2 className="mt-3 text-base font-black">Prix clairs</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Prix tout compris et frais de livraison affichés avant le
              paiement.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-paper p-4 shadow-sm">
            <Truck className="text-teal" size={22} aria-hidden="true" />
            <h2 className="mt-3 text-base font-black">Livraison suivie</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Numéro de suivi et réception estimée 7 à 14 jours ouvrés.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-paper p-4 shadow-sm">
            <ShieldCheck className="text-teal" size={22} aria-hidden="true" />
            <h2 className="mt-3 text-base font-black">Photos fidèles</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Les photos des fiches produit correspondent à l&apos;article
              expédié.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

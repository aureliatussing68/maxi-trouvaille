import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Boxes, Search, ShieldCheck, Store } from "lucide-react";
import { CategoryGrid } from "@/components/CategoryGrid";
import { ProductCard } from "@/components/ProductCard";
import { TrustBar } from "@/components/TrustBar";
import { getFeaturedProducts } from "@/lib/catalog";

export default function Home() {
  const featuredProducts = getFeaturedProducts();

  return (
    <>
      <section className="relative min-h-[70vh] overflow-hidden bg-[#171717] text-white">
        <Image
          src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1600&q=80"
          alt="Colis et cartons prets pour une boutique de trouvailles"
          fill
          sizes="100vw"
          className="object-cover opacity-60"
          priority
        />
        <div className="absolute inset-0 bg-black/48" />
        <div className="container-page relative flex min-h-[70vh] items-center py-16">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-md bg-white/12 px-3 py-2 text-sm font-black backdrop-blur">
              <Boxes size={18} aria-hidden="true" />
              Arrivages, lots et bonnes affaires
            </div>
            <h1 className="text-balance text-5xl font-black leading-[0.98] sm:text-7xl">
              Maxi Trouvaille
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/86">
              Une boutique claire et rassurante pour vendre colis perdus,
              trouvailles neuves ou quasi neuves, lots utiles et futurs produits
              selectionnes.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/boutique"
                className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand px-5 py-3 text-sm font-black text-foreground hover:bg-[#ffd166]"
              >
                Voir la boutique
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                href="/categories"
                className="focus-ring inline-flex min-h-12 items-center justify-center rounded-md border border-white/40 px-5 py-3 text-sm font-black text-white hover:bg-white/10"
              >
                Explorer les categories
              </Link>
            </div>
          </div>
        </div>
      </section>

      <TrustBar />

      <section className="container-page py-12">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase text-teal">Rayons prets</p>
            <h2 className="mt-2 text-3xl font-black">Categories Maxi Trouvaille</h2>
          </div>
          <Link href="/categories" className="text-sm font-black text-teal hover:text-foreground">
            Toutes les categories
          </Link>
        </div>
        <CategoryGrid compact />
      </section>

      <section className="border-y border-line bg-paper">
        <div className="container-page py-12">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-black uppercase text-teal">Produit test</p>
              <h2 className="mt-2 text-3xl font-black">Fiche modele prete</h2>
            </div>
            <Link href="/boutique" className="text-sm font-black text-teal hover:text-foreground">
              Aller a la boutique
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-12">
        <div className="overflow-hidden rounded-lg border border-line bg-[#102f2b] text-white shadow-sm">
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-black">
                <Store size={18} aria-hidden="true" />
                Bientot marketplace
              </div>
              <h2 className="text-3xl font-black leading-[1.08]">
                Bientot : vendez aussi vos trouvailles sur Maxi Trouvaille
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/76">
                L&apos;architecture prevoit deja les roles admin, vendeur et client,
                la moderation des annonces et la separation entre produits Maxi
                Trouvaille et futures annonces de vendeurs.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
              <Link
                href="/vendre"
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-5 py-2.5 text-sm font-black text-foreground hover:bg-[#ffd166]"
              >
                Vendre sur Maxi Trouvaille
              </Link>
              <Link
                href="/deposer-annonce"
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md border border-white/35 px-5 py-2.5 text-sm font-black text-white hover:bg-white/10"
              >
                Deposer une annonce
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page pb-12">
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-lg border border-line bg-paper p-5 shadow-sm">
            <Search className="mb-4 text-teal" size={28} aria-hidden="true" />
            <h2 className="text-xl font-black">Catalogue simple</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Les produits et categories sont centralises pour ajouter de vrais
              articles progressivement.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-paper p-5 shadow-sm">
            <ShieldCheck className="mb-4 text-teal" size={28} aria-hidden="true" />
            <h2 className="text-xl font-black">Paiement securise</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Stripe Checkout est prepare en mode test avec blocage des cles
              reelles dans l&apos;API.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-paper p-5 shadow-sm">
            <Boxes className="mb-4 text-teal" size={28} aria-hidden="true" />
            <h2 className="text-xl font-black">Pret pour les arrivages</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Vetements, maison, deco, high-tech, accessoires, jouets, bricolage
              et electricite sont deja structures.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

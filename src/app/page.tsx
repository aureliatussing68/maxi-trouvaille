import Link from "next/link";
import { ArrowRight, Boxes, ShieldCheck, Truck } from "lucide-react";
import { HeroCarousel } from "@/components/HeroCarousel";

const quickSignals = [
  {
    icon: Boxes,
    title: "Palettes & lots",
    text: "Déstockage pour particuliers et revendeurs.",
  },
  {
    icon: ShieldCheck,
    title: "Achat clair",
    text: "Produits possibles : neufs, quasi neufs ou occasion.",
  },
  {
    icon: Truck,
    title: "Expédition prévue",
    text: "Livraison ou retrait selon le format du lot.",
  },
];

export default function Home() {
  return (
    <>
      <section className="relative min-h-[calc(100svh-4rem)] overflow-hidden bg-[#171717] text-white">
        <HeroCarousel />
        <div className="container-page relative flex min-h-[calc(100svh-4rem)] items-center py-14">
          <div className="max-w-2xl">
            <h1 className="text-balance text-5xl font-black leading-[0.98] sm:text-7xl">
              Maxi Trouvaille
            </h1>
            <p className="mt-5 max-w-xl text-xl font-black leading-8 text-white/92 sm:text-2xl">
              Palettes, colis mystères et lots de déstockage à prix attractifs.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/boutique"
                className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand px-5 py-3 text-sm font-black text-foreground hover:bg-[#ffd166]"
              >
                Visiter la boutique
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                href="/categories"
                className="focus-ring inline-flex min-h-12 items-center justify-center rounded-md border border-white/45 px-5 py-3 text-sm font-black text-white hover:bg-white/10"
              >
                Voir les catégories
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-paper">
        <div className="container-page grid gap-3 py-5 md:grid-cols-3">
          {quickSignals.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="flex gap-3 rounded-lg border border-line p-4"
              >
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-black">{item.title}</h2>
                  <p className="mt-1 text-sm leading-5 text-muted">
                    {item.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

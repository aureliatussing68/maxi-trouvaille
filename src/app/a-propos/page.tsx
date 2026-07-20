import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Headphones,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "À propos",
  description:
    "Découvrez Maxi Trouvaille : une boutique en ligne française de trouvailles utiles à petits prix, avec paiement sécurisé, livraison suivie et service client réactif.",
};

type Commitment = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const commitments: Commitment[] = [
  {
    icon: PackageSearch,
    title: "Une sélection choisie à la main",
    text: "Nous passons du temps à dénicher des produits utiles, malins ou astucieux, et chaque fiche est relue et vérifiée avant d'être mise en vente.",
  },
  {
    icon: ShieldCheck,
    title: "Un paiement vraiment sécurisé",
    text: "Le règlement se fait par carte bancaire via Stripe. Vos données bancaires ne passent jamais par nos serveurs et aucun compte n'est requis.",
  },
  {
    icon: Truck,
    title: "Une livraison suivie",
    text: "Chaque commande part avec un numéro de suivi. Le délai estimé est affiché sur la fiche produit avant l'achat, sans surprise.",
  },
  {
    icon: Headphones,
    title: "Un seul interlocuteur",
    text: "Question, retour, suivi : le service client Maxi Trouvaille gère tout, du panier à la réception du colis.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="À propos"
        title="La chasse aux trouvailles, c'est notre métier."
        description="Maxi Trouvaille est une boutique en ligne française dédiée aux bonnes affaires : des produits utiles et malins, à petits prix, sélectionnés avec soin."
      />

      <section className="container-page grid gap-8 py-10">
        <div className="rounded-lg border border-line bg-paper p-6 shadow-sm sm:p-8">
          <p className="text-sm font-black uppercase text-teal">
            Notre histoire
          </p>
          <h2 className="mt-2 max-w-2xl text-2xl font-black leading-tight">
            Des bonnes affaires, sans prise de tête.
          </h2>
          <div className="mt-4 grid max-w-3xl gap-4 text-sm leading-7 text-muted">
            <p>
              Maxi Trouvaille est née d&apos;une idée simple : tout le monde
              aime faire une bonne affaire, mais personne n&apos;a envie de
              passer des heures à trier des centaines de produits douteux pour
              en trouver un bon. Alors nous le faisons pour vous.
            </p>
            <p>
              Maison, cuisine, high-tech, auto, animaux, enfant, mode... nous
              parcourons les catalogues, comparons, sélectionnons, puis nous
              rédigeons des fiches claires avec le vrai prix, le vrai délai de
              livraison et de vraies photos. Ce qui ne nous convainc pas ne
              rentre pas en boutique.
            </p>
            <p>
              Le résultat : une boutique à taille humaine, des rayons faciles à
              parcourir et des produits qu&apos;on est content de recevoir — ou
              d&apos;offrir.
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm font-black uppercase text-teal">
            Nos engagements
          </p>
          <h2 className="mt-2 text-2xl font-black">
            Ce que vous garantit chaque commande
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {commitments.map((item) => {
              const Icon = item.icon;

              return (
                <article
                  key={item.title}
                  className="rounded-lg border border-line bg-paper p-5 shadow-sm"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-black">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {item.text}
                  </p>
                </article>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col items-start gap-4 rounded-lg border border-line bg-[#faf7f0] p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-black uppercase text-teal">
              <Sparkles size={16} aria-hidden="true" />
              Nouveautés chaque semaine
            </p>
            <h2 className="mt-2 text-xl font-black">
              Envie de voir nos trouvailles du moment ?
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              Le catalogue évolue en permanence : nouveaux produits, promotions
              et retours en stock. Il y a toujours quelque chose à découvrir.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
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
              <BadgeCheck size={17} aria-hidden="true" />
              Nous contacter
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

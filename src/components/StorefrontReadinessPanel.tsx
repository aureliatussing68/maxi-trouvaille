import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CreditCard,
  PackageSearch,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";

type StorefrontReadinessPanelProps = {
  publicProductCount: number;
  partnerCandidateCount: number;
  categoryCount: number;
  className?: string;
};

function countLabel(count: number, singular: string, plural: string) {
  return count > 0 ? `${count} ${count > 1 ? plural : singular}` : "En cours";
}

export function StorefrontReadinessPanel({
  publicProductCount,
  partnerCandidateCount,
  categoryCount,
  className,
}: StorefrontReadinessPanelProps) {
  const statusCards = [
    {
      icon: Store,
      value: countLabel(categoryCount, "rayon", "rayons"),
      title: "Rayons partenaires",
      text: "Maison, high-tech, auto-moto, animaux, accessoires et promotions structurés pour les produits partenaires.",
    },
    {
      icon: PackageSearch,
      value: countLabel(partnerCandidateCount, "fiche", "fiches"),
      title: "Fiches contrôlées",
      text: "Les fiches restent en validation tant que photo exacte, prix, stock, délai et droits image ne sont pas prêts.",
    },
    {
      icon: CreditCard,
      value: publicProductCount > 0 ? "Paiement actif" : "Lancement maîtrisé",
      title: "Paiement Maxi Trouvaille",
      text: "Le tunnel d'achat reste réservé aux produits publiés avec validation humaine.",
    },
    {
      icon: Truck,
      value: "Suivi centralisé",
      title: "Service client",
      text: "Le client voit Maxi Trouvaille, le paiement Maxi Trouvaille et le suivi colis Maxi Trouvaille.",
    },
  ];

  return (
    <div className={["grid gap-6", className].filter(Boolean).join(" ")}>
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div>
          <p className="flex items-center gap-2 text-sm font-black uppercase text-teal">
            <BadgeCheck size={16} aria-hidden="true" />
            Lancement maîtrisé
          </p>
          <h2 className="mt-2 max-w-3xl text-2xl font-black leading-tight sm:text-3xl">
            Une vitrine propre, avec fiches publiées après validation.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base">
            Maxi Trouvaille affiche les rayons et le parcours client, puis
            publie les produits uniquement quand les preuves sont complètes.
            C&apos;est clair et rassurant pour les clients.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
          <Link
            href="/produits-partenaires"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
          >
            Voir les rayons
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link
            href="/suivi-colis"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-black hover:bg-[#f1eadf]"
          >
            Suivi colis
            <Truck size={17} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statusCards.map((card) => {
          const Icon = card.icon;

          return (
            <article
              key={card.title}
              className="rounded-lg border border-line bg-paper p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-teal">{card.value}</p>
                  <h3 className="mt-1 text-base font-black">{card.title}</h3>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                  <Icon size={19} aria-hidden="true" />
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">{card.text}</p>
            </article>
          );
        })}
      </div>

      {publicProductCount === 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-[#fed7aa] bg-[#fff7ed] p-4 text-sm leading-6 text-[#9a3412]">
          <ShieldCheck className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
          <p>
            La sélection visible reste limitée tant que les preuves ne sont pas
            complètes. Les rayons et le parcours client restent consultables
            avec une présentation claire pour les visiteurs.
          </p>
        </div>
      ) : null}
    </div>
  );
}

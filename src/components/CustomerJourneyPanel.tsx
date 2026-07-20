import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CreditCard,
  Headphones,
  PackageCheck,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";

type JourneyStep = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const journeySteps: JourneyStep[] = [
  {
    icon: ShieldCheck,
    title: "1. Je choisis",
    text: "Je parcours les rayons et j'ajoute mes trouvailles au panier, sans créer de compte.",
  },
  {
    icon: CreditCard,
    title: "2. Je paie en sécurité",
    text: "Règlement par carte via un tunnel sécurisé : aucune donnée bancaire stockée sur le site.",
  },
  {
    icon: PackageCheck,
    title: "3. Ma commande part",
    text: "La commande est préparée puis expédiée avec un numéro de suivi.",
  },
  {
    icon: Truck,
    title: "4. Je suis mon colis",
    text: "Je suis la livraison depuis le site, avec le service client Maxi Trouvaille en cas de question.",
  },
];

export function CustomerJourneyPanel({ className }: { className?: string }) {
  return (
    <section className={["grid gap-5", className].filter(Boolean).join(" ")}>
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="flex items-center gap-2 text-sm font-black uppercase text-teal">
            <BadgeCheck size={16} aria-hidden="true" />
            Parcours client
          </p>
          <h2 className="mt-2 max-w-3xl text-2xl font-black leading-tight sm:text-3xl">
            Commander en 4 étapes simples.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base">
            Du choix du produit à la réception du colis, tout se passe sur
            Maxi Trouvaille.
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
            Service client
            <Headphones size={17} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {journeySteps.map((step) => {
          const Icon = step.icon;

          return (
            <article
              key={step.title}
              className="rounded-lg border border-line bg-paper p-4 shadow-sm"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                <Icon size={19} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-black">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{step.text}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Headphones,
  LockKeyhole,
  PackageCheck,
  ShieldCheck,
  Store,
  type LucideIcon,
} from "lucide-react";

type GateItem = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const gateItems: GateItem[] = [
  {
    icon: LockKeyhole,
    title: "Formulaire fermé",
    text: "Aucune proposition externe n'est acceptée tant que le cadre n'est pas validé.",
  },
  {
    icon: PackageCheck,
    title: "Boutique prioritaire",
    text: "Le travail reste concentré sur les produits partenaires déjà préparés.",
  },
  {
    icon: ClipboardCheck,
    title: "Contrôle avant mise en ligne",
    text: "Titre, prix, stock, délai, visuels et droits image passent en revue humaine.",
  },
  {
    icon: ShieldCheck,
    title: "Vente protégée",
    text: "Une fiche incomplète reste en attente et ne part pas au paiement.",
  },
];

export function PartnerProgramGatePanel({ className }: { className?: string }) {
  return (
    <section className={["grid gap-5", className].filter(Boolean).join(" ")}>
      <div className="grid gap-5 rounded-lg border border-line bg-[#faf7f0] p-5 shadow-sm lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-md bg-[#eef8f6] px-3 py-2 text-sm font-black uppercase text-teal">
            <LockKeyhole size={16} aria-hidden="true" />
            Accès encadré
          </p>
          <h2 className="mt-4 max-w-3xl text-2xl font-black leading-tight sm:text-3xl">
            Le programme partenaires reste fermé pendant la préparation.
          </h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-muted">
            Maxi Trouvaille garde la boutique, le paiement, le suivi colis et le
            service client sous contrôle. Les nouveaux partenaires seront ajoutés
            seulement quand le parcours sera prêt.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[360px] lg:grid-cols-1">
          <Link
            href="/produits-partenaires"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
          >
            <Store size={17} aria-hidden="true" />
            Produits partenaires
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <Link
            href="/conditions-produits-partenaires"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-black hover:bg-[#f1eadf]"
          >
            <ClipboardCheck size={17} aria-hidden="true" />
            Conditions
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {gateItems.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.title}
              className="rounded-lg border border-line bg-paper p-4 shadow-sm"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                <Icon size={19} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-black">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CreditCard,
  Headphones,
  PackageCheck,
  ShieldCheck,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";

type PresentationStep = {
  icon: LucideIcon;
  title: string;
  text: string;
  href: string;
  label: string;
};

function countLabel(count: number, singular: string, plural: string) {
  if (count <= 0) {
    return "En validation";
  }

  return `${count} ${count > 1 ? plural : singular}`;
}

export function MobilePresentationPathPanel({
  categoryCount,
  candidateCount,
  publicProductCount,
  className,
}: {
  categoryCount: number;
  candidateCount: number;
  publicProductCount: number;
  className?: string;
}) {
  const steps: PresentationStep[] = [
    {
      icon: Store,
      title: "1. Ouvrir les rayons",
      text: "Le visiteur comprend tout de suite les univers disponibles et les idées en préparation.",
      href: "/produits-partenaires",
      label: "Rayons",
    },
    {
      icon: PackageCheck,
      title: "2. Lire la sélection",
      text: "Les articles sont présentés comme une sélection contrôlée, avec publication seulement après vérification.",
      href: "/boutique",
      label: "Boutique",
    },
    {
      icon: CreditCard,
      title: "3. Rassurer sur l'achat",
      text: "Le paiement reste chez Maxi Trouvaille et s'ouvre uniquement aux articles prêts.",
      href: "/paiement",
      label: "Paiement",
    },
    {
      icon: Truck,
      title: "4. Garder le suivi",
      text: "Le suivi colis et le service client restent accessibles depuis le même site.",
      href: "/suivi-colis",
      label: "Suivi",
    },
  ];
  const metrics = [
    {
      icon: Store,
      label: "Rayons prêts à montrer",
      value: countLabel(categoryCount, "rayon", "rayons"),
    },
    {
      icon: BadgeCheck,
      label: "Fiches en contrôle",
      value: countLabel(candidateCount, "fiche", "fiches"),
    },
    {
      icon: ShieldCheck,
      label: "Vente protégée",
      value:
        publicProductCount > 0
          ? countLabel(publicProductCount, "article prêt", "articles prêts")
          : "Validation active",
    },
  ];

  return (
    <section
      className={[
        "grid gap-5 rounded-lg border border-line bg-[#fbfaf7] p-5 shadow-sm sm:p-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold uppercase text-teal">
            <ShieldCheck size={16} aria-hidden="true" />
            Parcours express mobile
          </p>
          <h2 className="mt-2 max-w-3xl text-2xl font-black leading-tight sm:text-3xl">
            En une minute, le visiteur voit une boutique cohérente.
          </h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-muted sm:text-base">
            Les rayons, la sélection, le paiement, le suivi colis et le service
            client restent reliés. Les articles attendent les vérifications
            nécessaires avant la mise en vente.
          </p>
        </div>
        <Link
          href="/contact"
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-bold hover:bg-[#f1eadf]"
        >
          <Headphones size={17} aria-hidden="true" />
          Service client
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <article
              key={metric.label}
              className="rounded-md border border-line bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-teal">
                    {metric.value}
                  </p>
                  <h3 className="mt-1 text-base font-bold">
                    {metric.label}
                  </h3>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                  <Icon size={19} aria-hidden="true" />
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step) => {
          const Icon = step.icon;

          return (
            <Link
              key={step.title}
              href={step.href}
              className="focus-ring group flex min-h-48 flex-col justify-between rounded-md border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#d5c8b7] hover:shadow-md"
            >
              <span>
                <span className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <span className="rounded-md bg-[#f6f1e8] px-2 py-1 text-[11px] font-bold uppercase text-teal">
                    {step.label}
                  </span>
                </span>
                <span className="mt-4 block text-base font-bold group-hover:text-teal">
                  {step.title}
                </span>
                <span className="mt-2 block text-sm leading-6 text-muted">
                  {step.text}
                </span>
              </span>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-teal">
                Ouvrir
                <ArrowRight size={15} aria-hidden="true" />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="rounded-md border border-[#dbeafe] bg-[#eff6ff] p-4 text-sm font-bold leading-6 text-[#1d4ed8]">
        La boutique peut être parcourue sur téléphone sans afficher un article
        comme prêt tant que les preuves importantes ne sont pas terminées.
      </div>
    </section>
  );
}

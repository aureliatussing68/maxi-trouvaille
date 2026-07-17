import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  Car,
  PawPrint,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sofa,
  Sparkles,
  Truck,
  type LucideIcon,
} from "lucide-react";

type PartnerLaunchBoardProps = {
  candidateCount: number;
  publicProductCount: number;
  className?: string;
};

type LaunchLane = {
  icon: LucideIcon;
  title: string;
  focus: string;
  status: string;
  href: string;
};

const launchLanes: LaunchLane[] = [
  {
    icon: Sparkles,
    title: "Nouveautés utiles",
    focus: "Objets simples, faciles à comprendre et prêts à comparer.",
    status: "Tri prioritaire",
    href: "/categories/nouveautes-partenaires",
  },
  {
    icon: BadgePercent,
    title: "Promotions",
    focus: "Offres avec prix cible clair, conditions cadrees et stock encadre.",
    status: "Prix sous contrôle",
    href: "/categories/promotions-partenaires",
  },
  {
    icon: Sofa,
    title: "Maison",
    focus: "Accessoires pratiques pour rangement, cuisine et confort quotidien.",
    status: "Images controlees",
    href: "/categories/maison-partenaires",
  },
  {
    icon: Smartphone,
    title: "High-tech",
    focus: "Petits accessoires lisibles, sans fiche complexe ni promesse floue.",
    status: "Preuves en cours",
    href: "/categories/high-tech-partenaires",
  },
  {
    icon: Car,
    title: "Auto-moto",
    focus: "Produits d’usage clair, variantes limitees et compatibilite cadree.",
    status: "Variantes bloquées",
    href: "/categories/auto-moto-partenaires",
  },
  {
    icon: PawPrint,
    title: "Animaux",
    focus: "Accessoires du quotidien avec photo exacte demandée avant publication.",
    status: "Validation active",
    href: "/categories/animaux-partenaires",
  },
];

function countLabel(count: number, label: string) {
  return count > 0 ? `${count} ${label}` : "En cours";
}

export function PartnerLaunchBoard({
  candidateCount,
  publicProductCount,
  className,
}: PartnerLaunchBoardProps) {
  const visibleStatus =
    publicProductCount > 0
      ? countLabel(publicProductCount, "produits visibles")
      : "Selection en preparation";

  return (
    <section className={["grid gap-6", className].filter(Boolean).join(" ")}>
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="flex items-center gap-2 text-sm font-black uppercase text-teal">
            <ShoppingBag size={16} aria-hidden="true" />
            Rayons prêts à montrer
          </p>
          <h2 className="mt-2 max-w-3xl text-2xl font-black leading-tight sm:text-3xl">
            La boutique montre les univers, puis publie les fiches validées.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base">
            Chaque rayon peut être exploré sur téléphone avec une promesse claire :
            paiement Maxi Trouvaille, suivi colis et validation humaine avant
            publication.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/categories"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
          >
            Explorer les rayons
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {launchLanes.map((lane) => {
          const Icon = lane.icon;

          return (
            <Link
              key={lane.title}
              href={lane.href}
              className="focus-ring group rounded-lg border border-line bg-paper p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#d5c8b7] hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span className="rounded-md bg-[#f6f1e8] px-2 py-1 text-[11px] font-black uppercase text-teal">
                  {lane.status}
                </span>
              </div>
              <h3 className="mt-4 text-base font-black group-hover:text-teal">
                {lane.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">{lane.focus}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3 rounded-lg border border-line bg-white p-4 shadow-sm sm:grid-cols-3">
        <div>
          <p className="text-sm font-black text-teal">
            {countLabel(candidateCount, "fiches candidates")}
          </p>
          <p className="mt-1 text-sm leading-5 text-muted">Catalogue en validation.</p>
        </div>
        <div>
          <p className="text-sm font-black text-teal">{visibleStatus}</p>
          <p className="mt-1 text-sm leading-5 text-muted">Aucune fiche non validée.</p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-teal">
            <ShieldCheck size={16} aria-hidden="true" />
            Validation humaine
          </p>
          <p className="mt-1 text-sm leading-5 text-muted">
            Mise en avant apres preuves completes.
          </p>
        </div>
      </div>
    </section>
  );
}

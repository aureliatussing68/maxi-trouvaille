import Link from "next/link";
import {
  ArrowRight,
  CreditCard,
  Headphones,
  PackageCheck,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";
import type { StorefrontControlMetrics } from "@/lib/storefront-control-metrics";

type ServiceReadinessPanelProps = {
  metrics: StorefrontControlMetrics;
  className?: string;
};

function pluralLabel(count: number, singular: string, plural: string) {
  return `${count} ${count > 1 ? plural : singular}`;
}

export function ServiceReadinessPanel({
  metrics,
  className,
}: ServiceReadinessPanelProps) {
  const visibleProductValue =
    metrics.publicProductCount > 0
      ? pluralLabel(
          metrics.publicProductCount,
          "article disponible",
          "articles disponibles",
        )
      : "Catalogue en préparation";

  const cards = [
    {
      icon: PackageCheck,
      value: visibleProductValue,
      title: "Produits vérifiés",
      text: "Chaque fiche est relue et vérifiée par notre équipe avant d'être mise en vente.",
    },
    {
      icon: ShieldCheck,
      value: "Paiement sécurisé",
      title: "Carte bancaire via Stripe",
      text: "Vos données bancaires ne passent jamais par nos serveurs.",
    },
    {
      icon: Store,
      value: pluralLabel(metrics.partnerCategoryCount, "rayon", "rayons"),
      title: "Rayons clairs",
      text: "Maison, cuisine, high-tech, animaux, enfant... tout est classé par univers.",
    },
    {
      icon: Headphones,
      value: "Un seul interlocuteur",
      title: "Service client",
      text: "Paiement, livraison, suivi et retours : tout se gère directement avec Maxi Trouvaille.",
    },
  ];

  const links = [
    {
      href: "/boutique",
      label: "Boutique",
      icon: Store,
    },
    {
      href: "/paiement",
      label: "Paiement",
      icon: CreditCard,
    },
    {
      href: "/suivi-colis",
      label: "Suivi colis",
      icon: Truck,
    },
  ];

  return (
    <section className={["grid gap-5", className].filter(Boolean).join(" ")}>
      <div className="grid gap-5 rounded-lg border border-line bg-[#faf7f0] p-5 shadow-sm lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-md bg-[#eef8f6] px-3 py-2 text-sm font-black uppercase text-teal">
            <ShieldCheck size={16} aria-hidden="true" />
            Achat en confiance
          </p>
          <h2 className="mt-4 text-2xl font-black leading-tight sm:text-3xl">
            Une boutique simple, un achat sans mauvaise surprise.
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">
            Paiement sécurisé par carte, livraison suivie et service client
            unique : tout se passe sur Maxi Trouvaille, du panier jusqu&apos;à
            la réception de votre colis.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {links.map((link) => {
              const Icon = link.icon;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-black hover:bg-[#f1eadf]"
                >
                  <Icon size={16} aria-hidden="true" />
                  {link.label}
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <article
                key={card.title}
                className="rounded-md border border-line bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
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
      </div>
    </section>
  );
}

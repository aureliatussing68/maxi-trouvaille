import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  Home,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Truck,
  WifiOff,
} from "lucide-react";
import type { Metadata } from "next";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";

export const metadata: Metadata = {
  title: "Hors ligne",
  robots: {
    index: false,
    follow: false,
  },
};

const offlineActions = [
  {
    href: "/boutique",
    label: "Boutique",
    description: "Revoir les rayons dès que la connexion revient.",
    Icon: Home,
  },
  {
    href: "/produits-partenaires",
    label: "Produits partenaires",
    description: "Retrouver les articles contrôlés avant mise en vente.",
    Icon: PackageCheck,
  },
  {
    href: "/suivi-colis",
    label: "Suivi colis",
    description: "Reprendre le suivi avec les informations disponibles.",
    Icon: Truck,
  },
] satisfies Array<{
  href: string;
  label: string;
  description: string;
  Icon: LucideIcon;
}>;

const offlineAssurances = [
  {
    title: "Boutique gardée propre",
    description:
      "Les articles restent contrôlés avant publication pour garder une vitrine claire et fiable.",
    Icon: ShieldCheck,
  },
  {
    title: "Paiement Maxi Trouvaille",
    description:
      "Le paiement reprend seulement quand le réseau revient et uniquement pour les articles prêts.",
    Icon: RefreshCw,
  },
  {
    title: "Suivi centralisé",
    description:
      "Les informations de livraison et de service client restent au même endroit après reconnexion.",
    Icon: PackageCheck,
  },
] satisfies Array<{
  title: string;
  description: string;
  Icon: LucideIcon;
}>;

const offlineDemoSteps = [
  {
    label: "Accueil",
    text: "Revenir sur la promesse Maxi Trouvaille et les pages utiles.",
    href: "/",
  },
  {
    label: "Produits partenaires",
    text: "Montrer les rayons et les articles contrôlés avant mise en vente.",
    href: "/produits-partenaires",
  },
  {
    label: "Service client",
    text: "Rassurer sur le suivi colis, les retours et le contact après reconnexion.",
    href: "/contact",
  },
] satisfies Array<{
  label: string;
  text: string;
  href: string;
}>;

export default function OfflinePage() {
  return (
    <section className="container-page py-12 sm:py-16">
      <div className="grid gap-8 lg:grid-cols-[1fr_0.86fr] lg:items-start">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-teal">
            <WifiOff aria-hidden className="h-4 w-4" />
            Mode hors ligne
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight text-foreground md:text-5xl">
            Maxi Trouvaille reste prêt à redémarrer.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
            La connexion semble indisponible. Les pages déjà consultées peuvent
            rester accessibles, puis la boutique, le paiement Maxi Trouvaille et
            le suivi colis reprennent dès que le réseau revient.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/"
              className="focus-ring inline-flex min-h-12 items-center justify-center rounded-full bg-foreground px-6 text-sm font-bold text-white transition hover:bg-teal"
            >
              Revenir à l&apos;accueil
            </Link>
            <Link
              href="/boutique"
              className="focus-ring inline-flex min-h-12 items-center justify-center rounded-full border border-line bg-white px-6 text-sm font-bold text-foreground transition hover:border-teal hover:text-teal"
            >
              Voir la boutique
            </Link>
          </div>

          <div className="mt-8 border-t border-line pt-6">
            <div className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.14em] text-teal">
              <ClipboardList aria-hidden className="h-4 w-4" />
              Chemin démo mobile
            </div>
            <ol className="mt-4 grid gap-3 sm:grid-cols-3">
              {offlineDemoSteps.map(({ label, text, href }, index) => (
                <li key={label} className="min-w-0">
                  <Link
                    href={href}
                    className="focus-ring group flex h-full gap-3 rounded-lg border border-line bg-paper p-4 transition hover:border-teal"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-teal ring-1 ring-line">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                        {label}
                        <BadgeCheck
                          aria-hidden
                          className="h-4 w-4 text-muted transition group-hover:text-teal"
                        />
                      </span>
                      <span className="mt-2 block text-sm leading-6 text-muted">
                        {text}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <aside className="rounded-lg border border-line bg-paper p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-teal ring-1 ring-line">
              <RefreshCw aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-teal">
                Connexion à reprendre
              </p>
              <h2 className="mt-2 text-xl font-black text-foreground">
                Rien n&apos;est envoyé hors ligne.
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Les actions sensibles attendent une connexion active. La visite
                reste simple, lisible et centrée sur les pages utiles.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {offlineActions.map(({ href, label, description, Icon }) => (
              <Link
                key={href}
                href={href}
                className="focus-ring group grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-line bg-white p-3 transition hover:border-teal"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f4efe7] text-foreground">
                  <Icon aria-hidden className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-foreground">
                    {label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted">
                    {description}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden
                  className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-teal"
                />
              </Link>
            ))}
          </div>
        </aside>
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {offlineAssurances.map(({ title, description, Icon }) => (
          <article
            key={title}
            className="rounded-lg border border-line bg-paper p-5 shadow-sm"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-teal ring-1 ring-line">
              <Icon aria-hidden className="h-4 w-4" />
            </span>
            <h2 className="mt-4 text-base font-bold text-foreground">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
          </article>
        ))}
      </div>

      <CustomerSupportQuickLinks className="mt-10" />
    </section>
  );
}

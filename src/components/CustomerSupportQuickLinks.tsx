import Link from "next/link";
import {
  ArrowRight,
  CircleHelp,
  CreditCard,
  Headphones,
  RotateCcw,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { SERVICE_PROMISE } from "@/lib/copy";

type SupportLink = {
  href: string;
  title: string;
  text: string;
  action: string;
  icon: LucideIcon;
};

const supportLinks: SupportLink[] = [
  {
    href: "/suivi-colis",
    title: "Suivi colis",
    text: "Suivez votre commande de l'expédition jusqu'à la livraison.",
    action: "Ouvrir le suivi",
    icon: Truck,
  },
  {
    href: "/paiement",
    title: "Paiement sécurisé",
    text: "Carte bancaire : simple, rapide et sans création de compte.",
    action: "Voir le paiement",
    icon: CreditCard,
  },
  {
    href: "/livraison",
    title: "Livraison",
    text: "Délais, transporteurs et suivi : tout savoir avant de commander.",
    action: "Voir la livraison",
    icon: Truck,
  },
  {
    href: "/retours-remboursements",
    title: "Retours",
    text: "14 jours pour changer d'avis, avec une procédure simple et claire.",
    action: "Voir les retours",
    icon: RotateCcw,
  },
  {
    href: "/faq",
    title: "FAQ",
    text: "Les réponses aux questions les plus fréquentes sur vos commandes.",
    action: "Lire la FAQ",
    icon: CircleHelp,
  },
  {
    href: "/contact",
    title: "Service client",
    text: SERVICE_PROMISE,
    action: "Contacter",
    icon: Headphones,
  },
];

export function CustomerSupportQuickLinks({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="support-client-maxi"
      className={["grid gap-5", className].filter(Boolean).join(" ")}
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal">
          Besoin d&apos;aide ?
        </p>
        <h2
          id="support-client-maxi"
          className="mt-2 max-w-3xl text-[26px] font-black leading-tight sm:text-3xl"
        >
          Tout ce qu&apos;il faut savoir, au même endroit.
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Paiement, livraison, suivi colis, retours : retrouvez toutes les
          informations utiles et contactez le service client en un clic.
        </p>
      </div>

      {/* Sur telephone : six tuiles compactes sur deux colonnes plutot que six
          grandes cartes empilees. Empilees, elles ajoutaient a elles seules
          plus de 1 000 px de texte gris en bas de page — le client scrollait
          longtemps sans plus rien voir a acheter. La phrase d'explication
          reapparait des qu'il y a la place. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {supportLinks.map((link) => {
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              className="focus-ring group flex h-full flex-col rounded-lg border border-line bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#d5c8b7] hover:shadow-md sm:p-4"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#eef8f6] text-teal sm:h-10 sm:w-10">
                <Icon size={18} aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-[15px] font-bold group-hover:text-teal sm:mt-4 sm:text-base">
                {link.title}
              </h3>
              <p className="mt-1.5 hidden text-sm leading-6 text-muted sm:block">
                {link.text}
              </p>
              <p className="mt-auto pt-2.5 inline-flex items-center gap-1.5 text-[13px] font-bold text-teal sm:text-sm">
                {link.action}
                <ArrowRight
                  size={15}
                  aria-hidden="true"
                  className="transition group-hover:translate-x-0.5"
                />
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

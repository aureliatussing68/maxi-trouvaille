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
    text: "Carte bancaire via Stripe : simple, rapide et sans création de compte.",
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
    text: "Une question ? Notre équipe vous répond rapidement par email.",
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
        <p className="text-sm font-black uppercase text-teal">
          Besoin d&apos;aide ?
        </p>
        <h2
          id="support-client-maxi"
          className="mt-2 max-w-3xl text-2xl font-black leading-tight"
        >
          Tout ce qu&apos;il faut savoir, au même endroit.
        </h2>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-muted">
          Paiement, livraison, suivi colis, retours : retrouvez toutes les
          informations utiles et contactez le service client en un clic.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {supportLinks.map((link) => {
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              className="focus-ring group rounded-lg border border-line bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#d5c8b7] hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                <Icon size={19} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-black">{link.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{link.text}</p>
              <p className="mt-3 inline-flex items-center gap-2 text-sm font-black text-teal">
                {link.action}
                <ArrowRight
                  size={16}
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

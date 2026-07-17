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
    text: "Retrouver les informations de livraison quand le numero est ajoute.",
    action: "Ouvrir le suivi",
    icon: Truck,
  },
  {
    href: "/paiement",
    title: "Paiement Maxi Trouvaille",
    text: "Payer uniquement les articles validés avec un parcours securise.",
    action: "Voir le paiement",
    icon: CreditCard,
  },
  {
    href: "/livraison",
    title: "Livraison",
    text: "Comprendre le delai, le suivi et le partenaire logistique avant achat.",
    action: "Voir la livraison",
    icon: Truck,
  },
  {
    href: "/retours-remboursements",
    title: "Retours",
    text: "Suivre une demande claire avec le service client Maxi Trouvaille.",
    action: "Voir les retours",
    icon: RotateCcw,
  },
  {
    href: "/faq",
    title: "FAQ",
    text: "Lire les reponses sur les produits partenaires, le paiement et le suivi.",
    action: "Lire la FAQ",
    icon: CircleHelp,
  },
  {
    href: "/contact",
    title: "Service client",
    text: "Garder Maxi Trouvaille comme contact principal pour chaque commande.",
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
          Support client Maxi Trouvaille
        </p>
        <h2
          id="support-client-maxi"
          className="mt-2 max-w-3xl text-2xl font-black leading-tight"
        >
          Les raccourcis utiles restent au meme endroit.
        </h2>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-muted">
          Paiement, suivi colis, livraison, retours et service client restent
          centralises par Maxi Trouvaille. Les produits partenaires restent
          presentes proprement sans rendre achetable une fiche non validée.
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

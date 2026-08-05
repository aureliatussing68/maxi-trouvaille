import Link from "next/link";
import { CreditCard, Lock, PackageCheck } from "lucide-react";
import { SERVICE_PROMISE } from "@/lib/copy";

// « Promos » retire le 05/08/2026 : la page est vide tant que l'affichage des
// prix barres est coupe. Voir le commentaire dans Header.tsx.
const shopLinks = [
  { href: "/boutique", label: "Boutique" },
  { href: "/produits-partenaires", label: "Rayons" },
  { href: "/nouveautes", label: "Nouveautés" },
];

const helpLinks = [
  { href: "/paiement", label: "Paiement" },
  { href: "/livraison", label: "Livraison" },
  { href: "/suivi-colis", label: "Suivi colis" },
  { href: "/retours-remboursements", label: "Retours" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

const legalLinks = [
  { href: "/a-propos", label: "À propos" },
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/conditions-generales-vente", label: "Conditions générales" },
  { href: "/retractation", label: "Droit de rétractation" },
  {
    href: "/conditions-produits-partenaires",
    label: "Conditions produits partenaires",
  },
  { href: "/politique-confidentialite", label: "Confidentialité" },
];

/**
 * Moyens de paiement ecrits en toutes lettres plutot qu'en logos : aucune
 * image a telecharger, aucune marque a reproduire, et l'information est la —
 * la page promet "paiement securise" plus haut sans jamais dire par quoi.
 */
const paymentMethods = ["Visa", "Mastercard", "CB", "American Express"];

export function Footer() {
  return (
    <footer className="border-t border-line bg-[#171717] text-white">
      <div className="container-page grid gap-8 py-10 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
        <div>
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand text-foreground">
              <PackageCheck size={21} aria-hidden="true" />
            </span>
            <span className="text-lg font-black tracking-tight">
              Maxi Trouvaille
            </span>
          </div>
          <p className="max-w-md text-sm leading-6 text-white/70">
            Les trouvailles malignes du moment à petits prix : maison, cuisine,
            high-tech, animaux et plus encore. Paiement sécurisé par carte,
            livraison suivie et service client basé en France.
          </p>
        </div>

        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-brand">
            Boutique
          </h2>
          <div className="grid gap-2 text-sm">
            {shopLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-white/72 transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-brand">
            Aide
          </h2>
          <div className="grid gap-2 text-sm">
            {helpLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-white/72 transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-brand">
            Informations
          </h2>
          <div className="grid gap-2 text-sm">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-white/72 transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/70">
            <span className="inline-flex items-center gap-2 font-semibold text-white/85">
              <Lock size={14} aria-hidden="true" />
              Paiement sécurisé
            </span>
            <span className="inline-flex items-center gap-2">
              <CreditCard size={14} aria-hidden="true" />
              {paymentMethods.join(" · ")}
            </span>
          </div>
          <p className="text-xs text-white/70">{SERVICE_PROMISE}</p>
        </div>
      </div>

      <div className="border-t border-white/10 py-4">
        <div className="container-page text-xs text-white/55">
          © {new Date().getFullYear()} Maxi Trouvaille. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}

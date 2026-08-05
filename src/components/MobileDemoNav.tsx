"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Grid2X2, PackageSearch, ShoppingBag, Sparkles } from "lucide-react";

/**
 * Barre du bas, sur telephone.
 *
 * Les destinations sont figees : elles sont alignees sur les raccourcis de
 * l'application installee (manifest PWA) et un audit dedie verifie qu'aucune
 * page transactionnelle (panier, paiement, admin) n'atterrit ici.
 *
 * Ce qui a change, ce sont les MOTS. Trois systemes de navigation coexistaient
 * avec un vocabulaire different : cette barre disait "Partenaires" et
 * "Nouveau" la ou le menu disait "Rayons" et "Nouveautes", pour exactement les
 * memes pages. "Partenaires" etait en plus un mot de coulisses qui ne dit rien
 * a un acheteur. Desormais les memes mots partout.
 */
const mobileLinks = [
  {
    href: "/boutique",
    label: "Boutique",
    icon: ShoppingBag,
    activePaths: ["/boutique", "/catalogue", "/shop", "/produits"],
  },
  {
    href: "/produits-partenaires",
    label: "Rayons",
    icon: Grid2X2,
    activePaths: ["/produits-partenaires", "/partenaires", "/categories"],
  },
  {
    href: "/nouveautes",
    label: "Nouveautés",
    icon: Sparkles,
    activePaths: ["/nouveautes"],
  },
  // « Promos » retire le 05/08/2026 : la page est vide tant que l'affichage
  // des prix barres est coupe. Voir le commentaire dans Header.tsx.
  {
    href: "/suivi-colis",
    label: "Suivi",
    icon: PackageSearch,
    activePaths: ["/suivi-colis", "/suivi"],
  },
] satisfies Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  activePaths: string[];
}>;

function isActivePath(pathname: string, activePaths: string[]) {
  return activePaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function MobileDemoNav() {
  const pathname = usePathname() || "/";

  return (
    <nav
      aria-label="Navigation rapide mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/96 px-2 pb-[calc(0.55rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgb(23_23_23_/_0.1)] backdrop-blur md:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {mobileLinks.map((link) => {
          const Icon = link.icon;
          const isActive = isActivePath(pathname, link.activePaths);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={`focus-ring relative flex min-h-13 flex-col items-center justify-center gap-1 rounded-md px-0.5 py-1.5 text-[10px] font-semibold transition ${
                isActive
                  ? "bg-foreground text-white"
                  : "text-foreground hover:bg-[#f1eadf]"
              }`}
            >
              <Icon
                size={19}
                aria-hidden="true"
                className={isActive ? "text-brand" : undefined}
              />
              <span className="whitespace-nowrap">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

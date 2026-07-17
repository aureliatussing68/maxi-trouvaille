"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BadgePercent,
  Grid2X2,
  PackageSearch,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

const mobileLinks = [
  {
    href: "/boutique",
    label: "Boutique",
    icon: ShoppingBag,
    activePaths: ["/boutique", "/catalogue", "/shop", "/produits", "/categories"],
  },
  {
    href: "/produits-partenaires",
    label: "Partenaires",
    icon: Grid2X2,
    activePaths: ["/produits-partenaires", "/partenaires"],
  },
  {
    href: "/nouveautes",
    label: "Nouveau",
    icon: Sparkles,
    activePaths: ["/nouveautes"],
  },
  {
    href: "/promotions",
    label: "Promos",
    icon: BadgePercent,
    activePaths: ["/promotions"],
  },
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/96 px-3 pb-[calc(0.65rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgb(23_23_23_/_0.12)] backdrop-blur md:hidden"
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
              className={`focus-ring relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-black transition ${
                isActive
                  ? "bg-foreground text-white shadow-sm"
                  : "text-foreground hover:bg-[#f1eadf]"
              }`}
            >
              <Icon
                size={19}
                aria-hidden="true"
                className={isActive ? "text-brand" : undefined}
              />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

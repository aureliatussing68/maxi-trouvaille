"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PackageOpen, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";

const navLinks = [
  { href: "/", label: "Accueil" },
  { href: "/boutique", label: "Boutique" },
  { href: "/categories", label: "Categories" },
  { href: "/vendre", label: "Vendre" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { totalQuantity } = useCart();

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="focus-ring flex min-w-0 items-center gap-2 rounded-md"
          onClick={() => setIsOpen(false)}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-foreground text-brand">
            <PackageOpen size={21} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-black leading-5">
              Maxi Trouvaille
            </span>
            <span className="hidden text-xs font-semibold uppercase text-muted sm:block">
              Bonnes affaires
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
          {navLinks.map((link) => {
            const isActive =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`focus-ring rounded-md px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-brand text-foreground"
                    : "text-muted hover:bg-[#f1eadf] hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/panier"
            className="focus-ring relative inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-bold text-white transition hover:bg-[#2b2b2b]"
          >
            <ShoppingBag size={18} aria-hidden="true" />
            <span className="hidden sm:inline">Panier</span>
            <span className="min-w-5 rounded-full bg-brand px-1.5 py-0.5 text-center text-xs font-black text-foreground">
              {totalQuantity}
            </span>
          </Link>

          <button
            type="button"
            className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-md border border-line bg-paper lg:hidden"
            aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((current) => !current)}
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {isOpen ? (
        <nav
          className="border-t border-line bg-paper px-4 py-3 lg:hidden"
          aria-label="Navigation mobile"
        >
          <div className="container-page grid gap-2 px-0">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="focus-ring rounded-md px-3 py-3 text-sm font-bold text-foreground hover:bg-[#f1eadf]"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PackageOpen, Search, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";

/**
 * Un seul vocabulaire de navigation pour tout le site.
 *
 * Avant, trois systemes coexistaient avec des mots differents : la barre du
 * bas disait "Partenaires" et "Nouveau", le menu disait "Rayons" et
 * "Nouveautes", et deux entrees menaient a peu pres au meme endroit. Le
 * client ne savait pas ou aller. Desormais les memes mots partout, dans le
 * meme ordre, du parcours d'achat vers l'aide.
 */
/**
 * « Promos » a ete retire du menu le 05/08/2026.
 *
 * L'affichage des prix barres est coupe tant qu'aucun historique de prix reel
 * n'existe (voir HISTORIQUE_PRIX_VERIFIE dans product-display.ts), donc la page
 * /promotions ne liste plus aucun produit. La laisser dans le menu envoyait les
 * clients sur une page vide.
 *
 * La page elle-meme n'est PAS supprimee : les liens existants continuent de
 * fonctionner. Le jour ou l'historique de prix existera, il suffira de remettre
 * cette ligne en meme temps que l'interrupteur.
 */
const navLinks = [
  { href: "/", label: "Accueil" },
  { href: "/boutique", label: "Boutique" },
  { href: "/produits-partenaires", label: "Rayons" },
  { href: "/nouveautes", label: "Nouveautés" },
  { href: "/suivi-colis", label: "Suivi" },
  { href: "/contact", label: "Contact" },
];

const mobileSupportLinks = [
  { href: "/livraison", label: "Livraison" },
  { href: "/retours-remboursements", label: "Retours" },
  { href: "/paiement", label: "Paiement" },
  { href: "/faq", label: "FAQ" },
];

export function Header() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { totalQuantity } = useCart();

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-3">
        {/* shrink-0 partout dans le bloc de marque : sans lui, le conteneur
            flex compressait la pastille du logo (rendue 19x40 au lieu de
            40x40, donc un ovale) et forcait "Maxi Trouvaille" sur deux lignes
            puis la baseline sur trois — le bloc montait a 88 px dans une barre
            de 64 et "PETITS PRIX" debordait sur la photo du hero.
            La baseline n'apparait qu'a partir de xl, la ou il y a vraiment la
            place a cote des liens de navigation. */}
        <Link
          href="/"
          className="focus-ring flex shrink-0 items-center gap-2.5 rounded-md"
          onClick={() => setIsOpen(false)}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-foreground text-brand">
            <PackageOpen size={21} aria-hidden="true" />
          </span>
          <span className="flex shrink-0 flex-col justify-center leading-none">
            <span className="whitespace-nowrap text-[17px] font-black leading-none tracking-tight">
              Maxi Trouvaille
            </span>
            <span className="mt-1 hidden whitespace-nowrap text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-muted xl:block">
              La boutique à petits prix
            </span>
          </span>
        </Link>

        <nav
          className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 lg:flex"
          aria-label="Navigation principale"
        >
          {navLinks.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`focus-ring whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-semibold transition xl:px-3 ${
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

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* Champ elargi : l'invite "Rechercher un produit..." etait tronquee
              en plein mot dans 208 px, y compris a 1920 px ou il reste 800 px
              de blanc de chaque cote. */}
          <form
            action="/boutique"
            method="get"
            role="search"
            className="hidden items-center xl:flex"
          >
            <label className="relative flex items-center">
              <span className="sr-only">Rechercher un produit</span>
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 text-muted"
              />
              <input
                type="search"
                name="q"
                placeholder="Rechercher un produit..."
                className="h-10 w-64 rounded-md border border-line bg-white pl-9 pr-3 text-sm font-medium outline-none transition placeholder:text-muted/80 focus:border-teal focus:ring-2 focus:ring-[#bfe7df]"
              />
            </label>
          </form>

          <Link
            href="/panier"
            className="focus-ring relative inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-bold text-white transition hover:bg-[#2b2b2b]"
          >
            <ShoppingBag size={18} aria-hidden="true" />
            <span className="hidden sm:inline">Panier</span>
            <span className="min-w-5 rounded-full bg-brand px-1.5 py-0.5 text-center text-xs font-bold text-foreground">
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
            <form
              action="/boutique"
              method="get"
              role="search"
              onSubmit={() => setIsOpen(false)}
            >
              <label className="relative flex items-center">
                <span className="sr-only">Rechercher un produit</span>
                <Search
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 text-muted"
                />
                <input
                  type="search"
                  name="q"
                  placeholder="Rechercher un produit..."
                  className="h-11 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-teal focus:ring-2 focus:ring-[#bfe7df]"
                />
              </label>
            </form>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="focus-ring rounded-md px-3 py-3 text-[15px] font-semibold text-foreground hover:bg-[#f1eadf]"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="my-1 border-t border-line" aria-hidden="true" />
            {mobileSupportLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="focus-ring rounded-md px-3 py-3 text-[15px] font-medium text-muted hover:bg-[#f1eadf] hover:text-foreground"
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

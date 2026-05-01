import Link from "next/link";
import { PackageCheck } from "lucide-react";

const shopLinks = [
  { href: "/boutique", label: "Boutique" },
  { href: "/categories", label: "Categories" },
  { href: "/vendre", label: "Vendre sur Maxi Trouvaille" },
  { href: "/livraison", label: "Livraison" },
  { href: "/retours-remboursements", label: "Retours" },
];

const legalLinks = [
  { href: "/mentions-legales", label: "Mentions legales" },
  { href: "/conditions-generales-vente", label: "CGV provisoires" },
  { href: "/politique-confidentialite", label: "Confidentialite" },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-[#171717] text-white">
      <div className="container-page grid gap-8 py-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand text-foreground">
              <PackageCheck size={21} aria-hidden="true" />
            </span>
            <span className="text-lg font-black">Maxi Trouvaille</span>
          </div>
          <p className="max-w-md text-sm leading-6 text-white/70">
            Boutique de bonnes affaires, lots, colis perdus et produits neufs ou
            quasi neufs. Les vrais produits seront ajoutes progressivement.
          </p>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-black uppercase text-brand">Boutique</h2>
          <div className="grid gap-2 text-sm">
            {shopLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-white/72 hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-black uppercase text-brand">Aide</h2>
          <div className="grid gap-2 text-sm">
            <Link href="/faq" className="text-white/72 hover:text-white">
              FAQ
            </Link>
            <Link href="/contact" className="text-white/72 hover:text-white">
              Contact
            </Link>
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-white/72 hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-4">
        <div className="container-page text-xs text-white/55">
          © {new Date().getFullYear()} Maxi Trouvaille. Site en preparation.
        </div>
      </div>
    </footer>
  );
}

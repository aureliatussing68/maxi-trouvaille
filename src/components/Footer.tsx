import Link from "next/link";
import { PackageCheck } from "lucide-react";

const shopLinks = [
  { href: "/produits-partenaires", label: "Produits partenaires" },
  { href: "/nouveautes", label: "Nouveautés" },
  { href: "/promotions", label: "Promotions" },
  { href: "/boutique", label: "Boutique" },
  { href: "/paiement", label: "Paiement" },
  { href: "/livraison", label: "Livraison" },
  { href: "/suivi-colis", label: "Suivi colis" },
  { href: "/retours-remboursements", label: "Retours" },
];

const legalLinks = [
  { href: "/a-propos", label: "À propos" },
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/conditions-generales-vente", label: "Conditions générales" },
  { href: "/conditions-produits-partenaires", label: "Conditions produits partenaires" },
  { href: "/politique-confidentialite", label: "Confidentialité" },
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
            Les trouvailles malignes du moment à petits prix : maison, cuisine,
            high-tech, animaux et plus encore. Paiement sécurisé par carte,
            livraison suivie et service client basé en France.
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
          © {new Date().getFullYear()} Maxi Trouvaille. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}

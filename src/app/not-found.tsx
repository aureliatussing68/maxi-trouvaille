import Link from "next/link";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";

export default function NotFound() {
  return (
    <section className="container-page py-12 sm:py-16">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal">
          Page introuvable
        </p>
        <h1 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">
          On remet le client sur un parcours utile.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted sm:text-base">
          La page demandee n&apos;existe pas ou n&apos;est pas encore disponible.
          La boutique, les produits partenaires, le suivi colis et le service
          client restent accessibles.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/boutique"
            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-5 py-2.5 text-sm font-bold text-white hover:bg-[#2b2b2b]"
          >
            Voir la boutique
          </Link>
          <Link
            href="/contact"
            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-white px-5 py-2.5 text-sm font-bold hover:bg-[#f1eadf]"
          >
            Service client
          </Link>
        </div>
      </div>

      <CustomerSupportQuickLinks className="mt-12" />
    </section>
  );
}

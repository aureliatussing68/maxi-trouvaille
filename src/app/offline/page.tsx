import Link from "next/link";

export const metadata = {
  title: "Hors ligne",
};

export default function OfflinePage() {
  return (
    <section className="container-page py-16">
      <div className="max-w-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal">
          Mode hors ligne
        </p>
        <h1 className="mt-3 text-3xl font-black text-foreground md:text-5xl">
          Maxi Trouvaille reste pret a redemarrer.
        </h1>
        <p className="mt-5 text-lg leading-8 text-muted">
          La connexion semble indisponible. Les pages deja consultees peuvent
          rester accessibles, mais les actions panier, paiement et ajout rapide
          attendent le retour du reseau.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-foreground px-6 text-sm font-bold text-white transition hover:bg-teal"
        >
          Revenir a l&apos;accueil
        </Link>
      </div>
    </section>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page py-16 text-center">
      <h1 className="text-3xl font-black">Page introuvable</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
        La page demandee n&apos;existe pas ou n&apos;est pas encore disponible.
      </p>
      <Link
        href="/"
        className="focus-ring mt-6 inline-flex min-h-11 items-center rounded-md bg-foreground px-5 py-2.5 text-sm font-black text-white hover:bg-[#2b2b2b]"
      >
        Retour accueil
      </Link>
    </div>
  );
}

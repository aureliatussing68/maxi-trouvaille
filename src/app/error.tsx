"use client";

import Link from "next/link";
import { AlertTriangle, Headphones, RotateCcw, ShoppingBag } from "lucide-react";
import { useEffect } from "react";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Maxi Trouvaille app error", error);
  }, [error]);

  return (
    <section className="container-page py-12">
      <div className="rounded-lg border border-[#fecdd3] bg-paper p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto mb-4 text-rose" size={42} aria-hidden="true" />
        <h1 className="text-2xl font-black">Une erreur est survenue</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
          La page n&apos;a pas pu etre chargee correctement. Vous pouvez reessayer,
          revenir vers la boutique ou contacter le service client Maxi Trouvaille.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-5 py-2.5 text-sm font-black text-white hover:bg-[#2b2b2b]"
          >
            <RotateCcw size={18} aria-hidden="true" />
            Reessayer
          </button>
          <Link
            href="/boutique"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-5 py-2.5 text-sm font-black hover:bg-[#f1eadf]"
          >
            <ShoppingBag size={17} aria-hidden="true" />
            Boutique
          </Link>
          <Link
            href="/contact"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-5 py-2.5 text-sm font-black hover:bg-[#f1eadf]"
          >
            <Headphones size={17} aria-hidden="true" />
            Service client
          </Link>
        </div>
      </div>

      <CustomerSupportQuickLinks className="mt-10" />
    </section>
  );
}

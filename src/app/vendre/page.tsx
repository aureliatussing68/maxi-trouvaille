import type { Metadata } from "next";
import Link from "next/link";
import { BadgeEuro, ShieldCheck, Store, UserRoundCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { marketplaceRoadmap, marketplaceRoles } from "@/lib/marketplace";

export const metadata: Metadata = {
  title: "Vendre sur Maxi Trouvaille",
};

export default function SellPage() {
  return (
    <>
      <PageHeader
        eyebrow="Bientot"
        title="Vendre sur Maxi Trouvaille"
        description="Cette page prepare la future evolution marketplace sans ralentir la boutique principale."
      />
      <section className="container-page grid gap-6 py-10 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-5">
          <article className="rounded-lg border border-line bg-paper p-6 shadow-sm">
            <Store className="mb-4 text-teal" size={28} aria-hidden="true" />
            <h2 className="text-xl font-black">Espace vendeur prevu</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Les vendeurs pourront plus tard creer un compte, deposer leurs
              annonces, suivre leurs ventes et gerer leurs produits.
            </p>
          </article>
          <article className="rounded-lg border border-line bg-paper p-6 shadow-sm">
            <ShieldCheck className="mb-4 text-teal" size={28} aria-hidden="true" />
            <h2 className="text-xl font-black">Moderation avant publication</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Les annonces externes seront separees des produits internes et
              pourront rester en attente jusqu&apos;a validation admin.
            </p>
          </article>
          <article className="rounded-lg border border-line bg-paper p-6 shadow-sm">
            <BadgeEuro className="mb-4 text-teal" size={28} aria-hidden="true" />
            <h2 className="text-xl font-black">Commission future</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Le modele prevoit une commission de reference de{" "}
              {Math.round(marketplaceRoadmap.defaultCommissionRate * 100)} %,
              a ajuster avant l&apos;implementation paiement marketplace.
            </p>
          </article>
        </div>

        <aside className="h-fit rounded-lg border border-line bg-paper p-6 shadow-sm">
          <UserRoundCheck className="mb-4 text-teal" size={28} aria-hidden="true" />
          <h2 className="text-xl font-black">Roles prevus</h2>
          <div className="mt-4 grid gap-3 text-sm">
            {Object.entries(marketplaceRoles).map(([key, label]) => (
              <div key={key} className="flex justify-between gap-4 rounded-md bg-[#f6f1e8] px-3 py-2">
                <span className="font-bold">{label}</span>
                <span className="text-muted">{key}</span>
              </div>
            ))}
          </div>
          <Link
            href="/deposer-annonce"
            className="focus-ring mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-foreground px-5 py-2.5 text-sm font-black text-white hover:bg-[#2b2b2b]"
          >
            Deposer une annonce
          </Link>
        </aside>
      </section>
    </>
  );
}

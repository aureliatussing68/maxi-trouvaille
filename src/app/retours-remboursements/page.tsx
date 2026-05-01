import type { Metadata } from "next";
import { RotateCcw, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Retours et remboursements",
};

export default function ReturnsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Retours"
        title="Retours et remboursements"
        description="Politique provisoire a finaliser selon les produits, les obligations legales et les conditions de vente."
      />
      <section className="container-page grid gap-5 py-10 md:grid-cols-2">
        <article className="rounded-lg border border-line bg-paper p-6 shadow-sm">
          <RotateCcw className="mb-4 text-teal" size={28} aria-hidden="true" />
          <h2 className="text-xl font-black">Delai de retractation</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Un delai legal de 14 jours est a prevoir pour les consommateurs,
            sous reserve des exceptions applicables et de l&apos;etat du produit.
          </p>
        </article>
        <article className="rounded-lg border border-line bg-paper p-6 shadow-sm">
          <ShieldCheck className="mb-4 text-teal" size={28} aria-hidden="true" />
          <h2 className="text-xl font-black">Controle produit</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Les retours devront etre controles avant remboursement, surtout pour
            les lots, objets ouverts ou produits quasi neufs.
          </p>
        </article>
      </section>
    </>
  );
}

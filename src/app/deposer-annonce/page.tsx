import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Deposer une annonce",
};

export default function CreateListingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Placeholder marketplace"
        title="Deposer une annonce"
        description="Le formulaire vendeur final sera ajoute lors de la phase marketplace. La boutique principale reste prioritaire."
      />
      <section className="container-page py-10">
        <div className="rounded-lg border border-line bg-paper p-6 shadow-sm">
          <ClipboardList className="mb-4 text-teal" size={30} aria-hidden="true" />
          <h2 className="text-2xl font-black">Annonce en attente de future activation</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Cette page reserve l&apos;emplacement du futur depot d&apos;annonce. A terme,
            elle utilisera un compte vendeur, un statut de moderation, des photos,
            un prix, une categorie et une validation admin avant publication.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-dashed border-line p-4">
              <h3 className="font-black">Champs prevus</h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                Titre, description, prix, etat, categorie, photos, stock,
                livraison et informations vendeur.
              </p>
            </div>
            <div className="rounded-lg border border-dashed border-line p-4">
              <h3 className="font-black">Workflow prevu</h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                Brouillon, en attente de validation, approuve ou refuse par un
                administrateur.
              </p>
            </div>
          </div>
          <Link
            href="/boutique"
            className="focus-ring mt-6 inline-flex min-h-11 items-center rounded-md bg-foreground px-5 py-2.5 text-sm font-black text-white hover:bg-[#2b2b2b]"
          >
            Retour boutique
          </Link>
        </div>
      </section>
    </>
  );
}

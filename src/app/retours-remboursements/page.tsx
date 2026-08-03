import type { Metadata } from "next";
import { ClipboardCheck, Headphones, RotateCcw, ShieldCheck } from "lucide-react";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Retours et remboursements",
  description:
    "Retours et remboursements sur Maxi Trouvaille : droit de rétractation de 14 jours, marche à suivre simple et suivi de la demande par le service client.",
};

export default function ReturnsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Retours"
        title="Retours et remboursements"
        description="14 jours pour changer d'avis, une marche à suivre simple et un suivi de votre demande par le service client."
      />
      <div className="container-page grid gap-8 py-10">
        <section className="grid gap-5 md:grid-cols-2">
          <article className="rounded-lg border border-line bg-[#faf7f0] p-6 shadow-sm md:col-span-2">
            <ShieldCheck className="mb-4 text-teal" size={28} aria-hidden="true" />
            <p className="text-sm font-bold uppercase text-teal">
              Comment faire un retour
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Une demande simple, en trois étapes.
            </h2>
            <ol className="mt-4 grid max-w-3xl gap-3 text-sm leading-6 text-muted">
              <li>
                <span className="font-black text-foreground">1.</span>{" "}
                Contactez le service client (email{" "}
                <a
                  href="mailto:contact@maxitrouvaille.fr"
                  className="font-black text-teal underline"
                >
                  contact@maxitrouvaille.fr
                </a>{" "}
                ou messagerie du site) en indiquant votre commande et le produit
                concerné.
              </li>
              <li>
                <span className="font-black text-foreground">2.</span>{" "}
                Nous vous confirmons la marche à suivre et l&apos;adresse de
                retour. Le produit doit être renvoyé complet, si possible dans
                son emballage d&apos;origine.
              </li>
              <li>
                <span className="font-black text-foreground">3.</span>{" "}
                Après réception et vérification du produit, le remboursement est
                effectué sur le moyen de paiement utilisé lors de la commande.
              </li>
            </ol>
          </article>
          <article className="rounded-lg border border-line bg-paper p-6 shadow-sm">
            <RotateCcw className="mb-4 text-teal" size={28} aria-hidden="true" />
            <h2 className="text-xl font-black">Délai de rétractation</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Vous disposez en principe d&apos;un délai légal de 14 jours à
              compter de la réception de votre commande pour exercer votre droit
              de rétractation, sous réserve des exceptions prévues par la loi et
              de l&apos;état du produit retourné.
            </p>
          </article>
          <article className="rounded-lg border border-line bg-paper p-6 shadow-sm">
            <ClipboardCheck
              className="mb-4 text-teal"
              size={28}
              aria-hidden="true"
            />
            <h2 className="text-xl font-black">Vérification du produit</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Chaque retour est examiné à réception afin de confirmer le produit
              concerné et son état, avant validation du remboursement.
            </p>
          </article>
          <article className="rounded-lg border border-line bg-paper p-6 shadow-sm md:col-span-2">
            <Headphones className="mb-4 text-teal" size={28} aria-hidden="true" />
            <h2 className="text-xl font-black">Une demande accompagnée</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Pour traiter votre demande rapidement, le service client peut vous
              demander quelques informations utiles : numéro de commande,
              produit concerné, motif et photos si nécessaire. Vous gardez un
              seul interlocuteur du début à la fin.
            </p>
          </article>
        </section>
        <CustomerSupportQuickLinks />
      </div>
    </>
  );
}

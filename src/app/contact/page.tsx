import type { Metadata } from "next";
import { Mail, MapPin, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Contact",
};

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Une question sur Maxi Trouvaille ?"
        description="La boutique est en preparation. Cette page est prete pour le futur support client."
      />
      <section className="container-page grid gap-6 py-10 lg:grid-cols-[1fr_360px]">
        <form
          action="mailto:contact@maxitrouvaille.fr"
          method="post"
          encType="text/plain"
          className="grid gap-4 rounded-lg border border-line bg-paper p-6 shadow-sm"
        >
          <label className="grid gap-2 text-sm font-bold">
            Nom
            <input
              name="name"
              className="focus-ring min-h-11 rounded-md border border-line px-3"
              placeholder="Votre nom"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            E-mail
            <input
              name="email"
              type="email"
              className="focus-ring min-h-11 rounded-md border border-line px-3"
              placeholder="vous@email.fr"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Message
            <textarea
              name="message"
              rows={6}
              className="focus-ring rounded-md border border-line px-3 py-3"
              placeholder="Votre message"
            />
          </label>
          <button
            type="submit"
            className="focus-ring min-h-11 rounded-md bg-foreground px-5 py-2.5 text-sm font-black text-white hover:bg-[#2b2b2b]"
          >
            Envoyer
          </button>
        </form>

        <aside className="grid h-fit gap-4">
          <div className="rounded-lg border border-line bg-paper p-5 shadow-sm">
            <Mail className="mb-3 text-teal" size={24} aria-hidden="true" />
            <h2 className="font-black">E-mail</h2>
            <p className="mt-2 text-sm text-muted">contact@maxitrouvaille.fr</p>
          </div>
          <div className="rounded-lg border border-line bg-paper p-5 shadow-sm">
            <MapPin className="mb-3 text-teal" size={24} aria-hidden="true" />
            <h2 className="font-black">Zone</h2>
            <p className="mt-2 text-sm text-muted">France, informations a completer.</p>
          </div>
          <div className="rounded-lg border border-line bg-paper p-5 shadow-sm">
            <MessageSquare className="mb-3 text-teal" size={24} aria-hidden="true" />
            <h2 className="font-black">Support</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Les demandes de commande, livraison et retour seront centralisees
              ici lors du lancement.
            </p>
          </div>
        </aside>
      </section>
    </>
  );
}

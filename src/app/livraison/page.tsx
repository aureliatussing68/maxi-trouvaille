import type { Metadata } from "next";
import { Handshake, MapPin, PackageCheck, Truck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Livraison",
};

export default function ShippingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Livraison"
        title="Choisissez la livraison avant paiement"
        description="Maxi Trouvaille propose des options simples pour tester le tunnel d'achat, sans connecter encore d'API transporteur."
      />
      <section className="container-page grid gap-5 py-10 md:grid-cols-2">
        <article className="rounded-lg border border-line bg-paper p-6 shadow-sm">
          <Handshake className="mb-4 text-teal" size={28} aria-hidden="true" />
          <h2 className="text-xl font-black">Remise en main propre gratuite</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Frais de livraison a 0 €. Le retrait est a convenir directement avec
            Maxi Trouvaille selon les disponibilites.
          </p>
        </article>
        <article className="rounded-lg border border-line bg-paper p-6 shadow-sm">
          <MapPin className="mb-4 text-teal" size={28} aria-hidden="true" />
          <h2 className="text-xl font-black">Mondial Relay a partir de 4,90 €</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Le panier demande les coordonnees utiles. Le choix du point relais
            sera ajoute plus tard, sans API Mondial Relay pour le moment.
          </p>
        </article>
        <article className="rounded-lg border border-line bg-paper p-6 shadow-sm">
          <Truck className="mb-4 text-teal" size={28} aria-hidden="true" />
          <h2 className="text-xl font-black">Colissimo domicile a partir de 7,90 €</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Pour Colissimo, l&apos;adresse complete est demandee avant paiement afin
            de preparer l&apos;expedition a domicile.
          </p>
        </article>
        <article className="rounded-lg border border-line bg-paper p-6 shadow-sm">
          <PackageCheck className="mb-4 text-teal" size={28} aria-hidden="true" />
          <h2 className="text-xl font-black">Objets volumineux sur devis</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Certains produits peuvent etre limites au retrait ou demander un devis
            personnalise. Dans ce cas, Mondial Relay et Colissimo ne sont pas
            proposes dans le panier.
          </p>
        </article>
      </section>
    </>
  );
}

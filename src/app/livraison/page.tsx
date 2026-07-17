import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import {
  Clock,
  Headphones,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";
import { PageHeader } from "@/components/PageHeader";

type DeliveryPromise = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const deliveryPromises: DeliveryPromise[] = [
  {
    icon: ShieldCheck,
    title: "Frais affichés avant paiement",
    text: "Les frais de livraison sont indiqués clairement dans le panier, avant le paiement.",
  },
  {
    icon: Truck,
    title: "Expédition suivie",
    text: "Le suivi colis est rattaché à la commande dès que l'expédition est confirmée.",
  },
  {
    icon: Headphones,
    title: "Contact Maxi Trouvaille",
    text: "Vous gardez Maxi Trouvaille comme interlocuteur unique en cas de question.",
  },
];

export const metadata: Metadata = {
  title: "Livraison",
  description:
    "Livraison suivie à domicile en 7 à 14 jours ouvrés, frais affichés avant paiement et suivi colis sur Maxi Trouvaille.",
};

export default async function ShippingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Livraison"
        title="Livraison suivie, simple et claire"
        description="Livraison à domicile avec numéro de suivi. Les frais et le délai estimé sont affichés avant le paiement."
      />
      <section className="container-page border-b border-line py-10">
        <div className="grid gap-4 rounded-lg border border-line bg-[#faf7f0] p-5 shadow-sm lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase text-teal">
              Comment ça marche
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Une livraison expliquée avant chaque achat.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Vous payez sur Maxi Trouvaille, vous recevez la confirmation de
              commande, puis le numéro de suivi dès l&apos;expédition. Votre
              colis arrive directement chez vous.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {deliveryPromises.map((item) => {
              const Icon = item.icon;

              return (
                <article
                  key={item.title}
                  className="rounded-lg border border-line bg-white p-4"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-sm font-black">{item.title}</h3>
                  <p className="mt-2 text-xs font-semibold leading-5 text-muted">
                    {item.text}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      <section className="container-page grid gap-5 py-10 md:grid-cols-2">
        <article className="rounded-lg border border-line bg-paper p-6 shadow-sm">
          <Truck className="mb-4 text-teal" size={28} aria-hidden="true" />
          <h2 className="text-xl font-black">
            Livraison suivie à domicile — 3,90 €
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Livraison à domicile avec numéro de suivi. L&apos;adresse complète
            est demandée avant le paiement pour préparer l&apos;expédition.
          </p>
        </article>
        <article className="rounded-lg border border-line bg-paper p-6 shadow-sm">
          <Clock className="mb-4 text-teal" size={28} aria-hidden="true" />
          <h2 className="text-xl font-black">Délai estimé : 7 à 14 jours ouvrés</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Nos produits sont expédiés depuis les entrepôts de nos partenaires
            logistiques. Le délai estimé est affiché sur chaque fiche produit.
          </p>
        </article>
        <article className="rounded-lg border border-line bg-paper p-6 shadow-sm">
          <PackageCheck className="mb-4 text-teal" size={28} aria-hidden="true" />
          <h2 className="text-xl font-black">Suivi de commande</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Dès l&apos;expédition, vous recevez le numéro de suivi et pouvez
            suivre votre colis depuis la page Suivi colis du site.
          </p>
        </article>
        <article className="rounded-lg border border-line bg-paper p-6 shadow-sm">
          <Headphones className="mb-4 text-teal" size={28} aria-hidden="true" />
          <h2 className="text-xl font-black">Une question ?</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Le service client Maxi Trouvaille répond à toutes les questions
            livraison, commande et paiement via la page Contact.
          </p>
        </article>
      </section>
      <section className="container-page pb-10">
        <CustomerSupportQuickLinks />
      </section>
    </>
  );
}

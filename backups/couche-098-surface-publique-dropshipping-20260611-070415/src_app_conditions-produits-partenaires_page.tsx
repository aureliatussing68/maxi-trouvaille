import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";

const sections = [
  {
    title: "Commande et paiement",
    text: "Le client commande et paie sur Maxi Trouvaille via Stripe. Les coordonnees bancaires ne sont pas stockees par Maxi Trouvaille.",
  },
  {
    title: "Expédition par partenaire logistique",
    text: "Certains produits neufs peuvent etre expedies directement par un partenaire logistique. Le client garde Maxi Trouvaille comme interlocuteur principal.",
  },
  {
    title: "Délais de livraison",
    text: "Les delais affiches sont des estimations. Ils peuvent varier selon le partenaire logistique, le transporteur, la periode et les controles avant expedition.",
  },
  {
    title: "Suivi colis",
    text: "Le numero de suivi est ajoute des que le partenaire confirme l'expedition. Maxi Trouvaille peut ensuite transmettre les informations au client.",
  },
  {
    title: "Validation humaine",
    text: "Au lancement, chaque commande partenaire est preparee et validee manuellement afin d'eviter tout achat automatique non controle.",
  },
];

export const metadata: Metadata = {
  title: "Conditions produits partenaires",
  description:
    "Conditions de vente et de livraison pour les produits partenaires Maxi Trouvaille.",
};

export default function PartnerTermsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Conditions"
        title="Conditions produits partenaires"
        description="Informations provisoires pour les produits expédiés par partenaire logistique."
      />
      <section className="container-page grid gap-4 py-10">
        {sections.map((section) => (
          <article
            key={section.title}
            className="rounded-lg border border-line bg-paper p-5 shadow-sm"
          >
            <h2 className="text-lg font-black">{section.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">{section.text}</p>
          </article>
        ))}
      </section>
    </>
  );
}

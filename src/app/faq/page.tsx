import type { Metadata } from "next";
import { CustomerJourneyPanel } from "@/components/CustomerJourneyPanel";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";
import { PageHeader } from "@/components/PageHeader";
import { ServiceReadinessPanel } from "@/components/ServiceReadinessPanel";
import { getStorefrontControlMetrics } from "@/lib/storefront-control-metrics";

const questions = [
  {
    question: "Les produits sont-ils reels ?",
    answer:
      "Oui. La boutique met en avant des produits partenaires et des rayons préparés avec prix, stock et informations de livraison contrôlés avant publication.",
  },
  {
    question: "Le paiement est-il actif ?",
    answer:
      "Le paiement Maxi Trouvaille passe par un tunnel sécurisé et s'ouvre seulement pour les articles validés.",
  },
  {
    question: "Quels types de produits seront vendus ?",
    answer:
      "Produits utiles, produits partenaires, promotions et nouveautes. Les anciens rayons colis ne sont plus mis en avant sur le site public.",
  },
  {
    question: "Les produits partenaires sont-ils vérifiés ?",
    answer:
      "Oui. Les produits passent par une validation humaine avant publication.",
  },
  {
    question: "Qui expédie les produits partenaires ?",
    answer:
      "Le client paie Maxi Trouvaille, puis le produit est expedie par un partenaire logistique. Le service client et le suivi restent cote Maxi Trouvaille.",
  },
  {
    question: "Comment fonctionne l'espace partenaires ?",
    answer:
      "Maxi Trouvaille garde une validation humaine avant chaque publication. Les propositions externes passent d'abord par une sélection Maxi Trouvaille.",
  },
];

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Questions fréquentes Maxi Trouvaille sur les produits partenaires, le paiement, la livraison et le suivi colis.",
};

export default async function FaqPage() {
  const metrics = await getStorefrontControlMetrics();

  return (
    <>
      <PageHeader
        eyebrow="FAQ"
        title="Questions frequentes"
        description="Les reponses principales sur les produits partenaires, le paiement Maxi Trouvaille et le suivi colis."
      />
      <div className="container-page grid gap-8 py-10">
        <ServiceReadinessPanel metrics={metrics} />
        <CustomerJourneyPanel />
        <CustomerSupportQuickLinks />
        <section className="grid gap-4">
          {questions.map((item) => (
            <article
              key={item.question}
              className="rounded-lg border border-line bg-paper p-5 shadow-sm"
            >
              <h2 className="text-lg font-black">{item.question}</h2>
              <p className="mt-3 text-sm leading-6 text-muted">{item.answer}</p>
            </article>
          ))}
        </section>
      </div>
    </>
  );
}

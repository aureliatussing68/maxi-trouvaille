import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";

const questions = [
  {
    question: "Les produits sont-ils reels ?",
    answer:
      "Pour l'instant, seul un produit fictif sert au test. Les vrais produits seront ajoutes ensuite, avec leurs prix, stocks et photos.",
  },
  {
    question: "Le paiement est-il actif ?",
    answer:
      "Stripe Checkout est prepare. Le mode live reste bloque tant que les vraies cles et STRIPE_ENABLE_LIVE_PAYMENTS=true ne sont pas ajoutes.",
  },
  {
    question: "Quels types de produits seront vendus ?",
    answer:
      "Produits personnels, produits dropshipping partenaires, promotions, nouveautes et plus tard colis surprises/palettes quand le systeme sera ouvert.",
  },
  {
    question: "Les colis surprises et palettes sont-ils vendus maintenant ?",
    answer:
      "Non. Ils sont marques À venir et le bouton d'achat est masque jusqu'a l'ouverture officielle.",
  },
  {
    question: "Qui expédie les produits dropshipping ?",
    answer:
      "Le client paie Maxi Trouvaille, puis le produit est expedie par un partenaire logistique. Le service client et le suivi restent cote Maxi Trouvaille.",
  },
  {
    question: "La marketplace est-elle deja ouverte ?",
    answer:
      "Non. L'architecture prevoit cette evolution, mais les comptes vendeurs et annonces externes ne sont pas encore actifs.",
  },
];

export const metadata: Metadata = {
  title: "FAQ",
};

export default function FaqPage() {
  return (
    <>
      <PageHeader
        eyebrow="FAQ"
        title="Questions frequentes"
        description="Les reponses principales pour la phase de lancement de Maxi Trouvaille."
      />
      <section className="container-page grid gap-4 py-10">
        {questions.map((item) => (
          <article key={item.question} className="rounded-lg border border-line bg-paper p-5 shadow-sm">
            <h2 className="text-lg font-black">{item.question}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">{item.answer}</p>
          </article>
        ))}
      </section>
    </>
  );
}

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
      "Non. Le site est prepare pour Stripe en mode test et bloque les cles de paiement reel.",
  },
  {
    question: "Quels types de produits seront vendus ?",
    answer:
      "Colis perdus, lots, objets neufs ou quasi neufs, bonnes affaires multi-categories et plus tard certains produits en dropshipping.",
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

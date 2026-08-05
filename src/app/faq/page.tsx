import type { Metadata } from "next";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";
import { PageHeader } from "@/components/PageHeader";

const questions = [
  {
    question: "Quels sont les délais de livraison ?",
    answer:
      "La plupart de nos produits sont livrés sous 7 à 14 jours ouvrés, avec un numéro de suivi communiqué dès l'expédition. Le délai estimé est affiché sur chaque fiche produit avant l'achat.",
  },
  {
    question: "Comment se passe le paiement ?",
    answer:
      "Le paiement se fait par carte bancaire via Stripe, une des solutions de paiement les plus utilisées au monde. Vos données bancaires ne passent jamais par nos serveurs, et aucune création de compte n'est nécessaire pour commander.",
  },
  {
    question: "Comment suivre ma commande ?",
    answer:
      "Dès l'expédition de votre commande, vous recevez un numéro de suivi. Vous pouvez ensuite suivre votre colis directement depuis la page Suivi colis du site.",
  },
  {
    question: "Puis-je retourner un article ?",
    answer:
      "Oui. Vous disposez d'un droit de rétractation de 14 jours à compter de la réception de votre commande. Pour lancer un retour, contactez le service client via la page Contact ou la messagerie du site. Les détails sont expliqués sur la page Retours et remboursements.",
  },
  {
    question: "Qui expédie les produits ?",
    answer:
      "Vous commandez et payez sur Maxi Trouvaille. L'expédition est assurée par un partenaire logistique situé hors de l'Union européenne. Le service client, le suivi, les retours, les remboursements et la garantie restent gérés par Maxi Trouvaille : vous avez un seul interlocuteur, et vos droits de consommateur sont exactement les mêmes.",
  },
  {
    question: "Les produits sont-ils neufs ?",
    answer:
      "Oui, sauf mention contraire claire sur la fiche produit, tous les articles vendus sont neufs. L'état du produit est toujours indiqué sur la fiche.",
  },
  {
    question: "Comment contacter le service client ?",
    answer:
      "Par email à contact@maxitrouvaille.fr, ou via le bouton « Envoyer un message » présent sur chaque fiche produit. Nous répondons rapidement à chaque demande.",
  },
  {
    question: "Un produit est en rupture, reviendra-t-il ?",
    answer:
      "Le catalogue évolue régulièrement : nouveautés chaque semaine et retours en stock fréquents. N'hésitez pas à nous envoyer un message depuis la fiche produit pour savoir si un article sera de nouveau disponible.",
  },
];

export const metadata: Metadata = {
  title: "FAQ - Questions fréquentes",
  description:
    "Questions fréquentes Maxi Trouvaille : délais de livraison, paiement sécurisé, suivi colis, retours et remboursements.",
};

export default function FaqPage() {
  return (
    <>
      <PageHeader
        eyebrow="FAQ"
        title="Questions fréquentes"
        description="Livraison, paiement, suivi colis, retours : les réponses aux questions que vous vous posez avant et après votre commande."
      />
      <div className="container-page grid gap-8 py-10">
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
        <CustomerSupportQuickLinks />
      </div>
    </>
  );
}

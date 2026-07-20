import type { Metadata } from "next";
import Link from "next/link";
import {
  CircleHelp,
  CreditCard,
  Headphones,
  Mail,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { CustomerJourneyPanel } from "@/components/CustomerJourneyPanel";

export const metadata: Metadata = {
  title: "Contact - Service client",
  description:
    "Contactez le service client Maxi Trouvaille : questions sur une commande, la livraison, le paiement, le suivi colis ou un retour. Réponse rapide par email.",
};

type SupportCard = {
  icon: LucideIcon;
  title: string;
  text: string;
  href: string;
  action: string;
};

const supportCards: SupportCard[] = [
  {
    icon: Truck,
    title: "Suivi colis",
    text: "Votre commande est expédiée ? Suivez-la avec votre numéro de suivi.",
    href: "/suivi-colis",
    action: "Ouvrir le suivi",
  },
  {
    icon: CreditCard,
    title: "Paiement",
    text: "Tout savoir sur le paiement sécurisé par carte bancaire via Stripe.",
    href: "/paiement",
    action: "Voir le paiement",
  },
  {
    icon: RotateCcw,
    title: "Retours",
    text: "14 jours pour changer d'avis : la marche à suivre pour un retour.",
    href: "/retours-remboursements",
    action: "Voir les retours",
  },
  {
    icon: CircleHelp,
    title: "FAQ",
    text: "Les réponses aux questions les plus fréquentes, avant et après commande.",
    href: "/faq",
    action: "Lire la FAQ",
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Service client"
        title="Une question ? Nous sommes là."
        description="Commande, livraison, paiement, suivi colis ou retour : le service client Maxi Trouvaille vous répond rapidement."
      />
      <section className="container-page grid gap-6 py-10 lg:grid-cols-[1fr_360px]">
        <div className="grid h-fit gap-4">
          <div className="rounded-lg border border-line bg-paper p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <Headphones
                className="mt-1 text-teal"
                size={26}
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-black uppercase text-teal">
                  Nous contacter
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  Deux façons simples de nous écrire.
                </h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-line bg-white p-4">
                <Mail className="text-teal" size={22} aria-hidden="true" />
                <h3 className="mt-3 font-black">Par email</h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Écrivez-nous à{" "}
                  <a
                    href="mailto:contact@maxitrouvaille.fr"
                    className="font-black text-teal underline"
                  >
                    contact@maxitrouvaille.fr
                  </a>{" "}
                  en précisant si possible le produit ou la commande concernés.
                </p>
              </div>
              <div className="rounded-md border border-line bg-white p-4">
                <MessageSquare className="text-teal" size={22} aria-hidden="true" />
                <h3 className="mt-3 font-black">Depuis une fiche produit</h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Chaque fiche produit dispose d&apos;un bouton «&nbsp;Envoyer un
                  message&nbsp;» : votre question arrive directement avec la
                  référence du produit.
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs font-bold leading-5 text-muted">
              Nous faisons le maximum pour répondre à chaque message dans les
              plus brefs délais, du lundi au samedi.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {supportCards.map((card) => {
              const Icon = card.icon;

              return (
                <Link
                  key={card.title}
                  href={card.href}
                  className="focus-ring rounded-lg border border-line bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#d5c8b7] hover:shadow-md"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-black">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{card.text}</p>
                  <p className="mt-3 text-sm font-black text-teal">
                    {card.action}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>

        <aside className="grid h-fit gap-4">
          <div className="rounded-lg border border-line bg-paper p-5 shadow-sm">
            <ShieldCheck className="mb-3 text-teal" size={24} aria-hidden="true" />
            <h2 className="font-black">Commande protégée</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Paiement par carte sécurisé, droit de rétractation de 14 jours et
              un seul interlocuteur du panier à la livraison.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-paper p-5 shadow-sm">
            <Truck className="mb-3 text-teal" size={24} aria-hidden="true" />
            <h2 className="font-black">Livraison suivie</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Numéro de suivi communiqué dès l&apos;expédition, livraison
              estimée 7 à 14 jours ouvrés selon les produits.
            </p>
          </div>
        </aside>
      </section>
      <section className="container-page pb-12">
        <CustomerJourneyPanel />
      </section>
    </>
  );
}

import { BadgeEuro, PackageCheck, ShieldCheck, Truck } from "lucide-react";

const items = [
  {
    icon: PackageCheck,
    title: "Produits vérifiés",
    text: "Chaque fiche est relue et validée avant sa mise en ligne.",
  },
  {
    icon: ShieldCheck,
    title: "Achat sécurisé",
    text: "Paiement par carte via Stripe, données protégées.",
  },
  {
    icon: Truck,
    title: "Livraison suivie",
    text: "Numéro de suivi et réception estimée 7 à 14 jours ouvrés.",
  },
  {
    icon: BadgeEuro,
    title: "Prix clairs",
    text: "Prix tout compris, frais de livraison affichés avant paiement.",
  },
];

export function TrustBar() {
  return (
    <section className="bg-paper">
      <div className="container-page grid gap-3 py-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.title} className="flex gap-3 rounded-lg border border-line p-4">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                <Icon size={20} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-black">{item.title}</h2>
                <p className="mt-1 text-sm leading-5 text-muted">{item.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

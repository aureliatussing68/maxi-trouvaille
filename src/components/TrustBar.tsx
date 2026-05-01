import { BadgeEuro, PackageCheck, ShieldCheck, Truck } from "lucide-react";

const items = [
  {
    icon: PackageCheck,
    title: "Arrivages varies",
    text: "Lots, bonnes affaires et trouvailles selon les stocks.",
  },
  {
    icon: ShieldCheck,
    title: "Achat encadre",
    text: "Paiement test d'abord, activation reelle sur validation.",
  },
  {
    icon: Truck,
    title: "Livraison preparee",
    text: "Structure prete pour les envois suivis.",
  },
  {
    icon: BadgeEuro,
    title: "Prix clairs",
    text: "Prix centralises dans le catalogue produit.",
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

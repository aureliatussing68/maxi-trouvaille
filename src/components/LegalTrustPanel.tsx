import Link from "next/link";
import {
  ArrowRight,
  CreditCard,
  FileCheck,
  Headphones,
  RotateCcw,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";

type LegalTrustItem = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const legalTrustItems: LegalTrustItem[] = [
  {
    icon: CreditCard,
    title: "Paiement Maxi Trouvaille",
    text: "Le règlement reste sur le site via un parcours sécurisé.",
  },
  {
    icon: Truck,
    title: "Suivi colis",
    text: "La livraison et les informations de suivi restent centralisées.",
  },
  {
    icon: RotateCcw,
    title: "Retours encadrés",
    text: "Les demandes passent par le service client Maxi Trouvaille.",
  },
];

export function LegalTrustPanel({ className }: { className?: string }) {
  return (
    <section className={["grid gap-5", className].filter(Boolean).join(" ")}>
      <div className="grid gap-5 rounded-lg border border-line bg-[#faf7f0] p-5 shadow-sm lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-md bg-[#eef8f6] px-3 py-2 text-sm font-bold uppercase text-teal">
            <FileCheck size={16} aria-hidden="true" />
            Cadre client
          </p>
          <h2 className="mt-4 max-w-3xl text-2xl font-black leading-tight sm:text-3xl">
            Des documents lisibles pour rassurer sans ouvrir de fiche non validée.
          </h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-muted">
            Les pages légales rappellent le rôle de Maxi Trouvaille: paiement,
            service client, suivi colis, livraison et retours au même endroit.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[360px] lg:grid-cols-1">
          <Link
            href="/conditions-produits-partenaires"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-bold text-white hover:bg-[#2b2b2b]"
          >
            <ShieldCheck size={17} aria-hidden="true" />
            Produits partenaires
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <Link
            href="/retours-remboursements"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-bold hover:bg-[#f1eadf]"
          >
            <RotateCcw size={17} aria-hidden="true" />
            Retours
          </Link>
          <Link
            href="/contact"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-bold hover:bg-[#f1eadf]"
          >
            <Headphones size={17} aria-hidden="true" />
            Contact
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {legalTrustItems.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.title}
              className="rounded-lg border border-line bg-paper p-4 shadow-sm"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                <Icon size={19} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-bold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
            </article>
          );
        })}
      </div>

      <CustomerSupportQuickLinks />
    </section>
  );
}

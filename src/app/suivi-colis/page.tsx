import type { Metadata } from "next";
import { Clock3, Headphones, PackageCheck, ShieldCheck } from "lucide-react";
import { CustomerJourneyPanel } from "@/components/CustomerJourneyPanel";
import { CustomerSupportQuickLinks } from "@/components/CustomerSupportQuickLinks";
import { PageHeader } from "@/components/PageHeader";
import { ServiceReadinessPanel } from "@/components/ServiceReadinessPanel";
import { TrackingLookupForm } from "@/components/TrackingLookupForm";
import { getStorefrontControlMetrics } from "@/lib/storefront-control-metrics";

const trackingSteps = [
  {
    icon: PackageCheck,
    title: "Commande validée",
    text: "Le suivi démarre quand la commande et les informations produit sont validées.",
  },
  {
    icon: Clock3,
    title: "Préparation",
    text: "La préparation logistique est suivie avant l'envoi du numéro colis.",
  },
  {
    icon: ShieldCheck,
    title: "Suivi centralisé",
    text: "Le client garde une page Maxi Trouvaille comme point de repère.",
  },
  {
    icon: Headphones,
    title: "Aide client",
    text: "En cas de doute, le service client Maxi Trouvaille peut vérifier la demande.",
  },
];

export const metadata: Metadata = {
  title: "Suivi colis",
  description:
    "Suivre une commande Maxi Trouvaille avec son numero de suivi colis.",
};

export default async function TrackingPage() {
  const metrics = await getStorefrontControlMetrics();

  return (
    <>
      <PageHeader
        eyebrow="Suivi colis"
        title="Suivi de commande"
        description="Retrouvez les informations de livraison dès que Maxi Trouvaille ajoute le numéro de suivi."
      />
      <section className="container-page border-b border-line py-10">
        <ServiceReadinessPanel metrics={metrics} />
        <CustomerJourneyPanel className="mt-10" />
        <CustomerSupportQuickLinks className="mt-10" />
      </section>
      <section className="container-page grid gap-6 py-10 lg:grid-cols-[1fr_420px]">
        <div className="grid gap-3 sm:grid-cols-2">
          {trackingSteps.map((step) => {
            const Icon = step.icon;

            return (
              <article
                key={step.title}
                className="rounded-lg border border-line bg-paper p-5 shadow-sm"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-base font-black">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{step.text}</p>
              </article>
            );
          })}
        </div>
        <TrackingLookupForm />
      </section>
    </>
  );
}

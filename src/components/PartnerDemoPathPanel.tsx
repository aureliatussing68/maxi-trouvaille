import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  CheckCircle2,
  CreditCard,
  Headphones,
  PackageCheck,
  Route,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import {
  categories,
  dropshippingFocusCategoryIds,
  isDropshippingProduct,
  type Product,
} from "@/lib/catalog";

type DemoCategoryCard = {
  href: string;
  label: string;
  focus: string;
  badge: string;
  candidateCount: number;
  publicProductCount: number;
  icon: LucideIcon;
};

const demoCategoryIds = dropshippingFocusCategoryIds.slice(1, 6);

const demoCategoryFocus = [
  "Arrivages simples à comprendre, prêts à présenter avant publication.",
  "Prix suivis, offres claires et conditions vérifiées avant affichage produit.",
  "Accessoires utiles, variantes limitées et preuves faciles à contrôler.",
  "Objets pratiques pour rangement, confort et usage quotidien.",
  "Petits produits lisibles, faciles à expliquer sur téléphone.",
] as const;

const demoCategoryIcons = [
  Sparkles,
  BadgePercent,
  CheckCircle2,
  Store,
  PackageCheck,
] as const;

function countLabel(count: number, singular: string, plural: string) {
  if (count <= 0) {
    return "En préparation";
  }

  return `${count} ${count > 1 ? plural : singular}`;
}

export function buildPartnerDemoCategoryCards({
  catalogProducts,
  publicProducts,
}: {
  catalogProducts: Product[];
  publicProducts: Product[];
}): DemoCategoryCard[] {
  return demoCategoryIds.flatMap((categoryId, index) => {
    const category = categories.find((item) => item.id === categoryId);

    if (!category) {
      return [];
    }

    const candidateCount = catalogProducts.filter(
      (product) =>
        product.categoryId === category.id && isDropshippingProduct(product),
    ).length;
    const publicProductCount = publicProducts.filter(
      (product) =>
        product.categoryId === category.id && isDropshippingProduct(product),
    ).length;

    return [
      {
        href: `/categories/${category.slug}`,
        label: category.name,
        focus: demoCategoryFocus[index] ?? category.description,
        badge:
          publicProductCount > 0
            ? countLabel(publicProductCount, "validé", "validés")
            : countLabel(candidateCount, "en validation", "en validation"),
        candidateCount,
        publicProductCount,
        icon: demoCategoryIcons[index] ?? PackageCheck,
      },
    ];
  });
}

export function PartnerDemoPathPanel({
  cards,
  candidateCount,
  publicProductCount,
  className,
}: {
  cards: DemoCategoryCard[];
  candidateCount: number;
  publicProductCount: number;
  className?: string;
}) {
  const steps = [
    {
      icon: Route,
      title: "1. Ouvrir la vitrine",
      text: "Commencer par les rayons partenaires pour montrer une boutique lisible sur téléphone.",
      href: "/produits-partenaires",
      label: "Rayons",
    },
    {
      icon: CreditCard,
      title: "2. Rassurer sur le paiement",
      text: "Présenter le paiement Maxi Trouvaille et expliquer que la vente reste fermée aux fiches non validées.",
      href: "/paiement",
      label: "Paiement",
    },
    {
      icon: Truck,
      title: "3. Montrer le suivi",
      text: "Terminer par le suivi colis et le service client pour garder un parcours cohérent.",
      href: "/suivi-colis",
      label: "Suivi",
    },
  ];

  return (
    <section
      className={[
        "grid gap-6 rounded-lg border border-line bg-paper p-5 shadow-sm sm:p-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold uppercase text-teal">
            <ShieldCheck size={16} aria-hidden="true" />
            Parcours démo mobile
          </p>
          <h2 className="mt-2 max-w-3xl text-2xl font-black leading-tight sm:text-3xl">
            Un chemin simple à montrer, sans fiche non validée.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base">
            Les visiteurs voient les rayons, le paiement Maxi Trouvaille, le
            suivi colis et le service client. Les articles restent en validation
            tant que les preuves essentielles ne sont pas complètes.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-64 lg:grid-cols-1">
          <div className="rounded-md border border-line bg-[#fbfaf7] p-3">
            <p className="text-[11px] font-bold uppercase text-muted">
              File visible
            </p>
            <p className="mt-1 text-sm font-bold text-teal">
              {countLabel(candidateCount, "fiche en validation", "fiches en validation")}
            </p>
          </div>
          <div className="rounded-md border border-line bg-[#fbfaf7] p-3">
            <p className="text-[11px] font-bold uppercase text-muted">
              Vente publique
            </p>
            <p className="mt-1 text-sm font-bold text-teal">
              {publicProductCount > 0
                ? countLabel(publicProductCount, "article validé", "articles validés")
                : "Achat verrouillé"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((step) => {
          const Icon = step.icon;

          return (
            <Link
              key={step.title}
              href={step.href}
              className="focus-ring group flex h-full flex-col justify-between rounded-md border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#d5c8b7] hover:shadow-md"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span className="rounded-md bg-[#f6f1e8] px-2 py-1 text-[11px] font-bold uppercase text-teal">
                  {step.label}
                </span>
              </span>
              <span>
                <span className="mt-4 flex items-center justify-between gap-3 text-base font-bold group-hover:text-teal">
                  {step.title}
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
                <span className="mt-2 block text-sm leading-6 text-muted">
                  {step.text}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase text-teal">
              Rayons à ouvrir en premier
            </p>
            <h3 className="mt-1 text-xl font-black">
              Sélection courte pour téléphone
            </h3>
          </div>
          <Link
            href="/categories"
            className="hidden text-sm font-bold text-teal hover:text-foreground sm:inline-flex"
          >
            Tous les rayons
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.href}
                href={card.href}
                className="focus-ring group flex min-h-44 flex-col justify-between rounded-md border border-line bg-[#fbfaf7] p-4 transition hover:-translate-y-0.5 hover:border-[#d5c8b7] hover:bg-white hover:shadow-md"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <span className="rounded-md bg-white px-2 py-1 text-[11px] font-bold uppercase text-teal ring-1 ring-line">
                    {card.badge}
                  </span>
                </span>
                <span>
                  <span className="mt-4 flex items-center justify-between gap-3 text-base font-bold group-hover:text-teal">
                    {card.label}
                    <ArrowRight size={16} aria-hidden="true" />
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-muted">
                    {card.focus}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Link
          href="/paiement"
          className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-bold text-white hover:bg-[#2b2b2b]"
        >
          <CreditCard size={17} aria-hidden="true" />
          Paiement Maxi Trouvaille
        </Link>
        <Link
          href="/suivi-colis"
          className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-bold hover:bg-[#f1eadf]"
        >
          <Truck size={17} aria-hidden="true" />
          Suivi colis
        </Link>
        <Link
          href="/contact"
          className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-bold hover:bg-[#f1eadf]"
        >
          <Headphones size={17} aria-hidden="true" />
          Service client
        </Link>
      </div>
    </section>
  );
}

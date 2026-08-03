import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  CreditCard,
  Headphones,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Truck,
  type LucideIcon,
} from "lucide-react";

type ShowcaseCard = {
  icon: LucideIcon;
  title: string;
  text: string;
  badge: string;
  href: string;
  image: string;
  imageAlt: string;
};

const showcaseCards: ShowcaseCard[] = [
  {
    icon: Sparkles,
    title: "Rayons partenaires",
    text: "Nouveautés, promotions, maison, high-tech et accessoires sont prêts à parcourir sur téléphone.",
    badge: "Vitrine",
    href: "/produits-partenaires",
    image: "/uploads/category-images/produits-partenaires.webp",
    imageAlt: "Rayon produits partenaires Maxi Trouvaille",
  },
  {
    icon: CreditCard,
    title: "Paiement Maxi Trouvaille",
    text: "Le paiement reste centralisé sur Maxi Trouvaille et ne s'ouvre qu'aux articles validés.",
    badge: "Paiement",
    href: "/paiement",
    image: "/uploads/category-images/promotions-partenaires.webp",
    imageAlt: "Rayon promotions partenaires Maxi Trouvaille",
  },
  {
    icon: Truck,
    title: "Suivi et service client",
    text: "Le client garde Maxi Trouvaille comme repère pour le suivi colis et les questions après achat.",
    badge: "Suivi",
    href: "/suivi-colis",
    image: "/uploads/category-images/dropshipping.webp",
    imageAlt: "Parcours produits partenaires avec suivi colis",
  },
];

function displayCount(count: number, label: string) {
  return count > 0 ? `${count} ${label}` : "En préparation";
}

function displayCompactCount(count: number, singular: string, plural: string) {
  if (count <= 0) {
    return "En préparation";
  }

  return `${count} ${count > 1 ? plural : singular}`;
}

export function PartnerMobileShowcasePanel({
  categoryCount,
  partnerCandidateCount,
  publicProductCount,
  className,
}: {
  categoryCount: number;
  partnerCandidateCount: number;
  publicProductCount: number;
  className?: string;
}) {
  const metrics = [
    {
      icon: PackageCheck,
      label: "Fiches candidates",
      value: displayCount(partnerCandidateCount, "fiches"),
    },
    {
      icon: BadgeCheck,
      label: "Rayons",
      value: displayCount(categoryCount, "rayons"),
    },
    {
      icon: ShieldCheck,
      label: "Articles vendables",
      value:
        publicProductCount > 0
          ? `${publicProductCount} validé${publicProductCount > 1 ? "s" : ""}`
          : "Validation en cours",
    },
  ];

  return (
    <section className={["grid gap-6", className].filter(Boolean).join(" ")}>
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold uppercase text-teal">
            <ShieldCheck size={16} aria-hidden="true" />
            Présentation mobile sûre
          </p>
          <h2 className="mt-2 max-w-3xl text-2xl font-black leading-tight sm:text-3xl">
            Une boutique montrable, même quand les fiches restent en validation.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base">
            Maxi Trouvaille montre les univers, le paiement, le suivi colis et
            le service client. Les fiches produit attendent les preuves exactes
            avant toute vente.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
          <Link
            href="/produits-partenaires"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-bold text-white hover:bg-[#2b2b2b]"
          >
            Présenter les rayons
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link
            href="/contact"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-bold hover:bg-[#f1eadf]"
          >
            <Headphones size={17} aria-hidden="true" />
            Service client
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <article
              key={metric.label}
              className="rounded-md border border-line bg-paper p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-teal">{metric.value}</p>
                  <h3 className="mt-1 text-base font-bold">{metric.label}</h3>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                  <Icon size={19} aria-hidden="true" />
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {showcaseCards.map((card, index) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.title}
              href={card.href}
              className="focus-ring group overflow-hidden rounded-md border border-line bg-paper shadow-sm transition hover:-translate-y-0.5 hover:border-[#d5c8b7] hover:shadow-md"
            >
              <div className="relative aspect-[16/9] bg-[#f1eadf]">
                <Image
                  src={card.image}
                  alt={card.imageAlt}
                  fill
                  loading={index === 0 ? "eager" : "lazy"}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
                <span className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-md bg-white/92 text-teal shadow-sm">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span className="absolute bottom-3 left-3 rounded-md bg-white/92 px-2 py-1 text-[11px] font-bold uppercase text-teal shadow-sm">
                  {card.badge}
                </span>
              </div>
              <div className="p-4">
                <h3 className="flex items-center justify-between gap-3 text-base font-bold group-hover:text-teal">
                  {card.title}
                  <ArrowRight size={16} aria-hidden="true" />
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">{card.text}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="rounded-md border border-[#fed7aa] bg-[#fff7ed] p-4 text-sm font-bold leading-6 text-[#9a3412]">
        Aucune fiche produit non validée n&apos;est affichée comme achetable.
        Image exacte, stock, délai, prix, droits image et validation humaine
        restent obligatoires avant la mise en vente.
      </div>
    </section>
  );
}

export function PartnerValidationPromisePanel({
  candidateCount,
  publicProductCount,
  className,
}: {
  candidateCount: number;
  publicProductCount: number;
  className?: string;
}) {
  const steps = [
    {
      icon: PackageCheck,
      title: "Rayons déjà présentables",
      text: "Les univers partenaires restent consultables sur téléphone, même quand les fiches produit patientent.",
      value: "Vitrine active",
    },
    {
      icon: ClipboardCheck,
      title: "Fiches en contrôle",
      text: "Chaque article attend une image exacte, un prix clair, un stock lisible, un délai et des droits image.",
      value: displayCompactCount(candidateCount, "fiche", "fiches"),
    },
    {
      icon: ShieldCheck,
      title: "Zéro fiche non validée",
      text: "Un produit non prouvé reste masqué du parcours d'achat pour éviter les mauvaises surprises.",
      value:
        publicProductCount > 0
          ? `${publicProductCount} visible${publicProductCount > 1 ? "s" : ""}`
          : "Verrou actif",
    },
    {
      icon: CreditCard,
      title: "Parcours client prêt",
      text: "Paiement Maxi Trouvaille, suivi colis et service client restent les repères visibles du client.",
      value: "Maxi Trouvaille",
    },
  ];

  return (
    <section
      className={[
        "grid gap-5 rounded-lg border border-line bg-[#fbfaf7] p-5 shadow-sm sm:p-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold uppercase text-teal">
            <BadgeCheck size={16} aria-hidden="true" />
            Sélection propre
          </p>
          <h2 className="mt-2 max-w-3xl text-2xl font-black leading-tight sm:text-3xl">
            La boutique avance sans afficher de mauvaise fiche.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base">
            Maxi Trouvaille peut montrer ses rayons, ses idées d&apos;articles et son
            parcours client. La vente attend les preuves nécessaires, avec une
            validation humaine avant publication.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
          <Link
            href="/categories/produits-partenaires"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-bold text-white hover:bg-[#2b2b2b]"
          >
            Parcourir les rayons
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link
            href="/paiement"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-bold hover:bg-[#f1eadf]"
          >
            <CreditCard size={17} aria-hidden="true" />
            Paiement
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => {
          const Icon = step.icon;

          return (
            <article
              key={step.title}
              className="rounded-md border border-line bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-md bg-[#eef8f6] px-2 py-1 text-[11px] font-bold uppercase text-teal">
                  {step.value}
                </span>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                  <Icon size={18} aria-hidden="true" />
                </span>
              </div>
              <h3 className="mt-4 text-base font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{step.text}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function PartnerCategoryDemoGuidePanel({
  categoryName,
  candidateCount = 0,
  publicProductCount,
  subcategoryCount = 0,
  className,
}: {
  categoryName: string;
  candidateCount?: number;
  publicProductCount: number;
  subcategoryCount?: number;
  className?: string;
}) {
  const candidateLabel = displayCompactCount(candidateCount, "fiche", "fiches");
  const subcategoryLabel = displayCompactCount(
    subcategoryCount,
    "sous-rayon",
    "sous-rayons",
  );
  const proofItems = [
    "Image exacte",
    "Prix clair",
    "Stock lisible",
    "Délai client",
    "Droits image",
  ];
  const demoSteps = [
    {
      icon: Sparkles,
      title: "Lire le rayon",
      text: `Présenter ${categoryName} comme un rayon déjà structuré, avec idées concrètes et navigation mobile simple.`,
      value: subcategoryLabel,
    },
    {
      icon: ClipboardCheck,
      title: "Montrer la validation",
      text: "Expliquer que les articles passent par une vérification avant publication complète.",
      value: candidateLabel,
    },
    {
      icon: CreditCard,
      title: "Rassurer le client",
      text: "Revenir sur le paiement Maxi Trouvaille, le suivi colis et le service client.",
      value:
        publicProductCount > 0
          ? displayCompactCount(publicProductCount, "validé", "validés")
          : "Achat verrouillé",
    },
  ];

  return (
    <section
      className={[
        "grid gap-5 rounded-lg border border-line bg-[#fbfaf7] p-5 shadow-sm sm:p-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold uppercase text-teal">
            <BadgeCheck size={16} aria-hidden="true" />
            Guide du rayon
          </p>
          <h2 className="mt-2 max-w-3xl text-2xl font-black leading-tight sm:text-3xl">
            {categoryName}: ordre de lecture prêt pour mobile.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base">
            La page garde un discours simple: le rayon existe, les idées
            d&apos;articles sont en validation, et le client retrouve toujours
            paiement Maxi Trouvaille, suivi colis et service client.
          </p>
        </div>
        <div className="rounded-md border border-line bg-white p-4 lg:min-w-64">
          <p className="text-[11px] font-bold uppercase text-muted">
            Mise en vente
          </p>
          <p className="mt-1 text-sm font-bold text-teal">
            {publicProductCount > 0
              ? "Articles validés"
              : "Verrouillée jusqu'à validation"}
          </p>
          <p className="mt-2 text-xs font-bold leading-5 text-muted">
            Aucune fiche non validée n&apos;est poussée dans le parcours
            d&apos;achat.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {demoSteps.map((step) => {
          const Icon = step.icon;

          return (
            <article
              key={step.title}
              className="rounded-md border border-line bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span className="rounded-md bg-[#f6f1e8] px-2 py-1 text-[11px] font-bold uppercase text-teal">
                  {step.value}
                </span>
              </div>
              <h3 className="mt-4 text-base font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{step.text}</p>
            </article>
          );
        })}
      </div>

      <div className="grid gap-4 rounded-md border border-line bg-white p-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold uppercase text-teal">
            <ShieldCheck size={16} aria-hidden="true" />
            Checklist visible
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Les fiches attendent ces preuves avant de devenir achetables.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {proofItems.map((item) => (
            <span
              key={item}
              className="inline-flex min-h-9 items-center rounded-md bg-[#eef8f6] px-3 text-xs font-bold text-teal"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Link
          href="/paiement"
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold hover:bg-[#f1eadf]"
        >
          <CreditCard size={16} aria-hidden="true" />
          Paiement Maxi
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
        <Link
          href="/suivi-colis"
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold hover:bg-[#f1eadf]"
        >
          <Truck size={16} aria-hidden="true" />
          Suivi colis
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
        <Link
          href="/contact"
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold hover:bg-[#f1eadf]"
        >
          <Headphones size={16} aria-hidden="true" />
          Service client
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

export function PartnerCategoryRelayPanel({
  categoryName,
  items,
  className,
}: {
  categoryName: string;
  items: Array<{
    href: string;
    label: string;
    description: string;
    emphasis: string;
  }>;
  className?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      className={[
        "grid gap-5 rounded-lg border border-line bg-paper p-5 shadow-sm sm:p-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold uppercase text-teal">
            <Sparkles size={16} aria-hidden="true" />
            Navigation rayons
          </p>
          <h2 className="mt-2 max-w-3xl text-2xl font-black leading-tight sm:text-3xl">
            Après {categoryName}, continuer vers les rayons utiles.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base">
            Le client peut parcourir plusieurs univers partenaires sans revenir
            en arrière. Chaque lien garde le même cadre: paiement Maxi
            Trouvaille, suivi colis et validation avant mise en vente.
          </p>
        </div>
        <Link
          href="/categories"
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-bold hover:bg-[#f1eadf]"
        >
          Tous les rayons
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="focus-ring group flex min-h-40 flex-col justify-between rounded-md border border-line bg-[#fbfaf7] p-4 transition hover:-translate-y-0.5 hover:border-[#d5c8b7] hover:bg-white hover:shadow-md"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="rounded-md bg-[#eef8f6] px-2 py-1 text-[11px] font-bold uppercase text-teal">
                {item.emphasis}
              </span>
              <ArrowRight
                className="text-teal transition group-hover:translate-x-0.5"
                size={16}
                aria-hidden="true"
              />
            </span>
            <span>
              <span className="mt-4 block text-base font-bold group-hover:text-teal">
                {item.label}
              </span>
              <span className="mt-2 block text-sm leading-6 text-muted">
                {item.description}
              </span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Link
          href="/produits-partenaires"
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold hover:bg-[#f1eadf]"
        >
          Rayons partenaires
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
        <Link
          href="/boutique"
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold hover:bg-[#f1eadf]"
        >
          Boutique
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
        <Link
          href="/contact"
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold hover:bg-[#f1eadf]"
        >
          Service client
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

export function PartnerCategorySafePanel({
  categoryName,
  candidateCount = 0,
  publicProductCount,
  subcategoryCount = 0,
  className,
}: {
  categoryName: string;
  candidateCount?: number;
  publicProductCount: number;
  subcategoryCount?: number;
  className?: string;
}) {
  const candidateLabel = displayCompactCount(candidateCount, "fiche", "fiches");
  const candidateStatusText =
    candidateCount > 0 ? `${candidateLabel} en validation` : "File en préparation";
  const metrics = [
    {
      icon: Sparkles,
      label: "Rayon",
      value: categoryName,
    },
    {
      icon: PackageCheck,
      label: "En contrôle",
      value: candidateLabel,
    },
    {
      icon: ShieldCheck,
      label: "Articles vendables",
      value:
        publicProductCount > 0
          ? `${publicProductCount} validé${publicProductCount > 1 ? "s" : ""}`
          : "Validation en cours",
    },
    {
      icon: BadgeCheck,
      label: "Sous-rayons",
      value: displayCompactCount(subcategoryCount, "sous-rayon", "sous-rayons"),
    },
  ];
  const links = [
    {
      icon: CreditCard,
      href: "/paiement",
      label: "Paiement Maxi",
    },
    {
      icon: Truck,
      href: "/suivi-colis",
      label: "Suivi colis",
    },
    {
      icon: Headphones,
      href: "/contact",
      label: "Service client",
    },
  ];

  return (
    <section
      className={[
        "grid gap-5 border-y border-line bg-paper py-5 lg:grid-cols-[1.25fr_1fr]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div>
        <p className="flex items-center gap-2 text-sm font-bold uppercase text-teal">
          <ShieldCheck size={16} aria-hidden="true" />
          Rayon mobile sécurisé
        </p>
        <h2 className="mt-2 text-xl font-black leading-tight sm:text-2xl">
          {categoryName}: présentable sans fiche non validée.
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Le rayon montre le parcours Maxi Trouvaille, le paiement, le suivi
          colis et le service client. Les articles attendent image exacte,
          prix, stock, délai et validation humaine avant toute vente.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-line bg-white p-3">
            <p className="text-[11px] font-bold uppercase text-muted">
              File locale
            </p>
            <p className="mt-1 text-sm font-bold text-teal">
              {candidateStatusText}
            </p>
          </div>
          <div className="rounded-md border border-line bg-white p-3">
            <p className="text-[11px] font-bold uppercase text-muted">
              Vente
            </p>
            <p className="mt-1 text-sm font-bold text-teal">
              {publicProductCount > 0 ? "Articles validés" : "Achat verrouillé"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <article
                key={metric.label}
                className="rounded-md border border-line bg-white p-3"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase text-muted">
                      {metric.label}
                    </p>
                    <p className="mt-1 truncate text-sm font-bold text-foreground">
                      {metric.value}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {links.map((link) => {
            const Icon = link.icon;

            return (
              <Link
                key={link.href}
                href={link.href}
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-bold hover:bg-[#f1eadf]"
              >
                <Icon size={16} aria-hidden="true" />
                {link.label}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

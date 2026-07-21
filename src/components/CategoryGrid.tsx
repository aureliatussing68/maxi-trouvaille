import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Baby,
  BookOpen,
  BriefcaseBusiness,
  Car,
  Dumbbell,
  Gamepad2,
  Gift,
  Hammer,
  HeartPulse,
  Lamp,
  Leaf,
  Package,
  PackageCheck,
  PackageOpen,
  PawPrint,
  PlugZap,
  Scale,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sofa,
  Sparkles,
  Store,
  WandSparkles,
} from "lucide-react";
import {
  categories,
  dropshippingFocusCategoryIds,
  getTopLevelCategories,
  isDropshippingCategory,
  isPublicCategory,
  mainCategoryIds,
  type Category,
} from "@/lib/catalog";

const surpriseCategoryIds = new Set([
  "colis-surprise-palettes",
  "palettes-destockage",
  "colis-mysteres",
  "colis-au-poids",
  "lots-bonnes-affaires",
  "colis-surprise",
]);

const iconByCategory: Record<string, LucideIcon> = {
  "colis-surprise-palettes": PackageOpen,
  dropshipping: Store,
  "dropshipping-nouveautes": Sparkles,
  "dropshipping-promotions": ShoppingBag,
  "dropshipping-maison": Sofa,
  "dropshipping-cuisine": Sofa,
  "dropshipping-beaute": HeartPulse,
  "dropshipping-high-tech": Smartphone,
  "dropshipping-accessoires": Sparkles,
  "dropshipping-auto-moto": Car,
  "dropshipping-animaux": PawPrint,
  "dropshipping-enfant": Baby,
  "dropshipping-mode": Shirt,
  "dropshipping-outillage": Hammer,
  "dropshipping-gaming": Gamepad2,
  "palettes-destockage": Package,
  "colis-mysteres": Gift,
  "colis-au-poids": Scale,
  "lots-bonnes-affaires": ShoppingBag,
  "espace-revendeur": BriefcaseBusiness,
  "sport-loisirs": Dumbbell,
  "auto-moto": Car,
  animaux: PawPrint,
  "livre-media": BookOpen,
  "jeux-video": Gamepad2,
  puericulture: Baby,
  cuisine: Sofa,
  outillage: Hammer,
  jardin: Leaf,
  "beaute-sante": HeartPulse,
  informatique: Smartphone,
  telephonie: Smartphone,
  "agencement-magasin": Store,
  "mannequins-bustes": Shirt,
  presentoirs: PackageOpen,
  "mobilier-professionnel": Sofa,
  "colis-surprise": PackageOpen,
  vetements: Shirt,
  maison: Sofa,
  deco: Lamp,
  "high-tech": Smartphone,
  accessoires: Sparkles,
  jouets: Gamepad2,
  bricolage: Hammer,
  electricite: PlugZap,
  gadgets: WandSparkles,
  "produits-partenaires": PackageCheck,
};

function getGridColumns(categoryCount: number, compact: boolean) {
  if (categoryCount === 1) {
    return "max-w-md";
  }

  if (categoryCount === 2) {
    return "max-w-4xl sm:grid-cols-2";
  }

  return compact ? "sm:grid-cols-2 lg:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-3";
}

function getImageSizes(compact: boolean) {
  return compact
    ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
    : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";
}

export function CategoryGrid({
  compact = false,
  eagerImageCount,
  featuredOnly = false,
  items,
  variant = "visual",
}: {
  compact?: boolean;
  eagerImageCount?: number;
  featuredOnly?: boolean;
  items?: Category[];
  variant?: "visual" | "simple";
}) {
  const sourceCategories = items ?? (featuredOnly ? categories : getTopLevelCategories());
  const displayedCategories = featuredOnly
    ? dropshippingFocusCategoryIds
        .map((id) => categories.find((category) => category.id === id))
        .filter((category): category is Category => Boolean(category))
    : sourceCategories.filter(isPublicCategory);
  const gridColumns = getGridColumns(displayedCategories.length, compact);
  const imageSizes = getImageSizes(compact);
  const resolvedEagerImageCount = eagerImageCount ?? (featuredOnly ? 2 : 0);

  if (variant === "simple") {
    return (
      <div className={`mx-auto grid w-full gap-3 ${gridColumns}`}>
        {displayedCategories.map((category) => {
          const Icon = iconByCategory[category.id] ?? PackageOpen;
          const isMainCategory = mainCategoryIds.includes(
            category.id as (typeof mainCategoryIds)[number],
          );
          const isPartnerCategory = isDropshippingCategory(category);

          return (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="focus-ring group rounded-lg border border-line bg-paper p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#d5c8b7] hover:shadow-md"
            >
              <span
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-md text-white"
                style={{ backgroundColor: category.accent }}
              >
                <Icon size={21} aria-hidden="true" />
              </span>
              <h2 className="text-base font-black group-hover:text-teal">
                {category.name}
              </h2>
              <span className="mt-2 flex flex-wrap gap-2">
                {isMainCategory ? (
                  <span className="inline-flex w-fit rounded-md bg-[#f6f1e8] px-2 py-1 text-[11px] font-black uppercase text-teal">
                    Rayon principal
                  </span>
                ) : null}
                {isPartnerCategory ? (
                  <span className="inline-flex w-fit rounded-md bg-[#ecfdf5] px-2 py-1 text-[11px] font-black uppercase text-teal">
                    Partenaire
                  </span>
                ) : null}
              </span>
              <p className="mt-2 text-sm leading-6 text-muted">
                {category.description}
              </p>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`mx-auto grid w-full gap-4 ${gridColumns}`}>
      {displayedCategories.map((category, index) => {
        const isMainCategory = mainCategoryIds.includes(
          category.id as (typeof mainCategoryIds)[number],
        );
        const isPartnerCategory = isDropshippingCategory(category);
        const isNewDropshipping = category.id === "dropshipping-nouveautes";
        const isPromotionDropshipping = category.id === "dropshipping-promotions";
        const isSurpriseCategory = surpriseCategoryIds.has(category.id);

        return (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="focus-ring group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-paper shadow-sm transition hover:-translate-y-0.5 hover:border-[#d5c8b7] hover:shadow-md"
          >
            <span className="relative block aspect-[16/10] overflow-hidden bg-[#f6f1e8]">
              <Image
                src={category.image}
                alt={`Rayon ${category.name}`}
                fill
                loading={index < resolvedEagerImageCount ? "eager" : "lazy"}
                quality={75}
                sizes={imageSizes}
                className="object-cover transition duration-500 group-hover:scale-[1.04]"
              />
              <span
                className="absolute left-3 top-3 h-2.5 w-12 rounded-full shadow-sm ring-1 ring-white/70"
                style={{ backgroundColor: category.accent }}
                aria-hidden="true"
              />
            </span>
            <span className="flex flex-1 flex-col p-4">
              <span className="text-base font-black group-hover:text-teal">
                {category.name}
              </span>
              <span className="mt-3 flex flex-wrap gap-2">
                {isMainCategory ? (
                  <span className="inline-flex w-fit rounded-md bg-[#f6f1e8] px-2 py-1 text-[11px] font-black uppercase text-teal">
                    Rayon principal
                  </span>
                ) : null}
                {isPartnerCategory ? (
                  <span className="inline-flex w-fit rounded-md bg-[#ecfdf5] px-2 py-1 text-[11px] font-black uppercase text-teal">
                    Partenaire
                  </span>
                ) : null}
                {isNewDropshipping ? (
                  <span className="inline-flex w-fit rounded-md bg-[#eff6ff] px-2 py-1 text-[11px] font-black uppercase text-[#2563eb]">
                    Nouveauté
                  </span>
                ) : null}
                {isPromotionDropshipping ? (
                  <span className="inline-flex w-fit rounded-md bg-[#fff1f2] px-2 py-1 text-[11px] font-black uppercase text-rose">
                    Promotion
                  </span>
                ) : null}
                {isSurpriseCategory ? (
                  <span className="inline-flex w-fit rounded-md bg-[#fffbeb] px-2 py-1 text-[11px] font-black uppercase text-[#b45309]">
                    À venir
                  </span>
                ) : null}
              </span>
              <span className="mt-2 text-sm leading-6 text-muted">
                {category.description}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

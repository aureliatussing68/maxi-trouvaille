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
import { categories, mainCategoryIds } from "@/lib/catalog";

const iconByCategory: Record<string, LucideIcon> = {
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
};

export function CategoryGrid({
  compact = false,
  featuredOnly = false,
}: {
  compact?: boolean;
  featuredOnly?: boolean;
}) {
  const displayedCategories = featuredOnly
    ? categories.filter((category) =>
        mainCategoryIds.includes(category.id as (typeof mainCategoryIds)[number]),
      )
    : categories;

  return (
    <div
      className={`grid gap-3 ${
        compact ? "sm:grid-cols-2 lg:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-3"
      }`}
    >
      {displayedCategories.map((category) => {
        const Icon = iconByCategory[category.id] ?? PackageOpen;
        const isMainCategory = mainCategoryIds.includes(
          category.id as (typeof mainCategoryIds)[number],
        );

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
            {isMainCategory ? (
              <span className="mt-2 inline-flex w-fit rounded-md bg-[#f6f1e8] px-2 py-1 text-[11px] font-black uppercase text-teal">
                Rayon principal
              </span>
            ) : null}
            <p className="mt-2 text-sm leading-6 text-muted">{category.description}</p>
          </Link>
        );
      })}
    </div>
  );
}

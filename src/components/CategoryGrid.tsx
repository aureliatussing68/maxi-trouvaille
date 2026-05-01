import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Baby,
  BookOpen,
  Car,
  Dumbbell,
  Gamepad2,
  Hammer,
  HeartPulse,
  Lamp,
  Leaf,
  PackageOpen,
  PawPrint,
  PlugZap,
  Shirt,
  Smartphone,
  Sofa,
  Sparkles,
  Store,
  WandSparkles,
} from "lucide-react";
import { categories } from "@/lib/catalog";

const iconByCategory: Record<string, LucideIcon> = {
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

export function CategoryGrid({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`grid gap-3 ${
        compact ? "sm:grid-cols-2 lg:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-3"
      }`}
    >
      {categories.map((category) => {
        const Icon = iconByCategory[category.id] ?? PackageOpen;

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
            <p className="mt-2 text-sm leading-6 text-muted">{category.description}</p>
          </Link>
        );
      })}
    </div>
  );
}

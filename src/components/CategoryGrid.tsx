import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
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
  getTopLevelCategories,
  homeShowcaseCategoryIds,
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

  // 2 colonnes des le telephone en mode compact. En 1 colonne, une tuile faisait
  // ~365 px de haut : on ne voyait qu'un rayon et demi a l'ecran, d'ou
  // l'impression qu'il n'y avait presque rien. En 2 colonnes on en voit 6 d'un
  // coup et la section passe de ~5 100 px a ~800 px de haut.
  return compact
    ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
    : "sm:grid-cols-2 lg:grid-cols-3";
}

function getImageSizes(compact: boolean) {
  return compact
    ? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
    : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";
}

/**
 * Tuile ajoutee EN DERNIER, apres les rayons. Deux roles :
 *  - donner une sortie claire ("et tout le reste, c'est par ici") ;
 *  - completer la derniere ligne. Avec 11 rayons sur 2 colonnes de telephone,
 *    la derniere ligne n'avait qu'une tuile et un trou blanc a cote. 12 tuiles
 *    tombent juste sur 2, 3 et 4 colonnes.
 * Volontairement SANS photo (aplat sombre + fleche) : elle ne doit pas se faire
 * passer pour un douzieme rayon.
 */
export type CategoryGridTrailingTile = {
  href: string;
  label: string;
  hint?: string;
};

export function CategoryGrid({
  compact = false,
  eagerImageCount,
  featuredOnly = false,
  items,
  productCountByCategoryId,
  trailingTile,
  variant = "visual",
}: {
  compact?: boolean;
  eagerImageCount?: number;
  featuredOnly?: boolean;
  items?: Category[];
  productCountByCategoryId?: Record<string, number>;
  trailingTile?: CategoryGridTrailingTile;
  variant?: "visual" | "simple";
}) {
  const sourceCategories = items ?? (featuredOnly ? categories : getTopLevelCategories());
  const displayedCategories = featuredOnly
    ? homeShowcaseCategoryIds
        .map((id) => categories.find((category) => category.id === id))
        .filter((category): category is Category => Boolean(category))
    : sourceCategories.filter(isPublicCategory);
  const showTrailingTile = variant === "visual" && Boolean(trailingTile);
  const gridColumns = getGridColumns(
    displayedCategories.length + (showTrailingTile ? 1 : 0),
    compact,
  );
  const imageSizes = getImageSizes(compact);
  // La vitrine des rayons est sous la ligne de flottaison sur les deux pages qui
  // l'utilisent (accueil et bas de boutique) : rien a charger en priorite.
  const resolvedEagerImageCount = eagerImageCount ?? 0;

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
              <h2 className="text-base font-bold group-hover:text-teal">
                {category.name}
              </h2>
              <span className="mt-2 flex flex-wrap gap-2">
                {isMainCategory ? (
                  <span className="inline-flex w-fit rounded-md bg-[#f6f1e8] px-2 py-1 text-[11px] font-bold uppercase text-teal">
                    Rayon principal
                  </span>
                ) : null}
                {isPartnerCategory ? (
                  <span className="inline-flex w-fit rounded-md bg-[#ecfdf5] px-2 py-1 text-[11px] font-bold uppercase text-teal">
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
    <div
      className={`mx-auto grid w-full ${compact ? "gap-3 sm:gap-4" : "gap-4"} ${gridColumns}`}
    >
      {displayedCategories.map((category, index) => {
        const isMainCategory = mainCategoryIds.includes(
          category.id as (typeof mainCategoryIds)[number],
        );
        const isPartnerCategory = isDropshippingCategory(category);
        const isNewDropshipping = category.id === "dropshipping-nouveautes";
        const isPromotionDropshipping = category.id === "dropshipping-promotions";
        const isSurpriseCategory = surpriseCategoryIds.has(category.id);
        const productCount = productCountByCategoryId?.[category.id];

        return (
          <Link
            key={category.id}
            href={`/categories/${category.slug}`}
            className="focus-ring group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-paper shadow-sm transition hover:-translate-y-0.5 hover:border-[#d5c8b7] hover:shadow-md"
          >
            {/* aspect-* fige la hauteur de la vignette avant l'arrivee de
                l'image : aucune section ne saute au chargement. */}
            <span
              className={`relative block overflow-hidden bg-[#f6f1e8] ${
                compact ? "aspect-[4/3]" : "aspect-[16/10]"
              }`}
            >
              <Image
                src={category.image}
                alt={`Rayon ${category.name}`}
                fill
                loading={index < resolvedEagerImageCount ? "eager" : "lazy"}
                quality={75}
                sizes={imageSizes}
                className="object-cover transition duration-500 group-hover:scale-[1.04]"
              />
              {/* Pastille de couleur du rayon : retiree en compact. Sur les
                  petites tuiles de telephone, ce trait de couleur vide se
                  lisait comme un badge dont le texte manquait. */}
              {compact ? null : (
                <span
                  className="absolute left-3 top-3 h-2.5 w-12 rounded-full shadow-sm ring-1 ring-white/70"
                  style={{ backgroundColor: category.accent }}
                  aria-hidden="true"
                />
              )}
            </span>
            {/* En compact : le nom du rayon, rien d'autre. Sur deux colonnes de
                telephone, la description passait a 4 ou 5 lignes pour ne rien
                apprendre ("Cuisine" se comprend tout seul), et le badge
                "Partenaire" etait identique sur les 11 tuiles. */}
            <span
              className={
                compact
                  ? "flex flex-1 flex-col justify-center px-3 py-2.5"
                  : "flex flex-1 flex-col p-4"
              }
            >
              <span
                className={`font-black group-hover:text-teal ${
                  compact ? "text-sm leading-5" : "text-base"
                }`}
              >
                {category.name}
              </span>
              {/* Nombre reel de produits du rayon, calcule a l'affichage a
                  partir du catalogue : c'est exactement ce que le client
                  comptera en ouvrant le rayon. Aucun chiffre en dur. */}
              {productCount === undefined ? null : (
                <span
                  className={`font-bold text-muted ${
                    compact ? "mt-0.5 text-[11px] leading-4" : "mt-1 text-xs"
                  }`}
                >
                  {productCount} produit{productCount > 1 ? "s" : ""}
                </span>
              )}
              {compact ? null : (
              <span className="mt-3 flex flex-wrap gap-2">
                {isMainCategory ? (
                  <span className="inline-flex w-fit rounded-md bg-[#f6f1e8] px-2 py-1 text-[11px] font-bold uppercase text-teal">
                    Rayon principal
                  </span>
                ) : null}
                {isPartnerCategory ? (
                  <span className="inline-flex w-fit rounded-md bg-[#ecfdf5] px-2 py-1 text-[11px] font-bold uppercase text-teal">
                    Partenaire
                  </span>
                ) : null}
                {isNewDropshipping ? (
                  <span className="inline-flex w-fit rounded-md bg-[#eff6ff] px-2 py-1 text-[11px] font-bold uppercase text-[#2563eb]">
                    Nouveauté
                  </span>
                ) : null}
                {isPromotionDropshipping ? (
                  <span className="inline-flex w-fit rounded-md bg-[#fff1f2] px-2 py-1 text-[11px] font-bold uppercase text-rose">
                    Promotion
                  </span>
                ) : null}
                {isSurpriseCategory ? (
                  <span className="inline-flex w-fit rounded-md bg-[#fffbeb] px-2 py-1 text-[11px] font-bold uppercase text-[#b45309]">
                    À venir
                  </span>
                ) : null}
              </span>
              )}
              {compact ? null : (
                <span className="mt-2 text-sm leading-6 text-muted">
                  {category.description}
                </span>
              )}
            </span>
          </Link>
        );
      })}
      {showTrailingTile && trailingTile ? (
        <Link
          href={trailingTile.href}
          className="focus-ring group flex h-full flex-col overflow-hidden rounded-lg border border-foreground bg-foreground text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <span
            className={`flex items-center justify-center ${
              compact ? "aspect-[4/3]" : "aspect-[16/10]"
            }`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-foreground transition group-hover:scale-110">
              <ArrowRight size={22} aria-hidden="true" />
            </span>
          </span>
          <span
            className={
              compact
                ? "flex flex-1 flex-col justify-center px-3 py-2.5"
                : "flex flex-1 flex-col p-4"
            }
          >
            <span
              className={`font-black ${compact ? "text-sm leading-5" : "text-base"}`}
            >
              {trailingTile.label}
            </span>
            {trailingTile.hint ? (
              <span
                className={`font-bold text-white/70 ${
                  compact ? "mt-0.5 text-[11px] leading-4" : "mt-1 text-xs"
                }`}
              >
                {trailingTile.hint}
              </span>
            ) : null}
          </span>
        </Link>
      ) : null}
    </div>
  );
}

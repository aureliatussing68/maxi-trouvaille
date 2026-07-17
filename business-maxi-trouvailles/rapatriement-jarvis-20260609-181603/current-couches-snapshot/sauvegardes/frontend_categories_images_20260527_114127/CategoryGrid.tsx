import Image from "next/image";
import Link from "next/link";
import {
  categories,
  getTopLevelCategories,
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
  featuredOnly = false,
  items,
}: {
  compact?: boolean;
  featuredOnly?: boolean;
  items?: Category[];
}) {
  const sourceCategories = items ?? (featuredOnly ? categories : getTopLevelCategories());
  const displayedCategories = featuredOnly
    ? categories.filter((category) =>
        mainCategoryIds.includes(category.id as (typeof mainCategoryIds)[number]),
      )
    : sourceCategories;
  const gridColumns = getGridColumns(displayedCategories.length, compact);
  const imageSizes = getImageSizes(compact);

  return (
    <div className={`mx-auto grid w-full gap-4 ${gridColumns}`}>
      {displayedCategories.map((category, index) => {
        const isMainCategory = mainCategoryIds.includes(
          category.id as (typeof mainCategoryIds)[number],
        );
        const isDropshippingCategory =
          category.id === "dropshipping" || category.parentId === "dropshipping";
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
                priority={featuredOnly && index < 2}
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
                {isDropshippingCategory ? (
                  <span className="inline-flex w-fit rounded-md bg-[#ecfdf5] px-2 py-1 text-[11px] font-black uppercase text-teal">
                    Dropshipping
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

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpDown,
  BadgePercent,
  Headphones,
  House,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import {
  getClientCategoryNameById,
  isClientDropshippingProduct,
  isClientNewProduct,
  isClientProductPurchasable,
  isClientPromotionProduct,
  type Product,
} from "@/lib/catalog-client";
import type { ProductReviewSummary } from "@/lib/product-reviews";
import type { ProductStats } from "@/lib/product-stats";

type HighlightFilter = "all" | "available" | "partner" | "new" | "promotion";
type SortKey = "recommended" | "price-asc" | "price-desc" | "name";

const highlightFilters: Array<{ id: HighlightFilter; label: string }> = [
  { id: "all", label: "Tout" },
  { id: "available", label: "Disponible" },
  { id: "partner", label: "Partenaires" },
  { id: "new", label: "Nouveautés" },
  { id: "promotion", label: "Promos" },
];

const emptyStateCategoryLinks = [
  {
    href: "/nouveautes",
    icon: Sparkles,
    label: "Nouveautés",
    badge: "Arrivages",
    text: "Les derniers produits ajoutés à la boutique.",
  },
  {
    href: "/promotions",
    icon: BadgePercent,
    label: "Promotions",
    badge: "Bons plans",
    text: "Les prix barrés et bonnes affaires du moment.",
  },
  {
    href: "/categories/maison-partenaires",
    icon: House,
    label: "Maison",
    badge: "Rayon",
    text: "Objets utiles pour la maison, le rangement et le confort.",
  },
  {
    href: "/categories/high-tech-partenaires",
    icon: ShieldCheck,
    label: "High-tech",
    badge: "Rayon",
    text: "Accessoires connectés, charge, audio et gadgets utiles.",
  },
];

const controlledLaunchCards = [
  {
    icon: ShieldCheck,
    value: "Sélection en cours",
    title: "Produits vérifiés",
    text: "Chaque fiche est relue et vérifiée par notre équipe avant d'être mise en vente.",
  },
  {
    icon: Sparkles,
    value: "Rayons actifs",
    title: "Univers clairs",
    text: "Maison, cuisine, high-tech, animaux, enfant... tout est classé pour trouver vite.",
  },
  {
    icon: Truck,
    value: "Suivi centralisé",
    title: "Un seul interlocuteur",
    text: "Paiement, suivi colis et service client : tout se gère sur Maxi Trouvaille.",
  },
];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getProductScore(product: Product) {
  return [
    isClientProductPurchasable(product) ? 100 : 0,
    isClientPromotionProduct(product) ? 20 : 0,
    isClientNewProduct(product) ? 15 : 0,
    isClientDropshippingProduct(product) ? 10 : 0,
    Math.min(product.stock, 20),
  ].reduce((total, score) => total + score, 0);
}

function matchesHighlight(product: Product, filter: HighlightFilter) {
  switch (filter) {
    case "available":
      return isClientProductPurchasable(product);
    case "partner":
      return isClientDropshippingProduct(product);
    case "new":
      return isClientNewProduct(product);
    case "promotion":
      return isClientPromotionProduct(product);
    case "all":
    default:
      return true;
  }
}

function sortProducts(products: Product[], sortKey: SortKey) {
  return [...products].sort((a, b) => {
    if (sortKey === "price-asc") {
      return a.price - b.price;
    }

    if (sortKey === "price-desc") {
      return b.price - a.price;
    }

    if (sortKey === "name") {
      return a.name.localeCompare(b.name, "fr");
    }

    return getProductScore(b) - getProductScore(a) || a.name.localeCompare(b.name, "fr");
  });
}

export function ShopProductExplorer({
  products,
  candidateCount = 0,
  statsByProductId,
  reviewSummaryByProductId,
  showAdminControls,
  initialQuery = "",
}: {
  products: Product[];
  candidateCount?: number;
  statsByProductId: Record<string, ProductStats>;
  reviewSummaryByProductId: Record<string, ProductReviewSummary>;
  showAdminControls: boolean;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [categoryId, setCategoryId] = useState("all");
  const [highlight, setHighlight] = useState<HighlightFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("recommended");

  const categoryOptions = useMemo(() => {
    const categoryMap = new Map<string, string>();

    products.forEach((product) => {
      const categoryName = getClientCategoryNameById(product.categoryId);
      if (categoryName) {
        categoryMap.set(product.categoryId, categoryName);
      }
    });

    return [...categoryMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [products]);

  const visibleProducts = useMemo(() => {
    const cleanQuery = normalizeText(query.trim());

    const filteredProducts = products.filter((product) => {
      const categoryName = getClientCategoryNameById(product.categoryId);
      const searchable = normalizeText(
        [
          product.name,
          product.shortDescription,
          product.description,
          categoryName ?? "",
          product.features.join(" "),
        ].join(" "),
      );

      return (
        (categoryId === "all" || product.categoryId === categoryId) &&
        matchesHighlight(product, highlight) &&
        (!cleanQuery || searchable.includes(cleanQuery))
      );
    });

    return sortProducts(filteredProducts, sortKey);
  }, [categoryId, highlight, products, query, sortKey]);

  const activeFilterCount =
    (query.trim() ? 1 : 0) +
    (categoryId !== "all" ? 1 : 0) +
    (highlight !== "all" ? 1 : 0) +
    (sortKey !== "recommended" ? 1 : 0);

  function resetFilters() {
    setQuery("");
    setCategoryId("all");
    setHighlight("all");
    setSortKey("recommended");
  }

  if (products.length === 0) {
    return <NoPublicProductsShowcase candidateCount={candidateCount} />;
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-line bg-paper p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(240px,1fr)_220px_220px] lg:items-end">
          <label className="grid gap-2">
            <span className="flex items-center gap-2 text-sm font-black text-foreground">
              <Search size={16} aria-hidden="true" />
              Recherche
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Produit, rayon, usage..."
              className="min-h-11 rounded-md border border-line bg-white px-3 text-sm font-semibold outline-none transition focus:border-teal focus:ring-2 focus:ring-[#bfe7df]"
            />
          </label>

          <label className="grid gap-2">
            <span className="flex items-center gap-2 text-sm font-black text-foreground">
              <SlidersHorizontal size={16} aria-hidden="true" />
              Rayon
            </span>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="min-h-11 rounded-md border border-line bg-white px-3 text-sm font-semibold outline-none transition focus:border-teal focus:ring-2 focus:ring-[#bfe7df]"
            >
              <option value="all">Tous les rayons</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="flex items-center gap-2 text-sm font-black text-foreground">
              <ArrowUpDown size={16} aria-hidden="true" />
              Tri
            </span>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="min-h-11 rounded-md border border-line bg-white px-3 text-sm font-semibold outline-none transition focus:border-teal focus:ring-2 focus:ring-[#bfe7df]"
            >
              <option value="recommended">Recommandés</option>
              <option value="price-asc">Prix croissant</option>
              <option value="price-desc">Prix décroissant</option>
              <option value="name">Nom A-Z</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {highlightFilters.map((filter) => {
              const isActive = filter.id === highlight;

              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setHighlight(filter.id)}
                  className={`focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-black transition ${
                    isActive
                      ? "border-teal bg-[#eef8f6] text-teal"
                      : "border-line bg-white text-muted hover:text-foreground"
                  }`}
                >
                  {filter.id === "new" ? <Sparkles size={15} aria-hidden="true" /> : null}
                  {filter.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-muted">
              {visibleProducts.length} produit{visibleProducts.length > 1 ? "s" : ""}
            </span>
            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={resetFilters}
                className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-black hover:bg-[#f1eadf]"
              >
                <X size={15} aria-hidden="true" />
                Réinitialiser
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {visibleProducts.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              stats={statsByProductId[product.id]}
              reviewSummary={reviewSummaryByProductId[product.id]}
              showAdminControls={showAdminControls}
            />
          ))}
        </div>
      ) : (
        <section className="grid gap-6 border-y border-line bg-[#faf7f0] py-8">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <p className="inline-flex items-center gap-2 rounded-md bg-[#eef8f6] px-3 py-2 text-sm font-black text-teal">
              <ShieldCheck size={16} aria-hidden="true" />
              Aucun résultat
            </p>
            <h2 className="mt-4 text-2xl font-black">
              Aucun produit ne correspond à votre recherche
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted">
              Essayez un autre mot-clé ou explorez les rayons ci-dessous : de
              nouveaux produits sont ajoutés régulièrement.
            </p>
          </div>

          <div className="grid gap-3 px-4 sm:grid-cols-2 lg:grid-cols-4">
            {emptyStateCategoryLinks.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="focus-ring group flex min-h-44 flex-col justify-between rounded-lg border border-line bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#d5c8b7] hover:shadow-md"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    <span className="rounded-md bg-[#f6f1e8] px-2 py-1 text-[11px] font-black uppercase text-teal">
                      {item.badge}
                    </span>
                  </span>
                  <span>
                    <span className="mt-4 flex items-center justify-between gap-3 text-base font-black group-hover:text-teal">
                      {item.label}
                      <ArrowRight size={16} aria-hidden="true" />
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-muted">
                      {item.text}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="grid gap-3 px-4 md:grid-cols-3">
            <Link
              href="/paiement"
              className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
            >
              <BadgePercent size={17} aria-hidden="true" />
              Paiement Maxi Trouvaille
            </Link>
            <Link
              href="/suivi-colis"
              className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-black hover:bg-[#f1eadf]"
            >
              <Truck size={17} aria-hidden="true" />
              Suivi colis
            </Link>
            <Link
              href="/contact"
              className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-black hover:bg-[#f1eadf]"
            >
              <Headphones size={17} aria-hidden="true" />
              Service client
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function NoPublicProductsShowcase({ candidateCount }: { candidateCount: number }) {
  const candidateText =
    candidateCount > 0
      ? `${candidateCount} produits en préparation`
      : "Produits en préparation";

  return (
    <section className="grid gap-7 border-y border-line bg-[#faf7f0] py-8">
      <div className="grid gap-5 px-4 lg:grid-cols-[1fr_0.8fr] lg:items-end">
        <div>
          <p className="inline-flex items-center gap-2 rounded-md bg-[#eef8f6] px-3 py-2 text-sm font-black uppercase text-teal">
            <ShieldCheck size={16} aria-hidden="true" />
            Bientôt disponible
          </p>
          <h2 className="mt-4 max-w-3xl text-2xl font-black leading-tight sm:text-3xl">
            De nouveaux produits arrivent très bientôt.
          </h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-muted">
            Notre équipe prépare la prochaine sélection de trouvailles :
            chaque produit est vérifié avant sa mise en vente. Revenez vite,
            ou explorez les rayons ci-dessous.
          </p>
        </div>
        <div className="rounded-md border border-line bg-white p-4">
          <p className="text-sm font-black uppercase text-teal">
            En coulisses
          </p>
          <p className="mt-2 text-3xl font-black">{candidateText}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Nous privilégions des produits utiles, faciles à comprendre et
            livrés avec un suivi.
          </p>
        </div>
      </div>

      <div className="grid gap-3 px-4 md:grid-cols-3">
        {controlledLaunchCards.map((card) => {
          const Icon = card.icon;

          return (
            <article
              key={card.title}
              className="rounded-md border border-line bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-teal">{card.value}</p>
                  <h3 className="mt-1 text-base font-black">{card.title}</h3>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                  <Icon size={19} aria-hidden="true" />
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">{card.text}</p>
            </article>
          );
        })}
      </div>

      <div className="grid gap-3 px-4 sm:grid-cols-2 lg:grid-cols-4">
        {emptyStateCategoryLinks.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="focus-ring group flex min-h-44 flex-col justify-between rounded-md border border-line bg-white p-4 text-left transition hover:border-[#d5c8b7] hover:bg-[#fbfaf7]"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span className="rounded-md bg-[#f6f1e8] px-2 py-1 text-[11px] font-black uppercase text-teal">
                  {item.badge}
                </span>
              </span>
              <span>
                <span className="mt-4 flex items-center justify-between gap-3 text-base font-black group-hover:text-teal">
                  {item.label}
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
                <span className="mt-2 block text-sm leading-6 text-muted">
                  {item.text}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3 px-4 md:grid-cols-3">
        <Link
          href="/paiement"
          className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
        >
          <BadgePercent size={17} aria-hidden="true" />
          Paiement Maxi Trouvaille
        </Link>
        <Link
          href="/suivi-colis"
          className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-black hover:bg-[#f1eadf]"
        >
          <Truck size={17} aria-hidden="true" />
          Suivi colis
        </Link>
        <Link
          href="/contact"
          className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-black hover:bg-[#f1eadf]"
        >
          <Headphones size={17} aria-hidden="true" />
          Service client
        </Link>
      </div>
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
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
  statsByProductId,
  reviewSummaryByProductId,
  showAdminControls,
}: {
  products: Product[];
  statsByProductId: Record<string, ProductStats>;
  reviewSummaryByProductId: Record<string, ProductReviewSummary>;
  showAdminControls: boolean;
}) {
  const [query, setQuery] = useState("");
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
        <div className="rounded-lg border border-dashed border-line bg-[#faf7f0] p-8 text-center">
          <p className="text-lg font-black">Produits partenaires en validation</p>
          <p className="mt-2 text-sm font-semibold text-muted">
            Les fiches restent hors vente tant que le partenaire, le stock, le
            délai et les images exactes ne sont pas validés.
          </p>
        </div>
      )}
    </div>
  );
}

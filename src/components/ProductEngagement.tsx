"use client";

import { Eye, Heart, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ProductStats } from "@/lib/product-stats";

const visitorStorageKey = "maxi-trouvaille-visitor-v1";
const favoritesStorageKey = "maxi-trouvaille-favorites-v1";

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count > 1 ? plural : singular}`;
}

function getStoredFavorites() {
  try {
    const stored = window.localStorage.getItem(favoritesStorageKey);
    const parsed = stored ? JSON.parse(stored) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter(String) : []);
  } catch {
    return new Set<string>();
  }
}

function writeStoredFavorites(favorites: Set<string>) {
  window.localStorage.setItem(
    favoritesStorageKey,
    JSON.stringify([...favorites]),
  );
}

function getOrCreateVisitorId() {
  try {
    const stored = window.localStorage.getItem(visitorStorageKey);
    if (stored) {
      return stored;
    }

    const visitorId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `visitor_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(visitorStorageKey, visitorId);
    return visitorId;
  } catch {
    return `visitor_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

export function ProductStatsBadges({
  stats,
  className = "",
}: {
  stats?: ProductStats;
  className?: string;
}) {
  const safeStats = stats ?? { views: 0, favorites: 0 };

  return (
    <div className={`flex flex-wrap items-center gap-3 text-xs font-bold text-muted ${className}`}>
      <span className="inline-flex items-center gap-1.5">
        <Eye size={14} aria-hidden="true" />
        {formatCount(safeStats.views, "vue", "vues")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Heart size={14} aria-hidden="true" />
        {formatCount(safeStats.favorites, "favori", "favoris")}
      </span>
    </div>
  );
}

export function ProductEngagement({
  productId,
  initialStats,
}: {
  productId: string;
  initialStats: ProductStats;
}) {
  const [stats, setStats] = useState(initialStats);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoadingFavorite, setIsLoadingFavorite] = useState(false);
  const viewRequestStarted = useRef(false);

  useEffect(() => {
    const favoriteTimer = window.setTimeout(() => {
      const favorites = getStoredFavorites();
      setIsFavorited(favorites.has(productId));
    }, 0);

    if (viewRequestStarted.current) {
      window.clearTimeout(favoriteTimer);
      return;
    }

    viewRequestStarted.current = true;
    const visitorId = getOrCreateVisitorId();

    fetch(`/api/products/${encodeURIComponent(productId)}/stats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ visitorId }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { stats?: ProductStats } | null) => {
        if (data?.stats) {
          setStats(data.stats);
        }
      })
      .catch(() => {
        setStats((currentStats) => currentStats);
      });

    return () => window.clearTimeout(favoriteTimer);
  }, [productId]);

  async function toggleFavorite() {
    const visitorId = getOrCreateVisitorId();
    const nextFavorite = !isFavorited;
    setIsLoadingFavorite(true);

    try {
      const response = await fetch(
        `/api/products/${encodeURIComponent(productId)}/favorite`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            visitorId,
            favorite: nextFavorite,
          }),
        },
      );
      const data = (await response.json()) as {
        favorited?: boolean;
        stats?: ProductStats;
      };

      if (!response.ok) {
        throw new Error("Favori impossible.");
      }

      const favorites = getStoredFavorites();
      const favorited = data.favorited ?? nextFavorite;

      if (favorited) {
        favorites.add(productId);
      } else {
        favorites.delete(productId);
      }

      writeStoredFavorites(favorites);
      setIsFavorited(favorited);

      if (data.stats) {
        setStats(data.stats);
      }
    } catch {
      setIsFavorited((current) => current);
    } finally {
      setIsLoadingFavorite(false);
    }
  }

  return (
    <div className="mt-5 grid gap-3 rounded-lg border border-line bg-[#fbfaf7] p-4">
      <ProductStatsBadges stats={stats} className="text-sm" />
      <button
        type="button"
        onClick={toggleFavorite}
        disabled={isLoadingFavorite}
        className={`focus-ring inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-md border px-4 text-sm font-black ${
          isFavorited
            ? "border-rose bg-[#fff1f2] text-rose hover:bg-[#ffe4e6]"
            : "border-line bg-paper text-foreground hover:bg-[#f1eadf]"
        } disabled:cursor-not-allowed disabled:opacity-65`}
      >
        {isLoadingFavorite ? (
          <Loader2 className="animate-spin" size={17} aria-hidden="true" />
        ) : (
          <Heart
            size={17}
            aria-hidden="true"
            fill={isFavorited ? "currentColor" : "none"}
          />
        )}
        {isFavorited ? "Retirer des favoris" : "Ajouter aux favoris"}
      </button>
    </div>
  );
}

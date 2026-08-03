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

/**
 * Seuils d'affichage des compteurs.
 *
 * "2 vues" ou "1 favori", c'est de la preuve sociale A L'ENVERS : ca dit au
 * client "personne ne vient ici". Un compteur n'aide que quand le nombre est
 * assez grand pour signifier quelque chose. En dessous, on n'affiche rien —
 * on n'invente evidemment aucun chiffre pour combler.
 */
const MIN_VIEWS_TO_DISPLAY = 50;
const MIN_FAVORITES_TO_DISPLAY = 5;

export function ProductStatsBadges({
  stats,
  className = "",
}: {
  stats?: ProductStats;
  className?: string;
}) {
  const safeStats = stats ?? { views: 0, favorites: 0 };
  const showViews = safeStats.views >= MIN_VIEWS_TO_DISPLAY;
  const showFavorites = safeStats.favorites >= MIN_FAVORITES_TO_DISPLAY;

  if (!showViews && !showFavorites) {
    return null;
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 text-xs font-bold text-muted ${className}`}>
      {showViews ? (
        <span className="inline-flex items-center gap-1.5">
          <Eye size={14} aria-hidden="true" />
          {formatCount(safeStats.views, "vue", "vues")}
        </span>
      ) : null}
      {showFavorites ? (
        <span className="inline-flex items-center gap-1.5">
          <Heart size={14} aria-hidden="true" />
          {formatCount(safeStats.favorites, "favori", "favoris")}
        </span>
      ) : null}
    </div>
  );
}

export function ProductEngagement({
  productId,
}: {
  productId: string;
  /** Conserve pour compatibilite : plus rien n'est affiche a partir de la. */
  initialStats?: ProductStats;
}) {
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

    // Le compteur de vues continue d'etre alimente cote serveur : il servira
    // le jour ou les nombres seront assez grands pour vouloir dire quelque
    // chose. Simplement, plus rien n'est affiche au client en attendant.
    fetch(`/api/products/${encodeURIComponent(productId)}/stats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ visitorId }),
    }).catch(() => {
      // Un compteur de vues indisponible ne doit rien casser sur la fiche.
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
    } catch {
      setIsFavorited((current) => current);
    } finally {
      setIsLoadingFavorite(false);
    }
  }

  // Un simple coeur a cote du titre. En bouton pleine largeur avec son
  // libelle, il prenait la place d'une vraie action commerciale pour une
  // fonction dont personne n'a besoin sur une boutique sans compte.
  return (
    <button
      type="button"
      onClick={toggleFavorite}
      disabled={isLoadingFavorite}
      aria-pressed={isFavorited}
      title={isFavorited ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={`focus-ring inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border transition ${
        isFavorited
          ? "border-rose bg-[#fff1f2] text-rose hover:bg-[#ffe4e6]"
          : "border-line bg-paper text-muted hover:bg-[#f1eadf] hover:text-foreground"
      } disabled:cursor-not-allowed disabled:opacity-65`}
    >
      <span className="sr-only">
        {isFavorited ? "Retirer des favoris" : "Ajouter aux favoris"}
      </span>
      {isLoadingFavorite ? (
        <Loader2 className="animate-spin" size={18} aria-hidden="true" />
      ) : (
        <Heart
          size={18}
          aria-hidden="true"
          fill={isFavorited ? "currentColor" : "none"}
        />
      )}
    </button>
  );
}

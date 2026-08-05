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

/**
 * L'identifiant visiteur permanent a ete SUPPRIME le 05/08/2026.
 *
 * Il etait cree des l'ouverture d'une fiche produit, ecrit dans le navigateur
 * et envoye au serveur sans le moindre clic du visiteur. L'article 82 de la loi
 * Informatique et Libertes n'autorise ca que si c'est strictement necessaire au
 * service demande — un compteur de vues ne l'est pas. Il aurait donc fallu un
 * bandeau de consentement, pour alimenter des compteurs que le site n'affiche
 * meme plus.
 *
 * Choix retenu : supprimer le mouchard plutot que d'imposer un bandeau a tous
 * les visiteurs. Les favoris restent entierement locaux au navigateur, ce qui
 * releve de l'exemption « service expressement demande par l'utilisateur ».
 *
 * Ne pas le reintroduire sans bandeau de consentement ET sans purge automatique.
 */
function nettoyerAncienIdentifiantVisiteur() {
  try {
    window.localStorage.removeItem(visitorStorageKey);
  } catch {
    // Un navigateur qui refuse le stockage local n'a rien a nettoyer.
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
    <div
      className={`flex flex-wrap items-center gap-3 text-xs font-bold text-muted ${className}`}
    >
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

    // Plus aucun appel au serveur a l'ouverture d'une fiche. Le compteur de
    // vues alimentait une statistique que le site n'affiche plus, au prix d'un
    // identifiant permanent depose sans consentement. Le nettoyage ci-dessous
    // efface aussi celui des visiteurs deja venus.
    nettoyerAncienIdentifiantVisiteur();

    return () => window.clearTimeout(favoriteTimer);
  }, [productId]);

  /**
   * Le favori est desormais purement local : rien ne part au serveur, donc
   * aucun profil de navigation n'est constitue. Le visiteur retrouve ses
   * favoris sur son propre navigateur, ce qui est tout ce que cette boutique
   * sans compte client sait en faire de toute facon.
   */
  function toggleFavorite() {
    const nextFavorite = !isFavorited;
    setIsLoadingFavorite(true);

    try {
      const favorites = getStoredFavorites();

      if (nextFavorite) {
        favorites.add(productId);
      } else {
        favorites.delete(productId);
      }

      writeStoredFavorites(favorites);
      setIsFavorited(nextFavorite);
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

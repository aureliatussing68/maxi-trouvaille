"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import type { Product } from "@/lib/catalog-client";
import type { ProductReviewSummary } from "@/lib/product-reviews";

export type ProductShelfItem = {
  product: Product;
  reviewSummary?: ProductReviewSummary;
};

const AUTO_ADVANCE_DELAY = 4500;
const RESUME_DELAY = 6000;
const PROGRAMMATIC_SCROLL_WINDOW = 900;
const EDGE_TOLERANCE = 4;

export function ProductShelf({
  items,
  label,
  header,
}: {
  items: ProductShelfItem[];
  label: string;
  /**
   * En-tete de section (surtitre, titre, phrase d'explication). Rendu cote
   * serveur et passe en prop pour tenir sur la meme ligne que les commandes,
   * comme les autres sections du site.
   */
  header?: ReactNode;
}) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLUListElement | null>(null);
  const directionRef = useRef<1 | -1>(1);
  const programmaticUntilRef = useRef(0);
  const scrollEndTimerRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  // Dernier mode de saisie : clavier (Tab, fleches) ou pointeur (souris,
  // doigt). Sert a ne mettre le carrousel en pause que sur un focus CLAVIER.
  const keyboardModeRef = useRef(false);

  // Etats identiques cote serveur et cote client : aucune desynchronisation
  // a l'hydratation.
  const [isPlaying, setIsPlaying] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [isOnScreen, setIsOnScreen] = useState(true);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(true);

  const syncEdges = useCallback(() => {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    const maxScroll = track.scrollWidth - track.clientWidth;
    setCanScrollBack(track.scrollLeft > EDGE_TOLERANCE);
    setCanScrollForward(track.scrollLeft < maxScroll - EDGE_TOLERANCE);
  }, []);

  const getStep = useCallback(() => {
    const track = trackRef.current;

    if (!track) {
      return 0;
    }

    const firstCard = track.firstElementChild as HTMLElement | null;

    if (!firstCard) {
      return track.clientWidth;
    }

    const gap = Number.parseFloat(
      window.getComputedStyle(track).columnGap || "0",
    );

    return firstCard.getBoundingClientRect().width + (Number.isFinite(gap) ? gap : 0);
  }, []);

  const scrollByStep = useCallback(
    (direction: 1 | -1) => {
      const track = trackRef.current;
      const step = getStep();

      if (!track || step <= 0) {
        return;
      }

      // On marque le defilement comme programmatique pour ne pas le confondre
      // avec un geste de l'utilisateur.
      programmaticUntilRef.current = Date.now() + PROGRAMMATIC_SCROLL_WINDOW;
      track.scrollBy({
        left: step * direction,
        // "auto" suit la regle CSS, qui repasse en saut instantane sous
        // prefers-reduced-motion.
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    },
    [getStep, prefersReducedMotion],
  );

  const pauseTemporarily = useCallback(() => {
    setIsInteracting(true);

    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
    }

    resumeTimerRef.current = window.setTimeout(() => {
      setIsInteracting(false);
      resumeTimerRef.current = null;
    }, RESUME_DELAY);
  }, []);

  const handleManualScroll = useCallback(() => {
    if (scrollEndTimerRef.current !== null) {
      window.clearTimeout(scrollEndTimerRef.current);
    }

    scrollEndTimerRef.current = window.setTimeout(() => {
      syncEdges();
      scrollEndTimerRef.current = null;
    }, 120);

    if (Date.now() < programmaticUntilRef.current) {
      return;
    }

    pauseTemporarily();
  }, [pauseTemporarily, syncEdges]);

  const goTo = useCallback(
    (direction: 1 | -1) => {
      directionRef.current = direction;
      pauseTemporarily();
      scrollByStep(direction);
    },
    [pauseTemporarily, scrollByStep],
  );

  // prefers-reduced-motion : l'avance automatique ne demarre jamais.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setPrefersReducedMotion(query.matches);

    apply();
    query.addEventListener("change", apply);

    return () => query.removeEventListener("change", apply);
  }, []);

  // Hors ecran : on economise batterie et processeur.
  useEffect(() => {
    const section = sectionRef.current;

    if (!section || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (entry) {
          setIsOnScreen(entry.isIntersecting);
        }
      },
      { threshold: 0.25 },
    );

    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  // Mode de saisie courant. On l'observe nous-memes plutot que de se fier a
  // :focus-visible, dont l'heuristique varie d'un navigateur et d'un type
  // d'ecran a l'autre : keydown = clavier, pointeur pose = souris ou doigt.
  useEffect(() => {
    const setKeyboard = () => {
      keyboardModeRef.current = true;
    };
    const setPointer = () => {
      keyboardModeRef.current = false;
    };

    document.addEventListener("keydown", setKeyboard, true);
    document.addEventListener("pointerdown", setPointer, true);
    document.addEventListener("mousedown", setPointer, true);
    document.addEventListener("touchstart", setPointer, true);

    return () => {
      document.removeEventListener("keydown", setKeyboard, true);
      document.removeEventListener("pointerdown", setPointer, true);
      document.removeEventListener("mousedown", setPointer, true);
      document.removeEventListener("touchstart", setPointer, true);
    };
  }, []);

  // Onglet en arriere-plan.
  useEffect(() => {
    const apply = () => setIsTabVisible(document.visibilityState !== "hidden");

    apply();
    document.addEventListener("visibilitychange", apply);

    return () => document.removeEventListener("visibilitychange", apply);
  }, []);

  useEffect(() => {
    syncEdges();

    const onResize = () => syncEdges();
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [syncEdges]);

  // Avance automatique en va-et-vient (jamais de retour brutal au debut).
  useEffect(() => {
    const shouldRun =
      isPlaying &&
      !prefersReducedMotion &&
      !isHovered &&
      !isFocusWithin &&
      !isInteracting &&
      isOnScreen &&
      isTabVisible &&
      items.length > 1;

    if (!shouldRun) {
      return;
    }

    const timer = window.setInterval(() => {
      const track = trackRef.current;

      if (!track) {
        return;
      }

      const maxScroll = track.scrollWidth - track.clientWidth;

      if (maxScroll <= EDGE_TOLERANCE) {
        return;
      }

      if (directionRef.current === 1 && track.scrollLeft >= maxScroll - EDGE_TOLERANCE) {
        directionRef.current = -1;
      } else if (directionRef.current === -1 && track.scrollLeft <= EDGE_TOLERANCE) {
        directionRef.current = 1;
      }

      scrollByStep(directionRef.current);
    }, AUTO_ADVANCE_DELAY);

    return () => window.clearInterval(timer);
  }, [
    isFocusWithin,
    isHovered,
    isInteracting,
    isOnScreen,
    isPlaying,
    isTabVisible,
    items.length,
    prefersReducedMotion,
    scrollByStep,
  ]);

  // Aucune fuite memoire lors d'une navigation interne.
  useEffect(
    () => () => {
      if (scrollEndTimerRef.current !== null) {
        window.clearTimeout(scrollEndTimerRef.current);
      }

      if (resumeTimerRef.current !== null) {
        window.clearTimeout(resumeTimerRef.current);
      }
    },
    [],
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      ref={sectionRef}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          setIsHovered(true);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") {
          setIsHovered(false);
        }
      }}
      onPointerDown={pauseTemporarily}
      onPointerUp={pauseTemporarily}
    >
      {/* En dessous de 1024 px, titre et commandes s'empilent : a 768 px le
          bloc titre et les trois commandes ne tiennent pas sur une ligne, et la
          fleche droite partait seule a la ligne. */}
      <div className="mb-4 flex flex-col justify-between gap-3 sm:mb-6 sm:gap-4 lg:flex-row lg:items-end">
        {header ? <div className="max-w-2xl">{header}</div> : <div />}
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {prefersReducedMotion ? null : (
            <button
              type="button"
              aria-label={
                isPlaying
                  ? "Pause du défilement automatique"
                  : "Lecture du défilement automatique"
              }
              aria-pressed={!isPlaying}
              onClick={() => setIsPlaying((playing) => !playing)}
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
            >
              {isPlaying ? (
                <Pause size={16} aria-hidden="true" />
              ) : (
                <Play size={16} aria-hidden="true" />
              )}
              {isPlaying ? "Pause" : "Lecture"}
            </button>
          )}
          <button
            type="button"
            aria-label="Voir les produits précédents"
            aria-disabled={!canScrollBack}
            onClick={() => {
              if (canScrollBack) {
                goTo(-1);
              }
            }}
            className={`focus-ring inline-flex h-11 w-11 items-center justify-center rounded-md border border-line ${
              canScrollBack ? "hover:bg-[#f1eadf]" : "opacity-40"
            }`}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Voir les produits suivants"
            aria-disabled={!canScrollForward}
            onClick={() => {
              if (canScrollForward) {
                goTo(1);
              }
            }}
            className={`focus-ring inline-flex h-11 w-11 items-center justify-center rounded-md border border-line ${
              canScrollForward ? "hover:bg-[#f1eadf]" : "opacity-40"
            }`}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Le suivi du focus est pose sur la piste uniquement, jamais sur les
          boutons de commande : sous Windows/Chrome un bouton garde le focus
          apres un clic, et l'avance automatique ne repartait alors plus jamais
          apres une fleche ou un Pause/Lecture.
          Et sur la piste, seul un focus CLAVIER met en pause : un clic souris
          ou un appui tactile sur "Ajouter" laisse aussi le focus sur le bouton,
          ce qui figeait le carrousel definitivement. keyboardModeRef distingue
          les deux (clavier = pause voulue, clic ou doigt = pas de pause). */}
      <ul
        ref={trackRef}
        className="product-shelf"
        aria-label={label}
        tabIndex={0}
        onScroll={handleManualScroll}
        onFocusCapture={() => {
          if (keyboardModeRef.current) {
            setIsFocusWithin(true);
          }
        }}
        onBlurCapture={() => setIsFocusWithin(false)}
      >
        {items.map((item) => (
          <li key={item.product.id}>
            <ProductCard
              product={item.product}
              reviewSummary={item.reviewSummary}
              variant="showcase"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

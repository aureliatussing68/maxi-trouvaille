import Image from "next/image";

/**
 * Diaporama de fond, en deux tailles :
 *  - "hero" : plein cadre, derriere le titre de l'accueil ;
 *  - "band" : bandeau fin, sous l'en-tete de la boutique.
 *
 * Les 4 visuels sont des photos de RAYON deja presentes sur le disque. Elles
 * passent la validation visuelle du site : ni image stock achetee, ni photo
 * fournisseur, et surtout aucun article precis mis en avant, ce qui reste
 * coherent avec une expedition par partenaire logistique.
 *
 * Elles sont volontairement identiques a 4 vignettes de la grille des rayons
 * plus bas dans la page : le navigateur les a deja en cache, le diaporama ne
 * coute donc aucun octet supplementaire.
 *
 * Le fondu est entierement en CSS (.hero-carousel-slide dans globals.css), cale
 * sur EXACTEMENT 4 diapos (cycle de 20 s, retards de 0/5/10/15 s). Ajouter une
 * cinquieme image sans reecrire les keyframes ferait se superposer deux diapos.
 */
const heroSlides = [
  {
    title: "Maison",
    image: "/uploads/category-images/maison.webp",
    alt: "Rayon maison : paniers en osier, linge plie et petit rangement",
  },
  {
    title: "Cuisine",
    image: "/uploads/category-images/cuisine.webp",
    alt: "Rayon cuisine : robot menager, casseroles et ustensiles en bois",
  },
  {
    title: "Animaux",
    image: "/uploads/category-images/animaux.webp",
    alt: "Rayon animaux : chien et chat entoures de gamelles, paniers et jouets",
  },
  {
    title: "High-tech",
    image: "/uploads/category-images/high-tech.webp",
    alt: "Rayon high-tech : ecran, enceinte connectee, montre et ecouteurs",
  },
];

export type HeroCarouselVariant = "hero" | "band";

export function HeroCarousel({
  variant = "hero",
}: {
  variant?: HeroCarouselVariant;
}) {
  const isBand = variant === "band";

  return (
    // aria-hidden : les 4 diapos sont toutes dans le DOM en permanence (seule
    // l'opacite change). Sans cela un lecteur d'ecran annoncerait les quatre
    // libelles a la suite. Aucun element focusable a l'interieur : le piege du
    // focus qui figeait le carrousel produits ne peut pas se reproduire ici.
    <div
      className={
        isBand
          ? "hero-carousel hero-carousel--band relative h-32 w-full overflow-hidden bg-[#171717] sm:h-[180px]"
          : "hero-carousel hero-carousel--fill absolute inset-0"
      }
      aria-hidden="true"
    >
      {heroSlides.map((slide, index) => (
        <div
          key={slide.title}
          className="hero-carousel-slide absolute inset-0"
          style={{ animationDelay: `${index * 5}s` }}
        >
          <Image
            src={slide.image}
            alt={slide.alt}
            fill
            sizes="100vw"
            // Les fichiers font 960x640 : nets sur telephone, un peu mous sur
            // un grand ecran. Le leger agrandissement masque la mollesse et
            // evite les bords blancs au recadrage.
            className="scale-[1.05] object-cover"
            // Sur l'accueil la premiere diapo fait partie du premier ecran.
            // Sur la boutique le bandeau est decoratif : on laisse le
            // navigateur decider, il chargera de toute facon tout de suite
            // puisque le bandeau est visible sans defiler.
            priority={!isBand && index === 0}
          />
          <div
            className={`absolute inset-0 ${
              isBand ? "hero-band-veil" : "hero-carousel-veil"
            }`}
          />
          {/* Le libelle du rayon n'apparait QUE sur l'accueil.
              Sur la boutique, la page s'appelle "Toute la boutique" et le
              filtre juste en dessous dit "Tous les rayons" : une pastille
              "MAISON" puis "ANIMAUX" laissait croire que la page etait filtree,
              et elle n'etait meme pas cliquable. Le bandeau y est purement
              decoratif.
              Sur l'accueil le libelle est a DROITE : le texte du hero est
              aligne a gauche et, sous les trois boutons, une pastille de la
              meme taille se lisait comme un quatrieme bouton.
              Pastille SOMBRE et non claire : sur maison.webp et cuisine.webp,
              un fond blanc translucide eclaircissait justement la zone ou se
              trouve le texte blanc. */}
          {isBand ? null : (
            <div className="absolute inset-x-0 bottom-4 px-4 sm:bottom-6">
              <div className="container-page flex justify-end">
                <span className="inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white backdrop-blur-sm">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-brand"
                    aria-hidden="true"
                  />
                  {slide.title}
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

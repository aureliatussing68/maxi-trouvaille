import Image from "next/image";

const heroSlides = [
  {
    title: "Catalogue en validation",
    image: "/uploads/category-images/produits-partenaires.webp",
    alt: "Rayon produits partenaires Maxi Trouvaille en validation",
  },
  {
    title: "Preuves produit",
    image: "/uploads/category-images/selection-partenaires.webp",
    alt: "Selection produits partenaires controlee avant affichage public",
  },
  {
    title: "Nouveautes partenaires",
    image: "/uploads/category-images/nouveautes-partenaires.webp",
    alt: "Nouveautes partenaires gardees en verification qualite",
  },
  {
    title: "Livraison suivie",
    image: "/uploads/category-images/promotions-partenaires.webp",
    alt: "Promotions partenaires avec expedition par partenaire logistique",
  },
];

export function HeroCarousel() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
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
            className="object-cover"
            priority={index === 0}
          />
          <div className="absolute inset-0 bg-black/56" />
          <div className="absolute inset-x-0 bottom-5 px-4 sm:bottom-8">
            <div className="container-page">
              <span className="inline-flex rounded-md bg-white/14 px-3 py-2 text-sm font-black text-white backdrop-blur">
                {slide.title}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

import Image from "next/image";

const heroSlides = [
  {
    title: "Arrivages réguliers",
    image:
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1400&q=80",
    alt: "Entrepôt logistique avec cartons et préparation de commandes",
  },
  {
    title: "Palettes dès 899 €",
    image:
      "https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=1400&q=80",
    alt: "Palettes et rayonnages dans un entrepôt",
  },
  {
    title: "Colis mystères premium",
    image:
      "https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=1400&q=80",
    alt: "Cartons mystères et colis prêts à être expédiés",
  },
  {
    title: "Lots pour particuliers et revendeurs",
    image:
      "https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&w=1400&q=80",
    alt: "Boutique avec produits en lots et bonnes affaires",
  },
];

export function HeroCarousel() {
  return (
    <section className="border-b border-line bg-paper">
      <div className="container-page py-6">
        <div className="relative min-h-[260px] overflow-hidden rounded-lg bg-foreground text-white shadow-sm md:min-h-[320px]">
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
                sizes="(min-width: 1120px) 1120px, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/48" />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                <div className="inline-flex rounded-md bg-white/14 px-3 py-2 text-sm font-black backdrop-blur">
                  {slide.title}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

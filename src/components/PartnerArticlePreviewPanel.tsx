import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Car,
  Lamp,
  PackageCheck,
  PawPrint,
  Printer,
  ShieldCheck,
  Sofa,
  Sparkles,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";

type PreviewArticle = {
  icon: LucideIcon;
  title: string;
  category: string;
  text: string;
  proofFocus: string;
  href: string;
  image: string;
  imageAlt: string;
  categorySlugs: string[];
};

const previewArticles: PreviewArticle[] = [
  {
    icon: Printer,
    title: "Mini imprimante thermique Bluetooth",
    category: "High-tech utile",
    text: "Pour notes, petites étiquettes, listes et organisation du quotidien.",
    proofFocus: "SKU, compatibilité et rouleaux à confirmer.",
    href: "/categories/high-tech-partenaires",
    image: "/uploads/category-images/high-tech.webp",
    imageAlt: "Visuel de rayon high-tech partenaires",
    categorySlugs: [
      "produits-partenaires",
      "nouveautes-partenaires",
      "high-tech-partenaires",
    ],
  },
  {
    icon: Sparkles,
    title: "Organisateur de câbles voyage",
    category: "Accessoires pratiques",
    text: "Pour ranger chargeurs, câbles, écouteurs et petits accessoires tech.",
    proofFocus: "Dimensions, matière et photo exacte à valider.",
    href: "/categories/accessoires-partenaires",
    image: "/uploads/category-images/accessoires.webp",
    imageAlt: "Visuel de rayon accessoires partenaires",
    categorySlugs: [
      "produits-partenaires",
      "promotions-partenaires",
      "accessoires-partenaires",
    ],
  },
  {
    icon: WandSparkles,
    title: "Projecteur galaxie LED",
    category: "Maison ambiance",
    text: "Pour créer une ambiance lumineuse simple dans une chambre ou un salon.",
    proofFocus: "Variantes, alimentation et normes à vérifier.",
    href: "/categories/maison-partenaires",
    image: "/uploads/category-images/maison.webp",
    imageAlt: "Visuel de rayon maison partenaires",
    categorySlugs: [
      "produits-partenaires",
      "nouveautes-partenaires",
      "maison-partenaires",
    ],
  },
  {
    icon: Car,
    title: "Mini aspirateur voiture sans fil",
    category: "Auto-moto",
    text: "Pour nettoyer rapidement miettes, poussière et petits espaces.",
    proofFocus: "Puissance, accessoires et autonomie à prouver.",
    href: "/categories/auto-moto-partenaires",
    image: "/uploads/category-images/auto-moto.webp",
    imageAlt: "Visuel de rayon auto-moto partenaires",
    categorySlugs: [
      "produits-partenaires",
      "promotions-partenaires",
      "auto-moto-partenaires",
    ],
  },
  {
    icon: PawPrint,
    title: "Brosse anti-poils animaux réutilisable",
    category: "Animaux",
    text: "Pour retirer poils et poussières sur canapé, tapis et textiles.",
    proofFocus: "Format, surface compatible et stock à contrôler.",
    href: "/categories/animaux-partenaires",
    image: "/uploads/category-images/animaux.webp",
    imageAlt: "Visuel de rayon animaux partenaires",
    categorySlugs: [
      "produits-partenaires",
      "promotions-partenaires",
      "animaux-partenaires",
    ],
  },
  {
    icon: PackageCheck,
    title: "Gourde isotherme avec infuseur",
    category: "Cuisine nomade",
    text: "Pour eau, thé froid, boissons du quotidien et petits trajets.",
    proofFocus: "Contenance, matériau et droits image à valider.",
    href: "/categories/cuisine-partenaires",
    image: "/uploads/category-images/cuisine.webp",
    imageAlt: "Visuel de rayon cuisine partenaires",
    categorySlugs: [
      "produits-partenaires",
      "nouveautes-partenaires",
      "cuisine-partenaires",
    ],
  },
  {
    icon: Sofa,
    title: "Organisateur tiroir extensible",
    category: "Maison rangement",
    text: "Pour structurer cuisine, bureau ou salle de bain sans travaux.",
    proofFocus: "Mesures exactes, couleur et délai à vérifier.",
    href: "/categories/maison-partenaires",
    image: "/uploads/category-images/maison.webp",
    imageAlt: "Visuel de rayon maison partenaires",
    categorySlugs: [
      "produits-partenaires",
      "promotions-partenaires",
      "maison-partenaires",
    ],
  },
  {
    icon: Lamp,
    title: "Lampe de lecture USB orientable",
    category: "Accessoire pratique",
    text: "Pour bureau, chevet ou lecture d'appoint avec éclairage compact.",
    proofFocus: "Connectique, batterie et variante à confirmer.",
    href: "/categories/accessoires-partenaires",
    image: "/uploads/category-images/accessoires.webp",
    imageAlt: "Visuel de rayon accessoires partenaires",
    categorySlugs: [
      "produits-partenaires",
      "nouveautes-partenaires",
      "accessoires-partenaires",
      "high-tech-partenaires",
    ],
  },
  {
    icon: Sparkles,
    title: "Trousse toilette suspendue",
    category: "Beauté voyage",
    text: "Pour garder soins, maquillage et petits accessoires visibles en déplacement.",
    proofFocus: "Dimensions, poches et matière à confirmer.",
    href: "/categories/beaute-partenaires",
    image: "/uploads/category-images/beaute-sante.webp",
    imageAlt: "Visuel de rayon beauté partenaires",
    categorySlugs: [
      "produits-partenaires",
      "promotions-partenaires",
      "beaute-partenaires",
      "accessoires-partenaires",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Brosse massage cuir chevelu",
    category: "Beauté simple",
    text: "Pour routine douche, massage doux et lavage avec prise en main facile.",
    proofFocus: "Silicone, couleur et photo exacte à prouver.",
    href: "/categories/beaute-partenaires",
    image: "/uploads/category-images/beaute-sante.webp",
    imageAlt: "Visuel de rayon beauté partenaires",
    categorySlugs: [
      "produits-partenaires",
      "nouveautes-partenaires",
      "beaute-partenaires",
    ],
  },
  {
    icon: WandSparkles,
    title: "Veilleuse enfant rechargeable",
    category: "Enfant",
    text: "Pour chambre enfant, lecture du soir et ambiance douce sans installation.",
    proofFocus: "Autonomie, câble inclus et normes à vérifier.",
    href: "/categories/enfant-partenaires",
    image: "/uploads/category-images/jouets.webp",
    imageAlt: "Visuel de rayon enfant partenaires",
    categorySlugs: [
      "produits-partenaires",
      "nouveautes-partenaires",
      "enfant-partenaires",
      "maison-partenaires",
    ],
  },
  {
    icon: PackageCheck,
    title: "Organisateur poussette compact",
    category: "Enfant pratique",
    text: "Pour ranger biberon, lingettes, clés et petits objets pendant les sorties.",
    proofFocus: "Fixation, dimensions et charge à contrôler.",
    href: "/categories/enfant-partenaires",
    image: "/uploads/category-images/jouets.webp",
    imageAlt: "Visuel de rayon enfant partenaires",
    categorySlugs: [
      "produits-partenaires",
      "promotions-partenaires",
      "enfant-partenaires",
      "accessoires-partenaires",
    ],
  },
  {
    icon: PackageCheck,
    title: "Housse chaussures de voyage",
    category: "Mode rangement",
    text: "Pour séparer chaussures, linge et accessoires dans une valise.",
    proofFocus: "Lot, fermeture et taille à confirmer.",
    href: "/categories/mode-partenaires",
    image: "/uploads/category-images/vetements.webp",
    imageAlt: "Visuel de rayon mode partenaires",
    categorySlugs: [
      "produits-partenaires",
      "promotions-partenaires",
      "mode-partenaires",
      "accessoires-partenaires",
    ],
  },
  {
    icon: Sofa,
    title: "Défroisseur vapeur portable",
    category: "Mode maison",
    text: "Pour retouches rapides sur chemises, robes et textiles du quotidien.",
    proofFocus: "Prise, puissance et sécurité à vérifier.",
    href: "/categories/mode-partenaires",
    image: "/uploads/category-images/vetements.webp",
    imageAlt: "Visuel de rayon mode partenaires",
    categorySlugs: [
      "produits-partenaires",
      "nouveautes-partenaires",
      "mode-partenaires",
      "maison-partenaires",
    ],
  },
  {
    icon: Car,
    title: "Support téléphone voiture rotatif",
    category: "Auto high-tech",
    text: "Pour garder l'écran lisible en trajet avec fixation simple à expliquer.",
    proofFocus: "Fixation, compatibilité et aimantation à prouver.",
    href: "/categories/auto-moto-partenaires",
    image: "/uploads/category-images/auto-moto.webp",
    imageAlt: "Visuel de rayon auto-moto partenaires",
    categorySlugs: [
      "produits-partenaires",
      "promotions-partenaires",
      "auto-moto-partenaires",
      "high-tech-partenaires",
    ],
  },
  {
    icon: Lamp,
    title: "Mini humidificateur USB compact",
    category: "Maison high-tech",
    text: "Pour bureau, table de chevet ou petite pièce avec usage ponctuel.",
    proofFocus: "Réservoir, alimentation et entretien à vérifier.",
    href: "/categories/maison-partenaires",
    image: "/uploads/category-images/maison.webp",
    imageAlt: "Visuel de rayon maison partenaires",
    categorySlugs: [
      "produits-partenaires",
      "nouveautes-partenaires",
      "maison-partenaires",
      "high-tech-partenaires",
    ],
  },
];

export function PartnerArticlePreviewPanel({
  categorySlug,
  className,
}: {
  categorySlug?: string;
  className?: string;
}) {
  const articles = categorySlug
    ? previewArticles.filter((article) =>
        article.categorySlugs.includes(categorySlug),
      )
    : previewArticles;

  if (articles.length === 0) {
    return null;
  }

  const isScoped = Boolean(categorySlug);

  return (
    <section
      className={[
        "rounded-lg border border-line bg-paper p-5 shadow-sm sm:p-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold uppercase text-teal">
            <ShieldCheck size={16} aria-hidden="true" />
            Articles en validation
          </p>
          <h2 className="mt-2 max-w-3xl text-2xl font-black leading-tight sm:text-3xl">
            {isScoped
              ? "Articles en validation pour ce rayon."
              : "Quelques articles concrets à montrer, avec validation en cours."}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base">
            {isScoped
              ? "Ces idées donnent un aperçu du rayon. La publication complète attend encore la validation des photos exactes, du prix, du stock, du délai et des droits image."
              : "Ces sélections donnent déjà une idée claire des rayons. La publication complète attend encore la validation des photos exactes, du prix, du stock, du délai et des droits image."}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
          <span className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-bold text-teal">
            {articles.length} aperçu{articles.length > 1 ? "s" : ""} en validation
          </span>
          <Link
            href="/produits-partenaires"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-bold text-white hover:bg-[#2b2b2b]"
          >
            Voir les rayons
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {articles.map((article) => {
          const Icon = article.icon;

          return (
            <article
              key={article.title}
              className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-white"
            >
              <div className="relative aspect-[16/9] bg-[#f1eadf]">
                <Image
                  src={article.image}
                  alt={article.imageAlt}
                  fill
                  sizes="(min-width: 1280px) 256px, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
                <span className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-md bg-white/92 text-teal shadow-sm">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span className="absolute bottom-3 left-3 rounded-md bg-white/92 px-2 py-1 text-[11px] font-bold uppercase text-teal shadow-sm">
                  Visuel de rayon
                </span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase text-muted">
                    {article.category}
                  </p>
                  <span className="rounded-md bg-[#ecfdf5] px-2 py-1 text-[11px] font-bold uppercase text-teal">
                    Validation
                  </span>
                </div>
                <h3 className="mt-2 text-base font-bold leading-6">
                  {article.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted">
                  {article.text}
                </p>
                <p className="mt-3 rounded-md bg-[#faf7f0] px-3 py-2 text-xs font-bold leading-5 text-muted">
                  À compléter: {article.proofFocus}
                </p>
                <Link
                  href={article.href}
                  className="focus-ring mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-bold hover:bg-[#f1eadf]"
                >
                  Voir le rayon
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

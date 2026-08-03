type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  /**
   * Version courte, pour les pages qui doivent montrer de la marchandise tout
   * de suite (la boutique, les rayons). L'en-tete pleine hauteur poussait les
   * premiers produits sous la ligne de flottaison sur telephone.
   */
  compact?: boolean;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  compact = false,
}: PageHeaderProps) {
  return (
    <section className="border-b border-line bg-paper">
      <div
        className={
          compact ? "container-page py-6 sm:py-8" : "container-page py-10 sm:py-14"
        }
      >
        {eyebrow ? (
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-teal">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={
            compact
              ? "max-w-3xl text-2xl font-black leading-tight sm:text-4xl"
              : "max-w-3xl text-3xl font-black leading-[1.08] sm:text-5xl"
          }
        >
          {title}
        </h1>
        {description ? (
          <p
            className={
              compact
                ? "mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base"
                : "mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg"
            }
          >
            {description}
          </p>
        ) : null}
      </div>
    </section>
  );
}

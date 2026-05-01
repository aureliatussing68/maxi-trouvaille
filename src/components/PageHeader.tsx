type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <section className="border-b border-line bg-paper">
      <div className="container-page py-10 sm:py-14">
        {eyebrow ? (
          <p className="mb-3 text-sm font-black uppercase text-teal">{eyebrow}</p>
        ) : null}
        <h1 className="max-w-3xl text-3xl font-black leading-[1.08] sm:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            {description}
          </p>
        ) : null}
      </div>
    </section>
  );
}

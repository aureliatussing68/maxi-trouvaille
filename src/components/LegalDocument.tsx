import { legalDocuments, type LegalDocumentKey } from "@/lib/legal";

export function LegalDocument({
  documentKey,
  className,
}: {
  documentKey: LegalDocumentKey;
  className?: string;
}) {
  const document = legalDocuments[documentKey];

  return (
    <article
      className={[
        "rounded-lg border border-line bg-paper p-6 shadow-sm sm:p-8",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="text-sm font-bold uppercase text-teal">Document client</p>
      <h1 className="mt-3 text-3xl font-black leading-[1.08]">
        {document.title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Cadre d&apos;information Maxi Trouvaille pour les commandes, le service
        client et les produits partenaires. Derniere mise a jour :{" "}
        {document.updatedAt}.
      </p>

      <div className="mt-8 grid gap-7">
        {document.sections.map((section) => (
          <section
            key={section.title}
            className={
              section.boxed
                ? "rounded-md border-2 border-foreground bg-[#f6f1e8] p-5"
                : undefined
            }
          >
            <h2 className="text-xl font-black">{section.title}</h2>
            <div
              className={`mt-3 grid gap-3 text-sm leading-7 ${
                section.boxed ? "text-foreground" : "text-muted"
              }`}
            >
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

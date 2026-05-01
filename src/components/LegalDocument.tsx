import { legalDocuments, type LegalDocumentKey } from "@/lib/legal";

export function LegalDocument({ documentKey }: { documentKey: LegalDocumentKey }) {
  const document = legalDocuments[documentKey];

  return (
    <article className="container-page py-10">
      <div className="rounded-lg border border-line bg-paper p-6 shadow-sm sm:p-8">
        <p className="text-sm font-black uppercase text-teal">Document provisoire</p>
        <h1 className="mt-3 text-3xl font-black leading-[1.08]">{document.title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Version provisoire a personnaliser et a faire valider avant publication
          commerciale. Derniere mise a jour : {document.updatedAt}.
        </p>

        <div className="mt-8 grid gap-7">
          {document.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-black">{section.title}</h2>
              <div className="mt-3 grid gap-3 text-sm leading-7 text-muted">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}

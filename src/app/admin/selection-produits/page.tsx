import { promises as fs } from "fs";
import path from "path";
import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { isAdminModeEnabled } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin sélection produits",
};

type Candidate = {
  id: string;
  status: string;
  publicationStatus: string;
  category: string;
  name: string;
  supplierSearchUrl: string;
  supplierTarget: string;
  deliveryTarget: string;
  sellingAngle: string;
  checksRequired: string[];
};

type CandidateSource = {
  name: string;
  url: string;
  note: string;
};

type CandidateFile = {
  generatedAt: string;
  mode: string;
  warning: string;
  candidateCount: number;
  sources: CandidateSource[];
  candidates: Candidate[];
};

const candidatePath = path.join(
  process.cwd(),
  "business-maxi-trouvailles",
  "produits-a-valider",
  "selection_couche_006_20260527.json",
);

async function readCandidates(): Promise<CandidateFile | null> {
  try {
    return JSON.parse(await fs.readFile(candidatePath, "utf8")) as CandidateFile;
  } catch {
    return null;
  }
}

function groupCandidates(candidates: Candidate[]) {
  return candidates.reduce<Record<string, Candidate[]>>((groups, candidate) => {
    groups[candidate.category] = groups[candidate.category] ?? [];
    groups[candidate.category].push(candidate);
    return groups;
  }, {});
}

function getPartnerCategoryId(candidateCategory: string) {
  const categoryMap: Record<string, string> = {
    animaux: "dropshipping-animaux",
    "auto-moto": "dropshipping-auto-moto",
    "gadgets-jouets": "dropshipping-enfant",
    "high-tech": "dropshipping-high-tech",
    jardin: "dropshipping-maison",
    "jeux-video-gaming": "dropshipping-high-tech",
    "maison-deco": "dropshipping-maison",
    "outillage-electricite": "dropshipping-high-tech",
    "sport-loisirs": "dropshipping-accessoires",
    telephonie: "dropshipping-high-tech",
  };

  return categoryMap[candidateCategory] ?? "dropshipping-nouveautes";
}

function getCandidateClientDescription(candidate: Candidate) {
  return `${candidate.sellingAngle} Produit a verifier avant publication: visuels, stock, delai et conformite.`;
}

export default async function AdminProductSelectionPage() {
  if (!isAdminModeEnabled()) {
    return (
      <>
        <PageHeader
          eyebrow="Admin"
          title="Sélection produits verrouillée"
          description="Activez ADMIN_MODE=true dans l'environnement local pour ouvrir cette page."
        />
        <section className="container-page py-10">
          <div className="rounded-lg border border-line bg-paper p-6 text-sm font-bold text-muted shadow-sm">
            Le mode admin est désactivé.
          </div>
        </section>
      </>
    );
  }

  const data = await readCandidates();
  const groups = groupCandidates(data?.candidates ?? []);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Sélection fournisseurs à valider"
        description="File de produits candidats par rayon : aucune commande, aucune publication, validation humaine obligatoire avant import public."
      />

      <section className="container-page grid gap-8 py-10">
        <div className="rounded-lg border border-line bg-paper p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <p className="text-sm font-black uppercase text-teal">
                Couche 006
              </p>
              <h2 className="mt-2 text-2xl font-black">
                {data?.candidateCount ?? 0} produits candidats
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                Statut : recherche fournisseur uniquement. Les prix, délais,
                visuels et stocks doivent être confirmés avant publication.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/pilotage"
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
              >
                Pilotage du jour
              </Link>
              <Link
                href="/admin/dropshipping"
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
              >
                Retour commandes
              </Link>
              <Link
                href="/admin/decision-hold"
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
              >
                Décision HOLD
              </Link>
            </div>
          </div>
        </div>

        {data ? (
          <>
            <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
              <h2 className="text-xl font-black">Sources de tendance</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {data.sources.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="focus-ring rounded-lg border border-line p-4 transition hover:border-[#d5c8b7] hover:bg-[#fbf7ef]"
                  >
                    <span className="flex items-center gap-2 text-sm font-black text-teal">
                      <ExternalLink size={16} aria-hidden="true" />
                      {source.name}
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-muted">
                      {source.note}
                    </span>
                  </a>
                ))}
              </div>
            </section>

            {Object.entries(groups).map(([category, candidates]) => (
              <section key={category} className="grid gap-4">
                <div>
                  <p className="text-sm font-black uppercase text-teal">
                    Rayon
                  </p>
                  <h2 className="mt-2 text-2xl font-black">{category}</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {candidates.map((candidate) => (
                    <article
                      key={candidate.id}
                      className="rounded-lg border border-line bg-paper p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg font-black">{candidate.name}</h3>
                        <span className="rounded-md bg-[#ecfdf5] px-2 py-1 text-[11px] font-black uppercase text-teal">
                          À valider
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted">
                        {candidate.sellingAngle}
                      </p>
                      <dl className="mt-4 grid gap-2 text-sm">
                        <div>
                          <dt className="font-black">Cible fournisseur</dt>
                          <dd className="text-muted">{candidate.supplierTarget}</dd>
                        </div>
                        <div>
                          <dt className="font-black">Livraison visée</dt>
                          <dd className="text-muted">{candidate.deliveryTarget}</dd>
                        </div>
                      </dl>
                      <div className="mt-4 rounded-md bg-[#f6f1e8] p-3 text-xs leading-5 text-muted">
                        <span className="mb-1 flex items-center gap-2 font-black text-foreground">
                          <ShieldCheck size={15} aria-hidden="true" />
                          Garde-fous
                        </span>
                        {candidate.checksRequired.slice(0, 2).join(" ")}
                      </div>
                      <a
                        href={candidate.supplierSearchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="focus-ring mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
                      >
                        Recherche fournisseur
                        <ExternalLink size={15} aria-hidden="true" />
                      </a>
                      <Link
                        href={{
                          pathname: "/admin/dropshipping",
                          query: {
                            candidateId: candidate.id,
                            candidateCategory: candidate.category,
                            sourceMode: data.mode,
                            sourceGeneratedAt: data.generatedAt,
                            title: candidate.name,
                            supplierUrl: candidate.supplierSearchUrl,
                            categoryId: getPartnerCategoryId(candidate.category),
                            deliveryEstimate: candidate.deliveryTarget,
                            description: getCandidateClientDescription(candidate),
                          },
                        }}
                        className="focus-ring mt-3 inline-flex min-h-10 items-center justify-center rounded-md bg-foreground px-3 text-sm font-black text-white hover:bg-[#2b2b2b]"
                      >
                        Préparer l&apos;import
                      </Link>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </>
        ) : (
          <div className="rounded-lg border border-line bg-paper p-6 text-sm font-bold text-muted shadow-sm">
            Aucun fichier de sélection trouvé. Lancez le générateur de candidats.
          </div>
        )}
      </section>
    </>
  );
}

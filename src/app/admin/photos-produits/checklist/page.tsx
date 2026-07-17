import { promises as fs, type Dirent } from "fs";
import path from "path";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, FileCheck2, LockKeyhole } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { isAdminModeEnabled } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checklist photos produits",
};

type PhotoTask = {
  order: number;
  productId: string;
  productName: string;
  role: string;
  requiredShot: string;
  expectedFileName: string;
  stagingRelativePath: string;
  stagingStatus: string;
  stagingFilePresent: boolean;
  stagingWebpValid: boolean;
  targetPublicUrl: string;
  currentGateStatus: string;
  keepHoldUntil: string[];
};

type PhotoProduct = {
  rank: number;
  productId: string;
  productName: string;
  categoryId: string;
  targetFolderPublic: string;
  humanGateStatus: string;
  dropFolderRelative: string;
  imageCount: number;
  presentValidWebpCount: number;
  invalidStagingFileCount: number;
  imageTasks: PhotoTask[];
};

type PhotoManifest = {
  generatedAtLocal: string;
  productCount: number;
  expectedImageCount: number;
  presentValidWebpCount: number;
  invalidStagingFileCount: number;
  outputDirRelative: string;
  products: PhotoProduct[];
};

type PageData = {
  manifest: PhotoManifest | null;
  paths: {
    manifestPath?: string;
    checklistPath?: string;
    csvPath?: string;
  };
};

const photoDropRoot = path.join(
  process.cwd(),
  "business-maxi-trouvailles",
  "depots-photos",
);

const reviewChecks = [
  "fichier WebP avec le nom exact",
  "signature WebP valide",
  "produit exact visible",
  "variante exacte confirmee",
  "droits image ou photo propre confirmes",
  "aucun accessoire trompeur",
  "validation Mouss avant copie publique",
];

async function collectFiles(dir: string, predicate: (name: string) => boolean, out: string[] = []) {
  let entries: Dirent[];

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectFiles(fullPath, predicate, out);
    } else if (entry.isFile() && predicate(entry.name)) {
      out.push(fullPath);
    }
  }

  return out;
}

async function latestFile(dir: string, predicate: (name: string) => boolean) {
  const files = await collectFiles(dir, predicate);
  const dated = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      mtimeMs: (await fs.stat(filePath)).mtimeMs,
    })),
  );

  return dated.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.filePath;
}

async function readJson<T>(filePath?: string): Promise<T | null> {
  if (!filePath) {
    return null;
  }

  return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
}

async function readPageData(): Promise<PageData> {
  const [manifestPath, checklistPath, csvPath] = await Promise.all([
    latestFile(
      photoDropRoot,
      (name) => name.startsWith("MANIFEST_DEPOT_PHOTOS_SPRINT_") && name.endsWith(".json"),
    ),
    latestFile(
      photoDropRoot,
      (name) => name.startsWith("CHECKLIST_AVANT_COPIE_PHOTOS_") && name.endsWith(".md"),
    ),
    latestFile(
      photoDropRoot,
      (name) => name.startsWith("NOMS_FICHIERS_ATTENDUS_PHOTOS_") && name.endsWith(".csv"),
    ),
  ]);
  const manifest = await readJson<PhotoManifest>(manifestPath);

  return {
    manifest,
    paths: {
      manifestPath: manifestPath ? path.relative(process.cwd(), manifestPath) : undefined,
      checklistPath: checklistPath ? path.relative(process.cwd(), checklistPath) : undefined,
      csvPath: csvPath ? path.relative(process.cwd(), csvPath) : undefined,
    },
  };
}

function lockedAdminState() {
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Checklist photos verrouillee"
        description="Activez ADMIN_MODE=true dans l'environnement local pour ouvrir cette checklist."
      />
      <section className="container-page py-10">
        <div className="rounded-lg border border-line bg-paper p-6 text-sm font-bold text-muted shadow-sm">
          Le mode admin est desactive.
        </div>
      </section>
    </>
  );
}

export default async function ProductPhotoChecklistPage() {
  if (!isAdminModeEnabled()) {
    return lockedAdminState();
  }

  const data = await readPageData();
  const manifest = data.manifest;
  const missingCount =
    (manifest?.expectedImageCount ?? 0) - (manifest?.presentValidWebpCount ?? 0);

  if (!manifest) {
    return (
      <>
        <PageHeader
          eyebrow="Admin"
          title="Checklist photos produits"
          description="Aucun manifest photo disponible pour generer la checklist."
        />
        <section className="container-page py-10">
          <div className="rounded-lg border border-line bg-paper p-6 text-sm font-bold text-muted shadow-sm">
            Lancez `npm run catalog:photo-drop-kit`.
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          header, footer, .no-print { display: none !important; }
          body { background: #ffffff !important; }
          .print-sheet { width: 100% !important; margin: 0 !important; padding: 0 !important; }
          .print-card { break-inside: avoid; box-shadow: none !important; }
          .print-task { break-inside: avoid; }
        }
      `}</style>
      <div className="no-print">
        <PageHeader
          eyebrow="Admin"
          title="Checklist photos produits"
          description="Version lisible et imprimable du sprint photo, avec les noms exacts a deposer et les verrous HOLD."
        />
      </div>

      <main className="print-sheet container-page grid gap-6 py-10">
        <section className="no-print flex min-w-0 flex-col justify-between gap-4 rounded-lg border border-line bg-paper p-5 shadow-sm lg:flex-row lg:items-center">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase text-teal">
              {manifest.generatedAtLocal}
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {missingCount} photos a valider sur {manifest.expectedImageCount}
            </h2>
            <p className="mt-2 break-all text-sm leading-6 text-muted">
              {data.paths.checklistPath ?? data.paths.manifestPath}
            </p>
          </div>
          <Link
            href="/admin/photos-produits"
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
          >
            Atelier photos
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>

        <section className="print-card rounded-lg border border-line bg-paper p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase text-teal">Synthese sprint</p>
              <h1 className="mt-2 text-3xl font-black">Checklist photos produits</h1>
            </div>
            <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line px-3 text-sm font-black">
              <ClipboardCheck size={16} aria-hidden="true" />
              HOLD manuel
            </span>
          </div>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md bg-[#f6f1e8] p-3">
              <dt className="font-black uppercase text-muted">Produits</dt>
              <dd className="mt-1 text-2xl font-black">{manifest.productCount}</dd>
            </div>
            <div className="rounded-md bg-[#f6f1e8] p-3">
              <dt className="font-black uppercase text-muted">Photos attendues</dt>
              <dd className="mt-1 text-2xl font-black">{manifest.expectedImageCount}</dd>
            </div>
            <div className="rounded-md bg-[#f6f1e8] p-3">
              <dt className="font-black uppercase text-muted">WebP valides</dt>
              <dd className="mt-1 text-2xl font-black">{manifest.presentValidWebpCount}</dd>
            </div>
            <div className="rounded-md bg-[#fff8e6] p-3">
              <dt className="font-black uppercase text-muted">A produire</dt>
              <dd className="mt-1 text-2xl font-black">{missingCount}</dd>
            </div>
          </dl>
        </section>

        <section className="grid gap-5">
          {manifest.products.map((product) => (
            <article
              key={product.productId}
              className="print-card rounded-lg border border-line bg-paper p-5 shadow-sm"
            >
              <div className="flex flex-col gap-3 border-b border-line pb-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase text-muted">
                    #{product.rank} - {product.categoryId}
                  </p>
                  <h2 className="mt-1 text-2xl font-black">{product.productName}</h2>
                  <p className="mt-2 break-all text-sm font-bold text-muted">
                    Depot: {product.dropFolderRelative}
                  </p>
                </div>
                <span className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-[#f6d38b] bg-[#fff8e6] px-3 text-sm font-black text-[#8a5a00]">
                  <LockKeyhole size={16} aria-hidden="true" />
                  {product.humanGateStatus.replace(/_/g, " ")}
                </span>
              </div>

              <div className="mt-4 grid gap-4">
                {product.imageTasks.map((task) => (
                  <div
                    key={`${product.productId}-${task.order}`}
                    className="print-task rounded-md border border-line bg-[#fbfaf7] p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase text-teal">
                          Photo {task.order} - {task.role}
                        </p>
                        <h3 className="mt-1 break-all text-lg font-black">
                          {task.expectedFileName}
                        </h3>
                        <p className="mt-2 text-sm font-bold leading-6">
                          {task.requiredShot}
                        </p>
                      </div>
                      <span className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border border-line bg-paper px-3 text-xs font-black uppercase text-muted">
                        <FileCheck2 size={14} aria-hidden="true" />
                        {task.stagingStatus}
                      </span>
                    </div>

                    <dl className="mt-3 grid gap-2 text-xs leading-5 md:grid-cols-2">
                      <div>
                        <dt className="font-black uppercase text-muted">Chemin depot</dt>
                        <dd className="mt-1 break-all">{task.stagingRelativePath}</dd>
                      </div>
                      <div>
                        <dt className="font-black uppercase text-muted">URL cible future</dt>
                        <dd className="mt-1 break-all">{task.targetPublicUrl}</dd>
                      </div>
                    </dl>

                    <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                      {reviewChecks.map((check) => (
                        <li key={`${task.productId}-${task.order}-${check}`} className="flex gap-2">
                          <span
                            className="mt-0.5 inline-flex h-4 w-4 shrink-0 rounded border border-foreground"
                            aria-hidden="true"
                          />
                          <span>{check}</span>
                        </li>
                      ))}
                    </ul>

                    <p className="mt-4 rounded-md bg-[#fff8e6] p-3 text-xs font-bold leading-5 text-[#8a5a00]">
                      HOLD jusqu&apos;a: {task.keepHoldUntil.join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="print-card rounded-lg border border-line bg-[#171717] p-5 text-white shadow-sm">
          <p className="text-sm font-black uppercase text-brand">Verrous avant copie publique</p>
          <ul className="mt-4 grid gap-2 text-sm font-bold text-white/78 md:grid-cols-2">
            <li>Aucune copie automatique vers les uploads publics</li>
            <li>Aucune image fournisseur non autorisee</li>
            <li>Aucune publication automatique</li>
            <li>Validation Mouss obligatoire</li>
          </ul>
          <p className="mt-4 break-all text-xs font-bold text-white/60">
            CSV local: {data.paths.csvPath ?? "non trouve"}
          </p>
        </section>
      </main>
    </>
  );
}

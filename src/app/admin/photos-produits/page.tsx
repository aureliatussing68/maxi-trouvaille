import { promises as fs, type Dirent } from "fs";
import path from "path";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileImage,
  FolderOpen,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { isAdminModeEnabled } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin photos produits",
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
  stagingBytes: number;
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
  extraFiles: string[];
  imageTasks: PhotoTask[];
};

type PhotoManifest = {
  ok: boolean;
  generatedAtLocal: string;
  mode: string;
  productCount: number;
  expectedImageCount: number;
  presentValidWebpCount: number;
  invalidStagingFileCount: number;
  extraFileCount: number;
  outputDirRelative: string;
  products: PhotoProduct[];
  safety: Record<string, boolean>;
};

type SprintTask = {
  order: number;
  role: string;
  requiredShot: string;
  outputMustBe: string[];
  keepHoldUntil: string[];
};

type SprintProduct = {
  productId: string;
  productName: string;
  actionMode: string;
  recommendedFirstMove: string;
  humanGateBlockers: string[];
  imageTasks: SprintTask[];
};

type PhotoSprint = {
  generatedAtLocal: string;
  imageTaskCount: number;
  excludedProductCount: number;
  products: SprintProduct[];
  excludedProducts?: Array<{
    productId: string;
    productName: string;
    reason: string;
  }>;
};

type PageData = {
  manifest: PhotoManifest | null;
  sprint: PhotoSprint | null;
  paths: {
    manifestPath?: string;
    sprintPath?: string;
  };
};

type PhotoTaskToProduce = {
  productRank: number;
  productId: string;
  productName: string;
  categoryId: string;
  dropFolderRelative: string;
  task: PhotoTask;
};

const photoDropRoot = path.join(
  process.cwd(),
  "business-maxi-trouvailles",
  "depots-photos",
);
const actionRoot = path.join(
  process.cwd(),
  "business-maxi-trouvailles",
  "tableaux-action",
);

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

async function latestFile(dir: string, prefix: string) {
  const files = await collectFiles(
    dir,
    (name) => name.startsWith(prefix) && name.endsWith(".json"),
  );
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
  const [manifestPath, sprintPath] = await Promise.all([
    latestFile(photoDropRoot, "MANIFEST_DEPOT_PHOTOS_SPRINT_"),
    latestFile(actionRoot, "PHOTO_SPRINT_DU_JOUR_"),
  ]);
  const [manifest, sprint] = await Promise.all([
    readJson<PhotoManifest>(manifestPath),
    readJson<PhotoSprint>(sprintPath),
  ]);

  return {
    manifest,
    sprint,
    paths: {
      manifestPath: manifestPath ? path.relative(process.cwd(), manifestPath) : undefined,
      sprintPath: sprintPath ? path.relative(process.cwd(), sprintPath) : undefined,
    },
  };
}

function sprintByProduct(sprint: PhotoSprint | null) {
  return new Map((sprint?.products ?? []).map((product) => [product.productId, product]));
}

function photosToProduceNow(manifest: PhotoManifest) {
  return manifest.products
    .flatMap((product) =>
      product.imageTasks
        .filter((task) => !task.stagingFilePresent || !task.stagingWebpValid)
        .map<PhotoTaskToProduce>((task) => ({
          productRank: product.rank,
          productId: product.productId,
          productName: product.productName,
          categoryId: product.categoryId,
          dropFolderRelative: product.dropFolderRelative,
          task,
        })),
    )
    .sort((a, b) => a.productRank - b.productRank || a.task.order - b.task.order);
}

function statusClasses(status: string) {
  if (status.startsWith("OK_") || status.includes("ready") || status.includes("valid")) {
    return "border-teal/25 bg-[#ecfdf5] text-teal";
  }

  if (status.includes("invalid")) {
    return "border-rose/25 bg-[#fff1f2] text-rose";
  }

  return "border-[#f6d38b] bg-[#fff8e6] text-[#8a5a00]";
}

function lockedAdminState() {
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Photos produits verrouillees"
        description="Activez ADMIN_MODE=true dans l'environnement local pour ouvrir cet atelier."
      />
      <section className="container-page py-10">
        <div className="rounded-lg border border-line bg-paper p-6 text-sm font-bold text-muted shadow-sm">
          Le mode admin est desactive.
        </div>
      </section>
    </>
  );
}

export default async function AdminProductPhotosPage() {
  if (!isAdminModeEnabled()) {
    return lockedAdminState();
  }

  const data = await readPageData();
  const manifest = data.manifest;
  const sprintMap = sprintByProduct(data.sprint);
  const missingCount =
    (manifest?.expectedImageCount ?? 0) - (manifest?.presentValidWebpCount ?? 0);

  if (!manifest) {
    return (
      <>
        <PageHeader
          eyebrow="Admin"
          title="Atelier photos produits"
          description="Aucun manifest de depot photo disponible."
        />
        <section className="container-page py-10">
          <div className="rounded-lg border border-line bg-paper p-6 text-sm font-bold text-muted shadow-sm">
            Lancez `npm run catalog:photo-drop-kit`.
          </div>
        </section>
      </>
    );
  }

  const productionTasks = photosToProduceNow(manifest);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Atelier photos produits"
        description="Photos WebP exactes a deposer avant revue humaine. Rien n'est copie dans les uploads publics depuis cette page."
      />

      <section className="container-page grid gap-8 py-10">
        <div className="flex min-w-0 flex-col justify-between gap-4 rounded-lg border border-line bg-paper p-5 shadow-sm lg:flex-row lg:items-center">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase text-teal">
              {manifest.generatedAtLocal}
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {missingCount} photos manquantes sur {manifest.expectedImageCount}
            </h2>
            <p className="mt-2 max-w-3xl break-all text-sm leading-6 text-muted">
              {data.paths.manifestPath}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/pilotage"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
            >
              Pilotage
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href="/admin/photos-produits/checklist"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
            >
              Checklist
              <ClipboardCheck size={16} aria-hidden="true" />
            </Link>
            <Link
              href="/admin/ajout-images"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
            >
              Ajout images
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href="/admin/preuves-partenaires"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
            >
              Preuves
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <article className="rounded-lg border border-line bg-paper p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-black text-muted">Produits</span>
              <Camera size={20} className="text-teal" aria-hidden="true" />
            </div>
            <p className="mt-4 text-3xl font-black">{manifest.productCount}</p>
          </article>
          <article className="rounded-lg border border-line bg-paper p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-black text-muted">Photos attendues</span>
              <FileImage size={20} className="text-teal" aria-hidden="true" />
            </div>
            <p className="mt-4 text-3xl font-black">{manifest.expectedImageCount}</p>
          </article>
          <article className="rounded-lg border border-line bg-paper p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-black text-muted">WebP valides</span>
              <CheckCircle2 size={20} className="text-teal" aria-hidden="true" />
            </div>
            <p className="mt-4 text-3xl font-black">{manifest.presentValidWebpCount}</p>
          </article>
          <article className="rounded-lg border border-line bg-paper p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-black text-muted">Manquantes</span>
              <LockKeyhole size={20} className="text-rose" aria-hidden="true" />
            </div>
            <p className="mt-4 text-3xl font-black">{missingCount}</p>
          </article>
          <article className="rounded-lg border border-line bg-paper p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-black text-muted">Invalides</span>
              <ShieldCheck size={20} className="text-teal" aria-hidden="true" />
            </div>
            <p className="mt-4 text-3xl font-black">{manifest.invalidStagingFileCount}</p>
          </article>
        </section>

        <section className="rounded-lg border border-line bg-[#171717] p-5 text-white shadow-sm">
          <p className="text-sm font-black uppercase text-brand">Verrous photos</p>
          <ul className="mt-4 grid gap-2 text-sm font-bold text-white/78 md:grid-cols-2">
            <li>Aucune copie dans `public/uploads/partner-products` depuis cette page</li>
            <li>Aucune image fournisseur non autorisee</li>
            <li>Aucune publication automatique</li>
            <li>Validation Mouss obligatoire avant revue publique</li>
          </ul>
        </section>

        <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-teal">A produire maintenant</p>
              <h2 className="mt-2 text-2xl font-black">
                {productionTasks.length} fichiers WebP a deposer
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                Priorite terrain: produire ou verifier ces fichiers exacts, puis relancer
                l&apos;audit. Tout reste HOLD tant que les preuves ne sont pas completes.
              </p>
            </div>
            <Link
              href="/admin/photos-produits/checklist"
              className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
            >
              Checklist imprimable
              <ClipboardCheck size={16} aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {productionTasks.length ? (
              productionTasks.map(({ productId, productName, categoryId, task }) => (
                <article
                  key={`${productId}-${task.order}-todo`}
                  className="grid min-w-0 gap-3 rounded-md border border-line bg-[#fbfaf7] p-4 lg:grid-cols-[1fr_1.2fr_1.4fr]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-paper px-2 py-1 text-xs font-black">
                        {task.order}. {task.role}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-1 text-[11px] font-black uppercase ${statusClasses(
                          task.stagingStatus,
                        )}`}
                      >
                        {task.stagingFilePresent ? "a valider" : "manquant"}
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-black leading-6">{productName}</h3>
                    <p className="mt-1 text-xs font-black uppercase text-muted">
                      {categoryId}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-muted">Fichier exact</p>
                    <p className="mt-1 break-all text-sm font-black">
                      {task.expectedFileName}
                    </p>
                    <p className="mt-2 text-xs font-bold leading-5 text-muted">
                      {task.stagingRelativePath}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-muted">Cadrage attendu</p>
                    <p className="mt-1 text-sm font-bold leading-6">{task.requiredShot}</p>
                    <p className="mt-2 text-xs font-bold leading-5 text-[#8a5a00]">
                      HOLD jusqu&apos;a: {task.keepHoldUntil.join(", ")}
                    </p>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-md bg-[#ecfdf5] p-4 text-sm font-bold text-teal">
                Aucun fichier en attente dans le manifest actuel. Revue humaine requise avant
                toute copie publique.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-5">
          {manifest.products.map((product) => {
            const sprintProduct = sprintMap.get(product.productId);

            return (
              <article
                key={product.productId}
                className="min-w-0 rounded-lg border border-line bg-paper p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-[#f6f1e8] px-2 py-1 text-xs font-black">
                        #{product.rank}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-1 text-[11px] font-black uppercase ${statusClasses(
                          product.humanGateStatus,
                        )}`}
                      >
                        {product.humanGateStatus.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs font-black uppercase text-muted">
                        {product.categoryId}
                      </span>
                    </div>
                    <h3 className="mt-2 text-xl font-black">{product.productName}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {sprintProduct?.recommendedFirstMove ??
                        "Deposer des WebP exacts ou garder HOLD jusqu'a preuve image."}
                    </p>
                  </div>
                  <span className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black">
                    <FolderOpen size={16} aria-hidden="true" />
                    {product.imageCount} photos
                  </span>
                </div>

                <dl className="mt-5 grid gap-3 border-t border-line pt-4 text-sm md:grid-cols-2">
                  <div>
                    <dt className="font-black uppercase text-muted">Dossier depot</dt>
                    <dd className="mt-1 break-all text-foreground">
                      {product.dropFolderRelative}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-black uppercase text-muted">Dossier public cible futur</dt>
                    <dd className="mt-1 break-all text-foreground">
                      {product.targetFolderPublic}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 grid gap-3">
                  {product.imageTasks.map((task) => (
                    <div
                      key={`${product.productId}-${task.order}`}
                      className="min-w-0 rounded-md border border-line bg-[#fbfaf7] p-4"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-paper px-2 py-1 text-xs font-black">
                              {task.order}. {task.role}
                            </span>
                            <span
                              className={`rounded-md border px-2 py-1 text-[11px] font-black uppercase ${statusClasses(
                                task.stagingStatus,
                              )}`}
                            >
                              {task.stagingStatus}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-bold leading-6">
                            {task.requiredShot}
                          </p>
                        </div>
                        <span className="text-xs font-black uppercase text-muted">
                          {task.stagingFilePresent ? "present" : "absent"}
                        </span>
                      </div>
                      <dl className="mt-3 grid gap-2 text-xs leading-5 md:grid-cols-2">
                        <div>
                          <dt className="font-black uppercase text-muted">Fichier attendu</dt>
                          <dd className="mt-1 break-all text-foreground">
                            {task.expectedFileName}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-black uppercase text-muted">Chemin staging</dt>
                          <dd className="mt-1 break-all text-foreground">
                            {task.stagingRelativePath}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-black uppercase text-muted">URL cible future</dt>
                          <dd className="mt-1 break-all text-foreground">
                            {task.targetPublicUrl}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-black uppercase text-muted">HOLD jusqu&apos;a</dt>
                          <dd className="mt-1 text-foreground">
                            {task.keepHoldUntil.join(", ")}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </section>

        {data.sprint?.excludedProducts?.length ? (
          <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
            <p className="text-sm font-black uppercase text-teal">Hors sprint</p>
            <div className="mt-4 grid gap-3">
              {data.sprint.excludedProducts.map((product) => (
                <div
                  key={product.productId}
                  className="rounded-md bg-[#fff8e6] p-3 text-sm leading-6 text-[#8a5a00]"
                >
                  <span className="font-black">{product.productName}:</span>{" "}
                  {product.reason}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </>
  );
}

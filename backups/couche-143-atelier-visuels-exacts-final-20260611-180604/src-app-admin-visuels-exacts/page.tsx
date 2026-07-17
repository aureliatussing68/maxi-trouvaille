import { promises as fs, type Dirent } from "fs";
import path from "path";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileImage,
  FolderOpen,
  Image as ImageIcon,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { isAdminModeEnabled } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin visuels exacts",
};

type VisualChecklistItem = {
  priority: number;
  fileName: string;
  requiredShot: string;
  stagingRelativePath: string;
  nextAction: string;
  safetyStatus: string;
};

type VisualSessionGroup = {
  groupOrder: number;
  lane: string;
  laneLabel: string;
  urgency: string;
  targetType: string;
  targetName: string;
  targetId: string;
  categoryId: string;
  dropFolderRelative: string;
  status: string;
  itemCount: number;
  missingCount: number;
  readyCount: number;
  firstPriority: number;
  expectedFiles: string[];
  checklist: VisualChecklistItem[];
};

type VisualSessionItem = {
  sessionOrder: number;
  groupOrder: number;
  urgency: string;
  lane: string;
  targetType: string;
  targetName: string;
  targetId: string;
  expectedFileName: string;
  currentStatus: string;
  dropFolderRelative: string;
  stagingRelativePath: string;
  requiredShot: string;
  nextAction: string;
  safetyStatus: string;
  postDepositChecks: string[];
};

type VisualDepositSession = {
  ok: boolean;
  generatedAtLocal: string;
  status: string;
  itemCount: number;
  groupCount: number;
  counts: {
    p0ProductPhotos: number;
    categoryImages: number;
    p1CategoryImages: number;
    p2CategoryImages: number;
  };
  audit: {
    status: string;
    ok: boolean;
    failureCount: number;
    failures: string[];
  };
  outputDir: string;
  sources?: {
    visualBoardPath?: string;
    visualAuditPath?: string;
  };
  groups: VisualSessionGroup[];
  items: VisualSessionItem[];
};

type ReadResult = {
  session: VisualDepositSession;
  sessionPath: string;
};

const actionRoot = path.join(
  process.cwd(),
  "business-maxi-trouvailles",
  "tableaux-action",
);

async function collectSessionFiles(dir: string, out: string[] = []) {
  let entries: Dirent[];

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectSessionFiles(fullPath, out);
    } else if (
      entry.isFile() &&
      entry.name.startsWith("SESSION_DEPOT_VISUELS_EXACTS_") &&
      entry.name.endsWith(".json")
    ) {
      out.push(fullPath);
    }
  }

  return out;
}

async function readLatestSession(): Promise<ReadResult | null> {
  const files = await collectSessionFiles(actionRoot);
  const dated = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      mtimeMs: (await fs.stat(filePath)).mtimeMs,
    })),
  );
  const latest = dated.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];

  if (!latest) {
    return null;
  }

  return {
    session: JSON.parse(await fs.readFile(latest.filePath, "utf8")) as VisualDepositSession,
    sessionPath: path.relative(process.cwd(), latest.filePath),
  };
}

function compactStatus(status: string) {
  return status.replace(/_/g, " ");
}

function statusClasses(status: string) {
  const upperStatus = status.toUpperCase();

  if (upperStatus.startsWith("OK_") || upperStatus.includes("READY")) {
    return "border-teal/25 bg-[#ecfdf5] text-teal";
  }

  if (upperStatus.includes("INVALID") || upperStatus.includes("FAIL")) {
    return "border-rose/25 bg-[#fff1f2] text-rose";
  }

  return "border-[#f6d38b] bg-[#fff8e6] text-[#8a5a00]";
}

function laneHref(lane: string) {
  if (lane === "photo_produit_exacte") {
    return "/admin/photos-produits";
  }

  if (lane === "image_categorie_dropshipping") {
    return "/admin/images-categories";
  }

  return "/admin/pilotage";
}

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function buildSessionCsv(readResult: ReadResult) {
  const headers = [
    "order",
    "group_order",
    "urgency",
    "lane",
    "target_type",
    "target_name",
    "target_id",
    "expected_file",
    "current_status",
    "required_shot",
    "drop_folder",
    "staging_path",
    "post_deposit_checks",
    "safety_status",
  ];
  const rows = readResult.session.items.map((item) => [
    item.sessionOrder,
    item.groupOrder,
    item.urgency,
    item.lane,
    item.targetType,
    item.targetName,
    item.targetId,
    item.expectedFileName,
    item.currentStatus,
    item.requiredShot,
    item.dropFolderRelative,
    item.stagingRelativePath,
    item.postDepositChecks,
    item.safetyStatus,
  ]);

  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function lockedAdminState() {
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Visuels exacts verrouilles"
        description="Activez ADMIN_MODE=true dans l environnement local pour ouvrir cet atelier."
      />
      <section className="container-page py-10">
        <div className="rounded-lg border border-line bg-paper p-6 text-sm font-bold text-muted shadow-sm">
          Le mode admin est desactive.
        </div>
      </section>
    </>
  );
}

function missingSessionState() {
  return (
    <>
      <PageHeader
        eyebrow="Admin dropshipping"
        title="Atelier visuels exacts"
        description="Aucune session de depot WebP exact disponible pour le moment."
      />
      <section className="container-page py-10">
        <div className="rounded-lg border border-[#f6d38b] bg-[#fff8e6] p-6 text-sm font-bold text-[#8a5a00] shadow-sm">
          Session absente. Relancer le pipeline local de preparation des visuels avant
          revue terrain.
        </div>
      </section>
    </>
  );
}

export default async function AdminExactVisualsPage() {
  if (!isAdminModeEnabled()) {
    return lockedAdminState();
  }

  const result = await readLatestSession();

  if (!result) {
    return missingSessionState();
  }

  const { session } = result;
  const exportFilename = "maxi-atelier-visuels-exacts.csv";
  const exportHref = `data:text/csv;charset=utf-8,${encodeURIComponent(
    buildSessionCsv(result),
  )}`;
  const metrics = [
    {
      label: "Visuels WebP",
      value: session.itemCount,
      note: `${session.counts.p0ProductPhotos} produits P0`,
    },
    {
      label: "Groupes",
      value: session.groupCount,
      note: "Dossiers de depot",
    },
    {
      label: "Categories",
      value: session.counts.categoryImages,
      note: `${session.counts.p1CategoryImages} P1 / ${session.counts.p2CategoryImages} P2`,
    },
    {
      label: "Audit",
      value: session.audit.failureCount,
      note: session.audit.ok ? "0 blocage" : "A corriger",
    },
  ];
  const safetyCards = [
    { label: "Copie publique", value: "Aucune" },
    { label: "Publication", value: "Aucune" },
    { label: "Validation Mouss", value: "Requise" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Admin dropshipping"
        title="Atelier visuels exacts"
        description="Session unique pour deposer les WebP exacts avant toute sortie de HOLD."
      />

      <main className="container-page space-y-8 py-8 sm:py-10">
        <section className="rounded-lg border border-line bg-paper p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-black uppercase ${statusClasses(
                    session.status,
                  )}`}
                >
                  {compactStatus(session.status)}
                </span>
                <span className="inline-flex min-h-9 items-center rounded-md border border-teal/25 bg-[#ecfdf5] px-3 text-xs font-black uppercase text-teal">
                  HOLD strict
                </span>
              </div>
              <p className="mt-4 text-sm font-black uppercase text-muted">
                Session generee
              </p>
              <h2 className="mt-1 break-words text-2xl font-black">
                {session.generatedAtLocal}
              </h2>
              <p className="mt-2 break-all text-xs font-bold uppercase text-muted">
                {result.sessionPath}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/pilotage"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
              >
                Pilotage
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                href="/admin/photos-produits"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
              >
                Photos produits
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                href="/admin/images-categories"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
              >
                Images categories
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a
                href={exportHref}
                download={exportFilename}
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
              >
                Exporter CSV
                <Download size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <article
              key={metric.label}
              className="rounded-lg border border-line bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-black uppercase text-muted">{metric.label}</p>
              <p className="mt-2 text-3xl font-black">{metric.value}</p>
              <p className="mt-1 text-xs font-bold uppercase text-muted">{metric.note}</p>
            </article>
          ))}
        </section>

        <section className="rounded-lg border border-line bg-paper p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase text-teal">
                Garde-fous visuels
              </p>
              <h2 className="mt-2 text-2xl font-black">Blocage HOLD maintenu</h2>
              <p className="mt-2 break-all text-xs font-bold uppercase text-muted">
                {session.outputDir}
              </p>
            </div>
            <span
              className={`inline-flex min-h-10 shrink-0 items-center rounded-md border px-3 text-xs font-black uppercase ${statusClasses(
                session.audit.status,
              )}`}
            >
              {compactStatus(session.audit.status)}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {safetyCards.map((card) => (
              <div key={card.label} className="rounded-md bg-white p-3">
                <p className="text-xs font-black uppercase text-muted">{card.label}</p>
                <p className="mt-1 text-lg font-black">{card.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-teal">
                Groupes de depot
              </p>
              <h2 className="mt-2 text-2xl font-black">Dossiers a traiter</h2>
            </div>
            <span className="inline-flex min-h-9 items-center rounded-md border border-line bg-white px-3 text-xs font-black uppercase text-muted">
              {session.groupCount} groupes
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {session.groups.map((group) => (
              <article
                key={`${group.groupOrder}-${group.targetId}`}
                className="min-w-0 rounded-lg border border-line bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex min-h-8 items-center rounded-md bg-foreground px-2 text-xs font-black uppercase text-white">
                        #{group.groupOrder}
                      </span>
                      <span className="inline-flex min-h-8 items-center rounded-md border border-line px-2 text-xs font-black uppercase">
                        {group.urgency}
                      </span>
                      <span
                        className={`inline-flex min-h-8 items-center rounded-md border px-2 text-xs font-black uppercase ${statusClasses(
                          group.status,
                        )}`}
                      >
                        {compactStatus(group.status)}
                      </span>
                    </div>
                    <h3 className="mt-3 break-words text-lg font-black">
                      {group.targetName}
                    </h3>
                    <p className="mt-1 text-xs font-black uppercase text-muted">
                      {group.laneLabel} - {group.targetType}
                    </p>
                  </div>
                  <Link
                    href={laneHref(group.lane)}
                    className="focus-ring inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-line px-3 text-xs font-black uppercase hover:bg-[#f1eadf]"
                  >
                    Atelier source
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-md bg-paper p-3">
                    <p className="text-[11px] font-black uppercase text-muted">
                      Attendus
                    </p>
                    <p className="mt-1 text-xl font-black">{group.itemCount}</p>
                  </div>
                  <div className="rounded-md bg-paper p-3">
                    <p className="text-[11px] font-black uppercase text-muted">
                      Manquants
                    </p>
                    <p className="mt-1 text-xl font-black">{group.missingCount}</p>
                  </div>
                  <div className="rounded-md bg-paper p-3">
                    <p className="text-[11px] font-black uppercase text-muted">
                      Prets
                    </p>
                    <p className="mt-1 text-xl font-black">{group.readyCount}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-md border border-line bg-paper p-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-muted">
                    <FolderOpen size={14} aria-hidden="true" />
                    Dossier depot
                  </div>
                  <p className="mt-2 break-all text-xs font-bold">
                    {group.dropFolderRelative}
                  </p>
                </div>

                <div className="mt-4 space-y-2">
                  {group.expectedFiles.map((fileName) => (
                    <div
                      key={`${group.groupOrder}-${fileName}`}
                      className="flex min-w-0 items-start gap-2 rounded-md border border-line bg-paper p-2"
                    >
                      <FileImage
                        className="mt-0.5 shrink-0 text-teal"
                        size={15}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 break-all text-xs font-bold">
                        {fileName}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-teal">
                Fichiers a deposer
              </p>
              <h2 className="mt-2 text-2xl font-black">Controle par WebP</h2>
            </div>
            <span className="inline-flex min-h-9 items-center rounded-md border border-line bg-white px-3 text-xs font-black uppercase text-muted">
              {session.itemCount} lignes
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {session.items.map((item) => (
              <article
                key={`${item.sessionOrder}-${item.expectedFileName}`}
                className="min-w-0 rounded-lg border border-line bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex min-h-8 items-center rounded-md bg-foreground px-2 text-xs font-black uppercase text-white">
                        {item.sessionOrder}
                      </span>
                      <span className="inline-flex min-h-8 items-center rounded-md border border-line px-2 text-xs font-black uppercase">
                        Groupe {item.groupOrder}
                      </span>
                      <span
                        className={`inline-flex min-h-8 items-center rounded-md border px-2 text-xs font-black uppercase ${statusClasses(
                          item.safetyStatus,
                        )}`}
                      >
                        {compactStatus(item.safetyStatus)}
                      </span>
                    </div>
                    <h3 className="mt-3 break-all text-base font-black">
                      {item.expectedFileName}
                    </h3>
                    <p className="mt-1 break-words text-sm font-bold text-muted">
                      {item.targetName}
                    </p>
                  </div>
                  <span
                    className={`inline-flex min-h-9 shrink-0 items-center rounded-md border px-2 text-xs font-black uppercase ${statusClasses(
                      item.currentStatus,
                    )}`}
                  >
                    {compactStatus(item.currentStatus)}
                  </span>
                </div>

                <div className="mt-4 rounded-md bg-paper p-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-muted">
                    <ImageIcon size={14} aria-hidden="true" />
                    Cadrage requis
                  </div>
                  <p className="mt-2 text-sm font-bold leading-6">
                    {item.requiredShot}
                  </p>
                </div>

                <div className="mt-3 rounded-md border border-line bg-paper p-3">
                  <p className="text-xs font-black uppercase text-muted">
                    Chemin staging
                  </p>
                  <p className="mt-2 break-all text-xs font-bold">
                    {item.stagingRelativePath}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {item.postDepositChecks.map((check) => (
                    <span
                      key={`${item.sessionOrder}-${check}`}
                      className="inline-flex min-h-8 items-center gap-1 rounded-md border border-teal/25 bg-[#ecfdf5] px-2 text-[11px] font-black uppercase text-teal"
                    >
                      <CheckCircle2 size={13} aria-hidden="true" />
                      {check}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-teal/25 bg-[#ecfdf5] p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-black uppercase text-teal">
                <ShieldCheck size={18} aria-hidden="true" />
                Sortie de HOLD
              </div>
              <p className="mt-2 text-sm font-bold leading-6 text-[#075f46]">
                Image exacte, droits image, fournisseur, prix, stock, delai et
                validation humaine restent obligatoires avant toute mise en vente.
              </p>
            </div>
            <LockKeyhole className="shrink-0 text-teal" size={32} aria-hidden="true" />
          </div>
        </section>
      </main>
    </>
  );
}

import { promises as fs, type Dirent } from "fs";
import path from "path";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Download,
  Image as ImageIcon,
  LockKeyhole,
  PackageCheck,
  Printer,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { isAdminModeEnabled } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin pilotage Maxi",
};

type ExecutionLane = {
  lane: string;
  actionCount: number;
  blockedCount: number;
  readyCount: number;
  firstAction: string;
};

type ExecutionAction = {
  rank: number;
  lane: string;
  id: string;
  label: string;
  status: string;
  nextAction: string;
  blockers?: string[];
  sourceFile?: string;
  allowedAction?: string;
  forbiddenActions?: string[];
};

type ExecutionBoard = {
  ok: boolean;
  generatedAtLocal: string;
  actionCount: number;
  lanes: ExecutionLane[];
  metrics: {
    partnerActionCount?: number;
    partnerDraftHoldCount?: number;
    partnerPublishedCount?: number;
    categoryImagesExpected?: number;
    categoryImagesMissing?: number;
    categoryImagesReadyHumanReview?: number;
    productPhotosExpected?: number;
    productPhotosMissing?: number;
    expectedPurchasableCount?: number;
    checkoutFailureCount?: number;
    surpriseFailureCount?: number;
  };
  actions: ExecutionAction[];
  sources?: Record<string, string>;
  safety?: Record<string, boolean>;
  outputDirRelative?: string;
};

type BoardReadResult = {
  board: ExecutionBoard;
  boardPath: string;
};

type PhotoChecklistAudit = {
  status: string;
  generatedAtLocal: string;
  metrics: {
    productCount: number;
    expectedImageCountManifest: number;
    imageTaskCount: number;
    manifestCountOk: boolean;
    validLocalFileCount: number;
    missingLocalFileCount: number;
    invalidLocalFileCount: number;
    checklistMissingCount: number;
    csvMissingCount: number;
  };
  blockers?: string[];
  sources?: Record<string, string | null>;
};

type PhotoChecklistAuditReadResult = {
  audit: PhotoChecklistAudit;
  auditPath: string;
};

const boardRoot = path.join(
  process.cwd(),
  "business-maxi-trouvailles",
  "tableaux-action",
);

function laneLabel(lane: string) {
  const labels: Record<string, string> = {
    garde_fous: "Garde-fous",
    images_categories: "Images categories",
    photos_produits: "Photos produits",
    produits_partenaires: "Produits partenaires",
  };

  return labels[lane] ?? lane.replace(/_/g, " ");
}

function actionHref(action: ExecutionAction) {
  if (action.lane === "produits_partenaires") {
    return "/admin/preuves-partenaires";
  }

  if (action.lane === "garde_fous") {
    return "/admin/dropshipping";
  }

  if (action.lane === "photos_produits") {
    return "/admin/photos-produits";
  }

  if (action.lane === "images_categories") {
    return "/admin/images-categories";
  }

  return "/admin/pilotage";
}

function actionIcon(lane: string) {
  if (lane === "images_categories") return ImageIcon;
  if (lane === "photos_produits") return PackageCheck;
  if (lane === "garde_fous") return ShieldCheck;
  return Truck;
}

function statusClasses(status: string) {
  if (status.startsWith("OK_")) {
    return "border-teal/25 bg-[#ecfdf5] text-teal";
  }

  if (status.includes("FAILURE")) {
    return "border-rose/25 bg-[#fff1f2] text-rose";
  }

  if (status.includes("READY")) {
    return "border-brand-strong/30 bg-[#fff7d6] text-[#805000]";
  }

  return "border-[#f6d38b] bg-[#fff8e6] text-[#8a5a00]";
}

function compactStatus(status: string) {
  return status.replace(/_/g, " ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function collectBoardFiles(dir: string, out: string[] = []) {
  let entries: Dirent[];

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectBoardFiles(fullPath, out);
    } else if (
      entry.isFile() &&
      entry.name.startsWith("EXECUTION_DU_JOUR_MAXI_") &&
      entry.name.endsWith(".json")
    ) {
      out.push(fullPath);
    }
  }

  return out;
}

async function collectPhotoChecklistAuditFiles(dir: string, out: string[] = []) {
  let entries: Dirent[];

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectPhotoChecklistAuditFiles(fullPath, out);
    } else if (
      entry.isFile() &&
      entry.name.startsWith("AUDIT_CHECKLIST_PHOTOS_") &&
      entry.name.endsWith(".json")
    ) {
      out.push(fullPath);
    }
  }

  return out;
}

async function readLatestBoard(): Promise<BoardReadResult | null> {
  const files = await collectBoardFiles(boardRoot);
  const sorted = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      mtimeMs: (await fs.stat(filePath)).mtimeMs,
    })),
  );
  const latest = sorted.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];

  if (!latest) {
    return null;
  }

  const payload = JSON.parse(await fs.readFile(latest.filePath, "utf8")) as unknown;

  if (!isRecord(payload)) {
    return null;
  }

  return {
    board: payload as ExecutionBoard,
    boardPath: path.relative(process.cwd(), latest.filePath),
  };
}

async function readLatestPhotoChecklistAudit(): Promise<PhotoChecklistAuditReadResult | null> {
  const files = await collectPhotoChecklistAuditFiles(boardRoot);
  const sorted = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      mtimeMs: (await fs.stat(filePath)).mtimeMs,
    })),
  );
  const latest = sorted.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];

  if (!latest) {
    return null;
  }

  const payload = JSON.parse(await fs.readFile(latest.filePath, "utf8")) as unknown;

  if (!isRecord(payload)) {
    return null;
  }

  return {
    audit: payload as PhotoChecklistAudit,
    auditPath: path.relative(process.cwd(), latest.filePath),
  };
}

function topBlockers(actions: ExecutionAction[]) {
  const counts = new Map<string, number>();

  for (const action of actions) {
    for (const blocker of action.blockers ?? []) {
      counts.set(blocker, (counts.get(blocker) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
    .slice(0, 8);
}

function safetyLabel(key: string) {
  const labels: Record<string, string> = {
    manualValidationRequired: "Validation humaine",
    noCatalogWrite: "Catalogue bloque",
    noImageDownload: "Telechargement image bloque",
    noImageGeneration: "Generation image bloquee",
    noMessageSent: "Message client bloque",
    noPayment: "Paiement reel bloque",
    noPublicUploadsWrite: "Images publiques bloquees",
    noPublication: "Publication bloquee",
    noSupplierOrder: "Commande fournisseur bloquee",
    readOnly: "Lecture seule",
  };

  return labels[key] ?? key.replace(/([A-Z])/g, " $1").toLowerCase();
}

function metricCards(board: ExecutionBoard) {
  const metrics = board.metrics ?? {};

  return [
    {
      label: "Actions",
      value: board.actionCount,
      note: "tableau du jour",
      icon: ClipboardList,
    },
    {
      label: "Partenaires HOLD",
      value: metrics.partnerDraftHoldCount ?? 0,
      note: `${metrics.partnerPublishedCount ?? 0} publie`,
      icon: LockKeyhole,
    },
    {
      label: "Images categories",
      value: `${metrics.categoryImagesMissing ?? 0}/${metrics.categoryImagesExpected ?? 0}`,
      note: "WebP manquants",
      icon: ImageIcon,
    },
    {
      label: "Photos produits",
      value: `${metrics.productPhotosMissing ?? 0}/${metrics.productPhotosExpected ?? 0}`,
      note: "preuves visuelles",
      icon: PackageCheck,
    },
    {
      label: "Checkout",
      value: metrics.checkoutFailureCount ?? 0,
      note: "echec garde",
      icon: CheckCircle2,
    },
  ];
}

type HoldTodaySummary = {
  partnerHoldCount: number;
  topVerificationCount: number;
  csvReady: boolean;
  printReady: boolean;
  nextProduct: ExecutionAction | null;
};

function holdTodaySummary(board: ExecutionBoard): HoldTodaySummary {
  const metrics = board.metrics ?? {};
  const partnerHoldCount =
    metrics.partnerDraftHoldCount ?? metrics.partnerActionCount ?? 0;
  const partnerActions = (board.actions ?? []).filter(
    (action) => action.lane === "produits_partenaires",
  );
  const nextProduct =
    partnerActions.find((action) => !action.status.startsWith("OK_")) ??
    partnerActions[0] ??
    null;

  return {
    partnerHoldCount,
    topVerificationCount: Math.min(6, partnerHoldCount),
    csvReady: true,
    printReady: true,
    nextProduct,
  };
}

function businessFocusCards(
  board: ExecutionBoard,
  photoChecklistAudit: PhotoChecklistAuditReadResult | null,
) {
  const metrics = board.metrics ?? {};
  const partnerHold = metrics.partnerDraftHoldCount ?? metrics.partnerActionCount ?? 0;
  const categoryMissing = metrics.categoryImagesMissing ?? 0;
  const categoryExpected = metrics.categoryImagesExpected ?? 0;
  const productPhotoMissing =
    photoChecklistAudit?.audit.metrics.missingLocalFileCount ??
    metrics.productPhotosMissing ??
    0;
  const productPhotoExpected =
    photoChecklistAudit?.audit.metrics.expectedImageCountManifest ??
    metrics.productPhotosExpected ??
    0;
  const checkoutFailures = metrics.checkoutFailureCount ?? 0;
  const surpriseFailures = metrics.surpriseFailureCount ?? 0;
  const paymentGuardOk = checkoutFailures === 0 && surpriseFailures === 0;

  return [
    {
      label: "Preuves fournisseur",
      value: partnerHold,
      note: "produits partenaires en HOLD",
      status: partnerHold > 0 ? "HOLD_PREUVES_FOURNISSEUR" : "OK_PREUVES",
      nextAction:
        partnerHold > 0
          ? "Completer les preuves exactes avant toute publication."
          : "Aucun blocage preuve fournisseur dans le tableau.",
      href: "/admin/preuves-partenaires",
      icon: Truck,
    },
    {
      label: "Photos produits",
      value: `${productPhotoMissing}/${productPhotoExpected}`,
      note: "WebP exacts a produire",
      status: productPhotoMissing > 0 ? "HOLD_PHOTOS_PRODUITS" : "READY_HUMAN_REVIEW",
      nextAction:
        productPhotoMissing > 0
          ? "Deposer les WebP exacts dans le dossier sprint."
          : "Verifier les droits image puis revue humaine.",
      href: "/admin/photos-produits",
      icon: PackageCheck,
    },
    {
      label: "Images categories",
      value: `${categoryMissing}/${categoryExpected}`,
      note: "visuels categorie manquants",
      status: categoryMissing > 0 ? "HOLD_IMAGES_CATEGORIES" : "READY_HUMAN_REVIEW",
      nextAction:
        categoryMissing > 0
          ? "Deposer les visuels WebP categories prioritaires."
          : "Preparer la revue humaine des visuels categories.",
      href: "/admin/images-categories",
      icon: ImageIcon,
    },
    {
      label: "Checkout et surprises",
      value: checkoutFailures + surpriseFailures,
      note: "echecs garde-fous",
      status: paymentGuardOk ? "OK_GARDE_FOUS" : "FAILURE_GARDE_FOUS",
      nextAction: paymentGuardOk
        ? "Paiement reel, publication et commandes fournisseur restent bloques."
        : "Corriger les garde-fous panier, paiement ou produits a venir.",
      href: "/admin/dropshipping",
      icon: ShieldCheck,
    },
  ];
}

function lockedAdminState() {
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Pilotage verrouille"
        description="Activez ADMIN_MODE=true dans l'environnement local pour ouvrir le cockpit."
      />
      <section className="container-page py-10">
        <div className="rounded-lg border border-line bg-paper p-6 text-sm font-bold text-muted shadow-sm">
          Le mode admin est desactive.
        </div>
      </section>
    </>
  );
}

export default async function AdminPilotagePage() {
  if (!isAdminModeEnabled()) {
    return lockedAdminState();
  }

  const [result, photoChecklistAudit] = await Promise.all([
    readLatestBoard(),
    readLatestPhotoChecklistAudit(),
  ]);

  if (!result) {
    return (
      <>
        <PageHeader
          eyebrow="Admin"
          title="Pilotage Maxi"
          description="Aucun tableau d'execution local disponible."
        />
        <section className="container-page py-10">
          <div className="rounded-lg border border-line bg-paper p-6 text-sm font-bold text-muted shadow-sm">
            Lancez `npm run catalog:daily-execution-board` pour generer le cockpit.
          </div>
        </section>
      </>
    );
  }

  const { board, boardPath } = result;
  const blockers = topBlockers(board.actions ?? []);
  const safetyEntries = Object.entries(board.safety ?? {}).filter(([, value]) => value);
  const priorityActions = (board.actions ?? []).slice(0, 18);
  const focusCards = businessFocusCards(board, photoChecklistAudit);
  const holdToday = holdTodaySummary(board);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Pilotage Maxi - chantier du jour"
        description="Priorites, blocages et garde-fous pour avancer sans publication automatique."
      />

      <section className="container-page grid gap-8 py-10">
        <div className="flex min-w-0 flex-col justify-between gap-4 rounded-lg border border-line bg-paper p-5 shadow-sm lg:flex-row lg:items-center">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase text-teal">
              {board.generatedAtLocal}
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Tableau aligne sur les audits locaux
            </h2>
            <p className="mt-2 max-w-3xl break-all text-sm leading-6 text-muted">
              {boardPath}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/dropshipping"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
            >
              Commandes
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href="/admin/preuves-partenaires"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
            >
              Preuves
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href="/admin/images-categories"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
            >
              Images
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href="/admin/photos-produits"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
            >
              Photos
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href="/admin/selection-produits"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
            >
              Selection
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {metricCards(board).map((metric) => {
            const Icon = metric.icon;

            return (
              <article
                key={metric.label}
                className="rounded-lg border border-line bg-paper p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-black text-muted">{metric.label}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#ecfdf5] text-teal">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-4 text-3xl font-black">{metric.value}</p>
                <p className="mt-1 text-xs font-bold uppercase text-muted">
                  {metric.note}
                </p>
              </article>
            );
          })}
        </section>

        <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase text-teal">HOLD du jour</p>
              <h2 className="mt-2 text-2xl font-black">
                Verification dropshipping prioritaire
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                Recap actionnable pour traiter les fiches partenaires sans publier,
                sans paiement et sans commande fournisseur.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/preuves-partenaires?status=hold#top-verification"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
              >
                Top verification
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                href="/admin/preuves-partenaires?status=hold#top-verification"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
              >
                CSV / print
                <Download size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md bg-[#f6f1e8] p-4">
              <p className="text-xs font-black uppercase text-muted">Fiches HOLD</p>
              <p className="mt-2 text-3xl font-black">{holdToday.partnerHoldCount}</p>
              <p className="mt-1 text-xs font-bold uppercase text-muted">
                partenaires a prouver
              </p>
            </div>
            <div className="rounded-md bg-[#fff8e6] p-4">
              <p className="text-xs font-black uppercase text-muted">Top verification</p>
              <p className="mt-2 text-3xl font-black">
                {holdToday.topVerificationCount}
              </p>
              <p className="mt-1 text-xs font-bold uppercase text-muted">
                fiches a attaquer
              </p>
            </div>
            <div className="rounded-md bg-[#ecfdf5] p-4">
              <p className="flex items-center gap-2 text-xs font-black uppercase text-muted">
                <Download size={14} aria-hidden="true" />
                CSV court
              </p>
              <p className="mt-2 text-2xl font-black">
                {holdToday.csvReady ? "Pret" : "A refaire"}
              </p>
              <p className="mt-1 text-xs font-bold uppercase text-muted">
                export terrain top
              </p>
            </div>
            <div className="rounded-md bg-[#ecfdf5] p-4">
              <p className="flex items-center gap-2 text-xs font-black uppercase text-muted">
                <Printer size={14} aria-hidden="true" />
                Impression
              </p>
              <p className="mt-2 text-2xl font-black">
                {holdToday.printReady ? "Prete" : "A refaire"}
              </p>
              <p className="mt-1 text-xs font-bold uppercase text-muted">
                mini fiches terrain
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-line bg-[#fbfaf7] p-4">
            <p className="text-xs font-black uppercase text-muted">
              Prochain produit a verifier
            </p>
            {holdToday.nextProduct ? (
              <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-black leading-6">
                    {holdToday.nextProduct.label}
                  </h3>
                  <p className="mt-2 text-sm font-bold leading-6 text-muted">
                    {holdToday.nextProduct.nextAction}
                  </p>
                  <span
                    className={`mt-3 inline-flex rounded-md border px-2 py-1 text-[11px] font-black uppercase ${statusClasses(
                      holdToday.nextProduct.status,
                    )}`}
                  >
                    {compactStatus(holdToday.nextProduct.status)}
                  </span>
                </div>
                <Link
                  href={`/admin/preuves-partenaires?status=hold#preuve-${holdToday.nextProduct.id}`}
                  className="focus-ring inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
                >
                  Ouvrir preuve
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <p className="mt-2 text-sm font-bold text-muted">
                Aucun produit partenaire actif dans le tableau du jour.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-teal">
                Lecture business rapide
              </p>
              <h2 className="mt-2 text-2xl font-black">Ce qui bloque la vente propre</h2>
            </div>
            <span className="rounded-md border border-line px-3 py-2 text-xs font-black uppercase text-muted">
              Sans action sensible
            </span>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-4">
            {focusCards.map((card, index) => {
              const Icon = card.icon;

              return (
                <article
                  key={card.label}
                  className="min-w-0 rounded-md border border-line bg-[#fbfaf7] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase text-muted">
                        Etape {index + 1}
                      </p>
                      <h3 className="mt-1 text-lg font-black leading-6">{card.label}</h3>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-foreground text-brand">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                  </div>
                  <p className="mt-4 text-3xl font-black">{card.value}</p>
                  <p className="mt-1 text-xs font-bold uppercase text-muted">{card.note}</p>
                  <span
                    className={`mt-3 inline-flex rounded-md border px-2 py-1 text-[11px] font-black uppercase ${statusClasses(
                      card.status,
                    )}`}
                  >
                    {compactStatus(card.status)}
                  </span>
                  <p className="mt-3 text-sm font-bold leading-6 text-muted">
                    {card.nextAction}
                  </p>
                  <Link
                    href={card.href}
                    className="focus-ring mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
                  >
                    Ouvrir
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        {photoChecklistAudit ? (
          <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-black uppercase text-teal">
                  Audit checklist photos
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-black">Depot photo synchronise</h2>
                  <span
                    className={`rounded-md border px-2 py-1 text-[11px] font-black uppercase ${statusClasses(
                      photoChecklistAudit.audit.status,
                    )}`}
                  >
                    {compactStatus(photoChecklistAudit.audit.status)}
                  </span>
                </div>
                <p className="mt-2 max-w-3xl break-all text-sm leading-6 text-muted">
                  {photoChecklistAudit.auditPath}
                </p>
              </div>
              <Link
                href="/admin/photos-produits/checklist"
                className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
              >
                Checklist
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-md bg-[#f6f1e8] p-3">
                <p className="text-xs font-black uppercase text-muted">Produits</p>
                <p className="mt-1 text-2xl font-black">
                  {photoChecklistAudit.audit.metrics.productCount}
                </p>
              </div>
              <div className="rounded-md bg-[#f6f1e8] p-3">
                <p className="text-xs font-black uppercase text-muted">Taches</p>
                <p className="mt-1 text-2xl font-black">
                  {photoChecklistAudit.audit.metrics.imageTaskCount}/
                  {photoChecklistAudit.audit.metrics.expectedImageCountManifest}
                </p>
              </div>
              <div className="rounded-md bg-[#fff8e6] p-3">
                <p className="text-xs font-black uppercase text-muted">WebP manquants</p>
                <p className="mt-1 text-2xl font-black">
                  {photoChecklistAudit.audit.metrics.missingLocalFileCount}
                </p>
              </div>
              <div className="rounded-md bg-[#ecfdf5] p-3">
                <p className="text-xs font-black uppercase text-muted">Checklist</p>
                <p className="mt-1 text-2xl font-black">
                  {photoChecklistAudit.audit.metrics.checklistMissingCount}
                </p>
              </div>
              <div className="rounded-md bg-[#ecfdf5] p-3">
                <p className="text-xs font-black uppercase text-muted">CSV</p>
                <p className="mt-1 text-2xl font-black">
                  {photoChecklistAudit.audit.metrics.csvMissingCount}
                </p>
              </div>
            </div>
            {photoChecklistAudit.audit.blockers?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {photoChecklistAudit.audit.blockers.map((blocker) => (
                  <span
                    key={blocker}
                    className="rounded-md bg-[#fff8e6] px-3 py-2 text-xs font-black uppercase text-[#8a5a00]"
                  >
                    {blocker}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-4">
          {(board.lanes ?? []).map((lane) => (
            <article
              key={lane.lane}
              className="rounded-lg border border-line bg-paper p-5 shadow-sm"
            >
              <p className="text-sm font-black uppercase text-teal">
                {laneLabel(lane.lane)}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-[#f6f1e8] p-2">
                  <p className="text-lg font-black">{lane.actionCount}</p>
                  <p className="text-[11px] font-bold uppercase text-muted">actions</p>
                </div>
                <div className="rounded-md bg-[#fff8e6] p-2">
                  <p className="text-lg font-black">{lane.blockedCount}</p>
                  <p className="text-[11px] font-bold uppercase text-muted">hold</p>
                </div>
                <div className="rounded-md bg-[#ecfdf5] p-2">
                  <p className="text-lg font-black">{lane.readyCount}</p>
                  <p className="text-[11px] font-bold uppercase text-muted">revue</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-muted">{lane.firstAction}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <div>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase text-teal">Priorites</p>
                <h2 className="mt-2 text-2xl font-black">Actions a traiter</h2>
              </div>
              <span className="rounded-md border border-line bg-paper px-3 py-2 text-xs font-black uppercase text-muted">
                {priorityActions.length} visibles
              </span>
            </div>

            <div className="grid min-w-0 gap-3">
              {priorityActions.map((action) => {
                const Icon = actionIcon(action.lane);

                return (
                  <article
                    key={`${action.rank}-${action.id}`}
                    className="min-w-0 rounded-lg border border-line bg-paper p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-foreground text-brand">
                          <Icon size={18} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-[#f6f1e8] px-2 py-1 text-xs font-black">
                              #{action.rank}
                            </span>
                            <span
                              className={`rounded-md border px-2 py-1 text-[11px] font-black uppercase ${statusClasses(
                                action.status,
                              )}`}
                            >
                              {compactStatus(action.status)}
                            </span>
                            <span className="text-xs font-black uppercase text-muted">
                              {laneLabel(action.lane)}
                            </span>
                          </div>
                          <h3 className="mt-2 text-lg font-black leading-6">
                            {action.label}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-muted">
                            {action.nextAction}
                          </p>
                        </div>
                      </div>
                      <Link
                        href={actionHref(action)}
                        className="focus-ring inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
                      >
                        Ouvrir
                        <ArrowRight size={15} aria-hidden="true" />
                      </Link>
                    </div>
                    {action.allowedAction || action.sourceFile ? (
                      <dl className="mt-4 grid gap-2 border-t border-line pt-3 text-xs leading-5 sm:grid-cols-2">
                        <div>
                          <dt className="font-black uppercase text-muted">Action autorisee</dt>
                          <dd className="mt-1 text-foreground">
                            {action.allowedAction ?? "Revue HOLD uniquement"}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-black uppercase text-muted">Source locale</dt>
                          <dd className="mt-1 break-all text-foreground">
                            {action.sourceFile ?? "non renseignee"}
                          </dd>
                        </div>
                      </dl>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="grid content-start gap-4">
            <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
              <p className="text-sm font-black uppercase text-teal">Blocages</p>
              <h2 className="mt-2 text-2xl font-black">A lever</h2>
              <div className="mt-4 grid gap-2">
                {blockers.length ? (
                  blockers.map(([blocker, count]) => (
                    <div
                      key={blocker}
                      className="flex items-center justify-between gap-3 rounded-md bg-[#f6f1e8] px-3 py-2 text-sm"
                    >
                      <span className="break-all font-bold text-muted">{blocker}</span>
                      <span className="rounded-md bg-paper px-2 py-1 font-black">
                        {count}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm font-bold text-muted">Aucun blocage actif.</p>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
              <p className="text-sm font-black uppercase text-teal">Securite</p>
              <h2 className="mt-2 text-2xl font-black">Verrous actifs</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {safetyEntries.map(([key]) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-2 rounded-md border border-teal/20 bg-[#ecfdf5] px-3 py-2 text-xs font-black uppercase text-teal"
                  >
                    <ShieldCheck size={14} aria-hidden="true" />
                    {safetyLabel(key)}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-line bg-[#171717] p-5 text-white shadow-sm">
              <p className="text-sm font-black uppercase text-brand">Interdits</p>
              <ul className="mt-4 grid gap-2 text-sm font-bold text-white/78">
                <li>Aucune publication production</li>
                <li>Aucun paiement Stripe reel</li>
                <li>Aucune commande fournisseur</li>
                <li>Aucun message client automatique</li>
              </ul>
            </section>
          </aside>
        </section>
      </section>
    </>
  );
}

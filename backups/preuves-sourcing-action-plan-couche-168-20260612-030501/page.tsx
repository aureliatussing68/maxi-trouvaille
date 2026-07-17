import { promises as fs, type Dirent } from "fs";
import path from "path";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Download,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { isAdminModeEnabled } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin preuves sourcing",
};

type WorkpackProof = {
  rank: number;
  productPriority: number;
  productId: string;
  productSlug?: string;
  productName: string;
  categoryId: string;
  priorityScore?: number;
  supplierMaxCost?: string;
  targetSalePrice?: string;
  targetMargin?: string;
  imageDepositDir: string;
  fieldOrder: number;
  proofZone: string;
  fieldKey: string;
  fieldLabel: string;
  expectedFormat: string;
  rejectIf: string;
  adminHref: string;
  status: string;
  nextAction?: string;
};

type WorkpackPayload = {
  generatedAt: string;
  mode: string;
  status: string;
  proofCount: number;
  auditStatus?: string;
  sources?: Record<string, string | null>;
  structuralFailures?: string[];
  proofs: WorkpackProof[];
  safety?: Record<string, boolean>;
};

type AuditIssue = {
  scope?: string;
  code?: string;
  message?: string;
};

type AuditManualStates = {
  manualValue?: string;
  evidenceNote?: string;
  captureOrFilePath?: string;
  checkedSameArticle?: string;
  moussValidation?: string;
  finalDecision?: string;
  valueFingerprint?: string;
};

type AuditProof = {
  rank: number;
  productId: string;
  productName: string;
  categoryId: string;
  proofZone: string;
  fieldKey: string;
  fieldLabel: string;
  rowPresent: boolean;
  status: string;
  blockerCount: number;
  blockers: string[];
  manualStates?: AuditManualStates;
  adminHref: string;
};

type AuditPayload = {
  generatedAt: string;
  mode: string;
  status: string;
  proofCount: number;
  readyProofCount: number;
  holdProofCount: number;
  structuralFailureCount: number;
  businessBlockerCount: number;
  warningCount: number;
  sources?: Record<string, string | null>;
  structuralFailures?: AuditIssue[];
  warnings?: AuditIssue[];
  proofs: AuditProof[];
  safety?: Record<string, boolean>;
};

type CsvRow = Record<string, string>;

type PageData = {
  workpack: WorkpackPayload | null;
  workpackPath?: string;
  audit: AuditPayload | null;
  auditPath?: string;
  fillableCsvPath?: string;
  fillableRows: CsvRow[];
};

type ProofCard = {
  workpackProof: WorkpackProof | null;
  auditProof: AuditProof | null;
  csvRow: CsvRow | null;
};

const actionRoot = path.join(
  process.cwd(),
  "business-maxi-trouvailles",
  "tableaux-action",
);

const workpackRoot = path.join(
  actionRoot,
  "prochaines-preuves-sourcing-integration-articles",
);

const auditRoot = path.join(
  actionRoot,
  "audit-prochaines-preuves-sourcing-integration-articles",
);

const fillableCsvHeaders = [
  "rank",
  "product_priority",
  "product_id",
  "product_name",
  "category_id",
  "proof_zone",
  "field_order",
  "field_key",
  "field_label",
  "expected_format",
  "reject_if",
  "status",
  "admin_href",
  "image_deposit_dir",
  "manual_value",
  "evidence_note",
  "capture_or_file_path",
  "checked_same_article",
  "mouss_validation",
  "final_decision",
];

async function collectFiles(
  dir: string,
  matches: (name: string) => boolean,
  out: string[] = [],
) {
  let entries: Dirent[];

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectFiles(fullPath, matches, out);
    } else if (entry.isFile() && matches(entry.name)) {
      out.push(fullPath);
    }
  }

  return out;
}

async function latestFile(dir: string, matches: (name: string) => boolean) {
  const files = await collectFiles(dir, matches);
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

function normalizeAbsolutePath(filePath?: string | null) {
  if (!filePath) {
    return undefined;
  }

  return path.isAbsolute(filePath) ? filePath : undefined;
}

function displayPath(filePath?: string | null) {
  if (!filePath) {
    return "Non trouve";
  }

  const absolutePath = normalizeAbsolutePath(filePath) ?? filePath;
  const relativePath = path.relative(process.cwd(), absolutePath);

  if (!relativePath || relativePath.startsWith("..")) {
    return absolutePath;
  }

  return relativePath;
}

function parseCsvLine(line: string, separator = ";") {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === separator && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0] ?? "");

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<CsvRow>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

async function readCsv(filePath?: string): Promise<CsvRow[]> {
  if (!filePath) {
    return [];
  }

  try {
    return parseCsv(await fs.readFile(filePath, "utf8"));
  } catch {
    return [];
  }
}

async function readPageData(): Promise<PageData> {
  const [workpackPath, auditPath] = await Promise.all([
    latestFile(
      workpackRoot,
      (name) =>
        name.startsWith("PROCHAINES_PREUVES_SOURCING_INTEGRATION_") &&
        name.endsWith(".json"),
    ),
    latestFile(
      auditRoot,
      (name) =>
        name.startsWith("AUDIT_PROCHAINES_PREUVES_SOURCING_INTEGRATION_") &&
        name.endsWith(".json"),
    ),
  ]);

  const [workpack, audit] = await Promise.all([
    readJson<WorkpackPayload>(workpackPath),
    readJson<AuditPayload>(auditPath),
  ]);
  const sourceCsvPath = normalizeAbsolutePath(audit?.sources?.fillableCsvPath);
  const fallbackCsvPath = workpackPath
    ? await latestFile(
        path.dirname(workpackPath),
        (name) =>
          name.startsWith("A_REMPLIR_PREUVES_SOURCING_INTEGRATION_") &&
          name.endsWith(".csv"),
      )
    : undefined;
  const fillableCsvPath = sourceCsvPath ?? fallbackCsvPath;
  const fillableRows = await readCsv(fillableCsvPath);

  return {
    workpack,
    workpackPath: workpackPath ? displayPath(workpackPath) : undefined,
    audit,
    auditPath: auditPath ? displayPath(auditPath) : undefined,
    fillableCsvPath: fillableCsvPath ? displayPath(fillableCsvPath) : undefined,
    fillableRows,
  };
}

function proofKey(rank: number | string, productId: string, fieldKey: string) {
  return `${rank}:${productId}:${fieldKey}`;
}

function buildProofCards(data: PageData): ProofCard[] {
  const auditByKey = new Map(
    (data.audit?.proofs ?? []).map((proof) => [
      proofKey(proof.rank, proof.productId, proof.fieldKey),
      proof,
    ]),
  );
  const csvByKey = new Map(
    data.fillableRows.map((row) => [
      proofKey(row.rank, row.product_id, row.field_key),
      row,
    ]),
  );
  const cards = (data.workpack?.proofs ?? []).map((proof) => ({
    workpackProof: proof,
    auditProof: auditByKey.get(proofKey(proof.rank, proof.productId, proof.fieldKey)) ?? null,
    csvRow: csvByKey.get(proofKey(proof.rank, proof.productId, proof.fieldKey)) ?? null,
  }));

  if (cards.length) {
    return cards;
  }

  return (data.audit?.proofs ?? []).map((proof) => ({
    workpackProof: null,
    auditProof: proof,
    csvRow: csvByKey.get(proofKey(proof.rank, proof.productId, proof.fieldKey)) ?? null,
  }));
}

function compactStatus(status?: string | null) {
  return String(status || "HOLD").replace(/_/g, " ");
}

function statusClasses(status?: string | null) {
  const upperStatus = String(status ?? "").toUpperCase();

  if (upperStatus.includes("READY") || upperStatus.startsWith("OK_")) {
    return "border-teal/25 bg-[#ecfdf5] text-teal";
  }

  if (upperStatus.includes("FAIL") || upperStatus.includes("INVALID")) {
    return "border-rose/25 bg-[#fff1f2] text-rose";
  }

  return "border-[#f6d38b] bg-[#fff8e6] text-[#8a5a00]";
}

function formatDate(value?: string) {
  if (!value) {
    return "Date inconnue";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

function csvCell(value: unknown) {
  const cleanValue = String(value ?? "")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return `"${cleanValue.replace(/"/g, '""')}"`;
}

function buildAuditCsv(data: PageData, cards: ProofCard[]) {
  const headers = [
    "rank",
    "product_id",
    "product_name",
    "category_id",
    "proof_zone",
    "field_key",
    "field_label",
    "status",
    "blocker_count",
    "blockers",
    "manual_value_state",
    "evidence_note_state",
    "capture_state",
    "same_article_state",
    "mouss_validation_state",
    "final_decision_state",
    "value_fingerprint",
    "admin_href",
    "source_audit",
  ];
  const rows = cards.map(({ workpackProof, auditProof, csvRow }) => {
    const states = auditProof?.manualStates ?? {};
    return [
      workpackProof?.rank ?? auditProof?.rank ?? csvRow?.rank ?? "",
      workpackProof?.productId ?? auditProof?.productId ?? csvRow?.product_id ?? "",
      workpackProof?.productName ?? auditProof?.productName ?? csvRow?.product_name ?? "",
      workpackProof?.categoryId ?? auditProof?.categoryId ?? csvRow?.category_id ?? "",
      workpackProof?.proofZone ?? auditProof?.proofZone ?? csvRow?.proof_zone ?? "",
      workpackProof?.fieldKey ?? auditProof?.fieldKey ?? csvRow?.field_key ?? "",
      workpackProof?.fieldLabel ?? auditProof?.fieldLabel ?? csvRow?.field_label ?? "",
      auditProof?.status ?? workpackProof?.status ?? csvRow?.status ?? "",
      auditProof?.blockerCount ?? "",
      auditProof?.blockers?.join(" | ") ?? "",
      states.manualValue ?? "unknown",
      states.evidenceNote ?? "unknown",
      states.captureOrFilePath ?? "unknown",
      states.checkedSameArticle ?? "unknown",
      states.moussValidation ?? "unknown",
      states.finalDecision ?? "unknown",
      states.valueFingerprint ?? "",
      auditProof?.adminHref ?? workpackProof?.adminHref ?? csvRow?.admin_href ?? "",
      data.auditPath ?? "",
    ];
  });

  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\r\n");
}

function buildBlankFillableCsv(rows: CsvRow[]) {
  const headers = rows[0] ? Object.keys(rows[0]) : fillableCsvHeaders;
  const manualColumns = new Set([
    "manual_value",
    "evidence_note",
    "capture_or_file_path",
    "checked_same_article",
    "mouss_validation",
  ]);
  const outputRows = rows.length
    ? rows.map((row) =>
        headers.map((header) => {
          if (manualColumns.has(header)) {
            return "";
          }

          if (header === "final_decision") {
            return "HOLD_TO_FILL";
          }

          return row[header] ?? "";
        }),
      )
    : [];

  return [
    headers.map(csvCell).join(","),
    ...outputRows.map((row) => row.map(csvCell).join(",")),
  ].join("\r\n");
}

function topBlockers(proofs: AuditProof[]) {
  const counts = new Map<string, number>();

  for (const proof of proofs) {
    for (const blocker of proof.blockers ?? []) {
      counts.set(blocker, (counts.get(blocker) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8);
}

function safetyLabels(safety?: Record<string, boolean>) {
  return Object.entries(safety ?? {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => compactStatus(key));
}

function stateLabel(value?: string) {
  return compactStatus(value ?? "missing");
}

function lockedAdminState() {
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Preuves sourcing verrouillees"
        description="Activez ADMIN_MODE=true dans l environnement local pour ouvrir cet atelier."
      />
      <section className="container-page py-10">
        <div className="rounded-md border border-line bg-paper p-6 text-sm font-bold text-muted shadow-sm">
          <LockKeyhole className="mb-3 text-teal" size={28} aria-hidden="true" />
          Atelier verrouille: aucune preuve fournisseur n est affichee hors mode
          admin local.
        </div>
      </section>
    </>
  );
}

function missingDataState() {
  return (
    <>
      <PageHeader
        eyebrow="Admin dropshipping"
        title="Atelier preuves sourcing"
        description="Aucun workpack de prochaines preuves sourcing n est disponible pour le moment."
      />
      <main className="container-page py-10">
        <section className="rounded-md border border-[#f6d38b] bg-[#fff8e6] p-6 text-sm font-bold text-[#8a5a00] shadow-sm">
          Lancez `npm run catalog:integration-next-proofs-workpack` puis
          `npm run catalog:audit-integration-next-proofs-workpack` pour remplir
          cet atelier.
        </section>
      </main>
    </>
  );
}

export default async function AdminSourcingProofsPage() {
  if (!isAdminModeEnabled()) {
    return lockedAdminState();
  }

  const data = await readPageData();

  if (!data.workpack && !data.audit) {
    return missingDataState();
  }

  const cards = buildProofCards(data);
  const auditExportHref = `data:text/csv;charset=utf-8,${encodeURIComponent(
    buildAuditCsv(data, cards),
  )}`;
  const templateExportHref = `data:text/csv;charset=utf-8,${encodeURIComponent(
    buildBlankFillableCsv(data.fillableRows),
  )}`;
  const safety = safetyLabels(data.audit?.safety ?? data.workpack?.safety);
  const blockers = topBlockers(data.audit?.proofs ?? []);
  const status = data.audit?.status ?? data.workpack?.status ?? "HOLD";
  const metrics = [
    {
      label: "Preuves",
      value: data.audit?.proofCount ?? data.workpack?.proofCount ?? cards.length,
      tone: "bg-[#ecfdf5] text-teal",
    },
    {
      label: "Revue possible",
      value: data.audit?.readyProofCount ?? 0,
      tone: "bg-[#ecfdf5] text-teal",
    },
    {
      label: "Encore HOLD",
      value: data.audit?.holdProofCount ?? cards.length,
      tone: "bg-[#fff8e6] text-[#8a5a00]",
    },
    {
      label: "Blocages",
      value: data.audit?.businessBlockerCount ?? 0,
      tone: "bg-[#fff8e6] text-[#8a5a00]",
    },
    {
      label: "Structure",
      value: data.audit?.structuralFailureCount ?? 0,
      tone: data.audit?.structuralFailureCount
        ? "bg-[#fff1f2] text-rose"
        : "bg-[#ecfdf5] text-teal",
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Admin dropshipping"
        title="Atelier preuves sourcing"
        description="Guide terrain lecture seule pour remplir les prochaines preuves fournisseur sans publier, commander ni exposer de valeur brute."
      />

      <main className="container-page space-y-8 py-8 sm:py-10">
        <section className="rounded-md border border-line bg-paper p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-black uppercase ${statusClasses(
                    status,
                  )}`}
                >
                  {compactStatus(status)}
                </span>
                <span className="inline-flex min-h-9 items-center rounded-md border border-line bg-white px-3 text-xs font-black uppercase text-muted">
                  Lecture seule
                </span>
              </div>
              <h2 className="mt-3 text-2xl font-black">
                Session Mouss: preuves a remplir
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-muted">
                Les valeurs saisies dans le CSV ne sont pas rendues ici: l atelier
                affiche seulement les etats d audit, les formats attendus, les
                motifs de rejet et les liens admin internes.
              </p>
              <div className="mt-3 grid gap-2 text-xs font-bold text-muted">
                <p className="break-all">Workpack: {data.workpackPath ?? "Non trouve"}</p>
                <p className="break-all">Audit: {data.auditPath ?? "Non trouve"}</p>
                <p className="break-all">
                  CSV a remplir: {data.fillableCsvPath ?? "Non trouve"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={templateExportHref}
                download="maxi-template-preuves-sourcing-a-remplir.csv"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
              >
                Export template CSV
                <Download size={16} aria-hidden="true" />
              </a>
              <a
                href={auditExportHref}
                download="maxi-audit-preuves-sourcing-redige.csv"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
              >
                Export audit redige
                <Download size={16} aria-hidden="true" />
              </a>
              <Link
                href="/admin/pilotage"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
              >
                Retour pilotage
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            {metrics.map((metric) => (
              <div key={metric.label} className={`rounded-md p-4 ${metric.tone}`}>
                <p className="text-xs font-black uppercase">{metric.label}</p>
                <p className="mt-2 text-2xl font-black">{metric.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-md border border-[#f6d38b] bg-[#fff8e6] p-5 text-[#6f4700] shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-black uppercase">Blocages actuels</p>
                <h2 className="mt-2 text-xl font-black">HOLD maintenu</h2>
                <p className="mt-2 text-sm font-bold leading-6">
                  Tant que ces champs restent manquants, aucune fiche ne sort de
                  brouillon et aucun achat fournisseur n est autorise.
                </p>
              </div>
              <ClipboardList className="shrink-0" size={30} aria-hidden="true" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {blockers.length ? (
                blockers.map(([blocker, count]) => (
                  <span
                    key={blocker}
                    className="inline-flex min-h-9 items-center rounded-md border border-current bg-white/70 px-3 text-xs font-black uppercase"
                  >
                    {compactStatus(blocker)} x{count}
                  </span>
                ))
              ) : (
                <span className="inline-flex min-h-9 items-center rounded-md border border-current bg-white/70 px-3 text-xs font-black uppercase">
                  Aucun blocage liste
                </span>
              )}
            </div>
          </div>

          <div className="rounded-md border border-teal/20 bg-[#ecfdf5] p-5 text-teal shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase">Garde-fous</p>
                <h2 className="mt-2 text-xl font-black">Aucun produit publie</h2>
              </div>
              <ShieldCheck className="shrink-0" size={30} aria-hidden="true" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {safety.map((label) => (
                <span
                  key={label}
                  className="inline-flex min-h-9 items-center rounded-md border border-teal/25 bg-white/80 px-3 text-xs font-black uppercase"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-md border border-line bg-paper p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase text-teal">
                Ordre de traitement
              </p>
              <h2 className="mt-2 text-2xl font-black">
                {cards.length} preuve{cards.length > 1 ? "s" : ""} terrain
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-muted">
                Remplir d abord `manual_value`, puis note de preuve, capture,
                confirmation meme article, validation Mouss et decision finale
                READY_REVIEW. L audit doit ensuite passer avant toute action.
              </p>
            </div>
            <span className="inline-flex min-h-10 shrink-0 items-center rounded-md border border-line px-3 text-xs font-black uppercase text-muted">
              Genere le {formatDate(data.audit?.generatedAt ?? data.workpack?.generatedAt)}
            </span>
          </div>

          <div className="mt-5 grid gap-4">
            {cards.map(({ workpackProof, auditProof, csvRow }) => {
              const rank = workpackProof?.rank ?? auditProof?.rank ?? csvRow?.rank ?? "?";
              const productName =
                workpackProof?.productName ?? auditProof?.productName ?? csvRow?.product_name ?? "Produit a verifier";
              const fieldLabel =
                workpackProof?.fieldLabel ?? auditProof?.fieldLabel ?? csvRow?.field_label ?? "Champ a remplir";
              const fieldKey =
                workpackProof?.fieldKey ?? auditProof?.fieldKey ?? csvRow?.field_key ?? "champ";
              const proofZone =
                workpackProof?.proofZone ?? auditProof?.proofZone ?? csvRow?.proof_zone ?? "Zone";
              const expectedFormat = workpackProof?.expectedFormat ?? csvRow?.expected_format ?? "";
              const rejectIf = workpackProof?.rejectIf ?? csvRow?.reject_if ?? "";
              const adminHref =
                auditProof?.adminHref ??
                workpackProof?.adminHref ??
                csvRow?.admin_href ??
                "/admin/preuves-partenaires?status=hold#top-verification";
              const states = auditProof?.manualStates ?? {};
              const statusLabel = auditProof?.status ?? workpackProof?.status ?? csvRow?.status ?? "HOLD";
              const imageDepositDir =
                workpackProof?.imageDepositDir ?? csvRow?.image_deposit_dir ?? "";

              return (
                <article
                  key={`${rank}-${fieldKey}-${productName}`}
                  className="grid min-w-0 gap-4 rounded-md border border-line bg-[#fbfaf7] p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex min-h-8 items-center rounded-md bg-foreground px-3 text-xs font-black uppercase text-white">
                          #{rank}
                        </span>
                        <span
                          className={`inline-flex min-h-8 items-center rounded-md border px-3 text-xs font-black uppercase ${statusClasses(
                            statusLabel,
                          )}`}
                        >
                          {compactStatus(statusLabel)}
                        </span>
                        <span className="inline-flex min-h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-black uppercase text-muted">
                          {proofZone}
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-black">{fieldLabel}</h3>
                      <p className="mt-1 break-words text-sm font-black text-muted">
                        {productName}
                      </p>
                    </div>
                    <Link
                      href={adminHref}
                      className="focus-ring inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-line px-3 text-xs font-black hover:bg-[#f1eadf]"
                    >
                      Fiche preuve
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-3">
                    <div className="rounded-md bg-white p-3">
                      <p className="text-xs font-black uppercase text-muted">
                        Format attendu
                      </p>
                      <p className="mt-2 text-sm font-bold leading-6">
                        {expectedFormat || "A preciser dans le CSV"}
                      </p>
                    </div>
                    <div className="rounded-md bg-white p-3">
                      <p className="text-xs font-black uppercase text-muted">
                        Refuser si
                      </p>
                      <p className="mt-2 text-sm font-bold leading-6">
                        {rejectIf || "Preuve absente ou non exacte"}
                      </p>
                    </div>
                    <div className="rounded-md bg-white p-3">
                      <p className="text-xs font-black uppercase text-muted">
                        Cadre marge
                      </p>
                      <p className="mt-2 text-sm font-bold leading-6">
                        Vente cible: {workpackProof?.targetSalePrice ?? "a verifier"}
                        <br />
                        Marge cible: {workpackProof?.targetMargin ?? "a verifier"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-md border border-[#f6d38b] bg-[#fff8e6] p-3 text-[#6f4700]">
                      <p className="text-xs font-black uppercase">
                        Etats audit, valeurs redigees
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black uppercase">
                        <span className="rounded-md bg-white/80 p-2">
                          Valeur: {stateLabel(states.manualValue)}
                        </span>
                        <span className="rounded-md bg-white/80 p-2">
                          Note: {stateLabel(states.evidenceNote)}
                        </span>
                        <span className="rounded-md bg-white/80 p-2">
                          Capture: {stateLabel(states.captureOrFilePath)}
                        </span>
                        <span className="rounded-md bg-white/80 p-2">
                          Meme article: {stateLabel(states.checkedSameArticle)}
                        </span>
                        <span className="rounded-md bg-white/80 p-2">
                          Mouss: {stateLabel(states.moussValidation)}
                        </span>
                        <span className="rounded-md bg-white/80 p-2">
                          Decision: {stateLabel(states.finalDecision)}
                        </span>
                      </div>
                      {states.valueFingerprint ? (
                        <p className="mt-3 break-all text-xs font-black uppercase">
                          Empreinte: {states.valueFingerprint}
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-md border border-line bg-white p-3">
                      <p className="text-xs font-black uppercase text-muted">
                        A remplir hors interface
                      </p>
                      <ul className="mt-3 grid gap-2 text-sm font-bold leading-6">
                        {[
                          "manual_value: preuve exacte, jamais approximative",
                          "evidence_note: pourquoi c est le meme article",
                          "capture_or_file_path: capture ou fichier local",
                          "checked_same_article: oui seulement si identique",
                          "mouss_validation: oui apres validation humaine",
                          "final_decision: READY_REVIEW seulement apres audit OK",
                        ].map((item) => (
                          <li key={item} className="flex gap-2">
                            <CheckCircle2
                              className="mt-1 shrink-0 text-teal"
                              size={16}
                              aria-hidden="true"
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 break-all rounded-md bg-[#fbfaf7] p-3 text-xs font-bold text-muted">
                        Depot image exacte: {imageDepositDir || "a creer apres preuve"}
                      </p>
                    </div>
                  </div>

                  {auditProof?.blockers?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {auditProof.blockers.map((blocker) => (
                        <span
                          key={blocker}
                          className="inline-flex min-h-8 items-center rounded-md border border-[#f6d38b] bg-[#fff8e6] px-3 text-xs font-black uppercase text-[#8a5a00]"
                        >
                          {compactStatus(blocker)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-md border border-teal/20 bg-[#ecfdf5] p-5 text-teal shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase">Regle de sortie</p>
              <h2 className="mt-2 text-2xl font-black">GO technique, HOLD business</h2>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-6">
                Cette page aide a remplir les preuves, mais ne remplace pas
                l audit, la verification image exacte, les droits image, le stock,
                le delai France/Europe et la validation Mouss.
              </p>
            </div>
            <LockKeyhole className="shrink-0" size={34} aria-hidden="true" />
          </div>
        </section>
      </main>
    </>
  );
}

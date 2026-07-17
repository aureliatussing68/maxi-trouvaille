import { promises as fs, type Dirent } from "fs";
import path from "path";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileCheck2,
  Gauge,
  LockKeyhole,
  Printer,
  Search,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { isAdminModeEnabled } from "@/lib/admin";
import { readQuickProducts } from "@/lib/catalog-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin preuves partenaires",
};

type SupplierContext = {
  url?: string;
  sku?: string;
  supplierPriceCents?: number | null;
  salePriceCents?: number | null;
  supplierStock?: number | null;
  currentDeliveryEstimate?: string;
};

type EvidenceForm = {
  id: string;
  slug: string;
  name: string;
  priority: number;
  categoryId: string;
  workLane: string;
  status: string;
  supplierContext: SupplierContext;
  questions: string[];
  formToFill: Record<string, unknown>;
};

type FastFormsPayload = {
  ok: boolean;
  generatedAtLocal: string;
  outputDir: string;
  formCount: number;
  forms: EvidenceForm[];
};

type AuditProduct = {
  id: string;
  name: string;
  priority: number;
  status: string;
  blockerCount: number;
  blockers: string[];
  publicationAllowed: boolean;
  supplierOrderAllowed: boolean;
  paymentAllowed: boolean;
};

type FastAuditPayload = {
  ok: boolean;
  checkedAtLocal: string;
  inputPath: string;
  productCount: number;
  readyReviewCount: number;
  holdCount: number;
  byBlocker: Record<string, number>;
  products: AuditProduct[];
  safety: Record<string, boolean>;
};

type NextAction = {
  priority: number;
  lane: string;
  id: string;
  name: string;
  status: string;
  nextAction: string;
  requiredProofs?: string[];
  sourceFile?: string;
  guardrail?: string;
};

type NextActionsPayload = {
  ok: boolean;
  generatedAtLocal: string;
  actionCount: number;
  counts: {
    staticDecisions: number;
    fastForms: number;
    fullRechecks: number;
  };
  nextActions: NextAction[];
  safety: Record<string, unknown>;
};

type FastProofNowProduct = {
  id: string;
  slug: string;
  name: string;
  priority: number;
  categoryId: string;
  status: string;
  missingFieldCount: number;
  missingFields: Array<{
    key: string;
    label: string;
    instruction: string;
    currentValue: string;
  }>;
};

type FastProofNowPayload = {
  ok: boolean;
  generatedAtLocal: string;
  status: string;
  productCount: number;
  missingFieldCount: number;
  readyReviewCount: number;
  outputDirRelative: string;
  products: FastProofNowProduct[];
};

type FastProofNowAuditProduct = {
  id: string;
  slug: string;
  name: string;
  priority: number;
  categoryId: string;
  status: string;
  fieldCount: number;
  okFieldCount: number;
  missingOrInvalidFieldCount: number;
  blockers: string[];
  publicationAllowed: boolean;
  supplierOrderAllowed: boolean;
  paymentAllowed: boolean;
};

type FastProofNowAuditPayload = {
  ok: boolean;
  generatedAtLocal: string;
  status: string;
  productCount: number;
  readyReviewCount: number;
  holdCount: number;
  missingOrInvalidFieldCount: number;
  csvOverrideCount: number;
  products: FastProofNowAuditProduct[];
  safety: Record<string, boolean>;
};

type PageData = {
  forms: FastFormsPayload | null;
  audit: FastAuditPayload | null;
  nextActions: NextActionsPayload | null;
  fastProofNow: FastProofNowPayload | null;
  fastProofNowAudit: FastProofNowAuditPayload | null;
  quickProofAnchors: Array<{
    id: string;
    slug: string;
    name: string;
    categoryId: string;
    status: string;
  }>;
  paths: {
    formsPath?: string;
    auditPath?: string;
    nextActionsPath?: string;
    fastProofNowPath?: string;
    fastProofNowAuditPath?: string;
  };
};

type ProofSearchParams = {
  q?: string | string[];
  status?: string | string[];
  zone?: string | string[];
};

type AdminPartnerProofsPageProps = {
  searchParams: Promise<ProofSearchParams>;
};

type ProofExportRow = {
  source: string;
  priority: number | string;
  name: string;
  slug: string;
  categoryId: string;
  status: string;
  blockers: string;
  nextAction: string;
  adminUrl: string;
};

type TopVerificationInput = {
  source: string;
  priority?: number | string;
  name: string;
  slug: string;
  categoryId?: string;
  status: string;
  blockers?: string[];
  nextAction?: string;
};

type TopVerificationItem = Required<
  Pick<TopVerificationInput, "source" | "name" | "slug" | "status">
> & {
  priority: number;
  categoryId: string;
  blockers: string[];
  nextAction: string;
  score: number;
  signals: {
    potential: string;
    margin: string;
    image: string;
    delivery: string;
  };
};

const proofStatusOptions = [
  { value: "all", label: "Tous les statuts" },
  { value: "hold", label: "HOLD" },
  { value: "ready", label: "Prets revue" },
  { value: "blocked", label: "Avec blocages" },
] as const;

const proofZoneOptions = [
  {
    value: "all",
    label: "Toutes preuves",
    shortLabel: "Tout",
    pattern: /.*/,
  },
  {
    value: "image",
    label: "Images / droits",
    shortLabel: "Images",
    pattern: /(image|photo|webp|visuel|droits|galerie|alt)/,
  },
  {
    value: "supplier",
    label: "Fournisseur / SKU",
    shortLabel: "Fournisseur",
    pattern: /(fournisseur|sku|vendeur|seller|variante|supplier)/,
  },
  {
    value: "margin",
    label: "Prix / stock / marge",
    shortLabel: "Marge",
    pattern: /(prix|marge|vente|stock|cout|tarif)/,
  },
  {
    value: "delivery",
    label: "Livraison / suivi",
    shortLabel: "Livraison",
    pattern: /(delai|livraison|tracking|suivi|transporteur|expedition|france|europe)/,
  },
  {
    value: "validation",
    label: "Validation Mouss",
    shortLabel: "Validation",
    pattern: /(mouss|validation|revue|ready_review|decision)/,
  },
] as const;

const packsRoot = path.join(
  process.cwd(),
  "business-maxi-trouvailles",
  "file-validation-fournisseurs",
  "packs-validation-tous-partenaires",
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
  const [formsPath, auditPath, nextActionsPath, fastProofNowPath, fastProofNowAuditPath] =
    await Promise.all([
    latestFile(packsRoot, "FORMULAIRES_PREUVES_RAPIDES_"),
    latestFile(packsRoot, "AUDIT_FORMULAIRES_PREUVES_RAPIDES_"),
    latestFile(actionRoot, "QUOI_FAIRE_MAINTENANT_PARTENAIRES_"),
    latestFile(actionRoot, "A_REMPLIR_PREUVES_PARTENAIRES_NOW_"),
    latestFile(actionRoot, "AUDIT_PREUVES_PARTENAIRES_NOW_"),
  ]);
  const [forms, audit, nextActions, fastProofNow, fastProofNowAudit] = await Promise.all([
    readJson<FastFormsPayload>(formsPath),
    readJson<FastAuditPayload>(auditPath),
    readJson<NextActionsPayload>(nextActionsPath),
    readJson<FastProofNowPayload>(fastProofNowPath),
    readJson<FastProofNowAuditPayload>(fastProofNowAuditPath),
  ]);
  const existingProofSlugs = new Set([
    ...(forms?.forms ?? []).map((form) => form.slug),
    ...(fastProofNow?.products ?? []).map((product) => product.slug),
  ]);
  const quickProofAnchors = (await readQuickProducts())
    .filter(
      (product) =>
        (product.dropshipping?.enabled ||
          product.categoryId === "dropshipping" ||
          product.categoryId.startsWith("dropshipping-")) &&
        !existingProofSlugs.has(product.slug),
    )
    .map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      categoryId: product.categoryId,
      status: product.status ?? "published",
    }));

  return {
    forms,
    audit,
    nextActions,
    fastProofNow,
    fastProofNowAudit,
    quickProofAnchors,
    paths: {
      formsPath: formsPath ? path.relative(process.cwd(), formsPath) : undefined,
      auditPath: auditPath ? path.relative(process.cwd(), auditPath) : undefined,
      nextActionsPath: nextActionsPath ? path.relative(process.cwd(), nextActionsPath) : undefined,
      fastProofNowPath: fastProofNowPath
        ? path.relative(process.cwd(), fastProofNowPath)
        : undefined,
      fastProofNowAuditPath: fastProofNowAuditPath
        ? path.relative(process.cwd(), fastProofNowAuditPath)
        : undefined,
    },
  };
}

function cents(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) {
    return "a verifier";
  }

  return `${((value ?? 0) / 100).toFixed(2)} EUR`;
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeFilterText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function proofStatusFilter(value?: string | string[]) {
  const rawValue = firstParam(value);
  return proofStatusOptions.some((option) => option.value === rawValue)
    ? rawValue
    : "all";
}

function proofZoneFilter(value?: string | string[]) {
  const rawValue = firstParam(value);
  return proofZoneOptions.some((option) => option.value === rawValue)
    ? rawValue
    : "all";
}

function proofZoneHref(zone: string, query: string, status: string) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (status !== "all") {
    params.set("status", status);
  }

  if (zone !== "all") {
    params.set("zone", zone);
  }

  const queryString = params.toString();
  return `/admin/preuves-partenaires${queryString ? `?${queryString}` : ""}`;
}

function matchesProofSearch(query: string, values: unknown[]) {
  if (!query) {
    return true;
  }

  return values.some((value) => normalizeFilterText(value).includes(query));
}

function matchesProofStatusFilter(
  filter: string,
  status: string,
  blockerCount = 0,
) {
  const normalizedStatus = normalizeFilterText(status);

  if (filter === "hold") {
    return normalizedStatus.includes("hold") || blockerCount > 0;
  }

  if (filter === "ready") {
    return normalizedStatus.includes("ready");
  }

  if (filter === "blocked") {
    return blockerCount > 0 || normalizedStatus.includes("failure");
  }

  return true;
}

function matchesProofZoneFilter(filter: string, values: unknown[]) {
  if (filter === "all") {
    return true;
  }

  const option = proofZoneOptions.find((zone) => zone.value === filter);

  if (!option) {
    return true;
  }

  const text = normalizeFilterText(
    values
      .map((value) => (Array.isArray(value) ? value.join(" ") : String(value ?? "")))
      .join(" "),
  );

  return option.pattern.test(text);
}

function csvCell(value: unknown) {
  const cleanValue = String(value ?? "")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return `"${cleanValue.replace(/"/g, '""')}"`;
}

function buildProofCsv(rows: ProofExportRow[]) {
  const headers = [
    "source",
    "priorite",
    "produit",
    "slug",
    "categorie",
    "statut",
    "blocages",
    "prochaine_action",
    "lien_admin",
  ];
  const lines = rows.map((row) =>
    [
      row.source,
      row.priority,
      row.name,
      row.slug,
      row.categoryId,
      row.status,
      row.blockers,
      row.nextAction,
      row.adminUrl,
    ]
      .map(csvCell)
      .join(","),
  );

  return [headers.map(csvCell).join(","), ...lines].join("\r\n");
}

function buildTopVerificationCsv(rows: TopVerificationItem[]) {
  const headers = [
    "rang",
    "score",
    "source",
    "priorite",
    "produit",
    "slug",
    "categorie",
    "statut",
    "potentiel",
    "marge",
    "image",
    "livraison",
    "blocages",
    "prochaine_action",
    "lien_admin",
  ];
  const lines = rows.map((row, index) =>
    [
      index + 1,
      row.score,
      row.source,
      row.priority,
      row.name,
      row.slug,
      row.categoryId,
      row.status,
      row.signals.potential,
      row.signals.margin,
      row.signals.image,
      row.signals.delivery,
      row.blockers.join(" | "),
      row.nextAction,
      proofAdminUrl(row.slug),
    ]
      .map(csvCell)
      .join(","),
  );

  return [headers.map(csvCell).join(","), ...lines].join("\r\n");
}

function buildTerrainLotCsv(rows: TopVerificationItem[]) {
  const headers = [
    "ordre_terrain",
    "priorite_visuelle",
    "etat_visuel",
    "action_terrain",
    "preuves_a_remplir",
    "zones_preuves",
    "score",
    "produit",
    "slug",
    "categorie",
    "statut",
    "image",
    "marge",
    "livraison",
    "checklist",
    "blocages",
    "prochaine_action",
    "lien_fiche_terrain",
  ];
  const lines = rows.map((row, index) => {
    const visualState = terrainVisualState(row);
    const nextTerrainAction = terrainNextAction(row);
    const proofEffort = terrainProofEffort(row);

    return [
      index + 1,
      visualState.sortRank,
      visualState.label,
      nextTerrainAction,
      proofEffort.count,
      proofEffort.labels.join(" | "),
      row.score,
      row.name,
      row.slug,
      row.categoryId,
      row.status,
      row.signals.image,
      row.signals.margin,
      row.signals.delivery,
      topVerificationChecklist(row).join(" | "),
      row.blockers.join(" | "),
      row.nextAction,
      terrainItemHref(row, "hold"),
    ]
      .map(csvCell)
      .join(",");
  });

  return [headers.map(csvCell).join(","), ...lines].join("\r\n");
}

function csvFilenamePart(value: string) {
  const cleanValue = normalizeFilterText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleanValue || "toutes";
}

function adminAnchorId(value: string) {
  return (
    value
      .trim()
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "produit"
  );
}

function proofAdminUrl(slug: string) {
  return `/admin/preuves-partenaires#preuve-${slug}`;
}

function terrainItemHref(item: TopVerificationItem, status: string) {
  const params = new URLSearchParams({
    status,
    q: item.slug,
  });

  return `/admin/preuves-partenaires?${params.toString()}#top-verification-${adminAnchorId(
    item.slug,
  )}`;
}

function zoneSprintItemHref(item: TopVerificationItem, status: string, zone: string) {
  const params = new URLSearchParams({
    status,
    q: item.slug,
  });

  if (zone !== "all") {
    params.set("zone", zone);
  }

  return `/admin/preuves-partenaires?${params.toString()}#top-verification-${adminAnchorId(
    item.slug,
  )}`;
}

function isHoldTerrainItem(item: TopVerificationItem) {
  return normalizeFilterText(item.status).includes("hold") || item.blockers.length > 0;
}

function terrainVisualState(item: TopVerificationItem) {
  const imageSignal = normalizeFilterText(item.signals.image);
  const marginSignalValue = normalizeFilterText(item.signals.margin);
  const deliverySignalValue = normalizeFilterText(item.signals.delivery);

  if (imageSignal.includes("prioritaire")) {
    return {
      label: "Image a prouver",
      detail: item.signals.image,
      sortRank: 1,
      className: "border-rose/25 bg-[#fff1f2] text-rose",
    };
  }

  if (marginSignalValue.includes("verrouiller")) {
    return {
      label: "Marge a verrouiller",
      detail: item.signals.margin,
      sortRank: 2,
      className: "border-[#f6d38b] bg-[#fff8e6] text-[#8a5a00]",
    };
  }

  if (deliverySignalValue.includes("prouver")) {
    return {
      label: "Delai a prouver",
      detail: item.signals.delivery,
      sortRank: 3,
      className: "border-brand-strong/30 bg-[#fff7d6] text-[#805000]",
    };
  }

  if (imageSignal.includes("relire")) {
    return {
      label: "Image a relire",
      detail: item.signals.image,
      sortRank: 4,
      className: "border-line bg-white text-muted",
    };
  }

  if (marginSignalValue.includes("relire")) {
    return {
      label: "Marge a relire",
      detail: item.signals.margin,
      sortRank: 5,
      className: "border-line bg-white text-muted",
    };
  }

  return {
    label: "Delai a relire",
    detail: item.signals.delivery,
    sortRank: 6,
    className: "border-line bg-white text-muted",
  };
}

function terrainNextAction(item: TopVerificationItem) {
  const visualState = terrainVisualState(item);

  if (visualState.label.includes("Image")) {
    return `Verifier ou produire l'image exacte du produit ${item.slug}, puis noter la preuve de droits image.`;
  }

  if (visualState.label.includes("Marge")) {
    return `Verifier prix fournisseur, prix de vente, stock et marge pour ${item.slug}.`;
  }

  if (visualState.label.includes("Delai")) {
    return `Prouver delai France/Europe, suivi colis et transporteur pour ${item.slug}.`;
  }

  return `Relire les preuves fournisseur et garder ${item.slug} en HOLD avant validation Mouss.`;
}

function terrainProofEffort(item: TopVerificationItem) {
  const blockerText = normalizeFilterText(item.blockers.join(" "));
  const checks = [
    { label: "Image/droits", pattern: /(image|photo|webp|visuel|droits)/ },
    { label: "Fournisseur/SKU", pattern: /(sku|vendeur|seller|fournisseur|variante)/ },
    { label: "Prix/stock/marge", pattern: /(prix|marge|vente|stock)/ },
    { label: "Livraison/suivi", pattern: /(delai|livraison|tracking|suivi|transporteur)/ },
    { label: "Validation Mouss", pattern: /(mouss|validation|revue|ready_review)/ },
  ];
  const labels = checks
    .filter((check) => check.pattern.test(blockerText))
    .map((check) => check.label);

  if (labels.length > 0) {
    return {
      count: labels.length,
      labels,
    };
  }

  const fallbackLabels = topVerificationChecklist(item)
    .slice(0, 3)
    .map((task) => task.split(":")[0]);

  return {
    count: fallbackLabels.length,
    labels: fallbackLabels,
  };
}

function topVerificationChecklist(item: TopVerificationItem) {
  return [
    `Image exacte: ${item.signals.image}`,
    `Fournisseur et SKU: a confirmer sur la fiche ${item.slug}`,
    `Prix, marge et stock: ${item.signals.margin}`,
    `Livraison, suivi et delai France/Europe: ${item.signals.delivery}`,
    `Validation Mouss: garder HOLD tant que tout n'est pas coche`,
  ];
}

function zoneSprintDetail(zone: string) {
  if (zone === "image") {
    return "Priorite aux photos exactes, droits image, WebP local et galerie sans approximation.";
  }

  if (zone === "supplier") {
    return "Priorite au vendeur, SKU, variante exacte et lien fournisseur a verifier hors client.";
  }

  if (zone === "margin") {
    return "Priorite au prix fournisseur, stock, prix vendu et marge avant toute revue.";
  }

  if (zone === "delivery") {
    return "Priorite au delai France/Europe, transporteur, suivi colis et promesse claire.";
  }

  if (zone === "validation") {
    return "Priorite a la validation Mouss et a la decision finale, tout reste en HOLD.";
  }

  return "Vue globale des preuves a verrouiller avant revue humaine.";
}

function zoneSprintAction(zone: string, item: TopVerificationItem) {
  if (zone === "image") {
    return `Prouver l'image exacte et les droits de ${item.slug}, puis garder la fiche en HOLD.`;
  }

  if (zone === "supplier") {
    return `Verifier fournisseur, SKU et variante exacte de ${item.slug}.`;
  }

  if (zone === "margin") {
    return `Confirmer prix fournisseur, prix de vente, stock et marge pour ${item.slug}.`;
  }

  if (zone === "delivery") {
    return `Valider delai, suivi colis et transporteur pour ${item.slug}.`;
  }

  if (zone === "validation") {
    return `Faire la revue humaine Mouss pour ${item.slug} seulement si toutes les preuves sont completes.`;
  }

  return terrainNextAction(item);
}

function compactList(values: Array<string | undefined | null>) {
  return values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

function proofTextIncludes(values: string[], pattern: RegExp) {
  return pattern.test(normalizeFilterText(values.join(" ")));
}

function numericPriority(value: number | string | undefined) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
}

function businessPotentialSignal(name: string, categoryId: string) {
  const text = normalizeFilterText(`${name} ${categoryId}`);

  if (/(high-tech|telephonie|informatique|auto|moto|beaute|cuisine|maison|accessoires)/.test(text)) {
    return "Categorie demandee";
  }

  if (/(support|peigne|led|usb|chargeur|organisateur|brosse|mini|rangement)/.test(text)) {
    return "Produit utile";
  }

  return "A confirmer";
}

function marginSignal(blockers: string[]) {
  return proofTextIncludes(blockers, /(prix|marge|vente|fournisseur|stock)/)
    ? "Marge a verrouiller"
    : "Marge a relire";
}

function imageSignal(blockers: string[]) {
  return proofTextIncludes(blockers, /(image|photo|webp|visuel)/)
    ? "Image exacte prioritaire"
    : "Image a relire";
}

function deliverySignal(blockers: string[]) {
  return proofTextIncludes(blockers, /(delai|livraison|tracking|suivi|transporteur)/)
    ? "Delai a prouver"
    : "Delai a relire";
}

function topVerificationScore(item: TopVerificationInput, blockers: string[]) {
  const categoryId = item.categoryId ?? "";
  const priority = numericPriority(item.priority);
  const potential = businessPotentialSignal(item.name, categoryId);
  const sourceBoost = item.source.includes("preuve") || item.source.includes("formulaire") ? 18 : 8;
  let score = Math.max(0, 110 - priority * 3) + sourceBoost;

  if (potential === "Categorie demandee") {
    score += 24;
  } else if (potential === "Produit utile") {
    score += 14;
  }

  if (proofTextIncludes(blockers, /(image|photo|webp|visuel)/)) {
    score += 28;
  }

  if (proofTextIncludes(blockers, /(prix|marge|vente|fournisseur|stock)/)) {
    score += 22;
  }

  if (proofTextIncludes(blockers, /(delai|livraison|tracking|suivi|transporteur)/)) {
    score += 18;
  }

  if (normalizeFilterText(item.status).includes("hold")) {
    score += 12;
  }

  return Math.round(score);
}

function mergeTopVerificationItems(inputs: TopVerificationInput[]) {
  const bySlug = new Map<string, TopVerificationItem>();

  for (const item of inputs) {
    const slug = item.slug || item.name;
    const categoryId = item.categoryId ?? "a verifier";
    const blockers = compactList(item.blockers ?? []);
    const priority = numericPriority(item.priority);
    const candidate: TopVerificationItem = {
      source: item.source,
      priority,
      name: item.name,
      slug,
      categoryId,
      status: item.status,
      blockers,
      nextAction: item.nextAction ?? "Verifier les preuves fournisseur exactes.",
      score: topVerificationScore(item, blockers),
      signals: {
        potential: businessPotentialSignal(item.name, categoryId),
        margin: marginSignal(blockers),
        image: imageSignal(blockers),
        delivery: deliverySignal(blockers),
      },
    };
    const existing = bySlug.get(slug);

    if (!existing || candidate.score > existing.score) {
      bySlug.set(slug, {
        ...candidate,
        blockers: compactList([
          ...(existing?.blockers ?? []),
          ...candidate.blockers,
        ]).slice(0, 8),
      });
    }
  }

  return [...bySlug.values()].sort((a, b) => b.score - a.score || a.priority - b.priority);
}

function laneLabel(lane: string) {
  const labels: Record<string, string> = {
    decision_statique: "Decision",
    formulaire_rapide: "Fiche rapide",
    recontrole_complet: "Recontrole",
  };

  return labels[lane] ?? lane.replace(/_/g, " ");
}

function statusClasses(status: string) {
  if (status.startsWith("OK_") || status.includes("READY")) {
    return "border-teal/25 bg-[#ecfdf5] text-teal";
  }

  if (status.includes("FAILURE")) {
    return "border-rose/25 bg-[#fff1f2] text-rose";
  }

  return "border-[#f6d38b] bg-[#fff8e6] text-[#8a5a00]";
}

function topBlockers(audit: FastAuditPayload | null) {
  return Object.entries(audit?.byBlocker ?? {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
    .slice(0, 12);
}

function auditById(audit: FastAuditPayload | null) {
  return new Map((audit?.products ?? []).map((product) => [product.id, product]));
}

function proofFocusCards(data: PageData) {
  const actions = data.nextActions?.nextActions ?? [];
  const fastForms = actions.filter((action) => action.lane === "formulaire_rapide");
  const fullRechecks = actions.filter((action) => action.lane === "recontrole_complet");
  const staticDecisions = actions.filter((action) => action.lane === "decision_statique");
  const readyReview = [
    ...actions.filter((action) => action.status.includes("READY")),
    ...(data.audit?.products ?? []).filter((product) => product.status.includes("READY")),
  ];

  return [
    {
      label: "Preuve rapide",
      value: data.nextActions?.counts.fastForms ?? fastForms.length,
      note: "formulaires courts a completer",
      status: fastForms.length > 0 ? "HOLD_PREUVES_RAPIDES" : "OK_PREUVES_RAPIDES",
      nextAction:
        fastForms.length > 0
          ? "Completer vendeur, variante, prix, stock, delai, tracking et images."
          : "Aucune fiche rapide active dans la file.",
      href: "#fiches-rapides",
      icon: FileCheck2,
      samples: fastForms.slice(0, 2).map((action) => action.name),
    },
    {
      label: "Recontrole complet",
      value: data.nextActions?.counts.fullRechecks ?? fullRechecks.length,
      note: "fiches a reprendre en profondeur",
      status: fullRechecks.length > 0 ? "HOLD_RECONTROLE_COMPLET" : "OK_RECONTROLE",
      nextAction:
        fullRechecks.length > 0
          ? "Reverifier fournisseur, SKU, livraison, marge, stock et images."
          : "Aucun recontrole complet actif.",
      href: "#file-business",
      icon: Truck,
      samples: fullRechecks.slice(0, 2).map((action) => action.name),
    },
    {
      label: "Remplacer / retirer",
      value: data.nextActions?.counts.staticDecisions ?? staticDecisions.length,
      note: "decisions statiques a trancher",
      status: staticDecisions.length > 0 ? "HOLD_DECISION_STATIQUE" : "OK_DECISIONS",
      nextAction:
        staticDecisions.length > 0
          ? "Choisir garder, remplacer, retirer ou plus tard avant preuve fournisseur."
          : "Aucune decision statique active.",
      href: "#file-business",
      icon: LockKeyhole,
      samples: staticDecisions.slice(0, 2).map((action) => action.name),
    },
    {
      label: "Pret revue HOLD",
      value: data.audit?.readyReviewCount ?? readyReview.length,
      note: "revue humaine seulement",
      status: readyReview.length > 0 ? "READY_HUMAN_REVIEW_HOLD" : "HOLD_AUCUNE_READY",
      nextAction:
        readyReview.length > 0
          ? "Relire les preuves avant toute action de publication."
          : "Aucune fiche n'a encore toutes les preuves pour revue.",
      href: "#fiches-rapides",
      icon: ShieldCheck,
      samples: readyReview.slice(0, 2).map((item) => item.name),
    },
  ];
}

function lockedAdminState() {
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Preuves partenaires verrouillees"
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

export default async function AdminPartnerProofsPage({
  searchParams,
}: AdminPartnerProofsPageProps) {
  if (!isAdminModeEnabled()) {
    return lockedAdminState();
  }

  const params = await searchParams;
  const proofQuery = firstParam(params.q).trim().slice(0, 90);
  const normalizedProofQuery = normalizeFilterText(proofQuery);
  const proofStatus = proofStatusFilter(params.status);
  const proofZone = proofZoneFilter(params.zone);
  const activeProofZone =
    proofZoneOptions.find((option) => option.value === proofZone) ?? proofZoneOptions[0];
  const hasProofFilter = Boolean(
    normalizedProofQuery || proofStatus !== "all" || proofZone !== "all",
  );
  const data = await readPageData();
  const formAuditById = auditById(data.audit);
  const blockers = topBlockers(data.audit);
  const focusCards = proofFocusCards(data);
  const formSlugs = new Set((data.forms?.forms ?? []).map((form) => form.slug));
  const nextActions = data.nextActions?.nextActions ?? [];
  const filteredNextActions = nextActions.filter((action) => {
    const searchableValues = [
      action.id,
      action.name,
      action.lane,
      action.status,
      action.nextAction,
      action.requiredProofs?.join(" "),
      action.sourceFile,
    ];

    return (
      matchesProofSearch(normalizedProofQuery, searchableValues) &&
      matchesProofStatusFilter(
        proofStatus,
        action.status,
        action.requiredProofs?.length ?? 0,
      ) &&
      matchesProofZoneFilter(proofZone, searchableValues)
    );
  });
  const fastProofNowProducts = data.fastProofNow?.products ?? [];
  const filteredFastProofNowProducts = fastProofNowProducts.filter((product) => {
    const searchableValues = [
      product.id,
      product.slug,
      product.name,
      product.categoryId,
      product.status,
      product.missingFields
        .map((field) => `${field.label} ${field.instruction} ${field.currentValue}`)
        .join(" "),
    ];

    return (
      matchesProofSearch(normalizedProofQuery, searchableValues) &&
      matchesProofStatusFilter(proofStatus, product.status, product.missingFieldCount) &&
      matchesProofZoneFilter(proofZone, searchableValues)
    );
  });
  const fastProofNowAuditProducts = data.fastProofNowAudit?.products ?? [];
  const filteredFastProofNowAuditProducts = fastProofNowAuditProducts.filter(
    (product) => {
      const searchableValues = [
        product.id,
        product.slug,
        product.name,
        product.categoryId,
        product.status,
        product.blockers.join(" "),
      ];

      return (
        matchesProofSearch(normalizedProofQuery, searchableValues) &&
        matchesProofStatusFilter(
          proofStatus,
          product.status,
          product.missingOrInvalidFieldCount || product.blockers.length,
        ) &&
        matchesProofZoneFilter(proofZone, searchableValues)
      );
    },
  );
  const quickProofAnchors = data.quickProofAnchors;
  const filteredQuickProofAnchors = quickProofAnchors.filter((product) => {
    const searchableValues = [
      product.id,
      product.slug,
      product.name,
      product.categoryId,
      product.status,
      "preuves fournisseur exactes image prix stock marge delai livraison validation mouss",
    ];

    return (
      matchesProofSearch(normalizedProofQuery, searchableValues) &&
      matchesProofStatusFilter(proofStatus, product.status, 1) &&
      matchesProofZoneFilter(proofZone, searchableValues)
    );
  });
  const forms = data.forms?.forms ?? [];
  const filteredForms = forms.filter((form) => {
    const audit = formAuditById.get(form.id);
    const searchableValues = [
      form.id,
      form.slug,
      form.name,
      form.categoryId,
      form.status,
      form.workLane,
      form.questions.join(" "),
      audit?.blockers.join(" "),
    ];

    return (
      matchesProofSearch(normalizedProofQuery, searchableValues) &&
      matchesProofStatusFilter(
        proofStatus,
        audit?.status ?? form.status,
        audit?.blockerCount ?? 0,
      ) &&
      matchesProofZoneFilter(proofZone, searchableValues)
    );
  });
  const proofZoneRows = [
    ...nextActions.map((action) => ({
      status: action.status,
      blockerCount: action.requiredProofs?.length ?? 0,
      searchableValues: [
        action.id,
        action.name,
        action.lane,
        action.status,
        action.nextAction,
        action.requiredProofs?.join(" "),
        action.sourceFile,
      ],
    })),
    ...fastProofNowProducts.map((product) => ({
      status: product.status,
      blockerCount: product.missingFieldCount,
      searchableValues: [
        product.id,
        product.slug,
        product.name,
        product.categoryId,
        product.status,
        product.missingFields
          .map((field) => `${field.label} ${field.instruction} ${field.currentValue}`)
          .join(" "),
      ],
    })),
    ...fastProofNowAuditProducts.map((product) => ({
      status: product.status,
      blockerCount: product.missingOrInvalidFieldCount || product.blockers.length,
      searchableValues: [
        product.id,
        product.slug,
        product.name,
        product.categoryId,
        product.status,
        product.blockers.join(" "),
      ],
    })),
    ...quickProofAnchors.map((product) => ({
      status: product.status,
      blockerCount: 1,
      searchableValues: [
        product.id,
        product.slug,
        product.name,
        product.categoryId,
        product.status,
        "preuves fournisseur exactes image prix stock marge delai livraison validation mouss",
      ],
    })),
    ...forms.map((form) => {
      const audit = formAuditById.get(form.id);

      return {
        status: audit?.status ?? form.status,
        blockerCount: audit?.blockerCount ?? 0,
        searchableValues: [
          form.id,
          form.slug,
          form.name,
          form.categoryId,
          form.status,
          form.workLane,
          form.questions.join(" "),
          audit?.blockers.join(" "),
        ],
      };
    }),
  ];
  const proofZoneCounts = Object.fromEntries(
    proofZoneOptions.map((option) => [
      option.value,
      proofZoneRows.filter(
        (row) =>
          matchesProofSearch(normalizedProofQuery, row.searchableValues) &&
          matchesProofStatusFilter(proofStatus, row.status, row.blockerCount) &&
          matchesProofZoneFilter(option.value, row.searchableValues),
      ).length,
    ]),
  );
  const totalFilteredItems =
    nextActions.length +
    fastProofNowProducts.length +
    fastProofNowAuditProducts.length +
    quickProofAnchors.length +
    forms.length;
  const visibleFilteredItems =
    filteredNextActions.length +
    filteredFastProofNowProducts.length +
    filteredFastProofNowAuditProducts.length +
    filteredQuickProofAnchors.length +
    filteredForms.length;
  const proofExportRows: ProofExportRow[] = [
    ...filteredFastProofNowProducts.map((product) => ({
      source: "preuves_a_remplir_now",
      priority: product.priority,
      name: product.name,
      slug: product.slug,
      categoryId: product.categoryId,
      status: product.status,
      blockers: product.missingFields.map((field) => field.label).join(" | "),
      nextAction: "Completer les preuves fournisseur exactes et images avant revue.",
      adminUrl: proofAdminUrl(product.slug),
    })),
    ...filteredFastProofNowAuditProducts.map((product) => ({
      source: "audit_preuves_now",
      priority: product.priority,
      name: product.name,
      slug: product.slug,
      categoryId: product.categoryId,
      status: product.status,
      blockers: product.blockers.join(" | "),
      nextAction: product.publicationAllowed
        ? "Revue humaine HOLD avant toute publication."
        : "Corriger les preuves manquantes avant revue.",
      adminUrl: proofAdminUrl(product.slug),
    })),
    ...filteredQuickProofAnchors.map((product) => ({
      source: "index_hold_admin",
      priority: "HOLD",
      name: product.name,
      slug: product.slug,
      categoryId: product.categoryId,
      status: product.status,
      blockers: "Fiche a raccorder aux preuves fournisseur exactes.",
      nextAction: "Ouvrir l'ancre admin et completer le kit de preuves.",
      adminUrl: proofAdminUrl(product.slug),
    })),
    ...filteredForms.map((form) => {
      const audit = formAuditById.get(form.id);

      return {
        source: "formulaire_preuve",
        priority: form.priority,
        name: form.name,
        slug: form.slug,
        categoryId: form.categoryId,
        status: audit?.status ?? form.status,
        blockers: audit?.blockers.join(" | ") || form.questions.join(" | "),
        nextAction: "Remplir le formulaire preuve rapide puis relancer l'audit.",
        adminUrl: proofAdminUrl(form.slug),
      };
    }),
    ...filteredNextActions.map((action) => ({
      source: `action_${action.lane}`,
      priority: action.priority,
      name: action.name,
      slug: action.id,
      categoryId: laneLabel(action.lane),
      status: action.status,
      blockers: action.requiredProofs?.join(" | ") ?? action.guardrail ?? "",
      nextAction: action.nextAction,
      adminUrl: proofAdminUrl(action.id),
    })),
  ];
  const proofExportFilename = `maxi-preuves-partenaires-${proofStatus}-${proofZone}-${csvFilenamePart(
    proofQuery,
  )}.csv`;
  const proofExportHref = `data:text/csv;charset=utf-8,${encodeURIComponent(
    buildProofCsv(proofExportRows),
  )}`;
  const topVerificationItems = mergeTopVerificationItems([
    ...filteredFastProofNowProducts.map((product) => ({
      source: "preuves rapides",
      priority: product.priority,
      name: product.name,
      slug: product.slug,
      categoryId: product.categoryId,
      status: product.status,
      blockers: product.missingFields.flatMap((field) => [
        field.label,
        field.instruction,
      ]),
      nextAction: "Completer les preuves fournisseur exactes puis relancer l'audit.",
    })),
    ...filteredFastProofNowAuditProducts.map((product) => ({
      source: "audit preuves",
      priority: product.priority,
      name: product.name,
      slug: product.slug,
      categoryId: product.categoryId,
      status: product.status,
      blockers: product.blockers,
      nextAction: product.publicationAllowed
        ? "Verifier humainement avant revue HOLD."
        : "Corriger les blocages avant toute revue.",
    })),
    ...filteredForms.map((form) => {
      const audit = formAuditById.get(form.id);

      return {
        source: "formulaire rapide",
        priority: form.priority,
        name: form.name,
        slug: form.slug,
        categoryId: form.categoryId,
        status: audit?.status ?? form.status,
        blockers: audit?.blockers ?? form.questions,
        nextAction: "Remplir la fiche rapide puis relancer les controles.",
      };
    }),
    ...filteredNextActions.map((action) => ({
      source: laneLabel(action.lane),
      priority: action.priority,
      name: action.name,
      slug: action.id,
      categoryId: laneLabel(action.lane),
      status: action.status,
      blockers: action.requiredProofs ?? [action.guardrail ?? ""],
      nextAction: action.nextAction,
    })),
    ...filteredQuickProofAnchors.map((product) => ({
      source: "index HOLD",
      priority: 40,
      name: product.name,
      slug: product.slug,
      categoryId: product.categoryId,
      status: product.status,
      blockers: ["Preuves fournisseur exactes a raccorder."],
      nextAction: "Ouvrir l'ancre produit et remplir le kit de preuves.",
    })),
  ]).slice(0, 6);
  const topVerificationExportFilename = `maxi-top-verification-${proofStatus}-${proofZone}-${csvFilenamePart(
    proofQuery,
  )}.csv`;
  const topVerificationExportHref = `data:text/csv;charset=utf-8,${encodeURIComponent(
    buildTopVerificationCsv(topVerificationItems),
  )}`;
  const terrainLotItems = topVerificationItems
    .filter(isHoldTerrainItem)
    .sort(
      (a, b) =>
        terrainVisualState(a).sortRank - terrainVisualState(b).sortRank ||
        b.score - a.score ||
        a.priority - b.priority,
    )
    .slice(0, 3);
  const terrainLotExportFilename = `maxi-lot-terrain-du-jour-${proofStatus}-${proofZone}-${csvFilenamePart(
    proofQuery,
  )}.csv`;
  const terrainLotExportHref = `data:text/csv;charset=utf-8,${encodeURIComponent(
    buildTerrainLotCsv(terrainLotItems),
  )}`;
  const zoneSprintItems = topVerificationItems
    .filter(isHoldTerrainItem)
    .sort(
      (a, b) =>
        terrainProofEffort(b).count - terrainProofEffort(a).count ||
        b.score - a.score ||
        a.priority - b.priority,
    )
    .slice(0, 3);
  const zoneSprintCount = proofZoneCounts[proofZone] ?? visibleFilteredItems;

  return (
    <>
      <style media="print">{`
        @page {
          size: A4;
          margin: 12mm;
        }

        body * {
          visibility: hidden !important;
        }

        #top-verification,
        #top-verification * {
          visibility: visible !important;
        }

        #top-verification {
          position: absolute !important;
          inset: 0 auto auto 0 !important;
          width: 100% !important;
          border: 0 !important;
          box-shadow: none !important;
          background: #fff !important;
        }

        #top-verification .proofs-print-card {
          break-inside: avoid;
          page-break-inside: avoid;
          box-shadow: none !important;
        }

        #top-verification .proofs-print-hide {
          display: none !important;
        }
      `}</style>
      <PageHeader
        eyebrow="Admin"
        title="Atelier preuves partenaires"
        description="Fiches de verification fournisseur et blocages avant toute revue humaine. Aucun passage en vente depuis cette page."
      />

      <section className="container-page grid gap-8 py-10">
        <div className="flex min-w-0 flex-col justify-between gap-4 rounded-lg border border-line bg-paper p-5 shadow-sm lg:flex-row lg:items-center">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase text-teal">
              {data.nextActions?.generatedAtLocal ?? data.forms?.generatedAtLocal ?? "a generer"}
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {data.nextActions?.actionCount ?? 0} actions partenaires a traiter
            </h2>
            <p className="mt-2 max-w-3xl break-all text-sm leading-6 text-muted">
              {data.paths.nextActionsPath ?? "Aucun tableau d'actions trouve"}
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
              href="/admin/dropshipping"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
            >
              Commandes
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
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <article className="rounded-lg border border-line bg-paper p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-black text-muted">Actions</span>
              <ClipboardCheck size={20} className="text-teal" aria-hidden="true" />
            </div>
            <p className="mt-4 text-3xl font-black">{data.nextActions?.actionCount ?? 0}</p>
          </article>
          <article className="rounded-lg border border-line bg-paper p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-black text-muted">Fiches rapides</span>
              <FileCheck2 size={20} className="text-teal" aria-hidden="true" />
            </div>
            <p className="mt-4 text-3xl font-black">{data.forms?.formCount ?? 0}</p>
          </article>
          <article className="rounded-lg border border-line bg-paper p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-black text-muted">En HOLD</span>
              <LockKeyhole size={20} className="text-rose" aria-hidden="true" />
            </div>
            <p className="mt-4 text-3xl font-black">{data.audit?.holdCount ?? 0}</p>
          </article>
          <article className="rounded-lg border border-line bg-paper p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-black text-muted">Pretes revue</span>
              <ShieldCheck size={20} className="text-teal" aria-hidden="true" />
            </div>
            <p className="mt-4 text-3xl font-black">{data.audit?.readyReviewCount ?? 0}</p>
          </article>
          <article className="rounded-lg border border-line bg-paper p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-black text-muted">Publication</span>
              <Truck size={20} className="text-teal" aria-hidden="true" />
            </div>
            <p className="mt-4 text-3xl font-black">0</p>
          </article>
        </section>

        <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-teal">
                Recherche preuves
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Retrouver une fiche HOLD
              </h2>
              <p className="mt-2 text-sm font-bold text-muted">
                {visibleFilteredItems}/{totalFilteredItems} elements affiches
                {hasProofFilter ? " avec le filtre actif" : " sans filtre actif"}
                {proofZone !== "all" ? ` - ${activeProofZone.label}` : ""}
              </p>
            </div>
            {hasProofFilter ? (
              <Link
                href="/admin/preuves-partenaires"
                className="focus-ring inline-flex min-h-10 items-center justify-center rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
              >
                Reinitialiser
              </Link>
            ) : null}
          </div>

          <form
            action="/admin/preuves-partenaires"
            className="mt-5 grid gap-3 xl:grid-cols-[1fr_220px_220px_auto]"
          >
            <label className="grid gap-2 text-sm font-bold">
              Nom, slug, categorie ou preuve
              <span className="relative">
                <Search
                  size={18}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  name="q"
                  defaultValue={proofQuery}
                  placeholder="peigne, high-tech, SKU..."
                  className="focus-ring min-h-12 w-full rounded-md border border-line bg-white py-2 pl-10 pr-3 text-base"
                />
              </span>
            </label>

            <label className="grid gap-2 text-sm font-bold">
              Statut
              <select
                key={`proof-status-${proofStatus}`}
                name="status"
                defaultValue={proofStatus}
                className="focus-ring min-h-12 rounded-md border border-line bg-white px-3 text-base"
              >
                {proofStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-bold">
              Type preuve
              <select
                key={`proof-zone-${proofZone}`}
                name="zone"
                defaultValue={proofZone}
                className="focus-ring min-h-12 rounded-md border border-line bg-white px-3 text-base"
              >
                {proofZoneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 self-end rounded-md bg-foreground px-5 text-sm font-black text-white hover:bg-[#2b2b2b]"
            >
              Filtrer
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </form>

          <div className="mt-4 rounded-md border border-line bg-[#fbfaf7] p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase text-muted">
                  Filtres rapides preuves
                </p>
                <p className="mt-1 text-sm font-bold text-muted">
                  Conserve la recherche et le statut actif pour traiter les HOLD par blocage.
                </p>
              </div>
              <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-black uppercase text-muted">
                Zone: {activeProofZone.shortLabel}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {proofZoneOptions.map((option) => (
                <Link
                  key={option.value}
                  href={proofZoneHref(option.value, proofQuery, proofStatus)}
                  className={`focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 text-xs font-black uppercase ${
                    proofZone === option.value
                      ? "border-foreground bg-foreground text-white"
                      : "border-line bg-white text-foreground hover:bg-[#f1eadf]"
                  }`}
                >
                  <span>{option.shortLabel}</span>
                  <span
                    aria-label={`${proofZoneCounts[option.value] ?? 0} elements`}
                    className={`inline-flex min-w-7 items-center justify-center rounded-md px-1.5 py-1 text-[11px] ${
                      proofZone === option.value
                        ? "bg-white/15 text-white"
                        : "bg-[#f6f1e8] text-muted"
                    }`}
                  >
                    {proofZoneCounts[option.value] ?? 0}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div
            id="sprint-zone-preuves"
            className="mt-4 rounded-md border border-[#f6d38b] bg-[#fff8e6] p-4"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase text-[#8a5a00]">
                  Sprint zone active
                </p>
                <h3 className="mt-2 break-words text-lg font-black">
                  {activeProofZone.label}
                </h3>
                <p className="mt-2 text-sm font-bold leading-6 text-[#8a5a00]">
                  {zoneSprintDetail(proofZone)}
                </p>
              </div>
              <span className="inline-flex min-h-10 shrink-0 items-center rounded-md border border-[#f6d38b] bg-white px-3 text-xs font-black uppercase text-[#8a5a00]">
                {zoneSprintCount} preuves zone
              </span>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {zoneSprintItems.map((item, index) => {
                const proofEffort = terrainProofEffort(item);

                return (
                  <article
                    key={`zone-sprint-${item.source}-${item.slug}`}
                    className="min-w-0 rounded-md border border-[#f6d38b] bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase text-muted">
                          Priorite zone {index + 1}
                        </p>
                        <h4 className="mt-2 break-words text-sm font-black leading-5">
                          {item.name}
                        </h4>
                        <p className="mt-1 break-all text-[11px] font-bold text-muted">
                          {item.slug}
                        </p>
                      </div>
                      <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-md bg-foreground px-2 text-xs font-black text-brand">
                        {item.score}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-bold leading-6 text-[#8a5a00]">
                      {zoneSprintAction(proofZone, item)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {proofEffort.labels.slice(0, 4).map((label) => (
                        <span
                          key={`zone-sprint-${item.slug}-${label}`}
                          className="rounded-md border border-line bg-[#fbfaf7] px-2 py-1 text-[11px] font-black uppercase text-muted"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                    <a
                      href={zoneSprintItemHref(item, "hold", proofZone)}
                      className="focus-ring mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
                    >
                      Traiter cette preuve
                      <ArrowRight size={15} aria-hidden="true" />
                    </a>
                  </article>
                );
              })}
            </div>

            {zoneSprintItems.length === 0 ? (
              <p className="mt-4 rounded-md border border-[#f6d38b] bg-white p-3 text-sm font-bold text-muted">
                Aucune fiche prioritaire ne correspond a cette zone avec le filtre actuel.
              </p>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-md border border-line bg-[#fbfaf7] p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-muted">
              {proofExportRows.length} lignes CSV pretes pour le tri terrain.
            </p>
            <a
              href={proofExportHref}
              download={proofExportFilename}
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-black hover:bg-[#f1eadf]"
            >
              <Download size={16} aria-hidden="true" />
              Exporter CSV
            </a>
          </div>
        </section>

        <section
          id="lot-terrain-du-jour"
          className="rounded-lg border border-line bg-paper p-5 shadow-sm"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-teal">
                Lot terrain du jour
              </p>
              <h2 className="mt-2 text-2xl font-black">
                3 fiches HOLD a verrouiller
              </h2>
              <p className="mt-2 text-sm font-bold text-muted">
                {terrainLotItems.length} produits prioritaires issus du top verification.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#f6d38b] bg-[#fff8e6] px-3 text-xs font-black uppercase text-[#8a5a00]">
                <LockKeyhole size={16} aria-hidden="true" />
                HOLD strict
              </span>
              <a
                href={terrainLotExportHref}
                download={terrainLotExportFilename}
                className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-black uppercase hover:bg-[#f1eadf]"
              >
                <Download size={16} aria-hidden="true" />
                Exporter lot CSV
              </a>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {terrainLotItems.map((item, index) => {
              const visualState = terrainVisualState(item);
              const nextTerrainAction = terrainNextAction(item);
              const proofEffort = terrainProofEffort(item);

              return (
                <article
                  key={`terrain-lot-${item.source}-${item.slug}`}
                  id={`lot-terrain-${adminAnchorId(item.slug)}`}
                  className="grid min-w-0 gap-4 rounded-md border border-line bg-[#fbfaf7] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase text-muted">
                        Produit {index + 1}
                      </p>
                      <h3 className="mt-2 text-lg font-black leading-6">
                        {item.name}
                      </h3>
                      <p className="mt-1 break-all text-xs font-bold text-muted">
                        {item.slug}
                      </p>
                    </div>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-foreground text-sm font-black text-brand">
                      {item.score}
                    </span>
                  </div>

                  <div className={`rounded-md border px-3 py-2 ${visualState.className}`}>
                    <p className="text-[11px] font-black uppercase">Etat visuel</p>
                    <p className="mt-1 text-sm font-black">{visualState.label}</p>
                    <p className="mt-1 text-xs font-bold">{visualState.detail}</p>
                  </div>

                  <div className="rounded-md border border-line bg-white px-3 py-2">
                    <p className="text-[11px] font-black uppercase text-muted">
                      Prochaine action terrain
                    </p>
                    <p className="mt-1 text-sm font-bold leading-6 text-foreground">
                      {nextTerrainAction}
                    </p>
                  </div>

                  <div className="rounded-md border border-line bg-white px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-black uppercase text-muted">
                        Preuves a remplir
                      </p>
                      <span className="rounded-md bg-[#fff8e6] px-2 py-1 text-sm font-black text-[#8a5a00]">
                        {proofEffort.count}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {proofEffort.labels.map((label) => (
                        <span
                          key={`${item.slug}-${label}`}
                          className="rounded-md border border-line bg-[#fbfaf7] px-2 py-1 text-[11px] font-black uppercase text-muted"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <span className="rounded-md border border-line bg-white px-2 py-2 text-[11px] font-black uppercase text-muted">
                      {item.signals.image}
                    </span>
                    <span className="rounded-md border border-line bg-white px-2 py-2 text-[11px] font-black uppercase text-muted">
                      {item.signals.margin}
                    </span>
                    <span className="rounded-md border border-line bg-white px-2 py-2 text-[11px] font-black uppercase text-muted">
                      {item.signals.delivery}
                    </span>
                  </div>

                  <ul className="grid gap-2 text-xs font-bold leading-5 text-muted">
                    {topVerificationChecklist(item)
                      .slice(0, 4)
                      .map((task) => (
                        <li key={`lot-${item.slug}-${task}`} className="flex gap-2">
                          <span
                            aria-hidden="true"
                            className="mt-1 h-3 w-3 shrink-0 rounded-sm border border-line bg-white"
                          />
                          <span>{task}</span>
                        </li>
                      ))}
                  </ul>

                  <div className="flex flex-wrap gap-2">
                    <a
                      href={terrainItemHref(item, "hold")}
                      className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-foreground px-3 text-sm font-black text-white hover:bg-[#2b2b2b]"
                    >
                      Fiche terrain
                      <ArrowRight size={15} aria-hidden="true" />
                    </a>
                    <Link
                      href={proofAdminUrl(item.slug)}
                      className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
                    >
                      Preuve
                      <ExternalLink size={15} aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {terrainLotItems.length === 0 ? (
            <p className="mt-4 rounded-md border border-line bg-[#fbfaf7] p-4 text-sm font-bold text-muted">
              Aucun produit ne correspond au filtre actuel.
            </p>
          ) : null}
        </section>

        <section
          id="top-verification"
          className="proofs-print-root rounded-lg border border-line bg-paper p-5 shadow-sm"
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-teal">
                Top verification
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Top produits a verifier maintenant
              </h2>
              <p className="mt-2 text-sm font-bold text-muted">
                {topVerificationItems.length} fiches classees depuis le filtre actif.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line px-3 text-xs font-black uppercase text-muted">
                <Gauge size={16} aria-hidden="true" />
                Score local
              </span>
              <a
                href={topVerificationExportHref}
                download={topVerificationExportFilename}
                className="proofs-print-hide focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-black uppercase hover:bg-[#f1eadf]"
              >
                <Download size={16} aria-hidden="true" />
                Exporter top CSV
              </a>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {topVerificationItems.map((item, index) => (
              <article
                key={`${item.source}-${item.slug}`}
                id={`top-verification-${adminAnchorId(item.slug)}`}
                className="proofs-print-card scroll-mt-24 grid gap-4 rounded-md border border-line bg-[#fbfaf7] p-4 lg:grid-cols-[64px_1fr_220px]"
              >
                <div className="flex items-start gap-3 lg:block">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-foreground text-lg font-black text-brand">
                    {index + 1}
                  </span>
                  <div className="lg:mt-3">
                    <p className="text-xs font-black uppercase text-muted">Score</p>
                    <p className="text-xl font-black">{item.score}</p>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-line bg-white px-2 py-1 text-[11px] font-black uppercase text-muted">
                      {item.source}
                    </span>
                    <span
                      className={`rounded-md border px-2 py-1 text-[11px] font-black uppercase ${statusClasses(
                        item.status,
                      )}`}
                    >
                      {item.status.replace(/_/g, " ")}
                    </span>
                    <span className="rounded-md border border-line bg-white px-2 py-1 text-[11px] font-black uppercase text-muted">
                      Priorite {item.priority}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-black leading-6">{item.name}</h3>
                  <p className="mt-1 break-all text-sm font-bold text-muted">
                    {item.slug} - {item.categoryId}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {Object.entries(item.signals).map(([label, value]) => (
                      <span
                        key={`${item.slug}-${label}`}
                        className="rounded-md border border-line bg-white px-2 py-2 text-xs font-black uppercase text-muted"
                      >
                        {value}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm font-bold leading-6 text-muted">
                    {item.nextAction}
                  </p>
                  {item.blockers.length ? (
                    <p className="mt-2 text-xs font-bold leading-5 text-muted">
                      Blocages: {item.blockers.slice(0, 3).join(" | ")}
                    </p>
                  ) : null}
                  <div className="mt-4 rounded-md border border-line bg-white p-3">
                    <div className="flex items-center gap-2">
                      <Printer size={16} className="text-teal" aria-hidden="true" />
                      <p className="text-xs font-black uppercase text-muted">
                        Mini fiche terrain
                      </p>
                    </div>
                    <ul className="mt-3 grid gap-2 text-xs font-bold leading-5 text-muted sm:grid-cols-2">
                      {topVerificationChecklist(item).map((task) => (
                        <li key={`${item.slug}-${task}`} className="flex gap-2">
                          <span
                            aria-hidden="true"
                            className="mt-1 h-3 w-3 shrink-0 rounded-sm border border-line bg-[#fbfaf7]"
                          />
                          <span>{task}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="proofs-print-hide flex flex-col gap-2 lg:items-end">
                  <Link
                    href={proofAdminUrl(item.slug)}
                    className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
                  >
                    Ouvrir preuve
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                  <Link
                    href={`/admin/produits/${item.slug}/modifier`}
                    className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
                  >
                    Fiche admin
                    <ExternalLink size={15} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>

          {topVerificationItems.length === 0 ? (
            <p className="mt-4 rounded-md border border-line bg-[#fbfaf7] p-4 text-sm font-bold text-muted">
              Aucun produit ne correspond au filtre actuel.
            </p>
          ) : null}
        </section>

        <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-teal">
                Triage preuves partenaires
              </p>
              <h2 className="mt-2 text-2xl font-black">Ou agir en premier</h2>
            </div>
            <span className="rounded-md border border-line px-3 py-2 text-xs font-black uppercase text-muted">
              HOLD jusqu&apos;a validation Mouss
            </span>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-4">
            {focusCards.map((card, index) => {
              const Icon = card.icon;

              return (
                <article
                  key={card.label}
                  className="min-w-0 scroll-mt-24 rounded-md border border-line bg-[#fbfaf7] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase text-muted">
                        Dossier {index + 1}
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
                    {card.status.replace(/_/g, " ")}
                  </span>
                  <p className="mt-3 text-sm font-bold leading-6 text-muted">
                    {card.nextAction}
                  </p>
                  {!hasProofFilter && card.samples.length ? (
                    <p className="mt-3 text-xs font-bold leading-5 text-muted">
                      Exemples: {card.samples.join(", ")}
                    </p>
                  ) : null}
                  <Link
                    href={card.href}
                    className="focus-ring mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
                  >
                    Voir
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        {data.fastProofNow ? (
          <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-black uppercase text-teal">
                  Export a remplir maintenant
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {filteredFastProofNowProducts.length}/{fastProofNowProducts.length} produits rapides,{" "}
                  {data.fastProofNow.missingFieldCount} champs manuels
                </h2>
                <p className="mt-2 max-w-3xl break-all text-sm leading-6 text-muted">
                  {data.paths.fastProofNowPath}
                </p>
              </div>
              <span
                className={`inline-flex min-h-10 shrink-0 items-center rounded-md border px-3 text-xs font-black uppercase ${statusClasses(
                  data.fastProofNow.status,
                )}`}
              >
                {data.fastProofNow.status.replace(/_/g, " ")}
              </span>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-5">
              {filteredFastProofNowProducts.map((product) => (
                <article
                  key={product.id}
                  id={formSlugs.has(product.slug) ? undefined : `preuve-${product.slug}`}
                  className="min-w-0 scroll-mt-24 rounded-md border border-line bg-[#fbfaf7] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-paper px-2 py-1 text-xs font-black">
                      #{product.priority}
                    </span>
                    <span className="text-xs font-black uppercase text-muted">
                      {product.categoryId}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-black leading-6">{product.name}</h3>
                  <p className="mt-2 text-3xl font-black">{product.missingFieldCount}</p>
                  <p className="text-xs font-bold uppercase text-muted">champs a remplir</p>
                  <ul className="mt-3 grid gap-1 text-xs font-bold leading-5 text-muted">
                    {product.missingFields.slice(0, 4).map((field) => (
                      <li key={`${product.id}-${field.key}`}>{field.label}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            {filteredFastProofNowProducts.length === 0 ? (
              <p className="mt-5 rounded-md border border-line bg-[#fbfaf7] p-4 text-sm font-bold text-muted">
                Aucun produit rapide ne correspond au filtre actuel.
              </p>
            ) : null}
          </section>
        ) : null}

        {quickProofAnchors.length > 0 ? (
          <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-black uppercase text-teal">
                  Index produits HOLD
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {filteredQuickProofAnchors.length}/{quickProofAnchors.length} fiches partenaires a raccorder
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                  Ces fiches n&apos;ont pas encore de formulaire rapide actif, mais
                  chaque ancre permet de revenir directement depuis la garde publication.
                </p>
              </div>
              <span className="inline-flex min-h-10 shrink-0 items-center rounded-md border border-[#f6d38b] bg-[#fff8e6] px-3 text-xs font-black uppercase text-[#8a5a00]">
                HOLD preuves
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {filteredQuickProofAnchors.map((product) => (
                <article
                  key={product.id}
                  id={`preuve-${product.slug}`}
                  className="min-w-0 scroll-mt-24 rounded-md border border-line bg-[#fbfaf7] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-paper px-2 py-1 text-xs font-black">
                      {product.status}
                    </span>
                    <span className="text-xs font-black uppercase text-muted">
                      {product.categoryId}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-black leading-6">
                    {product.name}
                  </h3>
                  <p className="mt-2 break-all text-xs font-bold text-muted">
                    {product.slug}
                  </p>
                  <Link
                    href={`/admin/produits/${product.slug}/modifier`}
                    className="focus-ring mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
                  >
                    Editer
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
            {filteredQuickProofAnchors.length === 0 ? (
              <p className="mt-5 rounded-md border border-line bg-[#fbfaf7] p-4 text-sm font-bold text-muted">
                Aucune fiche HOLD de l&apos;index ne correspond au filtre actuel.
              </p>
            ) : null}
          </section>
        ) : null}

        {data.fastProofNowAudit ? (
          <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-black uppercase text-teal">Gate revue rapide</p>
                <h2 className="mt-2 text-2xl font-black">
                  {filteredFastProofNowAuditProducts.length}/{fastProofNowAuditProducts.length} produits controles,{" "}
                  {data.fastProofNowAudit.missingOrInvalidFieldCount} champs bloques
                </h2>
                <p className="mt-2 max-w-3xl break-all text-sm leading-6 text-muted">
                  {data.paths.fastProofNowAuditPath}
                </p>
              </div>
              <span
                className={`inline-flex min-h-10 shrink-0 items-center rounded-md border px-3 text-xs font-black uppercase ${statusClasses(
                  data.fastProofNowAudit.status,
                )}`}
              >
                {data.fastProofNowAudit.status.replace(/_/g, " ")}
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <article className="rounded-md border border-line bg-[#fbfaf7] p-4">
                <p className="text-xs font-black uppercase text-muted">Produits controles</p>
                <p className="mt-2 text-3xl font-black">{data.fastProofNowAudit.productCount}</p>
              </article>
              <article className="rounded-md border border-line bg-[#fbfaf7] p-4">
                <p className="text-xs font-black uppercase text-muted">Prets revue HOLD</p>
                <p className="mt-2 text-3xl font-black">{data.fastProofNowAudit.readyReviewCount}</p>
              </article>
              <article className="rounded-md border border-line bg-[#fbfaf7] p-4">
                <p className="text-xs font-black uppercase text-muted">Corrections CSV</p>
                <p className="mt-2 text-3xl font-black">{data.fastProofNowAudit.csvOverrideCount}</p>
              </article>
              <article className="rounded-md border border-line bg-[#171717] p-4 text-white">
                <p className="text-xs font-black uppercase text-brand">Verrou vente</p>
                <p className="mt-2 text-3xl font-black">0</p>
                <p className="text-xs font-bold uppercase text-white/70">publication autorisee</p>
              </article>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-5">
              {filteredFastProofNowAuditProducts.map((product) => (
                <article
                  key={product.id}
                  className="min-w-0 rounded-md border border-line bg-[#fbfaf7] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-paper px-2 py-1 text-xs font-black">
                      #{product.priority}
                    </span>
                    <span className="text-xs font-black uppercase text-muted">
                      {product.categoryId}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-black leading-6">{product.name}</h3>
                  <p className="mt-2 text-3xl font-black">
                    {product.okFieldCount}/{product.fieldCount}
                  </p>
                  <p className="text-xs font-bold uppercase text-muted">champs valides</p>
                  <span
                    className={`mt-3 inline-flex rounded-md border px-2 py-1 text-[11px] font-black uppercase ${statusClasses(
                      product.status,
                    )}`}
                  >
                    {product.status.replace(/_/g, " ")}
                  </span>
                  <ul className="mt-3 grid gap-1 text-xs font-bold leading-5 text-muted">
                    {product.blockers.slice(0, 4).map((blocker) => (
                      <li key={`${product.id}-${blocker}`} className="break-all">
                        {blocker}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            {filteredFastProofNowAuditProducts.length === 0 ? (
              <p className="mt-5 rounded-md border border-line bg-[#fbfaf7] p-4 text-sm font-bold text-muted">
                Aucun audit rapide ne correspond au filtre actuel.
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div id="file-business" className="scroll-mt-24 grid gap-4">
            <div>
              <p className="text-sm font-black uppercase text-teal">Actions</p>
              <h2 className="mt-2 text-2xl font-black">
                File business ({filteredNextActions.length}/{nextActions.length})
              </h2>
            </div>
            {filteredNextActions.map((action) => (
              <article
                key={`${action.priority}-${action.id}`}
                className="min-w-0 scroll-mt-24 rounded-lg border border-line bg-paper p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-[#f6f1e8] px-2 py-1 text-xs font-black">
                        #{action.priority}
                      </span>
                      <span className="text-xs font-black uppercase text-muted">
                        {laneLabel(action.lane)}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-1 text-[11px] font-black uppercase ${statusClasses(
                          action.status,
                        )}`}
                      >
                        {action.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <h3 className="mt-2 text-xl font-black">{action.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{action.nextAction}</p>
                  </div>
                  <Link
                    href="/admin/dropshipping"
                    className="focus-ring inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
                  >
                    Ouvrir admin
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
                <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-sm md:grid-cols-2">
                  <div>
                    <dt className="font-black uppercase text-muted">Preuves attendues</dt>
                    <dd className="mt-1 text-foreground">
                      {(action.requiredProofs ?? []).slice(0, 5).join(", ") || "a verifier"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-black uppercase text-muted">Source</dt>
                    <dd className="mt-1 break-all text-foreground">
                      {action.sourceFile ?? "non renseignee"}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
            {filteredNextActions.length === 0 ? (
              <p className="rounded-md border border-line bg-paper p-4 text-sm font-bold text-muted shadow-sm">
                Aucune action business ne correspond au filtre actuel.
              </p>
            ) : null}
          </div>

          <aside className="grid content-start gap-4">
            <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
              <p className="text-sm font-black uppercase text-teal">Blocages</p>
              <h2 className="mt-2 text-2xl font-black">Fiches rapides</h2>
              <div className="mt-4 grid gap-2">
                {blockers.map(([blocker, count]) => (
                  <div
                    key={blocker}
                    className="flex items-center justify-between gap-3 rounded-md bg-[#f6f1e8] px-3 py-2 text-sm"
                  >
                    <span className="break-all font-bold text-muted">{blocker}</span>
                    <span className="rounded-md bg-paper px-2 py-1 font-black">{count}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-line bg-[#171717] p-5 text-white shadow-sm">
              <p className="text-sm font-black uppercase text-brand">Verrous</p>
              <ul className="mt-4 grid gap-2 text-sm font-bold text-white/78">
                <li>Aucun paiement</li>
                <li>Aucune commande fournisseur</li>
                <li>Aucune publication</li>
                <li>Revue Mouss obligatoire</li>
              </ul>
            </section>
          </aside>
        </section>

        <section id="fiches-rapides" className="scroll-mt-24 grid gap-4">
          <div>
            <p className="text-sm font-black uppercase text-teal">Fiches rapides</p>
            <h2 className="mt-2 text-2xl font-black">
              Produits a verifier ({filteredForms.length}/{forms.length})
            </h2>
          </div>

          {filteredForms.map((form) => {
            const audit = formAuditById.get(form.id);

            return (
              <article
                key={form.id}
                id={`preuve-${form.slug}`}
                className="min-w-0 rounded-lg border border-line bg-paper p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-[#f6f1e8] px-2 py-1 text-xs font-black">
                        #{form.priority}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-1 text-[11px] font-black uppercase ${statusClasses(
                          audit?.status ?? form.status,
                        )}`}
                      >
                        {(audit?.status ?? form.status).replace(/_/g, " ")}
                      </span>
                      <span className="text-xs font-black uppercase text-muted">
                        {form.categoryId}
                      </span>
                    </div>
                    <h3 className="mt-2 text-xl font-black">{form.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {audit?.blockerCount ?? 0} bloqueurs avant revue humaine.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/produits/${form.slug}/modifier`}
                      className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
                    >
                      Editer
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                    {form.supplierContext.url ? (
                      <a
                        href={form.supplierContext.url}
                        target="_blank"
                        rel="noreferrer"
                        className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
                      >
                        Source interne
                        <ExternalLink size={15} aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                </div>

                <dl className="mt-5 grid gap-3 border-t border-line pt-4 text-sm md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="font-black uppercase text-muted">SKU</dt>
                    <dd className="mt-1 break-all text-foreground">
                      {form.supplierContext.sku ?? "a verifier"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-black uppercase text-muted">Prix fournisseur</dt>
                    <dd className="mt-1 text-foreground">
                      {cents(form.supplierContext.supplierPriceCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-black uppercase text-muted">Prix boutique</dt>
                    <dd className="mt-1 text-foreground">
                      {cents(form.supplierContext.salePriceCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-black uppercase text-muted">Stock</dt>
                    <dd className="mt-1 text-foreground">
                      {form.supplierContext.supplierStock ?? "a verifier"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-2">
                  <div className="min-w-0 break-all rounded-md bg-[#fff8e6] p-3 text-sm leading-6 text-[#8a5a00]">
                    <span className="font-black">Questions:</span>{" "}
                    {form.questions.slice(0, 3).join(" ")}
                  </div>
                  <div className="min-w-0 break-all rounded-md bg-[#f6f1e8] p-3 text-sm leading-6 text-muted">
                    <span className="font-black text-foreground">Bloqueurs:</span>{" "}
                    {(audit?.blockers ?? []).slice(0, 6).join(", ") || "a verifier"}
                  </div>
                </div>
              </article>
            );
          })}
          {filteredForms.length === 0 ? (
            <p className="rounded-md border border-line bg-paper p-4 text-sm font-bold text-muted shadow-sm">
              Aucune fiche rapide ne correspond au filtre actuel.
            </p>
          ) : null}
        </section>
      </section>
    </>
  );
}

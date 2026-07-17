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

type PhotoDropKitImageTask = {
  order: number;
  role: string;
  requiredShot: string;
  expectedFileName: string;
  stagingStatus: string;
  stagingRelativePath: string;
};

type PhotoDropKitProduct = {
  rank: number;
  productId: string;
  productName: string;
  humanGateStatus: string;
  dropFolderRelative: string;
  imageCount: number;
  presentValidWebpCount: number;
  invalidStagingFileCount: number;
  imageTasks?: PhotoDropKitImageTask[];
};

type PhotoDropKitManifest = {
  ok: boolean;
  generatedAtLocal: string;
  mode: string;
  productCount: number;
  expectedImageCount: number;
  presentValidWebpCount: number;
  invalidStagingFileCount: number;
  extraFileCount: number;
  outputDirRelative: string;
  products: PhotoDropKitProduct[];
};

type PhotoDropKitReadResult = {
  manifest: PhotoDropKitManifest;
  manifestPath: string;
};

type PhotoMissingWorkOrderTask = {
  productRank: number;
  productId: string;
  productName: string;
  categoryId: string;
  order: number;
  expectedFileName: string;
  role: string;
  requiredShot: string;
  stagingStatus: string;
  stagingRelativePath: string;
  dropFolderRelative: string;
  action: string;
};

type PhotoMissingWorkOrder = {
  ok: boolean;
  generatedAtLocal: string;
  mode: string;
  missingImageCount: number;
  tasks: PhotoMissingWorkOrderTask[];
  sources?: {
    manifestPath?: string;
  };
};

type PhotoMissingWorkOrderReadResult = {
  workOrder: PhotoMissingWorkOrder;
  workOrderPath: string;
};

type CategoryImageIntakeBatch = {
  label: string;
  manifestRelativePath: string;
  itemCount: number;
  presentValidWebpCount: number;
  missingCount: number;
  invalidFileCount: number;
};

type CategoryImageIntakeItem = {
  rank: number;
  batchLabel: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  expectedFileName: string;
  currentImageUrl: string;
  proposedPublicUrl: string;
  dropFolderRelative: string;
  stagingRelativePath: string;
  stagingStatus: string;
  stagingBytes: number;
  intakeStatus: string;
  humanReviewReady: boolean;
  blockers: string[];
  warnings: string[];
  nextAction: string;
  visualDirection: string;
  safetyStatus: string;
};

type CategoryImageIntakeStatus = {
  ok: boolean;
  generatedAtLocal: string;
  mode: string;
  batchCount: number;
  expectedImageCount: number;
  presentValidWebpCount: number;
  missingCount: number;
  invalidFileCount: number;
  humanReviewReadyCount: number;
  outputDirRelative: string;
  batches: CategoryImageIntakeBatch[];
  items: CategoryImageIntakeItem[];
};

type CategoryImageIntakeReadResult = {
  status: CategoryImageIntakeStatus;
  statusPath: string;
};

type VisualProductionBoardItem = {
  priority: number;
  urgency: string;
  lane: string;
  targetType: string;
  targetName: string;
  targetId: string;
  categoryId: string;
  expectedFileName: string;
  dropFolderRelative: string;
  stagingRelativePath: string;
  currentStatus: string;
  blocker: string;
  nextAction: string;
  requiredShot: string;
  businessImpact: string;
  safetyStatus: string;
};

type VisualProductionBoard = {
  ok: boolean;
  generatedAtLocal: string;
  status: string;
  itemCount: number;
  counts: {
    productPhotos: number;
    categoryImages: number;
  };
  sources: {
    photoWorkOrderPath: string;
    categoryIntakePath: string;
  };
  outputDir: string;
  items: VisualProductionBoardItem[];
};

type VisualProductionBoardReadResult = {
  board: VisualProductionBoard;
  boardPath: string;
};

type VisualProductionAudit = {
  ok: boolean;
  generatedAtLocal: string;
  status: string;
  failureCount: number;
  failures: string[];
  metrics: {
    itemCount: number;
    productPhotoCount: number;
    categoryImageCount: number;
    sourceProductTaskCount: number;
    sourceCategoryItemCount: number;
  };
  safety?: Record<string, boolean>;
  sources?: {
    visualBoardPath?: string;
    photoWorkOrderPath?: string;
    categoryIntakePath?: string;
  };
};

type VisualProductionAuditReadResult = {
  audit: VisualProductionAudit;
  auditPath: string;
};

type VisualDepositSessionChecklistItem = {
  priority: number;
  fileName: string;
  requiredShot: string;
  stagingRelativePath: string;
  nextAction: string;
  safetyStatus: string;
};

type VisualDepositSessionGroup = {
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
  checklist: VisualDepositSessionChecklistItem[];
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
  sources?: {
    visualBoardPath?: string;
    visualAuditPath?: string;
  };
  outputDir: string;
  groups: VisualDepositSessionGroup[];
};

type VisualDepositSessionReadResult = {
  session: VisualDepositSession;
  sessionPath: string;
};

type IntegrationExecutionRow = {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  categoryLabel: string;
  lane: string;
  priorityScore: number;
  productStatus: string;
  holdStatus: string;
  targetSalePrice: string;
  targetMargin: string;
  packetReady: boolean;
  intakeStatus: string;
  evidenceFilled: string;
  validImages: string;
  proofZones: string[];
  nextAction: string;
  imageDepositDir: string;
  sourceImage: string;
};

type IntegrationExecutionBoard = {
  generatedAt: string;
  mode: string;
  status: string;
  integrationCount: number;
  packetCount: number;
  intakeHoldCount: number;
  readyReviewHoldCount: number;
  expectedWebPCount: number;
  validWebPCount: number;
  byLane?: Record<string, number>;
  byCategory?: Record<string, number>;
  proofZoneCounts?: Record<string, number>;
  rows: IntegrationExecutionRow[];
  sourceFiles?: Record<string, string | null>;
};

type IntegrationExecutionBoardReadResult = {
  board: IntegrationExecutionBoard;
  boardPath: string;
};

const boardRoot = path.join(
  process.cwd(),
  "business-maxi-trouvailles",
  "tableaux-action",
);

const photoDropRoot = path.join(
  process.cwd(),
  "business-maxi-trouvailles",
  "depots-photos",
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

function adminAnchorId(value: string) {
  return (
    value
      .trim()
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "produit"
  );
}

function proofTerrainHref(action: ExecutionAction) {
  const proofTarget = action.id || action.label;
  const params = new URLSearchParams({
    status: "hold",
    q: proofTarget,
  });

  return `/admin/preuves-partenaires?${params.toString()}#top-verification-${adminAnchorId(
    proofTarget,
  )}`;
}

function proofZoneTerrainHref(action: ExecutionAction, zone: string) {
  const proofTarget = action.id || action.label;
  const params = new URLSearchParams({
    status: "hold",
    q: proofTarget,
    zone,
  });

  return `/admin/preuves-partenaires?${params.toString()}#top-verification-${adminAnchorId(
    proofTarget,
  )}`;
}

const pilotageProofZoneOptions = [
  {
    value: "image",
    label: "Images / droits",
    shortLabel: "Images",
    detail: "Photos exactes, droits image et fichiers WebP a verrouiller.",
    pattern: /(image|photo|webp|visuel|droits|galerie|fichier|local|catalogue)/,
  },
  {
    value: "supplier",
    label: "Fournisseur / SKU",
    shortLabel: "Fournisseur",
    detail: "Vendeur, SKU et variante exacte a prouver.",
    pattern: /(fournisseur|sku|vendeur|seller|variante|supplier)/,
  },
  {
    value: "margin",
    label: "Prix / stock / marge",
    shortLabel: "Marge",
    detail: "Prix fournisseur, stock et marge a verrouiller.",
    pattern: /(prix|marge|vente|stock|cout|tarif|pricing)/,
  },
  {
    value: "delivery",
    label: "Livraison / suivi",
    shortLabel: "Livraison",
    detail: "Delai France/Europe, suivi et transporteur a confirmer.",
    pattern:
      /(delai|livraison|tracking|suivi|transporteur|expedition|france|europe|shipping)/,
  },
  {
    value: "validation",
    label: "Validation Mouss",
    shortLabel: "Validation",
    detail: "Decision finale et revue humaine Mouss a obtenir.",
    pattern: /(mouss|validation|revue|ready_review|decision|finale)/,
  },
] as const;

type PilotageProofZone = (typeof pilotageProofZoneOptions)[number];
type PriorityProofZone = PilotageProofZone & {
  count: number;
  href: string;
  sortRank: number;
};

type ProofZoneProgress = PriorityProofZone & {
  sharePercent: number;
};

type HoldTodaySprintItem = {
  action: ExecutionAction;
  zones: PilotageProofZone[];
  href: string;
  checklistCount: number;
};

function normalizePilotageText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function pilotageCsvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function pilotageProofZoneHref(zone: string) {
  const params = new URLSearchParams({
    status: "hold",
    zone,
  });

  return `/admin/preuves-partenaires?${params.toString()}#top-verification`;
}

function actionProofText(action: ExecutionAction) {
  return normalizePilotageText(
    [
      action.id,
      action.label,
      action.status,
      action.nextAction,
      action.blockers?.join(" "),
      action.sourceFile,
      action.allowedAction,
      action.forbiddenActions?.join(" "),
    ].join(" "),
  );
}

function pilotageProofZonesForAction(action: ExecutionAction): PilotageProofZone[] {
  const proofText = actionProofText(action);
  const zones = pilotageProofZoneOptions.filter((zone) =>
    zone.pattern.test(proofText),
  );

  return zones.length ? Array.from(zones) : [pilotageProofZoneOptions[0]];
}

function pilotageProofZoneProgress(actions: ExecutionAction[]): ProofZoneProgress[] {
  const relevantActions = actions.filter(
    (action) => !action.status.startsWith("OK_"),
  );
  const zones = pilotageProofZoneOptions.map((zone, index) => ({
    ...zone,
    count: relevantActions.filter((action) =>
      zone.pattern.test(actionProofText(action)),
    ).length,
    href: pilotageProofZoneHref(zone.value),
    sortRank: index,
  }));
  const total = zones.reduce((sum, zone) => sum + zone.count, 0);

  return zones
    .map((zone) => ({
      ...zone,
      sharePercent: total > 0 ? Math.round((zone.count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count || a.sortRank - b.sortRank);
}

function priorityProofZone(actions: ExecutionAction[]): PriorityProofZone {
  const zones = pilotageProofZoneProgress(actions);
  const fallbackZone = zones[0];
  const bestZone = zones
    .filter((zone) => zone.count > 0)
    .sort((a, b) => b.count - a.count || a.sortRank - b.sortRank)[0];

  return bestZone ?? fallbackZone;
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

async function collectPhotoDropKitManifestFiles(dir: string, out: string[] = []) {
  let entries: Dirent[];

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectPhotoDropKitManifestFiles(fullPath, out);
    } else if (
      entry.isFile() &&
      entry.name.startsWith("MANIFEST_DEPOT_PHOTOS_SPRINT_") &&
      entry.name.endsWith(".json")
    ) {
      out.push(fullPath);
    }
  }

  return out;
}

async function collectPhotoMissingWorkOrderFiles(dir: string, out: string[] = []) {
  let entries: Dirent[];

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectPhotoMissingWorkOrderFiles(fullPath, out);
    } else if (
      entry.isFile() &&
      entry.name.startsWith("ORDRE_TRAVAIL_PHOTOS_MANQUANTES_") &&
      entry.name.endsWith(".json")
    ) {
      out.push(fullPath);
    }
  }

  return out;
}

async function collectCategoryImageIntakeStatusFiles(
  dir: string,
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
      await collectCategoryImageIntakeStatusFiles(fullPath, out);
    } else if (
      entry.isFile() &&
      entry.name.startsWith("SUIVI_DEPOTS_IMAGES_CATEGORIES_") &&
      entry.name.endsWith(".json")
    ) {
      out.push(fullPath);
    }
  }

  return out;
}

async function collectVisualProductionBoardFiles(dir: string, out: string[] = []) {
  let entries: Dirent[];

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectVisualProductionBoardFiles(fullPath, out);
    } else if (
      entry.isFile() &&
      entry.name.startsWith("VISUELS_EXACTS_A_PRODUIRE_") &&
      entry.name.endsWith(".json")
    ) {
      out.push(fullPath);
    }
  }

  return out;
}

async function collectVisualProductionAuditFiles(dir: string, out: string[] = []) {
  let entries: Dirent[];

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectVisualProductionAuditFiles(fullPath, out);
    } else if (
      entry.isFile() &&
      entry.name.startsWith("AUDIT_VISUELS_EXACTS_A_PRODUIRE_") &&
      entry.name.endsWith(".json")
    ) {
      out.push(fullPath);
    }
  }

  return out;
}

async function collectVisualDepositSessionFiles(dir: string, out: string[] = []) {
  let entries: Dirent[];

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectVisualDepositSessionFiles(fullPath, out);
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

async function collectIntegrationExecutionBoardFiles(
  dir: string,
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
      await collectIntegrationExecutionBoardFiles(fullPath, out);
    } else if (
      entry.isFile() &&
      entry.name.startsWith("EXECUTION_INTEGRATION_ARTICLES_") &&
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

async function readLatestPhotoDropKitManifest(): Promise<PhotoDropKitReadResult | null> {
  const files = await collectPhotoDropKitManifestFiles(photoDropRoot);
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
    manifest: payload as PhotoDropKitManifest,
    manifestPath: path.relative(process.cwd(), latest.filePath),
  };
}

async function readLatestPhotoMissingWorkOrder(): Promise<PhotoMissingWorkOrderReadResult | null> {
  const files = await collectPhotoMissingWorkOrderFiles(photoDropRoot);
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
    workOrder: payload as PhotoMissingWorkOrder,
    workOrderPath: path.relative(process.cwd(), latest.filePath),
  };
}

async function readLatestCategoryImageIntakeStatus(): Promise<CategoryImageIntakeReadResult | null> {
  const files = await collectCategoryImageIntakeStatusFiles(boardRoot);
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
    status: payload as CategoryImageIntakeStatus,
    statusPath: path.relative(process.cwd(), latest.filePath),
  };
}

async function readLatestVisualProductionBoard(): Promise<VisualProductionBoardReadResult | null> {
  const files = await collectVisualProductionBoardFiles(boardRoot);
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
    board: payload as VisualProductionBoard,
    boardPath: path.relative(process.cwd(), latest.filePath),
  };
}

async function readLatestVisualProductionAudit(): Promise<VisualProductionAuditReadResult | null> {
  const files = await collectVisualProductionAuditFiles(boardRoot);
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
    audit: payload as VisualProductionAudit,
    auditPath: path.relative(process.cwd(), latest.filePath),
  };
}

async function readLatestVisualDepositSession(): Promise<VisualDepositSessionReadResult | null> {
  const files = await collectVisualDepositSessionFiles(boardRoot);
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
    session: payload as VisualDepositSession,
    sessionPath: path.relative(process.cwd(), latest.filePath),
  };
}

async function readLatestIntegrationExecutionBoard(): Promise<IntegrationExecutionBoardReadResult | null> {
  const files = await collectIntegrationExecutionBoardFiles(
    path.join(boardRoot, "execution-integration-articles"),
  );
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
    board: payload as IntegrationExecutionBoard,
    boardPath: path.relative(process.cwd(), latest.filePath),
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
  priorityZone: PriorityProofZone;
  csvReady: boolean;
  printReady: boolean;
  nextProduct: ExecutionAction | null;
  sprintItems: HoldTodaySprintItem[];
  zoneProgressItems: ProofZoneProgress[];
  zoneProgressTotal: number;
};

function holdTodaySummary(board: ExecutionBoard): HoldTodaySummary {
  const metrics = board.metrics ?? {};
  const partnerHoldCount =
    metrics.partnerDraftHoldCount ?? metrics.partnerActionCount ?? 0;
  const partnerActions = (board.actions ?? []).filter(
    (action) => action.lane === "produits_partenaires",
  );
  const activePartnerActions = partnerActions.filter(
    (action) => !action.status.startsWith("OK_"),
  );
  const zoneProgressItems = pilotageProofZoneProgress(partnerActions);
  const priorityZone = priorityProofZone(partnerActions);
  const nextProduct =
    activePartnerActions[0] ?? partnerActions[0] ?? null;
  const sprintItems = activePartnerActions
    .map((action) => {
      const zones = pilotageProofZonesForAction(action);
      const leadZone = zones[0] ?? priorityZone;

      return {
        action,
        zones,
        href: proofZoneTerrainHref(action, leadZone.value),
        checklistCount: Math.max(1, zones.length),
      };
    })
    .sort(
      (a, b) =>
        b.checklistCount - a.checklistCount ||
        a.action.rank - b.action.rank,
    )
    .slice(0, 3);

  return {
    partnerHoldCount,
    topVerificationCount: Math.min(6, partnerHoldCount),
    priorityZone,
    csvReady: true,
    printReady: true,
    nextProduct,
    sprintItems,
    zoneProgressItems,
    zoneProgressTotal: zoneProgressItems.reduce(
      (sum, zone) => sum + zone.count,
      0,
    ),
  };
}

function integrationExecutionGeneratedAt(board: IntegrationExecutionBoard) {
  const date = new Date(board.generatedAt);

  if (Number.isNaN(date.getTime())) {
    return board.generatedAt || "Date inconnue";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

function integrationExecutionLaneLabel(lane: string) {
  const labels: Record<string, string> = {
    lane_1_packet_a_remplir: "Packets a remplir",
    lane_2_sourcing_prioritaire: "Sourcing prioritaire",
    lane_3_validation_mouss: "Validation Mouss",
    lane_4_controle_securite: "Controle securite",
  };

  return labels[lane] ?? lane.replace(/_/g, " ");
}

function integrationExecutionLaneClass(lane: string) {
  if (lane === "lane_1_packet_a_remplir") {
    return "border-amber-300 bg-[#fff8e6]";
  }

  if (lane === "lane_4_controle_securite") {
    return "border-rose/25 bg-[#fff1f2]";
  }

  if (lane === "lane_3_validation_mouss") {
    return "border-teal/25 bg-[#ecfdf5]";
  }

  return "border-line bg-[#faf7f0]";
}

function integrationExecutionProofHref(row: IntegrationExecutionRow) {
  const target = row.id || row.slug || row.name;
  const params = new URLSearchParams({
    status: "hold",
    q: target,
  });

  return `/admin/preuves-partenaires?${params.toString()}#top-verification-${adminAnchorId(
    target,
  )}`;
}

function integrationExecutionRows(board: IntegrationExecutionBoard) {
  return [...(board.rows ?? [])].sort(
    (a, b) =>
      b.priorityScore - a.priorityScore ||
      a.name.localeCompare(b.name, "fr"),
  );
}

function integrationExecutionTopProofZones(board: IntegrationExecutionBoard) {
  return Object.entries(board.proofZoneCounts ?? {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
    .slice(0, 5);
}

function buildIntegrationExecutionCsv(
  integrationExecution: IntegrationExecutionBoardReadResult,
) {
  const { board, boardPath } = integrationExecution;
  const headers = [
    "type_ligne",
    "priorite",
    "produit",
    "categorie",
    "lane",
    "statut",
    "prix_cible",
    "marge_cible",
    "preuves",
    "images_valides",
    "action",
    "chemin_depot",
    "lien_admin",
  ];
  const rows: Array<Array<number | string>> = [
    [
      "meta",
      0,
      "Execution integration articles",
      "toutes",
      board.status,
      "HOLD_LOCAL",
      `${board.integrationCount} candidats`,
      `${board.validWebPCount}/${board.expectedWebPCount} WebP`,
      boardPath,
      board.mode,
      "Lecture seule, aucune publication",
      "",
      "/admin/pilotage",
    ],
  ];

  integrationExecutionRows(board).forEach((row, index) => {
    rows.push([
      row.packetReady ? "packet" : "candidat",
      index + 1,
      row.name,
      row.categoryLabel || row.categoryId,
      integrationExecutionLaneLabel(row.lane),
      `${row.productStatus} / ${row.holdStatus} / ${row.intakeStatus}`,
      row.targetSalePrice,
      row.targetMargin,
      row.evidenceFilled,
      row.validImages,
      row.nextAction,
      row.imageDepositDir,
      integrationExecutionProofHref(row),
    ]);
  });

  return [
    headers.map(pilotageCsvCell).join(","),
    ...rows.map((row) => row.map(pilotageCsvCell).join(",")),
  ].join("\r\n");
}

function buildPilotageHoldCsv(
  board: ExecutionBoard,
  holdToday: HoldTodaySummary,
  boardPath: string,
) {
  const headers = [
    "type_ligne",
    "priorite",
    "libelle",
    "valeur",
    "details",
    "statut",
    "lien_admin",
  ];
  const rows: Array<Array<number | string>> = [
    [
      "meta",
      0,
      "Tableau",
      board.generatedAtLocal,
      boardPath,
      "HOLD_LOCAL",
      "/admin/pilotage",
    ],
    [
      "resume",
      1,
      "Fiches HOLD",
      holdToday.partnerHoldCount,
      "partenaires a prouver",
      "HOLD",
      "/admin/preuves-partenaires?status=hold#top-verification",
    ],
    [
      "resume",
      2,
      "Top verification",
      holdToday.topVerificationCount,
      "fiches a attaquer",
      "HOLD",
      "/admin/preuves-partenaires?status=hold#top-verification",
    ],
    [
      "resume",
      3,
      "Zone prioritaire",
      holdToday.priorityZone.shortLabel,
      `${holdToday.priorityZone.count} blocages terrain`,
      "HOLD",
      holdToday.priorityZone.href,
    ],
  ];

  holdToday.zoneProgressItems.forEach((zone, index) => {
    rows.push([
      "zone",
      index + 1,
      zone.label,
      zone.count,
      `${zone.sharePercent}% du volume`,
      zone.count > 0 ? "A_TRAITER" : "OK",
      zone.href,
    ]);
  });

  holdToday.sprintItems.forEach((item, index) => {
    rows.push([
      "sprint",
      index + 1,
      item.action.label,
      item.checklistCount,
      item.zones.map((zone) => zone.shortLabel).join(" | "),
      item.action.status,
      item.href,
    ]);
  });

  if (holdToday.nextProduct) {
    rows.push([
      "prochain_produit",
      1,
      holdToday.nextProduct.label,
      holdToday.nextProduct.status,
      holdToday.nextProduct.nextAction,
      "HOLD",
      proofTerrainHref(holdToday.nextProduct),
    ]);
  }

  return [
    headers.map(pilotageCsvCell).join(","),
    ...rows.map((row) => row.map(pilotageCsvCell).join(",")),
  ].join("\r\n");
}

function buildPhotoDropKitCsv(photoDropKit: PhotoDropKitReadResult) {
  const headers = [
    "type_ligne",
    "priorite",
    "produit",
    "role_image",
    "fichier_attendu",
    "statut_depot",
    "chemin_depot",
    "action",
  ];
  const rows: Array<Array<number | string>> = [];

  photoDropKit.manifest.products.forEach((product) => {
    rows.push([
      "produit",
      product.rank,
      product.productName,
      "resume",
      `${product.presentValidWebpCount}/${product.imageCount}`,
      product.humanGateStatus,
      product.dropFolderRelative,
      "Deposer les WebP exacts, puis relancer audit-photo-checklist.",
    ]);

    for (const task of product.imageTasks ?? []) {
      rows.push([
        "image",
        task.order,
        product.productName,
        task.role,
        task.expectedFileName,
        task.stagingStatus,
        task.stagingRelativePath,
        task.requiredShot,
      ]);
    }
  });

  return [
    headers.map(pilotageCsvCell).join(","),
    ...rows.map((row) => row.map(pilotageCsvCell).join(",")),
  ].join("\r\n");
}

function buildPhotoMissingWorkOrderCsv(photoWorkOrder: PhotoMissingWorkOrderReadResult) {
  const headers = [
    "type_ligne",
    "priorite",
    "produit",
    "ordre_image",
    "fichier_attendu",
    "role_image",
    "statut_depot",
    "chemin_depot",
    "action",
  ];
  const rows: Array<Array<number | string>> = [
    [
      "ordre_travail",
      0,
      "Photos manquantes",
      photoWorkOrder.workOrder.missingImageCount,
      "ORDRE_TRAVAIL_PHOTOS_MANQUANTES",
      "resume",
      "HOLD_PHOTOS_MANQUANTES",
      photoWorkOrder.workOrderPath,
      "Produire ou deposer uniquement les WebP exacts listes.",
    ],
  ];

  photoWorkOrder.workOrder.tasks.forEach((task, index) => {
    rows.push([
      "image",
      index + 1,
      task.productName,
      task.order,
      task.expectedFileName,
      task.role,
      task.stagingStatus,
      task.stagingRelativePath,
      task.action,
    ]);
  });

  return [
    headers.map(pilotageCsvCell).join(","),
    ...rows.map((row) => row.map(pilotageCsvCell).join(",")),
  ].join("\r\n");
}

function buildCategoryImageIntakeCsv(categoryIntake: CategoryImageIntakeReadResult) {
  const headers = [
    "type_ligne",
    "priorite",
    "lot",
    "categorie",
    "fichier_attendu",
    "statut_depot",
    "chemin_depot",
    "action",
  ];
  const rows: Array<Array<number | string>> = [
    [
      "suivi_categories",
      0,
      "Tous lots",
      "Images categories",
      categoryIntake.status.expectedImageCount,
      "HOLD_IMAGES_CATEGORIES",
      categoryIntake.statusPath,
      "Deposer les WebP categories exacts avant revue humaine.",
    ],
  ];

  categoryIntake.status.items.forEach((item) => {
    rows.push([
      "image_categorie",
      item.rank,
      item.batchLabel,
      item.categoryName,
      item.expectedFileName,
      item.intakeStatus,
      item.stagingRelativePath,
      item.nextAction,
    ]);
  });

  return [
    headers.map(pilotageCsvCell).join(","),
    ...rows.map((row) => row.map(pilotageCsvCell).join(",")),
  ].join("\r\n");
}

function buildVisualProductionBoardCsv(visualBoard: VisualProductionBoardReadResult) {
  const headers = [
    "priority",
    "urgency",
    "lane",
    "target_type",
    "target_name",
    "expected_file_name",
    "current_status",
    "drop_folder",
    "staging_path",
    "next_action",
    "business_impact",
    "safety_status",
  ];
  const rows: Array<Array<number | string>> = visualBoard.board.items.map((item) => [
    item.priority,
    item.urgency,
    item.lane,
    item.targetType,
    item.targetName,
    item.expectedFileName,
    item.currentStatus,
    item.dropFolderRelative,
    item.stagingRelativePath,
    item.nextAction,
    item.businessImpact,
    item.safetyStatus,
  ]);

  return [
    headers.map(pilotageCsvCell).join(","),
    ...rows.map((row) => row.map(pilotageCsvCell).join(",")),
  ].join("\r\n");
}

function buildVisualProductionAuditCsv(visualAudit: VisualProductionAuditReadResult) {
  const headers = [
    "type_ligne",
    "priorite",
    "statut",
    "libelle",
    "valeur",
    "source",
  ];
  const rows: Array<Array<number | string>> = [
    [
      "meta",
      0,
      visualAudit.audit.status,
      "Audit visuels exacts",
      visualAudit.audit.generatedAtLocal,
      visualAudit.auditPath,
    ],
    [
      "resume",
      1,
      visualAudit.audit.status,
      "Visuels controles",
      visualAudit.audit.metrics.itemCount,
      visualAudit.audit.sources?.visualBoardPath ?? "",
    ],
    [
      "resume",
      2,
      visualAudit.audit.status,
      "Photos produits",
      visualAudit.audit.metrics.productPhotoCount,
      visualAudit.audit.sources?.photoWorkOrderPath ?? "",
    ],
    [
      "resume",
      3,
      visualAudit.audit.status,
      "Images categories",
      visualAudit.audit.metrics.categoryImageCount,
      visualAudit.audit.sources?.categoryIntakePath ?? "",
    ],
  ];

  if (visualAudit.audit.failures.length === 0) {
    rows.push([
      "controle",
      1,
      "OK",
      "Aucun echec",
      0,
      visualAudit.auditPath,
    ]);
  } else {
    visualAudit.audit.failures.forEach((failure, index) => {
      rows.push([
        "echec",
        index + 1,
        "HOLD",
        failure,
        visualAudit.audit.failureCount,
        visualAudit.auditPath,
      ]);
    });
  }

  return [
    headers.map(pilotageCsvCell).join(","),
    ...rows.map((row) => row.map(pilotageCsvCell).join(",")),
  ].join("\r\n");
}

function buildVisualDepositSessionCsv(visualSession: VisualDepositSessionReadResult) {
  const headers = [
    "group_order",
    "urgency",
    "lane",
    "target_name",
    "item_count",
    "missing_count",
    "ready_count",
    "drop_folder",
    "expected_files",
    "status",
  ];
  const rows: Array<Array<number | string | string[]>> =
    visualSession.session.groups.map((group) => [
      group.groupOrder,
      group.urgency,
      group.lane,
      group.targetName,
      group.itemCount,
      group.missingCount,
      group.readyCount,
      group.dropFolderRelative,
      group.expectedFiles,
      group.status,
    ]);

  return [
    headers.map(pilotageCsvCell).join(","),
    ...rows.map((row) => row.map(pilotageCsvCell).join(",")),
  ].join("\r\n");
}

function photoDropKitGate(photoDropKit: PhotoDropKitReadResult) {
  const manifest = photoDropKit.manifest;
  const missingImageCount = Math.max(
    0,
    manifest.expectedImageCount - manifest.presentValidWebpCount,
  );

  if (manifest.invalidStagingFileCount > 0 || manifest.extraFileCount > 0) {
    return {
      label: "Depot a corriger",
      status: "HOLD_DEPOT_PHOTO_A_CORRIGER",
      detail:
        "Corriger les fichiers invalides ou en trop avant toute revue humaine.",
      nextAction: "Relancer audit-photo-checklist apres correction.",
      missingImageCount,
      tone: "error" as const,
    };
  }

  if (missingImageCount > 0) {
    const missingLabel =
      missingImageCount > 1 ? "WebP exacts manquants" : "WebP exact manquant";

    return {
      label: "Depot incomplet",
      status: "HOLD_DEPOT_PHOTO_INCOMPLET",
      detail: `${missingImageCount} ${missingLabel}. HOLD maintenu.`,
      nextAction:
        "Deposer les WebP exacts dans les dossiers produits, puis relancer les audits photo.",
      missingImageCount,
      tone: "hold" as const,
    };
  }

  return {
    label: "Depot complet - revue humaine requise",
    status: "READY_DEPOT_PHOTO_HUMAN_REVIEW_ONLY",
    detail:
      "Tous les WebP sont presents: relancer les audits, verifier droits/correspondance et attendre validation Mouss.",
    nextAction:
      "Relancer audit-photo-checklist et audit-sprint-image-human-review avant toute copie publique.",
    missingImageCount: 0,
    tone: "review" as const,
  };
}

function photoDropGateClasses(tone: ReturnType<typeof photoDropKitGate>["tone"]) {
  if (tone === "error") {
    return "border-rose/30 bg-[#fff1f2] text-rose";
  }

  if (tone === "review") {
    return "border-teal/25 bg-[#ecfdf5] text-teal";
  }

  return "border-[#f6d38b] bg-[#fff8e6] text-[#8a5a00]";
}

function categoryImageIntakeGate(categoryIntake: CategoryImageIntakeStatus) {
  if (categoryIntake.invalidFileCount > 0) {
    return {
      label: "Depot categories a corriger",
      status: "HOLD_IMAGES_CATEGORIES_INVALIDES",
      detail:
        "Corriger les fichiers invalides avant toute revue humaine des categories.",
      nextAction: "Relancer category-image-intake-status apres correction.",
      tone: "error" as const,
    };
  }

  if (categoryIntake.missingCount > 0) {
    return {
      label: "Depot categories incomplet",
      status: "HOLD_IMAGES_CATEGORIES_MANQUANTES",
      detail: `${categoryIntake.missingCount} WebP categories manquants. HOLD maintenu.`,
      nextAction:
        "Deposer les WebP dans les dossiers P1/P2, puis relancer le suivi categories.",
      tone: "hold" as const,
    };
  }

  return {
    label: "Depot categories complet - revue humaine requise",
    status: "READY_IMAGES_CATEGORIES_HUMAN_REVIEW_ONLY",
    detail:
      "Tous les WebP categories sont presents: verifier coherence, droits et validation Mouss avant copie publique.",
    nextAction:
      "Relancer category-image-promotion-plan avant toute copie publique.",
    tone: "review" as const,
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

  const [
    result,
    photoChecklistAudit,
    photoDropKit,
    photoMissingWorkOrder,
    categoryImageIntake,
    visualProductionBoard,
    visualProductionAudit,
    visualDepositSession,
    integrationExecution,
  ] = await Promise.all([
    readLatestBoard(),
    readLatestPhotoChecklistAudit(),
    readLatestPhotoDropKitManifest(),
    readLatestPhotoMissingWorkOrder(),
    readLatestCategoryImageIntakeStatus(),
    readLatestVisualProductionBoard(),
    readLatestVisualProductionAudit(),
    readLatestVisualDepositSession(),
    readLatestIntegrationExecutionBoard(),
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
  const pilotageHoldExportFilename = "maxi-pilotage-hold-du-jour.csv";
  const pilotageHoldExportHref = `data:text/csv;charset=utf-8,${encodeURIComponent(
    buildPilotageHoldCsv(board, holdToday, boardPath),
  )}`;
  const photoDropExportFilename = "maxi-depot-photo-exact.csv";
  const photoDropExportHref = photoDropKit
    ? `data:text/csv;charset=utf-8,${encodeURIComponent(
        buildPhotoDropKitCsv(photoDropKit),
      )}`
    : null;
  const photoWorkOrderExportFilename = "maxi-ordre-travail-photos-manquantes.csv";
  const photoWorkOrderExportHref = photoMissingWorkOrder
    ? `data:text/csv;charset=utf-8,${encodeURIComponent(
        buildPhotoMissingWorkOrderCsv(photoMissingWorkOrder),
      )}`
    : null;
  const categoryImageExportFilename = "maxi-suivi-depots-images-categories.csv";
  const categoryImageExportHref = categoryImageIntake
    ? `data:text/csv;charset=utf-8,${encodeURIComponent(
        buildCategoryImageIntakeCsv(categoryImageIntake),
      )}`
    : null;
  const visualProductionExportFilename = "maxi-production-visuels-exacts.csv";
  const visualProductionExportHref = visualProductionBoard
    ? `data:text/csv;charset=utf-8,${encodeURIComponent(
        buildVisualProductionBoardCsv(visualProductionBoard),
      )}`
    : null;
  const visualProductionAuditExportFilename = "maxi-audit-visuels-exacts.csv";
  const visualProductionAuditExportHref = visualProductionAudit
    ? `data:text/csv;charset=utf-8,${encodeURIComponent(
        buildVisualProductionAuditCsv(visualProductionAudit),
      )}`
    : null;
  const visualDepositSessionExportFilename = "maxi-session-depot-visuels-exacts.csv";
  const visualDepositSessionExportHref = visualDepositSession
    ? `data:text/csv;charset=utf-8,${encodeURIComponent(
        buildVisualDepositSessionCsv(visualDepositSession),
      )}`
    : null;
  const integrationExecutionExportFilename =
    "maxi-execution-integration-articles.csv";
  const integrationExecutionExportHref = integrationExecution
    ? `data:text/csv;charset=utf-8,${encodeURIComponent(
        buildIntegrationExecutionCsv(integrationExecution),
      )}`
    : null;
  const photoDropGate = photoDropKit ? photoDropKitGate(photoDropKit) : null;
  const photoMissingWorkOrderTasks =
    photoMissingWorkOrder?.workOrder.tasks ?? [];
  const categoryImageGate = categoryImageIntake
    ? categoryImageIntakeGate(categoryImageIntake.status)
    : null;
  const categoryImageItems = categoryImageIntake?.status.items ?? [];
  const visualProductionItems = visualProductionBoard?.board.items ?? [];
  const visualProductionAuditFailures =
    visualProductionAudit?.audit.failures ?? [];
  const visualDepositSessionGroups = visualDepositSession?.session.groups ?? [];
  const integrationRows = integrationExecution
    ? integrationExecutionRows(integrationExecution.board)
    : [];
  const integrationTopRows = integrationRows.slice(0, 8);
  const integrationLaneEntries = Object.entries(
    integrationExecution?.board.byLane ?? {},
  ).sort((a, b) => a[0].localeCompare(b[0], "fr"));
  const integrationProofZoneEntries = integrationExecution
    ? integrationExecutionTopProofZones(integrationExecution.board)
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Pilotage Maxi - chantier du jour"
        description="Priorites, blocages et garde-fous pour avancer sans publication automatique."
      />

      <section className="container-page grid grid-cols-1 gap-8 py-10">
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

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
              <p className="text-sm font-black uppercase text-teal">
                Articles dropshipping a sourcer
              </p>
              <h2 className="mt-2 text-2xl font-black">
                File integration HOLD, sans mauvaise image
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                Vue lecture seule des candidats ajoutes en brouillon. Une fiche reste
                bloquee tant que fournisseur, image exacte, prix, stock, delai et
                validation Mouss ne sont pas prouves.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/preuves-partenaires?status=hold#top-verification"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
              >
                Controler preuves
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                href="/admin/selection-produits"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
              >
                Selection articles
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              {integrationExecutionExportHref ? (
                <a
                  href={integrationExecutionExportHref}
                  download={integrationExecutionExportFilename}
                  className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
                >
                  Exporter integration CSV
                  <Download size={16} aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>

          {integrationExecution ? (
            <>
              <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
                <div className="rounded-md bg-[#ecfdf5] p-4">
                  <p className="text-xs font-black uppercase text-muted">
                    Candidats HOLD
                  </p>
                  <p className="mt-2 text-2xl font-black text-teal">
                    {integrationExecution.board.integrationCount}
                  </p>
                </div>
                <div className="rounded-md bg-[#fff8e6] p-4">
                  <p className="text-xs font-black uppercase text-muted">
                    Packets
                  </p>
                  <p className="mt-2 text-2xl font-black">
                    {integrationExecution.board.packetCount}
                  </p>
                </div>
                <div className="rounded-md bg-[#fff1f2] p-4">
                  <p className="text-xs font-black uppercase text-muted">
                    Intake HOLD
                  </p>
                  <p className="mt-2 text-2xl font-black text-rose">
                    {integrationExecution.board.intakeHoldCount}
                  </p>
                </div>
                <div className="rounded-md bg-[#f8fafc] p-4">
                  <p className="text-xs font-black uppercase text-muted">
                    Images exactes
                  </p>
                  <p className="mt-2 text-2xl font-black">
                    {integrationExecution.board.validWebPCount}/
                    {integrationExecution.board.expectedWebPCount}
                  </p>
                </div>
                <div className="rounded-md bg-[#faf7f0] p-4">
                  <p className="text-xs font-black uppercase text-muted">
                    Derniere synchro
                  </p>
                  <p className="mt-2 text-sm font-black">
                    {integrationExecutionGeneratedAt(integrationExecution.board)}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.45fr)]">
                <div className="rounded-md border border-line bg-[#faf7f0] p-4">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={18} aria-hidden="true" />
                    <h3 className="text-lg font-black">Repartition chantiers</h3>
                  </div>
                  <div className="mt-4 space-y-3">
                    {integrationLaneEntries.map(([lane, count]) => (
                      <div
                        key={lane}
                        className={`rounded-md border p-3 ${integrationExecutionLaneClass(
                          lane,
                        )}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-black">
                            {integrationExecutionLaneLabel(lane)}
                          </p>
                          <span className="rounded-full bg-white px-2 py-1 text-xs font-black">
                            {count}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5">
                    <p className="text-xs font-black uppercase text-muted">
                      Preuves manquantes
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {integrationProofZoneEntries.map(([zone, count]) => (
                        <span
                          key={zone}
                          className="rounded-full border border-line bg-white px-3 py-2 text-xs font-black"
                        >
                          {zone}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="min-w-0 rounded-md border border-line bg-white p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase text-muted">
                        Top actions
                      </p>
                      <h3 className="mt-1 text-lg font-black">
                        A sourcer avant toute mise en vente
                      </h3>
                    </div>
                    <span className="rounded-full border border-amber-300 bg-[#fff8e6] px-3 py-2 text-xs font-black text-[#8a5a00]">
                      {integrationExecution.board.status}
                    </span>
                  </div>

                  <div className="mt-4 divide-y divide-line">
                    {integrationTopRows.map((row, index) => (
                      <article
                        key={row.id}
                        className="grid grid-cols-1 gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_auto]"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#ecfdf5] px-2 py-1 text-xs font-black text-teal">
                              #{index + 1} score {row.priorityScore}
                            </span>
                            <span className="rounded-full border border-line px-2 py-1 text-xs font-black text-muted">
                              {row.categoryLabel || row.categoryId}
                            </span>
                            <span className="rounded-full border border-line px-2 py-1 text-xs font-black text-muted">
                              {row.evidenceFilled} preuves
                            </span>
                            <span className="rounded-full border border-line px-2 py-1 text-xs font-black text-muted">
                              {row.validImages} images
                            </span>
                          </div>
                          <h4 className="mt-2 break-words text-base font-black">
                            {row.name}
                          </h4>
                          <p className="mt-1 text-sm leading-6 text-muted">
                            {row.nextAction}
                          </p>
                          <p className="mt-2 break-all rounded-md bg-[#faf7f0] p-2 text-xs font-bold text-muted">
                            {row.imageDepositDir || "Depot WebP a creer apres packet"}
                          </p>
                        </div>
                        <div className="flex min-w-40 flex-col gap-2 lg:items-end">
                          <span className="text-sm font-black">
                            {row.targetSalePrice}
                          </span>
                          <span className="text-xs font-bold text-muted">
                            {row.targetMargin}
                          </span>
                          <Link
                            href={integrationExecutionProofHref(row)}
                            className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-xs font-black hover:bg-[#f1eadf]"
                          >
                            Verifier
                            <ArrowRight size={14} aria-hidden="true" />
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>

                  <p className="mt-4 break-all rounded-md bg-[#faf7f0] p-3 text-xs font-bold text-muted">
                    Source: {integrationExecution.boardPath}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-md border border-amber-300 bg-[#fff8e6] p-4 text-sm font-bold text-[#8a5a00]">
              Lancez `npm run catalog:integration-execution-board` pour afficher
              la file des articles a integrer dans ce cockpit.
            </div>
          )}
        </section>

        <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase text-teal">
                Production visuels exacts
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Ordre unique photos produits + categories
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                Tableau P0/P1/P2 pour produire les WebP exacts sans publication,
                sans copie publique et sans action fournisseur.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/photos-produits"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
              >
                Photos P0
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                href="/admin/images-categories"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
              >
                Categories P1/P2
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                href="/admin/visuels-exacts"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
              >
                Atelier visuels
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              {visualProductionExportHref ? (
                <a
                  href={visualProductionExportHref}
                  download={visualProductionExportFilename}
                  className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
                >
                  Exporter visuels exacts CSV
                  <Download size={16} aria-hidden="true" />
                </a>
              ) : null}
              {visualProductionAuditExportHref ? (
                <a
                  href={visualProductionAuditExportHref}
                  download={visualProductionAuditExportFilename}
                  className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
                >
                  Exporter audit CSV
                  <Download size={16} aria-hidden="true" />
                </a>
              ) : null}
              {visualDepositSessionExportHref ? (
                <a
                  href={visualDepositSessionExportHref}
                  download={visualDepositSessionExportFilename}
                  className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
                >
                  Exporter session CSV
                  <Download size={16} aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>

          {visualProductionBoard ? (
            <>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-md bg-[#f6f1e8] p-4">
                  <p className="text-xs font-black uppercase text-muted">
                    Visuels a produire
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {visualProductionBoard.board.itemCount}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase text-muted">
                    total HOLD
                  </p>
                </div>
                <div className="rounded-md bg-[#fff8e6] p-4">
                  <p className="text-xs font-black uppercase text-muted">
                    P0 produits
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {visualProductionBoard.board.counts.productPhotos}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase text-muted">
                    photos exactes
                  </p>
                </div>
                <div className="rounded-md bg-[#fff8e6] p-4">
                  <p className="text-xs font-black uppercase text-muted">
                    P1/P2 categories
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {visualProductionBoard.board.counts.categoryImages}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase text-muted">
                    visuels rayon
                  </p>
                </div>
                <div className="rounded-md bg-[#ecfdf5] p-4">
                  <p className="text-xs font-black uppercase text-muted">
                    Copie publique
                  </p>
                  <p className="mt-2 text-2xl font-black">Aucune</p>
                  <p className="mt-1 text-xs font-bold uppercase text-muted">
                    depot local seul
                  </p>
                </div>
                <div className="rounded-md bg-[#fff8e6] p-4">
                  <p className="text-xs font-black uppercase text-muted">
                    Statut
                  </p>
                  <p className="mt-2 break-words text-sm font-black">
                    {compactStatus(visualProductionBoard.board.status)}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase text-muted">
                    validation humaine requise
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-md border border-[#f2b84b] bg-[#fff8e6] p-4 text-[#6f4700]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase">
                      Alerte production visuels
                    </p>
                    <h3 className="mt-2 break-words text-lg font-black">
                      {visualProductionBoard.board.itemCount} visuels a produire maintenant
                    </h3>
                    <p className="mt-2 text-sm font-bold leading-6">
                      Priorite: P0 photos produits, puis P1/P2 categories dropshipping.
                    </p>
                    <p className="mt-2 break-all text-xs font-black uppercase">
                      {visualProductionBoard.boardPath}
                    </p>
                  </div>
                  <span className="inline-flex min-h-10 shrink-0 items-center rounded-md border border-current bg-white/70 px-3 text-xs font-black uppercase">
                    {compactStatus(visualProductionBoard.board.status)}
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-md border border-line bg-[#fbfaf7] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-muted">
                      Audit coherence visuels
                    </p>
                    <h3 className="mt-2 break-words text-lg font-black">
                      {visualProductionAudit
                        ? compactStatus(visualProductionAudit.audit.status)
                        : "Audit absent"}
                    </h3>
                    <p className="mt-2 text-sm font-bold leading-6 text-muted">
                      Controle l&apos;alignement entre le tableau unique, l&apos;ordre
                      photos produits et le suivi des categories.
                    </p>
                    <p className="mt-2 break-all text-xs font-black uppercase text-muted">
                      {visualProductionAudit
                        ? visualProductionAudit.auditPath
                        : "Relancer npm run catalog:audit-visual-production-board"}
                    </p>
                  </div>
                  <span
                    className={`inline-flex min-h-10 shrink-0 items-center rounded-md border px-3 text-xs font-black uppercase ${
                      visualProductionAudit?.audit.ok
                        ? "border-teal/25 bg-[#ecfdf5] text-teal"
                        : "border-[#f6d38b] bg-[#fff8e6] text-[#8a5a00]"
                    }`}
                  >
                    {visualProductionAudit
                      ? `${visualProductionAudit.audit.failureCount} echec`
                      : "HOLD"}
                  </span>
                </div>

                {visualProductionAudit ? (
                  <>
                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
                      <div className="rounded-md bg-white p-3">
                        <p className="text-xs font-black uppercase text-muted">
                          Visuels controles
                        </p>
                        <p className="mt-1 text-2xl font-black">
                          {visualProductionAudit.audit.metrics.itemCount}
                        </p>
                      </div>
                      <div className="rounded-md bg-white p-3">
                        <p className="text-xs font-black uppercase text-muted">
                          Photos produits
                        </p>
                        <p className="mt-1 text-2xl font-black">
                          {visualProductionAudit.audit.metrics.productPhotoCount}
                        </p>
                      </div>
                      <div className="rounded-md bg-white p-3">
                        <p className="text-xs font-black uppercase text-muted">
                          Images categories
                        </p>
                        <p className="mt-1 text-2xl font-black">
                          {visualProductionAudit.audit.metrics.categoryImageCount}
                        </p>
                      </div>
                      <div className="rounded-md bg-white p-3">
                        <p className="text-xs font-black uppercase text-muted">
                          Echecs
                        </p>
                        <p className="mt-1 text-2xl font-black">
                          {visualProductionAudit.audit.failureCount}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {visualProductionAuditFailures.length ? (
                        visualProductionAuditFailures.slice(0, 6).map((failure) => (
                          <span
                            key={failure}
                            className="rounded-md bg-[#fff8e6] px-3 py-2 text-xs font-black uppercase text-[#8a5a00]"
                          >
                            {failure}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-md bg-[#ecfdf5] px-3 py-2 text-xs font-black uppercase text-teal">
                          Aucun echec de coherence
                        </span>
                      )}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="mt-4 rounded-md border border-line bg-[#fbfaf7] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-muted">
                      Session depot visuels
                    </p>
                    <h3 className="mt-2 break-words text-lg font-black">
                      {visualDepositSession
                        ? compactStatus(visualDepositSession.session.status)
                        : "Session absente"}
                    </h3>
                    <p className="mt-2 text-sm font-bold leading-6 text-muted">
                      Feuille de route terrain avec groupes produit/categorie,
                      fichiers attendus et dossiers de depot exacts.
                    </p>
                    <p className="mt-2 break-all text-xs font-black uppercase text-muted">
                      {visualDepositSession
                        ? visualDepositSession.sessionPath
                        : "Relancer npm run catalog:visual-deposit-session"}
                    </p>
                  </div>
                  <span
                    className={`inline-flex min-h-10 shrink-0 items-center rounded-md border px-3 text-xs font-black uppercase ${
                      visualDepositSession?.session.ok
                        ? "border-teal/25 bg-[#ecfdf5] text-teal"
                        : "border-[#f6d38b] bg-[#fff8e6] text-[#8a5a00]"
                    }`}
                  >
                    {visualDepositSession
                      ? `${visualDepositSession.session.groupCount} groupes`
                      : "HOLD"}
                  </span>
                </div>

                {visualDepositSession ? (
                  <>
                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
                      <div className="rounded-md bg-white p-3">
                        <p className="text-xs font-black uppercase text-muted">
                          Groupes
                        </p>
                        <p className="mt-1 text-2xl font-black">
                          {visualDepositSession.session.groupCount}
                        </p>
                      </div>
                      <div className="rounded-md bg-white p-3">
                        <p className="text-xs font-black uppercase text-muted">
                          Visuels
                        </p>
                        <p className="mt-1 text-2xl font-black">
                          {visualDepositSession.session.itemCount}
                        </p>
                      </div>
                      <div className="rounded-md bg-white p-3">
                        <p className="text-xs font-black uppercase text-muted">
                          P0 produits
                        </p>
                        <p className="mt-1 text-2xl font-black">
                          {visualDepositSession.session.counts.p0ProductPhotos}
                        </p>
                      </div>
                      <div className="rounded-md bg-white p-3">
                        <p className="text-xs font-black uppercase text-muted">
                          P1/P2 categories
                        </p>
                        <p className="mt-1 text-2xl font-black">
                          {visualDepositSession.session.counts.categoryImages}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                      {visualDepositSessionGroups.slice(0, 9).map((group) => (
                        <article
                          key={`${group.groupOrder}-${group.targetId}`}
                          className="min-w-0 rounded-md border border-line bg-white p-3"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-[11px] font-black uppercase text-muted">
                                Groupe {group.groupOrder} - {group.urgency}
                              </p>
                              <h4 className="mt-1 break-words text-sm font-black leading-5">
                                {group.targetName}
                              </h4>
                            </div>
                            <span className="inline-flex shrink-0 rounded-md bg-[#fff8e6] px-2 py-1 text-[11px] font-black uppercase text-[#8a5a00]">
                              {group.missingCount}/{group.itemCount}
                            </span>
                          </div>
                          <p className="mt-2 break-all text-[11px] font-bold leading-5 text-muted">
                            {group.dropFolderRelative}
                          </p>
                          <p className="mt-2 text-xs font-black uppercase text-muted">
                            {group.laneLabel}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {group.expectedFiles.slice(0, 3).map((fileName) => (
                              <span
                                key={`${group.groupOrder}-${fileName}`}
                                className="max-w-full rounded-md border border-line bg-[#fbfaf7] px-2 py-1 text-[11px] font-black text-muted"
                              >
                                <span className="break-all">{fileName}</span>
                              </span>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>

                    {visualDepositSessionGroups.length > 9 ? (
                      <p className="mt-3 text-xs font-black uppercase text-muted">
                        +{visualDepositSessionGroups.length - 9} groupes restants dans le CSV.
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                {visualProductionItems.slice(0, 12).map((item) => (
                  <article
                    key={`${item.priority}-${item.expectedFileName}`}
                    className="min-w-0 rounded-md border border-line bg-[#fbfaf7] p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase text-muted">
                          Priorite {item.priority} - {item.urgency}
                        </p>
                        <h3 className="mt-2 break-words text-base font-black leading-6">
                          {item.targetName}
                        </h3>
                      </div>
                      <span className="inline-flex shrink-0 rounded-md bg-[#fff8e6] px-2 py-1 text-[11px] font-black uppercase text-[#8a5a00]">
                        {item.currentStatus}
                      </span>
                    </div>
                    <p className="mt-3 break-all text-xs font-black">
                      {item.expectedFileName}
                    </p>
                    <p className="mt-2 break-all text-xs font-bold leading-5 text-muted">
                      {item.stagingRelativePath}
                    </p>
                    <p className="mt-2 text-sm font-bold leading-6 text-muted">
                      {item.nextAction}
                    </p>
                  </article>
                ))}
              </div>

              {visualProductionItems.length > 12 ? (
                <p className="mt-3 text-xs font-black uppercase text-muted">
                  +{visualProductionItems.length - 12} visuels restants dans le CSV.
                </p>
              ) : null}
            </>
          ) : (
            <div className="mt-5 rounded-md border border-line bg-[#fbfaf7] p-4 text-sm font-bold text-muted">
              Aucun tableau de production visuels disponible. Lancez `npm run
              catalog:visual-production-board`.
            </div>
          )}
        </section>

        <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase text-teal">
                Depot photo exact
              </p>
              <h2 className="mt-2 text-2xl font-black">
                WebP a produire avant revue
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                Sprint image en HOLD: on depose les fichiers exacts dans le
                dossier local, puis seulement apres audit et validation humaine.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/photos-produits"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
              >
                Photos produits
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                href="/admin/photos-produits/checklist"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
              >
                Checklist photo
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              {photoDropExportHref ? (
                <a
                  href={photoDropExportHref}
                  download={photoDropExportFilename}
                  className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
                >
                  Exporter depot photo CSV
                  <Download size={16} aria-hidden="true" />
                </a>
              ) : null}
              {photoWorkOrderExportHref ? (
                <a
                  href={photoWorkOrderExportHref}
                  download={photoWorkOrderExportFilename}
                  className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
                >
                  Exporter ordre photos CSV
                  <Download size={16} aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>

          {photoDropKit ? (
            <>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-md bg-[#f6f1e8] p-4">
                  <p className="text-xs font-black uppercase text-muted">
                    Produits photo
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {photoDropKit.manifest.productCount}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase text-muted">
                    sprint exact
                  </p>
                </div>
                <div className="rounded-md bg-[#fff8e6] p-4">
                  <p className="text-xs font-black uppercase text-muted">
                    WebP attendus
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {photoDropKit.manifest.expectedImageCount}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase text-muted">
                    a deposer
                  </p>
                </div>
                <div className="rounded-md bg-[#ecfdf5] p-4">
                  <p className="text-xs font-black uppercase text-muted">
                    WebP valides
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {photoDropKit.manifest.presentValidWebpCount}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase text-muted">
                    dans le depot
                  </p>
                </div>
                <div className="rounded-md bg-[#fff8e6] p-4">
                  <p className="text-xs font-black uppercase text-muted">
                    Fichiers invalides
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {photoDropKit.manifest.invalidStagingFileCount}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase text-muted">
                    a corriger
                  </p>
                </div>
                <div className="rounded-md bg-[#fff8e6] p-4">
                  <p className="text-xs font-black uppercase text-muted">
                    Fichiers en trop
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {photoDropKit.manifest.extraFileCount}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase text-muted">
                    a retirer du depot
                  </p>
                </div>
              </div>

              {photoDropGate ? (
                <div
                  className={`mt-4 rounded-md border p-4 ${photoDropGateClasses(
                    photoDropGate.tone,
                  )}`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase">
                        Alerte post-depot
                      </p>
                      <h3 className="mt-2 break-words text-lg font-black">
                        {photoDropGate.label}
                      </h3>
                      <p className="mt-2 text-sm font-bold leading-6">
                        {photoDropGate.detail}
                      </p>
                      <p className="mt-2 text-xs font-black uppercase">
                        {photoDropGate.nextAction}
                      </p>
                    </div>
                    <span className="inline-flex min-h-10 shrink-0 items-center rounded-md border border-current bg-white/70 px-3 text-xs font-black uppercase">
                      {compactStatus(photoDropGate.status)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-md border border-current/20 bg-white/70 p-3">
                      <p className="text-xs font-black uppercase">
                        Audit apres depot
                      </p>
                      <p className="mt-1 break-all text-sm font-black">
                        npm run catalog:audit-photo-checklist
                      </p>
                    </div>
                    <div className="rounded-md border border-current/20 bg-white/70 p-3">
                      <p className="text-xs font-black uppercase">
                        Passerelle revue humaine
                      </p>
                      <p className="mt-1 break-all text-sm font-black">
                        npm run catalog:audit-sprint-image-human-review
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {photoMissingWorkOrder ? (
                <div className="mt-4 rounded-md border border-[#f2b84b] bg-[#fff8e6] p-4 text-[#6f4700]">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase">
                        Ordre de travail photos
                      </p>
                      <h3 className="mt-2 break-words text-lg font-black">
                        {photoMissingWorkOrder.workOrder.missingImageCount} photos a produire maintenant
                      </h3>
                      <p className="mt-2 text-sm font-bold leading-6">
                        Liste courte issue de ORDRE_TRAVAIL_PHOTOS_MANQUANTES_*.json, sans copie publique.
                      </p>
                      <p className="mt-2 break-all text-xs font-black uppercase">
                        {photoMissingWorkOrder.workOrderPath}
                      </p>
                    </div>
                    <span className="inline-flex min-h-10 shrink-0 items-center rounded-md border border-current bg-white/70 px-3 text-xs font-black uppercase">
                      HOLD PHOTOS MANQUANTES
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-2">
                    {photoMissingWorkOrderTasks.slice(0, 8).map((task, index) => (
                      <div
                        key={`${task.productId}-${task.order}-${task.expectedFileName}`}
                        className="min-w-0 rounded-md border border-current/20 bg-white/75 p-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase">
                              Photo {task.productRank}.{task.order}
                            </p>
                            <h4 className="mt-1 break-words text-sm font-black">
                              {task.productName}
                            </h4>
                          </div>
                          <span className="inline-flex shrink-0 rounded-md bg-[#fff1c7] px-2 py-1 text-[11px] font-black uppercase">
                            Priorite {index + 1}
                          </span>
                        </div>
                        <p className="mt-2 break-all text-xs font-black">
                          {task.expectedFileName}
                        </p>
                        <p className="mt-1 text-[11px] font-bold uppercase">
                          {task.role} - {task.requiredShot}
                        </p>
                        <p className="mt-2 break-all text-[11px] font-bold leading-5">
                          {task.stagingStatus} | {task.dropFolderRelative}
                        </p>
                        <p className="mt-2 text-xs font-bold leading-5">
                          {task.action}
                        </p>
                      </div>
                    ))}
                  </div>

                  {photoMissingWorkOrderTasks.length > 8 ? (
                    <p className="mt-3 text-xs font-black uppercase">
                      +{photoMissingWorkOrderTasks.length - 8} photos restantes dans le CSV.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 rounded-md border border-line bg-[#fbfaf7] p-4">
                <p className="text-xs font-black uppercase text-muted">
                  Chemin depot
                </p>
                <p className="mt-2 break-all text-sm font-bold leading-6 text-muted">
                  {photoDropKit.manifest.outputDirRelative}
                </p>
                <p className="mt-2 break-all text-xs font-bold leading-5 text-muted">
                  NOMS_FICHIERS_ATTENDUS_PHOTOS_20260611.csv
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                {photoDropKit.manifest.products.map((product) => (
                  <article
                    key={product.productId}
                    className="min-w-0 rounded-md border border-line bg-[#fbfaf7] p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase text-muted">
                          Produit photo {product.rank}
                        </p>
                        <h3 className="mt-2 break-words text-lg font-black leading-6">
                          {product.productName}
                        </h3>
                      </div>
                      <span
                        className={`inline-flex shrink-0 rounded-md border px-2 py-1 text-[11px] font-black uppercase ${statusClasses(
                          product.humanGateStatus,
                        )}`}
                      >
                        {product.presentValidWebpCount}/{product.imageCount} WebP
                      </span>
                    </div>
                    <p className="mt-3 break-all text-xs font-bold leading-5 text-muted">
                      {product.dropFolderRelative}
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      {(product.imageTasks ?? []).slice(0, 4).map((task) => (
                        <div
                          key={`${product.productId}-${task.order}-${task.expectedFileName}`}
                          className="rounded-md border border-line bg-white p-3"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="break-all text-xs font-black">
                                {task.expectedFileName}
                              </p>
                              <p className="mt-1 text-[11px] font-bold uppercase text-muted">
                                {task.role} - {task.requiredShot}
                              </p>
                            </div>
                            <span className="inline-flex shrink-0 rounded-md bg-[#fff8e6] px-2 py-1 text-[11px] font-black uppercase text-[#8a5a00]">
                              {task.stagingStatus}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-md border border-line bg-[#fbfaf7] p-4 text-sm font-bold text-muted">
              Aucun manifeste de depot photo disponible. Lancez `npm run
              catalog:photo-drop-kit` apres le sprint image.
            </div>
          )}
        </section>

        <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase text-teal">
                Depot images categories
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Visuels dropshipping a deposer
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                Suivi P1/P2 des images categories: on depose les WebP dans les
                dossiers locaux, sans copier dans `public/uploads/category-images`.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/images-categories"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
              >
                Images categories
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              {categoryImageExportHref ? (
                <a
                  href={categoryImageExportHref}
                  download={categoryImageExportFilename}
                  className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
                >
                  Exporter suivi categories CSV
                  <Download size={16} aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>

          {categoryImageIntake ? (
            <>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-md bg-[#f6f1e8] p-4">
                  <p className="text-xs font-black uppercase text-muted">
                    Lots suivis
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {categoryImageIntake.status.batchCount}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase text-muted">
                    P1 et P2
                  </p>
                </div>
                <div className="rounded-md bg-[#fff8e6] p-4">
                  <p className="text-xs font-black uppercase text-muted">
                    WebP attendus
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {categoryImageIntake.status.expectedImageCount}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase text-muted">
                    categories
                  </p>
                </div>
                <div className="rounded-md bg-[#ecfdf5] p-4">
                  <p className="text-xs font-black uppercase text-muted">
                    WebP valides
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {categoryImageIntake.status.presentValidWebpCount}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase text-muted">
                    dans les depots
                  </p>
                </div>
                <div className="rounded-md bg-[#fff8e6] p-4">
                  <p className="text-xs font-black uppercase text-muted">
                    WebP manquants
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {categoryImageIntake.status.missingCount}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase text-muted">
                    HOLD
                  </p>
                </div>
                <div className="rounded-md bg-[#fff8e6] p-4">
                  <p className="text-xs font-black uppercase text-muted">
                    Fichiers invalides
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    {categoryImageIntake.status.invalidFileCount}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase text-muted">
                    a corriger
                  </p>
                </div>
              </div>

              {categoryImageGate ? (
                <div
                  className={`mt-4 rounded-md border p-4 ${photoDropGateClasses(
                    categoryImageGate.tone,
                  )}`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase">
                        Alerte depot categories
                      </p>
                      <h3 className="mt-2 break-words text-lg font-black">
                        {categoryImageGate.label}
                      </h3>
                      <p className="mt-2 text-sm font-bold leading-6">
                        {categoryImageGate.detail}
                      </p>
                      <p className="mt-2 text-xs font-black uppercase">
                        {categoryImageGate.nextAction}
                      </p>
                    </div>
                    <span className="inline-flex min-h-10 shrink-0 items-center rounded-md border border-current bg-white/70 px-3 text-xs font-black uppercase">
                      {compactStatus(categoryImageGate.status)}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 rounded-md border border-line bg-[#fbfaf7] p-4">
                <p className="text-xs font-black uppercase text-muted">
                  Suivi depots categories
                </p>
                <p className="mt-2 break-all text-sm font-bold leading-6 text-muted">
                  {categoryImageIntake.statusPath}
                </p>
                <p className="mt-2 break-all text-xs font-bold leading-5 text-muted">
                  {categoryImageIntake.status.outputDirRelative}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                {categoryImageIntake.status.batches.map((batch) => (
                  <article
                    key={batch.manifestRelativePath}
                    className="min-w-0 rounded-md border border-line bg-[#fbfaf7] p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase text-muted">
                          Lot categories
                        </p>
                        <h3 className="mt-2 break-words text-lg font-black leading-6">
                          {batch.label}
                        </h3>
                      </div>
                      <span className="inline-flex shrink-0 rounded-md bg-[#fff8e6] px-2 py-1 text-[11px] font-black uppercase text-[#8a5a00]">
                        {batch.missingCount}/{batch.itemCount} manquants
                      </span>
                    </div>
                    <p className="mt-3 break-all text-xs font-bold leading-5 text-muted">
                      {batch.manifestRelativePath}
                    </p>
                  </article>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                {categoryImageItems.slice(0, 9).map((item) => (
                  <article
                    key={`${item.categoryId}-${item.expectedFileName}`}
                    className="min-w-0 rounded-md border border-line bg-[#fbfaf7] p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase text-muted">
                          Categorie {item.rank} - {item.batchLabel}
                        </p>
                        <h3 className="mt-2 break-words text-lg font-black leading-6">
                          {item.categoryName}
                        </h3>
                      </div>
                      <span
                        className={`inline-flex shrink-0 rounded-md border px-2 py-1 text-[11px] font-black uppercase ${statusClasses(
                          item.intakeStatus,
                        )}`}
                      >
                        {item.stagingStatus}
                      </span>
                    </div>
                    <p className="mt-3 break-all text-xs font-black">
                      {item.expectedFileName}
                    </p>
                    <p className="mt-2 break-all text-xs font-bold leading-5 text-muted">
                      {item.stagingRelativePath}
                    </p>
                    <p className="mt-2 text-sm font-bold leading-6 text-muted">
                      {item.nextAction}
                    </p>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-md border border-line bg-[#fbfaf7] p-4 text-sm font-bold text-muted">
              Aucun suivi de depot categories disponible. Lancez `npm run
              catalog:category-image-intake-status`.
            </div>
          )}
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
              <a
                href={pilotageHoldExportHref}
                download={pilotageHoldExportFilename}
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
              >
                Exporter recap CSV
                <Download size={16} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
            <div className="rounded-md bg-[#fff8e6] p-4">
              <p className="text-xs font-black uppercase text-muted">
                Zone prioritaire
              </p>
              <p className="mt-2 break-words text-2xl font-black">
                {holdToday.priorityZone.shortLabel}
              </p>
              <p className="mt-1 text-xs font-bold uppercase text-muted">
                {holdToday.priorityZone.count} blocages terrain
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-line bg-[#fbfaf7] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase text-muted">
                  Progression zones preuves
                </p>
                <h3 className="mt-2 break-words text-lg font-black">
                  Repartition des blocages terrain
                </h3>
                <p className="mt-2 text-sm font-bold leading-6 text-muted">
                  Vue courte pour choisir la prochaine zone a traiter avant toute
                  revue humaine.
                </p>
              </div>
              <span className="inline-flex min-h-10 shrink-0 items-center rounded-md border border-line bg-white px-3 text-xs font-black uppercase text-muted">
                {holdToday.zoneProgressTotal} blocages zones
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {holdToday.zoneProgressItems.map((zone) => (
                <Link
                  key={`pilotage-zone-progress-${zone.value}`}
                  href={zone.href}
                  className="focus-ring min-w-0 rounded-md border border-line bg-white p-3 hover:bg-[#f1eadf]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-black">
                        {zone.shortLabel}
                      </p>
                      <p className="mt-1 text-[11px] font-bold uppercase text-muted">
                        {zone.sharePercent}% du volume
                      </p>
                    </div>
                    <span
                      className={`inline-flex min-w-8 justify-center rounded-md px-2 py-1 text-xs font-black ${
                        zone.count > 0
                          ? "bg-[#fff8e6] text-[#8a5a00]"
                          : "bg-[#ecfdf5] text-teal"
                      }`}
                    >
                      {zone.count}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f6f1e8]">
                    <span
                      className="block h-full rounded-full bg-foreground"
                      style={{
                        width:
                          zone.count > 0
                            ? `${Math.max(zone.sharePercent, 8)}%`
                            : "0%",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] font-black uppercase text-muted">
                    Ouvrir zone
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-md border border-[#f6d38b] bg-[#fff8e6] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase text-[#8a5a00]">
                  Zone prioritaire du jour
                </p>
                <h3 className="mt-2 break-words text-lg font-black">
                  {holdToday.priorityZone.label}
                </h3>
                <p className="mt-2 text-sm font-bold leading-6 text-[#8a5a00]">
                  {holdToday.priorityZone.detail}
                </p>
                <p className="mt-2 text-xs font-black uppercase text-[#8a5a00]">
                  {holdToday.priorityZone.count} elements HOLD concernes
                </p>
              </div>
              <Link
                href={holdToday.priorityZone.href}
                className="focus-ring inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-foreground px-3 text-sm font-black text-white hover:bg-[#2b2b2b]"
              >
                Ouvrir zone
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-line bg-[#fbfaf7] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase text-muted">
                  Sprint preuves terrain
                </p>
                <h3 className="mt-2 break-words text-lg font-black">
                  3 fiches a traiter maintenant
                </h3>
                <p className="mt-2 text-sm font-bold leading-6 text-muted">
                  Recap des controles a cocher dans la session preuves, sans
                  changer les fiches ni lever le HOLD.
                </p>
              </div>
              <span className="inline-flex min-h-10 shrink-0 items-center rounded-md border border-line bg-white px-3 text-xs font-black uppercase text-muted">
                {holdToday.sprintItems.length} fiches sprint
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
              {holdToday.sprintItems.map((item, index) => (
                <article
                  key={`pilotage-sprint-${item.action.rank}-${item.action.id}`}
                  className="min-w-0 rounded-md border border-line bg-white p-3"
                >
                  <p className="text-[11px] font-black uppercase text-muted">
                    Priorite sprint {index + 1}
                  </p>
                  <h4 className="mt-2 break-words text-sm font-black leading-5">
                    {item.action.label}
                  </h4>
                  <p className="mt-2 text-xs font-bold leading-5 text-muted">
                    {item.action.nextAction}
                  </p>
                  <p className="mt-3 text-[11px] font-black uppercase text-muted">
                    Checklist session: {item.checklistCount} zones a cocher
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.zones.slice(0, 4).map((zone) => (
                      <span
                        key={`pilotage-sprint-${item.action.id}-${zone.value}`}
                        className="rounded-md border border-line bg-[#fbfaf7] px-2 py-1 text-[11px] font-black uppercase text-muted"
                      >
                        {zone.shortLabel}
                      </span>
                    ))}
                  </div>
                  <Link
                    href={item.href}
                    className="focus-ring mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
                  >
                    Ouvrir sprint
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>

            {holdToday.sprintItems.length === 0 ? (
              <p className="mt-4 rounded-md border border-line bg-white p-3 text-sm font-bold text-muted">
                Aucun sprint preuve actif dans le tableau du jour.
              </p>
            ) : null}
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
                  href={proofTerrainHref(holdToday.nextProduct)}
                  className="focus-ring inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
                >
                  Fiche terrain
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

          <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-4">
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
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
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

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
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

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.7fr_1fr]">
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
                      <dl className="mt-4 grid grid-cols-1 gap-2 border-t border-line pt-3 text-xs leading-5 sm:grid-cols-2">
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
              <div className="mt-4 grid grid-cols-1 gap-2">
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
              <ul className="mt-4 grid grid-cols-1 gap-2 text-sm font-bold text-white/78">
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

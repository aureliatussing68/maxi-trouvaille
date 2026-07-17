import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  Euro,
  Image as ImageIcon,
  LockKeyhole,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { isAdminModeEnabled } from "@/lib/admin";
import {
  getCategoryById,
  getDropshippingPublicBlockers,
  isDropshippingProduct,
  type Product,
} from "@/lib/catalog";
import {
  getAllProducts,
  getPublicImageFileBlockers,
} from "@/lib/catalog-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin décision HOLD",
};

type DecisionLane = "hold" | "review" | "ready";
type DecisionLaneFilter = DecisionLane | "all";
type ProofActionSlug =
  | "image-droits"
  | "partenaire-sku"
  | "prix-stock-marge"
  | "livraison-suivi"
  | "validation-mouss"
  | "revue-humaine";
type ProofActionFilter = ProofActionSlug | "all";
type PriorityTier = "top" | "next" | "watch";
type PriorityFilter = PriorityTier | "all";
type DecisionSort = "priority" | "blockers" | "name";
type DecisionSearchParams = Record<string, string | string[] | undefined>;

type HoldDecisionFilters = {
  lane: DecisionLaneFilter;
  q: string;
  zone: string;
  action: ProofActionFilter;
  priority: PriorityFilter;
  sort: DecisionSort;
};

type HoldDecisionRow = {
  id: string;
  slug: string;
  name: string;
  categoryName: string;
  status: string;
  lane: DecisionLane;
  decisionLabel: string;
  blockerCount: number;
  blockers: string[];
  zones: string[];
  actionSlug: ProofActionSlug;
  actionTitle: string;
  actionText: string;
  priorityScore: number;
  priorityTier: PriorityTier;
  priorityLabel: string;
  priorityReason: string;
  marginCents: number;
  stockSignal: number;
  nextAction: string;
  editHref: string;
  proofHref: string;
};

type ProofAction = {
  slug: ProofActionSlug;
  title: string;
  text: string;
  icon: LucideIcon;
};

type PriorityProfile = {
  score: number;
  tier: PriorityTier;
  label: string;
  reason: string;
  marginCents: number;
  stockSignal: number;
};

type DecisionWorkPack = {
  id: string;
  title: string;
  count: number;
  detail: string;
  guardrail: string;
  href: string;
  rows: HoldDecisionRow[];
};

type BlockerFocus = {
  label: string;
  count: number;
  href: string;
};

const blockerLabels: Record<string, string> = {
  coming_soon: "fiche à venir",
  delivery_estimate_not_ready: "délai client",
  dropshipping_disabled: "partenaire désactivé",
  exact_images_not_verified: "image exacte",
  image_file_missing: "fichier WebP",
  image_not_in_exact_product_depot: "dépôt image exacte",
  image_not_local_public_upload: "image locale",
  image_not_webp: "format WebP",
  image_remote_not_local: "image non locale",
  image_rights_not_ready: "droits image",
  internal_sourcing_hold: "validation interne",
  margin_missing: "marge",
  sale_price_missing: "prix boutique",
  source_delivery_not_ready: "preuve livraison",
  source_price_not_ready: "preuve prix",
  supplier_cdn_image: "image CDN partenaire",
  supplier_price_missing: "prix partenaire",
  supplier_sku_missing: "SKU",
  supplier_stock_missing: "stock",
  supplier_url_exact_missing: "source exacte",
  validation_gate_missing: "gate validation",
  validation_gate_not_ready: "validation Mouss",
};

const zoneMatchers = [
  {
    label: "Image/droits",
    pattern: /(image|webp|rights|file)/,
    slug: "image-droits",
  },
  {
    label: "Partenaire/SKU",
    pattern: /(supplier|sku|source|sourcing)/,
    slug: "partenaire-sku",
  },
  {
    label: "Prix/stock/marge",
    pattern: /(price|sale|margin|stock)/,
    slug: "prix-stock-marge",
  },
  {
    label: "Livraison/suivi",
    pattern: /(delivery|shipping)/,
    slug: "livraison-suivi",
  },
  {
    label: "Validation Mouss",
    pattern: /(validation|gate|hold|coming)/,
    slug: "validation-mouss",
  },
];

const humanReviewAction: ProofAction = {
  slug: "revue-humaine",
  title: "Revue humaine",
  text: "Relire la fiche et choisir manuellement la prochaine preuve à compléter.",
  icon: ClipboardCheck,
};

const proofActions: ProofAction[] = [
  {
    slug: "image-droits",
    title: "Prouver image et droits",
    text: "Valider le fichier WebP exact, le dépôt public et les droits image.",
    icon: ImageIcon,
  },
  {
    slug: "partenaire-sku",
    title: "Compléter partenaire et SKU",
    text: "Rattacher la fiche au partenaire logistique et verrouiller le SKU interne.",
    icon: ClipboardCheck,
  },
  {
    slug: "prix-stock-marge",
    title: "Verrouiller prix, stock, marge",
    text: "Contrôler prix boutique, coût partenaire, stock et marge estimée.",
    icon: Euro,
  },
  {
    slug: "livraison-suivi",
    title: "Confirmer livraison et suivi",
    text: "Prouver délai France/Europe, suivi colis et promesse client.",
    icon: Truck,
  },
  {
    slug: "validation-mouss",
    title: "Préparer validation Mouss",
    text: "Rassembler les preuves avant une décision humaine, jamais automatique.",
    icon: BadgeCheck,
  },
  humanReviewAction,
];

const laneFilters: Array<{ label: string; value: DecisionLaneFilter }> = [
  { label: "Tous", value: "all" },
  { label: "HOLD strict", value: "hold" },
  { label: "Revue prioritaire", value: "review" },
  { label: "Revue Mouss", value: "ready" },
];

const priorityFilters: Array<{
  label: string;
  value: PriorityFilter;
  detail: string;
}> = [
  { label: "Toutes priorités", value: "all", detail: "file complète" },
  { label: "Priorité 1", value: "top", detail: "potentiel fort" },
  { label: "Priorité 2", value: "next", detail: "à traiter ensuite" },
  { label: "À surveiller", value: "watch", detail: "friction élevée" },
];

const sortOptions: Array<{ label: string; value: DecisionSort }> = [
  { label: "Priorité business", value: "priority" },
  { label: "Moins de blocages", value: "blockers" },
  { label: "Nom A-Z", value: "name" },
];

function publicStatus(product: Product) {
  return product.status ?? "published";
}

function readableBlocker(blocker: string) {
  return blockerLabels[blocker] ?? blocker.replace(/_/g, " ");
}

function zonesForBlockers(blockers: string[]) {
  const text = blockers.join(" ");
  const zones = zoneMatchers
    .filter((zone) => zone.pattern.test(text))
    .map((zone) => zone.label);

  return zones.length > 0 ? zones : ["Revue humaine"];
}

function laneForBlockers(product: Product, blockers: string[]): DecisionLane {
  if (blockers.length === 0 && publicStatus(product) === "published") {
    return "ready";
  }

  if (blockers.length <= 5) {
    return "review";
  }

  return "hold";
}

function decisionLabel(lane: DecisionLane) {
  if (lane === "ready") {
    return "Prêt pour revue Mouss";
  }

  if (lane === "review") {
    return "Revue prioritaire";
  }

  return "HOLD strict";
}

function formatCents(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    currency: "EUR",
    style: "currency",
  }).format(cents / 100);
}

function estimatedMarginCents(product: Product) {
  if (typeof product.dropshipping?.marginCents === "number") {
    return Math.max(0, product.dropshipping.marginCents);
  }

  const saleCents =
    product.dropshipping?.salePriceCents ?? Math.round(product.price * 100);
  const costCents = product.dropshipping?.supplierPriceCents;

  if (typeof costCents !== "number") {
    return 0;
  }

  return Math.max(0, saleCents - costCents);
}

function stockSignal(product: Product) {
  return Math.max(
    0,
    product.dropshipping?.supplierStock ?? product.stock ?? 0,
  );
}

function priorityClasses(tier: PriorityTier) {
  if (tier === "top") {
    return "border-teal/25 bg-[#ecfdf5] text-teal";
  }

  if (tier === "next") {
    return "border-[#f6d38b] bg-[#fff8e6] text-[#8a5a00]";
  }

  return "border-line bg-[#f6f1e8] text-muted";
}

function priorityForProduct(
  product: Product,
  row: Pick<HoldDecisionRow, "actionSlug" | "blockerCount" | "lane">,
): PriorityProfile {
  const marginCents = estimatedMarginCents(product);
  const stock = stockSignal(product);
  const reasons: string[] = [];
  let score = 0;

  if (marginCents >= 1500) {
    score += 34;
    reasons.push("marge forte");
  } else if (marginCents >= 1000) {
    score += 26;
    reasons.push("marge solide");
  } else if (marginCents >= 600) {
    score += 18;
    reasons.push("marge correcte");
  } else if (marginCents > 0) {
    score += 10;
    reasons.push("marge à confirmer");
  } else {
    reasons.push("marge à renseigner");
  }

  if (stock >= 25) {
    score += 18;
    reasons.push("stock confortable");
  } else if (stock >= 10) {
    score += 12;
    reasons.push("stock exploitable");
  } else if (stock > 0) {
    score += 6;
    reasons.push("stock limité");
  } else {
    reasons.push("stock à prouver");
  }

  if (row.blockerCount <= 4) {
    score += 24;
    reasons.push("friction faible");
  } else if (row.blockerCount <= 8) {
    score += 15;
    reasons.push("friction moyenne");
  } else {
    score += 7;
    reasons.push("preuves nombreuses");
  }

  if (row.lane === "ready") {
    score += 18;
    reasons.push("revue Mouss possible");
  } else if (row.actionSlug === "image-droits") {
    score += 12;
    reasons.push("image prioritaire");
  } else if (row.actionSlug === "prix-stock-marge") {
    score += 10;
    reasons.push("prix à verrouiller");
  } else if (row.actionSlug === "livraison-suivi") {
    score += 8;
    reasons.push("livraison à confirmer");
  } else {
    score += 5;
    reasons.push("revue à cadrer");
  }

  const cappedScore = Math.min(100, score);
  const tier: PriorityTier =
    cappedScore >= 60 ? "top" : cappedScore >= 38 ? "next" : "watch";
  const label =
    tier === "top"
      ? "Priorité 1"
      : tier === "next"
        ? "Priorité 2"
        : "À surveiller";

  return {
    score: cappedScore,
    tier,
    label,
    reason: reasons.join(" · "),
    marginCents,
    stockSignal: stock,
  };
}

function proofActionFor(row: Pick<HoldDecisionRow, "lane" | "zones">) {
  if (row.lane === "ready") {
    return proofActions.find((action) => action.slug === "validation-mouss") ?? humanReviewAction;
  }

  if (row.zones.includes("Image/droits")) {
    return proofActions.find((action) => action.slug === "image-droits") ?? humanReviewAction;
  }

  if (row.zones.includes("Partenaire/SKU")) {
    return proofActions.find((action) => action.slug === "partenaire-sku") ?? humanReviewAction;
  }

  if (row.zones.includes("Prix/stock/marge")) {
    return proofActions.find((action) => action.slug === "prix-stock-marge") ?? humanReviewAction;
  }

  if (row.zones.includes("Livraison/suivi")) {
    return proofActions.find((action) => action.slug === "livraison-suivi") ?? humanReviewAction;
  }

  if (row.zones.includes("Validation Mouss")) {
    return proofActions.find((action) => action.slug === "validation-mouss") ?? humanReviewAction;
  }

  return humanReviewAction;
}

function nextActionFor(row: Pick<HoldDecisionRow, "lane" | "zones" | "blockerCount">) {
  if (row.lane === "ready") {
    return "Relire la fiche, signer la validation humaine, puis décider manuellement de la sortie HOLD.";
  }

  if (row.zones.includes("Image/droits")) {
    return "Prouver l'image exacte et les droits image avant toute autre décision.";
  }

  if (row.zones.includes("Prix/stock/marge")) {
    return "Verrouiller prix partenaire, prix boutique, stock et marge.";
  }

  if (row.zones.includes("Livraison/suivi")) {
    return "Confirmer délai France/Europe, suivi colis et conditions d'expédition.";
  }

  return `${row.blockerCount} preuves à compléter avant revue Mouss.`;
}

function laneClasses(lane: DecisionLane) {
  if (lane === "ready") {
    return "border-teal/25 bg-[#ecfdf5] text-teal";
  }

  if (lane === "review") {
    return "border-[#f6d38b] bg-[#fff8e6] text-[#8a5a00]";
  }

  return "border-rose/25 bg-[#fff1f2] text-rose";
}

function zoneIcon(zone: string) {
  if (zone.includes("Image")) return ImageIcon;
  if (zone.includes("Prix")) return Euro;
  if (zone.includes("Livraison")) return Truck;
  if (zone.includes("Validation")) return BadgeCheck;
  return ClipboardCheck;
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(searchParams: DecisionSearchParams): HoldDecisionFilters {
  const requestedLane = singleValue(searchParams.lane);
  const requestedZone = singleValue(searchParams.zone);
  const requestedAction = singleValue(searchParams.action);
  const requestedPriority = singleValue(searchParams.priority);
  const requestedSort = singleValue(searchParams.sort);
  const q = singleValue(searchParams.q)?.trim() ?? "";
  const lane = laneFilters.some((filter) => filter.value === requestedLane)
    ? (requestedLane as DecisionLaneFilter)
    : "all";
  const zone = zoneMatchers.some((matcher) => matcher.slug === requestedZone)
    ? requestedZone ?? "all"
    : "all";
  const action = proofActions.some((proofAction) => proofAction.slug === requestedAction)
    ? (requestedAction as ProofActionSlug)
    : "all";
  const priority = priorityFilters.some(
    (priorityFilter) => priorityFilter.value === requestedPriority,
  )
    ? (requestedPriority as PriorityFilter)
    : "all";
  const sort = sortOptions.some((sortOption) => sortOption.value === requestedSort)
    ? (requestedSort as DecisionSort)
    : "priority";

  return {
    lane,
    q,
    zone,
    action,
    priority,
    sort,
  };
}

function decisionHref(
  currentFilters: HoldDecisionFilters,
  nextFilters: Partial<HoldDecisionFilters>,
) {
  const lane = nextFilters.lane ?? currentFilters.lane;
  const zone = nextFilters.zone ?? currentFilters.zone;
  const action = nextFilters.action ?? currentFilters.action;
  const priority = nextFilters.priority ?? currentFilters.priority;
  const sort = nextFilters.sort ?? currentFilters.sort;
  const q = nextFilters.q ?? currentFilters.q;
  const params = new URLSearchParams();

  if (lane !== "all") params.set("lane", lane);
  if (zone !== "all") params.set("zone", zone);
  if (action !== "all") params.set("action", action);
  if (priority !== "all") params.set("priority", priority);
  if (sort !== "priority") params.set("sort", sort);
  if (q) params.set("q", q);

  const query = params.toString();
  return query ? `/admin/decision-hold?${query}` : "/admin/decision-hold";
}

function filterDecisionRows(
  rows: HoldDecisionRow[],
  filters: HoldDecisionFilters,
) {
  const query = filters.q.toLowerCase();
  const activeZone = zoneMatchers.find((zone) => zone.slug === filters.zone);

  return rows.filter((row) => {
    if (filters.lane !== "all" && row.lane !== filters.lane) {
      return false;
    }

    if (activeZone && !row.zones.includes(activeZone.label)) {
      return false;
    }

    if (filters.action !== "all" && row.actionSlug !== filters.action) {
      return false;
    }

    if (filters.priority !== "all" && row.priorityTier !== filters.priority) {
      return false;
    }

    if (!query) {
      return true;
    }

    return [
      row.name,
      row.slug,
      row.categoryName,
      row.decisionLabel,
      row.actionTitle,
      row.actionText,
      row.priorityLabel,
      row.priorityReason,
      ...row.blockers,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}

function sortDecisionRows(rows: HoldDecisionRow[], sort: DecisionSort) {
  return [...rows].sort((a, b) => {
    if (sort === "blockers") {
      return (
        a.blockerCount - b.blockerCount ||
        b.priorityScore - a.priorityScore ||
        a.name.localeCompare(b.name)
      );
    }

    if (sort === "name") {
      return a.name.localeCompare(b.name);
    }

    return (
      b.priorityScore - a.priorityScore ||
      a.blockerCount - b.blockerCount ||
      a.name.localeCompare(b.name)
    );
  });
}

async function buildDecisionRows(): Promise<HoldDecisionRow[]> {
  const products = (await getAllProducts()).filter(isDropshippingProduct);
  const rows = await Promise.all(
    products.map(async (product) => {
      const blockers = Array.from(
        new Set([
          ...getDropshippingPublicBlockers(product),
          ...(await getPublicImageFileBlockers(product)),
        ]),
      );
      const lane = laneForBlockers(product, blockers);
      const zones = zonesForBlockers(blockers);
      const action = proofActionFor({ lane, zones });
      const rowBase = {
        lane,
        zones,
        blockerCount: blockers.length,
        actionSlug: action.slug,
      };
      const priority = priorityForProduct(product, {
        actionSlug: action.slug,
        blockerCount: blockers.length,
        lane,
      });

      return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        categoryName: getCategoryById(product.categoryId)?.name ?? product.categoryId,
        status: publicStatus(product),
        lane,
        decisionLabel: decisionLabel(lane),
        blockerCount: blockers.length,
        blockers: blockers.map(readableBlocker),
        zones,
        actionSlug: action.slug,
        actionTitle: action.title,
        actionText: action.text,
        priorityScore: priority.score,
        priorityTier: priority.tier,
        priorityLabel: priority.label,
        priorityReason: priority.reason,
        marginCents: priority.marginCents,
        stockSignal: priority.stockSignal,
        nextAction: nextActionFor(rowBase),
        editHref: `/admin/produits/${product.slug}/modifier`,
        proofHref: `/admin/preuves-partenaires?status=hold&q=${encodeURIComponent(
          product.slug,
        )}#top-verification`,
      };
    }),
  );

  return rows.sort((a, b) => {
    const laneOrder: Record<DecisionLane, number> = {
      review: 0,
      hold: 1,
      ready: 2,
    };

    return (
      laneOrder[a.lane] - laneOrder[b.lane] ||
      a.blockerCount - b.blockerCount ||
      a.name.localeCompare(b.name)
    );
  });
}

function buildCsv(rows: HoldDecisionRow[]) {
  const headers = [
    "decision",
    "produit",
    "slug",
    "categorie",
    "statut",
    "priorite",
    "score",
    "marge_interne_estimee",
    "stock_signal",
    "raison_priorite",
    "blocages",
    "zones",
    "preuve_suivante",
    "prochaine_action",
  ];
  const escape = (value: unknown) =>
    `"${String(value ?? "")
      .replace(/\r?\n|\r/g, " ")
      .replace(/"/g, '""')}"`;

  return [
    headers.map(escape).join(","),
    ...rows.map((row) =>
      [
        row.decisionLabel,
        row.name,
        row.slug,
        row.categoryName,
        row.status,
        row.priorityLabel,
        row.priorityScore,
        formatCents(row.marginCents),
        row.stockSignal,
        row.priorityReason,
        row.blockers.join(" | "),
        row.zones.join(" | "),
        row.actionTitle,
        row.nextAction,
      ]
        .map(escape)
        .join(","),
    ),
  ].join("\r\n");
}

function firstPriorityRows(rows: HoldDecisionRow[]) {
  return sortDecisionRows(rows, "priority").slice(0, 3);
}

function buildDecisionWorkPacks(
  rows: HoldDecisionRow[],
  filters: HoldDecisionFilters,
): DecisionWorkPack[] {
  const priorityRows = rows.filter(
    (row) => row.priorityTier === "top" && row.lane !== "ready",
  );
  const imageRows = rows.filter((row) => row.actionSlug === "image-droits");
  const marginRows = rows.filter(
    (row) => row.actionSlug === "prix-stock-marge",
  );
  const deliveryRows = rows.filter(
    (row) => row.actionSlug === "livraison-suivi",
  );
  const moussRows = rows.filter(
    (row) => row.actionSlug === "validation-mouss" || row.lane === "ready",
  );

  return [
    {
      id: "priority-business",
      title: "Sprint priorité 1",
      count: priorityRows.length,
      detail: "Fiches avec potentiel business à traiter avant les longues files.",
      guardrail: "HOLD conservé tant que toutes les preuves exactes manquent.",
      href: decisionHref(filters, { priority: "top", sort: "priority" }),
      rows: firstPriorityRows(priorityRows),
    },
    {
      id: "images-rights",
      title: "Sprint images exactes",
      count: imageRows.length,
      detail: "Photos, WebP exacts, dépôt public et droits image à prouver.",
      guardrail: "Aucun visuel approximatif ne sort en public.",
      href: decisionHref(filters, { action: "image-droits", sort: "priority" }),
      rows: firstPriorityRows(imageRows),
    },
    {
      id: "price-stock-margin",
      title: "Sprint prix, stock, marge",
      count: marginRows.length,
      detail: "Prix partenaire, prix boutique, stock et marge à verrouiller.",
      guardrail: "Aucun paiement ni commande partenaire depuis cette file.",
      href: decisionHref(filters, {
        action: "prix-stock-marge",
        sort: "priority",
      }),
      rows: firstPriorityRows(marginRows),
    },
    {
      id: "delivery-tracking",
      title: "Sprint livraison",
      count: deliveryRows.length,
      detail: "Délai France/Europe, suivi colis et promesse client à confirmer.",
      guardrail: "Promesse publique seulement après preuve logistique.",
      href: decisionHref(filters, {
        action: "livraison-suivi",
        sort: "priority",
      }),
      rows: firstPriorityRows(deliveryRows),
    },
    {
      id: "mouss-review",
      title: "Revue Mouss",
      count: moussRows.length,
      detail: "Fiches à relire humainement avant toute décision de sortie HOLD.",
      guardrail: "Validation explicite obligatoire, jamais automatique.",
      href: decisionHref(filters, {
        action: "validation-mouss",
        sort: "blockers",
      }),
      rows: firstPriorityRows(moussRows),
    },
  ];
}

function blockerActionForLabel(label: string): ProofActionSlug {
  const normalizedLabel = label.toLowerCase();

  if (/(image|webp|droits|photo|cdn|fichier)/.test(normalizedLabel)) {
    return "image-droits";
  }

  if (/(sku|source|partenaire|validation interne)/.test(normalizedLabel)) {
    return "partenaire-sku";
  }

  if (/(prix|stock|marge)/.test(normalizedLabel)) {
    return "prix-stock-marge";
  }

  if (/(livraison|délai|delai|suivi)/.test(normalizedLabel)) {
    return "livraison-suivi";
  }

  if (/(validation|hold|fiche à venir|fiche a venir)/.test(normalizedLabel)) {
    return "validation-mouss";
  }

  return "revue-humaine";
}

function buildBlockerFocus(
  rows: HoldDecisionRow[],
  filters: HoldDecisionFilters,
): BlockerFocus[] {
  const blockerCounts = new Map<string, number>();

  for (const row of rows) {
    for (const blocker of row.blockers) {
      blockerCounts.set(blocker, (blockerCounts.get(blocker) ?? 0) + 1);
    }
  }

  return [...blockerCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([label, count]) => ({
      label,
      count,
      href: decisionHref(filters, {
        action: blockerActionForLabel(label),
        sort: "priority",
      }),
    }));
}

export default async function AdminHoldDecisionPage({
  searchParams,
}: {
  searchParams?: Promise<DecisionSearchParams>;
}) {
  if (!isAdminModeEnabled()) {
    return (
      <>
        <PageHeader
          eyebrow="Admin"
          title="Décision HOLD verrouillée"
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

  const rows = await buildDecisionRows();
  const filters = parseFilters(searchParams ? await searchParams : {});
  const filteredRows = filterDecisionRows(rows, filters);
  const sortedFilteredRows = sortDecisionRows(filteredRows, filters.sort);
  const reviewRows = rows.filter((row) => row.lane === "review");
  const holdRows = rows.filter((row) => row.lane === "hold");
  const readyRows = rows.filter((row) => row.lane === "ready");
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(
    buildCsv(sortedFilteredRows),
  )}`;
  const laneCounts = laneFilters.map((filter) => ({
    ...filter,
    count:
      filter.value === "all"
        ? rows.length
        : rows.filter((row) => row.lane === filter.value).length,
  }));
  const zoneCounts = zoneMatchers.map((zone) => ({
    label: zone.label,
    slug: zone.slug,
    count: rows.filter((row) => row.zones.includes(zone.label)).length,
  }));
  const actionCounts = proofActions.map((action) => ({
    ...action,
    count: rows.filter((row) => row.actionSlug === action.slug).length,
  }));
  const priorityCounts = priorityFilters.map((priority) => ({
    ...priority,
    count:
      priority.value === "all"
        ? rows.length
        : rows.filter((row) => row.priorityTier === priority.value).length,
  }));
  const workPacks = buildDecisionWorkPacks(rows, filters);
  const blockerFocus = buildBlockerFocus(rows, filters);

  return (
    <>
      <PageHeader
        eyebrow="Admin HOLD"
        title="Décision compacte avant sortie de HOLD"
        description="Lecture rapide des fiches partenaires: preuves manquantes, zones à traiter et décision humaine conseillée. Aucune publication ni action sensible."
      />

      <section className="container-page grid gap-8 py-10">
        <div className="grid gap-3 rounded-lg border border-line bg-paper p-5 shadow-sm lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-black uppercase text-teal">
              <LockKeyhole size={16} aria-hidden="true" />
              Verrou de publication actif
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {filteredRows.length} fiches affichées sur {rows.length}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Cette page ne valide rien automatiquement. Elle prépare la décision
              Mouss: maintenir HOLD, traiter en priorité, ou relire avant sortie
              manuelle.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/preuves-partenaires?status=hold#top-verification"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]"
            >
              Ouvrir preuves
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <a
              href={csvHref}
              download="maxi-decision-hold-compact.csv"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-black hover:bg-[#f1eadf]"
            >
              Export CSV
            </a>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            title="Revue prioritaire"
            value={reviewRows.length}
            detail="peu de preuves à compléter"
            lane="review"
            href={decisionHref(filters, { lane: "review" })}
            active={filters.lane === "review"}
          />
          <MetricCard
            title="HOLD strict"
            value={holdRows.length}
            detail="preuves bloquantes"
            lane="hold"
            href={decisionHref(filters, { lane: "hold" })}
            active={filters.lane === "hold"}
          />
          <MetricCard
            title="Revue Mouss"
            value={readyRows.length}
            detail="sortie HOLD jamais automatique"
            lane="ready"
            href={decisionHref(filters, { lane: "ready" })}
            active={filters.lane === "ready"}
          />
        </div>

        <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-teal">
                File chef Maxi Trouvaille
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Les gros lots à traiter sans publier
              </h2>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-muted">
                Chaque lot renvoie vers le bon filtre admin. Il sert à avancer
                vite sur les preuves, pas à sortir une fiche du HOLD.
              </p>
            </div>
            <span className="rounded-md border border-line px-3 py-2 text-xs font-black uppercase text-muted">
              lecture admin
            </span>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-5">
            {workPacks.map((pack) => (
              <Link
                key={pack.id}
                href={pack.href}
                className="focus-ring grid min-h-[250px] rounded-md border border-line bg-[#fbfaf7] p-4 hover:bg-[#f1eadf]"
              >
                <span>
                  <span className="block text-sm font-black uppercase text-teal">
                    {pack.title}
                  </span>
                  <span className="mt-2 block text-3xl font-black">
                    {pack.count}
                  </span>
                  <span className="mt-2 block text-sm font-bold leading-6 text-muted">
                    {pack.detail}
                  </span>
                </span>
                <span className="mt-4 block rounded-md border border-line bg-white px-2 py-2 text-xs font-black leading-5 text-muted">
                  {pack.guardrail}
                </span>
                <span className="mt-4 grid gap-1 text-xs font-bold leading-5 text-muted">
                  {pack.rows.length > 0 ? (
                    pack.rows.map((row) => (
                      <span key={`${pack.id}-${row.id}`} className="truncate">
                        {row.name} · {row.blockerCount} blocages
                      </span>
                    ))
                  ) : (
                    <span>Aucune fiche prioritaire dans ce lot.</span>
                  )}
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <p className="text-xs font-black uppercase text-muted">
              Blocages dominants
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {blockerFocus.map((blocker) => (
                <Link
                  key={blocker.label}
                  href={blocker.href}
                  className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
                >
                  {blocker.label}
                  <span className="rounded bg-[#fbfaf7] px-1.5 py-0.5 text-xs text-muted">
                    {blocker.count}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-teal">
                Filtres de décision
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Prioriser sans sortir du HOLD
              </h2>
            </div>
            <Link
              href="/admin/decision-hold"
              className="focus-ring inline-flex min-h-10 items-center justify-center rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
            >
              Réinitialiser
            </Link>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {laneCounts.map((filter) => (
              <Link
                key={filter.value}
                href={decisionHref(filters, { lane: filter.value })}
                className={`focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-black ${
                  filters.lane === filter.value
                    ? "border-teal bg-[#eef8f6] text-teal"
                    : "border-line bg-[#fbfaf7] hover:bg-[#f1eadf]"
                }`}
              >
                {filter.label}
                <span className="rounded bg-white/70 px-1.5 py-0.5 text-xs">
                  {filter.count}
                </span>
              </Link>
            ))}
          </div>

          <form
            action="/admin/decision-hold"
            className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"
          >
            {filters.lane !== "all" ? (
              <input type="hidden" name="lane" value={filters.lane} />
            ) : null}
            {filters.zone !== "all" ? (
              <input type="hidden" name="zone" value={filters.zone} />
            ) : null}
            {filters.action !== "all" ? (
              <input type="hidden" name="action" value={filters.action} />
            ) : null}
            {filters.priority !== "all" ? (
              <input type="hidden" name="priority" value={filters.priority} />
            ) : null}
            {filters.sort !== "priority" ? (
              <input type="hidden" name="sort" value={filters.sort} />
            ) : null}
            <label className="sr-only" htmlFor="decision-hold-q">
              Rechercher une fiche
            </label>
            <input
              id="decision-hold-q"
              name="q"
              defaultValue={filters.q}
              className="focus-ring min-h-11 rounded-md border border-line bg-white px-3 text-sm font-bold outline-none"
              placeholder="Rechercher produit, slug, catégorie ou preuve"
            />
            <button className="focus-ring min-h-11 rounded-md bg-foreground px-4 text-sm font-black text-white hover:bg-[#2b2b2b]">
              Filtrer
            </button>
          </form>

          <div className="mt-4 border-t border-line pt-4">
            <p className="text-xs font-black uppercase text-muted">
              Tri de travail
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {sortOptions.map((sortOption) => (
                <Link
                  key={sortOption.value}
                  href={decisionHref(filters, { sort: sortOption.value })}
                  className={`focus-ring inline-flex min-h-10 items-center justify-center rounded-md border px-3 text-sm font-black ${
                    filters.sort === sortOption.value
                      ? "border-teal bg-[#eef8f6] text-teal"
                      : "border-line bg-[#fbfaf7] hover:bg-[#f1eadf]"
                  }`}
                >
                  {sortOption.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-teal">
                Priorité business
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Traiter en premier les fiches à meilleur potentiel
              </h2>
            </div>
            <span className="rounded-md border border-line px-3 py-2 text-xs font-black uppercase text-muted">
              score interne
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {priorityCounts.map((priority) => {
              const isActive = filters.priority === priority.value;

              return (
                <Link
                  key={priority.value}
                  href={decisionHref(filters, {
                    priority: isActive ? "all" : priority.value,
                  })}
                  className={`focus-ring rounded-md border p-4 ${
                    isActive
                      ? "border-teal bg-[#eef8f6] ring-2 ring-teal/20"
                      : "border-line bg-[#fbfaf7] hover:bg-[#f1eadf]"
                  }`}
                >
                  <span
                    className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-black uppercase ${
                      priority.value === "all"
                        ? "border-line bg-white text-muted"
                        : priorityClasses(priority.value)
                    }`}
                  >
                    {priority.label}
                  </span>
                  <p className="mt-4 text-3xl font-black">{priority.count}</p>
                  <p className="mt-1 text-sm font-bold text-muted">
                    {priority.detail}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-teal">
                Preuve suivante à faire
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Regrouper les fiches par action concrète
              </h2>
            </div>
            <span className="rounded-md border border-line px-3 py-2 text-xs font-black uppercase text-muted">
              HOLD conservé
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {actionCounts.map((action) => {
              const Icon = action.icon;
              const isActive = filters.action === action.slug;

              return (
                <Link
                  key={action.slug}
                  href={decisionHref(filters, {
                    action: isActive ? "all" : action.slug,
                  })}
                  className={`focus-ring grid min-h-[150px] gap-3 rounded-md border p-4 ${
                    isActive
                      ? "border-teal bg-[#eef8f6] ring-2 ring-teal/20"
                      : "border-line bg-[#fbfaf7] hover:bg-[#f1eadf]"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className="rounded-md bg-white/80 px-2 py-1 text-xs font-black text-muted">
                      {action.count}
                    </span>
                  </span>
                  <span>
                    <span className="block text-base font-black">
                      {action.title}
                    </span>
                    <span className="mt-1 block text-sm font-bold leading-6 text-muted">
                      {action.text}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-teal">
                Zones de preuve
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Ce qui empêche la vente propre
              </h2>
            </div>
            <span className="rounded-md border border-line px-3 py-2 text-xs font-black uppercase text-muted">
              lecture seule
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {zoneCounts.map((zone) => {
              const Icon = zoneIcon(zone.label);

              return (
                <Link
                  key={zone.label}
                  href={decisionHref(filters, { zone: zone.slug })}
                  className={`focus-ring rounded-md border p-4 ${
                    filters.zone === zone.slug
                      ? "border-teal bg-[#eef8f6]"
                      : "border-line bg-[#fbfaf7] hover:bg-[#f1eadf]"
                  }`}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <p className="mt-4 text-3xl font-black">{zone.count}</p>
                  <h3 className="mt-1 text-sm font-black">{zone.label}</h3>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4">
          <div>
            <p className="text-sm font-black uppercase text-teal">
              File de décision
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {filteredRows.length} fiches à traiter sans lever le HOLD
            </h2>
          </div>

          <div className="grid gap-3">
            {filteredRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line bg-paper p-6 text-sm font-bold text-muted">
                Aucune fiche ne correspond à ces filtres. Le verrou HOLD reste
                actif; élargissez la recherche pour reprendre la revue.
              </div>
            ) : null}

            {sortedFilteredRows.slice(0, 30).map((row) => (
              <article
                key={row.id}
                className="rounded-lg border border-line bg-paper p-4 shadow-sm"
              >
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md border px-2 py-1 text-[11px] font-black uppercase ${laneClasses(
                          row.lane,
                        )}`}
                      >
                        {row.decisionLabel}
                      </span>
                      <span className="rounded-md bg-[#f6f1e8] px-2 py-1 text-[11px] font-black uppercase text-muted">
                        {row.status}
                      </span>
                      <span className="text-xs font-black uppercase text-muted">
                        {row.categoryName}
                      </span>
                    </div>
                    <h3 className="mt-2 text-lg font-black leading-6">
                      {row.name}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span
                        className={`rounded-md border px-2 py-1 text-xs font-black ${priorityClasses(
                          row.priorityTier,
                        )}`}
                      >
                        {row.priorityLabel} · score {row.priorityScore}
                      </span>
                      <span className="rounded-md border border-line bg-[#fbfaf7] px-2 py-1 text-xs font-black text-muted">
                        Marge interne {formatCents(row.marginCents)}
                      </span>
                      <span className="rounded-md border border-line bg-[#fbfaf7] px-2 py-1 text-xs font-black text-muted">
                        Stock signal {row.stockSignal}
                      </span>
                    </div>
                    <p className="mt-2 inline-flex rounded-md border border-line bg-[#fbfaf7] px-2 py-1 text-xs font-black text-muted">
                      Prochaine preuve: {row.actionTitle}
                    </p>
                    <p className="mt-2 text-xs font-bold leading-5 text-muted">
                      {row.priorityReason}
                    </p>
                    <p className="mt-2 text-sm font-bold leading-6 text-muted">
                      {row.nextAction}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Link
                      href={row.proofHref}
                      className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-foreground px-3 text-sm font-black text-white hover:bg-[#2b2b2b]"
                    >
                      Preuves
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                    <Link
                      href={row.editHref}
                      className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
                    >
                      Éditer
                    </Link>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 border-t border-line pt-4 lg:grid-cols-[0.8fr_1.2fr]">
                  <div>
                    <p className="text-xs font-black uppercase text-muted">
                      {row.blockerCount} bloqueurs
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {row.zones.map((zone) => (
                        <span
                          key={`${row.id}-${zone}`}
                          className="rounded-md border border-line bg-[#fbfaf7] px-2 py-1 text-xs font-black text-muted"
                        >
                          {zone}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ul className="grid gap-1 text-xs font-bold leading-5 text-muted sm:grid-cols-2 lg:grid-cols-3">
                    {row.blockers.slice(0, 9).map((blocker) => (
                      <li key={`${row.id}-${blocker}`}>{blocker}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-[#171717] p-5 text-white shadow-sm">
          <p className="flex items-center gap-2 text-sm font-black uppercase text-brand">
            <ShieldCheck size={16} aria-hidden="true" />
            Rappels stricts
          </p>
          <div className="mt-4 grid gap-2 text-sm font-bold text-white/78 sm:grid-cols-2 lg:grid-cols-4">
            <p>Aucun paiement</p>
            <p>Aucune commande partenaire</p>
            <p>Aucune publication automatique</p>
            <p>Validation humaine obligatoire</p>
          </div>
        </section>
      </section>
    </>
  );
}

function MetricCard({
  title,
  value,
  detail,
  lane,
  href,
  active = false,
}: {
  title: string;
  value: number;
  detail: string;
  lane: DecisionLane;
  href?: string;
  active?: boolean;
}) {
  const className = `rounded-lg border bg-paper p-5 shadow-sm ${
    active ? "border-teal ring-2 ring-teal/20" : "border-line"
  }`;
  const content = (
    <>
      <span
        className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-black uppercase ${laneClasses(
          lane,
        )}`}
      >
        {title}
      </span>
      <p className="mt-4 text-4xl font-black">{value}</p>
      <p className="mt-1 text-sm font-bold text-muted">{detail}</p>
    </>
  );

  return href ? (
    <Link href={href} className={`focus-ring block ${className}`}>
      {content}
    </Link>
  ) : (
    <article className={className}>{content}</article>
  );
}

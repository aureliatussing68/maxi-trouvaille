"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Loader2,
  PackageCheck,
  Send,
  ShieldCheck,
  Truck,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, Product } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { QUICK_PRODUCTS_UPDATED_EVENT } from "@/lib/quick-products";
import {
  getDropshippingOrderOperationsSummary,
  getDropshippingSupplierActionReadiness,
} from "@/lib/dropshipping-operations";
import {
  calculateDropshippingSalePrice,
  dropshippingStatusLabels,
  formatInputPrice,
  parseMoneyToCents,
  type DropshippingOrder,
  type DropshippingOrderStatus,
  type DropshippingRoundingMode,
} from "@/lib/dropshipping-shared";

type ConnectorStatus = {
  name: string;
  ready: boolean;
  detail: string;
};

type DropshippingAdminPanelProps = {
  initialOrders: DropshippingOrder[];
  initialDraftProducts?: Product[];
  connectorStatus: ConnectorStatus[];
  dropshippingCategories: Category[];
  prefill?: PartnerImportPrefill;
};

type PartnerImportPrefill = {
  candidateId?: string;
  candidateCategory?: string;
  sourceMode?: string;
  sourceGeneratedAt?: string;
  title?: string;
  supplierUrl?: string;
  categoryId?: string;
  description?: string;
  deliveryEstimate?: string;
};

type DraftGateFilter = "all" | "complete" | "incomplete" | "missing";
type DraftSupplierFilter = "all" | "with-link" | "without-link";
type DraftPriorityFilter = "all" | "urgent" | "ready";
type DraftSortMode = "priority-desc" | "recent-gate" | "name-asc" | "gate-state";
type DraftProofFilter = "all" | DraftProofZoneId;
type DraftProofZoneId =
  | "source"
  | "sku"
  | "price"
  | "stock"
  | "delivery"
  | "image"
  | "rights"
  | "humanGate";

type DraftMissingProof = {
  id: DraftProofZoneId;
  label: string;
  detail: string;
};

type DraftProofCategoryQueueEntry = {
  id: string;
  proofZoneId: DraftProofZoneId;
  proofLabel: string;
  categoryId: string;
  categoryLabel: string;
  count: number;
  readyAfterZoneCount: number;
  linkedBlockerCount: number;
  topProductId?: string;
  topProductName?: string;
  topProductSlug?: string;
  topPriorityScore: number;
  maturity: {
    label: string;
    percent: number;
    averageLinkedBlockers: number;
    className: string;
  };
};

type DraftActiveProofCategoryExecutionStep = {
  id: string;
  label: string;
  detail: string;
  statusLabel: string;
  tone: "todo" | "ready" | "hold";
};

type DraftMoussDecisionStatus = "hold" | "review" | "ready";
type DraftMoussFinalPaperDecisionStatus = "none" | "hold" | "authorize";
type DraftMoussFinalChecklistId =
  | "image"
  | "source"
  | "price"
  | "stockDelivery"
  | "rights"
  | "mouss";
type DraftMoussFinalChecklistItem = {
  id: DraftMoussFinalChecklistId;
  label: string;
  detail: string;
};
type DraftMoussFinalLotRow = {
  id: string;
  proofLabel: string;
  categoryLabel: string;
  readyCount: number;
  completeCount: number;
  checkedCount: number;
  totalCount: number;
  pendingCount: number;
  topProductName: string;
  topProductSlug: string;
};
type DraftMoussFinalLotWorkOrderRow = {
  productName: string;
  productSlug: string;
  checkedCount: number;
  missingCount: number;
  missingItems: DraftMoussFinalChecklistItem[];
};
type DraftMoussHumanReviewReadyRow = {
  productName: string;
  productSlug: string;
  proofLabel: string;
  categoryLabel: string;
  lotLabel: string;
  checkedCount: number;
};
type DraftMoussFinalPaperDecisionRow = DraftMoussHumanReviewReadyRow & {
  decision: DraftMoussFinalPaperDecisionStatus;
  decisionLabel: string;
};

const draftMoussDecisionLabels: Record<DraftMoussDecisionStatus, string> = {
  hold: "Maintenir HOLD",
  ready: "Dossier pret Mouss",
  review: "A revoir Mouss",
};
const draftMoussFinalPaperDecisionLabels: Record<
  DraftMoussFinalPaperDecisionStatus,
  string
> = {
  authorize: "Papier: autoriser sortie HOLD",
  hold: "Papier: confirmer HOLD",
  none: "Aucune decision papier",
};

const draftMoussFinalChecklistItems: DraftMoussFinalChecklistItem[] = [
  {
    id: "image",
    label: "Image exacte",
    detail: "Visuel exact verifie, pas de photo approximative.",
  },
  {
    id: "source",
    label: "Source partenaire",
    detail: "Article, variante et reference controles cote admin.",
  },
  {
    id: "price",
    label: "Prix et marge",
    detail: "Prix cible, cout reel et marge nette relus.",
  },
  {
    id: "stockDelivery",
    label: "Stock et delai",
    detail: "Stock, delai France/Europe et suivi colis confirmes.",
  },
  {
    id: "rights",
    label: "Droits image",
    detail: "Droit d'utilisation de l'image pret a justifier.",
  },
  {
    id: "mouss",
    label: "Validation Mouss",
    detail: "Validation humaine explicite avant toute sortie de HOLD.",
  },
];

const draftProofZoneLabels: Record<DraftProofZoneId, string> = {
  source: "Source",
  sku: "SKU",
  price: "Prix",
  stock: "Stock",
  delivery: "Delai",
  image: "Image exacte",
  rights: "Droits image",
  humanGate: "Validation Mouss",
};
const draftProofZoneIds = Object.keys(
  draftProofZoneLabels,
) as DraftProofZoneId[];

export function DropshippingAdminPanel({
  initialOrders,
  initialDraftProducts = [],
  connectorStatus,
  dropshippingCategories,
  prefill,
}: DropshippingAdminPanelProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [message, setMessage] = useState(
    prefill?.title
      ? "Candidat charge depuis la selection. Verification humaine obligatoire."
      : "Mode semi-automatique actif.",
  );
  const [isImporting, setIsImporting] = useState(false);
  const [pricing, setPricing] = useState({
    supplierPrice: "",
    marginPercent: "35",
    fixedMargin: "3.00",
    roundingMode: "x90" as DropshippingRoundingMode,
    salePrice: "",
  });

  const calculatedPrice = useMemo(() => {
    return calculateDropshippingSalePrice({
      supplierPriceCents: parseMoneyToCents(pricing.supplierPrice),
      marginPercent: Number.parseFloat(pricing.marginPercent) || 0,
      fixedMarginCents: parseMoneyToCents(pricing.fixedMargin),
      roundingMode: pricing.roundingMode,
    });
  }, [pricing]);
  const orderOperationsSummary = useMemo(
    () => getDropshippingOrderOperationsSummary(orders),
    [orders],
  );

  async function updateOrder(
    orderId: string,
    patch: {
      status?: DropshippingOrderStatus;
      trackingNumber?: string;
      supplierOrderReference?: string;
      prepareFollowUp?: boolean;
    },
  ) {
    setMessage("Mise a jour commande...");

    const response = await fetch(`/api/admin/dropshipping/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = (await response.json()) as {
      order?: DropshippingOrder;
      error?: string;
    };

    if (!response.ok || !data.order) {
      setMessage(data.error ?? "Mise a jour impossible.");
      return;
    }

    setOrders((current) =>
      current.map((order) => (order.id === data.order?.id ? data.order : order)),
    );
    setMessage(`Commande ${data.order.orderNumber} mise a jour.`);
  }

  async function importProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsImporting(true);
    setMessage("Import produit partenaire en cours...");

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);

      formData.set("supplierPrice", pricing.supplierPrice);
      formData.set("marginPercent", pricing.marginPercent);
      formData.set("fixedMargin", pricing.fixedMargin);
      formData.set("roundingMode", pricing.roundingMode);
      formData.set("salePrice", pricing.salePrice);

      const response = await fetch("/api/admin/dropshipping/import", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        product?: Product;
        products?: Product[];
        error?: string;
      };

      if (!response.ok || !data.product) {
        throw new Error(data.error ?? "Import impossible.");
      }

      window.dispatchEvent(
        new CustomEvent(QUICK_PRODUCTS_UPDATED_EVENT, {
          detail: { products: data.products ?? [data.product] },
        }),
      );
      form.reset();
      setPricing({
        supplierPrice: "",
        marginPercent: "35",
        fixedMargin: "3.00",
        roundingMode: "x90",
        salePrice: "",
      });
      setMessage(`Produit importe : ${data.product.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import impossible.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="container-page grid min-w-0 gap-8 py-10">
      <section className="grid min-w-0 gap-4 rounded-lg border border-line bg-paper p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-black uppercase text-teal">
              Commandes à traiter
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Produits partenaires - Commandes à traiter
            </h2>
          </div>
          <div className="rounded-md bg-[#f6f1e8] px-3 py-2 text-sm font-bold text-muted">
            {message}
          </div>
        </div>

        <OrderOperationsSummaryPanel summary={orderOperationsSummary} />

        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line p-8 text-center">
            <ClipboardList
              className="mx-auto mb-3 text-teal"
              size={34}
              aria-hidden="true"
            />
            <h3 className="text-xl font-black">Aucune commande partenaire</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
              Les commandes partenaires apparaitront ici apres creation d&apos;une
              session Stripe contenant un produit partenaire.
            </p>
            <div className="mx-auto mt-5 grid max-w-3xl gap-2 sm:grid-cols-4">
              {[
                "Préparer commande fournisseur",
                "Marquer comme commandé",
                "Ajouter numéro de suivi",
                "Envoyer suivi au client",
              ].map((label) => (
                <button
                  key={label}
                  type="button"
                  disabled
                  className="inline-flex min-h-10 cursor-not-allowed items-center justify-center rounded-md border border-line px-3 text-xs font-black text-muted"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-5">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} onUpdate={updateOrder} />
            ))}
          </div>
        )}
      </section>

      <DraftProductsTable
        products={initialDraftProducts}
        categories={dropshippingCategories}
      />

      <section className="grid min-w-0 gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <form
          onSubmit={importProduct}
          className="grid min-w-0 gap-4 rounded-lg border border-line bg-paper p-5 shadow-sm"
        >
          <div>
            <p className="text-sm font-black uppercase text-teal">
              Import fournisseur
            </p>
            <h2 className="mt-2 text-2xl font-black">
              Créer un produit partenaire
            </h2>
          </div>

          <input
            type="hidden"
            name="candidateId"
            value={prefill?.candidateId ?? ""}
          />
          <input
            type="hidden"
            name="candidateCategory"
            value={prefill?.candidateCategory ?? ""}
          />
          <input
            type="hidden"
            name="validationSource"
            value={prefill?.sourceMode ? `selection:${prefill.sourceMode}` : "admin-manual"}
          />
          <input
            type="hidden"
            name="sourceGeneratedAt"
            value={prefill?.sourceGeneratedAt ?? ""}
          />

          {prefill?.candidateId ? (
            <div className="rounded-md border border-[#bfe7df] bg-[#eef8f6] p-4 text-sm">
              <div className="flex items-start gap-2">
                <ShieldCheck
                  className="mt-0.5 shrink-0 text-teal"
                  size={18}
                  aria-hidden="true"
                />
                <div>
                  <div className="font-black">Candidat source tracé</div>
                  <p className="mt-1 leading-6 text-muted">
                    ID {prefill.candidateId}
                    {prefill.candidateCategory
                      ? ` - rayon ${prefill.candidateCategory}`
                      : ""}{" "}
                    : l&apos;import reste en brouillon tant que Mouss ne valide
                    pas la publication.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="supplierUrl"
              label="Lien fournisseur"
              defaultValue={prefill?.supplierUrl}
              required
            />
            <Field name="supplierSku" label="SKU fournisseur" />
            <Field
              name="title"
              label="Titre produit"
              defaultValue={prefill?.title}
              required
            />
            <label className="grid gap-2 text-sm font-bold">
              Catégorie
              <select
                name="categoryId"
                className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
                defaultValue={prefill?.categoryId ?? "dropshipping-nouveautes"}
              >
                {dropshippingCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-2 text-sm font-bold">
            Description client
            <textarea
              name="description"
              rows={5}
              className="focus-ring rounded-md border border-line px-3 py-3 text-base"
              placeholder="Texte visible par le client, sans mention de plateforme fournisseur."
              defaultValue={prefill?.description}
            />
          </label>

          <label className="grid gap-2 text-sm font-bold">
            Images
            <textarea
              name="images"
              rows={3}
              className="focus-ring rounded-md border border-line px-3 py-3 text-base"
              placeholder="Une URL image par ligne, ou laissez vide puis ajoutez les photos plus tard."
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-4">
            <PricingField
              label="Prix fournisseur"
              value={pricing.supplierPrice}
              onChange={(supplierPrice) =>
                setPricing((current) => ({ ...current, supplierPrice }))
              }
            />
            <PricingField
              label="Marge %"
              value={pricing.marginPercent}
              onChange={(marginPercent) =>
                setPricing((current) => ({ ...current, marginPercent }))
              }
            />
            <PricingField
              label="Marge fixe"
              value={pricing.fixedMargin}
              onChange={(fixedMargin) =>
                setPricing((current) => ({ ...current, fixedMargin }))
              }
            />
            <label className="grid gap-2 text-sm font-bold">
              Arrondi
              <select
                value={pricing.roundingMode}
                onChange={(event) =>
                  setPricing((current) => ({
                    ...current,
                    roundingMode: event.target.value as DropshippingRoundingMode,
                  }))
                }
                className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
              >
                <option value="x90">x,90 €</option>
                <option value="x99">x,99 €</option>
                <option value="none">Sans arrondi</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <PricingField
              label="Prix vente manuel"
              value={pricing.salePrice}
              onChange={(salePrice) =>
                setPricing((current) => ({ ...current, salePrice }))
              }
            />
            <Field name="compareAtPrice" label="Prix barré" />
            <Field name="supplierStock" label="Stock fournisseur" type="number" />
            <Field
              name="deliveryEstimate"
              label="Délai livraison"
              placeholder="8 a 15 jours ouvres"
              defaultValue={prefill?.deliveryEstimate}
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <CheckBox name="isNew" label="Produit nouveauté" defaultChecked />
            <CheckBox name="isPromotion" label="Produit promotion" />
          </div>

          <div className="rounded-md border border-line bg-[#fbfaf7] p-4 text-sm">
            <div className="font-black">Prix calculé</div>
            <div className="mt-1 text-2xl font-black text-teal">
              {formatPrice(calculatedPrice.salePriceCents)}
            </div>
            <div className="mt-1 font-bold text-muted">
              Marge estimée : {formatPrice(calculatedPrice.marginCents)}
            </div>
          </div>

          <div className="grid gap-3 rounded-md border border-line bg-[#fbfaf7] p-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-black">
                <ShieldCheck size={17} aria-hidden="true" />
                Gate validation humaine
              </div>
              <p className="mt-1 text-sm leading-6 text-muted">
                Obligatoire avant de créer le brouillon. Cette étape ne publie
                rien et ne passe aucune commande fournisseur.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <CheckBox
                name="validationSupplierLinkChecked"
                label="Lien fournisseur vérifié"
                required
              />
              <CheckBox
                name="validationPriceMarginChecked"
                label="Prix et marge vérifiés"
                required
              />
              <CheckBox
                name="validationDeliveryStockChecked"
                label="Stock et délai à confirmer"
                required
              />
              <CheckBox
                name="validationNoAutoPurchaseConfirmed"
                label="Aucun achat automatique"
                required
              />
            </div>
            <label className="grid gap-2 text-sm font-bold">
              Note interne validation
              <textarea
                name="validationNote"
                rows={3}
                className="focus-ring rounded-md border border-line px-3 py-3 text-base"
                placeholder="Ex: fournisseur à comparer, variantes à vérifier, visuels à remplacer."
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isImporting}
            className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-black text-white hover:bg-[#2b2b2b] disabled:cursor-not-allowed disabled:opacity-65"
          >
            {isImporting ? <Loader2 className="animate-spin" size={18} /> : <PackageCheck size={18} />}
            Importer sans achat fournisseur
          </button>
        </form>

        <aside className="h-fit rounded-lg border border-line bg-paper p-5 shadow-sm">
          <p className="text-sm font-black uppercase text-teal">Connecteurs</p>
          <h2 className="mt-2 text-2xl font-black">Prêts à configurer</h2>
          <div className="mt-5 grid gap-3">
            {connectorStatus.map((connector) => (
              <div
                key={connector.name}
                className="rounded-md border border-line bg-[#fbfaf7] p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-black">{connector.name}</span>
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-black ${
                      connector.ready
                        ? "bg-[#eef8f6] text-teal"
                        : "bg-[#fff7ed] text-[#9a3412]"
                    }`}
                  >
                    {connector.ready ? "Renseigné" : "À remplir"}
                  </span>
                </div>
                <p className="mt-2 leading-6 text-muted">{connector.detail}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}

function getDraftValidationState(product: Product) {
  const gate = product.dropshipping?.validationGate;
  const checks = gate?.checks ?? [];

  if (!gate) {
    return {
      label: "Gate absent",
      className: "bg-[#fff7ed] text-[#9a3412] ring-[#fed7aa]",
      detail: "Validation humaine a reprendre avant publication.",
    };
  }

  if (checks.length >= 4) {
    return {
      label: "Gate complet",
      className: "bg-[#eef8f6] text-teal ring-[#bfe7df]",
      detail: `${checks.length} controles traces.`,
    };
  }

  return {
    label: "Gate incomplet",
    className: "bg-[#fff7ed] text-[#9a3412] ring-[#fed7aa]",
    detail: `${checks.length} controle(s) traces, verification a reprendre.`,
  };
}

function getDraftGateFilter(product: Product): Exclude<DraftGateFilter, "all"> {
  const gate = product.dropshipping?.validationGate;

  if (!gate) {
    return "missing";
  }

  if ((gate.checks ?? []).length >= 4) {
    return "complete";
  }

  return "incomplete";
}

function hasReadySignal(value?: string) {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (!normalized) {
    return false;
  }

  if (
    ["hold", "a verifier", "a confirmer", "manquant", "missing", "blocked"].some(
      (signal) => normalized.includes(signal),
    )
  ) {
    return false;
  }

  return ["ok", "ready", "valide", "validated", "verified", "exact"].some(
    (signal) => normalized.includes(signal),
  );
}

function getDraftMissingProofs(product: Product): DraftMissingProof[] {
  const dropshipping = product.dropshipping;
  const gate = dropshipping?.validationGate;
  const missing: DraftMissingProof[] = [];

  if (!dropshipping?.supplierUrl) {
    missing.push({
      id: "source",
      label: draftProofZoneLabels.source,
      detail: "Lien source exact absent.",
    });
  }

  if (!dropshipping?.supplierSku) {
    missing.push({
      id: "sku",
      label: draftProofZoneLabels.sku,
      detail: "SKU ou variante exacte non renseigne.",
    });
  }

  if (!dropshipping?.supplierPriceCents) {
    missing.push({
      id: "price",
      label: draftProofZoneLabels.price,
      detail: "Prix d'achat reel non confirme.",
    });
  }

  if (typeof dropshipping?.supplierStock !== "number" || dropshipping.supplierStock <= 0) {
    missing.push({
      id: "stock",
      label: draftProofZoneLabels.stock,
      detail: "Stock partenaire non prouve.",
    });
  }

  if (
    !dropshipping?.deliveryEstimate ||
    /a verifier|a confirmer|hold|manquant|missing/i.test(dropshipping.deliveryEstimate)
  ) {
    missing.push({
      id: "delivery",
      label: draftProofZoneLabels.delivery,
      detail: "Delai France/Europe non confirme.",
    });
  }

  if (!hasReadySignal(product.imageValidation?.status)) {
    missing.push({
      id: "image",
      label: draftProofZoneLabels.image,
      detail: "Photo exacte non validee.",
    });
  }

  if (!hasReadySignal(product.sourceVerification?.rightsStatus)) {
    missing.push({
      id: "rights",
      label: draftProofZoneLabels.rights,
      detail: "Droits image non valides.",
    });
  }

  if (!gate || (gate.checks ?? []).length < 4) {
    missing.push({
      id: "humanGate",
      label: draftProofZoneLabels.humanGate,
      detail: "Gate humain incomplet.",
    });
  }

  return missing;
}

function getDraftProofDashboardSummary(products: Product[]) {
  const entries = Object.keys(draftProofZoneLabels).map((zoneId) => ({
    id: zoneId as DraftProofZoneId,
    label: draftProofZoneLabels[zoneId as DraftProofZoneId],
    count: 0,
  }));

  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  products.forEach((product) => {
    getDraftMissingProofs(product).forEach((proof) => {
      const entry = byId.get(proof.id);
      if (entry) {
        entry.count += 1;
      }
    });
  });

  const totalMissing = entries.reduce((total, entry) => total + entry.count, 0);
  const topZone = [...entries]
    .sort((left, right) => right.count - left.count)
    .find((entry) => entry.count > 0);

  return {
    entries,
    totalMissing,
    topZone,
  };
}

function formatDraftDate(value?: string) {
  if (!value) {
    return "Date inconnue";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date inconnue";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getDraftTimestamp(product: Product) {
  const value =
    product.dropshipping?.validationGate?.checkedAt ??
    product.dropshipping?.lastSyncAt;

  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();

  return Number.isNaN(time) ? 0 : time;
}

function getDraftDashboardSummary(products: Product[]) {
  return products.reduce(
    (summary, product) => {
      const gate = product.dropshipping?.validationGate;

      if (!gate) {
        summary.gateMissing += 1;
      } else if ((gate.checks ?? []).length >= 4) {
        summary.gateComplete += 1;
      } else {
        summary.gateIncomplete += 1;
      }

      if (product.dropshipping?.supplierUrl) {
        summary.withSupplierLink += 1;
      } else {
        summary.withoutSupplierLink += 1;
      }

      return summary;
    },
    {
      gateComplete: 0,
      gateIncomplete: 0,
      gateMissing: 0,
      withSupplierLink: 0,
      withoutSupplierLink: 0,
    },
  );
}

function getDraftPriority(product: Product) {
  const gate = product.dropshipping?.validationGate;
  const checks = gate?.checks ?? [];
  const missingProofs = getDraftMissingProofs(product);
  let score = 0;
  const reasons: string[] = [];

  if (!gate) {
    score += 40;
    reasons.push("gate absent");
  } else if (checks.length < 4) {
    score += 25;
    reasons.push("gate incomplet");
  }

  if (!product.dropshipping?.supplierUrl) {
    score += 20;
    reasons.push("lien fournisseur absent");
  }

  if (!product.dropshipping?.supplierPriceCents) {
    score += 10;
    reasons.push("prix fournisseur a verifier");
  }

  if (!product.dropshipping?.deliveryEstimate) {
    score += 10;
    reasons.push("delai livraison absent");
  }

  const proofWeights: Record<DraftProofZoneId, number> = {
    source: 0,
    sku: 8,
    price: 0,
    stock: 8,
    delivery: 0,
    image: 18,
    rights: 12,
    humanGate: 0,
  };

  missingProofs.forEach((proof) => {
    score += proofWeights[proof.id];
  });

  const extraProofReasons = missingProofs
    .filter((proof) => !["source", "price", "delivery", "humanGate"].includes(proof.id))
    .map((proof) => proof.label.toLowerCase());

  if (extraProofReasons.length > 0) {
    reasons.push(`preuves: ${extraProofReasons.join(", ")}`);
  }

  return {
    score,
    label: reasons.length ? reasons.join(", ") : "pret pour revue finale",
  };
}

function buildDraftReviewText(products: Product[]) {
  if (products.length === 0) {
    return "Aucun brouillon partenaire visible avec les filtres actifs.";
  }

  return products
    .map((product, index) => {
      const validation = getDraftValidationState(product);
      const priority = getDraftPriority(product);
      const gate = product.dropshipping?.validationGate;
      const missingProofs = getDraftMissingProofs(product);
      const remainingActions = getDraftReviewChecklist(product)
        .filter((item) => !item.done)
        .map((item) => item.label);

      return [
        `${index + 1}. ${product.name}`,
        `Slug: ${product.slug}`,
        `Statut: ${product.status ?? "draft"}`,
        `Validation: ${validation.label} - ${validation.detail}`,
        `Priorite: ${priority.score} - ${priority.label}`,
        `Source: ${gate?.source ?? "source non tracee"}`,
        `Candidat: ${gate?.candidateId ?? "non renseigne"}`,
        `Dernier gate: ${formatDraftDate(gate?.checkedAt ?? product.dropshipping?.lastSyncAt)}`,
        `Lien fournisseur: ${product.dropshipping?.supplierUrl ? "present" : "absent"}`,
        `Preuves manquantes: ${
          missingProofs.length
            ? missingProofs.map((proof) => proof.label).join(", ")
            : "aucune preuve bloquante"
        }`,
        `Actions restantes: ${
          remainingActions.length ? remainingActions.join(", ") : "revue finale possible"
        }`,
      ].join("\n");
    })
    .join("\n\n");
}

function buildDraftProofBatchText(
  products: Product[],
  proofZoneId?: DraftProofZoneId,
) {
  if (!proofZoneId) {
    return "Aucune zone de preuve bloquante dans la selection visible.";
  }

  const proofLabel = draftProofZoneLabels[proofZoneId];
  const batchProducts = getDraftProofBatchProducts(products, proofZoneId);

  if (batchProducts.length === 0) {
    return `Aucun brouillon visible ne bloque sur la preuve ${proofLabel}.`;
  }

  return [
    `Lot preuve: ${proofLabel}`,
    `Brouillons concernes: ${batchProducts.length}`,
    "Action: completer cette preuve, puis garder le brouillon en validation tant que toutes les preuves ne sont pas confirmees.",
    "",
    ...batchProducts.slice(0, 12).map((product, index) => {
      const missingProofs = getDraftMissingProofs(product);
      const activeProof = missingProofs.find((proof) => proof.id === proofZoneId);
      const otherProofs = missingProofs.filter((proof) => proof.id !== proofZoneId);
      const priority = getDraftPriority(product);

      return [
        `${index + 1}. ${product.name}`,
        `Slug: ${product.slug}`,
        `Categorie: ${product.categoryId}`,
        `Priorite: ${priority.score} - ${priority.label}`,
        `Preuve a traiter: ${activeProof?.detail ?? proofLabel}`,
        `Autres blocages: ${
          otherProofs.length
            ? otherProofs.map((proof) => proof.label).join(", ")
            : "aucun autre blocage preuve"
        }`,
        `Source partenaire: ${
          product.dropshipping?.supplierUrl ? "lien trace en admin" : "lien absent"
        }`,
        `Dernier controle: ${formatDraftDate(
          product.dropshipping?.validationGate?.checkedAt ??
            product.dropshipping?.lastSyncAt,
        )}`,
      ].join("\n");
    }),
  ].join("\n");
}

function getDraftProofBatchProducts(
  products: Product[],
  proofZoneId?: DraftProofZoneId,
) {
  if (!proofZoneId) {
    return [];
  }

  return products
    .filter((product) =>
      getDraftMissingProofs(product).some((proof) => proof.id === proofZoneId),
    )
    .sort(
      (left, right) =>
        getDraftPriority(right).score - getDraftPriority(left).score,
    );
}

function getDraftSecondaryProofSummary(
  products: Product[],
  activeProofZone?: DraftProofZoneId,
) {
  const entries = Object.keys(draftProofZoneLabels).map((zoneId) => ({
    id: zoneId as DraftProofZoneId,
    label: draftProofZoneLabels[zoneId as DraftProofZoneId],
    count: 0,
  }));
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  products.forEach((product) => {
    getDraftMissingProofs(product).forEach((proof) => {
      if (proof.id === activeProofZone) {
        return;
      }

      const entry = byId.get(proof.id);
      if (entry) {
        entry.count += 1;
      }
    });
  });

  return entries
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.count - left.count);
}

function getDraftCategoryMaturity(
  count: number,
  readyAfterZoneCount: number,
  linkedBlockerCount: number,
) {
  const maturityPercent =
    count > 0 ? Math.round((readyAfterZoneCount / count) * 100) : 0;
  const averageLinkedBlockers =
    count > 0 ? Math.round((linkedBlockerCount / count) * 10) / 10 : 0;

  if (count > 0 && readyAfterZoneCount === count) {
    return {
      label: "1 preuve restante",
      detail: "Tout le rayon peut passer en revue finale apres cette preuve.",
      percent: maturityPercent,
      averageLinkedBlockers,
      className: "bg-[#eef8f6] text-teal ring-[#bfe7df]",
    };
  }

  if (readyAfterZoneCount > 0) {
    return {
      label: "Mixte",
      detail: "Une partie du rayon sera debloquee apres cette preuve.",
      percent: maturityPercent,
      averageLinkedBlockers,
      className: "bg-[#f6f1e8] text-muted ring-line",
    };
  }

  if (averageLinkedBlockers <= 2) {
    return {
      label: "A cadrer",
      detail: "Rayon proche, mais plusieurs preuves restent a completer.",
      percent: maturityPercent,
      averageLinkedBlockers,
      className: "bg-[#fff7ed] text-[#9a3412] ring-[#fed7aa]",
    };
  }

  return {
    label: "Lourd",
    detail: "Rayon a traiter apres les lots plus rapides.",
    percent: maturityPercent,
    averageLinkedBlockers,
    className: "bg-[#fef2f2] text-[#991b1b] ring-[#fecaca]",
  };
}

function getDraftProofOpportunitySummary(products: Product[]) {
  const entries = draftProofZoneIds.map((zoneId) => ({
    id: zoneId,
    label: draftProofZoneLabels[zoneId],
    count: 0,
    readyAfterProofCount: 0,
    linkedBlockerCount: 0,
    topProduct: undefined as Product | undefined,
    topPriorityScore: -1,
  }));
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  products.forEach((product) => {
    const missingProofs = getDraftMissingProofs(product);

    missingProofs.forEach((proof) => {
      const entry = byId.get(proof.id);

      if (!entry) {
        return;
      }

      const otherProofCount = missingProofs.filter(
        (item) => item.id !== proof.id,
      ).length;
      const priority = getDraftPriority(product);

      entry.count += 1;
      entry.linkedBlockerCount += otherProofCount;

      if (otherProofCount === 0) {
        entry.readyAfterProofCount += 1;
      }

      if (priority.score > entry.topPriorityScore) {
        entry.topProduct = product;
        entry.topPriorityScore = priority.score;
      }
    });
  });

  return entries
    .filter((entry) => entry.count > 0)
    .map((entry) => ({
      ...entry,
      maturity: getDraftCategoryMaturity(
        entry.count,
        entry.readyAfterProofCount,
        entry.linkedBlockerCount,
      ),
    }))
    .sort(
      (left, right) =>
        right.maturity.percent - left.maturity.percent ||
        left.maturity.averageLinkedBlockers -
          right.maturity.averageLinkedBlockers ||
        right.readyAfterProofCount - left.readyAfterProofCount ||
        right.count - left.count ||
        right.topPriorityScore - left.topPriorityScore ||
        left.label.localeCompare(right.label, "fr"),
    );
}

function buildDraftProofOpportunityText(
  products: Product[],
  proofZoneId?: DraftProofZoneId,
) {
  const opportunity = getDraftProofOpportunitySummary(products).find(
    (entry) => entry.id === proofZoneId,
  );

  if (!proofZoneId || !opportunity) {
    return "Aucune preuve recommandee dans la selection visible.";
  }

  const batchProducts = getDraftProofBatchProducts(products, proofZoneId);

  return [
    `Preuve recommandee: ${opportunity.label}`,
    `Brouillons concernes: ${opportunity.count}`,
    `Prets apres preuve: ${opportunity.readyAfterProofCount}`,
    `Maturite: ${opportunity.maturity.label} (${opportunity.maturity.percent}% prets, ${opportunity.maturity.averageLinkedBlockers} blocage(s) lie(s) moyen(s))`,
    `Blocages lies restants: ${opportunity.linkedBlockerCount}`,
    "Action: traiter cette preuve en premier sur les brouillons listes, puis conserver chaque fiche en HOLD tant que toutes les preuves et la validation Mouss ne sont pas confirmees.",
    "",
    ...batchProducts.slice(0, 12).map((product, index) => {
      const missingProofs = getDraftMissingProofs(product);
      const activeProof = missingProofs.find((proof) => proof.id === proofZoneId);
      const otherProofs = missingProofs.filter((proof) => proof.id !== proofZoneId);
      const priority = getDraftPriority(product);

      return [
        `${index + 1}. ${product.name}`,
        `Slug: ${product.slug}`,
        `Categorie: ${product.categoryId}`,
        `Priorite: ${priority.score} - ${priority.label}`,
        `Preuve a traiter: ${activeProof?.detail ?? opportunity.label}`,
        `Apres cette preuve: ${
          otherProofs.length
            ? otherProofs.map((proof) => proof.label).join(", ")
            : "revue finale possible"
        }`,
        `Reprise admin: /admin/produits/${product.slug}/modifier`,
      ].join("\n");
    }),
  ].join("\n");
}

function getDraftProofBatchCategorySummary(
  products: Product[],
  categoryNameById: Map<string, string>,
  activeProofZone?: DraftProofZoneId,
) {
  const byCategory = new Map<
    string,
    {
      id: string;
      label: string;
      count: number;
      readyAfterZoneCount: number;
      linkedBlockerCount: number;
      topProduct?: Product;
      topPriorityScore: number;
    }
  >();

  products.forEach((product) => {
    const priority = getDraftPriority(product);
    const missingAfterZone = getDraftMissingProofs(product).filter(
      (proof) => proof.id !== activeProofZone,
    );
    const current = byCategory.get(product.categoryId) ?? {
      id: product.categoryId,
      label: categoryNameById.get(product.categoryId) ?? product.categoryId,
      count: 0,
      readyAfterZoneCount: 0,
      linkedBlockerCount: 0,
      topProduct: undefined,
      topPriorityScore: -1,
    };

    current.count += 1;
    current.linkedBlockerCount += missingAfterZone.length;

    if (missingAfterZone.length === 0) {
      current.readyAfterZoneCount += 1;
    }

    if (priority.score > current.topPriorityScore) {
      current.topProduct = product;
      current.topPriorityScore = priority.score;
    }

    byCategory.set(product.categoryId, current);
  });

  return [...byCategory.values()]
    .map((entry) => ({
      ...entry,
      maturity: getDraftCategoryMaturity(
        entry.count,
        entry.readyAfterZoneCount,
        entry.linkedBlockerCount,
      ),
    }))
    .sort(
      (left, right) =>
        right.maturity.percent - left.maturity.percent ||
        left.maturity.averageLinkedBlockers -
          right.maturity.averageLinkedBlockers ||
        right.readyAfterZoneCount - left.readyAfterZoneCount ||
        right.count - left.count ||
        right.topPriorityScore - left.topPriorityScore ||
        left.label.localeCompare(right.label, "fr"),
    );
}

function getDraftProofCategoryOpportunitySummary(
  products: Product[],
  categoryNameById: Map<string, string>,
) {
  return draftProofZoneIds
    .flatMap((proofZoneId) => {
      const batchProducts = getDraftProofBatchProducts(products, proofZoneId);

      return getDraftProofBatchCategorySummary(
        batchProducts,
        categoryNameById,
        proofZoneId,
      ).map((entry) => ({
        id: `${proofZoneId}:${entry.id}`,
        proofZoneId,
        proofLabel: draftProofZoneLabels[proofZoneId],
        categoryId: entry.id,
        categoryLabel: entry.label,
        count: entry.count,
        readyAfterZoneCount: entry.readyAfterZoneCount,
        linkedBlockerCount: entry.linkedBlockerCount,
        topProduct: entry.topProduct,
        topPriorityScore: entry.topPriorityScore,
        maturity: entry.maturity,
      }));
    })
    .sort(
      (left, right) =>
        right.maturity.percent - left.maturity.percent ||
        left.maturity.averageLinkedBlockers -
          right.maturity.averageLinkedBlockers ||
        right.readyAfterZoneCount - left.readyAfterZoneCount ||
        right.count - left.count ||
        right.topPriorityScore - left.topPriorityScore ||
        left.proofLabel.localeCompare(right.proofLabel, "fr") ||
        left.categoryLabel.localeCompare(right.categoryLabel, "fr"),
    );
}

function getDraftProofCategoryQueueSnapshot(
  opportunities: ReturnType<typeof getDraftProofCategoryOpportunitySummary>,
) {
  return opportunities.slice(0, 3).map(
    (entry): DraftProofCategoryQueueEntry => ({
      id: entry.id,
      proofZoneId: entry.proofZoneId,
      proofLabel: entry.proofLabel,
      categoryId: entry.categoryId,
      categoryLabel: entry.categoryLabel,
      count: entry.count,
      readyAfterZoneCount: entry.readyAfterZoneCount,
      linkedBlockerCount: entry.linkedBlockerCount,
      topProductId: entry.topProduct?.id,
      topProductName: entry.topProduct?.name,
      topProductSlug: entry.topProduct?.slug,
      topPriorityScore: entry.topPriorityScore,
      maturity: entry.maturity,
    }),
  );
}

function buildDraftProofCategoryOpportunityText(
  products: Product[],
  opportunity:
    | ReturnType<typeof getDraftProofCategoryOpportunitySummary>[number]
    | undefined,
  categoryNameById: Map<string, string>,
) {
  if (!opportunity) {
    return "Aucun couple preuve + rayon recommande dans la selection visible.";
  }

  const batchProducts = getDraftProofBatchProducts(
    products,
    opportunity.proofZoneId,
  );
  const categoryBatchText = buildDraftProofCategoryBatchText(
    batchProducts,
    opportunity.categoryId,
    categoryNameById,
    opportunity.proofZoneId,
  );

  return [
    `Couple recommande: ${opportunity.proofLabel} + ${opportunity.categoryLabel}`,
    `Score maturite: ${opportunity.maturity.label} (${opportunity.maturity.percent}% prets apres preuve)`,
    `Brouillons du couple: ${opportunity.count}`,
    "",
    categoryBatchText,
  ].join("\n");
}

function buildDraftProofCategoryOpportunityQueueText(
  queue: DraftProofCategoryQueueEntry[],
) {
  if (queue.length === 0) {
    return "Aucun couple preuve + rayon disponible dans la selection visible.";
  }

  return [
    "File 3 prochains couples",
    `Couples disponibles: ${queue.length}`,
    "Action: traiter ces couples dans l'ordre, sans publier et sans sortir de HOLD avant validation Mouss.",
    "",
    ...queue.map((entry, index) =>
      [
        `${index + 1}. ${entry.proofLabel} + ${entry.categoryLabel}`,
        `Preuve: ${entry.proofLabel}`,
        `Rayon: ${entry.categoryLabel}`,
        `Brouillons: ${entry.count}`,
        `Prets apres preuve: ${entry.readyAfterZoneCount}`,
        `Blocages lies: ${entry.linkedBlockerCount}`,
        `Maturite: ${entry.maturity.label} (${entry.maturity.percent}% prets, ${entry.maturity.averageLinkedBlockers} blocage(s) moyen(s))`,
        `Priorite max: ${Math.max(entry.topPriorityScore, 0)}`,
        `Premier brouillon: ${entry.topProductName ?? "non disponible"}`,
        `Reprise admin: ${
          entry.topProductSlug
            ? `/admin/produits/${entry.topProductSlug}/modifier`
            : "selectionner le couple dans l'admin"
        }`,
      ].join("\n"),
    ),
  ].join("\n\n");
}

function getDraftProofCategoryOpportunityQueueImpact(
  products: Product[],
  queue: DraftProofCategoryQueueEntry[],
) {
  const coveredProducts = new Map<
    string,
    {
      product: Product;
      proofIds: Set<DraftProofZoneId>;
    }
  >();

  queue.forEach((entry) => {
    getDraftProofBatchProducts(products, entry.proofZoneId)
      .filter((product) => product.categoryId === entry.categoryId)
      .forEach((product) => {
        const current = coveredProducts.get(product.id) ?? {
          product,
          proofIds: new Set<DraftProofZoneId>(),
        };

        current.proofIds.add(entry.proofZoneId);
        coveredProducts.set(product.id, current);
      });
  });

  const coveredEntries = [...coveredProducts.values()];
  const readyAfterQueueCount = coveredEntries.filter(({ product, proofIds }) =>
    getDraftMissingProofs(product).every((proof) => proofIds.has(proof.id)),
  ).length;
  const linkedBlockerCount = coveredEntries.reduce(
    (total, { product, proofIds }) =>
      total +
      getDraftMissingProofs(product).filter((proof) => !proofIds.has(proof.id))
        .length,
    0,
  );
  const totalQueuedProducts = queue.reduce(
    (total, entry) => total + entry.count,
    0,
  );
  const topEntry = coveredEntries
    .map(({ product }) => ({
      product,
      priority: getDraftPriority(product),
    }))
    .sort((left, right) => right.priority.score - left.priority.score)[0];

  return {
    queueCount: queue.length,
    uniqueProductCount: coveredEntries.length,
    readyAfterQueueCount,
    linkedBlockerCount,
    overlapCount: Math.max(totalQueuedProducts - coveredEntries.length, 0),
    readinessPercent:
      coveredEntries.length > 0
        ? Math.round((readyAfterQueueCount / coveredEntries.length) * 100)
        : 0,
    proofZoneCount: new Set(queue.map((entry) => entry.proofZoneId)).size,
    categoryCount: new Set(queue.map((entry) => entry.categoryId)).size,
    topProduct: topEntry?.product,
    topPriorityScore: topEntry?.priority.score ?? 0,
  };
}

function buildDraftProofCategoryOpportunityImpactText(
  products: Product[],
  queue: DraftProofCategoryQueueEntry[],
) {
  const impact = getDraftProofCategoryOpportunityQueueImpact(
    products,
    queue,
  );

  if (impact.queueCount === 0) {
    return "Aucun impact file calculable dans la selection visible.";
  }

  return [
    "Impact file 3 couples",
    `Lots dans la file: ${impact.queueCount}`,
    `Brouillons uniques couverts: ${impact.uniqueProductCount}`,
    `Potentiellement prets apres file: ${impact.readyAfterQueueCount}`,
    `Taux pret apres file: ${impact.readinessPercent}%`,
    `Blocages restants apres file: ${impact.linkedBlockerCount}`,
    `Recoupements de lots: ${impact.overlapCount}`,
    `Preuves distinctes: ${impact.proofZoneCount}`,
    `Rayons distincts: ${impact.categoryCount}`,
    `Priorite max couverte: ${impact.topPriorityScore}`,
    `Premier brouillon prioritaire: ${impact.topProduct?.name ?? "non disponible"}`,
    "Action: traiter la file dans l'ordre, puis garder les fiches en HOLD tant que la validation humaine et toutes les preuves ne sont pas confirmees.",
  ].join("\n");
}

function getDraftActiveProofCategoryEntry(
  queue: DraftProofCategoryQueueEntry[],
  activeEntryId: string,
) {
  return queue.find((entry) => entry.id === activeEntryId) ?? queue[0];
}

function getDraftActiveProofCategoryProducts(
  products: Product[],
  activeEntry?: DraftProofCategoryQueueEntry,
) {
  if (!activeEntry) {
    return [];
  }

  return getDraftProofBatchProducts(products, activeEntry.proofZoneId)
    .filter((product) => product.categoryId === activeEntry.categoryId)
    .sort(
      (left, right) =>
        getDraftPriority(right).score - getDraftPriority(left).score,
    );
}

function buildDraftActiveProofCategoryQueueText(
  products: Product[],
  queue: DraftProofCategoryQueueEntry[],
  activeEntryId: string,
) {
  const activeEntry = getDraftActiveProofCategoryEntry(queue, activeEntryId);

  if (!activeEntry) {
    return "Aucune file active preuve/rayon disponible.";
  }

  const followingEntries = queue.filter((entry) => entry.id !== activeEntry.id);
  const impact = getDraftProofCategoryOpportunityQueueImpact(products, queue);
  const activeProducts = getDraftActiveProofCategoryProducts(
    products,
    activeEntry,
  );

  return [
    "File active preuve/rayon",
    `Lot actif: ${activeEntry.proofLabel} + ${activeEntry.categoryLabel}`,
    `Brouillons actifs: ${activeEntry.count}`,
    `Prets apres preuve active: ${activeEntry.readyAfterZoneCount}`,
    `Blocages lies actifs: ${activeEntry.linkedBlockerCount}`,
    `Premier brouillon actif: ${activeEntry.topProductName ?? "non disponible"}`,
    "",
    "Impact restant de la file",
    `Brouillons uniques couverts: ${impact.uniqueProductCount}`,
    `Potentiellement prets apres file: ${impact.readyAfterQueueCount}`,
    `Blocages restants apres file: ${impact.linkedBlockerCount}`,
    `Recoupements de lots: ${impact.overlapCount}`,
    "",
    "Brouillons du lot actif",
    ...activeProducts.slice(0, 8).map((product, index) => {
      const missingProofs = getDraftMissingProofs(product);
      const activeProof = missingProofs.find(
        (proof) => proof.id === activeEntry.proofZoneId,
      );
      const otherProofs = missingProofs.filter(
        (proof) => proof.id !== activeEntry.proofZoneId,
      );
      const priority = getDraftPriority(product);

      return [
        `${index + 1}. ${product.name}`,
        `Slug: ${product.slug}`,
        `Priorite: ${priority.score} - ${priority.label}`,
        `Preuve active: ${activeProof?.detail ?? activeEntry.proofLabel}`,
        `Apres preuve active: ${
          otherProofs.length
            ? otherProofs.map((proof) => proof.label).join(", ")
            : "revue finale possible"
        }`,
        `Reprise admin: /admin/produits/${product.slug}/modifier`,
      ].join("\n");
    }),
    "",
    "Lots suivants",
    ...(followingEntries.length > 0
      ? followingEntries.map((entry, index) =>
          [
            `${index + 1}. ${entry.proofLabel} + ${entry.categoryLabel}`,
            `Brouillons: ${entry.count}`,
            `Prets apres preuve: ${entry.readyAfterZoneCount}`,
            `Blocages lies: ${entry.linkedBlockerCount}`,
            `Premier brouillon: ${entry.topProductName ?? "non disponible"}`,
          ].join("\n"),
        )
      : ["Aucun lot suivant dans la file active."]),
    "",
    "Action: traiter le lot actif, conserver les fiches en HOLD, puis passer au lot suivant uniquement apres verification des preuves et validation Mouss.",
  ].join("\n\n");
}

function buildDraftActiveProofCategorySummaryText(
  queue: DraftProofCategoryQueueEntry[],
  activeEntryId: string,
) {
  const activeEntry = getDraftActiveProofCategoryEntry(queue, activeEntryId);

  if (!activeEntry) {
    return "Aucun resume compact de file active disponible.";
  }

  const activeIndex = Math.max(
    queue.findIndex((entry) => entry.id === activeEntry.id),
    0,
  );
  const nextIndex = queue.length > 1 ? (activeIndex + 1) % queue.length : -1;

  return [
    "Resume compact file active preuve/rayon",
    `Position active: ${activeIndex + 1}/${queue.length}`,
    `Lot actif: ${activeEntry.proofLabel} / ${activeEntry.categoryLabel}`,
    "Garde-fou: tous les lots restent en brouillon/HOLD sans preuves completes ni validation Mouss.",
    "",
    "Lots",
    ...queue.map((entry, index) => {
      const status =
        entry.id === activeEntry.id
          ? "ACTIF"
          : index === nextIndex
            ? "SUIVANT"
            : "ATTENTE";

      return `${index + 1}. [${status}] ${entry.proofLabel} / ${
        entry.categoryLabel
      } | ${entry.readyAfterZoneCount}/${entry.count} pret(s) apres preuve | ${
        entry.linkedBlockerCount
      } blocage(s) | priorite ${entry.topPriorityScore} | premier: ${
        entry.topProductName ?? "non disponible"
      }`;
    }),
    "",
    "Action: traiter ACTIF, verifier preuves exactes, garder HOLD, puis passer au lot SUIVANT.",
  ].join("\n");
}

function escapeDraftCsvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function buildDraftActiveProofCategoryValidationCsv(
  queue: DraftProofCategoryQueueEntry[],
  activeEntryId: string,
) {
  const activeEntry = getDraftActiveProofCategoryEntry(queue, activeEntryId);

  if (!activeEntry) {
    return "position;statut;preuve;rayon;prets_apres_preuve;brouillons;blocages_lies;priorite;premier_brouillon;garde_hold\n";
  }

  const activeIndex = Math.max(
    queue.findIndex((entry) => entry.id === activeEntry.id),
    0,
  );
  const nextIndex = queue.length > 1 ? (activeIndex + 1) % queue.length : -1;
  const header = [
    "position",
    "statut",
    "preuve",
    "rayon",
    "prets_apres_preuve",
    "brouillons",
    "blocages_lies",
    "priorite",
    "premier_brouillon",
    "garde_hold",
  ];
  const rows = queue.map((entry, index) => {
    const status =
      entry.id === activeEntry.id
        ? "ACTIF"
        : index === nextIndex
          ? "SUIVANT"
          : "ATTENTE";

    return [
      `${index + 1}/${queue.length}`,
      status,
      entry.proofLabel,
      entry.categoryLabel,
      entry.readyAfterZoneCount,
      entry.count,
      entry.linkedBlockerCount,
      entry.topPriorityScore,
      entry.topProductName ?? "non disponible",
      "HOLD jusqu'aux preuves completes et validation Mouss",
    ];
  });

  return [header, ...rows]
    .map((row) => row.map(escapeDraftCsvCell).join(";"))
    .join("\n");
}

function buildDraftActiveProofCategoryHistoryText(
  activeEntry: DraftProofCategoryQueueEntry | undefined,
  handledHistory: Array<{ name: string; slug: string }>,
) {
  if (!activeEntry) {
    return "Aucun historique local de lot actif disponible.";
  }

  return [
    "Historique local lot actif",
    `Lot: ${activeEntry.proofLabel} / ${activeEntry.categoryLabel}`,
    `Brouillons du lot: ${activeEntry.count}`,
    "Garde-fou: historique session uniquement, aucune persistance catalogue, aucun retrait du HOLD.",
    "",
    "Produits marques",
    ...(handledHistory.length > 0
      ? handledHistory.map((product, index) =>
          [
            `${index + 1}. ${product.name}`,
            `Slug: ${product.slug}`,
            "Statut: traite localement en session admin",
          ].join("\n"),
        )
      : ["Aucun produit marque localement pour ce lot."]),
    "",
    "Action: reprendre les preuves exactes, conserver HOLD, puis valider humainement avec Mouss avant toute publication.",
  ].join("\n");
}

function getDraftActiveProofCategoryExecutionSteps(
  products: Product[],
  queue: DraftProofCategoryQueueEntry[],
  activeEntryId: string,
): DraftActiveProofCategoryExecutionStep[] {
  const activeEntry = getDraftActiveProofCategoryEntry(queue, activeEntryId);

  if (!activeEntry) {
    return [];
  }

  const activeProducts = getDraftActiveProofCategoryProducts(
    products,
    activeEntry,
  );
  const activeProductCount = activeProducts.length;
  const topProduct = activeProducts[0];
  const activeProofMissingCount = activeProducts.filter((product) =>
    getDraftMissingProofs(product).some(
      (proof) => proof.id === activeEntry.proofZoneId,
    ),
  ).length;
  const readyAfterProofCount = activeProducts.filter((product) =>
    getDraftMissingProofs(product).every(
      (proof) => proof.id === activeEntry.proofZoneId,
    ),
  ).length;
  const remainingBlockerCount = activeProducts.reduce(
    (total, product) =>
      total +
      getDraftMissingProofs(product).filter(
        (proof) => proof.id !== activeEntry.proofZoneId,
      ).length,
    0,
  );
  const nextEntry = queue.find((entry) => entry.id !== activeEntry.id);

  return [
    {
      id: `${activeEntry.id}-active-proof`,
      label: `Obtenir ${activeEntry.proofLabel}`,
      detail: `${activeProofMissingCount}/${activeProductCount} brouillon(s) ${activeEntry.categoryLabel} attendent cette preuve exacte avant toute vente.`,
      statusLabel: activeProofMissingCount > 0 ? "A faire" : "OK",
      tone: activeProofMissingCount > 0 ? "todo" : "ready",
    },
    {
      id: `${activeEntry.id}-top-draft`,
      label: "Reprendre le premier brouillon",
      detail: topProduct
        ? `${topProduct.name} - /admin/produits/${topProduct.slug}/modifier`
        : "Aucun brouillon actif dans ce lot.",
      statusLabel: topProduct ? "Pret admin" : "Vide",
      tone: topProduct ? "todo" : "ready",
    },
    {
      id: `${activeEntry.id}-remaining-blockers`,
      label: "Controler les blocages restants",
      detail: `${readyAfterProofCount} fiche(s) pourraient passer en revue finale apres cette preuve; ${remainingBlockerCount} blocage(s) resteront a traiter.`,
      statusLabel: remainingBlockerCount > 0 ? "A suivre" : "Revue possible",
      tone: remainingBlockerCount > 0 ? "hold" : "ready",
    },
    {
      id: `${activeEntry.id}-hold-guard`,
      label: "Garder HOLD + validation Mouss",
      detail:
        "Ne pas publier, ne pas commander et ne pas rendre achetable sans preuves completes et validation humaine Mouss.",
      statusLabel: "Bloque vente",
      tone: "hold",
    },
    {
      id: `${activeEntry.id}-next-lot`,
      label: "Preparer le lot suivant",
      detail: nextEntry
        ? `${nextEntry.proofLabel} / ${nextEntry.categoryLabel} - ${nextEntry.count} brouillon(s), ${nextEntry.readyAfterZoneCount} pret(s) apres preuve.`
        : "Aucun lot suivant dans la file active.",
      statusLabel: nextEntry ? "Ensuite" : "Fin file",
      tone: nextEntry ? "todo" : "ready",
    },
  ];
}

function buildDraftActiveProofCategoryExecutionText(
  steps: DraftActiveProofCategoryExecutionStep[],
  checkedStepIds: string[],
) {
  if (steps.length === 0) {
    return "Aucune execution locale disponible pour la file active.";
  }

  const checked = new Set(checkedStepIds);

  return [
    "Execution locale lot actif",
    `Cases cochees localement: ${
      steps.filter((step) => checked.has(step.id)).length
    }/${steps.length}`,
    "",
    ...steps.map((step, index) =>
      [
        `${checked.has(step.id) ? "[x]" : "[ ]"} ${index + 1}. ${step.label}`,
        `Statut: ${step.statusLabel}`,
        `Detail: ${step.detail}`,
      ].join("\n"),
    ),
    "",
    "Garde-fou: checklist locale uniquement, aucune publication, aucune commande fournisseur, aucune sortie de HOLD.",
  ].join("\n\n");
}

function buildDraftProofCategoryBatchText(
  products: Product[],
  categoryId: string | undefined,
  categoryNameById: Map<string, string>,
  proofZoneId?: DraftProofZoneId,
) {
  if (!proofZoneId || !categoryId) {
    return "Aucun rayon prioritaire disponible pour le lot de preuve actif.";
  }

  const proofLabel = draftProofZoneLabels[proofZoneId];
  const categoryLabel = categoryNameById.get(categoryId) ?? categoryId;
  const categoryProducts = products
    .filter((product) => product.categoryId === categoryId)
    .sort(
      (left, right) =>
        getDraftPriority(right).score - getDraftPriority(left).score,
    );

  if (categoryProducts.length === 0) {
    return `Aucun brouillon visible dans le rayon ${categoryLabel} pour la preuve ${proofLabel}.`;
  }

  const readyAfterZoneCount = categoryProducts.filter(
    (product) =>
      getDraftMissingProofs(product).filter(
        (proof) => proof.id !== proofZoneId,
      ).length === 0,
  ).length;
  const linkedBlockerCount = categoryProducts.reduce(
    (total, product) =>
      total +
      getDraftMissingProofs(product).filter((proof) => proof.id !== proofZoneId)
        .length,
    0,
  );
  const maturity = getDraftCategoryMaturity(
    categoryProducts.length,
    readyAfterZoneCount,
    linkedBlockerCount,
  );

  return [
    `Rayon prioritaire: ${categoryLabel}`,
    `ID rayon: ${categoryId}`,
    `Lot preuve: ${proofLabel}`,
    `Brouillons concernes: ${categoryProducts.length}`,
    `Maturite: ${maturity.label} (${maturity.percent}% prets apres preuve, ${maturity.averageLinkedBlockers} blocage(s) lie(s) moyen(s))`,
    "Action: traiter ce rayon en lot, puis garder chaque fiche en validation tant que toutes les preuves ne sont pas confirmees.",
    "",
    ...categoryProducts.slice(0, 10).map((product, index) => {
      const missingProofs = getDraftMissingProofs(product);
      const activeProof = missingProofs.find((proof) => proof.id === proofZoneId);
      const otherProofs = missingProofs.filter((proof) => proof.id !== proofZoneId);
      const priority = getDraftPriority(product);

      return [
        `${index + 1}. ${product.name}`,
        `Slug: ${product.slug}`,
        `Priorite: ${priority.score} - ${priority.label}`,
        `Preuve du lot: ${activeProof?.detail ?? proofLabel}`,
        `Autres blocages: ${
          otherProofs.length
            ? otherProofs.map((proof) => proof.label).join(", ")
            : "aucun autre blocage preuve"
        }`,
        `Reprise admin: /admin/produits/${product.slug}/modifier`,
      ].join("\n");
    }),
  ].join("\n");
}

function buildDraftReadyCategoriesText(
  products: Product[],
  readyCategories: ReturnType<typeof getDraftProofBatchCategorySummary>,
  categoryNameById: Map<string, string>,
  proofZoneId?: DraftProofZoneId,
) {
  if (!proofZoneId) {
    return "Aucun lot de preuve actif pour exporter les rayons quasi prets.";
  }

  const proofLabel = draftProofZoneLabels[proofZoneId];

  if (readyCategories.length === 0) {
    return `Aucun rayon quasi pret pour la preuve ${proofLabel}. Continuer avec les rayons qui ont le moins de blocages lies.`;
  }

  return [
    `Rayons quasi prets`,
    `Lot preuve: ${proofLabel}`,
    `Rayons concernes: ${readyCategories.length}`,
    "Action: traiter ces rayons en premier, puis garder chaque fiche en validation tant que toutes les preuves ne sont pas confirmees.",
    "",
    ...readyCategories.map((category, index) => {
      const categoryProducts = products
        .filter((product) => product.categoryId === category.id)
        .sort(
          (left, right) =>
            getDraftPriority(right).score - getDraftPriority(left).score,
        );
      const categoryLabel = categoryNameById.get(category.id) ?? category.label;

      return [
        `${index + 1}. ${categoryLabel}`,
        `ID rayon: ${category.id}`,
        `Brouillons: ${category.count}`,
        `Maturite: ${category.maturity.label} (${category.maturity.percent}% prets apres preuve)`,
        `Priorite max: ${Math.max(category.topPriorityScore, 0)}`,
        `Premier brouillon: ${
          category.topProduct
            ? `${category.topProduct.name} (${category.topProduct.slug})`
            : "aucun"
        }`,
        `Autres brouillons: ${
          categoryProducts
            .slice(1, 5)
            .map((product) => product.slug)
            .join(", ") || "aucun"
        }`,
      ].join("\n");
    }),
  ].join("\n");
}

function getDraftReviewChecklist(product: Product) {
  const gate = product.dropshipping?.validationGate;
  const checks = gate?.checks ?? [];
  const items = [
    {
      label: "Verifier le lien fournisseur",
      done: Boolean(product.dropshipping?.supplierUrl),
    },
    {
      label: "Confirmer le prix fournisseur",
      done: Boolean(product.dropshipping?.supplierPriceCents),
    },
    {
      label: "Confirmer le delai de livraison",
      done: Boolean(product.dropshipping?.deliveryEstimate),
    },
    {
      label: "Completer le gate humain",
      done: Boolean(gate && checks.length >= 4),
    },
    {
      label: "Relire titre, description et visuels",
      done: Boolean(product.name && product.description && product.image),
    },
  ];

  return items.map((item) => ({
    ...item,
    statusLabel: item.done ? "OK" : "A reprendre",
  }));
}

function DraftProductsTable({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");
  const [gateFilter, setGateFilter] = useState<DraftGateFilter>("all");
  const [supplierFilter, setSupplierFilter] = useState<DraftSupplierFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<DraftPriorityFilter>("all");
  const [proofFilter, setProofFilter] = useState<DraftProofFilter>("all");
  const [sortMode, setSortMode] = useState<DraftSortMode>("priority-desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [compactView, setCompactView] = useState(false);
  const [showReadyCategoryOnly, setShowReadyCategoryOnly] = useState(false);
  const activeProofCategoryPanelRef = useRef<HTMLDivElement>(null);
  const [activeProofCategoryQueue, setActiveProofCategoryQueue] = useState<
    DraftProofCategoryQueueEntry[]
  >([]);
  const [activeProofCategoryOpportunityId, setActiveProofCategoryOpportunityId] =
    useState("");
  const [
    activeProofCategoryExecutionChecked,
    setActiveProofCategoryExecutionChecked,
  ] = useState<string[]>([]);
  const [
    activeProofCategoryLastHandledByEntry,
    setActiveProofCategoryLastHandledByEntry,
  ] = useState<Record<string, Array<{ name: string; slug: string }>>>({});
  const [
    activeProofCategoryMoussPriorityCheckedByEntry,
    setActiveProofCategoryMoussPriorityCheckedByEntry,
  ] = useState<Record<string, string[]>>({});
  const [
    activeProofCategoryMoussDecisionByProduct,
    setActiveProofCategoryMoussDecisionByProduct,
  ] = useState<Record<string, DraftMoussDecisionStatus>>({});
  const [
    activeProofCategoryMoussFinalCheckedByProduct,
    setActiveProofCategoryMoussFinalCheckedByProduct,
  ] = useState<Record<string, DraftMoussFinalChecklistId[]>>({});
  const [
    activeProofCategoryMoussFinalPaperDecisionByProduct,
    setActiveProofCategoryMoussFinalPaperDecisionByProduct,
  ] = useState<Record<string, DraftMoussFinalPaperDecisionStatus>>({});
  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const summary = useMemo(() => getDraftDashboardSummary(products), [products]);
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const gateOrder: Record<Exclude<DraftGateFilter, "all">, number> = {
      missing: 0,
      incomplete: 1,
      complete: 2,
    };

    return products
      .filter((product) => {
        const gateState = getDraftGateFilter(product);
        const supplierLinkState = product.dropshipping?.supplierUrl
          ? "with-link"
          : "without-link";
        const priority = getDraftPriority(product);
        const isUrgent = priority.score > 0;
        const missingProofIds = getDraftMissingProofs(product).map(
          (proof) => proof.id,
        );
        const searchableText = [
          product.name,
          product.slug,
          product.categoryId,
          product.dropshipping?.validationGate?.candidateId,
          product.dropshipping?.validationGate?.source,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          (gateFilter === "all" || gateState === gateFilter) &&
          (supplierFilter === "all" || supplierLinkState === supplierFilter) &&
          (priorityFilter === "all" ||
            (priorityFilter === "urgent" ? isUrgent : !isUrgent)) &&
          (proofFilter === "all" || missingProofIds.includes(proofFilter)) &&
          (!query || searchableText.includes(query))
        );
      })
      .sort((left, right) => {
        if (sortMode === "name-asc") {
          return left.name.localeCompare(right.name, "fr");
        }

        if (sortMode === "recent-gate") {
          return getDraftTimestamp(right) - getDraftTimestamp(left);
        }

        if (sortMode === "gate-state") {
          return gateOrder[getDraftGateFilter(left)] - gateOrder[getDraftGateFilter(right)];
        }

        return getDraftPriority(right).score - getDraftPriority(left).score;
      });
  }, [
    gateFilter,
    priorityFilter,
    products,
    proofFilter,
    searchQuery,
    sortMode,
    supplierFilter,
  ]);
  const filteredSummary = useMemo(
    () => getDraftDashboardSummary(filteredProducts),
    [filteredProducts],
  );
  const proofSummary = useMemo(
    () => getDraftProofDashboardSummary(products),
    [products],
  );
  const filteredProofSummary = useMemo(
    () => getDraftProofDashboardSummary(filteredProducts),
    [filteredProducts],
  );
  const proofOpportunitySummary = useMemo(
    () => getDraftProofOpportunitySummary(filteredProducts).slice(0, 4),
    [filteredProducts],
  );
  const topProofOpportunity = proofOpportunitySummary[0];
  const topProofOpportunityText = useMemo(
    () =>
      buildDraftProofOpportunityText(
        filteredProducts,
        topProofOpportunity?.id,
      ),
    [filteredProducts, topProofOpportunity?.id],
  );
  const proofCategoryOpportunitySummary = useMemo(
    () =>
      getDraftProofCategoryOpportunitySummary(
        filteredProducts,
        categoryNameById,
      ).slice(0, 4),
    [categoryNameById, filteredProducts],
  );
  const topProofCategoryOpportunity = proofCategoryOpportunitySummary[0];
  const topProofCategoryOpportunityText = useMemo(
    () =>
      buildDraftProofCategoryOpportunityText(
        filteredProducts,
        topProofCategoryOpportunity,
        categoryNameById,
      ),
    [categoryNameById, filteredProducts, topProofCategoryOpportunity],
  );
  const currentProofCategoryQueue = useMemo(
    () => getDraftProofCategoryQueueSnapshot(proofCategoryOpportunitySummary),
    [proofCategoryOpportunitySummary],
  );
  const displayedProofCategoryQueue =
    activeProofCategoryQueue.length > 0
      ? activeProofCategoryQueue
      : currentProofCategoryQueue;
  const hasActiveProofCategoryQueue = activeProofCategoryQueue.length > 0;
  const activeProofCategoryQueueEntry =
    displayedProofCategoryQueue.find(
      (entry) => entry.id === activeProofCategoryOpportunityId,
    ) ?? displayedProofCategoryQueue[0];
  const activeProofCategoryQueueIndex = Math.max(
    displayedProofCategoryQueue.findIndex(
      (entry) => entry.id === activeProofCategoryQueueEntry?.id,
    ),
    0,
  );
  const activeProofCategoryPreviousEntry =
    displayedProofCategoryQueue.length > 1
      ? displayedProofCategoryQueue[
          (activeProofCategoryQueueIndex -
            1 +
            displayedProofCategoryQueue.length) %
            displayedProofCategoryQueue.length
        ]
      : null;
  const activeProofCategoryNextEntry =
    displayedProofCategoryQueue.length > 1
      ? displayedProofCategoryQueue[
          (activeProofCategoryQueueIndex + 1) %
            displayedProofCategoryQueue.length
        ]
      : null;
  const topProofCategoryQueueEntry = currentProofCategoryQueue[0];
  const proofCategoryQueueImpactProducts = hasActiveProofCategoryQueue
    ? products
    : filteredProducts;
  const proofCategoryOpportunityQueueText = useMemo(
    () =>
      buildDraftProofCategoryOpportunityQueueText(
        displayedProofCategoryQueue,
      ),
    [displayedProofCategoryQueue],
  );
  const proofCategoryOpportunityQueueImpact = useMemo(
    () =>
      getDraftProofCategoryOpportunityQueueImpact(
        proofCategoryQueueImpactProducts,
        displayedProofCategoryQueue,
      ),
    [displayedProofCategoryQueue, proofCategoryQueueImpactProducts],
  );
  const proofCategoryOpportunityImpactText = useMemo(
    () =>
      buildDraftProofCategoryOpportunityImpactText(
        proofCategoryQueueImpactProducts,
        displayedProofCategoryQueue,
      ),
    [displayedProofCategoryQueue, proofCategoryQueueImpactProducts],
  );
  const activeProofCategoryQueueText = useMemo(
    () =>
      buildDraftActiveProofCategoryQueueText(
        proofCategoryQueueImpactProducts,
        displayedProofCategoryQueue,
        activeProofCategoryOpportunityId,
      ),
    [
      activeProofCategoryOpportunityId,
      displayedProofCategoryQueue,
      proofCategoryQueueImpactProducts,
    ],
  );
  const activeProofCategorySummaryText = useMemo(
    () =>
      buildDraftActiveProofCategorySummaryText(
        displayedProofCategoryQueue,
        activeProofCategoryOpportunityId,
      ),
    [activeProofCategoryOpportunityId, displayedProofCategoryQueue],
  );
  const activeProofCategoryValidationCsv = useMemo(
    () =>
      buildDraftActiveProofCategoryValidationCsv(
        displayedProofCategoryQueue,
        activeProofCategoryOpportunityId,
      ),
    [activeProofCategoryOpportunityId, displayedProofCategoryQueue],
  );
  const activeProofCategoryExecutionSteps = useMemo(
    () =>
      getDraftActiveProofCategoryExecutionSteps(
        proofCategoryQueueImpactProducts,
        displayedProofCategoryQueue,
        activeProofCategoryOpportunityId,
      ),
    [
      activeProofCategoryOpportunityId,
      displayedProofCategoryQueue,
      proofCategoryQueueImpactProducts,
    ],
  );
  const activeProofCategoryExecutionText = useMemo(
    () =>
      buildDraftActiveProofCategoryExecutionText(
        activeProofCategoryExecutionSteps,
        activeProofCategoryExecutionChecked,
      ),
    [activeProofCategoryExecutionChecked, activeProofCategoryExecutionSteps],
  );
  const activeProofCategoryExecutionCheckedCount =
    activeProofCategoryExecutionSteps.filter((step) =>
      activeProofCategoryExecutionChecked.includes(step.id),
    ).length;
  const activeProofCategoryLocalProgressRows = useMemo(
    () =>
      displayedProofCategoryQueue.map((entry) => {
        const entryProducts = getDraftActiveProofCategoryProducts(
          proofCategoryQueueImpactProducts,
          entry,
        );
        const entryProductSlugs = new Set(
          entryProducts.map((product) => product.slug),
        );
        const handledCount = (
          activeProofCategoryLastHandledByEntry[entry.id] ?? []
        ).filter((product) => entryProductSlugs.has(product.slug)).length;
        const totalCount = entryProducts.length;
        const doneCount = Math.min(handledCount, totalCount);
        const pendingCount = Math.max(totalCount - doneCount, 0);

        return {
          doneCount,
          entryId: entry.id,
          isComplete: totalCount > 0 && pendingCount === 0,
          pendingCount,
          totalCount,
        };
      }),
    [
      activeProofCategoryLastHandledByEntry,
      displayedProofCategoryQueue,
      proofCategoryQueueImpactProducts,
    ],
  );
  const activeProofCategoryLocalProgressByEntry = useMemo(
    () =>
      new Map(
        activeProofCategoryLocalProgressRows.map((row) => [row.entryId, row]),
      ),
    [activeProofCategoryLocalProgressRows],
  );
  const activeProofCategoryLocalDoneCount =
    activeProofCategoryLocalProgressRows.reduce(
      (total, row) => total + row.doneCount,
      0,
    );
  const activeProofCategoryLocalTotalCount =
    activeProofCategoryLocalProgressRows.reduce(
      (total, row) => total + row.totalCount,
      0,
    );
  const activeProofCategoryLocalCompleteLotCount =
    activeProofCategoryLocalProgressRows.filter((row) => row.isComplete).length;
  const activeProofCategoryLocalProgressText = useMemo(
    () =>
      [
        "Progression locale file active",
        `Lots actifs: ${displayedProofCategoryQueue.length}`,
        `Brouillons traites localement: ${activeProofCategoryLocalDoneCount}/${activeProofCategoryLocalTotalCount}`,
        `Lots couverts localement: ${activeProofCategoryLocalCompleteLotCount}/${displayedProofCategoryQueue.length}`,
        "Garde-fou: progression de session uniquement, aucune validation produit, aucun retrait du HOLD.",
        "",
        ...displayedProofCategoryQueue.map((entry, index) => {
          const progress = activeProofCategoryLocalProgressByEntry.get(entry.id);

          return [
            `#${index + 1} ${entry.proofLabel} / ${entry.categoryLabel}`,
            `Local: ${progress?.doneCount ?? 0}/${progress?.totalCount ?? entry.count} traite(s), ${progress?.pendingCount ?? entry.count} a faire`,
            `Statut: ${progress?.isComplete ? "couvert localement en session" : "a continuer en HOLD"}`,
          ].join("\n");
        }),
        "",
        "Action: continuer les preuves exactes lot par lot, puis validation humaine Mouss avant toute publication.",
      ].join("\n"),
    [
      activeProofCategoryLocalCompleteLotCount,
      activeProofCategoryLocalDoneCount,
      activeProofCategoryLocalProgressByEntry,
      activeProofCategoryLocalTotalCount,
      displayedProofCategoryQueue,
    ],
  );
  const activeProofCategoryMoussReviewRows = useMemo(
    () =>
      displayedProofCategoryQueue.map((entry) => {
        const handledSlugs = new Set(
          (activeProofCategoryLastHandledByEntry[entry.id] ?? []).map(
            (product) => product.slug,
          ),
        );
        const pendingProducts = getDraftActiveProofCategoryProducts(
          proofCategoryQueueImpactProducts,
          entry,
        ).filter((product) => !handledSlugs.has(product.slug));
        const readyProducts = pendingProducts.filter(
          (product) =>
            getDraftMissingProofs(product).filter(
              (proof) => proof.id !== entry.proofZoneId,
            ).length === 0,
        );
        const blockedProducts = pendingProducts.filter(
          (product) =>
            getDraftMissingProofs(product).filter(
              (proof) => proof.id !== entry.proofZoneId,
            ).length > 0,
        );

        return {
          blockedCount: blockedProducts.length,
          entry,
          pendingCount: pendingProducts.length,
          readyCount: readyProducts.length,
          topBlockedProducts: blockedProducts.slice(0, 2),
          topReadyProducts: readyProducts.slice(0, 3),
        };
      }),
    [
      activeProofCategoryLastHandledByEntry,
      displayedProofCategoryQueue,
      proofCategoryQueueImpactProducts,
    ],
  );
  const activeProofCategoryMoussReviewLotCount =
    activeProofCategoryMoussReviewRows.filter((row) => row.readyCount > 0)
      .length;
  const activeProofCategoryMoussReviewCandidateCount =
    activeProofCategoryMoussReviewRows.reduce(
      (total, row) => total + row.readyCount,
      0,
    );
  const activeProofCategoryMoussReviewBlockedCount =
    activeProofCategoryMoussReviewRows.reduce(
      (total, row) => total + row.blockedCount,
      0,
    );
  const activeProofCategoryMoussReviewTopRow = useMemo(
    () =>
      [...activeProofCategoryMoussReviewRows].sort((left, right) => {
        if (right.readyCount !== left.readyCount) {
          return right.readyCount - left.readyCount;
        }

        if (right.pendingCount !== left.pendingCount) {
          return right.pendingCount - left.pendingCount;
        }

        return right.entry.topPriorityScore - left.entry.topPriorityScore;
      })[0],
    [activeProofCategoryMoussReviewRows],
  );
  const activeProofCategoryMoussReviewQueueText = useMemo(
    () =>
      [
        "Revue Mouss file active",
        `Lots avec candidats: ${activeProofCategoryMoussReviewLotCount}/${displayedProofCategoryQueue.length}`,
        `Candidats a relire: ${activeProofCategoryMoussReviewCandidateCount}`,
        `Encore bloques: ${activeProofCategoryMoussReviewBlockedCount}`,
        `Lot prioritaire: ${
          activeProofCategoryMoussReviewTopRow
            ? `${activeProofCategoryMoussReviewTopRow.entry.proofLabel} / ${activeProofCategoryMoussReviewTopRow.entry.categoryLabel}`
            : "aucun lot disponible"
        }`,
        "Garde-fou: synthese locale uniquement, aucun retrait du HOLD, aucune publication.",
        "",
        ...activeProofCategoryMoussReviewRows.map((row, index) =>
          [
            `#${index + 1} ${row.entry.proofLabel} / ${row.entry.categoryLabel}`,
            `A traiter: ${row.pendingCount}`,
            `Candidats revue Mouss: ${row.readyCount}`,
            `Encore bloques: ${row.blockedCount}`,
            "Candidats",
            ...(row.topReadyProducts.length > 0
              ? row.topReadyProducts.map(
                  (product, productIndex) =>
                    `${productIndex + 1}. ${product.name} (${product.slug})`,
                )
              : ["Aucun candidat dans ce lot."]),
            "Blocages visibles",
            ...(row.topBlockedProducts.length > 0
              ? row.topBlockedProducts.map((product, productIndex) => {
                  const blockerLabels = getDraftMissingProofs(product)
                    .filter((proof) => proof.id !== row.entry.proofZoneId)
                    .slice(0, 3)
                    .map((proof) => proof.label);

                  return `${productIndex + 1}. ${product.name} (${blockerLabels.join(", ")})`;
                })
              : ["Aucun blocage restant apres preuve cible."]),
          ].join("\n"),
        ),
        "",
        "Action: traiter les preuves exactes, puis revue humaine Mouss avant toute publication.",
      ].join("\n\n"),
    [
      activeProofCategoryMoussReviewBlockedCount,
      activeProofCategoryMoussReviewCandidateCount,
      activeProofCategoryMoussReviewLotCount,
      activeProofCategoryMoussReviewRows,
      activeProofCategoryMoussReviewTopRow,
      displayedProofCategoryQueue.length,
    ],
  );
  const activeProofCategoryMoussReviewQueueCsv = useMemo(() => {
    const header = [
      "position",
      "lot_prioritaire",
      "preuve",
      "rayon",
      "a_traiter_localement",
      "candidats_revue_mouss",
      "encore_bloques",
      "premiers_candidats",
      "blocages_visibles",
      "garde_hold",
    ];
    const rows =
      activeProofCategoryMoussReviewRows.length > 0
        ? activeProofCategoryMoussReviewRows.map((row, index) => {
            const topCandidates =
              row.topReadyProducts.length > 0
                ? row.topReadyProducts
                    .map((product) => `${product.name} (${product.slug})`)
                    .join(" | ")
                : "aucun candidat";
            const topBlockers =
              row.topBlockedProducts.length > 0
                ? row.topBlockedProducts
                    .map((product) => {
                      const blockerLabels = getDraftMissingProofs(product)
                        .filter(
                          (proof) => proof.id !== row.entry.proofZoneId,
                        )
                        .slice(0, 3)
                        .map((proof) => proof.label)
                        .join(", ");

                      return `${product.name} (${blockerLabels})`;
                    })
                    .join(" | ")
                : "aucun blocage";

            return [
              index + 1,
              row.entry.id === activeProofCategoryMoussReviewTopRow?.entry.id
                ? "oui"
                : "non",
              row.entry.proofLabel,
              row.entry.categoryLabel,
              row.pendingCount,
              row.readyCount,
              row.blockedCount,
              topCandidates,
              topBlockers,
              "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
            ];
          })
        : [
            [
              "0",
              "non",
              "aucune",
              "aucun",
              "0",
              "0",
              "0",
              "aucun candidat",
              "aucun blocage",
              "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
            ],
          ];

    return [header, ...rows]
      .map((row) => row.map(escapeDraftCsvCell).join(";"))
      .join("\n");
  }, [activeProofCategoryMoussReviewRows, activeProofCategoryMoussReviewTopRow]);
  const activeProofCategoryMoussPriorityProducts = useMemo(() => {
    const entry = activeProofCategoryMoussReviewTopRow?.entry;

    if (!entry) {
      return [];
    }

    const handledSlugs = new Set(
      (activeProofCategoryLastHandledByEntry[entry.id] ?? []).map(
        (product) => product.slug,
      ),
    );

    return getDraftActiveProofCategoryProducts(
      proofCategoryQueueImpactProducts,
      entry,
    ).filter((product) => !handledSlugs.has(product.slug));
  }, [
    activeProofCategoryLastHandledByEntry,
    activeProofCategoryMoussReviewTopRow,
    proofCategoryQueueImpactProducts,
  ]);
  const activeProofCategoryMoussPriorityPlans = useMemo(
    () =>
      activeProofCategoryMoussPriorityProducts.map((product) => {
        const priority = getDraftPriority(product);
        const validation = getDraftValidationState(product);
        const otherProofLabels = activeProofCategoryMoussReviewTopRow
          ? getDraftMissingProofs(product)
              .filter(
                (proof) =>
                  proof.id !==
                  activeProofCategoryMoussReviewTopRow.entry.proofZoneId,
              )
              .map((proof) => proof.label)
          : [];
        const isReadyAfterTarget = otherProofLabels.length === 0;

        return {
          actionLabel: isReadyAfterTarget
            ? "Relire puis validation Mouss"
            : "Completer preuves restantes",
          isReadyAfterTarget,
          otherProofLabels,
          priority,
          product,
          statusLabel: isReadyAfterTarget
            ? "Pret pour revue Mouss"
            : `${otherProofLabels.length} preuve(s) restante(s)`,
          validationLabel: validation.label,
        };
      }),
    [
      activeProofCategoryMoussPriorityProducts,
      activeProofCategoryMoussReviewTopRow,
    ],
  );
  const activeProofCategoryMoussPriorityPreviewPlans =
    activeProofCategoryMoussPriorityPlans.slice(0, 4);
  const activeProofCategoryMoussPriorityReadyCount =
    activeProofCategoryMoussPriorityPlans.filter(
      (plan) => plan.isReadyAfterTarget,
    ).length;
  const activeProofCategoryMoussPriorityBlockedCount =
    activeProofCategoryMoussPriorityPlans.length -
    activeProofCategoryMoussPriorityReadyCount;
  const activeProofCategoryMoussPriorityRemainingCount = Math.max(
    activeProofCategoryMoussPriorityPlans.length -
      activeProofCategoryMoussPriorityPreviewPlans.length,
    0,
  );
  const activeProofCategoryMoussPriorityEntryId =
    activeProofCategoryMoussReviewTopRow?.entry.id ?? "";
  const activeProofCategoryMoussPriorityCheckedSlugs = useMemo(
    () =>
      new Set(
        activeProofCategoryMoussPriorityCheckedByEntry[
          activeProofCategoryMoussPriorityEntryId
        ] ?? [],
      ),
    [
      activeProofCategoryMoussPriorityCheckedByEntry,
      activeProofCategoryMoussPriorityEntryId,
    ],
  );
  const activeProofCategoryMoussPriorityCheckedCount =
    activeProofCategoryMoussPriorityPlans.filter((plan) =>
      activeProofCategoryMoussPriorityCheckedSlugs.has(plan.product.slug),
    ).length;
  const activeProofCategoryMoussPriorityUncheckedCount = Math.max(
    activeProofCategoryMoussPriorityPlans.length -
      activeProofCategoryMoussPriorityCheckedCount,
    0,
  );
  const activeProofCategoryMoussPriorityCheckedPercent =
    activeProofCategoryMoussPriorityPlans.length > 0
      ? Math.round(
          (activeProofCategoryMoussPriorityCheckedCount /
            activeProofCategoryMoussPriorityPlans.length) *
            100,
        )
      : 0;
  const activeProofCategoryMoussPriorityText = useMemo(() => {
    const entry = activeProofCategoryMoussReviewTopRow?.entry;

    if (!entry) {
      return [
        "Dossier prioritaire Mouss",
        "Aucun lot prioritaire disponible.",
        "Garde-fou: aucun produit ne sort du HOLD depuis ce dossier.",
      ].join("\n");
    }

    return [
      "Dossier prioritaire Mouss",
      `Lot prioritaire: ${entry.proofLabel} / ${entry.categoryLabel}`,
      `Produits a traiter: ${activeProofCategoryMoussPriorityPlans.length}`,
      `Prets pour revue Mouss apres preuve cible: ${activeProofCategoryMoussPriorityReadyCount}`,
      `Encore bloques apres preuve cible: ${activeProofCategoryMoussPriorityBlockedCount}`,
      `Session locale: ${activeProofCategoryMoussPriorityCheckedCount}/${activeProofCategoryMoussPriorityPlans.length} coche(s), ${activeProofCategoryMoussPriorityUncheckedCount} a continuer`,
      "Garde-fou: dossier local uniquement, HOLD maintenu jusqu'aux preuves exactes et validation Mouss.",
      "",
      "Produits du lot",
      ...(activeProofCategoryMoussPriorityPlans.length > 0
        ? activeProofCategoryMoussPriorityPlans.slice(0, 10).map(
            (plan, index) =>
              [
                `${index + 1}. ${plan.product.name}`,
                `Slug: ${plan.product.slug}`,
                `Priorite: ${plan.priority.score} - ${plan.priority.label}`,
                `Statut apres preuve cible: ${plan.statusLabel}`,
                `Session locale: ${
                  activeProofCategoryMoussPriorityCheckedSlugs.has(
                    plan.product.slug,
                  )
                    ? "coche localement"
                    : "a traiter"
                }`,
                `Puis: ${
                  plan.otherProofLabels.length > 0
                    ? plan.otherProofLabels.slice(0, 4).join(", ")
                    : "revue Mouss possible"
                }`,
                `Reprise admin: /admin/produits/${plan.product.slug}/modifier`,
              ].join("\n"),
          )
        : ["Aucun produit restant dans le lot prioritaire."]),
      "",
      "Action: traiter ces produits dans l'ordre, sans publication ni retrait HOLD.",
    ].join("\n\n");
  }, [
    activeProofCategoryMoussPriorityBlockedCount,
    activeProofCategoryMoussPriorityCheckedCount,
    activeProofCategoryMoussPriorityCheckedSlugs,
    activeProofCategoryMoussPriorityPlans,
    activeProofCategoryMoussPriorityReadyCount,
    activeProofCategoryMoussPriorityUncheckedCount,
    activeProofCategoryMoussReviewTopRow,
  ]);
  const activeProofCategoryMoussPriorityCsv = useMemo(() => {
    const header = [
      "position",
      "lot_prioritaire",
      "produit",
      "slug",
      "priorite",
      "statut_apres_preuve_cible",
      "preuves_restantes",
      "session_locale",
      "reprise_admin",
      "garde_hold",
    ];
    const entry = activeProofCategoryMoussReviewTopRow?.entry;

    if (!entry) {
      return [
        header,
        [
          "0",
          "aucun",
          "aucun produit",
          "non disponible",
          "0",
          "aucun lot prioritaire",
          "non applicable",
          "non applicable",
          "non applicable",
          "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
        ],
      ]
        .map((row) => row.map(escapeDraftCsvCell).join(";"))
        .join("\n");
    }

    const rows =
      activeProofCategoryMoussPriorityPlans.length > 0
        ? activeProofCategoryMoussPriorityPlans.map((plan, index) => [
            index + 1,
            `${entry.proofLabel} / ${entry.categoryLabel}`,
            plan.product.name,
            plan.product.slug,
            plan.priority.score,
            plan.statusLabel,
            plan.otherProofLabels.length > 0
              ? plan.otherProofLabels.join(", ")
              : "revue Mouss possible",
            activeProofCategoryMoussPriorityCheckedSlugs.has(plan.product.slug)
              ? "coche localement"
              : "a traiter",
            `/admin/produits/${plan.product.slug}/modifier`,
            "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
          ])
        : [
            [
              "0",
              `${entry.proofLabel} / ${entry.categoryLabel}`,
              "aucun produit restant",
              "non disponible",
              "0",
              "lot couvert localement",
              "non applicable",
              "non applicable",
              "non applicable",
              "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
            ],
          ];

    return [header, ...rows]
      .map((row) => row.map(escapeDraftCsvCell).join(";"))
      .join("\n");
  }, [
    activeProofCategoryMoussPriorityCheckedSlugs,
    activeProofCategoryMoussPriorityPlans,
    activeProofCategoryMoussReviewTopRow,
  ]);
  const activeProofCategoryMoussActionRows = useMemo(
    () =>
      displayedProofCategoryQueue.map((entry) => {
        const handledSlugs = new Set(
          (activeProofCategoryLastHandledByEntry[entry.id] ?? []).map(
            (product) => product.slug,
          ),
        );
        const checkedSlugs = new Set(
          activeProofCategoryMoussPriorityCheckedByEntry[entry.id] ?? [],
        );
        const plans = getDraftActiveProofCategoryProducts(
          proofCategoryQueueImpactProducts,
          entry,
        )
          .filter((product) => !handledSlugs.has(product.slug))
          .map((product) => {
            const priority = getDraftPriority(product);
            const otherProofLabels = getDraftMissingProofs(product)
              .filter((proof) => proof.id !== entry.proofZoneId)
              .map((proof) => proof.label);
            const isReadyAfterTarget = otherProofLabels.length === 0;
            const sessionChecked = checkedSlugs.has(product.slug);

            return {
              isReadyAfterTarget,
              otherProofLabels,
              priority,
              product,
              sessionChecked,
              statusLabel: isReadyAfterTarget
                ? "Pret pour revue Mouss"
                : `${otherProofLabels.length} preuve(s) restante(s)`,
            };
          });
        const checkedCount = plans.filter((plan) => plan.sessionChecked).length;
        const uncheckedCount = plans.length - checkedCount;
        const readyCount = plans.filter(
          (plan) => plan.isReadyAfterTarget,
        ).length;
        const blockedCount = plans.length - readyCount;

        return {
          blockedCount,
          checkedCount,
          entry,
          plans,
          readyCount,
          topPendingPlans: plans
            .filter((plan) => !plan.sessionChecked)
            .slice(0, 2),
          topReadyPlans: plans
            .filter((plan) => plan.isReadyAfterTarget)
            .slice(0, 2),
          uncheckedCount,
        };
      }),
    [
      activeProofCategoryLastHandledByEntry,
      activeProofCategoryMoussPriorityCheckedByEntry,
      displayedProofCategoryQueue,
      proofCategoryQueueImpactProducts,
    ],
  );
  const activeProofCategoryMoussActionPreviewRows =
    activeProofCategoryMoussActionRows.slice(0, 3);
  const activeProofCategoryMoussActionCheckedTotal =
    activeProofCategoryMoussActionRows.reduce(
      (total, row) => total + row.checkedCount,
      0,
    );
  const activeProofCategoryMoussActionPendingTotal =
    activeProofCategoryMoussActionRows.reduce(
      (total, row) => total + row.uncheckedCount,
      0,
    );
  const activeProofCategoryMoussActionReadyTotal =
    activeProofCategoryMoussActionRows.reduce(
      (total, row) => total + row.readyCount,
      0,
    );
  const activeProofCategoryMoussActionBlockedTotal =
    activeProofCategoryMoussActionRows.reduce(
      (total, row) => total + row.blockedCount,
      0,
    );
  const activeProofCategoryMoussActionsText = useMemo(
    () =>
      [
        "Prochaines actions Mouss multi-lots",
        `Lots actifs: ${activeProofCategoryMoussActionRows.length}`,
        `Coches localement: ${activeProofCategoryMoussActionCheckedTotal}`,
        `A traiter: ${activeProofCategoryMoussActionPendingTotal}`,
        `Prets pour revue Mouss: ${activeProofCategoryMoussActionReadyTotal}`,
        `Encore bloques: ${activeProofCategoryMoussActionBlockedTotal}`,
        "Garde-fou: session locale uniquement, HOLD maintenu, validation Mouss obligatoire.",
        "",
        ...(activeProofCategoryMoussActionRows.length > 0
          ? activeProofCategoryMoussActionRows.map((row, index) => {
              const previewPlans =
                row.topPendingPlans.length > 0
                  ? row.topPendingPlans
                  : row.topReadyPlans;

              return [
                `#${index + 1} ${row.entry.proofLabel} / ${row.entry.categoryLabel}`,
                `Session: ${row.checkedCount} coche(s), ${row.uncheckedCount} a traiter`,
                `Apres preuve cible: ${row.readyCount} revue Mouss, ${row.blockedCount} encore bloque(s)`,
                "Produits a reprendre",
                ...(previewPlans.length > 0
                  ? previewPlans.map((plan, productIndex) =>
                      [
                        `${productIndex + 1}. ${plan.product.name}`,
                        `Slug: ${plan.product.slug}`,
                        `Session locale: ${
                          plan.sessionChecked
                            ? "coche localement"
                            : "a traiter"
                        }`,
                        `Statut: ${plan.statusLabel}`,
                        `Puis: ${
                          plan.otherProofLabels.length > 0
                            ? plan.otherProofLabels.slice(0, 4).join(", ")
                            : "revue Mouss possible"
                        }`,
                        `Reprise admin: /admin/produits/${plan.product.slug}/modifier`,
                      ].join("\n"),
                    )
                  : ["Aucun produit restant dans ce lot."]),
              ].join("\n");
            })
          : ["Aucun lot actif disponible."]),
        "",
        "Action: reprendre les lots dans l'ordre, cocher localement, garder HOLD sans publication.",
      ].join("\n\n"),
    [
      activeProofCategoryMoussActionBlockedTotal,
      activeProofCategoryMoussActionCheckedTotal,
      activeProofCategoryMoussActionPendingTotal,
      activeProofCategoryMoussActionReadyTotal,
      activeProofCategoryMoussActionRows,
    ],
  );
  const activeProofCategoryMoussActionsCsv = useMemo(() => {
    const header = [
      "lot",
      "preuve",
      "rayon",
      "produit",
      "slug",
      "session_locale",
      "statut_apres_preuve_cible",
      "preuves_restantes",
      "reprise_admin",
      "garde_hold",
    ];
    const rows = activeProofCategoryMoussActionRows.flatMap((row, rowIndex) =>
      row.plans.map((plan) => [
        rowIndex + 1,
        row.entry.proofLabel,
        row.entry.categoryLabel,
        plan.product.name,
        plan.product.slug,
        plan.sessionChecked ? "coche localement" : "a traiter",
        plan.statusLabel,
        plan.otherProofLabels.length > 0
          ? plan.otherProofLabels.join(", ")
          : "revue Mouss possible",
        `/admin/produits/${plan.product.slug}/modifier`,
        "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
      ]),
    );

    return [
      header,
      ...(rows.length > 0
        ? rows
        : [
            [
              "0",
              "aucune",
              "aucun",
              "aucun produit",
              "non disponible",
              "non applicable",
              "aucun lot actif",
              "non applicable",
              "non applicable",
              "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
            ],
          ]),
    ]
      .map((row) => row.map(escapeDraftCsvCell).join(";"))
      .join("\n");
  }, [activeProofCategoryMoussActionRows]);
  const activeProofCategoryMoussHandoffPlans = useMemo(
    () =>
      activeProofCategoryMoussActionRows
        .flatMap((row) =>
          row.plans.map((plan) => ({
            ...plan,
            entry: row.entry,
          })),
        )
        .sort((left, right) => {
          if (left.isReadyAfterTarget !== right.isReadyAfterTarget) {
            return left.isReadyAfterTarget ? -1 : 1;
          }

          if (left.sessionChecked !== right.sessionChecked) {
            return left.sessionChecked ? -1 : 1;
          }

          return right.priority.score - left.priority.score;
        }),
    [activeProofCategoryMoussActionRows],
  );
  const activeProofCategoryMoussHandoffReadyPlans = useMemo(
    () =>
      activeProofCategoryMoussHandoffPlans.filter(
        (plan) => plan.isReadyAfterTarget,
      ),
    [activeProofCategoryMoussHandoffPlans],
  );
  const activeProofCategoryMoussHandoffPreviewPlans = useMemo(
    () => activeProofCategoryMoussHandoffReadyPlans.slice(0, 4),
    [activeProofCategoryMoussHandoffReadyPlans],
  );
  const activeProofCategoryMoussHandoffCheckedReadyCount =
    activeProofCategoryMoussHandoffReadyPlans.filter(
      (plan) => plan.sessionChecked,
    ).length;
  const activeProofCategoryMoussHandoffUncheckedReadyCount =
    activeProofCategoryMoussHandoffReadyPlans.length -
    activeProofCategoryMoussHandoffCheckedReadyCount;
  const activeProofCategoryMoussHandoffCheckedBlockedCount =
    activeProofCategoryMoussHandoffPlans.filter(
      (plan) => plan.sessionChecked && !plan.isReadyAfterTarget,
    ).length;
  const activeProofCategoryMoussHandoffRemainingPreviewCount = Math.max(
    activeProofCategoryMoussHandoffReadyPlans.length -
      activeProofCategoryMoussHandoffPreviewPlans.length,
    0,
  );
  const activeProofCategoryMoussDecisionPlans = useMemo(
    () =>
      activeProofCategoryMoussHandoffReadyPlans.map((plan) => {
        const decision =
          activeProofCategoryMoussDecisionByProduct[plan.product.slug] ??
          "hold";

        return {
          ...plan,
          decision,
          decisionLabel: draftMoussDecisionLabels[decision],
        };
      }),
    [
      activeProofCategoryMoussDecisionByProduct,
      activeProofCategoryMoussHandoffReadyPlans,
    ],
  );
  const activeProofCategoryMoussDecisionPreviewPlans = useMemo(
    () => activeProofCategoryMoussDecisionPlans.slice(0, 4),
    [activeProofCategoryMoussDecisionPlans],
  );
  const activeProofCategoryMoussDecisionHoldCount =
    activeProofCategoryMoussDecisionPlans.filter(
      (plan) => plan.decision === "hold",
    ).length;
  const activeProofCategoryMoussDecisionReviewCount =
    activeProofCategoryMoussDecisionPlans.filter(
      (plan) => plan.decision === "review",
    ).length;
  const activeProofCategoryMoussDecisionReadyCount =
    activeProofCategoryMoussDecisionPlans.filter(
      (plan) => plan.decision === "ready",
    ).length;
  const activeProofCategoryMoussDecisionTouchedCount =
    activeProofCategoryMoussDecisionPlans.filter(
      (plan) => activeProofCategoryMoussDecisionByProduct[plan.product.slug],
    ).length;
  const activeProofCategoryMoussHandoffText = useMemo(
    () =>
      [
        "Passerelle revue Mouss",
        `Candidats prets apres preuve cible: ${activeProofCategoryMoussDecisionPlans.length}`,
        `Coches et prets: ${activeProofCategoryMoussHandoffCheckedReadyCount}`,
        `Prets a confirmer: ${activeProofCategoryMoussHandoffUncheckedReadyCount}`,
        `Coches mais encore bloques: ${activeProofCategoryMoussHandoffCheckedBlockedCount}`,
        `Decisions session: ${activeProofCategoryMoussDecisionTouchedCount} saisie(s)`,
        `Maintenir HOLD: ${activeProofCategoryMoussDecisionHoldCount}`,
        `A revoir Mouss: ${activeProofCategoryMoussDecisionReviewCount}`,
        `Dossier pret Mouss: ${activeProofCategoryMoussDecisionReadyCount}`,
        "Decision: validation humaine Mouss uniquement. HOLD maintenu, aucune publication automatique.",
        "",
        "Candidats a relire",
        ...(activeProofCategoryMoussDecisionPlans.length > 0
          ? activeProofCategoryMoussDecisionPlans.slice(0, 12).map(
              (plan, index) =>
                [
                  `${index + 1}. ${plan.product.name}`,
                  `Slug: ${plan.product.slug}`,
                  `Lot: ${plan.entry.proofLabel} / ${plan.entry.categoryLabel}`,
                  `Session locale: ${
                    plan.sessionChecked ? "coche localement" : "a confirmer"
                  }`,
                  `Decision session: ${plan.decisionLabel}`,
                  "Decision Mouss: valider manuellement ou maintenir HOLD",
                  `Reprise admin: /admin/produits/${plan.product.slug}/modifier`,
                ].join("\n"),
            )
          : ["Aucun candidat pret pour revue Mouss dans les lots actifs."]),
        "",
        "Action: relire les candidats, garder HOLD tant que Mouss n'a pas valide explicitement.",
      ].join("\n\n"),
    [
      activeProofCategoryMoussHandoffCheckedBlockedCount,
      activeProofCategoryMoussHandoffCheckedReadyCount,
      activeProofCategoryMoussHandoffUncheckedReadyCount,
      activeProofCategoryMoussDecisionHoldCount,
      activeProofCategoryMoussDecisionPlans,
      activeProofCategoryMoussDecisionReadyCount,
      activeProofCategoryMoussDecisionReviewCount,
      activeProofCategoryMoussDecisionTouchedCount,
    ],
  );
  const activeProofCategoryMoussHandoffCsv = useMemo(() => {
    const header = [
      "position",
      "lot",
      "preuve",
      "rayon",
      "produit",
      "slug",
      "session_locale",
      "etat_revue",
      "decision_mouss",
      "decision_session",
      "reprise_admin",
      "garde_hold",
    ];
    const rows =
      activeProofCategoryMoussDecisionPlans.length > 0
        ? activeProofCategoryMoussDecisionPlans.map((plan, index) => [
            index + 1,
            `${plan.entry.proofLabel} / ${plan.entry.categoryLabel}`,
            plan.entry.proofLabel,
            plan.entry.categoryLabel,
            plan.product.name,
            plan.product.slug,
            plan.sessionChecked ? "coche localement" : "a confirmer",
            "pret pour revue Mouss",
            "validation humaine requise",
            plan.decisionLabel,
            `/admin/produits/${plan.product.slug}/modifier`,
            "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
          ])
        : [
            [
              "0",
              "aucun",
              "aucune",
              "aucun",
              "aucun produit",
              "non disponible",
              "non applicable",
              "aucun candidat pret",
              "validation humaine requise",
              "Maintenir HOLD",
              "non applicable",
              "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
            ],
          ];

    return [header, ...rows]
      .map((row) => row.map(escapeDraftCsvCell).join(";"))
      .join("\n");
  }, [activeProofCategoryMoussDecisionPlans]);
  const activeProofCategoryMoussReadyDossierPlans = useMemo(
    () =>
      activeProofCategoryMoussDecisionPlans.filter(
        (plan) => plan.decision === "ready",
      ),
    [activeProofCategoryMoussDecisionPlans],
  );
  const activeProofCategoryMoussReadyDossierPreviewPlans = useMemo(
    () => activeProofCategoryMoussReadyDossierPlans.slice(0, 4),
    [activeProofCategoryMoussReadyDossierPlans],
  );
  const activeProofCategoryMoussReadyDossierCheckedCount =
    activeProofCategoryMoussReadyDossierPlans.filter(
      (plan) => plan.sessionChecked,
    ).length;
  const activeProofCategoryMoussReadyDossierPendingSessionCount =
    activeProofCategoryMoussReadyDossierPlans.length -
    activeProofCategoryMoussReadyDossierCheckedCount;
  const activeProofCategoryMoussFinalChecklistTotalCount =
    activeProofCategoryMoussReadyDossierPlans.length *
    draftMoussFinalChecklistItems.length;
  const activeProofCategoryMoussFinalChecklistCheckedCount =
    activeProofCategoryMoussReadyDossierPlans.reduce((total, plan) => {
      const checkedIds =
        activeProofCategoryMoussFinalCheckedByProduct[plan.product.slug] ?? [];

      return (
        total +
        draftMoussFinalChecklistItems.filter((item) =>
          checkedIds.includes(item.id),
        ).length
      );
    }, 0);
  const activeProofCategoryMoussFinalChecklistCompleteCount =
    activeProofCategoryMoussReadyDossierPlans.filter((plan) => {
      const checkedIds =
        activeProofCategoryMoussFinalCheckedByProduct[plan.product.slug] ?? [];

      return draftMoussFinalChecklistItems.every((item) =>
        checkedIds.includes(item.id),
      );
    }).length;
  const activeProofCategoryMoussFinalLotRows = useMemo(() => {
    const rowsByEntry = new Map<string, DraftMoussFinalLotRow>();

    for (const plan of activeProofCategoryMoussReadyDossierPlans) {
      const checkedIds =
        activeProofCategoryMoussFinalCheckedByProduct[plan.product.slug] ?? [];
      const checkedCount = draftMoussFinalChecklistItems.filter((item) =>
        checkedIds.includes(item.id),
      ).length;
      const isComplete =
        checkedCount === draftMoussFinalChecklistItems.length;
      const current = rowsByEntry.get(plan.entry.id);

      if (current) {
        current.readyCount += 1;
        current.completeCount += isComplete ? 1 : 0;
        current.checkedCount += checkedCount;
        current.totalCount += draftMoussFinalChecklistItems.length;
        current.pendingCount = current.readyCount - current.completeCount;
      } else {
        rowsByEntry.set(plan.entry.id, {
          id: plan.entry.id,
          proofLabel: plan.entry.proofLabel,
          categoryLabel: plan.entry.categoryLabel,
          readyCount: 1,
          completeCount: isComplete ? 1 : 0,
          checkedCount,
          totalCount: draftMoussFinalChecklistItems.length,
          pendingCount: isComplete ? 0 : 1,
          topProductName: plan.product.name,
          topProductSlug: plan.product.slug,
        });
      }
    }

    return Array.from(rowsByEntry.values()).sort((left, right) => {
      if (left.pendingCount !== right.pendingCount) {
        return right.pendingCount - left.pendingCount;
      }

      if (left.readyCount !== right.readyCount) {
        return right.readyCount - left.readyCount;
      }

      return right.checkedCount - left.checkedCount;
    });
  }, [
    activeProofCategoryMoussFinalCheckedByProduct,
    activeProofCategoryMoussReadyDossierPlans,
  ]);
  const activeProofCategoryMoussFinalLotPreviewRows = useMemo(
    () => activeProofCategoryMoussFinalLotRows.slice(0, 4),
    [activeProofCategoryMoussFinalLotRows],
  );
  const activeProofCategoryMoussFinalLotCompleteCount =
    activeProofCategoryMoussFinalLotRows.filter(
      (row) => row.readyCount > 0 && row.pendingCount === 0,
    ).length;
  const activeProofCategoryMoussFinalLotIncompleteCount =
    activeProofCategoryMoussFinalLotRows.length -
    activeProofCategoryMoussFinalLotCompleteCount;
  const activeProofCategoryMoussFinalLotRemainingPreviewCount = Math.max(
    activeProofCategoryMoussFinalLotRows.length -
      activeProofCategoryMoussFinalLotPreviewRows.length,
    0,
  );
  const activeProofCategoryMoussFinalLotPriorityRows = useMemo(
    () =>
      activeProofCategoryMoussFinalLotRows
        .filter((row) => row.pendingCount > 0)
        .map((row) => ({
          ...row,
          missingChecklistCount: Math.max(row.totalCount - row.checkedCount, 0),
          completionPercent:
            row.totalCount > 0
              ? Math.round((row.checkedCount / row.totalCount) * 100)
              : 0,
        }))
        .sort((left, right) => {
          if (left.missingChecklistCount !== right.missingChecklistCount) {
            return left.missingChecklistCount - right.missingChecklistCount;
          }

          if (left.pendingCount !== right.pendingCount) {
            return left.pendingCount - right.pendingCount;
          }

          return right.completionPercent - left.completionPercent;
        }),
    [activeProofCategoryMoussFinalLotRows],
  );
  const activeProofCategoryMoussFinalLotPriorityPreviewRows = useMemo(
    () => activeProofCategoryMoussFinalLotPriorityRows.slice(0, 4),
    [activeProofCategoryMoussFinalLotPriorityRows],
  );
  const activeProofCategoryMoussFinalLotPriorityTopRow =
    activeProofCategoryMoussFinalLotPriorityRows[0] ?? null;
  const activeProofCategoryMoussFinalLotPriorityMissingTotal =
    activeProofCategoryMoussFinalLotPriorityRows.reduce(
      (total, row) => total + row.missingChecklistCount,
      0,
    );
  const activeProofCategoryMoussFinalLotPriorityRemainingPreviewCount =
    Math.max(
      activeProofCategoryMoussFinalLotPriorityRows.length -
        activeProofCategoryMoussFinalLotPriorityPreviewRows.length,
      0,
    );
  const activeProofCategoryMoussReadyDossierRemainingPreviewCount = Math.max(
    activeProofCategoryMoussReadyDossierPlans.length -
      activeProofCategoryMoussReadyDossierPreviewPlans.length,
    0,
  );
  const activeProofCategoryMoussReadyDossierText = useMemo(
    () =>
      [
        "Dossier final revue Mouss",
        `Candidats marques dossier pret: ${activeProofCategoryMoussReadyDossierPlans.length}`,
        `Coches localement: ${activeProofCategoryMoussReadyDossierCheckedCount}`,
        `A confirmer dans la session: ${activeProofCategoryMoussReadyDossierPendingSessionCount}`,
        "Garde-fou: dossier local, HOLD maintenu, aucune publication automatique.",
        "",
        ...(activeProofCategoryMoussReadyDossierPlans.length > 0
          ? activeProofCategoryMoussReadyDossierPlans.map((plan, index) =>
              [
                `${index + 1}. ${plan.product.name}`,
                `Slug: ${plan.product.slug}`,
                `Lot: ${plan.entry.proofLabel} / ${plan.entry.categoryLabel}`,
                `Session locale: ${
                  plan.sessionChecked ? "coche localement" : "a confirmer"
                }`,
                "Decision session: Dossier pret Mouss",
                "Suite: revue humaine Mouss, puis maintien HOLD ou validation explicite.",
                `Reprise admin: /admin/produits/${plan.product.slug}/modifier`,
              ].join("\n"),
            )
          : [
              "Aucun candidat marque Dossier pret Mouss dans cette session.",
              "Utiliser le menu Decision locale pour alimenter ce dossier.",
            ]),
        "",
        "Action: relire ce dossier avec Mouss; ne pas publier depuis cet export.",
      ].join("\n\n"),
    [
      activeProofCategoryMoussReadyDossierCheckedCount,
      activeProofCategoryMoussReadyDossierPendingSessionCount,
      activeProofCategoryMoussReadyDossierPlans,
    ],
  );
  const activeProofCategoryMoussReadyDossierPrintText = useMemo(
    () =>
      [
        "Checklist finale revue Mouss",
        `Dossiers prets: ${activeProofCategoryMoussReadyDossierPlans.length}`,
        `Produits avec checklist complete: ${activeProofCategoryMoussFinalChecklistCompleteCount}`,
        `Cases cochees: ${activeProofCategoryMoussFinalChecklistCheckedCount}/${activeProofCategoryMoussFinalChecklistTotalCount}`,
        "Garde-fou: cette checklist prepare la revue, elle ne valide pas le catalogue.",
        "",
        ...(activeProofCategoryMoussReadyDossierPlans.length > 0
          ? activeProofCategoryMoussReadyDossierPlans.map((plan, index) => {
              const checkedIds =
                activeProofCategoryMoussFinalCheckedByProduct[
                  plan.product.slug
                ] ?? [];

              return [
                `${index + 1}. ${plan.product.name}`,
                `Slug: ${plan.product.slug}`,
                `Lot: ${plan.entry.proofLabel} / ${plan.entry.categoryLabel}`,
                `Session locale: ${
                  plan.sessionChecked ? "coche localement" : "a confirmer"
                }`,
                "Decision session: Dossier pret Mouss",
                ...draftMoussFinalChecklistItems.map(
                  (item) =>
                    `[${checkedIds.includes(item.id) ? "x" : " "}] ${
                      item.label
                    } - ${item.detail}`,
                ),
                "Decision finale Mouss: maintenir HOLD / valider plus tard apres preuves exactes",
                `Reprise admin: /admin/produits/${plan.product.slug}/modifier`,
              ].join("\n");
            })
          : [
              "Aucun candidat pret dans le dossier final.",
              "Marquer d'abord un candidat en Dossier pret Mouss.",
            ]),
        "",
        "Signature Mouss: ____________________",
        "Date de revue: ____________________",
        "Rappel: aucune publication, aucun paiement, aucune commande depuis cette checklist.",
      ].join("\n\n"),
    [
      activeProofCategoryMoussFinalCheckedByProduct,
      activeProofCategoryMoussFinalChecklistCheckedCount,
      activeProofCategoryMoussFinalChecklistCompleteCount,
      activeProofCategoryMoussFinalChecklistTotalCount,
      activeProofCategoryMoussReadyDossierPlans,
    ],
  );
  const activeProofCategoryMoussReadyDossierCsv = useMemo(() => {
    const header = [
      "position",
      "lot",
      "preuve",
      "rayon",
      "produit",
      "slug",
      "session_locale",
      "decision_session",
      "suite_mouss",
      "reprise_admin",
      "garde_hold",
    ];
    const rows =
      activeProofCategoryMoussReadyDossierPlans.length > 0
        ? activeProofCategoryMoussReadyDossierPlans.map((plan, index) => [
            index + 1,
            `${plan.entry.proofLabel} / ${plan.entry.categoryLabel}`,
            plan.entry.proofLabel,
            plan.entry.categoryLabel,
            plan.product.name,
            plan.product.slug,
            plan.sessionChecked ? "coche localement" : "a confirmer",
            "Dossier pret Mouss",
            "revue humaine requise avant toute action catalogue",
            `/admin/produits/${plan.product.slug}/modifier`,
            "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
          ])
        : [
            [
              "0",
              "aucun",
              "aucune",
              "aucun",
              "aucun produit",
              "non disponible",
              "non applicable",
              "aucun dossier pret",
              "selection locale requise",
              "non applicable",
              "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
            ],
          ];

    return [header, ...rows]
      .map((row) => row.map(escapeDraftCsvCell).join(";"))
      .join("\n");
  }, [activeProofCategoryMoussReadyDossierPlans]);
  const activeProofCategoryMoussReadyDossierChecklistCsv = useMemo(() => {
    const header = [
      "position",
      "lot",
      "produit",
      "slug",
      "decision_session",
      "image_exacte",
      "source_partenaire",
      "prix_marge",
      "stock_delai",
      "droits_image",
      "validation_mouss",
      "suite_mouss",
      "garde_hold",
    ];
    const checklistIds: DraftMoussFinalChecklistId[] = [
      "image",
      "source",
      "price",
      "stockDelivery",
      "rights",
      "mouss",
    ];
    const rows =
      activeProofCategoryMoussReadyDossierPlans.length > 0
        ? activeProofCategoryMoussReadyDossierPlans.map((plan, index) => {
            const checkedIds =
              activeProofCategoryMoussFinalCheckedByProduct[
                plan.product.slug
              ] ?? [];

            return [
              index + 1,
              `${plan.entry.proofLabel} / ${plan.entry.categoryLabel}`,
              plan.product.name,
              plan.product.slug,
              "Dossier pret Mouss",
              ...checklistIds.map((id) =>
                checkedIds.includes(id) ? "OK" : "A cocher",
              ),
              "revue humaine requise avant toute action catalogue",
              "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
            ];
          })
        : [
            [
              "0",
              "aucun",
              "aucun produit",
              "non disponible",
              "aucun dossier pret",
              "A cocher",
              "A cocher",
              "A cocher",
              "A cocher",
              "A cocher",
              "A cocher",
              "selection locale requise",
              "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
            ],
          ];

    return [header, ...rows]
      .map((row) => row.map(escapeDraftCsvCell).join(";"))
      .join("\n");
  }, [
    activeProofCategoryMoussFinalCheckedByProduct,
    activeProofCategoryMoussReadyDossierPlans,
  ]);
  const activeProofCategoryMoussFinalLotSummaryText = useMemo(
    () =>
      [
        "Synthese inter-lots checklist finale Mouss",
        `Lots avec dossier pret: ${activeProofCategoryMoussFinalLotRows.length}`,
        `Lots complets: ${activeProofCategoryMoussFinalLotCompleteCount}`,
        `Lots incomplets: ${activeProofCategoryMoussFinalLotIncompleteCount}`,
        `Cases cochees: ${activeProofCategoryMoussFinalChecklistCheckedCount}/${activeProofCategoryMoussFinalChecklistTotalCount}`,
        "Garde-fou: synthese locale uniquement, HOLD maintenu, aucune publication.",
        "",
        ...(activeProofCategoryMoussFinalLotRows.length > 0
          ? activeProofCategoryMoussFinalLotRows.map((row, index) =>
              [
                `${index + 1}. ${row.proofLabel} / ${row.categoryLabel}`,
                `Dossiers prets: ${row.readyCount}`,
                `Checklists completes: ${row.completeCount}`,
                `Dossiers incomplets: ${row.pendingCount}`,
                `Cases cochees: ${row.checkedCount}/${row.totalCount}`,
                `Exemple a reprendre: ${row.topProductName}`,
                `Fiche admin: /admin/produits/${row.topProductSlug}/modifier`,
                "Suite Mouss: finir les cases manquantes ou maintenir HOLD.",
              ].join("\n"),
            )
          : [
              "Aucun lot avec dossier pret dans cette session.",
              "Marquer au moins un candidat en Dossier pret Mouss pour alimenter la synthese.",
            ]),
        "",
        "Action: traiter d'abord les lots incomplets, puis relire avec Mouss.",
      ].join("\n\n"),
    [
      activeProofCategoryMoussFinalChecklistCheckedCount,
      activeProofCategoryMoussFinalChecklistTotalCount,
      activeProofCategoryMoussFinalLotCompleteCount,
      activeProofCategoryMoussFinalLotIncompleteCount,
      activeProofCategoryMoussFinalLotRows,
    ],
  );
  const activeProofCategoryMoussFinalLotSummaryCsv = useMemo(() => {
    const header = [
      "position",
      "lot",
      "preuve",
      "rayon",
      "dossiers_prets",
      "checklists_completes",
      "dossiers_incomplets",
      "cases_cochees",
      "cases_totales",
      "produit_exemple",
      "slug_exemple",
      "suite_mouss",
      "garde_hold",
    ];
    const rows =
      activeProofCategoryMoussFinalLotRows.length > 0
        ? activeProofCategoryMoussFinalLotRows.map((row, index) => [
            index + 1,
            `${row.proofLabel} / ${row.categoryLabel}`,
            row.proofLabel,
            row.categoryLabel,
            row.readyCount,
            row.completeCount,
            row.pendingCount,
            row.checkedCount,
            row.totalCount,
            row.topProductName,
            row.topProductSlug,
            row.pendingCount > 0
              ? "finir checklist finale avant revue humaine"
              : "lot pret pour revue humaine Mouss",
            "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
          ])
        : [
            [
              "0",
              "aucun",
              "aucune",
              "aucun",
              "0",
              "0",
              "0",
              "0",
              "0",
              "aucun produit",
              "non disponible",
              "selection locale requise",
              "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
            ],
          ];

    return [header, ...rows]
      .map((row) => row.map(escapeDraftCsvCell).join(";"))
      .join("\n");
  }, [activeProofCategoryMoussFinalLotRows]);
  const activeProofCategoryMoussFinalLotPriorityText = useMemo(
    () =>
      [
        "Priorite lots incomplets Mouss",
        `Lots incomplets: ${activeProofCategoryMoussFinalLotPriorityRows.length}`,
        `Cases restantes: ${activeProofCategoryMoussFinalLotPriorityMissingTotal}`,
        `Lot le plus rapide: ${
          activeProofCategoryMoussFinalLotPriorityTopRow
            ? `${activeProofCategoryMoussFinalLotPriorityTopRow.proofLabel} / ${activeProofCategoryMoussFinalLotPriorityTopRow.categoryLabel}`
            : "aucun"
        }`,
        "Garde-fou: finir la checklist ne retire pas le HOLD; validation Mouss obligatoire.",
        "",
        ...(activeProofCategoryMoussFinalLotPriorityRows.length > 0
          ? activeProofCategoryMoussFinalLotPriorityRows.map((row, index) =>
              [
                `${index + 1}. ${row.proofLabel} / ${row.categoryLabel}`,
                `Progression: ${row.completionPercent}%`,
                `Cases restantes: ${row.missingChecklistCount}`,
                `Dossiers incomplets: ${row.pendingCount}`,
                `Produit exemple: ${row.topProductName}`,
                `Fiche admin: /admin/produits/${row.topProductSlug}/modifier`,
                "Suite Mouss: completer les cases restantes, puis revue humaine.",
              ].join("\n"),
            )
          : [
              "Aucun lot incomplet dans les dossiers prets de cette session.",
              "Si un lot est complet, il reste quand meme en HOLD avant validation explicite.",
            ]),
        "",
        "Action: commencer par le premier lot de cette liste.",
      ].join("\n\n"),
    [
      activeProofCategoryMoussFinalLotPriorityMissingTotal,
      activeProofCategoryMoussFinalLotPriorityRows,
      activeProofCategoryMoussFinalLotPriorityTopRow,
    ],
  );
  const activeProofCategoryMoussFinalLotPriorityCsv = useMemo(() => {
    const header = [
      "position",
      "lot",
      "preuve",
      "rayon",
      "progression",
      "cases_restantes",
      "dossiers_incomplets",
      "produit_exemple",
      "slug_exemple",
      "suite_mouss",
      "garde_hold",
    ];
    const rows =
      activeProofCategoryMoussFinalLotPriorityRows.length > 0
        ? activeProofCategoryMoussFinalLotPriorityRows.map((row, index) => [
            index + 1,
            `${row.proofLabel} / ${row.categoryLabel}`,
            row.proofLabel,
            row.categoryLabel,
            `${row.completionPercent}%`,
            row.missingChecklistCount,
            row.pendingCount,
            row.topProductName,
            row.topProductSlug,
            "completer checklist finale avant revue humaine",
            "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
          ])
        : [
            [
              "0",
              "aucun",
              "aucune",
              "aucun",
              "0%",
              "0",
              "0",
              "aucun produit",
              "non disponible",
              "aucun lot incomplet",
              "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
            ],
          ];

    return [header, ...rows]
      .map((row) => row.map(escapeDraftCsvCell).join(";"))
      .join("\n");
  }, [activeProofCategoryMoussFinalLotPriorityRows]);
  const activeProofCategoryMoussFinalLotWorkOrderRows =
    useMemo<DraftMoussFinalLotWorkOrderRow[]>(() => {
      if (!activeProofCategoryMoussFinalLotPriorityTopRow) {
        return [];
      }

      return activeProofCategoryMoussReadyDossierPlans
        .filter(
          (plan) =>
            plan.entry.id === activeProofCategoryMoussFinalLotPriorityTopRow.id,
        )
        .map((plan) => {
          const checkedIds =
            activeProofCategoryMoussFinalCheckedByProduct[plan.product.slug] ??
            [];
          const missingItems = draftMoussFinalChecklistItems.filter(
            (item) => !checkedIds.includes(item.id),
          );

          return {
            productName: plan.product.name,
            productSlug: plan.product.slug,
            checkedCount:
              draftMoussFinalChecklistItems.length - missingItems.length,
            missingCount: missingItems.length,
            missingItems,
          };
        })
        .filter((row) => row.missingCount > 0)
        .sort((left, right) => {
          if (left.missingCount !== right.missingCount) {
            return left.missingCount - right.missingCount;
          }

          if (left.checkedCount !== right.checkedCount) {
            return right.checkedCount - left.checkedCount;
          }

          return left.productName.localeCompare(right.productName, "fr");
        });
    }, [
      activeProofCategoryMoussFinalCheckedByProduct,
      activeProofCategoryMoussFinalLotPriorityTopRow,
      activeProofCategoryMoussReadyDossierPlans,
    ]);
  const activeProofCategoryMoussFinalLotWorkOrderTopRow =
    activeProofCategoryMoussFinalLotWorkOrderRows[0] ?? null;
  const activeProofCategoryMoussFinalLotWorkOrderPreviewRows = useMemo(
    () => activeProofCategoryMoussFinalLotWorkOrderRows.slice(0, 3),
    [activeProofCategoryMoussFinalLotWorkOrderRows],
  );
  const activeProofCategoryMoussFinalLotWorkOrderMissingTotal =
    activeProofCategoryMoussFinalLotWorkOrderRows.reduce(
      (total, row) => total + row.missingCount,
      0,
    );
  const activeProofCategoryMoussFinalLotWorkOrderText = useMemo(
    () =>
      [
        "Ordre de travail Mouss - lot incomplet prioritaire",
        `Lot: ${
          activeProofCategoryMoussFinalLotPriorityTopRow
            ? `${activeProofCategoryMoussFinalLotPriorityTopRow.proofLabel} / ${activeProofCategoryMoussFinalLotPriorityTopRow.categoryLabel}`
            : "aucun"
        }`,
        `Produit a traiter en premier: ${
          activeProofCategoryMoussFinalLotWorkOrderTopRow?.productName ??
          "aucun"
        }`,
        `Cases restantes dans ce lot: ${activeProofCategoryMoussFinalLotWorkOrderMissingTotal}`,
        "Garde-fou: ordre local seulement, HOLD maintenu, validation Mouss obligatoire.",
        "",
        ...(activeProofCategoryMoussFinalLotWorkOrderRows.length > 0
          ? activeProofCategoryMoussFinalLotWorkOrderRows.map((row, index) =>
              [
                `${index + 1}. ${row.productName}`,
                `Fiche admin: /admin/produits/${row.productSlug}/modifier`,
                `Progression locale: ${row.checkedCount}/${draftMoussFinalChecklistItems.length}`,
                "Cases a completer:",
                ...row.missingItems.map(
                  (item) => `- ${item.label}: ${item.detail}`,
                ),
              ].join("\n"),
            )
          : [
              "Aucun dossier incomplet dans le lot prioritaire.",
              "Conserver le HOLD jusqu'a validation humaine explicite.",
            ]),
        "",
        "Procedure Mouss: verifier les preuves exactes cote admin, cocher localement les cases terminees, puis relire avant validation humaine.",
        "Interdits: aucune publication, aucune commande, aucun paiement, aucun retrait HOLD automatique.",
      ].join("\n\n"),
    [
      activeProofCategoryMoussFinalLotPriorityTopRow,
      activeProofCategoryMoussFinalLotWorkOrderMissingTotal,
      activeProofCategoryMoussFinalLotWorkOrderRows,
      activeProofCategoryMoussFinalLotWorkOrderTopRow,
    ],
  );
  const activeProofCategoryMoussFinalLotWorkOrderCsv = useMemo(() => {
    const header = [
      "position",
      "lot",
      "produit",
      "slug",
      "progression_locale",
      "cases_restantes",
      "cases_a_completer",
      "action_mouss",
      "garde_hold",
    ];
    const lotLabel = activeProofCategoryMoussFinalLotPriorityTopRow
      ? `${activeProofCategoryMoussFinalLotPriorityTopRow.proofLabel} / ${activeProofCategoryMoussFinalLotPriorityTopRow.categoryLabel}`
      : "aucun";
    const rows =
      activeProofCategoryMoussFinalLotWorkOrderRows.length > 0
        ? activeProofCategoryMoussFinalLotWorkOrderRows.map((row, index) => [
            index + 1,
            lotLabel,
            row.productName,
            row.productSlug,
            `${row.checkedCount}/${draftMoussFinalChecklistItems.length}`,
            row.missingCount,
            row.missingItems.map((item) => item.label).join(" | "),
            "verifier preuves exactes et cocher localement",
            "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
          ])
        : [
            [
              "0",
              lotLabel,
              "aucun produit",
              "non disponible",
              "0/0",
              "0",
              "aucune",
              "aucune action locale",
              "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
            ],
          ];

    return [header, ...rows]
      .map((row) => row.map(escapeDraftCsvCell).join(";"))
      .join("\n");
  }, [
    activeProofCategoryMoussFinalLotPriorityTopRow,
      activeProofCategoryMoussFinalLotWorkOrderRows,
    ]);
  const activeProofCategoryMoussHumanReviewReadyRows =
    useMemo<DraftMoussHumanReviewReadyRow[]>(
      () =>
        activeProofCategoryMoussReadyDossierPlans
          .map((plan) => {
            const checkedIds =
              activeProofCategoryMoussFinalCheckedByProduct[
                plan.product.slug
              ] ?? [];
            const checkedCount = draftMoussFinalChecklistItems.filter((item) =>
              checkedIds.includes(item.id),
            ).length;
            const isReadyForHumanReview =
              checkedCount === draftMoussFinalChecklistItems.length;

            if (!isReadyForHumanReview) {
              return null;
            }

            return {
              productName: plan.product.name,
              productSlug: plan.product.slug,
              proofLabel: plan.entry.proofLabel,
              categoryLabel: plan.entry.categoryLabel,
              lotLabel: `${plan.entry.proofLabel} / ${plan.entry.categoryLabel}`,
              checkedCount,
            };
          })
          .filter((row): row is DraftMoussHumanReviewReadyRow => row !== null)
          .sort(
            (left, right) =>
              left.categoryLabel.localeCompare(right.categoryLabel, "fr") ||
              left.proofLabel.localeCompare(right.proofLabel, "fr") ||
              left.productName.localeCompare(right.productName, "fr"),
          ),
      [
        activeProofCategoryMoussFinalCheckedByProduct,
        activeProofCategoryMoussReadyDossierPlans,
      ],
    );
  const activeProofCategoryMoussHumanReviewReadyPreviewRows = useMemo(
    () => activeProofCategoryMoussHumanReviewReadyRows.slice(0, 4),
    [activeProofCategoryMoussHumanReviewReadyRows],
  );
  const activeProofCategoryMoussHumanReviewReadyText = useMemo(
    () =>
      [
        "Prets pour revue humaine Mouss",
        `Dossiers checklist complete: ${activeProofCategoryMoussHumanReviewReadyRows.length}`,
        "Statut: HOLD maintenu, revue humaine uniquement, aucune sortie automatique.",
        "",
        ...(activeProofCategoryMoussHumanReviewReadyRows.length > 0
          ? activeProofCategoryMoussHumanReviewReadyRows.map((row, index) =>
              [
                `${index + 1}. ${row.productName}`,
                `Lot: ${row.lotLabel}`,
                `Fiche admin: /admin/produits/${row.productSlug}/modifier`,
                `Checklist locale: ${row.checkedCount}/${draftMoussFinalChecklistItems.length}`,
                "Action Mouss: relire les preuves exactes, confirmer ou maintenir HOLD.",
              ].join("\n"),
            )
          : [
              "Aucun dossier avec checklist complete dans cette session.",
              "Finir les cases manquantes avant revue humaine.",
            ]),
        "",
        "Garde-fou: ces lignes ne publient rien; Mouss doit valider explicitement avant toute sortie de HOLD.",
      ].join("\n\n"),
    [activeProofCategoryMoussHumanReviewReadyRows],
  );
  const activeProofCategoryMoussHumanReviewReadyCsv = useMemo(() => {
    const header = [
      "position",
      "produit",
      "slug",
      "lot",
      "preuve",
      "rayon",
      "checklist_locale",
      "action_mouss",
      "garde_hold",
    ];
    const rows =
      activeProofCategoryMoussHumanReviewReadyRows.length > 0
        ? activeProofCategoryMoussHumanReviewReadyRows.map((row, index) => [
            index + 1,
            row.productName,
            row.productSlug,
            row.lotLabel,
            row.proofLabel,
            row.categoryLabel,
            `${row.checkedCount}/${draftMoussFinalChecklistItems.length}`,
            "revue humaine Mouss avant sortie de HOLD",
            "HOLD maintenu sans validation explicite Mouss",
          ])
        : [
            [
              "0",
              "aucun produit",
              "non disponible",
              "aucun",
              "aucune",
              "aucun",
              "0/0",
              "finir checklist avant revue humaine",
              "HOLD maintenu sans validation explicite Mouss",
            ],
          ];

    return [header, ...rows]
      .map((row) => row.map(escapeDraftCsvCell).join(";"))
      .join("\n");
  }, [activeProofCategoryMoussHumanReviewReadyRows]);
  const activeProofCategoryMoussFinalValidationPrintText = useMemo(
    () =>
      [
        "Recap validation finale Mouss",
        `Dossiers a signer: ${activeProofCategoryMoussHumanReviewReadyRows.length}`,
        "Date validation: ____/____/____",
        "Garde-fou: recap imprimable seulement, aucune publication automatique, HOLD maintenu tant que Mouss ne valide pas explicitement.",
        "",
        ...(activeProofCategoryMoussHumanReviewReadyRows.length > 0
          ? activeProofCategoryMoussHumanReviewReadyRows.map((row, index) =>
              [
                `${index + 1}. ${row.productName}`,
                `Lot: ${row.lotLabel}`,
                `Fiche admin: /admin/produits/${row.productSlug}/modifier`,
                `Checklist locale: ${row.checkedCount}/${draftMoussFinalChecklistItems.length}`,
                "Decision Mouss (cocher une seule case):",
                "[ ] Confirmer HOLD",
                "[ ] Autoriser sortie HOLD apres validation Mouss",
                "Signature Mouss: ______________________________",
              ].join("\n"),
            )
          : [
              "Aucun dossier pret pour signature finale.",
              "Completer la checklist finale avant toute revue Mouss.",
            ]),
        "",
        "Rappel: une decision papier ne declenche aucune action automatique dans Maxi Trouvaille.",
      ].join("\n\n"),
    [activeProofCategoryMoussHumanReviewReadyRows],
  );
  const activeProofCategoryMoussFinalValidationPrintCsv = useMemo(() => {
    const header = [
      "position",
      "produit",
      "slug",
      "lot",
      "checklist_locale",
      "decision_confirmer_hold",
      "decision_autoriser_sortie_hold",
      "signature_mouss",
      "garde_hold",
    ];
    const rows =
      activeProofCategoryMoussHumanReviewReadyRows.length > 0
        ? activeProofCategoryMoussHumanReviewReadyRows.map((row, index) => [
            index + 1,
            row.productName,
            row.productSlug,
            row.lotLabel,
            `${row.checkedCount}/${draftMoussFinalChecklistItems.length}`,
            "a cocher papier",
            "a cocher papier",
            "signature manuscrite requise",
            "HOLD maintenu sans action automatique",
          ])
        : [
            [
              "0",
              "aucun produit",
              "non disponible",
              "aucun",
              "0/0",
              "non applicable",
              "non applicable",
              "non applicable",
              "HOLD maintenu sans action automatique",
            ],
          ];

    return [header, ...rows]
      .map((row) => row.map(escapeDraftCsvCell).join(";"))
      .join("\n");
  }, [activeProofCategoryMoussHumanReviewReadyRows]);
  const activeProofCategoryMoussFinalPaperDecisionRows =
    useMemo<DraftMoussFinalPaperDecisionRow[]>(
      () =>
        activeProofCategoryMoussHumanReviewReadyRows.map((row) => {
          const decision =
            activeProofCategoryMoussFinalPaperDecisionByProduct[
              row.productSlug
            ] ?? "none";

          return {
            ...row,
            decision,
            decisionLabel: draftMoussFinalPaperDecisionLabels[decision],
          };
        }),
      [
        activeProofCategoryMoussFinalPaperDecisionByProduct,
        activeProofCategoryMoussHumanReviewReadyRows,
      ],
    );
  const activeProofCategoryMoussFinalPaperDecisionRecordedCount =
    activeProofCategoryMoussFinalPaperDecisionRows.filter(
      (row) => row.decision !== "none",
    ).length;
  const activeProofCategoryMoussFinalPaperDecisionHoldCount =
    activeProofCategoryMoussFinalPaperDecisionRows.filter(
      (row) => row.decision === "hold",
    ).length;
  const activeProofCategoryMoussFinalPaperDecisionAuthorizeCount =
    activeProofCategoryMoussFinalPaperDecisionRows.filter(
      (row) => row.decision === "authorize",
    ).length;
  const activeProofCategoryMoussFinalPaperDecisionText = useMemo(
    () =>
      [
        "Index local decisions papier Mouss",
        `Dossiers suivis: ${activeProofCategoryMoussFinalPaperDecisionRows.length}`,
        `Decisions saisies localement: ${activeProofCategoryMoussFinalPaperDecisionRecordedCount}`,
        `Confirmer HOLD: ${activeProofCategoryMoussFinalPaperDecisionHoldCount}`,
        `Autoriser sortie HOLD: ${activeProofCategoryMoussFinalPaperDecisionAuthorizeCount}`,
        "Garde-fou: cet index est local et ne declenche aucune action automatique.",
        "",
        ...(activeProofCategoryMoussFinalPaperDecisionRows.length > 0
          ? activeProofCategoryMoussFinalPaperDecisionRows.map((row, index) =>
              [
                `${index + 1}. ${row.productName}`,
                `Lot: ${row.lotLabel}`,
                `Fiche admin: /admin/produits/${row.productSlug}/modifier`,
                `Decision papier: ${row.decisionLabel}`,
                "Action systeme: aucune, HOLD conserve tant que Mouss ne valide pas explicitement dans le process autorise.",
              ].join("\n"),
            )
          : [
              "Aucun dossier pret pour index papier.",
              "Completer la checklist finale avant de saisir une decision papier.",
            ]),
      ].join("\n\n"),
    [
      activeProofCategoryMoussFinalPaperDecisionAuthorizeCount,
      activeProofCategoryMoussFinalPaperDecisionHoldCount,
      activeProofCategoryMoussFinalPaperDecisionRecordedCount,
      activeProofCategoryMoussFinalPaperDecisionRows,
    ],
  );
  const activeProofCategoryMoussFinalPaperDecisionCsv = useMemo(() => {
    const header = [
      "position",
      "produit",
      "slug",
      "lot",
      "decision_papier",
      "decision_code",
      "action_systeme",
      "garde_hold",
    ];
    const rows =
      activeProofCategoryMoussFinalPaperDecisionRows.length > 0
        ? activeProofCategoryMoussFinalPaperDecisionRows.map((row, index) => [
            index + 1,
            row.productName,
            row.productSlug,
            row.lotLabel,
            row.decisionLabel,
            row.decision,
            "aucune action automatique",
            "HOLD conserve sans validation explicite Mouss",
          ])
        : [
            [
              "0",
              "aucun produit",
              "non disponible",
              "aucun",
              "aucune decision papier",
              "none",
              "aucune action automatique",
              "HOLD conserve sans validation explicite Mouss",
            ],
          ];

    return [header, ...rows]
      .map((row) => row.map(escapeDraftCsvCell).join(";"))
      .join("\n");
  }, [activeProofCategoryMoussFinalPaperDecisionRows]);
  const activeProofCategoryMoussFinalSessionText = useMemo(() => {
    const priorityLotLabel = activeProofCategoryMoussFinalLotPriorityTopRow
      ? `${activeProofCategoryMoussFinalLotPriorityTopRow.proofLabel} / ${activeProofCategoryMoussFinalLotPriorityTopRow.categoryLabel}`
      : "aucun lot incomplet prioritaire";
    const topWorkProduct =
      activeProofCategoryMoussFinalLotWorkOrderTopRow?.productName ??
      "aucune fiche a finir";

    return [
      "Synthese finale session Mouss",
      `Lot prioritaire: ${priorityLotLabel}`,
      `Produit a finir en premier: ${topWorkProduct}`,
      `Cases restantes dans le lot prioritaire: ${activeProofCategoryMoussFinalLotWorkOrderMissingTotal}`,
      `Dossiers prets pour revue humaine: ${activeProofCategoryMoussHumanReviewReadyRows.length}`,
      `Dossiers a signer: ${activeProofCategoryMoussHumanReviewReadyRows.length}`,
      `Decisions papier saisies: ${activeProofCategoryMoussFinalPaperDecisionRecordedCount}`,
      `HOLD confirmes papier: ${activeProofCategoryMoussFinalPaperDecisionHoldCount}`,
      `Autorisations papier notees: ${activeProofCategoryMoussFinalPaperDecisionAuthorizeCount}`,
      "Action systeme: aucune publication, aucune commande, aucun paiement, aucune sortie HOLD automatique.",
      "",
      "Parcours local recommande:",
      "1. Finir l'ordre de travail du lot prioritaire.",
      "2. Relire les dossiers prets pour revue humaine.",
      "3. Imprimer ou copier le recap validation finale et obtenir la signature Mouss.",
      "4. Reporter la decision papier dans l'index local.",
      "5. Garder HOLD tant qu'une validation explicite dans le process autorise n'est pas faite.",
      "",
      "Dossiers prets et decisions papier:",
      ...(activeProofCategoryMoussFinalPaperDecisionRows.length > 0
        ? activeProofCategoryMoussFinalPaperDecisionRows.map((row, index) =>
            [
              `${index + 1}. ${row.productName}`,
              `Lot: ${row.lotLabel}`,
              `Fiche admin: /admin/produits/${row.productSlug}/modifier`,
              `Checklist locale: ${row.checkedCount}/${draftMoussFinalChecklistItems.length}`,
              `Decision papier locale: ${row.decisionLabel}`,
              "Action systeme: aucune, HOLD conserve.",
            ].join("\n"),
          )
        : [
            "Aucun dossier pret dans cette session.",
            "Completer les preuves exactes avant recap final.",
          ]),
      "",
      "Interdits conserves: aucune source externe visible client, pas de publication, pas de commande, pas de paiement.",
    ].join("\n\n");
  }, [
    activeProofCategoryMoussFinalLotPriorityTopRow,
    activeProofCategoryMoussFinalLotWorkOrderMissingTotal,
    activeProofCategoryMoussFinalLotWorkOrderTopRow,
    activeProofCategoryMoussFinalPaperDecisionAuthorizeCount,
    activeProofCategoryMoussFinalPaperDecisionHoldCount,
    activeProofCategoryMoussFinalPaperDecisionRecordedCount,
    activeProofCategoryMoussFinalPaperDecisionRows,
    activeProofCategoryMoussHumanReviewReadyRows,
  ]);
  const activeProofCategoryMoussFinalSessionCsv = useMemo(() => {
    const priorityLotLabel = activeProofCategoryMoussFinalLotPriorityTopRow
      ? `${activeProofCategoryMoussFinalLotPriorityTopRow.proofLabel} / ${activeProofCategoryMoussFinalLotPriorityTopRow.categoryLabel}`
      : "aucun lot incomplet prioritaire";
    const topWorkProduct =
      activeProofCategoryMoussFinalLotWorkOrderTopRow?.productName ??
      "aucune fiche a finir";
    const summaryRows = [
      [
        "ordre_travail",
        "lot_prioritaire",
        priorityLotLabel,
        "finir les cases restantes",
        "HOLD maintenu",
      ],
      [
        "ordre_travail",
        "premier_produit",
        topWorkProduct,
        "ouvrir la fiche admin et verifier les preuves",
        "HOLD maintenu",
      ],
      [
        "ordre_travail",
        "cases_restantes",
        activeProofCategoryMoussFinalLotWorkOrderMissingTotal,
        "cocher localement apres verification",
        "HOLD maintenu",
      ],
      [
        "revue_humaine",
        "dossiers_prets",
        activeProofCategoryMoussHumanReviewReadyRows.length,
        "relire avant signature Mouss",
        "HOLD maintenu",
      ],
      [
        "signature",
        "dossiers_a_signer",
        activeProofCategoryMoussHumanReviewReadyRows.length,
        "decision papier requise",
        "aucune sortie automatique",
      ],
      [
        "decision_papier",
        "decisions_saisies",
        activeProofCategoryMoussFinalPaperDecisionRecordedCount,
        "report local seulement",
        "aucune mutation catalogue",
      ],
      [
        "decision_papier",
        "hold_confirmes",
        activeProofCategoryMoussFinalPaperDecisionHoldCount,
        "conserver HOLD",
        "HOLD maintenu",
      ],
      [
        "decision_papier",
        "autorisations_notees",
        activeProofCategoryMoussFinalPaperDecisionAuthorizeCount,
        "attendre process autorise explicite",
        "HOLD maintenu sans automatisme",
      ],
    ];
    const detailRows =
      activeProofCategoryMoussFinalPaperDecisionRows.length > 0
        ? activeProofCategoryMoussFinalPaperDecisionRows.map((row, index) => [
            `dossier_${index + 1}`,
            row.productName,
            row.productSlug,
            row.decisionLabel,
            "HOLD conserve sans action automatique",
          ])
        : [
            [
              "dossier_0",
              "aucun dossier pret",
              "non disponible",
              "completer les preuves exactes",
              "HOLD maintenu",
            ],
          ];
    const header = [
      "section",
      "indicateur",
      "valeur",
      "action_mouss",
      "garde_hold",
    ];

    return [header, ...summaryRows, ...detailRows]
      .map((row) => row.map(escapeDraftCsvCell).join(";"))
      .join("\n");
  }, [
    activeProofCategoryMoussFinalLotPriorityTopRow,
    activeProofCategoryMoussFinalLotWorkOrderMissingTotal,
    activeProofCategoryMoussFinalLotWorkOrderTopRow,
    activeProofCategoryMoussFinalPaperDecisionAuthorizeCount,
    activeProofCategoryMoussFinalPaperDecisionHoldCount,
    activeProofCategoryMoussFinalPaperDecisionRecordedCount,
    activeProofCategoryMoussFinalPaperDecisionRows,
    activeProofCategoryMoussHumanReviewReadyRows,
  ]);
  const activeProofCategoryProducts = useMemo(
    () =>
      getDraftActiveProofCategoryProducts(
        proofCategoryQueueImpactProducts,
        activeProofCategoryQueueEntry,
      ),
    [activeProofCategoryQueueEntry, proofCategoryQueueImpactProducts],
  );
  const activeProofCategoryHandledHistory = useMemo(
    () =>
      activeProofCategoryQueueEntry
        ? activeProofCategoryLastHandledByEntry[
            activeProofCategoryQueueEntry.id
          ] ?? []
        : [],
    [activeProofCategoryLastHandledByEntry, activeProofCategoryQueueEntry],
  );
  const activeProofCategoryHandledSlugs = useMemo(
    () =>
      new Set(activeProofCategoryHandledHistory.map((product) => product.slug)),
    [activeProofCategoryHandledHistory],
  );
  const activeProofCategoryPendingProducts = useMemo(
    () =>
      activeProofCategoryProducts.filter(
        (product) => !activeProofCategoryHandledSlugs.has(product.slug),
      ),
    [activeProofCategoryHandledSlugs, activeProofCategoryProducts],
  );
  const activeProofCategoryPendingCount =
    activeProofCategoryPendingProducts.length;
  const activeProofCategoryIsLotLocallyComplete =
    activeProofCategoryProducts.length > 0 &&
    activeProofCategoryPendingCount === 0;
  const activeProofCategoryTopProduct =
    activeProofCategoryPendingProducts[0] ?? activeProofCategoryProducts[0];
  const activeProofCategoryTopPriority = activeProofCategoryTopProduct
    ? getDraftPriority(activeProofCategoryTopProduct)
    : null;
  const activeProofCategoryHistoryText = useMemo(
    () =>
      buildDraftActiveProofCategoryHistoryText(
        activeProofCategoryQueueEntry,
        activeProofCategoryHandledHistory,
      ),
    [activeProofCategoryHandledHistory, activeProofCategoryQueueEntry],
  );
  const activeProofCategoryRemainingBlockerCount = useMemo(
    () =>
      activeProofCategoryProducts.reduce(
        (total, product) =>
          total +
          getDraftMissingProofs(product).filter(
            (proof) =>
              proof.id !== activeProofCategoryQueueEntry?.proofZoneId,
          ).length,
        0,
      ),
    [activeProofCategoryProducts, activeProofCategoryQueueEntry?.proofZoneId],
  );
  const activeProofCategoryNextProofLabels = activeProofCategoryTopProduct
    ? getDraftMissingProofs(activeProofCategoryTopProduct)
        .filter(
          (proof) =>
            proof.id !== activeProofCategoryQueueEntry?.proofZoneId,
        )
        .slice(0, 3)
        .map((proof) => proof.label)
    : [];
  const activeProofCategoryNextPendingEntry = useMemo(() => {
    if (displayedProofCategoryQueue.length <= 1) {
      return null;
    }

    for (
      let offset = 1;
      offset < displayedProofCategoryQueue.length;
      offset += 1
    ) {
      const candidate =
        displayedProofCategoryQueue[
          (activeProofCategoryQueueIndex + offset) %
            displayedProofCategoryQueue.length
        ];
      const progress = activeProofCategoryLocalProgressByEntry.get(candidate.id);

      if ((progress?.pendingCount ?? candidate.count) > 0) {
        return candidate;
      }
    }

    return null;
  }, [
    activeProofCategoryLocalProgressByEntry,
    activeProofCategoryQueueIndex,
    displayedProofCategoryQueue,
  ]);
  const activeProofCategoryNextPendingProgress =
    activeProofCategoryNextPendingEntry
      ? activeProofCategoryLocalProgressByEntry.get(
          activeProofCategoryNextPendingEntry.id,
        )
      : null;
  const activeProofCategoryNextPendingProducts = useMemo(() => {
    if (!activeProofCategoryNextPendingEntry) {
      return [];
    }

    const handledSlugs = new Set(
      (
        activeProofCategoryLastHandledByEntry[
          activeProofCategoryNextPendingEntry.id
        ] ?? []
      ).map((product) => product.slug),
    );

    return getDraftActiveProofCategoryProducts(
      proofCategoryQueueImpactProducts,
      activeProofCategoryNextPendingEntry,
    ).filter((product) => !handledSlugs.has(product.slug));
  }, [
    activeProofCategoryLastHandledByEntry,
    activeProofCategoryNextPendingEntry,
    proofCategoryQueueImpactProducts,
  ]);
  const activeProofCategoryNextPendingProductPlans = useMemo(
    () =>
      activeProofCategoryNextPendingProducts.map((product) => {
        const priority = getDraftPriority(product);
        const otherProofLabels = activeProofCategoryNextPendingEntry
          ? getDraftMissingProofs(product)
              .filter(
                (proof) =>
                  proof.id !== activeProofCategoryNextPendingEntry.proofZoneId,
              )
              .map((proof) => proof.label)
          : [];
        const isReadyAfterTarget = otherProofLabels.length === 0;

        return {
          isReadyAfterTarget,
          otherProofLabels,
          product,
          priority,
          statusLabel: isReadyAfterTarget
            ? "Pret a verifier"
            : `Bloque par ${otherProofLabels.length} preuve(s)`,
        };
      }),
    [activeProofCategoryNextPendingEntry, activeProofCategoryNextPendingProducts],
  );
  const activeProofCategoryNextPendingPreviewPlans =
    activeProofCategoryNextPendingProductPlans.slice(0, 3);
  const activeProofCategoryNextPendingRemainingProductCount = Math.max(
    activeProofCategoryNextPendingProductPlans.length -
      activeProofCategoryNextPendingPreviewPlans.length,
    0,
  );
  const activeProofCategoryNextPendingReadyAfterTargetCount =
    activeProofCategoryNextPendingProductPlans.filter(
      (plan) => plan.isReadyAfterTarget,
    ).length;
  const activeProofCategoryNextPendingBlockedAfterTargetCount =
    activeProofCategoryNextPendingProductPlans.length -
    activeProofCategoryNextPendingReadyAfterTargetCount;
  const activeProofCategoryNextPendingText = activeProofCategoryNextPendingEntry
    ? [
        "Prochain lot a faire local",
        `Lot: ${activeProofCategoryNextPendingEntry.proofLabel} / ${activeProofCategoryNextPendingEntry.categoryLabel}`,
        `Brouillons: ${activeProofCategoryNextPendingEntry.count}`,
        `Prets apres preuve: ${activeProofCategoryNextPendingEntry.readyAfterZoneCount}`,
        `Blocages lies: ${activeProofCategoryNextPendingEntry.linkedBlockerCount}`,
        `Priorite: ${activeProofCategoryNextPendingEntry.topPriorityScore}`,
        `Premier brouillon: ${activeProofCategoryNextPendingEntry.topProductName ?? "non disponible"}`,
        `Slug: ${activeProofCategoryNextPendingEntry.topProductSlug ?? "non disponible"}`,
        `Local: ${activeProofCategoryNextPendingProgress?.doneCount ?? 0}/${activeProofCategoryNextPendingProgress?.totalCount ?? activeProofCategoryNextPendingEntry.count} traite(s), ${activeProofCategoryNextPendingProgress?.pendingCount ?? activeProofCategoryNextPendingEntry.count} a faire`,
        `Produits restant dans le plan local: ${activeProofCategoryNextPendingProductPlans.length}`,
        `Prets a verifier apres preuve cible: ${activeProofCategoryNextPendingReadyAfterTargetCount}`,
        `Encore bloques apres preuve cible: ${activeProofCategoryNextPendingBlockedAfterTargetCount}`,
        "Statut: rester en brouillon/HOLD, aucune publication sans preuves exactes et validation Mouss.",
        "",
        "Action: ouvrir ce lot, traiter les preuves manquantes une par une, puis exporter la progression locale.",
      ].join("\n")
    : [
        "Prochain lot a faire local",
        "Tous les lots visibles de la file active sont couverts localement en session.",
        "Garde-fou: cette couverture locale ne valide pas les produits et ne retire jamais le HOLD.",
        "Action: relire les preuves exactes, exporter la file, puis demander validation humaine Mouss avant toute publication.",
      ].join("\n");
  const activeProofCategoryNextPendingPlanText = useMemo(() => {
    if (!activeProofCategoryNextPendingEntry) {
      return [
        "Plan produits prochain lot local",
        "Aucun prochain lot en retard dans cette session.",
        "Garde-fou: couverture locale uniquement, validation humaine Mouss obligatoire avant toute publication.",
      ].join("\n");
    }

    return [
      "Plan produits prochain lot local",
      `Lot: ${activeProofCategoryNextPendingEntry.proofLabel} / ${activeProofCategoryNextPendingEntry.categoryLabel}`,
      `Progression locale: ${activeProofCategoryNextPendingProgress?.doneCount ?? 0}/${activeProofCategoryNextPendingProgress?.totalCount ?? activeProofCategoryNextPendingEntry.count}`,
      `A faire dans ce lot: ${activeProofCategoryNextPendingProductPlans.length}`,
      `Prets a verifier apres preuve cible: ${activeProofCategoryNextPendingReadyAfterTargetCount}`,
      `Encore bloques apres preuve cible: ${activeProofCategoryNextPendingBlockedAfterTargetCount}`,
      "Garde-fou: chaque produit reste en brouillon/HOLD jusqu'aux preuves exactes et validation Mouss.",
      "",
      "Produits a traiter",
      ...(activeProofCategoryNextPendingProductPlans.length > 0
        ? activeProofCategoryNextPendingProductPlans.slice(0, 8).map(
            (plan, index) => {
              return [
                `${index + 1}. ${plan.product.name}`,
                `Slug: ${plan.product.slug}`,
                `Priorite: ${plan.priority.score} - ${plan.priority.label}`,
                `Preuve cible: ${activeProofCategoryNextPendingEntry.proofLabel}`,
                `Etat apres preuve cible: ${plan.statusLabel}`,
                `Puis: ${plan.otherProofLabels.length > 0 ? plan.otherProofLabels.slice(0, 4).join(", ") : "revue finale possible"}`,
                `Reprise admin: /admin/produits/${plan.product.slug}/modifier`,
              ].join("\n");
            },
          )
        : ["Aucun produit restant localement dans ce lot."]),
      "",
      "Action: ouvrir le lot, traiter les produits dans l'ordre, puis marquer localement seulement apres preuve verifiee.",
    ].join("\n\n");
  }, [
    activeProofCategoryNextPendingEntry,
    activeProofCategoryNextPendingBlockedAfterTargetCount,
    activeProofCategoryNextPendingProductPlans,
    activeProofCategoryNextPendingProgress,
    activeProofCategoryNextPendingReadyAfterTargetCount,
  ]);
  const activeProofCategoryNextPendingPlanCsv = useMemo(() => {
    const header = [
      "position",
      "preuve_cible",
      "rayon",
      "statut_apres_preuve_cible",
      "produit",
      "slug",
      "priorite",
      "preuves_suivantes",
      "reprise_admin",
      "garde_hold",
    ];

    if (!activeProofCategoryNextPendingEntry) {
      return [
        header,
        [
          "0",
          "aucune",
          "aucun",
          "file_couverte_localement",
          "aucun produit restant",
          "non disponible",
          "0",
          "non applicable",
          "non applicable",
          "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
        ],
      ]
        .map((row) => row.map(escapeDraftCsvCell).join(";"))
        .join("\n");
    }

    const rows =
      activeProofCategoryNextPendingProductPlans.length > 0
        ? activeProofCategoryNextPendingProductPlans.map((plan, index) => [
            index + 1,
            activeProofCategoryNextPendingEntry.proofLabel,
            activeProofCategoryNextPendingEntry.categoryLabel,
            plan.statusLabel,
            plan.product.name,
            plan.product.slug,
            plan.priority.score,
            plan.otherProofLabels.length > 0
              ? plan.otherProofLabels.join(", ")
              : "revue finale possible",
            `/admin/produits/${plan.product.slug}/modifier`,
            "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
          ])
        : [
            [
              "0",
              activeProofCategoryNextPendingEntry.proofLabel,
              activeProofCategoryNextPendingEntry.categoryLabel,
              "aucun produit restant",
              "aucun produit restant",
              "non disponible",
              "0",
              "non applicable",
              "non applicable",
              "HOLD maintenu jusqu'aux preuves exactes et validation Mouss",
            ],
          ];

    return [header, ...rows]
      .map((row) => row.map(escapeDraftCsvCell).join(";"))
      .join("\n");
  }, [
    activeProofCategoryNextPendingEntry,
    activeProofCategoryNextPendingProductPlans,
  ]);
  const activeProofCategoryNextPendingMoussReviewPlans = useMemo(
    () =>
      activeProofCategoryNextPendingProductPlans.filter(
        (plan) => plan.isReadyAfterTarget,
      ),
    [activeProofCategoryNextPendingProductPlans],
  );
  const activeProofCategoryNextPendingBlockedPlans = useMemo(
    () =>
      activeProofCategoryNextPendingProductPlans.filter(
        (plan) => !plan.isReadyAfterTarget,
      ),
    [activeProofCategoryNextPendingProductPlans],
  );
  const activeProofCategoryNextPendingMoussReviewText = useMemo(() => {
    if (!activeProofCategoryNextPendingEntry) {
      return [
        "Synthese revue Mouss prochain lot",
        "Aucun prochain lot en retard dans cette session.",
        "Aucune validation automatique: tous les produits restent en brouillon/HOLD.",
      ].join("\n");
    }

    return [
      "Synthese revue Mouss prochain lot",
      `Lot: ${activeProofCategoryNextPendingEntry.proofLabel} / ${activeProofCategoryNextPendingEntry.categoryLabel}`,
      `Preuve cible avant revue: ${activeProofCategoryNextPendingEntry.proofLabel}`,
      `Candidats a relire apres preuve cible: ${activeProofCategoryNextPendingMoussReviewPlans.length}`,
      `Encore bloques par preuves suivantes: ${activeProofCategoryNextPendingBlockedPlans.length}`,
      "Aucune validation automatique: HOLD maintenu jusqu'aux preuves exactes et validation humaine Mouss.",
      "",
      "Candidats a revue Mouss",
      ...(activeProofCategoryNextPendingMoussReviewPlans.length > 0
        ? activeProofCategoryNextPendingMoussReviewPlans
            .slice(0, 8)
            .map((plan, index) =>
              [
                `${index + 1}. ${plan.product.name}`,
                `Slug: ${plan.product.slug}`,
                `Priorite: ${plan.priority.score} - ${plan.priority.label}`,
                `Action: verifier preuve ${activeProofCategoryNextPendingEntry.proofLabel}, puis revue humaine Mouss uniquement.`,
              ].join("\n"),
            )
        : [
            "Aucun produit ne passe en revue finale apres cette preuve cible.",
          ]),
      "",
      "Encore bloques",
      ...(activeProofCategoryNextPendingBlockedPlans.length > 0
        ? activeProofCategoryNextPendingBlockedPlans.slice(0, 8).map(
            (plan, index) =>
              [
                `${index + 1}. ${plan.product.name}`,
                `Slug: ${plan.product.slug}`,
                `Blocages restants: ${plan.otherProofLabels.join(", ")}`,
              ].join("\n"),
          )
        : ["Aucun produit bloque apres cette preuve cible."]),
      "",
      "Action: traiter les candidats avec preuve exacte, puis demander validation Mouss; ne pas publier depuis cette synthese.",
    ].join("\n\n");
  }, [
    activeProofCategoryNextPendingBlockedPlans,
    activeProofCategoryNextPendingEntry,
    activeProofCategoryNextPendingMoussReviewPlans,
  ]);
  const activeProofCategoryFollowUpEntry =
    activeProofCategoryNextPendingEntry ?? activeProofCategoryNextEntry;
  useEffect(() => {
    if (!hasActiveProofCategoryQueue || !activeProofCategoryOpportunityId) {
      return undefined;
    }

    const panel = activeProofCategoryPanelRef.current;

    if (!panel) {
      return undefined;
    }

    const isMobile = window.matchMedia("(max-width: 1023px)").matches;

    if (!isMobile) {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const frameId = window.requestAnimationFrame(() => {
      panel.focus({ preventScroll: true });
      panel.scrollIntoView({
        block: "start",
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeProofCategoryOpportunityId, hasActiveProofCategoryQueue]);
  const selectProofCategoryQueueEntry = (
    entry: DraftProofCategoryQueueEntry,
  ) => {
    setProofFilter(entry.proofZoneId);
    setSearchQuery(entry.categoryId);
    setSelectedProductId(entry.topProductId ?? "");
    setActiveProofCategoryQueue(displayedProofCategoryQueue);
    setActiveProofCategoryOpportunityId(entry.id);
    setActiveProofCategoryExecutionChecked([]);
    setShowReadyCategoryOnly(false);
    setCompactView(false);
  };
  const filteredPriorityCount = useMemo(
    () =>
      filteredProducts.filter((product) => getDraftPriority(product).score > 0)
        .length,
    [filteredProducts],
  );
  const filteredReviewText = useMemo(
    () => buildDraftReviewText(filteredProducts),
    [filteredProducts],
  );
  const activeProofBatchZone = proofFilter === "all"
    ? filteredProofSummary.topZone?.id
    : proofFilter;
  const activeProofBatchProducts = useMemo(
    () => getDraftProofBatchProducts(filteredProducts, activeProofBatchZone),
    [activeProofBatchZone, filteredProducts],
  );
  const proofBatchCount = activeProofBatchProducts.length;
  const proofBatchTopProduct = activeProofBatchProducts[0];
  const proofBatchTopPriority = proofBatchTopProduct
    ? getDraftPriority(proofBatchTopProduct)
    : null;
  const proofBatchSecondarySummary = useMemo(
    () =>
      getDraftSecondaryProofSummary(
        activeProofBatchProducts,
        activeProofBatchZone,
      ).slice(0, 4),
    [activeProofBatchProducts, activeProofBatchZone],
  );
  const proofBatchCategoryAllSummary = useMemo(
    () =>
      getDraftProofBatchCategorySummary(
        activeProofBatchProducts,
        categoryNameById,
        activeProofBatchZone,
      ),
    [activeProofBatchProducts, activeProofBatchZone, categoryNameById],
  );
  const proofBatchReadyCategorySummary = useMemo(
    () =>
      proofBatchCategoryAllSummary.filter(
        (entry) => entry.count > 0 && entry.readyAfterZoneCount === entry.count,
      ),
    [proofBatchCategoryAllSummary],
  );
  const proofBatchReadyCategoryCount = proofBatchReadyCategorySummary.length;
  const proofBatchCategorySummary = useMemo(
    () =>
      (showReadyCategoryOnly
        ? proofBatchReadyCategorySummary
        : proofBatchCategoryAllSummary
      ).slice(0, 4),
    [
      proofBatchCategoryAllSummary,
      proofBatchReadyCategorySummary,
      showReadyCategoryOnly,
    ],
  );
  const proofBatchReadyCategoriesText = useMemo(
    () =>
      buildDraftReadyCategoriesText(
        activeProofBatchProducts,
        proofBatchReadyCategorySummary,
        categoryNameById,
        activeProofBatchZone,
      ),
    [
      activeProofBatchProducts,
      activeProofBatchZone,
      categoryNameById,
      proofBatchReadyCategorySummary,
    ],
  );
  const proofBatchTopCategory = proofBatchCategorySummary[0];
  const proofBatchTopCategoryText = useMemo(
    () =>
      buildDraftProofCategoryBatchText(
        activeProofBatchProducts,
        proofBatchTopCategory?.id,
        categoryNameById,
        activeProofBatchZone,
      ),
    [
      activeProofBatchProducts,
      activeProofBatchZone,
      categoryNameById,
      proofBatchTopCategory?.id,
    ],
  );
  const proofBatchReadyAfterZoneCount = useMemo(() => {
    if (!activeProofBatchZone) {
      return 0;
    }

    return activeProofBatchProducts.filter(
      (product) =>
        getDraftMissingProofs(product).filter(
          (proof) => proof.id !== activeProofBatchZone,
        ).length === 0,
    ).length;
  }, [activeProofBatchProducts, activeProofBatchZone]);
  const proofBatchText = useMemo(
    () => buildDraftProofBatchText(filteredProducts, activeProofBatchZone),
    [activeProofBatchZone, filteredProducts],
  );
  const highestPriorityProduct = useMemo(
    () =>
      [...filteredProducts].sort(
        (left, right) =>
          getDraftPriority(right).score - getDraftPriority(left).score,
      )[0],
    [filteredProducts],
  );
  const hasActiveDraftFilters =
    gateFilter !== "all" ||
    supplierFilter !== "all" ||
    priorityFilter !== "all" ||
    proofFilter !== "all" ||
    showReadyCategoryOnly ||
    hasActiveProofCategoryQueue ||
    searchQuery.trim().length > 0;
  const priorityQueue = useMemo(
    () =>
      [...filteredProducts]
        .map((product) => ({ product, priority: getDraftPriority(product) }))
        .sort((left, right) => right.priority.score - left.priority.score)
        .slice(0, 3),
    [filteredProducts],
  );
  const selectedProduct = useMemo(
    () =>
      filteredProducts.find((product) => product.id === selectedProductId) ??
      filteredProducts[0],
    [filteredProducts, selectedProductId],
  );
  const selectedPriority = selectedProduct
    ? getDraftPriority(selectedProduct)
    : null;
  const selectedValidation = selectedProduct
    ? getDraftValidationState(selectedProduct)
    : null;
  const selectedRemainingActions = selectedProduct
    ? getDraftReviewChecklist(selectedProduct)
        .filter((item) => !item.done)
        .map((item) => item.label)
    : [];
  const selectedReviewText = selectedProduct
    ? buildDraftReviewText([selectedProduct])
    : "Aucun brouillon selectionne avec les filtres actifs.";

  return (
    <section className="grid min-w-0 gap-4 overflow-x-hidden rounded-lg border border-line bg-paper p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-black uppercase text-teal">
            Brouillons partenaires
          </p>
          <h2 className="mt-2 text-2xl font-black">
            Produits à reprendre avant publication
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Vue passive des brouillons fournisseurs : statut, gate de validation
            et lien de reprise. Aucune publication ni commande fournisseur ici.
          </p>
        </div>
        <span className="rounded-md bg-[#f6f1e8] px-3 py-2 text-sm font-black text-muted">
          {products.length} brouillon(s)
        </span>
      </div>

      {products.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-4">
          <DraftMetric label="Gate complet" value={summary.gateComplete} />
          <DraftMetric label="Gate à reprendre" value={summary.gateIncomplete} />
          <DraftMetric label="Gate absent" value={summary.gateMissing} />
          <DraftMetric label="Lien fournisseur absent" value={summary.withoutSupplierLink} />
        </div>
      ) : null}

      {products.length > 0 ? (
        <div className="rounded-lg border border-line bg-[#fbfaf7] p-4">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
            <div>
              <p className="text-xs font-black uppercase text-teal">
                Preuves manquantes
              </p>
              <h3 className="mt-1 text-lg font-black">
                Zones a completer avant vente propre
              </h3>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-muted">
                Vue lecture seule: elle sert a choisir le prochain lot de preuves
                sans publier, sans commander et sans lever la validation humaine.
              </p>
            </div>
            <div className="rounded-md bg-paper px-3 py-2 text-sm font-black text-muted ring-1 ring-line">
              Zone dominante: {proofSummary.topZone?.label ?? "Aucune"}
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {proofSummary.entries.map((entry) => (
              <DraftProofMetric
                key={entry.id}
                label={entry.label}
                value={entry.count}
                total={products.length}
              />
            ))}
          </div>
        </div>
      ) : null}

      {products.length > 0 ? (
        <div className="grid gap-3 rounded-lg border border-line bg-[#fbfaf7] p-4">
          <div className="flex flex-col justify-between gap-2 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-black uppercase text-teal">
                Filtres passifs
              </p>
              <h3 className="mt-1 text-lg font-black">
                Affiner les brouillons à reprendre
              </h3>
              {selectedProduct ? (
                <>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-black">
                    <span className="rounded-md bg-paper px-2 py-1 text-muted ring-1 ring-line">
                      Sélection : {selectedProduct.name}
                    </span>
                    <span className="rounded-md bg-paper px-2 py-1 text-muted ring-1 ring-line">
                      {selectedProduct.slug}
                    </span>
                    {selectedValidation ? (
                      <span
                        className={`rounded-md px-2 py-1 ring-1 ${selectedValidation.className}`}
                      >
                        {selectedValidation.label}
                      </span>
                    ) : null}
                    {selectedPriority ? (
                      <span
                        className={`rounded-md px-2 py-1 ring-1 ${
                          selectedPriority.score > 0
                            ? "bg-[#fff7ed] text-[#9a3412] ring-[#fed7aa]"
                            : "bg-[#eef8f6] text-teal ring-[#bfe7df]"
                        }`}
                      >
                        Score {selectedPriority.score}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 max-w-3xl text-xs font-bold leading-5 text-muted">
                    Actions restantes :{" "}
                    {selectedRemainingActions.length
                      ? selectedRemainingActions.join(", ")
                      : "revue finale possible"}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs font-bold text-muted">
                  Sélection : aucun brouillon visible
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md bg-paper px-3 py-2 text-xs font-black text-muted ring-1 ring-line">
                {filteredProducts.length} / {products.length} visible(s)
              </span>
              <button
                type="button"
                disabled={filteredProducts.length === 0}
                onClick={() => {
                  setSelectedProductId(filteredProducts[0]?.id ?? "");
                  setCompactView(false);
                }}
                className="focus-ring min-h-9 rounded-md border border-line bg-paper px-3 text-xs font-black hover:bg-[#f1eadf] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Premier visible
              </button>
              <button
                type="button"
                disabled={!highestPriorityProduct}
                onClick={() => {
                  setSelectedProductId(highestPriorityProduct?.id ?? "");
                  setCompactView(false);
                }}
                className="focus-ring min-h-9 rounded-md border border-line bg-paper px-3 text-xs font-black hover:bg-[#f1eadf] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Plus prioritaire
              </button>
              <button
                type="button"
                disabled={!hasActiveDraftFilters}
                onClick={() => {
                  setGateFilter("all");
                  setSupplierFilter("all");
                  setPriorityFilter("all");
                  setProofFilter("all");
                  setShowReadyCategoryOnly(false);
                  setActiveProofCategoryQueue([]);
                  setActiveProofCategoryOpportunityId("");
                  setSearchQuery("");
                }}
                className="focus-ring min-h-9 rounded-md border border-line bg-paper px-3 text-xs font-black hover:bg-[#f1eadf] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Réinitialiser
              </button>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_150px_170px_160px_170px_160px]">
            <label className="grid gap-2 text-sm font-bold">
              Recherche
              <input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setActiveProofCategoryQueue([]);
                  setActiveProofCategoryOpportunityId("");
                }}
                className="focus-ring min-h-11 rounded-md border border-line bg-paper px-3 text-base"
                placeholder="Nom, slug, categorie, candidat..."
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Gate
              <select
                value={gateFilter}
                onChange={(event) =>
                  setGateFilter(event.target.value as DraftGateFilter)
                }
                className="focus-ring min-h-11 rounded-md border border-line bg-paper px-3 text-sm"
              >
                <option value="all">Tous</option>
                <option value="missing">Gate absent</option>
                <option value="incomplete">Gate incomplet</option>
                <option value="complete">Gate complet</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Fournisseur
              <select
                value={supplierFilter}
                onChange={(event) =>
                  setSupplierFilter(event.target.value as DraftSupplierFilter)
                }
                className="focus-ring min-h-11 rounded-md border border-line bg-paper px-3 text-sm"
              >
                <option value="all">Tous</option>
                <option value="without-link">Lien absent</option>
                <option value="with-link">Lien présent</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Priorité
              <select
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(event.target.value as DraftPriorityFilter)
                }
                className="focus-ring min-h-11 rounded-md border border-line bg-paper px-3 text-sm"
              >
                <option value="all">Toutes</option>
                <option value="urgent">À reprendre</option>
                <option value="ready">Revue finale</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Preuve
              <select
                value={proofFilter}
                onChange={(event) => {
                  setProofFilter(event.target.value as DraftProofFilter);
                  setShowReadyCategoryOnly(false);
                  setActiveProofCategoryQueue([]);
                  setActiveProofCategoryOpportunityId("");
                }}
                className="focus-ring min-h-11 rounded-md border border-line bg-paper px-3 text-sm"
              >
                <option value="all">Toutes</option>
                {proofSummary.entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Tri
              <select
                value={sortMode}
                onChange={(event) =>
                  setSortMode(event.target.value as DraftSortMode)
                }
                className="focus-ring min-h-11 rounded-md border border-line bg-paper px-3 text-sm"
              >
                <option value="priority-desc">Priorité haute</option>
                <option value="recent-gate">Gate récent</option>
                <option value="gate-state">Gate à finir</option>
                <option value="name-asc">Nom A-Z</option>
              </select>
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-5">
            <DraftMiniMetric label="Visibles" value={filteredProducts.length} />
            <DraftMiniMetric label="À reprendre" value={filteredPriorityCount} />
            <DraftMiniMetric label="Gate complet" value={filteredSummary.gateComplete} />
            <DraftMiniMetric label="Gate absent" value={filteredSummary.gateMissing} />
            <DraftMiniMetric label="Lien absent" value={filteredSummary.withoutSupplierLink} />
          </div>
          <div className="rounded-md border border-line bg-paper p-3">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-black uppercase text-muted">
                  Preuves visibles
                </p>
                <p className="mt-1 text-sm font-bold text-muted">
                  {filteredProofSummary.totalMissing} blocage(s) sur la selection
                  filtree.
                </p>
              </div>
              <span className="rounded-md bg-[#f6f1e8] px-3 py-2 text-xs font-black uppercase text-muted">
                Top: {filteredProofSummary.topZone?.label ?? "Aucun"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {filteredProofSummary.entries
                .filter((entry) => entry.count > 0)
                .slice(0, 8)
                .map((entry) => (
                  <button
                    key={`filtered-proof-${entry.id}`}
                    type="button"
                    onClick={() => {
                      setProofFilter(entry.id);
                      setShowReadyCategoryOnly(false);
                      setActiveProofCategoryQueue([]);
                      setActiveProofCategoryOpportunityId("");
                    }}
                    className="focus-ring rounded-md border border-line bg-[#fbfaf7] px-2 py-1 text-[11px] font-black uppercase text-muted hover:bg-[#f1eadf]"
                  >
                    {entry.label}: {entry.count}
                  </button>
                ))}
              {filteredProofSummary.totalMissing === 0 ? (
                <span className="rounded-md border border-[#bfe7df] bg-[#eef8f6] px-2 py-1 text-[11px] font-black uppercase text-teal">
                  Aucun blocage preuve sur la selection
                </span>
              ) : null}
            </div>
            {topProofOpportunity ? (
              <div className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                  <div>
                    <p className="text-xs font-black uppercase text-muted">
                      Prochaine preuve recommandee
                    </p>
                    <h4 className="mt-1 text-base font-black">
                      {topProofOpportunity.label}
                    </h4>
                    <p className="mt-1 text-xs font-bold leading-5 text-muted">
                      Zone la plus rentable de la selection: elle favorise les
                      fiches qui passent le plus vite en revue finale sans lever
                      le HOLD automatique.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-md px-2 py-1 text-[11px] font-black uppercase ring-1 ${topProofOpportunity.maturity.className}`}
                    >
                      {topProofOpportunity.maturity.label} -{" "}
                      {topProofOpportunity.maturity.percent}%
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setProofFilter(topProofOpportunity.id);
                        setShowReadyCategoryOnly(false);
                        setActiveProofCategoryQueue([]);
                        setActiveProofCategoryOpportunityId("");
                      }}
                      className="focus-ring rounded-md border border-line bg-paper px-3 py-2 text-xs font-black hover:bg-[#f1eadf]"
                    >
                      Filtrer cette preuve
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <DraftMiniMetric
                    label="Produits"
                    value={topProofOpportunity.count}
                  />
                  <DraftMiniMetric
                    label="Prets apres"
                    value={topProofOpportunity.readyAfterProofCount}
                  />
                  <DraftMiniMetric
                    label="Blocages lies"
                    value={topProofOpportunity.linkedBlockerCount}
                  />
                  <DraftMiniMetric
                    label="Priorite max"
                    value={Math.max(topProofOpportunity.topPriorityScore, 0)}
                  />
                </div>
                {topProofOpportunity.topProduct ? (
                  <p className="mt-3 rounded-md border border-line bg-paper p-3 text-xs font-bold leading-5 text-muted">
                    Prochain brouillon:{" "}
                    <span className="font-black text-foreground">
                      {topProofOpportunity.topProduct.name}
                    </span>{" "}
                    ({topProofOpportunity.topProduct.slug})
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {proofOpportunitySummary.slice(1).map((entry) => (
                    <button
                      key={`proof-opportunity-${entry.id}`}
                      type="button"
                      onClick={() => {
                        setProofFilter(entry.id);
                        setShowReadyCategoryOnly(false);
                        setActiveProofCategoryQueue([]);
                        setActiveProofCategoryOpportunityId("");
                      }}
                      className="focus-ring rounded-md border border-line bg-paper px-2 py-1 text-[11px] font-black uppercase text-muted hover:bg-[#f1eadf]"
                    >
                      Ensuite {entry.label}: {entry.count}
                    </button>
                  ))}
                </div>
                <details className="mt-3 rounded-md border border-line bg-paper p-3">
                  <summary className="cursor-pointer text-sm font-black">
                    Export preuve recommandee
                  </summary>
                  <textarea
                    readOnly
                    value={topProofOpportunityText}
                    rows={6}
                    className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                  />
                </details>
              </div>
            ) : null}
            {topProofCategoryOpportunity ? (
              <div className="mt-3 rounded-md border border-[#bfe7df] bg-[#eef8f6] p-3">
                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                  <div>
                    <p className="text-xs font-black uppercase text-teal">
                      Couple preuve + rayon
                    </p>
                    <h4 className="mt-1 text-base font-black">
                      {topProofCategoryOpportunity.proofLabel} -{" "}
                      {topProofCategoryOpportunity.categoryLabel}
                    </h4>
                    <p className="mt-1 text-xs font-bold leading-5 text-muted">
                      Prochain groupe le plus rapide a reprendre: une preuve,
                      un rayon, puis validation humaine avant toute sortie de
                      HOLD.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-md px-2 py-1 text-[11px] font-black uppercase ring-1 ${topProofCategoryOpportunity.maturity.className}`}
                    >
                      {topProofCategoryOpportunity.maturity.label} -{" "}
                      {topProofCategoryOpportunity.maturity.percent}%
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setProofFilter(topProofCategoryOpportunity.proofZoneId);
                        setSearchQuery(topProofCategoryOpportunity.categoryId);
                        setSelectedProductId(
                          topProofCategoryOpportunity.topProduct?.id ?? "",
                        );
                        setActiveProofCategoryQueue(currentProofCategoryQueue);
                        setActiveProofCategoryOpportunityId(
                          topProofCategoryQueueEntry?.id ??
                            topProofCategoryOpportunity.id,
                        );
                        setActiveProofCategoryExecutionChecked([]);
                        setShowReadyCategoryOnly(false);
                        setCompactView(false);
                      }}
                      className="focus-ring rounded-md border border-[#bfe7df] bg-paper px-3 py-2 text-xs font-black text-teal hover:bg-white"
                    >
                      Filtrer ce couple
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <DraftMiniMetric
                    label="Brouillons"
                    value={topProofCategoryOpportunity.count}
                  />
                  <DraftMiniMetric
                    label="Prets apres"
                    value={topProofCategoryOpportunity.readyAfterZoneCount}
                  />
                  <DraftMiniMetric
                    label="Blocages lies"
                    value={topProofCategoryOpportunity.linkedBlockerCount}
                  />
                  <DraftMiniMetric
                    label="Priorite max"
                    value={Math.max(
                      topProofCategoryOpportunity.topPriorityScore,
                      0,
                    )}
                  />
                </div>
                {hasActiveProofCategoryQueue && activeProofCategoryQueueEntry ? (
                  <div
                    ref={activeProofCategoryPanelRef}
                    id="dropshipping-active-proof-category-panel"
                    tabIndex={-1}
                    className="mt-3 scroll-mt-3 rounded-md border border-[#bfe7df] bg-paper p-3 focus:outline-none"
                  >
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-xs font-black uppercase text-teal">
                          File active
                        </p>
                        <p className="mt-1 text-xs font-bold leading-5 text-muted">
                          Actif: {activeProofCategoryQueueEntry.proofLabel} /{" "}
                          {activeProofCategoryQueueEntry.categoryLabel}. Les
                          autres cartes restent les prochains lots.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-md bg-[#eef8f6] px-3 py-2 text-[11px] font-black uppercase text-teal ring-1 ring-[#bfe7df] lg:hidden">
                          Position mobile
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveProofCategoryQueue([]);
                            setActiveProofCategoryOpportunityId("");
                            setActiveProofCategoryExecutionChecked([]);
                            setActiveProofCategoryLastHandledByEntry({});
                          }}
                          className="focus-ring rounded-md border border-[#bfe7df] bg-[#eef8f6] px-3 py-2 text-xs font-black text-teal hover:bg-white"
                        >
                          Revenir file dynamique
                        </button>
                      </div>
                    </div>
                    {displayedProofCategoryQueue.length > 1 ? (
                      <div className="mt-3 rounded-md border border-[#bfe7df] bg-[#eef8f6] p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs font-black uppercase text-teal">
                              Navigation lots
                            </p>
                            <p className="mt-1 text-xs font-bold leading-5 text-muted">
                              Lot {activeProofCategoryQueueIndex + 1}/
                              {displayedProofCategoryQueue.length}. Changement
                              local: la checklist repart a zero et le HOLD reste
                              actif.
                            </p>
                            <p className="mt-1 text-xs font-bold leading-5 text-teal">
                              Progression locale:{" "}
                              {activeProofCategoryLocalDoneCount}/
                              {activeProofCategoryLocalTotalCount} brouillon(s),{" "}
                              {activeProofCategoryLocalCompleteLotCount}/
                              {displayedProofCategoryQueue.length} lot(s)
                              couvert(s).
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:flex">
                            <button
                              type="button"
                              onClick={() => {
                                if (activeProofCategoryPreviousEntry) {
                                  selectProofCategoryQueueEntry(
                                    activeProofCategoryPreviousEntry,
                                  );
                                }
                              }}
                              className="focus-ring rounded-md border border-[#bfe7df] bg-paper px-3 py-2 text-xs font-black text-teal hover:bg-white"
                            >
                              Lot precedent
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (activeProofCategoryNextEntry) {
                                  selectProofCategoryQueueEntry(
                                    activeProofCategoryNextEntry,
                                  );
                                }
                              }}
                              className="focus-ring rounded-md bg-teal px-3 py-2 text-xs font-black text-white hover:bg-[#0b4f49]"
                            >
                              Lot suivant
                            </button>
                          </div>
                        </div>
                        {activeProofCategoryNextEntry ? (
                          <p className="mt-2 break-words text-xs font-bold leading-5 text-muted">
                            Prochain: {activeProofCategoryNextEntry.proofLabel} /{" "}
                            {activeProofCategoryNextEntry.categoryLabel}
                          </p>
                        ) : null}
                        {activeProofCategoryNextPendingEntry ? (
                          <div className="mt-3 rounded-md border border-teal bg-paper p-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-xs font-black uppercase text-teal">
                                  Prochain lot a faire
                                </p>
                                <p className="mt-1 break-words text-sm font-black">
                                  {
                                    activeProofCategoryNextPendingEntry.proofLabel
                                  }{" "}
                                  /{" "}
                                  {
                                    activeProofCategoryNextPendingEntry.categoryLabel
                                  }
                                </p>
                                <p className="mt-1 text-xs font-bold leading-5 text-muted">
                                  Local{" "}
                                  {activeProofCategoryNextPendingProgress
                                    ?.doneCount ?? 0}
                                  /
                                  {activeProofCategoryNextPendingProgress
                                    ?.totalCount ??
                                    activeProofCategoryNextPendingEntry.count}{" "}
                                  traite(s),{" "}
                                  {activeProofCategoryNextPendingProgress
                                    ?.pendingCount ??
                                    activeProofCategoryNextPendingEntry.count}{" "}
                                  a faire. HOLD maintenu.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  selectProofCategoryQueueEntry(
                                    activeProofCategoryNextPendingEntry,
                                  )
                                }
                                className="focus-ring inline-flex min-h-10 items-center justify-center rounded-md bg-teal px-3 text-xs font-black uppercase text-white hover:bg-[#0b4f49]"
                              >
                                Ouvrir lot a faire
                              </button>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-5">
                              <DraftMiniMetric
                                label="Brouillons"
                                value={activeProofCategoryNextPendingEntry.count}
                              />
                              <DraftMiniMetric
                                label="A traiter"
                                value={
                                  activeProofCategoryNextPendingProductPlans.length
                                }
                              />
                              <DraftMiniMetric
                                label="A verifier"
                                value={
                                  activeProofCategoryNextPendingReadyAfterTargetCount
                                }
                              />
                              <DraftMiniMetric
                                label="Encore bloques"
                                value={
                                  activeProofCategoryNextPendingBlockedAfterTargetCount
                                }
                              />
                              <DraftMiniMetric
                                label="Blocages"
                                value={
                                  activeProofCategoryNextPendingEntry.linkedBlockerCount
                                }
                              />
                            </div>
                            <div className="mt-3 rounded-md border border-[#bfe7df] bg-[#eef8f6] p-3">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <p className="text-xs font-black uppercase text-teal">
                                    Synthese revue Mouss
                                  </p>
                                  <p className="mt-1 text-xs font-bold leading-5 text-muted">
                                    Apres preuve cible:{" "}
                                    {
                                      activeProofCategoryNextPendingMoussReviewPlans.length
                                    }{" "}
                                    candidat(s) a relire,{" "}
                                    {
                                      activeProofCategoryNextPendingBlockedPlans.length
                                    }{" "}
                                    encore bloque(s). HOLD maintenu.
                                  </p>
                                </div>
                                <span className="rounded-md bg-paper px-2 py-1 text-[11px] font-black uppercase text-[#9a3412] ring-1 ring-[#fed7aa]">
                                  Aucune validation auto
                                </span>
                              </div>
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                <DraftMiniMetric
                                  label="Revue Mouss"
                                  value={
                                    activeProofCategoryNextPendingMoussReviewPlans.length
                                  }
                                />
                                <DraftMiniMetric
                                  label="Restent bloques"
                                  value={
                                    activeProofCategoryNextPendingBlockedPlans.length
                                  }
                                />
                              </div>
                              {activeProofCategoryNextPendingMoussReviewPlans.length >
                              0 ? (
                                <div className="mt-3 grid gap-2">
                                  {activeProofCategoryNextPendingMoussReviewPlans
                                    .slice(0, 3)
                                    .map((plan, index) => (
                                      <div
                                        key={`next-pending-mouss-review-${plan.product.slug}`}
                                        className="rounded-md border border-[#bfe7df] bg-paper p-3"
                                      >
                                        <p className="text-[11px] font-black uppercase text-teal">
                                          #{index + 1} candidat revue Mouss
                                        </p>
                                        <p className="mt-1 break-words text-sm font-black">
                                          {plan.product.name}
                                        </p>
                                        <p className="mt-1 break-words font-mono text-[11px] font-bold text-muted">
                                          {plan.product.slug}
                                        </p>
                                        <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                          Revue humaine uniquement apres preuve
                                          exacte. Aucun retrait du HOLD depuis
                                          ce cockpit.
                                        </p>
                                      </div>
                                    ))}
                                </div>
                              ) : (
                                <p className="mt-3 rounded-md border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-xs font-bold leading-5 text-[#9a3412]">
                                  Aucun candidat en revue Mouss apres cette
                                  preuve cible: poursuivre les preuves
                                  suivantes.
                                </p>
                              )}
                            </div>
                            {activeProofCategoryNextPendingPreviewPlans.length > 0 ? (
                              <div className="mt-3 rounded-md border border-[#bfe7df] bg-[#eef8f6] p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs font-black uppercase text-teal">
                                    Plan produits prochain lot
                                  </p>
                                  <span className="rounded-md bg-paper px-2 py-1 text-[11px] font-black uppercase text-teal ring-1 ring-[#bfe7df]">
                                    {
                                      activeProofCategoryNextPendingProductPlans.length
                                    }{" "}
                                    a traiter
                                  </span>
                                </div>
                                <div className="mt-3 grid gap-2">
                                  {activeProofCategoryNextPendingPreviewPlans.map(
                                    (plan, index) => {
                                      return (
                                        <div
                                          key={`next-pending-product-plan-${plan.product.slug}`}
                                          className="rounded-md border border-[#bfe7df] bg-paper p-3"
                                        >
                                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                              <p className="text-[11px] font-black uppercase text-teal">
                                                #{index + 1} preuve cible:{" "}
                                                {
                                                  activeProofCategoryNextPendingEntry.proofLabel
                                                }
                                              </p>
                                              <p className="mt-1 break-words text-sm font-black">
                                                {plan.product.name}
                                              </p>
                                              <p className="mt-1 break-words font-mono text-[11px] font-bold text-muted">
                                                {plan.product.slug}
                                              </p>
                                            </div>
                                            <span
                                              className={`rounded-md px-2 py-1 text-[11px] font-black uppercase ring-1 ${
                                                plan.isReadyAfterTarget
                                                  ? "bg-[#eef8f6] text-teal ring-[#bfe7df]"
                                                  : "bg-[#fff7ed] text-[#9a3412] ring-[#fed7aa]"
                                              }`}
                                            >
                                              {plan.statusLabel}
                                            </span>
                                          </div>
                                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-black uppercase">
                                            <span className="rounded-md bg-[#f6f1e8] px-2 py-1 text-muted ring-1 ring-line">
                                              Score {plan.priority.score}
                                            </span>
                                            <span className="rounded-md bg-[#fff7ed] px-2 py-1 text-[#9a3412] ring-1 ring-[#fed7aa]">
                                              HOLD actif
                                            </span>
                                          </div>
                                          <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                            Puis:{" "}
                                            {plan.otherProofLabels.length > 0
                                              ? plan.otherProofLabels
                                                  .slice(0, 3)
                                                  .join(", ")
                                              : "revue finale possible"}
                                          </p>
                                          <Link
                                            href={`/admin/produits/${plan.product.slug}/modifier`}
                                            className="focus-ring mt-3 inline-flex min-h-9 items-center justify-center rounded-md border border-[#bfe7df] bg-[#eef8f6] px-3 text-xs font-black text-teal hover:bg-white"
                                          >
                                            Fiche admin
                                          </Link>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                                {activeProofCategoryNextPendingRemainingProductCount >
                                0 ? (
                                  <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                    +{" "}
                                    {
                                      activeProofCategoryNextPendingRemainingProductCount
                                    }{" "}
                                    autre(s) produit(s) dans l&apos;export du
                                    plan.
                                  </p>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="mt-3 rounded-md border border-[#bfe7df] bg-paper p-3">
                            <p className="text-xs font-black uppercase text-teal">
                              File couverte localement
                            </p>
                            <p className="mt-1 text-xs font-bold leading-5 text-muted">
                              Aucun prochain lot en retard dans cette session.
                              Les produits restent en brouillon/HOLD jusqu&apos;aux
                              preuves exactes et a la validation Mouss.
                            </p>
                          </div>
                        )}
                        <div className="mt-3 rounded-md border border-[#bfe7df] bg-paper p-3">
                          <div className="flex flex-col gap-1">
                            <p className="text-xs font-black uppercase text-teal">
                              Resume file active
                            </p>
                            <p className="text-xs font-bold leading-5 text-muted">
                              Les 3 lots restent en brouillon/HOLD: ce resume
                              sert uniquement a enchainer la reprise.
                            </p>
                          </div>
                          <div className="mt-3 rounded-md border border-[#bfe7df] bg-[#eef8f6] p-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-xs font-black uppercase text-teal">
                                  Revue Mouss file active
                                </p>
                                <p className="mt-1 text-xs font-bold leading-5 text-muted">
                                  Vue globale des lots avec candidats a relire
                                  apres preuve cible. HOLD maintenu, aucune
                                  validation automatique.
                                </p>
                              </div>
                              <span className="rounded-md bg-paper px-2 py-1 text-[11px] font-black uppercase text-[#9a3412] ring-1 ring-[#fed7aa]">
                                Admin local
                              </span>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                              <DraftMiniMetric
                                label="Lots candidats"
                                value={activeProofCategoryMoussReviewLotCount}
                              />
                              <DraftMiniMetric
                                label="Revue Mouss"
                                value={
                                  activeProofCategoryMoussReviewCandidateCount
                                }
                              />
                              <DraftMiniMetric
                                label="Encore bloques"
                                value={activeProofCategoryMoussReviewBlockedCount}
                              />
                            </div>
                            {activeProofCategoryMoussReviewTopRow ? (
                              <div className="mt-3 rounded-md border border-teal bg-paper p-3">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="min-w-0">
                                    <p className="text-xs font-black uppercase text-teal">
                                      Lot prioritaire maintenant
                                    </p>
                                    <p className="mt-1 break-words text-sm font-black">
                                      {
                                        activeProofCategoryMoussReviewTopRow.entry
                                          .proofLabel
                                      }{" "}
                                      /{" "}
                                      {
                                        activeProofCategoryMoussReviewTopRow.entry
                                          .categoryLabel
                                      }
                                    </p>
                                    <p className="mt-1 text-xs font-bold leading-5 text-muted">
                                      {
                                        activeProofCategoryMoussReviewTopRow.readyCount
                                      }{" "}
                                      candidat(s) revue Mouss,{" "}
                                      {
                                        activeProofCategoryMoussReviewTopRow.blockedCount
                                      }{" "}
                                      encore bloque(s). HOLD maintenu.
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      selectProofCategoryQueueEntry(
                                        activeProofCategoryMoussReviewTopRow.entry,
                                      )
                                    }
                                    className="focus-ring inline-flex min-h-10 items-center justify-center rounded-md bg-teal px-3 text-xs font-black uppercase text-white hover:bg-[#0b4f49]"
                                  >
                                    Ouvrir lot prioritaire
                                  </button>
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                                  <DraftMiniMetric
                                    label="Dossier"
                                    value={
                                      activeProofCategoryMoussPriorityPlans.length
                                    }
                                  />
                                  <DraftMiniMetric
                                    label="Prets revue"
                                    value={
                                      activeProofCategoryMoussPriorityReadyCount
                                    }
                                  />
                                  <DraftMiniMetric
                                    label="Encore bloques"
                                    value={
                                      activeProofCategoryMoussPriorityBlockedCount
                                    }
                                  />
                                  <DraftMiniMetric
                                    label="Cochees"
                                    value={
                                      activeProofCategoryMoussPriorityCheckedCount
                                    }
                                  />
                                </div>
                                <div className="mt-3 rounded-md border border-[#bfe7df] bg-[#eef8f6] p-3">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs font-black uppercase text-teal">
                                      Checklist session dossier prioritaire
                                    </p>
                                    <span className="rounded-md bg-paper px-2 py-1 text-[11px] font-black uppercase text-teal ring-1 ring-[#bfe7df]">
                                      {
                                        activeProofCategoryMoussPriorityCheckedPercent
                                      }
                                      %
                                    </span>
                                  </div>
                                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper ring-1 ring-[#bfe7df]">
                                    <span
                                      className="block h-full rounded-full bg-teal"
                                      style={{
                                        width: `${activeProofCategoryMoussPriorityCheckedPercent}%`,
                                      }}
                                    />
                                  </div>
                                  <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                    {
                                      activeProofCategoryMoussPriorityCheckedCount
                                    }
                                    /
                                    {
                                      activeProofCategoryMoussPriorityPlans.length
                                    }{" "}
                                    coche(s),{" "}
                                    {
                                      activeProofCategoryMoussPriorityUncheckedCount
                                    }{" "}
                                    a continuer. Session locale uniquement.
                                  </p>
                                  <button
                                    type="button"
                                    disabled={
                                      !activeProofCategoryMoussPriorityEntryId ||
                                      activeProofCategoryMoussPriorityCheckedCount ===
                                        0
                                    }
                                    onClick={() =>
                                      setActiveProofCategoryMoussPriorityCheckedByEntry(
                                        (current) => ({
                                          ...current,
                                          [activeProofCategoryMoussPriorityEntryId]:
                                            [],
                                        }),
                                      )
                                    }
                                    className="focus-ring mt-3 rounded-md border border-[#bfe7df] bg-paper px-3 py-2 text-xs font-black uppercase text-teal hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Vider checklist dossier
                                  </button>
                                </div>
                                <div className="mt-3 grid gap-2 md:grid-cols-2">
                                  {activeProofCategoryMoussPriorityPreviewPlans
                                    .length > 0 ? (
                                    activeProofCategoryMoussPriorityPreviewPlans.map(
                                      (plan, index) => (
                                        <div
                                          key={`active-proof-category-mouss-priority-product-${plan.product.slug}`}
                                          className="rounded-md border border-[#bfe7df] bg-[#eef8f6] p-3"
                                        >
                                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                              <p className="text-[11px] font-black uppercase text-teal">
                                                #{index + 1} dossier prioritaire
                                              </p>
                                              <p className="mt-1 break-words text-sm font-black">
                                                {plan.product.name}
                                              </p>
                                              <p className="mt-1 break-words font-mono text-[11px] font-bold text-muted">
                                                {plan.product.slug}
                                              </p>
                                            </div>
                                            <span
                                              className={`rounded-md px-2 py-1 text-[11px] font-black uppercase ring-1 ${
                                                plan.isReadyAfterTarget
                                                  ? "bg-paper text-teal ring-[#bfe7df]"
                                                  : "bg-[#fff7ed] text-[#9a3412] ring-[#fed7aa]"
                                              }`}
                                            >
                                              {plan.statusLabel}
                                            </span>
                                          </div>
                                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-black uppercase">
                                            <span className="rounded-md bg-paper px-2 py-1 text-muted ring-1 ring-line">
                                              Score {plan.priority.score}
                                            </span>
                                            <span className="rounded-md bg-[#fff7ed] px-2 py-1 text-[#9a3412] ring-1 ring-[#fed7aa]">
                                              HOLD actif
                                            </span>
                                          </div>
                                          <label className="mt-3 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-md border border-[#bfe7df] bg-paper px-3 py-2 text-xs font-bold leading-5 text-muted">
                                            <input
                                              type="checkbox"
                                              checked={activeProofCategoryMoussPriorityCheckedSlugs.has(
                                                plan.product.slug,
                                              )}
                                              onChange={(event) => {
                                                if (
                                                  !activeProofCategoryMoussPriorityEntryId
                                                ) {
                                                  return;
                                                }

                                                setActiveProofCategoryMoussPriorityCheckedByEntry(
                                                  (current) => {
                                                    const previous =
                                                      current[
                                                        activeProofCategoryMoussPriorityEntryId
                                                      ] ?? [];
                                                    const nextSlugs = event.target
                                                      .checked
                                                      ? Array.from(
                                                          new Set([
                                                            ...previous,
                                                            plan.product.slug,
                                                          ]),
                                                        )
                                                      : previous.filter(
                                                          (slug) =>
                                                            slug !==
                                                            plan.product.slug,
                                                        );

                                                    return {
                                                      ...current,
                                                      [activeProofCategoryMoussPriorityEntryId]:
                                                        nextSlugs,
                                                    };
                                                  },
                                                );
                                              }}
                                              className="mt-1 h-4 w-4 accent-teal"
                                            />
                                            <span className="min-w-0 break-words">
                                              Preuve cible cochee localement,
                                              HOLD maintenu
                                            </span>
                                          </label>
                                          <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                            Puis:{" "}
                                            {plan.otherProofLabels.length > 0
                                              ? plan.otherProofLabels
                                                  .slice(0, 3)
                                                  .join(", ")
                                              : "revue Mouss possible"}
                                          </p>
                                          <Link
                                            href={`/admin/produits/${plan.product.slug}/modifier`}
                                            className="focus-ring mt-3 inline-flex min-h-9 items-center justify-center rounded-md border border-[#bfe7df] bg-paper px-3 text-xs font-black text-teal hover:bg-white"
                                          >
                                            Fiche admin
                                          </Link>
                                        </div>
                                      ),
                                    )
                                  ) : (
                                    <p className="rounded-md border border-[#bfe7df] bg-[#eef8f6] p-3 text-xs font-bold leading-5 text-muted md:col-span-2">
                                      Aucun produit restant dans le dossier
                                      prioritaire. HOLD maintenu.
                                    </p>
                                  )}
                                </div>
                                {activeProofCategoryMoussPriorityRemainingCount >
                                0 ? (
                                  <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                    +{" "}
                                    {
                                      activeProofCategoryMoussPriorityRemainingCount
                                    }{" "}
                                    autre(s) produit(s) dans les exports du
                                    dossier.
                                  </p>
                                ) : null}
                                <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                                  <summary className="cursor-pointer text-sm font-black">
                                    Export dossier prioritaire Mouss
                                  </summary>
                                  <textarea
                                    readOnly
                                    value={activeProofCategoryMoussPriorityText}
                                    rows={8}
                                    className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                                  />
                                </details>
                                <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                                  <summary className="cursor-pointer text-sm font-black">
                                    Export CSV dossier prioritaire Mouss
                                  </summary>
                                  <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                    CSV interne produit par produit: reprise,
                                    preuves restantes et HOLD maintenu.
                                  </p>
                                  <textarea
                                    readOnly
                                    value={activeProofCategoryMoussPriorityCsv}
                                    rows={7}
                                    className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                                  />
                                </details>
                              </div>
                            ) : null}
                            <div className="mt-3 rounded-md border border-[#bfe7df] bg-paper p-3">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <p className="text-xs font-black uppercase text-teal">
                                    Prochaines actions Mouss
                                  </p>
                                  <p className="mt-1 text-xs font-bold leading-5 text-muted">
                                    Synthese multi-lots de la session: ce qui
                                    est coche, ce qui reste a traiter et ce qui
                                    peut passer en revue Mouss. HOLD maintenu.
                                  </p>
                                </div>
                                <span className="rounded-md bg-[#fff7ed] px-2 py-1 text-[11px] font-black uppercase text-[#9a3412] ring-1 ring-[#fed7aa]">
                                  Brouillons uniquement
                                </span>
                              </div>
                              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                                <DraftMiniMetric
                                  label="Cochees"
                                  value={
                                    activeProofCategoryMoussActionCheckedTotal
                                  }
                                />
                                <DraftMiniMetric
                                  label="A traiter"
                                  value={
                                    activeProofCategoryMoussActionPendingTotal
                                  }
                                />
                                <DraftMiniMetric
                                  label="Revue Mouss"
                                  value={
                                    activeProofCategoryMoussActionReadyTotal
                                  }
                                />
                                <DraftMiniMetric
                                  label="Encore bloques"
                                  value={
                                    activeProofCategoryMoussActionBlockedTotal
                                  }
                                />
                              </div>
                              <div className="mt-3 rounded-md border border-teal bg-[#eef8f6] p-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <p className="text-xs font-black uppercase text-teal">
                                      Passerelle revue Mouss
                                    </p>
                                    <p className="mt-1 text-xs font-bold leading-5 text-muted">
                                      File humaine des candidats qui peuvent
                                      etre relus apres preuve cible. Elle ne
                                      publie rien et garde le HOLD actif.
                                    </p>
                                  </div>
                                  <span className="rounded-md bg-paper px-2 py-1 text-[11px] font-black uppercase text-teal ring-1 ring-[#bfe7df]">
                                    Decision humaine
                                  </span>
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                                  <DraftMiniMetric
                                    label="Prets revue"
                                    value={
                                      activeProofCategoryMoussHandoffReadyPlans.length
                                    }
                                  />
                                  <DraftMiniMetric
                                    label="Coches prets"
                                    value={
                                      activeProofCategoryMoussHandoffCheckedReadyCount
                                    }
                                  />
                                  <DraftMiniMetric
                                    label="A confirmer"
                                    value={
                                      activeProofCategoryMoussHandoffUncheckedReadyCount
                                    }
                                  />
                                  <DraftMiniMetric
                                    label="Coches bloques"
                                    value={
                                      activeProofCategoryMoussHandoffCheckedBlockedCount
                                    }
                                  />
                                </div>
                                <div className="mt-3 rounded-md border border-[#bfe7df] bg-paper p-3">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs font-black uppercase text-teal">
                                      Decisions session Mouss
                                    </p>
                                    <button
                                      type="button"
                                      disabled={
                                        activeProofCategoryMoussDecisionTouchedCount ===
                                        0
                                      }
                                      onClick={() =>
                                        setActiveProofCategoryMoussDecisionByProduct(
                                          {},
                                        )
                                      }
                                      className="focus-ring rounded-md border border-[#bfe7df] bg-[#eef8f6] px-3 py-2 text-xs font-black text-teal hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Reinitialiser decisions
                                    </button>
                                  </div>
                                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                                    <DraftMiniMetric
                                      label="Session"
                                      value={
                                        activeProofCategoryMoussDecisionTouchedCount
                                      }
                                    />
                                    <DraftMiniMetric
                                      label="HOLD"
                                      value={
                                        activeProofCategoryMoussDecisionHoldCount
                                      }
                                    />
                                    <DraftMiniMetric
                                      label="A revoir"
                                      value={
                                        activeProofCategoryMoussDecisionReviewCount
                                      }
                                    />
                                    <DraftMiniMetric
                                      label="Dossier pret"
                                      value={
                                        activeProofCategoryMoussDecisionReadyCount
                                      }
                                    />
                                  </div>
                                </div>
                                <div className="mt-3 rounded-md border border-[#bfe7df] bg-[#fbfaf7] p-3">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                      <p className="text-xs font-black uppercase text-teal">
                                        Dossier final revue Mouss
                                      </p>
                                      <p className="mt-1 text-xs font-bold leading-5 text-muted">
                                        Regroupe uniquement les candidats
                                        marques Dossier pret Mouss dans cette
                                        session. HOLD maintenu, aucune
                                        publication.
                                      </p>
                                    </div>
                                    <span className="rounded-md bg-paper px-2 py-1 text-[11px] font-black uppercase text-teal ring-1 ring-[#bfe7df]">
                                      Export local
                                    </span>
                                  </div>
                                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                                    <DraftMiniMetric
                                      label="Dossier pret"
                                      value={
                                        activeProofCategoryMoussReadyDossierPlans.length
                                      }
                                    />
                                    <DraftMiniMetric
                                      label="Coches"
                                      value={
                                        activeProofCategoryMoussReadyDossierCheckedCount
                                      }
                                    />
                                    <DraftMiniMetric
                                      label="A confirmer"
                                      value={
                                        activeProofCategoryMoussReadyDossierPendingSessionCount
                                      }
                                    />
                                    <DraftMiniMetric
                                      label="Check final"
                                      value={
                                        activeProofCategoryMoussFinalChecklistCheckedCount
                                      }
                                    />
                                  </div>
                                  {activeProofCategoryMoussFinalLotRows.length >
                                  0 ? (
                                    <div className="mt-3 rounded-md border border-[#bfe7df] bg-paper p-3">
                                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                          <p className="text-xs font-black uppercase text-teal">
                                            Synthese inter-lots checklist
                                          </p>
                                          <p className="mt-1 text-xs font-bold leading-5 text-muted">
                                            {
                                              activeProofCategoryMoussFinalLotCompleteCount
                                            }{" "}
                                            lot(s) complet(s),{" "}
                                            {
                                              activeProofCategoryMoussFinalLotIncompleteCount
                                            }{" "}
                                            lot(s) encore incomplet(s). Revue
                                            locale uniquement, HOLD maintenu.
                                          </p>
                                        </div>
                                        <span className="rounded-md bg-[#fff7ed] px-2 py-1 text-[11px] font-black uppercase text-[#9a3412] ring-1 ring-[#fed7aa]">
                                          Aucun retrait HOLD
                                        </span>
                                      </div>
                                      <div className="mt-3 grid gap-2 sm:grid-cols-4">
                                        <DraftMiniMetric
                                          label="Lots"
                                          value={
                                            activeProofCategoryMoussFinalLotRows.length
                                          }
                                        />
                                        <DraftMiniMetric
                                          label="Lots complets"
                                          value={
                                            activeProofCategoryMoussFinalLotCompleteCount
                                          }
                                        />
                                        <DraftMiniMetric
                                          label="Lots incomplets"
                                          value={
                                            activeProofCategoryMoussFinalLotIncompleteCount
                                          }
                                        />
                                        <DraftMiniMetric
                                          label="Cases"
                                          value={
                                            activeProofCategoryMoussFinalChecklistCheckedCount
                                          }
                                        />
                                      </div>
                                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                                        {activeProofCategoryMoussFinalLotPreviewRows.map(
                                          (row) => (
                                            <div
                                              key={`active-proof-category-mouss-final-lot-${row.id}`}
                                              className="rounded-md border border-line bg-[#fbfaf7] p-3"
                                            >
                                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                  <p className="text-[11px] font-black uppercase text-teal">
                                                    {row.proofLabel}
                                                  </p>
                                                  <p className="mt-1 break-words text-sm font-black">
                                                    {row.categoryLabel}
                                                  </p>
                                                </div>
                                                <span
                                                  className={`rounded-md px-2 py-1 text-[11px] font-black uppercase ring-1 ${
                                                    row.pendingCount === 0
                                                      ? "bg-[#eef8f6] text-teal ring-[#bfe7df]"
                                                      : "bg-[#fff7ed] text-[#9a3412] ring-[#fed7aa]"
                                                  }`}
                                                >
                                                  {row.pendingCount === 0
                                                    ? "Complet local"
                                                    : `${row.pendingCount} incomplet(s)`}
                                                </span>
                                              </div>
                                              <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                                {row.completeCount}/
                                                {row.readyCount} dossier(s)
                                                complet(s), {row.checkedCount}/
                                                {row.totalCount} case(s)
                                                cochee(s).
                                              </p>
                                              <p className="mt-2 break-words text-xs font-bold leading-5 text-muted">
                                                Exemple: {row.topProductName}
                                              </p>
                                            </div>
                                          ),
                                        )}
                                      </div>
                                      {activeProofCategoryMoussFinalLotRemainingPreviewCount >
                                      0 ? (
                                        <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                          +{" "}
                                          {
                                            activeProofCategoryMoussFinalLotRemainingPreviewCount
                                          }{" "}
                                          lot(s) supplementaire(s) dans les
                                          exports inter-lots.
                                        </p>
                                      ) : null}
                                      {activeProofCategoryMoussFinalLotPriorityRows.length >
                                      0 ? (
                                        <div className="mt-3 rounded-md border border-[#fed7aa] bg-[#fff7ed] p-3">
                                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                              <p className="text-xs font-black uppercase text-[#9a3412]">
                                                Priorite lots incomplets
                                              </p>
                                              <p className="mt-1 text-xs font-bold leading-5 text-muted">
                                                Lot le plus rapide:{" "}
                                                {
                                                  activeProofCategoryMoussFinalLotPriorityTopRow?.proofLabel
                                                }{" "}
                                                /{" "}
                                                {
                                                  activeProofCategoryMoussFinalLotPriorityTopRow?.categoryLabel
                                                }
                                                .{" "}
                                                {
                                                  activeProofCategoryMoussFinalLotPriorityMissingTotal
                                                }{" "}
                                                case(s) restante(s) sur les lots
                                                incomplets.
                                              </p>
                                            </div>
                                            <span className="rounded-md bg-paper px-2 py-1 text-[11px] font-black uppercase text-[#9a3412] ring-1 ring-[#fed7aa]">
                                              A finir d&apos;abord
                                            </span>
                                          </div>
                                          <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                            <DraftMiniMetric
                                              label="Lots a finir"
                                              value={
                                                activeProofCategoryMoussFinalLotPriorityRows.length
                                              }
                                            />
                                            <DraftMiniMetric
                                              label="Cases restantes"
                                              value={
                                                activeProofCategoryMoussFinalLotPriorityMissingTotal
                                              }
                                            />
                                            <DraftMiniMetric
                                              label="Top progression"
                                              value={
                                                activeProofCategoryMoussFinalLotPriorityTopRow?.completionPercent ??
                                                0
                                              }
                                            />
                                          </div>
                                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                                            {activeProofCategoryMoussFinalLotPriorityPreviewRows.map(
                                              (row, index) => (
                                                <div
                                                  key={`active-proof-category-mouss-final-lot-priority-${row.id}`}
                                                  className="rounded-md border border-[#fed7aa] bg-paper p-3"
                                                >
                                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="min-w-0">
                                                      <p className="text-[11px] font-black uppercase text-[#9a3412]">
                                                        #{index + 1} lot rapide
                                                      </p>
                                                      <p className="mt-1 break-words text-sm font-black">
                                                        {row.proofLabel} /{" "}
                                                        {row.categoryLabel}
                                                      </p>
                                                    </div>
                                                    <span className="rounded-md bg-[#fff7ed] px-2 py-1 text-[11px] font-black uppercase text-[#9a3412] ring-1 ring-[#fed7aa]">
                                                      {
                                                        row.missingChecklistCount
                                                      }{" "}
                                                      case(s)
                                                    </span>
                                                  </div>
                                                  <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                                    {row.completionPercent}% de
                                                    progression,{" "}
                                                    {row.pendingCount} dossier(s)
                                                    incomplet(s).
                                                  </p>
                                                  <p className="mt-2 break-words text-xs font-bold leading-5 text-muted">
                                                    Exemple:{" "}
                                                    {row.topProductName}
                                                  </p>
                                                </div>
                                              ),
                                            )}
                                          </div>
                                          {activeProofCategoryMoussFinalLotPriorityRemainingPreviewCount >
                                          0 ? (
                                            <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                              +{" "}
                                              {
                                                activeProofCategoryMoussFinalLotPriorityRemainingPreviewCount
                                              }{" "}
                                              lot(s) incomplet(s)
                                              supplementaire(s) dans les exports.
                                            </p>
                                          ) : null}
                                          {activeProofCategoryMoussFinalLotWorkOrderTopRow ? (
                                            <div className="mt-3 rounded-md border border-[#bfe7df] bg-paper p-3">
                                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                  <p className="text-xs font-black uppercase text-teal">
                                                    Ordre de travail lot
                                                    prioritaire
                                                  </p>
                                                  <p className="mt-1 break-words text-sm font-black">
                                                    {
                                                      activeProofCategoryMoussFinalLotWorkOrderTopRow.productName
                                                    }
                                                  </p>
                                                  <p className="mt-1 break-words font-mono text-[11px] font-bold text-muted">
                                                    /admin/produits/
                                                    {
                                                      activeProofCategoryMoussFinalLotWorkOrderTopRow.productSlug
                                                    }
                                                    /modifier
                                                  </p>
                                                </div>
                                                <span className="rounded-md bg-[#eef8f6] px-2 py-1 text-[11px] font-black uppercase text-teal ring-1 ring-[#bfe7df]">
                                                  A traiter maintenant
                                                </span>
                                              </div>
                                              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                                <DraftMiniMetric
                                                  label="Produits du lot"
                                                  value={
                                                    activeProofCategoryMoussFinalLotWorkOrderRows.length
                                                  }
                                                />
                                                <DraftMiniMetric
                                                  label="Cases a finir"
                                                  value={
                                                    activeProofCategoryMoussFinalLotWorkOrderMissingTotal
                                                  }
                                                />
                                                <DraftMiniMetric
                                                  label="Premier reste"
                                                  value={
                                                    activeProofCategoryMoussFinalLotWorkOrderTopRow.missingCount
                                                  }
                                                />
                                              </div>
                                              <div className="mt-3 grid gap-2 md:grid-cols-2">
                                                {activeProofCategoryMoussFinalLotWorkOrderPreviewRows.map(
                                                  (row, index) => (
                                                    <div
                                                      key={`active-proof-category-mouss-final-lot-work-order-${row.productSlug}`}
                                                      className="rounded-md border border-line bg-[#fbfaf7] p-3"
                                                    >
                                                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                        <div className="min-w-0">
                                                          <p className="text-[11px] font-black uppercase text-teal">
                                                            #{index + 1} fiche
                                                            a finir
                                                          </p>
                                                          <p className="mt-1 break-words text-sm font-black">
                                                            {row.productName}
                                                          </p>
                                                        </div>
                                                        <span className="rounded-md bg-[#fff7ed] px-2 py-1 text-[11px] font-black uppercase text-[#9a3412] ring-1 ring-[#fed7aa]">
                                                          {row.missingCount}{" "}
                                                          case(s)
                                                        </span>
                                                      </div>
                                                      <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                                        A cocher:{" "}
                                                        {row.missingItems
                                                          .map(
                                                            (item) =>
                                                              item.label,
                                                          )
                                                          .join(", ")}
                                                        .
                                                      </p>
                                                    </div>
                                                  ),
                                                )}
                                              </div>
                                              <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                                                <summary className="cursor-pointer text-sm font-black">
                                                  Export ordre de travail Mouss
                                                </summary>
                                                <textarea
                                                  readOnly
                                                  value={
                                                    activeProofCategoryMoussFinalLotWorkOrderText
                                                  }
                                                  rows={8}
                                                  className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                                                />
                                              </details>
                                              <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                                                <summary className="cursor-pointer text-sm font-black">
                                                  Export CSV ordre de travail
                                                  Mouss
                                                </summary>
                                                <textarea
                                                  readOnly
                                                  value={
                                                    activeProofCategoryMoussFinalLotWorkOrderCsv
                                                  }
                                                  rows={6}
                                                  className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                                                />
                                              </details>
                                            </div>
                                          ) : null}
                                          <details className="mt-3 rounded-md border border-line bg-paper p-3">
                                            <summary className="cursor-pointer text-sm font-black">
                                              Export priorite lots incomplets
                                              Mouss
                                            </summary>
                                            <textarea
                                              readOnly
                                              value={
                                                activeProofCategoryMoussFinalLotPriorityText
                                              }
                                              rows={8}
                                              className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                                            />
                                          </details>
                                          <details className="mt-3 rounded-md border border-line bg-paper p-3">
                                            <summary className="cursor-pointer text-sm font-black">
                                              Export CSV priorite lots
                                              incomplets Mouss
                                            </summary>
                                            <textarea
                                              readOnly
                                              value={
                                                activeProofCategoryMoussFinalLotPriorityCsv
                                              }
                                              rows={7}
                                              className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                                            />
                                          </details>
                                        </div>
                                      ) : null}
                                      {activeProofCategoryMoussHumanReviewReadyRows.length >
                                      0 ? (
                                        <div className="mt-3 rounded-md border border-[#bfe7df] bg-[#eef8f6] p-3">
                                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                              <p className="text-xs font-black uppercase text-teal">
                                                Pret pour revue humaine
                                              </p>
                                              <p className="mt-1 text-xs font-bold leading-5 text-muted">
                                                {
                                                  activeProofCategoryMoussHumanReviewReadyRows.length
                                                }{" "}
                                                dossier(s) avec checklist
                                                complete. Revue locale
                                                uniquement, HOLD maintenu.
                                              </p>
                                            </div>
                                            <span className="rounded-md bg-paper px-2 py-1 text-[11px] font-black uppercase text-teal ring-1 ring-[#bfe7df]">
                                              Revue Mouss seulement
                                            </span>
                                          </div>
                                          <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                            <DraftMiniMetric
                                              label="Dossiers"
                                              value={
                                                activeProofCategoryMoussHumanReviewReadyRows.length
                                              }
                                            />
                                            <DraftMiniMetric
                                              label="Checklist"
                                              value={
                                                draftMoussFinalChecklistItems.length
                                              }
                                            />
                                            <DraftMiniMetric
                                              label="Sortie HOLD"
                                              value={0}
                                            />
                                          </div>
                                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                                            {activeProofCategoryMoussHumanReviewReadyPreviewRows.map(
                                              (row, index) => (
                                                <div
                                                  key={`active-proof-category-mouss-human-review-ready-${row.productSlug}`}
                                                  className="rounded-md border border-[#bfe7df] bg-paper p-3"
                                                >
                                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="min-w-0">
                                                      <p className="text-[11px] font-black uppercase text-teal">
                                                        #{index + 1} revue
                                                        humaine
                                                      </p>
                                                      <p className="mt-1 break-words text-sm font-black">
                                                        {row.productName}
                                                      </p>
                                                      <p className="mt-1 break-words font-mono text-[11px] font-bold text-muted">
                                                        /admin/produits/
                                                        {row.productSlug}
                                                        /modifier
                                                      </p>
                                                    </div>
                                                    <span className="rounded-md bg-[#eef8f6] px-2 py-1 text-[11px] font-black uppercase text-teal ring-1 ring-[#bfe7df]">
                                                      {row.checkedCount}/
                                                      {
                                                        draftMoussFinalChecklistItems.length
                                                      }{" "}
                                                      OK
                                                    </span>
                                                  </div>
                                                  <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                                    Lot: {row.lotLabel}. Mouss
                                                    relit et garde HOLD tant que
                                                    la validation explicite
                                                    manque.
                                                  </p>
                                                </div>
                                              ),
                                            )}
                                          </div>
                                          <div className="mt-3 rounded-md border border-[#fed7aa] bg-[#fff7ed] p-3">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                              <div className="min-w-0">
                                                <p className="text-xs font-black uppercase text-[#9a3412]">
                                                  Recap validation finale
                                                </p>
                                                <p className="mt-1 text-xs font-bold leading-5 text-muted">
                                                  Document imprimable: Mouss
                                                  choisit une decision, signe,
                                                  puis applique manuellement la
                                                  suite hors automatisme.
                                                </p>
                                              </div>
                                              <span className="rounded-md bg-paper px-2 py-1 text-[11px] font-black uppercase text-[#9a3412] ring-1 ring-[#fed7aa]">
                                                Signature requise
                                              </span>
                                            </div>
                                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                              <DraftMiniMetric
                                                label="A signer"
                                                value={
                                                  activeProofCategoryMoussHumanReviewReadyRows.length
                                                }
                                              />
                                              <DraftMiniMetric
                                                label="Choix papier"
                                                value={2}
                                              />
                                              <DraftMiniMetric
                                                label="Action auto"
                                                value={0}
                                              />
                                            </div>
                                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                                              {activeProofCategoryMoussHumanReviewReadyPreviewRows.map(
                                                (row, index) => (
                                                  <div
                                                    key={`active-proof-category-mouss-final-validation-print-${row.productSlug}`}
                                                    className="rounded-md border border-[#fed7aa] bg-paper p-3"
                                                  >
                                                    <p className="text-[11px] font-black uppercase text-[#9a3412]">
                                                      #{index + 1} decision
                                                      finale
                                                    </p>
                                                    <p className="mt-1 break-words text-sm font-black">
                                                      {row.productName}
                                                    </p>
                                                    <div className="mt-2 grid gap-1 text-xs font-bold leading-5 text-muted">
                                                      <span>
                                                        [ ] Confirmer HOLD
                                                      </span>
                                                      <span>
                                                        [ ] Autoriser sortie
                                                        HOLD apres validation
                                                        Mouss
                                                      </span>
                                                      <span>
                                                        Signature: __________
                                                      </span>
                                                    </div>
                                                  </div>
                                                ),
                                              )}
                                            </div>
                                            <details className="mt-3 rounded-md border border-line bg-paper p-3">
                                              <summary className="cursor-pointer text-sm font-black">
                                                Export recap validation finale
                                                Mouss
                                              </summary>
                                              <textarea
                                                readOnly
                                                value={
                                                  activeProofCategoryMoussFinalValidationPrintText
                                                }
                                                rows={8}
                                                className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                                              />
                                            </details>
                                            <details className="mt-3 rounded-md border border-line bg-paper p-3">
                                              <summary className="cursor-pointer text-sm font-black">
                                                Export CSV recap validation
                                                finale Mouss
                                              </summary>
                                              <textarea
                                                readOnly
                                                value={
                                                  activeProofCategoryMoussFinalValidationPrintCsv
                                                }
                                                rows={6}
                                                className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                                              />
                                            </details>
                                            <div className="mt-3 rounded-md border border-[#fed7aa] bg-paper p-3">
                                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                  <p className="text-xs font-black uppercase text-[#9a3412]">
                                                    Index decisions papier
                                                  </p>
                                                  <p className="mt-1 text-xs font-bold leading-5 text-muted">
                                                    Trace locale des choix
                                                    signes par Mouss. Aucune
                                                    action automatique, aucune
                                                    publication.
                                                  </p>
                                                </div>
                                                <span className="rounded-md bg-[#fff7ed] px-2 py-1 text-[11px] font-black uppercase text-[#9a3412] ring-1 ring-[#fed7aa]">
                                                  Journal local
                                                </span>
                                              </div>
                                              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                                <DraftMiniMetric
                                                  label="Saisies"
                                                  value={
                                                    activeProofCategoryMoussFinalPaperDecisionRecordedCount
                                                  }
                                                />
                                                <DraftMiniMetric
                                                  label="HOLD confirme"
                                                  value={
                                                    activeProofCategoryMoussFinalPaperDecisionHoldCount
                                                  }
                                                />
                                                <DraftMiniMetric
                                                  label="Autorise papier"
                                                  value={
                                                    activeProofCategoryMoussFinalPaperDecisionAuthorizeCount
                                                  }
                                                />
                                              </div>
                                              <div className="mt-3 grid gap-2 md:grid-cols-2">
                                                {activeProofCategoryMoussFinalPaperDecisionRows.map(
                                                  (row) => (
                                                    <div
                                                      key={`active-proof-category-mouss-final-paper-decision-${row.productSlug}`}
                                                      className="rounded-md border border-line bg-[#fbfaf7] p-3"
                                                    >
                                                      <p className="break-words text-sm font-black">
                                                        {row.productName}
                                                      </p>
                                                      <p className="mt-1 text-xs font-bold leading-5 text-muted">
                                                        {row.lotLabel}. HOLD
                                                        conserve tant que la
                                                        suite n&apos;est pas
                                                        validee explicitement.
                                                      </p>
                                                      <label className="mt-3 block text-[11px] font-black uppercase text-[#9a3412]">
                                                        Decision papier Mouss
                                                      </label>
                                                      <select
                                                        value={row.decision}
                                                        onChange={(event) =>
                                                          setActiveProofCategoryMoussFinalPaperDecisionByProduct(
                                                            (current) => {
                                                              const next = {
                                                                ...current,
                                                              };
                                                              const value =
                                                                event.target
                                                                  .value as DraftMoussFinalPaperDecisionStatus;

                                                              if (
                                                                value ===
                                                                "none"
                                                              ) {
                                                                delete next[
                                                                  row.productSlug
                                                                ];
                                                              } else {
                                                                next[
                                                                  row.productSlug
                                                                ] = value;
                                                              }

                                                              return next;
                                                            },
                                                          )
                                                        }
                                                        className="mt-2 min-h-10 w-full rounded-md border border-line bg-white px-3 text-sm font-bold text-foreground"
                                                      >
                                                        <option value="none">
                                                          {
                                                            draftMoussFinalPaperDecisionLabels.none
                                                          }
                                                        </option>
                                                        <option value="hold">
                                                          {
                                                            draftMoussFinalPaperDecisionLabels.hold
                                                          }
                                                        </option>
                                                        <option value="authorize">
                                                          {
                                                            draftMoussFinalPaperDecisionLabels.authorize
                                                          }
                                                        </option>
                                                      </select>
                                                    </div>
                                                  ),
                                                )}
                                              </div>
                                              <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                                                <summary className="cursor-pointer text-sm font-black">
                                                  Export index decisions papier
                                                  Mouss
                                                </summary>
                                                <textarea
                                                  readOnly
                                                  value={
                                                    activeProofCategoryMoussFinalPaperDecisionText
                                                  }
                                                  rows={8}
                                                  className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                                                />
                                              </details>
                                              <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                                                <summary className="cursor-pointer text-sm font-black">
                                                  Export CSV index decisions
                                                  papier Mouss
                                                </summary>
                                                <textarea
                                                  readOnly
                                                  value={
                                                    activeProofCategoryMoussFinalPaperDecisionCsv
                                                  }
                                                  rows={6}
                                                  className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                                                />
                                              </details>
                                            </div>
                                            <div className="mt-3 rounded-md border border-[#bfe7df] bg-[#eef8f6] p-3">
                                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                  <p className="text-xs font-black uppercase text-teal">
                                                    Synthese finale session
                                                  </p>
                                                  <p className="mt-1 text-xs font-bold leading-5 text-muted">
                                                    Un seul export relie ordre
                                                    de travail, revue humaine,
                                                    signature et decisions
                                                    papier. HOLD conserve sans
                                                    action automatique.
                                                  </p>
                                                </div>
                                                <span className="rounded-md bg-paper px-2 py-1 text-[11px] font-black uppercase text-teal ring-1 ring-[#bfe7df]">
                                                  Export unique
                                                </span>
                                              </div>
                                              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                                                <DraftMiniMetric
                                                  label="A finir"
                                                  value={
                                                    activeProofCategoryMoussFinalLotWorkOrderMissingTotal
                                                  }
                                                />
                                                <DraftMiniMetric
                                                  label="Prets revue"
                                                  value={
                                                    activeProofCategoryMoussHumanReviewReadyRows.length
                                                  }
                                                />
                                                <DraftMiniMetric
                                                  label="Decisions"
                                                  value={
                                                    activeProofCategoryMoussFinalPaperDecisionRecordedCount
                                                  }
                                                />
                                                <DraftMiniMetric
                                                  label="Action auto"
                                                  value={0}
                                                />
                                              </div>
                                              <div className="mt-3 rounded-md border border-[#bfe7df] bg-paper p-3">
                                                <p className="text-[11px] font-black uppercase text-teal">
                                                  Chemin local Mouss
                                                </p>
                                                <div className="mt-2 grid gap-1 text-xs font-bold leading-5 text-muted">
                                                  <span>
                                                    1. Finir les cases restantes
                                                    du lot prioritaire.
                                                  </span>
                                                  <span>
                                                    2. Relire les dossiers prets
                                                    pour revue humaine.
                                                  </span>
                                                  <span>
                                                    3. Signer le recap final,
                                                    puis reporter la decision
                                                    papier.
                                                  </span>
                                                  <span>
                                                    4. Ne rien publier tant que
                                                    le process autorise n&apos;est
                                                    pas explicite.
                                                  </span>
                                                </div>
                                              </div>
                                              <details className="mt-3 rounded-md border border-line bg-paper p-3">
                                                <summary className="cursor-pointer text-sm font-black">
                                                  Export synthese finale session
                                                  Mouss
                                                </summary>
                                                <textarea
                                                  readOnly
                                                  value={
                                                    activeProofCategoryMoussFinalSessionText
                                                  }
                                                  rows={9}
                                                  className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                                                />
                                              </details>
                                              <details className="mt-3 rounded-md border border-line bg-paper p-3">
                                                <summary className="cursor-pointer text-sm font-black">
                                                  Export CSV synthese finale
                                                  session Mouss
                                                </summary>
                                                <textarea
                                                  readOnly
                                                  value={
                                                    activeProofCategoryMoussFinalSessionCsv
                                                  }
                                                  rows={7}
                                                  className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                                                />
                                              </details>
                                            </div>
                                          </div>
                                          <details className="mt-3 rounded-md border border-line bg-paper p-3">
                                            <summary className="cursor-pointer text-sm font-black">
                                              Export revue humaine Mouss
                                            </summary>
                                            <textarea
                                              readOnly
                                              value={
                                                activeProofCategoryMoussHumanReviewReadyText
                                              }
                                              rows={8}
                                              className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                                            />
                                          </details>
                                          <details className="mt-3 rounded-md border border-line bg-paper p-3">
                                            <summary className="cursor-pointer text-sm font-black">
                                              Export CSV revue humaine Mouss
                                            </summary>
                                            <textarea
                                              readOnly
                                              value={
                                                activeProofCategoryMoussHumanReviewReadyCsv
                                              }
                                              rows={6}
                                              className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                                            />
                                          </details>
                                        </div>
                                      ) : null}
                                      <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                                        <summary className="cursor-pointer text-sm font-black">
                                          Export synthese inter-lots Mouss
                                        </summary>
                                        <textarea
                                          readOnly
                                          value={
                                            activeProofCategoryMoussFinalLotSummaryText
                                          }
                                          rows={8}
                                          className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                                        />
                                      </details>
                                      <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                                        <summary className="cursor-pointer text-sm font-black">
                                          Export CSV synthese inter-lots Mouss
                                        </summary>
                                        <textarea
                                          readOnly
                                          value={
                                            activeProofCategoryMoussFinalLotSummaryCsv
                                          }
                                          rows={7}
                                          className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                                        />
                                      </details>
                                    </div>
                                  ) : null}
                                  {activeProofCategoryMoussReadyDossierPreviewPlans
                                    .length > 0 ? (
                                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                                      {activeProofCategoryMoussReadyDossierPreviewPlans.map(
                                        (plan, index) => (
                                          <div
                                            key={`active-proof-category-mouss-ready-dossier-${plan.entry.id}-${plan.product.slug}`}
                                            className="rounded-md border border-[#bfe7df] bg-paper p-3"
                                          >
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                              <div className="min-w-0">
                                                <p className="text-[11px] font-black uppercase text-teal">
                                                  #{index + 1} dossier Mouss
                                                </p>
                                                <p className="mt-1 break-words text-sm font-black">
                                                  {plan.product.name}
                                                </p>
                                                <p className="mt-1 break-words font-mono text-[11px] font-bold text-muted">
                                                  {plan.product.slug}
                                                </p>
                                              </div>
                                              <span className="rounded-md bg-[#eef8f6] px-2 py-1 text-[11px] font-black uppercase text-teal ring-1 ring-[#bfe7df]">
                                                Pret local
                                              </span>
                                            </div>
                                            <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                              Lot: {plan.entry.proofLabel} /{" "}
                                              {plan.entry.categoryLabel}. Revue
                                              humaine obligatoire avant toute
                                              suite.
                                            </p>
                                            <Link
                                              href={`/admin/produits/${plan.product.slug}/modifier`}
                                              className="focus-ring mt-3 inline-flex min-h-9 items-center justify-center rounded-md border border-[#bfe7df] bg-[#eef8f6] px-3 text-xs font-black text-teal hover:bg-white"
                                            >
                                              Ouvrir fiche dossier
                                            </Link>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  ) : (
                                    <p className="mt-3 rounded-md border border-[#fed7aa] bg-[#fff7ed] p-3 text-xs font-bold leading-5 text-[#9a3412]">
                                      Aucun candidat marque Dossier pret Mouss.
                                      Le dossier se remplit avec les decisions
                                      locales ci-dessous.
                                    </p>
                                  )}
                                  {activeProofCategoryMoussReadyDossierPlans
                                    .length > 0 ? (
                                    <div className="mt-3 rounded-md border border-[#bfe7df] bg-paper p-3">
                                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                          <p className="text-xs font-black uppercase text-teal">
                                            Checklist finale revue Mouss
                                          </p>
                                          <p className="mt-1 text-xs font-bold leading-5 text-muted">
                                            {
                                              activeProofCategoryMoussFinalChecklistCompleteCount
                                            }{" "}
                                            dossier(s) complet(s),{" "}
                                            {
                                              activeProofCategoryMoussFinalChecklistCheckedCount
                                            }
                                            /
                                            {
                                              activeProofCategoryMoussFinalChecklistTotalCount
                                            }{" "}
                                            case(s) cochee(s). HOLD maintenu
                                            tant que la validation humaine
                                            n&apos;est
                                            pas explicite.
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setActiveProofCategoryMoussFinalCheckedByProduct(
                                              {},
                                            )
                                          }
                                          disabled={
                                            activeProofCategoryMoussFinalChecklistCheckedCount ===
                                            0
                                          }
                                          className="focus-ring inline-flex min-h-9 items-center justify-center rounded-md border border-[#bfe7df] bg-[#eef8f6] px-3 text-xs font-black text-teal hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          Vider checklist finale
                                        </button>
                                      </div>
                                      <div className="mt-3 grid gap-2">
                                        {activeProofCategoryMoussReadyDossierPlans.map(
                                          (plan, index) => {
                                            const checkedIds =
                                              activeProofCategoryMoussFinalCheckedByProduct[
                                                plan.product.slug
                                              ] ?? [];
                                            const checkedCount =
                                              draftMoussFinalChecklistItems.filter(
                                                (item) =>
                                                  checkedIds.includes(item.id),
                                              ).length;

                                            return (
                                              <div
                                                key={`active-proof-category-mouss-final-checklist-${plan.entry.id}-${plan.product.slug}`}
                                                className="rounded-md border border-line bg-[#fbfaf7] p-3"
                                              >
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                  <div className="min-w-0">
                                                    <p className="text-[11px] font-black uppercase text-teal">
                                                      #{index + 1} controle
                                                      final Mouss
                                                    </p>
                                                    <p className="mt-1 break-words text-sm font-black">
                                                      {plan.product.name}
                                                    </p>
                                                    <p className="mt-1 break-words font-mono text-[11px] font-bold text-muted">
                                                      {plan.product.slug}
                                                    </p>
                                                  </div>
                                                  <span className="rounded-md bg-[#eef8f6] px-2 py-1 text-[11px] font-black uppercase text-teal ring-1 ring-[#bfe7df]">
                                                    {checkedCount}/
                                                    {
                                                      draftMoussFinalChecklistItems.length
                                                    }{" "}
                                                    coches
                                                  </span>
                                                </div>
                                                <div className="mt-3 grid gap-2 md:grid-cols-2">
                                                  {draftMoussFinalChecklistItems.map(
                                                    (item) => (
                                                      <label
                                                        key={`active-proof-category-mouss-final-checklist-${plan.product.slug}-${item.id}`}
                                                        className="flex items-start gap-2 rounded-md border border-line bg-paper p-2 text-xs font-bold leading-5 text-muted"
                                                      >
                                                        <input
                                                          type="checkbox"
                                                          checked={checkedIds.includes(
                                                            item.id,
                                                          )}
                                                          onChange={(event) =>
                                                            setActiveProofCategoryMoussFinalCheckedByProduct(
                                                              (current) => {
                                                                const nextIds =
                                                                  new Set(
                                                                    current[
                                                                      plan
                                                                        .product
                                                                        .slug
                                                                    ] ?? [],
                                                                  );

                                                                if (
                                                                  event.target
                                                                    .checked
                                                                ) {
                                                                  nextIds.add(
                                                                    item.id,
                                                                  );
                                                                } else {
                                                                  nextIds.delete(
                                                                    item.id,
                                                                  );
                                                                }

                                                                const next = {
                                                                  ...current,
                                                                };
                                                                const values =
                                                                  Array.from(
                                                                    nextIds,
                                                                  );

                                                                if (
                                                                  values.length >
                                                                  0
                                                                ) {
                                                                  next[
                                                                    plan.product.slug
                                                                  ] = values;
                                                                } else {
                                                                  delete next[
                                                                    plan.product.slug
                                                                  ];
                                                                }

                                                                return next;
                                                              },
                                                            )
                                                          }
                                                          className="mt-1 size-4 rounded border-line text-teal"
                                                        />
                                                        <span>
                                                          <span className="block text-[11px] font-black uppercase text-foreground">
                                                            {item.label}
                                                          </span>
                                                          {item.detail}
                                                        </span>
                                                      </label>
                                                    ),
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          },
                                        )}
                                      </div>
                                    </div>
                                  ) : null}
                                  {activeProofCategoryMoussReadyDossierRemainingPreviewCount >
                                  0 ? (
                                    <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                      +{" "}
                                      {
                                        activeProofCategoryMoussReadyDossierRemainingPreviewCount
                                      }{" "}
                                      autre(s) candidat(s) dans les exports du
                                      dossier final.
                                    </p>
                                  ) : null}
                                  <details className="mt-3 rounded-md border border-line bg-paper p-3">
                                    <summary className="cursor-pointer text-sm font-black">
                                      Export dossier final revue Mouss
                                    </summary>
                                    <textarea
                                      readOnly
                                      value={
                                        activeProofCategoryMoussReadyDossierText
                                      }
                                      rows={8}
                                      className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                                    />
                                  </details>
                                  <details className="mt-3 rounded-md border border-line bg-paper p-3">
                                    <summary className="cursor-pointer text-sm font-black">
                                      Export CSV dossier final revue Mouss
                                    </summary>
                                    <textarea
                                      readOnly
                                      value={
                                        activeProofCategoryMoussReadyDossierCsv
                                      }
                                      rows={7}
                                      className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                                    />
                                  </details>
                                  <details className="mt-3 rounded-md border border-line bg-paper p-3">
                                    <summary className="cursor-pointer text-sm font-black">
                                      Export checklist finale imprimable
                                    </summary>
                                    <textarea
                                      readOnly
                                      value={
                                        activeProofCategoryMoussReadyDossierPrintText
                                      }
                                      rows={10}
                                      className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                                    />
                                  </details>
                                  <details className="mt-3 rounded-md border border-line bg-paper p-3">
                                    <summary className="cursor-pointer text-sm font-black">
                                      Export CSV checklist finale Mouss
                                    </summary>
                                    <textarea
                                      readOnly
                                      value={
                                        activeProofCategoryMoussReadyDossierChecklistCsv
                                      }
                                      rows={7}
                                      className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                                    />
                                  </details>
                                </div>
                                <div className="mt-3 grid gap-2 md:grid-cols-2">
                                  {activeProofCategoryMoussDecisionPreviewPlans
                                    .length > 0 ? (
                                    activeProofCategoryMoussDecisionPreviewPlans.map(
                                      (plan, index) => (
                                        <div
                                          key={`active-proof-category-mouss-handoff-${plan.entry.id}-${plan.product.slug}`}
                                          className="rounded-md border border-[#bfe7df] bg-paper p-3"
                                        >
                                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                              <p className="text-[11px] font-black uppercase text-teal">
                                                #{index + 1} revue Mouss
                                              </p>
                                              <p className="mt-1 break-words text-sm font-black">
                                                {plan.product.name}
                                              </p>
                                              <p className="mt-1 break-words font-mono text-[11px] font-bold text-muted">
                                                {plan.product.slug}
                                              </p>
                                            </div>
                                            <span
                                              className={`rounded-md px-2 py-1 text-[11px] font-black uppercase ring-1 ${
                                                plan.sessionChecked
                                                  ? "bg-[#eef8f6] text-teal ring-[#bfe7df]"
                                                  : "bg-[#fff7ed] text-[#9a3412] ring-[#fed7aa]"
                                              }`}
                                            >
                                              {plan.sessionChecked
                                                ? "Coche pret"
                                                : "A confirmer"}
                                            </span>
                                          </div>
                                          <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                            Lot: {plan.entry.proofLabel} /{" "}
                                            {plan.entry.categoryLabel}. Decision
                                            Mouss requise, HOLD maintenu.
                                          </p>
                                          <label className="mt-3 grid gap-2 text-xs font-black uppercase text-muted">
                                            Decision locale
                                            <select
                                              value={plan.decision}
                                              onChange={(event) =>
                                                setActiveProofCategoryMoussDecisionByProduct(
                                                  (current) => ({
                                                    ...current,
                                                    [plan.product.slug]:
                                                      event.target
                                                        .value as DraftMoussDecisionStatus,
                                                  }),
                                                )
                                              }
                                              className="focus-ring min-h-10 rounded-md border border-[#bfe7df] bg-[#fbfaf7] px-3 text-sm font-bold normal-case text-foreground"
                                            >
                                              <option value="hold">
                                                Maintenir HOLD
                                              </option>
                                              <option value="review">
                                                A revoir Mouss
                                              </option>
                                              <option value="ready">
                                                Dossier pret Mouss
                                              </option>
                                            </select>
                                          </label>
                                          <Link
                                            href={`/admin/produits/${plan.product.slug}/modifier`}
                                            className="focus-ring mt-3 inline-flex min-h-9 items-center justify-center rounded-md border border-[#bfe7df] bg-[#eef8f6] px-3 text-xs font-black text-teal hover:bg-white"
                                          >
                                            Ouvrir fiche revue
                                          </Link>
                                        </div>
                                      ),
                                    )
                                  ) : (
                                    <p className="rounded-md border border-[#fed7aa] bg-[#fff7ed] p-3 text-xs font-bold leading-5 text-[#9a3412] md:col-span-2">
                                      Aucun candidat pret pour revue Mouss dans
                                      les lots actifs. Continuer les preuves
                                      restantes, HOLD maintenu.
                                    </p>
                                  )}
                                </div>
                                {activeProofCategoryMoussHandoffRemainingPreviewCount >
                                0 ? (
                                  <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                    +{" "}
                                    {
                                      activeProofCategoryMoussHandoffRemainingPreviewCount
                                    }{" "}
                                    candidat(s) supplementaire(s) dans les
                                    exports revue Mouss.
                                  </p>
                                ) : null}
                                <details className="mt-3 rounded-md border border-line bg-paper p-3">
                                  <summary className="cursor-pointer text-sm font-black">
                                    Export passerelle revue Mouss
                                  </summary>
                                  <textarea
                                    readOnly
                                    value={activeProofCategoryMoussHandoffText}
                                    rows={8}
                                    className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                                  />
                                </details>
                                <details className="mt-3 rounded-md border border-line bg-paper p-3">
                                  <summary className="cursor-pointer text-sm font-black">
                                    Export CSV passerelle revue Mouss
                                  </summary>
                                  <textarea
                                    readOnly
                                    value={activeProofCategoryMoussHandoffCsv}
                                    rows={7}
                                    className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                                  />
                                </details>
                              </div>
                              <div className="mt-3 grid gap-2 lg:grid-cols-3">
                                {activeProofCategoryMoussActionPreviewRows.map(
                                  (row, index) => {
                                    const previewPlans =
                                      row.topPendingPlans.length > 0
                                        ? row.topPendingPlans
                                        : row.topReadyPlans;

                                    return (
                                      <div
                                        key={`active-proof-category-mouss-action-row-${row.entry.id}`}
                                        className="rounded-md border border-[#bfe7df] bg-[#eef8f6] p-3"
                                      >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <p className="text-[11px] font-black uppercase text-teal">
                                            Action lot #{index + 1}
                                          </p>
                                          <span className="rounded-md bg-paper px-2 py-1 text-[11px] font-black uppercase text-teal ring-1 ring-[#bfe7df]">
                                            {row.checkedCount}/
                                            {row.plans.length} coche(s)
                                          </span>
                                        </div>
                                        <p className="mt-2 break-words text-sm font-black">
                                          {row.entry.proofLabel} /{" "}
                                          {row.entry.categoryLabel}
                                        </p>
                                        <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                          {row.uncheckedCount} a traiter,{" "}
                                          {row.readyCount} revue Mouss,{" "}
                                          {row.blockedCount} encore bloque(s).
                                        </p>
                                        {previewPlans.length > 0 ? (
                                          <div className="mt-2 grid gap-1 text-xs font-bold leading-5 text-muted">
                                            {previewPlans.map((plan) => (
                                              <span
                                                key={`active-proof-category-mouss-action-plan-${row.entry.id}-${plan.product.slug}`}
                                                className="break-words"
                                              >
                                                {plan.product.name} -{" "}
                                                {plan.sessionChecked
                                                  ? "coche localement"
                                                  : "a traiter"}
                                              </span>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                            Aucun produit restant dans ce lot.
                                          </p>
                                        )}
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                              <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                                <summary className="cursor-pointer text-sm font-black">
                                  Export prochaines actions Mouss
                                </summary>
                                <textarea
                                  readOnly
                                  value={activeProofCategoryMoussActionsText}
                                  rows={8}
                                  className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                                />
                              </details>
                              <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                                <summary className="cursor-pointer text-sm font-black">
                                  Export CSV prochaines actions Mouss
                                </summary>
                                <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                  CSV interne multi-lots: session locale,
                                  preuves restantes, reprise admin et garde
                                  HOLD.
                                </p>
                                <textarea
                                  readOnly
                                  value={activeProofCategoryMoussActionsCsv}
                                  rows={7}
                                  className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                                />
                              </details>
                            </div>
                            <div className="mt-3 grid gap-2 lg:grid-cols-3">
                              {activeProofCategoryMoussReviewRows.map(
                                (row, index) => (
                                  <div
                                    key={`active-proof-category-mouss-row-${row.entry.id}`}
                                    className={`rounded-md border p-3 ${
                                      row.readyCount > 0
                                        ? "border-teal bg-paper"
                                        : "border-[#bfe7df] bg-[#fbfaf7]"
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <p className="text-[11px] font-black uppercase text-teal">
                                        Lot #{index + 1}
                                      </p>
                                      <span
                                        className={`rounded-md px-2 py-1 text-[11px] font-black uppercase ring-1 ${
                                          row.readyCount > 0
                                            ? "bg-[#eef8f6] text-teal ring-[#bfe7df]"
                                            : "bg-[#fff7ed] text-[#9a3412] ring-[#fed7aa]"
                                        }`}
                                      >
                                        {row.readyCount > 0
                                          ? "Revue possible"
                                          : "Preuves a finir"}
                                      </span>
                                    </div>
                                    <p className="mt-2 break-words text-sm font-black">
                                      {row.entry.proofLabel} /{" "}
                                      {row.entry.categoryLabel}
                                    </p>
                                    <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                      {row.readyCount} candidat(s),{" "}
                                      {row.blockedCount} encore bloque(s),{" "}
                                      {row.pendingCount} a traiter localement.
                                    </p>
                                    {row.topReadyProducts.length > 0 ? (
                                      <div className="mt-2 grid gap-1 text-xs font-bold leading-5 text-teal">
                                        {row.topReadyProducts.map((product) => (
                                          <span
                                            key={`active-proof-category-mouss-candidate-${row.entry.id}-${product.slug}`}
                                            className="break-words"
                                          >
                                            {product.name}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                        Aucun candidat a revue Mouss dans ce lot
                                        pour le moment.
                                      </p>
                                    )}
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                          <div
                            className="mt-3 rounded-md border border-[#bfe7df] bg-[#eef8f6] p-3"
                            aria-label="Progression file active HOLD"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-black uppercase text-teal">
                                Progression lots actifs
                              </p>
                              <span className="rounded-md bg-paper px-2 py-1 text-[11px] font-black uppercase text-teal ring-1 ring-[#bfe7df]">
                                Lot {activeProofCategoryQueueIndex + 1}/
                                {displayedProofCategoryQueue.length}
                              </span>
                            </div>
                            <div className="mt-3 flex h-3 overflow-hidden rounded-full border border-[#bfe7df] bg-paper">
                              {displayedProofCategoryQueue.map(
                                (entry, index) => {
                                  const isActive =
                                    entry.id === activeProofCategoryQueueEntry.id;
                                  const isNext =
                                    activeProofCategoryNextEntry?.id === entry.id;
                                  const statusLabel = isActive
                                    ? "actif"
                                    : isNext
                                      ? "suivant"
                                      : "attente";

                                  return (
                                    <span
                                      key={`active-proof-category-progress-${entry.id}`}
                                      aria-label={`Lot ${index + 1} ${statusLabel}`}
                                      className={`h-full min-w-0 flex-1 border-r border-paper last:border-r-0 ${
                                        isActive
                                          ? "bg-teal"
                                          : isNext
                                            ? "bg-[#7ac9bd]"
                                            : "bg-[#d9c7a3]"
                                      }`}
                                    />
                                  );
                                },
                              )}
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                              {displayedProofCategoryQueue.map(
                                (entry, index) => {
                                  const isActive =
                                    entry.id === activeProofCategoryQueueEntry.id;
                                  const isNext =
                                    activeProofCategoryNextEntry?.id === entry.id;
                                  const localProgress =
                                    activeProofCategoryLocalProgressByEntry.get(
                                      entry.id,
                                    );
                                  const statusLabel = isActive
                                    ? "Actif"
                                    : isNext
                                      ? "Suivant"
                                      : "Attente";

                                  return (
                                    <div
                                      key={`active-proof-category-progress-label-${entry.id}`}
                                      className={`rounded-md border px-3 py-2 ${
                                        isActive
                                          ? "border-teal bg-paper"
                                          : "border-[#bfe7df] bg-[#fbfaf7]"
                                      }`}
                                    >
                                      <p className="text-[11px] font-black uppercase text-teal">
                                        #{index + 1} {statusLabel}
                                      </p>
                                      <p className="mt-1 break-words text-xs font-bold leading-5 text-muted">
                                        {entry.readyAfterZoneCount}/{entry.count}{" "}
                                        pret(s) apres preuve
                                      </p>
                                      <p className="mt-1 break-words text-xs font-bold leading-5 text-teal">
                                        {localProgress?.doneCount ?? 0}/
                                        {localProgress?.totalCount ??
                                          entry.count}{" "}
                                        local,{" "}
                                        {localProgress?.pendingCount ??
                                          entry.count}{" "}
                                        a faire
                                      </p>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          </div>
                          <div className="mt-3 grid gap-2 lg:grid-cols-3">
                            {displayedProofCategoryQueue.map(
                              (entry, index) => {
                                const isActive =
                                  entry.id === activeProofCategoryQueueEntry.id;
                                const isNext =
                                  activeProofCategoryNextEntry?.id === entry.id;
                                const localProgress =
                                  activeProofCategoryLocalProgressByEntry.get(
                                    entry.id,
                                  );
                                const statusLabel = isActive
                                  ? "Actif"
                                  : isNext
                                    ? "Suivant"
                                    : "En attente";

                                return (
                                  <button
                                    key={`active-proof-category-summary-${entry.id}`}
                                    type="button"
                                    onClick={() =>
                                      selectProofCategoryQueueEntry(entry)
                                    }
                                    className={`focus-ring rounded-md border p-3 text-left hover:bg-white ${
                                      isActive
                                        ? "border-teal bg-[#eef8f6]"
                                        : "border-line bg-[#fbfaf7]"
                                    }`}
                                  >
                                    <span
                                      className={`rounded-md px-2 py-1 text-[11px] font-black uppercase ring-1 ${
                                        isActive
                                          ? "bg-teal text-white ring-teal"
                                          : isNext
                                            ? "bg-[#eef8f6] text-teal ring-[#bfe7df]"
                                            : "bg-[#f6f1e8] text-muted ring-line"
                                      }`}
                                    >
                                      {statusLabel}
                                    </span>
                                    <span className="mt-2 block break-words text-sm font-black">
                                      #{index + 1} {entry.proofLabel} /{" "}
                                      {entry.categoryLabel}
                                    </span>
                                    <span className="mt-2 grid gap-1 text-xs font-bold leading-5 text-muted">
                                      <span>
                                        {entry.readyAfterZoneCount}/
                                        {entry.count} pret(s) apres preuve
                                      </span>
                                      <span>
                                        {entry.linkedBlockerCount} blocage(s)
                                        lies
                                      </span>
                                      <span>
                                        Priorite {entry.topPriorityScore}
                                      </span>
                                      <span>
                                        Local {localProgress?.doneCount ?? 0}/
                                        {localProgress?.totalCount ??
                                          entry.count}
                                        {localProgress?.isComplete
                                          ? " couvert"
                                          : " a faire"}
                                      </span>
                                    </span>
                                  </button>
                                );
                              },
                            )}
                          </div>
                          <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                            <summary className="cursor-pointer text-sm font-black">
                              Export resume file active
                            </summary>
                            <textarea
                              readOnly
                              value={activeProofCategorySummaryText}
                              rows={7}
                              className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                            />
                          </details>
                          <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                            <summary className="cursor-pointer text-sm font-black">
                              Export CSV validation lots actifs
                            </summary>
                            <p className="mt-2 text-xs font-bold leading-5 text-muted">
                              Colonnes compactes pour revue interne uniquement:
                              aucun lot ne quitte le brouillon/HOLD.
                            </p>
                            <textarea
                              readOnly
                              value={activeProofCategoryValidationCsv}
                              rows={6}
                              className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                            />
                          </details>
                          <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                            <summary className="cursor-pointer text-sm font-black">
                              Export progression locale
                            </summary>
                            <textarea
                              readOnly
                              value={activeProofCategoryLocalProgressText}
                              rows={7}
                              className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                            />
                          </details>
                          <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                            <summary className="cursor-pointer text-sm font-black">
                              Export revue Mouss file active
                            </summary>
                            <textarea
                              readOnly
                              value={activeProofCategoryMoussReviewQueueText}
                              rows={8}
                              className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                            />
                          </details>
                          <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                            <summary className="cursor-pointer text-sm font-black">
                              Export CSV revue Mouss file active
                            </summary>
                            <p className="mt-2 text-xs font-bold leading-5 text-muted">
                              CSV interne par lot: priorite, candidats, blocages
                              et HOLD maintenu.
                            </p>
                            <textarea
                              readOnly
                              value={activeProofCategoryMoussReviewQueueCsv}
                              rows={7}
                              className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                            />
                          </details>
                          <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                            <summary className="cursor-pointer text-sm font-black">
                              Export prochain lot local
                            </summary>
                            <textarea
                              readOnly
                              value={activeProofCategoryNextPendingText}
                              rows={7}
                              className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                            />
                          </details>
                          <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                            <summary className="cursor-pointer text-sm font-black">
                              Export plan produits prochain lot
                            </summary>
                            <textarea
                              readOnly
                              value={activeProofCategoryNextPendingPlanText}
                              rows={8}
                              className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                            />
                          </details>
                          <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                            <summary className="cursor-pointer text-sm font-black">
                              Export CSV plan prochain lot
                            </summary>
                            <p className="mt-2 text-xs font-bold leading-5 text-muted">
                              CSV interne pour reprise: statut apres preuve cible,
                              preuves suivantes et HOLD maintenu.
                            </p>
                            <textarea
                              readOnly
                              value={activeProofCategoryNextPendingPlanCsv}
                              rows={7}
                              className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                            />
                          </details>
                          <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                            <summary className="cursor-pointer text-sm font-black">
                              Export revue Mouss prochain lot
                            </summary>
                            <textarea
                              readOnly
                              value={activeProofCategoryNextPendingMoussReviewText}
                              rows={8}
                              className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                            />
                          </details>
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-3 rounded-md border border-[#bfe7df] bg-[#eef8f6] p-3 lg:hidden">
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-black uppercase text-teal">
                          Vue mobile lot actif
                        </p>
                        <h5 className="break-words text-base font-black">
                          {activeProofCategoryQueueEntry.proofLabel} /{" "}
                          {activeProofCategoryQueueEntry.categoryLabel}
                        </h5>
                        <p className="text-xs font-bold leading-5 text-muted">
                          Resume de poche pour reprendre le lot sans perdre le
                          fil. HOLD maintenu jusqu&apos;aux preuves completes et a
                          la validation Mouss.
                        </p>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-4">
                        <DraftMiniMetric
                          label="Brouillons"
                          value={activeProofCategoryQueueEntry.count}
                        />
                        <DraftMiniMetric
                          label="Prets apres"
                          value={
                            activeProofCategoryQueueEntry.readyAfterZoneCount
                          }
                        />
                        <DraftMiniMetric
                          label="Restants"
                          value={activeProofCategoryRemainingBlockerCount}
                        />
                        <DraftMiniMetric
                          label="A faire local"
                          value={activeProofCategoryPendingCount}
                        />
                      </div>
                      {activeProofCategoryTopProduct ? (
                        <div className="mt-3 rounded-md border border-line bg-paper p-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase text-muted">
                              Brouillon courant
                            </p>
                            <p className="mt-1 break-words text-sm font-black">
                              {activeProofCategoryTopProduct.name}
                            </p>
                            <p className="mt-1 break-words font-mono text-[11px] font-bold text-muted">
                              {activeProofCategoryTopProduct.slug}
                            </p>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black uppercase">
                            <span className="rounded-md bg-[#f6f1e8] px-2 py-1 text-muted ring-1 ring-line">
                              Score {activeProofCategoryTopPriority?.score ?? 0}
                            </span>
                            <span className="rounded-md bg-[#fff7ed] px-2 py-1 text-[#9a3412] ring-1 ring-[#fed7aa]">
                              HOLD actif
                            </span>
                            <span className="rounded-md bg-[#eef8f6] px-2 py-1 text-teal ring-1 ring-[#bfe7df]">
                              A faire {activeProofCategoryPendingCount}
                            </span>
                          </div>
                          {activeProofCategoryIsLotLocallyComplete ? (
                            <div className="mt-3 rounded-md border border-[#bfe7df] bg-[#eef8f6] px-3 py-2">
                              <p className="text-xs font-bold leading-5 text-teal">
                                Lot couvert localement en session admin. Revenir
                                aux preuves exactes, passer au lot suivant ou
                                vider l&apos;historique local pour reprendre.
                              </p>
                              {displayedProofCategoryQueue.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const followUpEntry =
                                      activeProofCategoryFollowUpEntry ??
                                      activeProofCategoryNextEntry ??
                                      displayedProofCategoryQueue[
                                        (activeProofCategoryQueueIndex + 1) %
                                          displayedProofCategoryQueue.length
                                      ];

                                    if (followUpEntry) {
                                      selectProofCategoryQueueEntry(
                                        followUpEntry,
                                      );
                                    }
                                  }}
                                  className="focus-ring mt-2 w-full rounded-md bg-teal px-3 py-2 text-xs font-black uppercase text-white hover:bg-[#0b4f49]"
                                >
                                  Lot a faire suivant
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="mt-3 text-xs font-bold leading-5 text-muted">
                            {activeProofCategoryNextProofLabels.length > 0 ? (
                              <span>
                                Ensuite:{" "}
                                {activeProofCategoryNextProofLabels.join(", ")}
                              </span>
                            ) : (
                              <span>Ensuite: revue finale possible.</span>
                            )}
                          </div>
                          <div className="mt-3 rounded-md border border-[#bfe7df] bg-[#eef8f6] p-3">
                            <p className="text-[11px] font-black uppercase text-teal">
                              Historique local du lot
                            </p>
                            {activeProofCategoryHandledHistory.length > 0 ? (
                              <ol className="mt-2 grid gap-2">
                                {activeProofCategoryHandledHistory.map(
                                  (handledProduct, handledIndex) => (
                                    <li
                                      key={`${handledProduct.slug}-${handledIndex}`}
                                      className="rounded-md border border-[#bfe7df] bg-paper px-3 py-2"
                                    >
                                      <p className="text-[11px] font-black uppercase text-teal">
                                        #{handledIndex + 1} traite localement
                                      </p>
                                      <p className="mt-1 break-words text-sm font-black">
                                        {handledProduct.name}
                                      </p>
                                      <p className="mt-1 break-words font-mono text-[11px] font-bold text-muted">
                                        {handledProduct.slug}
                                      </p>
                                    </li>
                                  ),
                                )}
                              </ol>
                            ) : (
                              <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                Aucun produit marque localement pour ce lot.
                              </p>
                            )}
                            <details className="mt-3 rounded-md border border-[#bfe7df] bg-paper p-3">
                              <summary className="cursor-pointer text-sm font-black">
                                Export historique local
                              </summary>
                              <p className="mt-2 text-xs font-bold leading-5 text-muted">
                                Trace de session uniquement: elle n&apos;enregistre
                                rien et ne leve jamais le HOLD.
                              </p>
                              <textarea
                                readOnly
                                value={activeProofCategoryHistoryText}
                                rows={6}
                                className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                              />
                            </details>
                            <button
                              type="button"
                              disabled={
                                activeProofCategoryHandledHistory.length === 0
                              }
                              onClick={() =>
                                setActiveProofCategoryLastHandledByEntry(
                                  (current) => {
                                    const next = { ...current };
                                    delete next[
                                      activeProofCategoryQueueEntry.id
                                    ];
                                    return next;
                                  },
                                )
                              }
                              className="focus-ring mt-3 w-full rounded-md border border-[#bfe7df] bg-paper px-3 py-2 text-xs font-black uppercase text-teal hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Vider historique local
                            </button>
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <Link
                              href={`/admin/produits/${activeProofCategoryTopProduct.slug}/modifier`}
                              className="focus-ring block rounded-md bg-teal px-3 py-2 text-center text-xs font-black uppercase text-white hover:bg-[#0b4f49]"
                            >
                              Reprendre ce brouillon
                            </Link>
                            <button
                              type="button"
                              disabled={activeProofCategoryIsLotLocallyComplete}
                              onClick={() =>
                                setActiveProofCategoryLastHandledByEntry(
                                  (current) => {
                                    const nextHandled = {
                                      name: activeProofCategoryTopProduct.name,
                                      slug: activeProofCategoryTopProduct.slug,
                                    };
                                    const previousHandled =
                                      current[
                                        activeProofCategoryQueueEntry.id
                                      ] ?? [];

                                    return {
                                      ...current,
                                      [activeProofCategoryQueueEntry.id]: [
                                        nextHandled,
                                        ...previousHandled.filter(
                                          (item) =>
                                            item.slug !== nextHandled.slug,
                                        ),
                                      ],
                                    };
                                  },
                                )
                              }
                              className="focus-ring rounded-md border border-[#bfe7df] bg-paper px-3 py-2 text-xs font-black uppercase text-teal hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {activeProofCategoryIsLotLocallyComplete
                                ? "Lot couvert localement"
                                : "Marquer traite localement"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                      <div className="mt-3 rounded-md border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-xs font-black leading-5 text-[#9a3412]">
                        Pas de vente: les coches locales ne publient rien et ne
                        remplacent pas les preuves exactes.
                      </div>
                    </div>
                    <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                      <summary className="cursor-pointer text-sm font-black">
                        Export file active
                      </summary>
                      <textarea
                        readOnly
                        value={activeProofCategoryQueueText}
                        rows={7}
                        className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                      />
                    </details>
                    <div className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                        <div>
                          <p className="text-xs font-black uppercase text-muted">
                            Execution lot actif
                          </p>
                          <p className="mt-1 text-xs font-bold leading-5 text-muted">
                            Checklist locale: elle aide a traiter le lot sans
                            modifier le catalogue ni lever le HOLD.
                          </p>
                        </div>
                        <span className="rounded-md bg-[#eef8f6] px-2 py-1 text-[11px] font-black uppercase text-teal ring-1 ring-[#bfe7df]">
                          {activeProofCategoryExecutionCheckedCount}/
                          {activeProofCategoryExecutionSteps.length} cochees
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {activeProofCategoryExecutionSteps.map((step) => {
                          const checked =
                            activeProofCategoryExecutionChecked.includes(
                              step.id,
                            );

                          return (
                            <label
                              key={step.id}
                              className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border border-line bg-paper px-3 py-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => {
                                  setActiveProofCategoryExecutionChecked(
                                    (current) =>
                                      event.target.checked
                                        ? Array.from(
                                            new Set([...current, step.id]),
                                          )
                                        : current.filter(
                                            (item) => item !== step.id,
                                          ),
                                  );
                                }}
                                className="mt-1 h-4 w-4 accent-teal"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-black">
                                  {step.label}
                                </span>
                                <span className="mt-1 block break-words text-xs font-bold leading-5 text-muted">
                                  {step.detail}
                                </span>
                              </span>
                              <span
                                className={`col-start-2 w-fit rounded-md px-2 py-1 text-[11px] font-black uppercase ring-1 sm:col-start-auto ${
                                  step.tone === "ready"
                                    ? "bg-[#eef8f6] text-teal ring-[#bfe7df]"
                                    : step.tone === "hold"
                                      ? "bg-[#fff7ed] text-[#9a3412] ring-[#fed7aa]"
                                      : "bg-[#f6f1e8] text-muted ring-line"
                                }`}
                              >
                                {step.statusLabel}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <details className="mt-3 rounded-md border border-line bg-paper p-3">
                        <summary className="cursor-pointer text-sm font-black">
                          Export execution lot actif
                        </summary>
                        <textarea
                          readOnly
                          value={activeProofCategoryExecutionText}
                          rows={6}
                          className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                        />
                      </details>
                    </div>
                  </div>
                ) : null}
                <div className="mt-3 rounded-md border border-[#bfe7df] bg-paper p-3">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-xs font-black uppercase text-teal">
                        Impact file
                      </p>
                      <p className="mt-1 text-xs font-bold leading-5 text-muted">
                        Effet cumule des 3 prochains couples, deduplique par
                        brouillon et sans sortie de HOLD automatique.
                      </p>
                    </div>
                    <span className="rounded-md bg-[#eef8f6] px-2 py-1 text-[11px] font-black uppercase text-teal ring-1 ring-[#bfe7df]">
                      {proofCategoryOpportunityQueueImpact.readinessPercent}%
                      prets
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <DraftMiniMetric
                      label="Couverts"
                      value={proofCategoryOpportunityQueueImpact.uniqueProductCount}
                    />
                    <DraftMiniMetric
                      label="Prets file"
                      value={proofCategoryOpportunityQueueImpact.readyAfterQueueCount}
                    />
                    <DraftMiniMetric
                      label="Restants"
                      value={proofCategoryOpportunityQueueImpact.linkedBlockerCount}
                    />
                    <DraftMiniMetric
                      label="Recoupements"
                      value={proofCategoryOpportunityQueueImpact.overlapCount}
                    />
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f1eadf]">
                    <span
                      className="block h-full rounded-full bg-teal"
                      style={{
                        width: `${proofCategoryOpportunityQueueImpact.readinessPercent}%`,
                      }}
                    />
                  </div>
                  <details className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                    <summary className="cursor-pointer text-sm font-black">
                      Export impact file
                    </summary>
                    <textarea
                      readOnly
                      value={proofCategoryOpportunityImpactText}
                      rows={5}
                      className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-3 font-mono text-xs leading-5 text-muted"
                    />
                  </details>
                </div>
                <div className="mt-3 grid gap-2 lg:grid-cols-3">
                  {displayedProofCategoryQueue.map((entry, index) => {
                    const isActive =
                      hasActiveProofCategoryQueue &&
                      entry.id === activeProofCategoryOpportunityId;

                    return (
                      <button
                        key={`proof-category-opportunity-${entry.id}`}
                        type="button"
                        onClick={() => selectProofCategoryQueueEntry(entry)}
                        className={`focus-ring rounded-md border p-3 text-left hover:bg-white ${
                          isActive
                            ? "border-teal bg-[#eef8f6]"
                            : "border-[#bfe7df] bg-paper"
                        }`}
                      >
                        <span
                          className={`rounded-md px-2 py-1 text-[11px] font-black uppercase ring-1 ${
                            isActive
                              ? "bg-teal text-white ring-teal"
                              : "bg-[#eef8f6] text-teal ring-[#bfe7df]"
                          }`}
                        >
                          {isActive ? "Actif" : `#${index + 1}`}
                        </span>
                        <span className="mt-2 block text-sm font-black">
                          {entry.proofLabel} / {entry.categoryLabel}
                        </span>
                        <span className="mt-2 grid gap-1 text-xs font-bold leading-5 text-muted">
                          <span>{entry.count} brouillon(s)</span>
                          <span>{entry.readyAfterZoneCount} pret(s) apres preuve</span>
                          <span>{entry.linkedBlockerCount} blocage(s) lie(s)</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <details className="mt-3 rounded-md border border-[#bfe7df] bg-paper p-3">
                  <summary className="cursor-pointer text-sm font-black">
                    Export file 3 couples
                  </summary>
                  <textarea
                    readOnly
                    value={proofCategoryOpportunityQueueText}
                    rows={7}
                    className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                  />
                </details>
                <details className="mt-3 rounded-md border border-[#bfe7df] bg-paper p-3">
                  <summary className="cursor-pointer text-sm font-black">
                    Export couple recommande
                  </summary>
                  <textarea
                    readOnly
                    value={topProofCategoryOpportunityText}
                    rows={6}
                    className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                  />
                </details>
              </div>
            ) : null}
          </div>
          <details className="rounded-md border border-line bg-paper p-3">
            <summary className="cursor-pointer text-sm font-black">
              Lot de reprise par preuve
            </summary>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-md bg-[#f6f1e8] px-2 py-1 text-muted">
                Zone:{" "}
                {activeProofBatchZone
                  ? draftProofZoneLabels[activeProofBatchZone]
                  : "Aucune"}
              </span>
              <span className="rounded-md bg-[#f6f1e8] px-2 py-1 text-muted">
                {proofBatchCount} brouillon(s)
              </span>
              <span className="rounded-md bg-[#fff7ed] px-2 py-1 text-[#9a3412]">
                Export passif, validation humaine obligatoire
              </span>
            </div>
            <textarea
              readOnly
              value={proofBatchText}
              rows={7}
              className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
            />
          </details>
          {activeProofBatchZone ? (
            <div className="rounded-md border border-line bg-paper p-3">
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                <div>
                  <p className="text-xs font-black uppercase text-muted">
                    Pilotage lot actif
                  </p>
                  <h4 className="mt-1 text-base font-black">
                    {draftProofZoneLabels[activeProofBatchZone]}
                  </h4>
                </div>
                <button
                  type="button"
                  disabled={!proofBatchTopProduct}
                  onClick={() => {
                    setSelectedProductId(proofBatchTopProduct?.id ?? "");
                    setCompactView(false);
                  }}
                  className="focus-ring min-h-10 rounded-md border border-line bg-paper px-3 text-xs font-black hover:bg-[#f1eadf] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sélectionner prochain brouillon
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <DraftMiniMetric label="Lot actif" value={proofBatchCount} />
                <DraftMiniMetric
                  label="Priorité max"
                  value={proofBatchTopPriority?.score ?? 0}
                />
                <DraftMiniMetric
                  label="Prêts après preuve"
                  value={proofBatchReadyAfterZoneCount}
                />
                <DraftMiniMetric
                  label="Blocages liés"
                  value={proofBatchSecondarySummary.reduce(
                    (total, entry) => total + entry.count,
                    0,
                  )}
                />
              </div>
              {proofBatchTopProduct ? (
                <div className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3 text-xs font-bold leading-5 text-muted">
                  <span className="font-black text-foreground">
                    Prochain : {proofBatchTopProduct.name}
                  </span>
                  <span className="ml-2">{proofBatchTopProduct.slug}</span>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {proofBatchSecondarySummary.length > 0 ? (
                  proofBatchSecondarySummary.map((entry) => (
                    <button
                      key={`secondary-proof-${entry.id}`}
                      type="button"
                      onClick={() => {
                        setProofFilter(entry.id);
                        setShowReadyCategoryOnly(false);
                        setActiveProofCategoryQueue([]);
                        setActiveProofCategoryOpportunityId("");
                      }}
                      className="focus-ring rounded-md border border-line bg-[#fbfaf7] px-2 py-1 text-[11px] font-black uppercase text-muted hover:bg-[#f1eadf]"
                    >
                      Puis {entry.label}: {entry.count}
                    </button>
                  ))
                ) : (
                  <span className="rounded-md border border-[#bfe7df] bg-[#eef8f6] px-2 py-1 text-[11px] font-black uppercase text-teal">
                    Aucun autre blocage preuve dans ce lot
                  </span>
                )}
              </div>
              {proofBatchCategoryAllSummary.length > 0 ? (
                <div className="mt-3 rounded-md border border-line bg-[#fbfaf7] p-3">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <div>
                      <div className="text-xs font-black uppercase text-muted">
                        Rayons du lot
                      </div>
                      <p className="mt-1 text-xs font-bold leading-5 text-muted">
                        Regrouper la reprise par categorie pour traiter les
                        preuves les plus rapides sans publier.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-md bg-paper px-2 py-1 text-[11px] font-black uppercase text-muted ring-1 ring-line">
                        {proofBatchCategorySummary.length} /{" "}
                        {proofBatchCategoryAllSummary.length} groupe(s)
                      </span>
                      <span className="rounded-md bg-paper px-2 py-1 text-[11px] font-black uppercase text-muted ring-1 ring-line">
                        Tri maturite
                      </span>
                      <button
                        type="button"
                        disabled={proofBatchReadyCategoryCount === 0}
                        onClick={() => {
                          setShowReadyCategoryOnly((current) => !current);
                          setActiveProofCategoryQueue([]);
                          setActiveProofCategoryOpportunityId("");
                        }}
                        className={`focus-ring rounded-md px-2 py-1 text-[11px] font-black uppercase ring-1 disabled:cursor-not-allowed disabled:opacity-50 ${
                          showReadyCategoryOnly
                            ? "bg-[#eef8f6] text-teal ring-[#bfe7df]"
                            : "bg-paper text-muted ring-line hover:bg-[#f1eadf]"
                        }`}
                      >
                        {showReadyCategoryOnly
                          ? "Tous les rayons"
                          : `Rayons quasi prets (${proofBatchReadyCategoryCount})`}
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 lg:grid-cols-2">
                    {proofBatchCategorySummary.length > 0 ? (
                      proofBatchCategorySummary.map((entry) => (
                        <button
                          key={`proof-category-${entry.id}`}
                          type="button"
                          onClick={() => {
                            setSearchQuery(entry.id);
                            setSelectedProductId(entry.topProduct?.id ?? "");
                            setActiveProofCategoryQueue([]);
                            setActiveProofCategoryOpportunityId("");
                            setCompactView(false);
                          }}
                          className="focus-ring rounded-md border border-line bg-paper p-3 text-left hover:bg-[#f1eadf]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-sm font-black">
                              {entry.label}
                            </span>
                            <span className="rounded-md bg-[#f6f1e8] px-2 py-1 text-[11px] font-black text-muted">
                              {entry.count}
                            </span>
                          </div>
                          <div className="mt-2 grid gap-1 text-xs font-bold leading-5 text-muted">
                            <span
                              className={`w-fit rounded-md px-2 py-1 text-[11px] font-black uppercase ring-1 ${entry.maturity.className}`}
                            >
                              Maturite: {entry.maturity.label}
                            </span>
                            <span>
                              Priorite max: {Math.max(entry.topPriorityScore, 0)}
                            </span>
                            <span>
                              Prets apres preuve: {entry.readyAfterZoneCount}
                            </span>
                            <span>
                              Blocages lies: {entry.linkedBlockerCount}
                            </span>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f1eadf]">
                            <span
                              className="block h-full rounded-full bg-teal"
                              style={{ width: `${entry.maturity.percent}%` }}
                            />
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-md border border-dashed border-line bg-paper p-3 text-xs font-bold leading-5 text-muted">
                        Aucun rayon quasi pret dans ce lot: traiter d&apos;abord les
                        groupes avec le moins de blocages lies.
                      </div>
                    )}
                  </div>
                  <details className="mt-3 rounded-md border border-line bg-paper p-3">
                    <summary className="cursor-pointer text-sm font-black">
                      Export rayons quasi prets
                    </summary>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                      <span className="rounded-md bg-[#f6f1e8] px-2 py-1 text-muted">
                        {proofBatchReadyCategoryCount} rayon(s)
                      </span>
                      <span className="rounded-md bg-[#fff7ed] px-2 py-1 text-[#9a3412]">
                        Export passif, validation humaine obligatoire
                      </span>
                    </div>
                    <textarea
                      readOnly
                      value={proofBatchReadyCategoriesText}
                      rows={5}
                      className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                    />
                  </details>
                  {proofBatchTopCategory ? (
                    <details className="mt-3 rounded-md border border-line bg-paper p-3">
                      <summary className="cursor-pointer text-sm font-black">
                        Export rayon prioritaire
                      </summary>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                        <span className="rounded-md bg-[#f6f1e8] px-2 py-1 text-muted">
                          Rayon: {proofBatchTopCategory.label}
                        </span>
                        <span className="rounded-md bg-[#f6f1e8] px-2 py-1 text-muted">
                          {proofBatchTopCategory.count} brouillon(s)
                        </span>
                        <span className="rounded-md bg-[#fff7ed] px-2 py-1 text-[#9a3412]">
                          Export passif, validation humaine obligatoire
                        </span>
                        <span
                          className={`rounded-md px-2 py-1 ring-1 ${proofBatchTopCategory.maturity.className}`}
                        >
                          Maturite: {proofBatchTopCategory.maturity.label} -{" "}
                          {proofBatchTopCategory.maturity.percent}%
                        </span>
                      </div>
                      <textarea
                        readOnly
                        value={proofBatchTopCategoryText}
                        rows={6}
                        className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
                      />
                    </details>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <label className="inline-flex w-fit items-center gap-2 text-sm font-black">
            <input
              type="checkbox"
              checked={compactView}
              onChange={(event) => setCompactView(event.target.checked)}
            />
            Vue compacte
          </label>
          <details className="rounded-md border border-line bg-paper p-3">
            <summary className="cursor-pointer text-sm font-black">
              Revue passive des brouillons visibles
            </summary>
            <textarea
              readOnly
              value={filteredReviewText}
              rows={8}
              className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
            />
          </details>
          {selectedProduct ? (
            <details className="rounded-md border border-line bg-paper p-3">
              <summary className="cursor-pointer text-sm font-black">
                Revue passive du brouillon sélectionné
              </summary>
              <textarea
                readOnly
                value={selectedReviewText}
                rows={6}
                className="mt-3 w-full resize-y rounded-md border border-line bg-[#fbfaf7] px-3 py-3 font-mono text-xs leading-5 text-muted"
              />
            </details>
          ) : null}
        </div>
      ) : null}

      {products.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-6 text-sm font-bold text-muted">
          Aucun brouillon partenaire en attente. Les prochains imports valides
          apparaitront ici avec leur statut de validation, leur gate humain et
          le lien de reprise sans publier ni commander.
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-6 text-sm font-bold text-muted">
          Aucun brouillon ne correspond aux filtres actifs. Ajuster la recherche
          ou afficher tous les gates pour reprendre la liste complete, sans
          modifier les donnees.
        </div>
      ) : (
        <div className="grid min-w-0 gap-4">
          {compactView ? (
            <div className="rounded-md border border-line bg-[#fbfaf7] p-3 text-sm font-bold text-muted">
              Vue compacte active : file de priorité et détail masqués pour
              scanner le tableau filtré plus vite.
            </div>
          ) : (
          <div className="rounded-lg border border-line bg-[#fbfaf7] p-4">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div>
                <p className="text-xs font-black uppercase text-teal">
                  File de priorité passive
                </p>
                <h3 className="mt-1 text-lg font-black">
                  Brouillons à reprendre en premier
                </h3>
              </div>
              <span className="rounded-md bg-paper px-3 py-2 text-xs font-black text-muted ring-1 ring-line">
                Tri local sans publication
              </span>
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-3">
              {priorityQueue.map(({ product, priority }) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setSelectedProductId(product.id)}
                  className="focus-ring rounded-md border border-line bg-paper p-3 text-left hover:bg-[#f1eadf]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black">{product.name}</span>
                    <span className="rounded-md bg-[#f6f1e8] px-2 py-1 text-xs font-black text-muted">
                      {priority.score}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-bold leading-5 text-muted">
                    {priority.label}
                  </p>
                </button>
              ))}
            </div>
          </div>
          )}

          {!compactView && selectedProduct ? (
            <DraftProductDetails product={selectedProduct} />
          ) : null}

          <div className="min-w-0 max-w-full overflow-x-auto rounded-lg border border-line">
            <table className="min-w-[1080px] w-full border-collapse text-left text-sm">
              <thead className="bg-[#f6f1e8] text-xs font-black uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Validation</th>
                  <th className="px-4 py-3">Priorité</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Dernier gate</th>
                  <th className="px-4 py-3">Détails</th>
                  <th className="px-4 py-3">Reprise</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const validation = getDraftValidationState(product);
                  const priority = getDraftPriority(product);
                  const gate = product.dropshipping?.validationGate;
                  const isSelected = selectedProduct?.id === product.id;

                  return (
                    <tr
                      key={product.id}
                      className={`border-t border-line align-top ${
                        isSelected ? "bg-[#eef8f6]" : ""
                      }`}
                    >
                      <td className="px-4 py-4">
                        <div className="font-black">{product.name}</div>
                        <div className="mt-1 text-xs font-bold text-muted">
                          {product.slug}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-md bg-paper px-2 py-1 text-xs font-black text-muted ring-1 ring-line">
                          {product.status ?? "draft"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-black ring-1 ${validation.className}`}
                        >
                          {validation.label}
                        </span>
                        <div className="mt-2 text-xs font-bold text-muted">
                          {validation.detail}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-black ring-1 ${
                            priority.score > 0
                              ? "bg-[#fff7ed] text-[#9a3412] ring-[#fed7aa]"
                              : "bg-[#eef8f6] text-teal ring-[#bfe7df]"
                          }`}
                        >
                          Score {priority.score}
                        </span>
                        <div className="mt-2 text-xs font-bold leading-5 text-muted">
                          {priority.label}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs font-bold text-muted">
                        <div>{gate?.source ?? "source non tracee"}</div>
                        {gate?.candidateId ? (
                          <div className="mt-1">Candidat : {gate.candidateId}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-xs font-bold text-muted">
                        {formatDraftDate(gate?.checkedAt ?? product.dropshipping?.lastSyncAt)}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedProductId(product.id)}
                          className="focus-ring inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-paper px-3 text-sm font-black hover:bg-[#f1eadf]"
                        >
                          Voir
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/admin/produits/${product.slug}/modifier`}
                          className="focus-ring inline-flex min-h-10 items-center justify-center rounded-md bg-foreground px-3 text-sm font-black text-white hover:bg-[#2b2b2b]"
                        >
                          Reprendre
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function DraftMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-[#fbfaf7] p-3">
      <div className="text-xs font-black uppercase text-muted">{label}</div>
      <div className="mt-1 text-2xl font-black text-foreground">{value}</div>
    </div>
  );
}

function DraftMiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-paper px-3 py-2">
      <div className="text-[11px] font-black uppercase text-muted">{label}</div>
      <div className="mt-1 text-lg font-black text-foreground">{value}</div>
    </div>
  );
}

function DraftProofMetric({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="rounded-md border border-line bg-paper p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase text-muted">{label}</div>
          <div className="mt-1 text-2xl font-black text-foreground">{value}</div>
        </div>
        <span
          className={`rounded-md px-2 py-1 text-[11px] font-black uppercase ${
            value > 0 ? "bg-[#fff7ed] text-[#9a3412]" : "bg-[#eef8f6] text-teal"
          }`}
        >
          {percent}%
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f1eadf]">
        <span
          className={`block h-full rounded-full ${
            value > 0 ? "bg-[#9a3412]" : "bg-teal"
          }`}
          style={{ width: value > 0 ? `${Math.max(percent, 8)}%` : "0%" }}
        />
      </div>
    </div>
  );
}

function DraftProductDetails({ product }: { product: Product }) {
  const validation = getDraftValidationState(product);
  const gate = product.dropshipping?.validationGate;
  const supplierUrl = product.dropshipping?.supplierUrl;
  const reviewChecklist = getDraftReviewChecklist(product);
  const missingProofs = getDraftMissingProofs(product);
  const remainingReviewItems = reviewChecklist.filter((item) => !item.done);
  const completedReviewItems = reviewChecklist.filter((item) => item.done).length;
  const reviewProgress = Math.round(
    (completedReviewItems / reviewChecklist.length) * 100,
  );

  return (
    <article className="rounded-lg border border-[#bfe7df] bg-[#eef8f6] p-4">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-black uppercase text-teal">
            Détail brouillon sélectionné
          </p>
          <h3 className="mt-1 text-xl font-black">{product.name}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            {product.shortDescription || product.description || "Description à compléter avant publication."}
          </p>
        </div>
        <Link
          href={`/admin/produits/${product.slug}/modifier`}
          className="focus-ring inline-flex min-h-10 items-center justify-center rounded-md bg-foreground px-3 text-sm font-black text-white hover:bg-[#2b2b2b]"
        >
          Reprendre ce brouillon
        </Link>
      </div>

      <div className="mt-4 rounded-md border border-line bg-paper p-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-black">Progression passive de reprise</span>
          <span className="font-black text-teal">
            {completedReviewItems}/{reviewChecklist.length} - {reviewProgress}%
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f1eadf]">
          <div
            className="h-full rounded-full bg-teal"
            style={{ width: `${reviewProgress}%` }}
          />
        </div>
        <div className="mt-3 rounded-md bg-[#fbfaf7] p-3 text-xs font-bold text-muted">
          {remainingReviewItems.length === 0 ? (
            <span>Revue finale possible avant décision humaine.</span>
          ) : (
            <span>
              Restant : {remainingReviewItems.map((item) => item.label).join(", ")}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Metric label="Prix vente" value={formatPrice(product.price)} />
        <Metric
          label="Prix fournisseur"
          value={
            product.dropshipping?.supplierPriceCents
              ? formatPrice(product.dropshipping.supplierPriceCents)
              : "À vérifier"
          }
        />
        <Metric
          label="Délai"
          value={product.dropshipping?.deliveryEstimate || "À confirmer"}
        />
      </div>

      <div className="mt-4 rounded-md border border-line bg-paper p-3 text-sm">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <div className="font-black">Preuves bloquantes</div>
            <p className="mt-1 text-xs font-bold leading-5 text-muted">
              Zones a completer avant publication ou vente.
            </p>
          </div>
          <span
            className={`rounded-md px-2 py-1 text-[11px] font-black uppercase ${
              missingProofs.length > 0
                ? "bg-[#fff7ed] text-[#9a3412]"
                : "bg-[#eef8f6] text-teal"
            }`}
          >
            {missingProofs.length} manquante(s)
          </span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {missingProofs.length > 0 ? (
            missingProofs.map((proof) => (
              <div
                key={proof.id}
                className="rounded-md border border-[#fed7aa] bg-[#fff7ed] px-3 py-2"
              >
                <div className="text-xs font-black uppercase text-[#9a3412]">
                  {proof.label}
                </div>
                <p className="mt-1 text-xs font-bold leading-5 text-[#9a3412]">
                  {proof.detail}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-md border border-[#bfe7df] bg-[#eef8f6] px-3 py-2 text-xs font-black text-teal">
              Aucune preuve bloquante detectee sur ce brouillon.
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-md border border-line bg-paper p-3 text-sm">
          <div className="font-black">Validation humaine</div>
          <span
            className={`mt-2 inline-flex rounded-md px-2 py-1 text-xs font-black ring-1 ${validation.className}`}
          >
            {validation.label}
          </span>
          <p className="mt-2 leading-6 text-muted">{validation.detail}</p>
          {gate?.checks?.length ? (
            <ul className="mt-3 grid gap-1 text-xs font-bold text-muted">
              {gate.checks.map((check) => (
                <li key={check}>- {check}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs font-bold text-[#9a3412]">
              Aucun contrôle détaillé tracé pour l&apos;instant.
            </p>
          )}
        </div>

        <div className="rounded-md border border-line bg-paper p-3 text-sm">
          <div className="font-black">Source fournisseur</div>
          <div className="mt-2 grid gap-1 text-xs font-bold text-muted">
            <span>Source : {gate?.source ?? "non tracée"}</span>
            <span>Candidat : {gate?.candidateId ?? "non renseigné"}</span>
            <span>Catégorie : {gate?.candidateCategory ?? product.categoryId}</span>
            <span>
              Dernier contrôle :{" "}
              {formatDraftDate(gate?.checkedAt ?? product.dropshipping?.lastSyncAt)}
            </span>
          </div>
          {supplierUrl ? (
            <Link
              href={supplierUrl}
              target="_blank"
              className="focus-ring mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
            >
              Ouvrir le lien fournisseur
              <ExternalLink size={15} aria-hidden="true" />
            </Link>
          ) : (
            <div className="mt-3 rounded-md border border-[#fed7aa] bg-[#fff7ed] p-3 text-xs font-black text-[#9a3412]">
              Lien fournisseur absent : à compléter avant publication.
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-md border border-line bg-paper p-3 text-sm">
        <div className="font-black">Checklist passive de reprise</div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {reviewChecklist.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-md border border-line bg-[#fbfaf7] px-3 py-2"
            >
              <span className="text-xs font-bold text-muted">{item.label}</span>
              <span
                className={`rounded-md px-2 py-1 text-[11px] font-black ring-1 ${
                  item.done
                    ? "bg-[#eef8f6] text-teal ring-[#bfe7df]"
                    : "bg-[#fff7ed] text-[#9a3412] ring-[#fed7aa]"
                }`}
              >
                {item.statusLabel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function getOrderStockDecrementBadge(order: DropshippingOrder) {
  if (order.stockDecrementStatus === "done") {
    return {
      label: "Stock ajuste",
      className: "bg-[#eef8f6] text-teal ring-[#bfe7df]",
    };
  }

  if (order.stockDecrementStatus === "failed") {
    return {
      label: "Stock a verifier",
      className: "bg-[#fff7ed] text-[#9a3412] ring-[#fed7aa]",
    };
  }

  if (order.stockDecrementStatus === "skipped") {
    return {
      label: "Stock ignore",
      className: "bg-paper text-muted ring-line",
    };
  }

  return {
    label:
      order.paymentStatus === "paid" ? "Stock a verifier" : "En attente paiement",
    className:
      order.paymentStatus === "paid"
        ? "bg-[#fff7ed] text-[#9a3412] ring-[#fed7aa]"
        : "bg-paper text-muted ring-line",
  };
}

function OrderOperationsSummaryPanel({
  summary,
}: {
  summary: ReturnType<typeof getDropshippingOrderOperationsSummary>;
}) {
  const hasStockExceptions = summary.stockExceptionCount > 0;

  return (
    <div className="grid gap-3 border-y border-line bg-[#fbfaf7] px-1 py-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OrderSafetyMetric
          label="Commandes fournisseur"
          value={`${summary.readyCount}/${summary.totalCount}`}
          detail="Payees avec stock webhook ajuste"
          className="text-teal"
        />
        <OrderSafetyMetric
          label="Paiements confirmes"
          value={String(summary.paidCount)}
          detail="Webhook Stripe paye"
        />
        <OrderSafetyMetric
          label="Bloquees"
          value={String(summary.blockedCount)}
          detail="Action source verrouillee"
          className={summary.blockedCount > 0 ? "text-[#9a3412]" : "text-teal"}
        />
        <OrderSafetyMetric
          label="Exceptions stock"
          value={String(summary.stockExceptionCount)}
          detail="A reprendre avant fournisseur"
          className={hasStockExceptions ? "text-[#9a3412]" : "text-teal"}
        />
      </div>

      {hasStockExceptions ? (
        <div className="flex items-start gap-2 rounded-md bg-[#fff7ed] p-3 text-sm font-bold text-[#9a3412]">
          <AlertTriangle className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
          <div>
            <div>Commandes payees avec stock webhook non valide: action fournisseur bloquee.</div>
            <div className="mt-1 text-xs">
              {summary.stockExceptions
                .map((order) => `${order.orderNumber} (${order.status})`)
                .join(" / ")}
              {summary.stockExceptionCount > summary.stockExceptions.length ? " / ..." : ""}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-md bg-[#eef8f6] p-3 text-sm font-bold text-teal">
          <ShieldCheck className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
          <span>
            Les actions fournisseur ne s&apos;ouvrent que si le paiement est confirme et le
            stock webhook ajuste.
          </span>
        </div>
      )}
    </div>
  );
}

function OrderSafetyMetric({
  label,
  value,
  detail,
  className = "text-foreground",
}: {
  label: string;
  value: string;
  detail: string;
  className?: string;
}) {
  return (
    <div className="min-w-0 text-sm">
      <div className="font-black uppercase text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-black ${className}`}>{value}</div>
      <div className="text-xs font-bold text-muted">{detail}</div>
    </div>
  );
}

function OrderCard({
  order,
  onUpdate,
}: {
  order: DropshippingOrder;
  onUpdate: (
    orderId: string,
    patch: {
      status?: DropshippingOrderStatus;
      trackingNumber?: string;
      supplierOrderReference?: string;
      prepareFollowUp?: boolean;
    },
  ) => Promise<void>;
}) {
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber ?? "");
  const [supplierOrderReference, setSupplierOrderReference] = useState(
    order.supplierOrderReference ?? "",
  );
  const stockDecrementBadge = getOrderStockDecrementBadge(order);
  const supplierActionReadiness = getDropshippingSupplierActionReadiness(order);
  const supplierActionsEnabled = supplierActionReadiness.ready;

  return (
    <article className="rounded-lg border border-line bg-[#fbfaf7] p-4">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-black">{order.orderNumber}</h3>
            <StatusBadge status={order.status} />
            <span className="rounded-md bg-paper px-2 py-1 text-xs font-black text-muted ring-1 ring-line">
              Paiement : {order.paymentStatus}
            </span>
            <span
              className={`rounded-md px-2 py-1 text-xs font-black ring-1 ${stockDecrementBadge.className}`}
            >
              {stockDecrementBadge.label}
            </span>
            <span
              className={`rounded-md px-2 py-1 text-xs font-black ring-1 ${supplierActionReadiness.className}`}
            >
              {supplierActionReadiness.label}
            </span>
          </div>
          <div className="mt-3 grid gap-1 text-sm leading-6 text-muted">
            <span>
              Client : <strong>{order.customer.name || "À compléter"}</strong>
            </span>
            <span>
              Contact : {order.customer.email || "email manquant"} /{" "}
              {order.customer.phone || "telephone manquant"}
            </span>
            <span>
              Livraison : {order.shippingAddress.street},{" "}
              {order.shippingAddress.postalCode} {order.shippingAddress.city}
            </span>
            {order.stockDecrementedAt ? (
              <span>Stock webhook : {formatDraftDate(order.stockDecrementedAt)}</span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-1 rounded-md bg-paper p-3 text-sm">
          <div className="flex justify-between gap-5">
            <span className="text-muted">Prix vendu</span>
            <strong>{formatPrice(order.soldTotalCents)}</strong>
          </div>
          <div className="flex justify-between gap-5">
            <span className="text-muted">Prix fournisseur</span>
            <strong>{formatPrice(order.supplierTotalCents)}</strong>
          </div>
          <div className="flex justify-between gap-5">
            <span className="text-muted">Marge estimée</span>
            <strong className="text-teal">{formatPrice(order.estimatedMarginCents)}</strong>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {order.lines.map((line) => (
          <div
            key={`${order.id}-${line.productId}`}
            className="grid gap-3 rounded-md border border-line bg-paper p-3 md:grid-cols-[84px_1fr]"
          >
            <div className="relative aspect-square overflow-hidden rounded-md bg-[#ede7db]">
              <Image
                src={line.image}
                alt={line.productName}
                fill
                sizes="84px"
                className="object-cover"
              />
            </div>
            <div className="grid gap-2 text-sm">
              <div className="flex flex-col justify-between gap-2 md:flex-row md:items-start">
                <div>
                  <div className="font-black">{line.productName}</div>
                  <div className="text-muted">Quantité : {line.quantity}</div>
                </div>
                {line.supplierUrl ? (
                  <Link
                    href={line.supplierUrl}
                    target="_blank"
                    className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
                  >
                    Lien fournisseur
                    <ExternalLink size={15} aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="inline-flex min-h-10 items-center rounded-md border border-[#fed7aa] px-3 text-sm font-black text-[#9a3412]">
                    Lien fournisseur à remplir
                  </span>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                <Metric label="SKU" value={line.supplierSku || "À remplir"} />
                <Metric label="Prix fournisseur" value={formatPrice(line.supplierPriceCents)} />
                <Metric label="Prix vendu" value={formatPrice(line.soldPriceCents)} />
                <Metric label="Délai" value={line.deliveryEstimate} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        className={`mt-4 flex items-start gap-2 rounded-md p-3 text-sm font-bold ring-1 ${
          supplierActionsEnabled
            ? "bg-[#eef8f6] text-teal ring-[#bfe7df]"
            : "bg-[#fff7ed] text-[#9a3412] ring-[#fed7aa]"
        }`}
      >
        {supplierActionsEnabled ? (
          <ShieldCheck className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
        ) : (
          <AlertTriangle className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
        )}
        <span>
          {supplierActionsEnabled
            ? "Actions fournisseur ouvertes: paiement confirme et stock webhook ajuste."
            : `Actions fournisseur bloquees: ${supplierActionReadiness.detail}`}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <button
          type="button"
          disabled={!supplierActionsEnabled}
          onClick={() => onUpdate(order.id, { status: "pret-a-commander" })}
          className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-paper px-3 text-sm font-black ${
            supplierActionsEnabled
              ? "hover:bg-[#f1eadf]"
              : "cursor-not-allowed opacity-60"
          }`}
        >
          <ClipboardList size={16} aria-hidden="true" />
          Préparer commande fournisseur
        </button>
        <div
          className={`flex rounded-md border border-line bg-paper ${
            supplierActionsEnabled ? "" : "opacity-70"
          }`}
        >
          <input
            value={supplierOrderReference}
            onChange={(event) => setSupplierOrderReference(event.target.value)}
            disabled={!supplierActionsEnabled}
            className="min-h-11 min-w-0 flex-1 rounded-l-md px-3 text-sm disabled:cursor-not-allowed"
            placeholder="Référence fournisseur"
          />
          <button
            type="button"
            disabled={!supplierActionsEnabled}
            onClick={() =>
              onUpdate(order.id, {
                status: "commande-fournisseur",
                supplierOrderReference,
              })
            }
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-r-md bg-foreground px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCircle2 size={16} aria-hidden="true" />
            Commandé
          </button>
        </div>
        <div
          className={`flex rounded-md border border-line bg-paper ${
            supplierActionsEnabled ? "" : "opacity-70"
          }`}
        >
          <input
            value={trackingNumber}
            onChange={(event) => setTrackingNumber(event.target.value)}
            disabled={!supplierActionsEnabled}
            className="min-h-11 min-w-0 flex-1 rounded-l-md px-3 text-sm disabled:cursor-not-allowed"
            placeholder="Numéro de suivi"
          />
          <button
            type="button"
            disabled={!supplierActionsEnabled}
            onClick={() =>
              onUpdate(order.id, {
                status: "expedie",
                trackingNumber,
              })
            }
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-r-md bg-foreground px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Truck size={16} aria-hidden="true" />
            Ajouter
          </button>
        </div>
        <button
          type="button"
          disabled={!supplierActionsEnabled}
          onClick={() => onUpdate(order.id, { prepareFollowUp: true })}
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand px-3 text-sm font-black text-foreground hover:bg-[#ffd166] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send size={16} aria-hidden="true" />
          Envoyer suivi au client
        </button>
      </div>

      {order.internalNote ? (
        <div className="mt-4 flex items-start gap-2 rounded-md bg-[#fff7ed] p-3 text-sm font-bold text-[#9a3412]">
          <AlertTriangle className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
          <span>{order.internalNote}</span>
        </div>
      ) : null}
    </article>
  );
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
  defaultValue,
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
      />
    </label>
  );
}

function PricingField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
        inputMode="decimal"
        placeholder={formatInputPrice(0)}
      />
    </label>
  );
}

function CheckBox({
  name,
  label,
  defaultChecked = false,
  required = false,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  required?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-black">
      <input
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        required={required}
      />
      {label}
    </label>
  );
}

function StatusBadge({ status }: { status: DropshippingOrderStatus }) {
  return (
    <span className="rounded-md bg-[#eef8f6] px-2 py-1 text-xs font-black text-teal ring-1 ring-[#bfe7df]">
      {dropshippingStatusLabels[status]}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line p-2">
      <div className="text-[11px] font-black uppercase text-muted">{label}</div>
      <div className="mt-1 font-black">{value}</div>
    </div>
  );
}

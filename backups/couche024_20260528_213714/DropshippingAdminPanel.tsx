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
import { useMemo, useState } from "react";
import type { Category, Product } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { QUICK_PRODUCTS_UPDATED_EVENT } from "@/lib/quick-products";
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
    <div className="container-page grid gap-8 py-10">
      <section className="grid gap-4 rounded-lg border border-line bg-paper p-5 shadow-sm">
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

      <DraftProductsTable products={initialDraftProducts} />

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <form
          onSubmit={importProduct}
          className="grid gap-4 rounded-lg border border-line bg-paper p-5 shadow-sm"
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
      ].join("\n");
    })
    .join("\n\n");
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

function DraftProductsTable({ products }: { products: Product[] }) {
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");
  const [gateFilter, setGateFilter] = useState<DraftGateFilter>("all");
  const [supplierFilter, setSupplierFilter] = useState<DraftSupplierFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<DraftPriorityFilter>("all");
  const [sortMode, setSortMode] = useState<DraftSortMode>("priority-desc");
  const [searchQuery, setSearchQuery] = useState("");
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
  }, [gateFilter, priorityFilter, products, searchQuery, sortMode, supplierFilter]);
  const filteredSummary = useMemo(
    () => getDraftDashboardSummary(filteredProducts),
    [filteredProducts],
  );
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
  const hasActiveDraftFilters =
    gateFilter !== "all" ||
    supplierFilter !== "all" ||
    priorityFilter !== "all" ||
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

  return (
    <section className="grid gap-4 rounded-lg border border-line bg-paper p-5 shadow-sm">
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
        <div className="grid gap-3 rounded-lg border border-line bg-[#fbfaf7] p-4">
          <div className="flex flex-col justify-between gap-2 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-black uppercase text-teal">
                Filtres passifs
              </p>
              <h3 className="mt-1 text-lg font-black">
                Affiner les brouillons à reprendre
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md bg-paper px-3 py-2 text-xs font-black text-muted ring-1 ring-line">
                {filteredProducts.length} / {products.length} visible(s)
              </span>
              <button
                type="button"
                disabled={!hasActiveDraftFilters}
                onClick={() => {
                  setGateFilter("all");
                  setSupplierFilter("all");
                  setPriorityFilter("all");
                  setSearchQuery("");
                }}
                className="focus-ring min-h-9 rounded-md border border-line bg-paper px-3 text-xs font-black hover:bg-[#f1eadf] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Réinitialiser
              </button>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_180px_180px]">
            <label className="grid gap-2 text-sm font-bold">
              Recherche
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
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
        <div className="grid gap-4">
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

          {selectedProduct ? <DraftProductDetails product={selectedProduct} /> : null}

          <div className="overflow-x-auto rounded-lg border border-line">
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

function DraftProductDetails({ product }: { product: Product }) {
  const validation = getDraftValidationState(product);
  const gate = product.dropshipping?.validationGate;
  const supplierUrl = product.dropshipping?.supplierUrl;
  const reviewChecklist = getDraftReviewChecklist(product);

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

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <button
          type="button"
          onClick={() => onUpdate(order.id, { status: "pret-a-commander" })}
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-paper px-3 text-sm font-black hover:bg-[#f1eadf]"
        >
          <ClipboardList size={16} aria-hidden="true" />
          Préparer commande fournisseur
        </button>
        <div className="flex rounded-md border border-line bg-paper">
          <input
            value={supplierOrderReference}
            onChange={(event) => setSupplierOrderReference(event.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-l-md px-3 text-sm"
            placeholder="Référence fournisseur"
          />
          <button
            type="button"
            onClick={() =>
              onUpdate(order.id, {
                status: "commande-fournisseur",
                supplierOrderReference,
              })
            }
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-r-md bg-foreground px-3 text-sm font-black text-white"
          >
            <CheckCircle2 size={16} aria-hidden="true" />
            Commandé
          </button>
        </div>
        <div className="flex rounded-md border border-line bg-paper">
          <input
            value={trackingNumber}
            onChange={(event) => setTrackingNumber(event.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-l-md px-3 text-sm"
            placeholder="Numéro de suivi"
          />
          <button
            type="button"
            onClick={() =>
              onUpdate(order.id, {
                status: "expedie",
                trackingNumber,
              })
            }
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-r-md bg-foreground px-3 text-sm font-black text-white"
          >
            <Truck size={16} aria-hidden="true" />
            Ajouter
          </button>
        </div>
        <button
          type="button"
          onClick={() => onUpdate(order.id, { prepareFollowUp: true })}
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand px-3 text-sm font-black text-foreground hover:bg-[#ffd166]"
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

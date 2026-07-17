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
  connectorStatus: ConnectorStatus[];
  dropshippingCategories: Category[];
  prefill?: PartnerImportPrefill;
};

type PartnerImportPrefill = {
  title?: string;
  supplierUrl?: string;
  categoryId?: string;
  description?: string;
  deliveryEstimate?: string;
};

export function DropshippingAdminPanel({
  initialOrders,
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
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-black">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} />
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

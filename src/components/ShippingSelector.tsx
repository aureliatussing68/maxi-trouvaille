"use client";

import { MapPin, PackageCheck, Truck } from "lucide-react";
import { formatPrice } from "@/lib/format";
import type { ShippingMethod, ShippingSelection } from "@/lib/shipping";

type ShippingSelectorProps = {
  selection: ShippingSelection;
  onChange: (selection: ShippingSelection) => void;
  availableMethods: ShippingMethod[];
  error?: string;
};

function patchCustomer(
  selection: ShippingSelection,
  patch: Partial<ShippingSelection["customer"]>,
): ShippingSelection {
  return {
    ...selection,
    customer: {
      ...selection.customer,
      ...patch,
    },
  };
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
        type={type}
        autoComplete={autoComplete}
      />
    </label>
  );
}

export function ShippingSelector({
  selection,
  onChange,
  availableMethods,
  error,
}: ShippingSelectorProps) {
  const selectedMethod = availableMethods.find(
    (method) => method.id === selection.methodId,
  );
  const needsRelayDetails = selection.methodId === "mondial-relay";
  const needsAddress = selection.methodId === "colissimo";
  const needsCustomer = needsRelayDetails || needsAddress;

  return (
    <section className="rounded-lg border border-line bg-paper p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#eef8f6] text-teal">
          <Truck size={22} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-black">Choisir votre livraison</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Selectionnez le mode disponible pour ce panier avant de passer au
            paiement.
          </p>
        </div>
      </div>

      {availableMethods.length > 0 ? (
        <div className="mt-5 grid gap-3">
          {availableMethods.map((method) => (
            <label
              key={method.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${
                selection.methodId === method.id
                  ? "border-teal bg-[#eef8f6]"
                  : "border-line bg-[#fbfaf7] hover:bg-[#f6f1e8]"
              }`}
            >
              <input
                checked={selection.methodId === method.id}
                onChange={() => onChange({ ...selection, methodId: method.id })}
                className="mt-1"
                name="shipping-method"
                type="radio"
              />
              <span className="grid flex-1 gap-1">
                <span className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-black">{method.label}</span>
                  <span className="font-black">{formatPrice(method.price)}</span>
                </span>
                <span className="text-sm leading-6 text-muted">
                  {method.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-[#fed7aa] bg-[#fff7ed] p-4 text-sm font-semibold leading-6 text-[#9a3412]">
          Ce panier contient un objet volumineux ou sur devis. Le paiement en
          ligne reste en attente : contactez Maxi Trouvaille pour organiser le
          retrait ou obtenir un devis personnalise.
        </div>
      )}

      {needsCustomer ? (
        <div className="mt-5 grid gap-4 rounded-lg border border-line bg-[#fbfaf7] p-4">
          <div className="flex items-center gap-2 text-sm font-black text-teal">
            {needsAddress ? (
              <PackageCheck size={18} aria-hidden="true" />
            ) : (
              <MapPin size={18} aria-hidden="true" />
            )}
            {needsAddress
              ? "Adresse pour Colissimo domicile"
              : "Informations pour Mondial Relay"}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Prenom"
              value={selection.customer.firstName}
              autoComplete="given-name"
              onChange={(firstName) =>
                onChange(patchCustomer(selection, { firstName }))
              }
            />
            <Field
              label="Nom"
              value={selection.customer.lastName}
              autoComplete="family-name"
              onChange={(lastName) =>
                onChange(patchCustomer(selection, { lastName }))
              }
            />
            {needsAddress ? (
              <div className="sm:col-span-2">
                <Field
                  label="Rue"
                  value={selection.customer.street}
                  autoComplete="street-address"
                  onChange={(street) =>
                    onChange(patchCustomer(selection, { street }))
                  }
                />
              </div>
            ) : null}
            <Field
              label="Code postal"
              value={selection.customer.postalCode}
              autoComplete="postal-code"
              onChange={(postalCode) =>
                onChange(patchCustomer(selection, { postalCode }))
              }
            />
            <Field
              label="Ville"
              value={selection.customer.city}
              autoComplete="address-level2"
              onChange={(city) => onChange(patchCustomer(selection, { city }))}
            />
            <Field
              label="Telephone"
              value={selection.customer.phone}
              autoComplete="tel"
              type="tel"
              onChange={(phone) => onChange(patchCustomer(selection, { phone }))}
            />
            <Field
              label="Email"
              value={selection.customer.email}
              autoComplete="email"
              type="email"
              onChange={(email) => onChange(patchCustomer(selection, { email }))}
            />
          </div>
          {needsRelayDetails ? (
            <div className="rounded-md border border-dashed border-line bg-paper p-3 text-sm font-bold text-muted">
              Choix du point relais a venir.
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedMethod ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md bg-[#f6f1e8] p-3 text-sm">
          <span className="font-bold text-muted">Livraison choisie</span>
          <span className="font-black">
            {selectedMethod.shortLabel} - {formatPrice(selectedMethod.price)}
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-md border border-[#fecdd3] bg-[#fff1f2] p-3 text-sm font-bold text-rose">
          {error}
        </div>
      ) : null}
    </section>
  );
}

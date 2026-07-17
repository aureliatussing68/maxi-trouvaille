import type { Product } from "@/lib/catalog";

export const SHIPPING_STORAGE_KEY = "maxi-trouvaille-shipping-v2";

export const shippingMethodIds = [
  "pickup",
  "mondial-relay",
  "colissimo",
] as const;

export type ShippingMethodId = (typeof shippingMethodIds)[number];

export type ShippingCustomerDetails = {
  firstName: string;
  lastName: string;
  street: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
};

export type ShippingSelection = {
  methodId: ShippingMethodId | "";
  customer: ShippingCustomerDetails;
};

export type ShippingValidationResult =
  | {
      ok: true;
      selection: ShippingSelection;
      method: ShippingMethod;
    }
  | {
      ok: false;
      selection: ShippingSelection;
      error: string;
    };

export type ShippingMethod = {
  id: ShippingMethodId;
  label: string;
  price: number;
  shortLabel: string;
  description: string;
};

export const shippingMethods: ShippingMethod[] = [
  {
    id: "colissimo",
    label: "Livraison suivie à domicile",
    shortLabel: "Livraison suivie",
    price: 390,
    description:
      "Livraison à domicile avec numéro de suivi. Réception estimée 7 à 14 jours ouvrés.",
  },
];

export const emptyShippingSelection: ShippingSelection = {
  methodId: "",
  customer: {
    firstName: "",
    lastName: "",
    street: "",
    postalCode: "",
    city: "",
    phone: "",
    email: "",
  },
};

export function getShippingMethodById(methodId: unknown) {
  return shippingMethods.find((method) => method.id === methodId);
}

export function sanitizeShippingSelection(input: unknown): ShippingSelection {
  if (!input || typeof input !== "object") {
    return emptyShippingSelection;
  }

  const maybeSelection = input as Partial<ShippingSelection>;
  const methodId = shippingMethodIds.some((id) => id === maybeSelection.methodId)
    ? maybeSelection.methodId
    : "";
  const customer =
    maybeSelection.customer && typeof maybeSelection.customer === "object"
      ? maybeSelection.customer
      : {};

  return {
    methodId: methodId ?? "",
    customer: {
      firstName: String(
        (customer as Partial<ShippingCustomerDetails>).firstName ?? "",
      ),
      lastName: String(
        (customer as Partial<ShippingCustomerDetails>).lastName ?? "",
      ),
      street: String((customer as Partial<ShippingCustomerDetails>).street ?? ""),
      postalCode: String(
        (customer as Partial<ShippingCustomerDetails>).postalCode ?? "",
      ),
      city: String((customer as Partial<ShippingCustomerDetails>).city ?? ""),
      phone: String((customer as Partial<ShippingCustomerDetails>).phone ?? ""),
      email: String((customer as Partial<ShippingCustomerDetails>).email ?? ""),
    },
  };
}

export function getAllowedShippingMethodIds(product: Product): ShippingMethodId[] {
  switch (product.livraisonDisponible ?? "toutes") {
    case "remise uniquement":
      return ["pickup"];
    case "mondial relay uniquement":
      return ["mondial-relay"];
    case "colissimo uniquement":
      return ["colissimo"];
    case "sur devis":
      return [];
    case "toutes":
    default:
      return ["pickup", "mondial-relay", "colissimo"];
  }
}

export function getAvailableShippingMethods(products: Product[]) {
  if (products.length === 0) {
    return [];
  }

  const allowedIds = products.reduce<ShippingMethodId[] | null>(
    (sharedIds, product) => {
      const productIds = getAllowedShippingMethodIds(product);

      if (sharedIds === null) {
        return productIds;
      }

      return sharedIds.filter((methodId) => productIds.includes(methodId));
    },
    null,
  );

  return shippingMethods.filter((method) => allowedIds?.includes(method.id));
}

export function getShippingPrice(methodId: ShippingMethodId | "") {
  return getShippingMethodById(methodId)?.price ?? 0;
}

function hasValue(value: string) {
  return value.trim().length > 0;
}

function hasEmailShape(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function validateShippingSelection(
  input: unknown,
  products: Product[],
): ShippingValidationResult {
  const selection = sanitizeShippingSelection(input);
  const availableMethods = getAvailableShippingMethods(products);
  const method = getShippingMethodById(selection.methodId);

  if (availableMethods.length === 0) {
    return {
      ok: false,
      selection,
      error:
        "Ce panier contient un produit volumineux ou sur devis. Contactez Maxi Trouvaille avant paiement.",
    };
  }

  if (!method || !availableMethods.some((item) => item.id === method.id)) {
    return {
      ok: false,
      selection,
      error: "Choisissez un mode de livraison disponible avant paiement.",
    };
  }

  const requiredFields: Array<keyof ShippingCustomerDetails> =
    method.id === "colissimo"
      ? ["firstName", "lastName", "street", "postalCode", "city", "phone", "email"]
      : method.id === "mondial-relay"
        ? ["firstName", "lastName", "postalCode", "city", "phone", "email"]
        : [];

  const hasMissingField = requiredFields.some(
    (field) => !hasValue(selection.customer[field]),
  );

  if (hasMissingField) {
    return {
      ok: false,
      selection,
      error: "Completez les informations de livraison avant paiement.",
    };
  }

  if (requiredFields.includes("email") && !hasEmailShape(selection.customer.email)) {
    return {
      ok: false,
      selection,
      error: "Indiquez une adresse email valide pour la livraison.",
    };
  }

  return {
    ok: true,
    selection,
    method,
  };
}

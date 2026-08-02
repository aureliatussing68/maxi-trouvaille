import { promises as fs } from "fs";
import path from "path";
import postgres from "postgres";
import { isDropshippingProduct, type Product } from "@/lib/catalog";
import { decrementQuickProductStock } from "@/lib/catalog-server";
import type { ShippingValidationResult } from "@/lib/shipping";
import {
  dropshippingStatusLabels,
  sanitizeDropshippingStatus,
  type DropshippingOrder,
  type DropshippingOrderStatus,
} from "@/lib/dropshipping-shared";

const localOrdersPath = path.join(
  process.cwd(),
  "data",
  "dropshipping-orders.json",
);
const temporaryOrdersPath = path.join(
  "/tmp",
  "maxi-trouvaille-dropshipping-orders.json",
);

let sqlClient: ReturnType<typeof postgres> | null = null;
let schemaReady: Promise<void> | null = null;

function getDatabaseUrl() {
  return (
    process.env.DROPSHIPPING_ORDERS_DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    ""
  );
}

function getOrdersPath() {
  return process.env.VERCEL === "1" && !getDatabaseUrl()
    ? temporaryOrdersPath
    : localOrdersPath;
}

function getSqlClient() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    return null;
  }

  sqlClient ??= postgres(databaseUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });

  return sqlClient;
}

async function ensureOrdersSchema() {
  const sql = getSqlClient();
  if (!sql) {
    return;
  }

  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS dropshipping_orders (
        id text PRIMARY KEY,
        stripe_session_id text NOT NULL DEFAULT '',
        data jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;
  })();

  await schemaReady;
}

type PaidShippingValidation = Extract<ShippingValidationResult, { ok: true }>;

type CartLine = {
  productId: string;
  quantity: number;
};

export async function readDropshippingOrders(): Promise<DropshippingOrder[]> {
  const sql = getSqlClient();

  if (sql) {
    await ensureOrdersSchema();
    const rows = await sql`
      SELECT data FROM dropshipping_orders ORDER BY created_at DESC
    `;
    return rows.map((row) => row.data as DropshippingOrder);
  }

  try {
    const content = await fs.readFile(getOrdersPath(), "utf8");
    const parsed = JSON.parse(content) as unknown;
    return Array.isArray(parsed) ? (parsed as DropshippingOrder[]) : [];
  } catch {
    return [];
  }
}

export async function writeDropshippingOrders(orders: DropshippingOrder[]) {
  const sql = getSqlClient();

  if (sql) {
    await ensureOrdersSchema();
    for (const order of orders) {
      await sql`
        INSERT INTO dropshipping_orders (id, stripe_session_id, data, created_at, updated_at)
        VALUES (
          ${order.id},
          ${order.stripeSessionId ?? ""},
          ${sql.json(order as never)},
          ${order.createdAt},
          ${order.updatedAt}
        )
        ON CONFLICT (id) DO UPDATE SET
          stripe_session_id = EXCLUDED.stripe_session_id,
          data = EXCLUDED.data,
          updated_at = EXCLUDED.updated_at
      `;
    }
    return;
  }

  const target = getOrdersPath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(orders, null, 2), "utf8");
}

function createOrderNumber() {
  const date = new Date();
  const day = date.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `MT-DROP-${day}-${suffix}`;
}

function getQuantity(productId: string, cartLines: CartLine[]) {
  return cartLines.find((line) => line.productId === productId)?.quantity ?? 1;
}

function getStockDecrementItems(order: DropshippingOrder) {
  return order.lines
    .map((line) => ({
      productId: line.productId,
      quantity: Math.max(0, Math.trunc(Number(line.quantity)) || 0),
    }))
    .filter((line) => line.productId && line.quantity > 0);
}

function appendInternalNote(currentNote: string | undefined, note: string) {
  const current = currentNote?.trim();

  if (!current) {
    return note;
  }

  if (current.includes(note)) {
    return current;
  }

  return `${current}\n${note}`;
}

export async function recordDropshippingCheckoutDraft({
  stripeSessionId,
  products,
  cartLines,
  shippingValidation,
}: {
  stripeSessionId: string;
  products: Product[];
  cartLines: CartLine[];
  shippingValidation: PaidShippingValidation;
}) {
  const dropshippingProducts = products.filter(isDropshippingProduct);

  if (dropshippingProducts.length === 0) {
    return null;
  }

  const orders = await readDropshippingOrders();
  const existing = orders.find((order) => order.stripeSessionId === stripeSessionId);

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const lines = dropshippingProducts.map((product) => {
    const quantity = getQuantity(product.id, cartLines);
    const supplierPriceCents = product.dropshipping?.supplierPriceCents ?? 0;
    const soldPriceCents = product.price;
    const marginCents =
      product.dropshipping?.marginCents ?? Math.max(0, soldPriceCents - supplierPriceCents);

    return {
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      image: product.image,
      quantity,
      supplierName: product.dropshipping?.supplierName ?? "Fournisseur partenaire",
      supplierUrl: product.dropshipping?.supplierUrl ?? "",
      supplierSku: product.dropshipping?.supplierSku ?? "",
      supplierPriceCents,
      soldPriceCents,
      marginCents,
      supplierStock: product.dropshipping?.supplierStock,
      deliveryEstimate: product.dropshipping?.deliveryEstimate ?? "8 a 15 jours ouvres",
    };
  });

  const supplierTotalCents = lines.reduce(
    (total, line) => total + line.supplierPriceCents * line.quantity,
    0,
  );
  const soldTotalCents = lines.reduce(
    (total, line) => total + line.soldPriceCents * line.quantity,
    0,
  );

  const customer = shippingValidation.selection.customer;
  const order: DropshippingOrder = {
    id: `drop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    orderNumber: createOrderNumber(),
    stripeSessionId,
    paymentStatus: "stripe-session-created",
    status: "a-traiter",
    stockDecrementStatus: "pending-payment",
    customer: {
      name: `${customer.firstName} ${customer.lastName}`.trim(),
      email: customer.email,
      phone: customer.phone,
    },
    shippingAddress: {
      street: customer.street,
      postalCode: customer.postalCode,
      city: customer.city,
      country: "France",
      methodLabel: shippingValidation.method.label,
    },
    lines,
    supplierTotalCents,
    soldTotalCents,
    estimatedMarginCents: Math.max(0, soldTotalCents - supplierTotalCents),
    shippingPriceCents: shippingValidation.method.price,
    internalNote:
      "Commande fournisseur a valider manuellement. Aucun achat fournisseur automatique n'est execute.",
    createdAt: now,
    updatedAt: now,
  };

  await writeDropshippingOrders([order, ...orders]);
  return order;
}

export async function markDropshippingOrderPaid(stripeSessionId: string) {
  const orders = await readDropshippingOrders();
  let updatedOrder: DropshippingOrder | null = null;
  const orderIndex = orders.findIndex(
    (order) => order.stripeSessionId === stripeSessionId,
  );

  if (orderIndex < 0) {
    return null;
  }

  const order = orders[orderIndex];
  const now = new Date().toISOString();
  const existingStockStatus = order.stockDecrementStatus;
  const stockAlreadySettled =
    Boolean(order.stockDecrementedAt) ||
    existingStockStatus === "done" ||
    existingStockStatus === "skipped";

  if (stockAlreadySettled) {
    updatedOrder = {
      ...order,
      paymentStatus: "paid",
      updatedAt: now,
    };
    orders[orderIndex] = updatedOrder;
    await writeDropshippingOrders(orders);
    return updatedOrder;
  }

  if (!existingStockStatus && order.paymentStatus === "paid") {
    const manualRecheckNote =
      "Commande payee avant le verrou webhook stock: stock a recontroler manuellement, aucun decrement automatique retroactif.";
    updatedOrder = {
      ...order,
      paymentStatus: "paid",
      stockDecrementStatus: "skipped",
      stockDecrementError: "legacy_paid_order_manual_stock_recheck_required",
      internalNote: appendInternalNote(order.internalNote, manualRecheckNote),
      updatedAt: now,
    };
    orders[orderIndex] = updatedOrder;
    await writeDropshippingOrders(orders);
    return updatedOrder;
  }

  const stockItems = getStockDecrementItems(order);

  if (stockItems.length === 0) {
    updatedOrder = {
      ...order,
      paymentStatus: "paid",
      stockDecrementStatus: "skipped",
      stockDecrementError: "no_dropshipping_line_to_decrement",
      updatedAt: now,
    };
    orders[orderIndex] = updatedOrder;
    await writeDropshippingOrders(orders);
    return updatedOrder;
  }

  try {
    await decrementQuickProductStock(stockItems);
  } catch {
    const failureNote =
      "Webhook Stripe: paiement confirme, mais decrement stock local a relancer/verifier manuellement.";
    updatedOrder = {
      ...order,
      paymentStatus: "paid",
      stockDecrementStatus: "failed",
      stockDecrementError: "stock_decrement_failed_manual_recheck_required",
      internalNote: appendInternalNote(order.internalNote, failureNote),
      updatedAt: now,
    };
    orders[orderIndex] = updatedOrder;
    await writeDropshippingOrders(orders);
    throw new Error("stock_decrement_failed");
  }

  updatedOrder = {
    ...order,
    paymentStatus: "paid",
    stockDecrementStatus: "done",
    stockDecrementedAt: now,
    stockDecrementSource: "stripe-webhook",
    stockDecrementLineCount: stockItems.length,
    stockDecrementError: undefined,
    updatedAt: now,
  };
  orders[orderIndex] = updatedOrder;
  await writeDropshippingOrders(orders);
  return updatedOrder;
}

export async function updateDropshippingOrder(
  orderId: string,
  patch: {
    status?: DropshippingOrderStatus;
    trackingNumber?: string;
    supplierOrderReference?: string;
    internalNote?: string;
    followUpMessagePreparedAt?: string;
  },
) {
  const orders = await readDropshippingOrders();
  let updatedOrder: DropshippingOrder | null = null;
  const updatedOrders = orders.map((order) => {
    if (order.id !== orderId) {
      return order;
    }

    const status = patch.status
      ? sanitizeDropshippingStatus(patch.status)
      : order.status;

    updatedOrder = {
      ...order,
      status,
      trackingNumber: patch.trackingNumber ?? order.trackingNumber,
      supplierOrderReference:
        patch.supplierOrderReference ?? order.supplierOrderReference,
      internalNote: patch.internalNote ?? order.internalNote,
      followUpMessagePreparedAt:
        patch.followUpMessagePreparedAt ?? order.followUpMessagePreparedAt,
      updatedAt: new Date().toISOString(),
    };

    return updatedOrder;
  });

  if (!updatedOrder) {
    return null;
  }

  await writeDropshippingOrders(updatedOrders);
  return updatedOrder;
}

/**
 * Pose la date d'envoi d'un email client sur la commande.
 *
 * Sert uniquement de verrou anti-doublon : on n'ecrit qu'une seule fois,
 * et seulement APRES qu'un email a reellement ete envoye. Aucun appel
 * reseau, aucune commande fournisseur ici.
 */
export async function markDropshippingOrderEmailSent(
  orderId: string,
  field: "confirmationEmailSentAt" | "shippingEmailSentAt",
) {
  const orders = await readDropshippingOrders();
  const orderIndex = orders.findIndex((order) => order.id === orderId);

  if (orderIndex < 0) {
    return null;
  }

  const order = orders[orderIndex];

  if (order[field]) {
    return order;
  }

  const now = new Date().toISOString();
  const updatedOrder: DropshippingOrder =
    field === "confirmationEmailSentAt"
      ? { ...order, confirmationEmailSentAt: now, updatedAt: now }
      : { ...order, shippingEmailSentAt: now, updatedAt: now };

  orders[orderIndex] = updatedOrder;
  await writeDropshippingOrders(orders);
  return updatedOrder;
}

export function getDropshippingConnectorStatus() {
  const aliexpressReady = Boolean(
    process.env.ALIEXPRESS_API_KEY ||
      process.env.ALIEXPRESS_APP_KEY ||
      process.env.ALIEXPRESS_APP_SECRET ||
      process.env.ALIEXPRESS_API_SECRET,
  );

  return [
    {
      name: "Stripe",
      ready: Boolean(process.env.STRIPE_SECRET_KEY),
      detail: "Paiement client et webhook commandes",
    },
    {
      name: "AliExpress API / Affiliate",
      ready: aliexpressReady,
      detail: "Lecture/test et import brouillon uniquement, validation manuelle avant publication",
    },
    {
      name: "DSers",
      ready: Boolean(process.env.DSERS_API_KEY),
      detail: "Espace de connexion pret a renseigner si compte disponible",
    },
    {
      name: "AutoDS",
      ready: Boolean(process.env.AUTODS_API_KEY),
      detail: "Espace de connexion pret a renseigner si compte disponible",
    },
  ];
}

export function getDropshippingStatusLabel(status: DropshippingOrderStatus) {
  return dropshippingStatusLabels[status];
}

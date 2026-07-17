import type { DropshippingOrder } from "./dropshipping-shared";

export type DropshippingSupplierActionReadiness = {
  ready: boolean;
  label: string;
  detail: string;
  className: string;
};

export type DropshippingOrderOperationLane =
  | "WAIT_PAYMENT"
  | "STOCK_EXCEPTION"
  | "READY_SUPPLIER_PREP"
  | "WAIT_TRACKING"
  | "READY_FOLLOW_UP"
  | "DONE";

export type DropshippingOrderOperation = {
  lane: DropshippingOrderOperationLane;
  priority: number;
  supplierActionAllowed: boolean;
  nextAction: string;
};

export type DropshippingOrderOperationBoardItem = {
  priority: number;
  lane: DropshippingOrderOperationLane;
  orderNumber: string;
  paymentStatus: string;
  stockDecrementStatus: string;
  orderStatus: string;
  supplierActionAllowed: boolean;
  nextAction: string;
  lineCount: number;
  soldTotal: string;
  estimatedMargin: string;
  missingProofs: string[];
  customerContactReady: boolean;
  hasTrackingNumber: boolean;
  hasSupplierOrderReference: boolean;
  updatedAt: string;
};

export type DropshippingOrderOperationCounts = {
  totalOrders: number;
  paidOrders: number;
  stockDoneOrders: number;
  stockExceptions: number;
  readySupplierPrep: number;
  waitPayment: number;
  waitTracking: number;
  readyFollowUp: number;
};

export function getDropshippingSupplierActionReadiness(
  order: Pick<DropshippingOrder, "paymentStatus" | "stockDecrementStatus">,
): DropshippingSupplierActionReadiness {
  const hasPaidPayment = order.paymentStatus === "paid";

  if (!hasPaidPayment) {
    return {
      ready: false,
      label: "Paiement en attente",
      detail:
        "Attendre le webhook Stripe paye avant toute preparation fournisseur.",
      className: "bg-[#fff7ed] text-[#9a3412] ring-[#fed7aa]",
    };
  }

  if (order.stockDecrementStatus === "done") {
    return {
      ready: true,
      label: "Fournisseur autorise",
      detail: "Paiement confirme et stock webhook ajuste.",
      className: "bg-[#eef8f6] text-teal ring-[#bfe7df]",
    };
  }

  if (order.stockDecrementStatus === "failed" || order.stockDecrementStatus === "skipped") {
    return {
      ready: false,
      label: "Stock a verifier",
      detail: "Recontroler le stock webhook avant toute action fournisseur.",
      className: "bg-[#fff7ed] text-[#9a3412] ring-[#fed7aa]",
    };
  }

  return {
    ready: false,
    label: "Stock webhook en attente",
    detail: "La commande est payee, mais le stock local n'est pas encore verrouille.",
    className: "bg-[#fff7ed] text-[#9a3412] ring-[#fed7aa]",
  };
}

export function getDropshippingOrderOperationsSummary(orders: DropshippingOrder[]) {
  const paidOrders = orders.filter((order) => order.paymentStatus === "paid");
  const readyOrders = orders.filter(
    (order) => getDropshippingSupplierActionReadiness(order).ready,
  );
  const blockedOrders = orders.filter(
    (order) => !getDropshippingSupplierActionReadiness(order).ready,
  );
  const stockExceptions = orders.filter(
    (order) => order.paymentStatus === "paid" && order.stockDecrementStatus !== "done",
  );

  return {
    totalCount: orders.length,
    paidCount: paidOrders.length,
    readyCount: readyOrders.length,
    blockedCount: blockedOrders.length,
    stockExceptionCount: stockExceptions.length,
    stockExceptions: stockExceptions.slice(0, 3).map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: getDropshippingSupplierActionReadiness(order).label,
    })),
  };
}

export function getDropshippingOrderOperation(
  order: Pick<
    DropshippingOrder,
    | "paymentStatus"
    | "stockDecrementStatus"
    | "status"
    | "trackingNumber"
    | "followUpMessagePreparedAt"
  >,
): DropshippingOrderOperation {
  const paymentStatus = order.paymentStatus ?? "stripe-session-created";
  const stockStatus = order.stockDecrementStatus ?? "pending-payment";
  const orderStatus = order.status ?? "a-traiter";

  if (paymentStatus !== "paid") {
    return {
      lane: "WAIT_PAYMENT",
      priority: 40,
      supplierActionAllowed: false,
      nextAction: "Attendre le webhook Stripe paye. Ne pas preparer fournisseur.",
    };
  }

  if (stockStatus !== "done") {
    const priorityByStockStatus = {
      failed: 1,
      skipped: 2,
      "pending-payment": 3,
    } satisfies Partial<Record<NonNullable<DropshippingOrder["stockDecrementStatus"]>, number>>;

    return {
      lane: "STOCK_EXCEPTION",
      priority: priorityByStockStatus[stockStatus] ?? 4,
      supplierActionAllowed: false,
      nextAction:
        stockStatus === "failed"
          ? "Reprendre l'erreur stock webhook avant toute commande fournisseur."
          : "Verifier manuellement pourquoi le stock webhook n'est pas ajuste.",
    };
  }

  if (orderStatus === "commande-fournisseur" && !order.trackingNumber) {
    return {
      lane: "WAIT_TRACKING",
      priority: 20,
      supplierActionAllowed: true,
      nextAction: "Ajouter le suivi colis des que le partenaire logistique le transmet.",
    };
  }

  if (orderStatus === "expedie" && order.trackingNumber && !order.followUpMessagePreparedAt) {
    return {
      lane: "READY_FOLLOW_UP",
      priority: 25,
      supplierActionAllowed: true,
      nextAction: "Preparer le suivi client Maxi Trouvaille, sans envoi automatique.",
    };
  }

  if (orderStatus === "livre") {
    return {
      lane: "DONE",
      priority: 90,
      supplierActionAllowed: true,
      nextAction: "Surveiller SAV et avis client, aucune action fournisseur immediate.",
    };
  }

  return {
    lane: "READY_SUPPLIER_PREP",
    priority: 10,
    supplierActionAllowed: true,
    nextAction:
      "Commande payee et stock ajuste: preparation fournisseur possible apres validation humaine.",
  };
}

export function getDropshippingOrderLineProofGaps(order: Pick<DropshippingOrder, "lines">) {
  const gaps = new Set<string>();

  for (const line of order.lines ?? []) {
    if (!line.supplierUrl) {
      gaps.add("lien fournisseur");
    }
    if (!line.supplierSku) {
      gaps.add("SKU");
    }
    if (!Number.isFinite(line.supplierPriceCents) || line.supplierPriceCents <= 0) {
      gaps.add("prix fournisseur");
    }
    if (!Number.isFinite(line.supplierStock)) {
      gaps.add("stock fournisseur");
    }
    if (!line.deliveryEstimate || /a verifier|a confirmer|hold|manquant/i.test(line.deliveryEstimate)) {
      gaps.add("delai");
    }
  }

  return [...gaps];
}

export function formatDropshippingOperationCents(cents: unknown) {
  const value = typeof cents === "number" ? cents : Number(cents);
  const safeValue = Number.isFinite(value) ? value : 0;

  return `${(Math.max(0, safeValue) / 100).toFixed(2)} EUR`;
}

export function getDropshippingOrderOperationBoardItem(
  order: DropshippingOrder,
): DropshippingOrderOperationBoardItem {
  const readiness = getDropshippingOrderOperation(order);
  const missingProofs = getDropshippingOrderLineProofGaps(order);

  return {
    priority: readiness.priority,
    lane: readiness.lane,
    orderNumber: order.orderNumber ?? order.id,
    paymentStatus: order.paymentStatus ?? "missing",
    stockDecrementStatus: order.stockDecrementStatus ?? "pending-payment",
    orderStatus: order.status ?? "missing",
    supplierActionAllowed: readiness.supplierActionAllowed,
    nextAction: readiness.nextAction,
    lineCount: Array.isArray(order.lines) ? order.lines.length : 0,
    soldTotal: formatDropshippingOperationCents(order.soldTotalCents),
    estimatedMargin: formatDropshippingOperationCents(order.estimatedMarginCents),
    missingProofs,
    customerContactReady: Boolean(order.customer?.email || order.customer?.phone),
    hasTrackingNumber: Boolean(order.trackingNumber),
    hasSupplierOrderReference: Boolean(order.supplierOrderReference),
    updatedAt: order.updatedAt ?? order.createdAt ?? "",
  };
}

export function getDropshippingOrderOperationBoardItems(
  orders: DropshippingOrder[],
) {
  return orders
    .map((order) => getDropshippingOrderOperationBoardItem(order))
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        String(b.updatedAt).localeCompare(String(a.updatedAt)),
    );
}

export function getDropshippingOrderOperationCounts(
  orders: DropshippingOrder[],
  items = getDropshippingOrderOperationBoardItems(orders),
): DropshippingOrderOperationCounts {
  return {
    totalOrders: orders.length,
    paidOrders: orders.filter((order) => order.paymentStatus === "paid").length,
    stockDoneOrders: orders.filter((order) => order.stockDecrementStatus === "done").length,
    stockExceptions: items.filter((item) => item.lane === "STOCK_EXCEPTION").length,
    readySupplierPrep: items.filter((item) => item.lane === "READY_SUPPLIER_PREP").length,
    waitPayment: items.filter((item) => item.lane === "WAIT_PAYMENT").length,
    waitTracking: items.filter((item) => item.lane === "WAIT_TRACKING").length,
    readyFollowUp: items.filter((item) => item.lane === "READY_FOLLOW_UP").length,
  };
}

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const ordersPath = path.join(root, "data", "dropshipping-orders.json");
const operationsModulePath = path.join(root, "src", "lib", "dropshipping-operations.ts");
const outputRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function datePartsParis(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    dateKey: `${byType.year}${byType.month}${byType.day}`,
    localLabel: `${byType.year}-${byType.month}-${byType.day} ${byType.hour}:${byType.minute} Europe/Paris`,
  };
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  const headers = [
    "priority",
    "lane",
    "orderNumber",
    "paymentStatus",
    "stockDecrementStatus",
    "orderStatus",
    "supplierActionAllowed",
    "nextAction",
    "lineCount",
    "soldTotal",
    "estimatedMargin",
    "missingProofs",
  ];

  return `${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
    .join("\n")}\n`;
}

async function importSharedOperationsModule() {
  const source = fs.readFileSync(operationsModulePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2020,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: operationsModulePath,
  }).outputText;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`;

  return import(dataUrl);
}

function runSelfTests(operations) {
  const base = {
    id: "test-order",
    orderNumber: "MT-TEST",
    paymentStatus: "paid",
    status: "a-traiter",
    stockDecrementStatus: "done",
    lines: [],
  };
  const scenarios = [
    {
      name: "payment_wait_blocks_supplier",
      order: { ...base, paymentStatus: "stripe-session-created", stockDecrementStatus: "pending-payment" },
      expectedLane: "WAIT_PAYMENT",
      expectedAllowed: false,
    },
    {
      name: "paid_done_ready_for_supplier",
      order: base,
      expectedLane: "READY_SUPPLIER_PREP",
      expectedAllowed: true,
    },
    {
      name: "paid_failed_stock_exception",
      order: { ...base, stockDecrementStatus: "failed" },
      expectedLane: "STOCK_EXCEPTION",
      expectedAllowed: false,
    },
    {
      name: "paid_skipped_stock_exception",
      order: { ...base, stockDecrementStatus: "skipped" },
      expectedLane: "STOCK_EXCEPTION",
      expectedAllowed: false,
    },
    {
      name: "paid_pending_stock_exception",
      order: { ...base, stockDecrementStatus: "pending-payment" },
      expectedLane: "STOCK_EXCEPTION",
      expectedAllowed: false,
    },
    {
      name: "supplier_order_waits_tracking",
      order: { ...base, status: "commande-fournisseur" },
      expectedLane: "WAIT_TRACKING",
      expectedAllowed: true,
    },
    {
      name: "shipped_waits_follow_up",
      order: { ...base, status: "expedie", trackingNumber: "MT-TRACK-TEST" },
      expectedLane: "READY_FOLLOW_UP",
      expectedAllowed: true,
    },
    {
      name: "delivered_is_done",
      order: { ...base, status: "livre" },
      expectedLane: "DONE",
      expectedAllowed: true,
    },
  ];

  return scenarios.map((scenario) => {
    const actual = operations.getDropshippingOrderOperation(scenario.order);
    return {
      name: scenario.name,
      ok:
        actual.lane === scenario.expectedLane &&
        actual.supplierActionAllowed === scenario.expectedAllowed,
      expectedLane: scenario.expectedLane,
      actualLane: actual.lane,
      expectedAllowed: scenario.expectedAllowed,
      actualAllowed: actual.supplierActionAllowed,
    };
  });
}

function safeRows(rows) {
  return rows.map((row) => ({
    priority: row.priority,
    lane: row.lane,
    orderNumber: row.orderNumber,
    paymentStatus: row.paymentStatus,
    stockDecrementStatus: row.stockDecrementStatus,
    orderStatus: row.orderStatus,
    supplierActionAllowed: row.supplierActionAllowed,
    nextAction: row.nextAction,
    lineCount: row.lineCount,
    soldTotal: row.soldTotal,
    estimatedMargin: row.estimatedMargin,
    missingProofs: row.missingProofs,
    customerContactReady: row.customerContactReady,
    hasTrackingNumber: row.hasTrackingNumber,
    hasSupplierOrderReference: row.hasSupplierOrderReference,
    updatedAt: row.updatedAt,
  }));
}

function markdown(summary) {
  const rows =
    summary.items.length === 0
      ? ["| - | EMPTY | Aucune commande dropshipping locale | - | Aucune action |"]
      : summary.items.map(
          (item) =>
            `| ${item.priority} | ${item.lane} | ${item.orderNumber} | ${item.stockDecrementStatus} | ${item.nextAction} |`,
        );

  return `${[
    "# Maxi Trouvailles - Operations commandes dropshipping",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Commandes totales: ${summary.counts.totalOrders}`,
    `- Payees: ${summary.counts.paidOrders}`,
    `- Stock webhook OK: ${summary.counts.stockDoneOrders}`,
    `- Exceptions stock: ${summary.counts.stockExceptions}`,
    `- Pretes preparation fournisseur: ${summary.counts.readySupplierPrep}`,
    `- En attente paiement: ${summary.counts.waitPayment}`,
    `- En attente suivi: ${summary.counts.waitTracking}`,
    "",
    "## File prioritaire",
    "",
    "| Priorite | File | Commande | Stock webhook | Action |",
    "|---:|---|---|---|---|",
    ...rows,
    "",
    "## Commandes a relancer",
    "",
    "```powershell",
    "npm run catalog:audit-stripe-webhook-stock-guards",
    "npm run catalog:test-stripe-webhook-stock-idempotence",
    "npm run catalog:audit-dropshipping-order-admin-safety",
    "npm run catalog:order-operations-board",
    "```",
    "",
    "## Garde-fous",
    "",
    "- Lecture seule sur les commandes.",
    "- Aucun paiement.",
    "- Aucune commande fournisseur.",
    "- Aucun envoi de message client.",
    "- Aucun lien fournisseur exporte.",
    "- Une action fournisseur reste bloquee si la commande n'est pas `paid` ou si le stock webhook n'est pas `done`.",
    "",
  ].join("\n")}\n`;
}

const orders = readJson(ordersPath, []);
if (!Array.isArray(orders)) {
  throw new Error("data/dropshipping-orders.json must contain an array.");
}

const operations = await importSharedOperationsModule();
const selfTests = runSelfTests(operations);
const selfTestFailures = selfTests.filter((test) => !test.ok);
const items = operations.getDropshippingOrderOperationBoardItems(orders);
const counts = operations.getDropshippingOrderOperationCounts(orders, items);
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(outputRoot, `dropshipping-order-operations-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: selfTestFailures.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_dropshipping_order_operations_board",
  counts,
  itemCount: items.length,
  items: safeRows(items),
  selfTests,
  selfTestFailures,
  source: path.relative(root, ordersPath).replace(/\\/g, "/"),
  sharedOperationsSource: path.relative(root, operationsModulePath).replace(/\\/g, "/"),
  safety: {
    readOnly: true,
    noPayment: true,
    noSupplierOrder: true,
    noPublication: true,
    noExternalApiCall: true,
    noSupplierUrlsExported: true,
    noCustomerAddressExported: true,
  },
};

const jsonPath = path.join(outputDir, `DROPSHIPPING_ORDER_OPERATIONS_BOARD_${dateKey}.json`);
const mdPath = path.join(outputDir, `DROPSHIPPING_ORDER_OPERATIONS_BOARD_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-commandes-dropshipping-operations-${dateKey}.csv`);
const stockCsvPath = path.join(outputDir, `maxi-commandes-stock-a-reprendre-${dateKey}.csv`);
const jsonText = `${JSON.stringify(summary, null, 2)}\n`;
const mdText = markdown(summary);
const csvText = toCsv(summary.items);
const stockCsvText = toCsv(summary.items.filter((item) => item.lane === "STOCK_EXCEPTION"));
const leakText = [jsonText, mdText, csvText, stockCsvText].join("\n");
const leakSignals = leakText.match(/https?:\/\/|aliexpress|wholesale/gi) ?? [];

if (leakSignals.length > 0) {
  summary.ok = false;
  summary.leakSignals = [...new Set(leakSignals)];
  summary.selfTestFailures.push({
    name: "no_supplier_or_url_export",
    ok: false,
    expectedLane: "no_leak",
    actualLane: summary.leakSignals.join(","),
    expectedAllowed: false,
    actualAllowed: true,
  });
}

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, mdText, "utf8");
fs.writeFileSync(csvPath, csvText, "utf8");
fs.writeFileSync(stockCsvPath, stockCsvText, "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      counts: summary.counts,
      selfTestFailureCount: summary.selfTestFailures.length,
      files: { jsonPath, mdPath, csvPath, stockCsvPath },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

if (!summary.ok) {
  process.exitCode = 1;
}

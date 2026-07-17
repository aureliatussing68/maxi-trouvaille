import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const webhookRoutePath = path.join(root, "src", "app", "api", "stripe", "webhook", "route.ts");
const dropshippingServerPath = path.join(root, "src", "lib", "dropshipping-server.ts");
const dropshippingSharedPath = path.join(root, "src", "lib", "dropshipping-shared.ts");
const orderSuccessPath = path.join(root, "src", "components", "OrderSuccess.tsx");
const outputRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function afterMarker(source, marker) {
  const index = source.indexOf(marker);
  return index >= 0 ? source.slice(index) : "";
}

function sectionBetween(source, startMarker, endMarker) {
  const section = afterMarker(source, startMarker);
  const endIndex = section.indexOf(endMarker);
  return endIndex >= 0 ? section.slice(0, endIndex) : section;
}

function firstPositiveIndex(...indexes) {
  return indexes
    .filter((index) => index >= 0)
    .reduce((best, index) => (best < 0 ? index : Math.min(best, index)), -1);
}

function check(name, ok, detail) {
  return { name, ok: Boolean(ok), detail };
}

function markdownReport(summary) {
  const lines = [
    "# Audit Stripe webhook stock guards",
    "",
    `Date: ${summary.checkedAt}`,
    "",
    `Status: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "## Summary",
    "",
    `- Checks: ${summary.checkCount}`,
    `- Failures: ${summary.failureCount}`,
    "",
    "## Checks",
    "",
    ...summary.checks.map(
      (item) => `- ${item.ok ? "OK" : "ECHEC"} ${item.name} - ${item.detail}`,
    ),
    "",
    "## Safety",
    "",
    ...Object.entries(summary.safety).map(([key, value]) => `- ${key}: ${value}`),
    "",
  ];

  return `${lines.join("\n")}\n`;
}

const webhookSource = readFile(webhookRoutePath);
const dropshippingServerSource = readFile(dropshippingServerPath);
const dropshippingSharedSource = readFile(dropshippingSharedPath);
const orderSuccessSource = readFile(orderSuccessPath);
const markPaidBody = sectionBetween(
  dropshippingServerSource,
  "export async function markDropshippingOrderPaid",
  "export async function updateDropshippingOrder",
);
const decrementIndex = markPaidBody.indexOf("await decrementQuickProductStock(stockItems)");
const idempotenceGuardIndex = firstPositiveIndex(
  markPaidBody.indexOf("Boolean(order.stockDecrementedAt)"),
  markPaidBody.indexOf('existingStockStatus === "done"'),
  markPaidBody.indexOf('existingStockStatus === "skipped"'),
);
const legacySkipIndex = markPaidBody.indexOf("legacy_paid_order_manual_stock_recheck_required");
const failureStatusIndex = markPaidBody.indexOf('stockDecrementStatus: "failed"');
const doneStatusIndex = markPaidBody.indexOf('stockDecrementStatus: "done"');

const checks = [
  check(
    "webhook_node_runtime",
    webhookSource.includes('export const runtime = "nodejs"'),
    "Le webhook Stripe reste en runtime Node pour la verification de signature.",
  ),
  check(
    "webhook_force_dynamic",
    webhookSource.includes('export const dynamic = "force-dynamic"'),
    "Le webhook n'est jamais prerendu ni cache.",
  ),
  check(
    "stripe_signature_required",
    webhookSource.includes('request.headers.get("stripe-signature")') &&
      webhookSource.includes("Signature Stripe absente"),
    "La signature Stripe est obligatoire avant traitement.",
  ),
  check(
    "stripe_construct_event",
    webhookSource.includes("stripe.webhooks.constructEvent(body, signature, webhookSecret)") &&
      webhookSource.includes("await request.text()"),
    "Le body brut est verifie avec le secret webhook.",
  ),
  check(
    "checkout_completed_only",
    webhookSource.includes('event.type === "checkout.session.completed"'),
    "Le traitement commande part uniquement d'un checkout.session.completed signe.",
  ),
  check(
    "dropshipping_metadata_required",
    webhookSource.includes('session.metadata?.hasDropshippingItems === "true"'),
    "Le decrement stock ne concerne que les sessions marquees dropshipping.",
  ),
  check(
    "server_marks_paid",
    webhookSource.includes("await markDropshippingOrderPaid(session.id)"),
    "Le webhook appelle le helper serveur de commande dropshipping.",
  ),
  check(
    "webhook_returns_retryable_error",
    webhookSource.includes("{ status: 500 }") &&
      webhookSource.includes("traitement stock local"),
    "Un echec de stock renvoie une erreur serveur pour permettre une reprise.",
  ),
  check(
    "success_page_no_admin_decrement",
    !orderSuccessSource.includes("/api/admin/products/decrement"),
    "La page succes paiement ne decremente jamais le stock via une route admin.",
  ),
  check(
    "stock_status_type_exists",
    dropshippingSharedSource.includes("DropshippingOrderStockDecrementStatus") &&
      dropshippingSharedSource.includes('"pending-payment"') &&
      dropshippingSharedSource.includes('"done"') &&
      dropshippingSharedSource.includes('"skipped"') &&
      dropshippingSharedSource.includes('"failed"'),
    "Les etats stock webhook sont traces dans le type commande.",
  ),
  check(
    "draft_starts_pending_payment",
    dropshippingServerSource.includes('stockDecrementStatus: "pending-payment"'),
    "Une commande creee avant paiement part en attente de paiement.",
  ),
  check(
    "server_uses_local_stock_decrement",
    dropshippingServerSource.includes('from "@/lib/catalog-server"') &&
      dropshippingServerSource.includes("decrementQuickProductStock"),
    "Le stock est ajuste cote serveur local, sans appel client.",
  ),
  check(
    "idempotence_guard_before_decrement",
    idempotenceGuardIndex >= 0 &&
      decrementIndex >= 0 &&
      idempotenceGuardIndex < decrementIndex,
    "Les statuts done/skipped ou stockDecrementedAt sont controles avant decrement.",
  ),
  check(
    "legacy_paid_orders_are_skipped",
    legacySkipIndex >= 0 && legacySkipIndex < decrementIndex,
    "Les anciennes commandes deja payees sans trace stock ne sont pas redecrementees.",
  ),
  check(
    "done_status_after_success",
    doneStatusIndex > decrementIndex &&
      markPaidBody.includes('stockDecrementSource: "stripe-webhook"') &&
      markPaidBody.includes("stockDecrementedAt: now"),
    "Un succes de webhook trace la source, la date et le statut done.",
  ),
  check(
    "failed_status_and_retry",
    failureStatusIndex >= 0 &&
      markPaidBody.includes("stock_decrement_failed") &&
      markPaidBody.includes("throw new Error"),
    "Un echec stock est trace en failed et reste retryable.",
  ),
  check(
    "no_supplier_or_payment_side_effect",
    !/supplier.*order|commande fournisseur|fetch\(/i.test(markPaidBody),
    "Le helper paye/stock ne commande pas chez un fournisseur et ne contacte aucun service externe.",
  ),
];

const checkedAt = new Date().toISOString();
const dateKey = checkedAt.slice(0, 10).replace(/-/g, "");
const failures = checks.filter((item) => !item.ok);
const summary = {
  ok: failures.length === 0,
  checkedAt,
  mode: "read_only_stripe_webhook_stock_guard_audit",
  checkCount: checks.length,
  failureCount: failures.length,
  checks,
  failures,
  filesInspected: [
    path.relative(root, webhookRoutePath).replace(/\\/g, "/"),
    path.relative(root, dropshippingServerPath).replace(/\\/g, "/"),
    path.relative(root, dropshippingSharedPath).replace(/\\/g, "/"),
    path.relative(root, orderSuccessPath).replace(/\\/g, "/"),
  ],
  safety: {
    readOnlyAudit: true,
    noPayment: true,
    noSupplierOrder: true,
    noAdminClientDecrement: true,
    noExternalApiCall: true,
    noSecretsCopied: true,
  },
};

const reportDir = path.join(outputRoot, `stripe-webhook-stock-${dateKey}`);
fs.mkdirSync(reportDir, { recursive: true });
const jsonPath = path.join(reportDir, `AUDIT_STRIPE_WEBHOOK_STOCK_GUARDS_${dateKey}.json`);
const mdPath = path.join(reportDir, `AUDIT_STRIPE_WEBHOOK_STOCK_GUARDS_${dateKey}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      checkCount: summary.checkCount,
      failureCount: summary.failureCount,
      failures: summary.failures.map((item) => item.name),
      files: { jsonPath, mdPath },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

if (!summary.ok) {
  process.exitCode = 1;
}

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const adminPanelPath = path.join(root, "src", "components", "DropshippingAdminPanel.tsx");
const operationsPath = path.join(root, "src", "lib", "dropshipping-operations.ts");
const operationsBoardPath = path.join(root, "scripts", "automation", "prepare_dropshipping_order_operations_board.mjs");
const outputRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function sectionBetween(source, startMarker, endMarker) {
  const startIndex = source.indexOf(startMarker);
  if (startIndex < 0) {
    return "";
  }

  const section = source.slice(startIndex);
  const endIndex = section.indexOf(endMarker);
  return endIndex >= 0 ? section.slice(0, endIndex) : section;
}

function check(name, ok, detail) {
  return { name, ok: Boolean(ok), detail };
}

function markdownReport(summary) {
  const lines = [
    "# Audit dropshipping order admin safety",
    "",
    `Date: ${summary.checkedAt}`,
    "",
    `Status: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "## Summary",
    "",
    `- Checks: ${summary.checkCount}`,
    `- Failures: ${summary.failureCount}`,
    `- Disabled guarded controls: ${summary.disabledGuardedControlCount}`,
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

const source = readFile(adminPanelPath);
const operationsSource = readFile(operationsPath);
const operationsBoardSource = readFile(operationsBoardPath);
const readinessBody = sectionBetween(
  operationsSource,
  "export function getDropshippingSupplierActionReadiness",
  "export function getDropshippingOrderOperationsSummary",
);
const summaryBody = sectionBetween(
  operationsSource,
  "export function getDropshippingOrderOperationsSummary",
  "export function getDropshippingOrderOperation(",
);
const orderCardBody = sectionBetween(source, "function OrderCard", "function Field");
const operationBody = sectionBetween(
  operationsSource,
  "export function getDropshippingOrderOperation",
  "export function getDropshippingOrderLineProofGaps",
);
const disabledGuardedControlCount = (
  orderCardBody.match(/disabled=\{!supplierActionsEnabled\}/g) ?? []
).length;
const onUpdateCalls = (orderCardBody.match(/onUpdate\(order\.id/g) ?? []).length;

const checks = [
  check(
    "readiness_helper_exists",
    readinessBody.length > 0 && source.includes("getDropshippingSupplierActionReadiness"),
    "La readiness fournisseur vient du helper partage src/lib/dropshipping-operations.ts.",
  ),
  check(
    "paid_payment_required",
    readinessBody.includes('const hasPaidPayment = order.paymentStatus === "paid"') &&
      readinessBody.includes("if (!hasPaidPayment)"),
    "Une action fournisseur exige une commande marquee paid par webhook.",
  ),
  check(
    "stock_done_required",
    readinessBody.includes('order.stockDecrementStatus === "done"'),
    "Une action fournisseur exige un stock webhook ajuste avec statut done.",
  ),
  check(
    "failed_or_skipped_stock_blocked",
    readinessBody.includes('order.stockDecrementStatus === "failed"') &&
      readinessBody.includes('order.stockDecrementStatus === "skipped"') &&
      readinessBody.includes("Recontroler le stock webhook"),
    "Les statuts stock failed/skipped restent bloques avant fournisseur.",
  ),
  check(
    "supplier_actions_enabled_is_derived",
    source.includes('from "@/lib/dropshipping-operations"') &&
      orderCardBody.includes("const supplierActionReadiness = getDropshippingSupplierActionReadiness(order)") &&
      orderCardBody.includes("const supplierActionsEnabled = supplierActionReadiness.ready"),
    "Les boutons et champs utilisent la readiness calculee, pas un etat libre.",
  ),
  check(
    "supplier_controls_disabled",
    disabledGuardedControlCount >= 6,
    "Preparation fournisseur, reference, tracking et suivi client sont desactives si la commande n'est pas prete.",
  ),
  check(
    "all_supplier_updates_have_visible_guard",
    onUpdateCalls >= 4 &&
      orderCardBody.includes("Actions fournisseur bloquees") &&
      orderCardBody.includes("Actions fournisseur ouvertes"),
    "L'admin affiche clairement le blocage ou l'ouverture des actions fournisseur.",
  ),
  check(
    "summary_flags_stock_exceptions",
    summaryBody.includes("stockExceptionCount") &&
      source.includes("getDropshippingOrderOperationsSummary") &&
      source.includes("Commandes payees avec stock webhook non valide"),
    "Le haut de l'admin signale les commandes payees dont le stock webhook n'est pas valide.",
  ),
  check(
    "readiness_has_no_side_effect",
    !/fetch\(|onUpdate\(|\bPATCH\b|\bPOST\b|writeFile|appendFile|unlink/.test(operationsSource),
    "Les helpers operations restent en lecture locale sans appel reseau ni commande fournisseur.",
  ),
  check(
    "operations_board_uses_shared_contract",
    operationsBoardSource.includes("operationsModulePath") &&
      operationsBoardSource.includes("getDropshippingOrderOperation") &&
      operationsBoardSource.includes("getDropshippingOrderOperationBoardItems") &&
      operationsBoardSource.includes("getDropshippingOrderOperationCounts") &&
      operationsSource.includes("getDropshippingOrderLineProofGaps(order)") &&
      !operationsBoardSource.includes("function orderReadiness") &&
      operationBody.includes("STOCK_EXCEPTION") &&
      operationBody.includes("READY_SUPPLIER_PREP"),
    "Le board operations reutilise le meme helper partage que l'admin.",
  ),
  check(
    "client_marketplace_names_stay_hidden",
    !/ali\s*express/i.test(source),
    "Le panneau admin ne reintroduit aucune mention marketplace fournisseur dans la surface.",
  ),
];

const checkedAt = new Date().toISOString();
const dateKey = checkedAt.slice(0, 10).replace(/-/g, "");
const failures = checks.filter((item) => !item.ok);
const summary = {
  ok: failures.length === 0,
  checkedAt,
  mode: "read_only_dropshipping_order_admin_safety_audit",
  checkCount: checks.length,
  failureCount: failures.length,
  disabledGuardedControlCount,
  onUpdateCalls,
  checks,
  failures,
  filesInspected: [
    path.relative(root, adminPanelPath).replace(/\\/g, "/"),
    path.relative(root, operationsPath).replace(/\\/g, "/"),
    path.relative(root, operationsBoardPath).replace(/\\/g, "/"),
  ],
  safety: {
    readOnlyAudit: true,
    noPayment: true,
    noSupplierOrder: true,
    noPublication: true,
    noExternalApiCall: true,
    noSecretsCopied: true,
  },
};

const reportDir = path.join(outputRoot, `dropshipping-order-admin-safety-${dateKey}`);
fs.mkdirSync(reportDir, { recursive: true });
const jsonPath = path.join(reportDir, `AUDIT_DROPSHIPPING_ORDER_ADMIN_SAFETY_${dateKey}.json`);
const mdPath = path.join(reportDir, `AUDIT_DROPSHIPPING_ORDER_ADMIN_SAFETY_${dateKey}.md`);
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

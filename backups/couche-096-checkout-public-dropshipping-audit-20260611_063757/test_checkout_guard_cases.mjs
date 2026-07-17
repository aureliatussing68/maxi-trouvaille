import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checkoutRoutePath = path.join(root, "src", "app", "api", "checkout", "route.ts");
const outputDir = path.join(root, "business-maxi-trouvailles", "file-validation-fournisseurs");

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readFile(filePath));
}

function runEligibilityAudit() {
  const run = spawnSync("node", ["scripts/automation/audit_checkout_eligibility.mjs"], {
    cwd: root,
    encoding: "utf8",
  });

  let parsed = null;
  try {
    parsed = JSON.parse(run.stdout);
  } catch {
    parsed = { rawOutput: run.stdout.trim() };
  }

  return {
    ok: run.status === 0,
    exitCode: run.status,
    stdout: parsed,
    stderr: run.stderr.trim(),
  };
}

function includesAll(source, patterns) {
  return patterns.every((pattern) =>
    pattern instanceof RegExp ? pattern.test(source) : source.includes(pattern),
  );
}

function caseResult({ id, label, target, passed, evidence, product }) {
  return {
    id,
    label,
    target,
    passed: Boolean(passed),
    evidence,
    product: product
      ? {
          id: product.id,
          name: product.name,
          status: product.status,
          categoryId: product.categoryId,
          stock: product.stock,
          isTestProduct: product.isTestProduct,
          comingSoon: product.comingSoon,
          expectedPurchasable: product.expectedPurchasable,
        }
      : undefined,
  };
}

function markdownReport(summary) {
  const lines = [
    "# Checkout guard case tests",
    "",
    `Date: ${summary.checkedAt}`,
    "",
    `Status: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "## Summary",
    "",
    `- Cases tested: ${summary.caseCount}`,
    `- Passed: ${summary.passedCount}`,
    `- Failed: ${summary.failedCount}`,
    `- Eligibility audit ok: ${summary.eligibilityAudit.ok}`,
    "",
    "## Cases",
    "",
    ...summary.cases.map(
      (testCase) =>
        `- ${testCase.passed ? "OK" : "ECHEC"} ${testCase.id}: ${testCase.label} - ${testCase.evidence}`,
    ),
    "",
    "## Failed cases",
    "",
    ...(summary.failedCases.length
      ? summary.failedCases.map((testCase) => `- ${testCase.id}: ${testCase.label}`)
      : ["- Aucun"]),
    "",
    "## Safety",
    "",
    ...Object.entries(summary.safety).map(([key, value]) => `- ${key}: ${value}`),
    "",
  ];

  return `${lines.join("\n")}\n`;
}

const eligibilityAudit = runEligibilityAudit();
const checkoutRouteSource = readFile(checkoutRoutePath);
const checkoutRouteLower = checkoutRouteSource.toLowerCase();
const auditJsonPath = eligibilityAudit.stdout?.files?.jsonPath;
const eligibilitySummary = auditJsonPath && fs.existsSync(auditJsonPath)
  ? readJson(auditJsonPath)
  : null;
const productSummaries = eligibilitySummary?.productSummaries ?? [];
const sourceGuards = eligibilitySummary?.sourceGuards ?? {};

const testProduct = productSummaries.find(
  (product) => product.id === "prod_test_pack_decouverte_001",
);
const resellerTestProduct = productSummaries.find(
  (product) => product.id === "prod_pack_revendeur_001",
);
const comingSoonProduct = productSummaries.find((product) => product.comingSoon);
const draftPartnerProduct = productSummaries.find(
  (product) => product.dropshippingEnabled && product.status === "draft",
);
const purchasableProduct = productSummaries.find(
  (product) => product.expectedPurchasable && product.source === "internal",
);

const cases = [
  caseResult({
    id: "empty_cart",
    label: "API rejects empty cart before line item creation",
    target: "src/app/api/checkout/route.ts",
    passed: includesAll(checkoutRouteSource, [
      /!Array\.isArray\(payload\.items\) \|\| payload\.items\.length === 0/,
      "Panier vide.",
    ]),
    evidence: "Source contains empty cart branch and customer-safe error.",
  }),
  caseResult({
    id: "duplicate_product",
    label: "API rejects duplicate product IDs",
    target: "src/app/api/checkout/route.ts",
    passed: sourceGuards.apiRejectsDuplicateProductIds,
    evidence: "Route uses seenProductIds before Stripe session creation.",
  }),
  caseResult({
    id: "forced_test_product",
    label: "Forced test product stays blocked",
    target: "src/lib/catalog.ts + src/app/api/checkout/route.ts",
    product: testProduct,
    passed:
      Boolean(testProduct) &&
      testProduct.isTestProduct &&
      !testProduct.expectedPurchasable &&
      sourceGuards.apiRejectsUnavailableProducts,
    evidence: "Test product is not expected purchasable and API calls isProductPurchasable.",
  }),
  caseResult({
    id: "forced_reseller_test_product",
    label: "Forced reseller test product stays blocked",
    target: "src/lib/catalog.ts + src/app/api/checkout/route.ts",
    product: resellerTestProduct,
    passed:
      Boolean(resellerTestProduct) &&
      resellerTestProduct.isTestProduct &&
      !resellerTestProduct.expectedPurchasable &&
      sourceGuards.apiRejectsUnavailableProducts,
    evidence: "Reseller test product is blocked by strict purchasable rule.",
  }),
  caseResult({
    id: "forced_coming_soon_product",
    label: "Forced coming-soon surprise product stays blocked",
    target: "src/lib/catalog.ts + src/app/api/checkout/route.ts",
    product: comingSoonProduct,
    passed:
      Boolean(comingSoonProduct) &&
      comingSoonProduct.comingSoon &&
      !comingSoonProduct.expectedPurchasable &&
      sourceGuards.apiRejectsUnavailableProducts,
    evidence: "Coming-soon product is not expected purchasable and API checks availability.",
  }),
  caseResult({
    id: "forced_draft_partner_product",
    label: "Forced draft partner product stays blocked",
    target: "data/quick-products.json + src/app/api/checkout/route.ts",
    product: draftPartnerProduct,
    passed:
      Boolean(draftPartnerProduct) &&
      draftPartnerProduct.status === "draft" &&
      !draftPartnerProduct.expectedPurchasable &&
      sourceGuards.apiRejectsUnavailableProducts,
    evidence: "Draft partner product remains HOLD before any checkout session.",
  }),
  caseResult({
    id: "over_stock_quantity",
    label: "API rejects quantity above product stock",
    target: "src/app/api/checkout/route.ts",
    product: purchasableProduct,
    passed: Boolean(purchasableProduct) && sourceGuards.apiRejectsOverStockQuantity,
    evidence: "Route compares requested quantity to product.stock.",
  }),
  caseResult({
    id: "non_internal_source",
    label: "API rejects non-internal marketplace source",
    target: "src/app/api/checkout/route.ts",
    passed: sourceGuards.apiRejectsNonInternalProducts,
    evidence: "Route blocks non-internal products until marketplace payment exists.",
  }),
  caseResult({
    id: "shipping_required",
    label: "API validates shipping selection before Stripe session creation",
    target: "src/app/api/checkout/route.ts",
    passed: sourceGuards.apiValidatesShippingSelection,
    evidence: "Route calls validateShippingSelection before checkout session create.",
  }),
  caseResult({
    id: "no_supplier_leak",
    label: "Checkout route does not expose supplier URLs to Stripe metadata",
    target: "src/app/api/checkout/route.ts",
    passed:
      sourceGuards.checkoutDoesNotExposeSupplierUrl &&
      !checkoutRouteLower.includes("supplierurl") &&
      !checkoutRouteLower.includes("aliexpress"),
    evidence: "Route metadata stays Maxi Trouvaille / logistics partner only.",
  }),
  caseResult({
    id: "live_payment_flag",
    label: "Live Stripe mode requires explicit enable flag",
    target: "src/app/api/checkout/route.ts",
    passed: sourceGuards.apiRequiresValidStripeMode,
    evidence: "Route requires STRIPE_ENABLE_LIVE_PAYMENTS for live secret keys.",
  }),
];

const failedCases = cases.filter((testCase) => !testCase.passed);
const checkedAt = new Date().toISOString();
const dateKey = checkedAt.slice(0, 10).replace(/-/g, "");
const summary = {
  ok: eligibilityAudit.ok && failedCases.length === 0,
  checkedAt,
  mode: "read_only_checkout_guard_case_tests",
  eligibilityAudit,
  caseCount: cases.length,
  passedCount: cases.length - failedCases.length,
  failedCount: failedCases.length,
  failedCases,
  cases,
  safety: {
    readOnlyAudit: true,
    noStripeSessionCreated: true,
    noPayment: true,
    noSupplierOrder: true,
    noPublication: true,
    noNetworkCallFromThisScript: true,
  },
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `CHECKOUT_GUARD_CASES_${dateKey}.json`);
const mdPath = path.join(outputDir, `CHECKOUT_GUARD_CASES_${dateKey}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      caseCount: summary.caseCount,
      passedCount: summary.passedCount,
      failedCount: summary.failedCount,
      failedCases: summary.failedCases.map((testCase) => ({
        id: testCase.id,
        label: testCase.label,
      })),
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

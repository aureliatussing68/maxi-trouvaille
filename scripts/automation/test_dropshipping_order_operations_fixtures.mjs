import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const operationsModulePath = path.join(root, "src", "lib", "dropshipping-operations.ts");
const outputRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");

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

const supplierProofToken = "SUPPLIER_INTERNAL_PROOF_SHOULD_NOT_EXPORT";
const hiddenCustomerEmail = "client.fixture.secret@example.invalid";
const hiddenCustomerPhone = "0600000000";
const hiddenStreet = "12 Rue Cachee Fixture";

function provenLine(overrides = {}) {
  return {
    productId: "fixture-product",
    productSlug: "fixture-product",
    productName: "Produit fixture operation",
    image: "/uploads/partner-products/fixture.webp",
    quantity: 1,
    supplierName: "Partenaire test cache",
    supplierUrl: supplierProofToken,
    supplierSku: "FIXTURE-SKU-001",
    supplierPriceCents: 1190,
    soldPriceCents: 2490,
    marginCents: 1300,
    supplierStock: 42,
    deliveryEstimate: "3-5 jours France",
    ...overrides,
  };
}

function baseOrder(overrides = {}) {
  const orderNumber = overrides.orderNumber ?? "MT-FIX-BASE";

  return {
    id: `fixture-${orderNumber.toLowerCase()}`,
    orderNumber,
    paymentStatus: "paid",
    status: "a-traiter",
    stockDecrementStatus: "done",
    customer: {
      name: "Client Fixture Secret",
      email: hiddenCustomerEmail,
      phone: hiddenCustomerPhone,
    },
    shippingAddress: {
      street: hiddenStreet,
      postalCode: "75000",
      city: "Paris",
      country: "FR",
      methodLabel: "Livraison fixture",
    },
    lines: [provenLine()],
    supplierTotalCents: 1190,
    soldTotalCents: 2490,
    estimatedMarginCents: 1300,
    shippingPriceCents: 490,
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
    ...overrides,
  };
}

function scenarioOrder(definition) {
  return baseOrder({
    orderNumber: definition.orderNumber,
    paymentStatus: definition.paymentStatus ?? "paid",
    status: definition.status ?? "a-traiter",
    stockDecrementStatus: definition.stockDecrementStatus ?? "done",
    trackingNumber: definition.trackingNumber,
    supplierOrderReference: definition.supplierOrderReference,
    followUpMessagePreparedAt: definition.followUpMessagePreparedAt,
    lines: definition.lines ?? [provenLine()],
    updatedAt: definition.updatedAt ?? "2026-06-12T00:00:00.000Z",
  });
}

function hasSameSet(actual, expected) {
  return (
    actual.length === expected.length &&
    expected.every((entry) => actual.includes(entry))
  );
}

function markdown(summary) {
  const scenarioRows = summary.scenarios.map(
    (scenario) =>
      `| ${scenario.ok ? "OK" : "ECHEC"} | ${scenario.name} | ${scenario.actualLane} | ${scenario.actualAllowed} |`,
  );
  const exportRows = summary.exportedRows.map(
    (row) =>
      `| ${row.priority} | ${row.lane} | ${row.orderNumber} | ${row.stockDecrementStatus} | ${row.supplierActionAllowed} |`,
  );

  return `${[
    "# Maxi Trouvailles - Test fixtures operations commandes dropshipping",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Resultat",
    "",
    `- Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    `- Scenarios operations: ${summary.scenarios.length}`,
    `- Lignes exportees redigees: ${summary.exportedRows.length}`,
    `- Fuites sensibles detectees: ${summary.sensitiveExportCheck.failureCount}`,
    "",
    "## Scenarios",
    "",
    "| Statut | Scenario | File obtenue | Action fournisseur autorisee |",
    "|---|---|---|---|",
    ...scenarioRows,
    "",
    "## Export redige controle",
    "",
    "| Priorite | File | Commande | Stock webhook | Action fournisseur |",
    "|---:|---|---|---|---|",
    ...exportRows,
    "",
    "## Preuves produit",
    "",
    `- Gaps attendus sur fixture incomplete: ${summary.proofGapCheck.ok ? "OK" : "ECHEC"}`,
    `- Gaps obtenus: ${summary.proofGapCheck.actual.join(", ") || "aucun"}`,
    "",
    "## Garde-fous",
    "",
    "- Fixtures locales en memoire uniquement.",
    "- Aucune commande reelle lue ou modifiee.",
    "- Aucun paiement.",
    "- Aucune commande fournisseur.",
    "- Aucune publication.",
    "- Aucun lien fournisseur, email, telephone ou adresse client exporte.",
    "",
  ].join("\n")}\n`;
}

const scenarios = [
  {
    name: "wait_payment_blocks_supplier",
    orderNumber: "MT-FIX-WAIT-PAYMENT",
    paymentStatus: "stripe-session-created",
    stockDecrementStatus: "pending-payment",
    expectedLane: "WAIT_PAYMENT",
    expectedAllowed: false,
    expectedPriority: 40,
  },
  {
    name: "paid_stock_failed_blocks_supplier",
    orderNumber: "MT-FIX-STOCK-FAILED",
    stockDecrementStatus: "failed",
    expectedLane: "STOCK_EXCEPTION",
    expectedAllowed: false,
    expectedPriority: 1,
  },
  {
    name: "paid_stock_skipped_blocks_supplier",
    orderNumber: "MT-FIX-STOCK-SKIPPED",
    stockDecrementStatus: "skipped",
    expectedLane: "STOCK_EXCEPTION",
    expectedAllowed: false,
    expectedPriority: 2,
  },
  {
    name: "paid_stock_pending_blocks_supplier",
    orderNumber: "MT-FIX-STOCK-PENDING",
    stockDecrementStatus: "pending-payment",
    expectedLane: "STOCK_EXCEPTION",
    expectedAllowed: false,
    expectedPriority: 3,
  },
  {
    name: "paid_stock_done_ready_supplier_prep",
    orderNumber: "MT-FIX-READY",
    expectedLane: "READY_SUPPLIER_PREP",
    expectedAllowed: true,
    expectedPriority: 10,
  },
  {
    name: "supplier_order_waits_tracking",
    orderNumber: "MT-FIX-WAIT-TRACKING",
    status: "commande-fournisseur",
    supplierOrderReference: "SUPPLIER-REF-HIDDEN",
    expectedLane: "WAIT_TRACKING",
    expectedAllowed: true,
    expectedPriority: 20,
  },
  {
    name: "shipped_ready_follow_up",
    orderNumber: "MT-FIX-FOLLOW-UP",
    status: "expedie",
    trackingNumber: "TRACKING-HIDDEN",
    expectedLane: "READY_FOLLOW_UP",
    expectedAllowed: true,
    expectedPriority: 25,
  },
  {
    name: "delivered_done",
    orderNumber: "MT-FIX-DONE",
    status: "livre",
    trackingNumber: "TRACKING-HIDDEN-DONE",
    followUpMessagePreparedAt: "2026-06-12T01:00:00.000Z",
    expectedLane: "DONE",
    expectedAllowed: true,
    expectedPriority: 90,
  },
];

const operations = await importSharedOperationsModule();
const fixtureOrders = scenarios.map((scenario) => scenarioOrder(scenario));
const scenarioResults = scenarios.map((scenario, index) => {
  const operation = operations.getDropshippingOrderOperation(fixtureOrders[index]);

  return {
    name: scenario.name,
    ok:
      operation.lane === scenario.expectedLane &&
      operation.supplierActionAllowed === scenario.expectedAllowed &&
      operation.priority === scenario.expectedPriority,
    expectedLane: scenario.expectedLane,
    actualLane: operation.lane,
    expectedAllowed: scenario.expectedAllowed,
    actualAllowed: operation.supplierActionAllowed,
    expectedPriority: scenario.expectedPriority,
    actualPriority: operation.priority,
  };
});

const proofGapOrder = baseOrder({
  orderNumber: "MT-FIX-PROOF-GAPS",
  lines: [
    provenLine({
      supplierUrl: "",
      supplierSku: "",
      supplierPriceCents: 0,
      supplierStock: undefined,
      deliveryEstimate: "a verifier",
    }),
  ],
});
const expectedProofGaps = [
  "lien fournisseur",
  "SKU",
  "prix fournisseur",
  "stock fournisseur",
  "delai",
];
const actualProofGaps = operations.getDropshippingOrderLineProofGaps(proofGapOrder);
const proofGapCheck = {
  ok: hasSameSet(actualProofGaps, expectedProofGaps),
  expected: expectedProofGaps,
  actual: actualProofGaps,
};
const allFixtureOrders = [...fixtureOrders, proofGapOrder];
const exportedRows = operations.getDropshippingOrderOperationBoardItems(allFixtureOrders);
const counts = operations.getDropshippingOrderOperationCounts(
  allFixtureOrders,
  exportedRows,
);
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(outputRoot, `dropshipping-order-operations-fixtures-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: false,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "fixture_only_dropshipping_order_operations",
  source: path.relative(root, operationsModulePath).replace(/\\/g, "/"),
  counts: {
    ...counts,
    done: exportedRows.filter((row) => row.lane === "DONE").length,
  },
  scenarios: scenarioResults,
  proofGapCheck,
  sensitiveExportCheck: {
    ok: false,
    failureCount: 0,
  },
  exportedRows,
  safety: {
    fixtureOnly: true,
    noRealOrdersRead: true,
    noCatalogWrite: true,
    noPayment: true,
    noSupplierOrder: true,
    noPublication: true,
    noExternalApiCall: true,
    supplierLinksHidden: true,
    customerDetailsHidden: true,
  },
};

const firstMarkdown = markdown(summary);
const firstExportText = `${JSON.stringify(summary, null, 2)}\n${firstMarkdown}`;
const sensitiveSignals = [
  { label: "supplier proof token", value: supplierProofToken },
  { label: "customer email", value: hiddenCustomerEmail },
  { label: "customer phone", value: hiddenCustomerPhone },
  { label: "shipping street", value: hiddenStreet },
  { label: "supplier field name", value: "supplierUrl" },
  { label: "shipping field name", value: "shippingAddress" },
  { label: "external url marker", value: "http" + "://" },
  { label: "marketplace marker", value: "aliexpress" },
  { label: "wholesale marker", value: "wholesale" },
];
const leakedSignals = sensitiveSignals.filter((signal) =>
  firstExportText.toLowerCase().includes(signal.value.toLowerCase()),
);
summary.sensitiveExportCheck = {
  ok: leakedSignals.length === 0,
  failureCount: leakedSignals.length,
  failureLabels: leakedSignals.map((signal) => signal.label),
};
summary.ok =
  scenarioResults.every((scenario) => scenario.ok) &&
  proofGapCheck.ok &&
  summary.sensitiveExportCheck.ok;

const jsonPath = path.join(
  outputDir,
  `TEST_DROPSHIPPING_ORDER_OPERATIONS_FIXTURES_${dateKey}.json`,
);
const mdPath = path.join(
  outputDir,
  `TEST_DROPSHIPPING_ORDER_OPERATIONS_FIXTURES_${dateKey}.md`,
);
const mdText = markdown(summary);
fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, mdText, "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      scenarioFailureCount: scenarioResults.filter((scenario) => !scenario.ok).length,
      proofGapOk: proofGapCheck.ok,
      sensitiveExportOk: summary.sensitiveExportCheck.ok,
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

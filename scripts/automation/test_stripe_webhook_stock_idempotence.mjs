import { spawn, spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const root = process.cwd();
const quickProductsPath = path.join(root, "data", "quick-products.json");
const ordersPath = path.join(root, "data", "dropshipping-orders.json");
const outputRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const fixtureProductId = "quick_webhook_idempotence_fixture_176";
const fixtureSessionId = "cs_local_webhook_idempotence_fixture_176";
const webhookSecret = "maxi_local_webhook_secret_not_real_176";
const localStripeSecret = "maxi_local_stripe_secret_not_real_176";

function readTextOrNull(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function restoreText(filePath, originalText, fallbackText = "[]\n") {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, originalText ?? fallbackText, "utf8");
}

function nowIso() {
  return new Date().toISOString();
}

function createFixtureProduct() {
  return {
    id: fixtureProductId,
    slug: "test-local-webhook-idempotence-stock",
    name: "Test local webhook stock idempotent",
    categoryId: "dropshipping-nouveautes",
    price: 1990,
    condition: "Neuf",
    stock: 7,
    badge: "HOLD test local",
    image: "/uploads/partner-products/test-local-webhook-idempotence.webp",
    images: ["/uploads/partner-products/test-local-webhook-idempotence.webp"],
    shortDescription: "Fixture locale restauree apres test webhook.",
    description:
      "Produit temporaire pour verifier le decrement idempotent du webhook Stripe local.",
    features: [
      "Fixture locale uniquement",
      "Quantite disponible : 7",
      "Aucune publication",
    ],
    source: "internal",
    status: "draft",
    livraisonDisponible: "toutes",
    dropshipping: {
      enabled: true,
      supplierName: "Fournisseur test local",
      supplierUrl: "https://example.invalid/fournisseur-test-local",
      supplierSku: "LOCAL-WEBHOOK-176",
      supplierPriceCents: 700,
      salePriceCents: 1990,
      marginCents: 1290,
      supplierStock: 7,
      deliveryEstimate: "8 a 15 jours ouvres",
      lastSyncAt: nowIso(),
    },
  };
}

function createFixtureOrder() {
  const checkedAt = nowIso();

  return {
    id: "drop_webhook_idempotence_fixture_176",
    orderNumber: "MT-DROP-TEST-176",
    stripeSessionId: fixtureSessionId,
    paymentStatus: "stripe-session-created",
    status: "a-traiter",
    stockDecrementStatus: "pending-payment",
    customer: {
      name: "Client test local",
      email: "client-test@example.invalid",
      phone: "0000000000",
    },
    shippingAddress: {
      street: "1 rue du test local",
      postalCode: "75000",
      city: "Paris",
      country: "France",
      methodLabel: "Livraison test locale",
    },
    lines: [
      {
        productId: fixtureProductId,
        productSlug: "test-local-webhook-idempotence-stock",
        productName: "Test local webhook stock idempotent",
        image: "/uploads/partner-products/test-local-webhook-idempotence.webp",
        quantity: 2,
        supplierName: "Fournisseur test local",
        supplierUrl: "https://example.invalid/fournisseur-test-local",
        supplierSku: "LOCAL-WEBHOOK-176",
        supplierPriceCents: 700,
        soldPriceCents: 1990,
        marginCents: 1290,
        supplierStock: 7,
        deliveryEstimate: "8 a 15 jours ouvres",
      },
    ],
    supplierTotalCents: 1400,
    soldTotalCents: 3980,
    estimatedMarginCents: 2580,
    shippingPriceCents: 0,
    internalNote:
      "Fixture locale: aucune commande fournisseur, aucun paiement reel.",
    createdAt: checkedAt,
    updatedAt: checkedAt,
  };
}

function createPayload() {
  return JSON.stringify({
    id: "evt_local_webhook_idempotence_fixture_176",
    object: "event",
    api_version: "2026-04-22.dahlia",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    type: "checkout.session.completed",
    data: {
      object: {
        id: fixtureSessionId,
        object: "checkout.session",
        metadata: {
          hasDropshippingItems: "true",
        },
      },
    },
  });
}

function createStripeSignatureHeader(payload) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");

  return `t=${timestamp},v1=${signature}`;
}

function getFreePort(startPort = 3042) {
  return new Promise((resolve, reject) => {
    function tryPort(port) {
      const server = net.createServer();
      server.once("error", () => tryPort(port + 1));
      server.once("listening", () => {
        server.close(() => resolve(port));
      });
      server.listen(port, "127.0.0.1");
    }

    try {
      tryPort(startPort);
    } catch (error) {
      reject(error);
    }
  });
}

function startDevServer(port) {
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const out = [];
  const err = [];
  const child = spawn(
    process.execPath,
    [nextBin, "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: root,
      env: {
        ...process.env,
        STRIPE_SECRET_KEY: localStripeSecret,
        STRIPE_WEBHOOK_SECRET: webhookSecret,
        STRIPE_ENABLE_LIVE_PAYMENTS: "false",
        NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  child.stdout.on("data", (chunk) => {
    out.push(String(chunk));
    if (out.length > 40) out.shift();
  });
  child.stderr.on("data", (chunk) => {
    err.push(String(chunk));
    if (err.length > 40) err.shift();
  });

  return { child, out, err };
}

function stopDevServer(server) {
  if (!server?.child?.pid) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(server.child.pid), "/T", "/F"], {
      cwd: root,
      stdio: "ignore",
    });
    return;
  }

  server.child.kill("SIGTERM");
}

async function waitForReady(baseUrl, server) {
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    if (server.child.exitCode !== null) {
      throw new Error(
        `next_dev_exited_${server.child.exitCode}: ${server.err.join("").slice(-1000)}`,
      );
    }

    try {
      const response = await fetch(baseUrl, { method: "GET" });
      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // Server is still booting.
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  throw new Error(`next_dev_not_ready: ${server.err.join("").slice(-1000)}`);
}

async function postSignedWebhook(baseUrl, payload) {
  const response = await fetch(`${baseUrl}/api/stripe/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": createStripeSignatureHeader(payload),
    },
    body: payload,
  });
  const text = await response.text();

  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return {
    status: response.status,
    ok: response.ok,
    body: json,
  };
}

function findFixtureProduct() {
  return readJson(quickProductsPath, []).find(
    (product) => product.id === fixtureProductId,
  );
}

function findFixtureOrder() {
  return readJson(ordersPath, []).find(
    (order) => order.stripeSessionId === fixtureSessionId,
  );
}

function check(name, ok, detail) {
  return { name, ok: Boolean(ok), detail };
}

function markdownReport(summary) {
  const lines = [
    "# Test Stripe webhook stock idempotence",
    "",
    `Date: ${summary.checkedAt}`,
    "",
    `Status: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "## Summary",
    "",
    `- Checks: ${summary.checkCount}`,
    `- Failures: ${summary.failureCount}`,
    `- Data restored: ${summary.dataRestored}`,
    `- Dev server stopped: ${summary.devServerStopped}`,
    "",
    "## Checks",
    "",
    ...summary.checks.map(
      (item) => `- ${item.ok ? "OK" : "ECHEC"} ${item.name} - ${item.detail}`,
    ),
    "",
    "## Runtime",
    "",
    `- Port local: ${summary.runtime.port ?? "non demarre"}`,
    `- Premier webhook: ${summary.runtime.firstWebhookStatus ?? "non execute"}`,
    `- Second webhook: ${summary.runtime.secondWebhookStatus ?? "non execute"}`,
    `- Stock initial: ${summary.runtime.initialStock}`,
    `- Stock apres premier webhook: ${summary.runtime.afterFirstStock ?? "n/a"}`,
    `- Stock apres second webhook: ${summary.runtime.afterSecondStock ?? "n/a"}`,
    "",
    "## Safety",
    "",
    ...Object.entries(summary.safety).map(([key, value]) => `- ${key}: ${value}`),
    "",
    summary.error ? `## Error\n\n${summary.error}\n` : "",
  ];

  return `${lines.join("\n")}\n`;
}

const originalQuickProductsText = readTextOrNull(quickProductsPath);
const originalOrdersText = readTextOrNull(ordersPath);
const checkedAt = nowIso();
const dateKey = checkedAt.slice(0, 10).replace(/-/g, "");
const checks = [];
const runtime = {
  initialStock: 7,
  decrementQuantity: 2,
};
let devServer = null;
let error = null;
let dataRestored = false;
let devServerStopped = false;

try {
  const quickProducts = readJson(quickProductsPath, []).filter(
    (product) => product.id !== fixtureProductId,
  );
  const orders = readJson(ordersPath, []).filter(
    (order) => order.stripeSessionId !== fixtureSessionId,
  );

  writeJson(quickProductsPath, [createFixtureProduct(), ...quickProducts]);
  writeJson(ordersPath, [createFixtureOrder(), ...orders]);

  checks.push(
    check(
      "fixture_written",
      Boolean(findFixtureProduct()) && Boolean(findFixtureOrder()),
      "Fixture produit et commande temporaire ajoutees avant le serveur.",
    ),
  );

  const port = await getFreePort();
  runtime.port = port;
  const baseUrl = `http://127.0.0.1:${port}`;
  devServer = startDevServer(port);
  await waitForReady(baseUrl, devServer);

  checks.push(
    check(
      "dev_server_ready",
      true,
      "Next dev local pret avec secrets webhook factices.",
    ),
  );

  const payload = createPayload();
  const firstWebhook = await postSignedWebhook(baseUrl, payload);
  runtime.firstWebhookStatus = firstWebhook.status;
  const afterFirstProduct = findFixtureProduct();
  const afterFirstOrder = findFixtureOrder();
  runtime.afterFirstStock = afterFirstProduct?.stock;
  runtime.afterFirstOrderStatus = afterFirstOrder?.stockDecrementStatus;

  const secondWebhook = await postSignedWebhook(baseUrl, payload);
  runtime.secondWebhookStatus = secondWebhook.status;
  const afterSecondProduct = findFixtureProduct();
  const afterSecondOrder = findFixtureOrder();
  runtime.afterSecondStock = afterSecondProduct?.stock;
  runtime.afterSecondOrderStatus = afterSecondOrder?.stockDecrementStatus;

  checks.push(
    check(
      "first_webhook_accepted",
      firstWebhook.status === 200 && firstWebhook.body?.received === true,
      "Premier webhook signe accepte localement.",
    ),
    check(
      "first_webhook_decrements_stock",
      afterFirstProduct?.stock === 5,
      "Stock fixture passe de 7 a 5 apres quantite 2.",
    ),
    check(
      "order_marked_paid_done",
      afterFirstOrder?.paymentStatus === "paid" &&
        afterFirstOrder?.stockDecrementStatus === "done" &&
        Boolean(afterFirstOrder?.stockDecrementedAt) &&
        afterFirstOrder?.stockDecrementLineCount === 1,
      "Commande marquee payee avec stockDecrementStatus done.",
    ),
    check(
      "second_webhook_accepted",
      secondWebhook.status === 200 && secondWebhook.body?.received === true,
      "Second webhook signe accepte comme retry/replay local.",
    ),
    check(
      "second_webhook_is_idempotent",
      afterSecondProduct?.stock === afterFirstProduct?.stock &&
        afterSecondOrder?.stockDecrementStatus === "done",
      "Le replay ne redecremente pas le stock deja traite.",
    ),
  );
} catch (caught) {
  error = caught instanceof Error ? caught.message : String(caught);
} finally {
  stopDevServer(devServer);
  devServerStopped = true;
  restoreText(quickProductsPath, originalQuickProductsText);
  restoreText(ordersPath, originalOrdersText);
  dataRestored =
    readTextOrNull(quickProductsPath) === (originalQuickProductsText ?? "[]\n") &&
    readTextOrNull(ordersPath) === (originalOrdersText ?? "[]\n");
}

checks.push(
  check(
    "data_files_restored",
    dataRestored,
    "quick-products.json et dropshipping-orders.json sont revenus a leur contenu initial exact.",
  ),
  check(
    "dev_server_stopped",
    devServerStopped,
    "Le serveur Next temporaire a ete stoppe apres le test.",
  ),
);

const failures = checks.filter((item) => !item.ok);
const summary = {
  ok: !error && failures.length === 0,
  checkedAt,
  mode: "local_signed_webhook_idempotence_test",
  checkCount: checks.length,
  failureCount: failures.length,
  checks,
  failures,
  error,
  dataRestored,
  devServerStopped,
  runtime,
  filesTemporarilyTouched: [
    path.relative(root, quickProductsPath).replace(/\\/g, "/"),
    path.relative(root, ordersPath).replace(/\\/g, "/"),
  ],
  safety: {
    localOnly: true,
    fakeStripeSecretsOnly: true,
    noStripeNetworkCall: true,
    noPayment: true,
    noSupplierOrder: true,
    noPublication: true,
    dataRestoredAfterTest: dataRestored,
  },
};

const reportDir = path.join(outputRoot, `stripe-webhook-idempotence-${dateKey}`);
fs.mkdirSync(reportDir, { recursive: true });
const jsonPath = path.join(reportDir, `TEST_STRIPE_WEBHOOK_IDEMPOTENCE_${dateKey}.json`);
const mdPath = path.join(reportDir, `TEST_STRIPE_WEBHOOK_IDEMPOTENCE_${dateKey}.md`);
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
      error: summary.error,
      runtime: summary.runtime,
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

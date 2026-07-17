import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pagePath = path.join(root, "src", "app", "admin", "pilotage", "page.tsx");
const boardRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function walk(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(entryPath, predicate, out);
    } else if (entry.isFile() && predicate(entry.name, entryPath)) {
      out.push(entryPath);
    }
  }

  return out;
}

function latestFile(files) {
  return files
    .map((filePath) => ({
      filePath,
      mtimeMs: fs.statSync(filePath).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.filePath ?? null;
}

function includesAll(source, labels) {
  return labels.map((label) => ({
    label,
    ok: source.includes(label),
  }));
}

function markdownReport(summary) {
  return `${[
    "# Audit Pilotage operations commandes dropshipping",
    "",
    `Date: ${summary.checkedAt}`,
    "",
    `Status: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "## Page",
    "",
    ...summary.pageChecks.map(
      (check) => `- ${check.ok ? "OK" : "ECHEC"} ${check.label}`,
    ),
    "",
    "## Board operations",
    "",
    `- Present: ${summary.board.present}`,
    `- Chemin: ${summary.board.path ?? "absent"}`,
    `- Items: ${summary.board.itemCount ?? 0}`,
    `- Exceptions stock: ${summary.board.stockExceptions ?? 0}`,
    `- Source partagee: ${summary.board.sharedOperationsSource ?? "absente"}`,
    "",
    "## Fuites",
    "",
    `- Signaux interdits: ${summary.leakSignals.length}`,
    ...(summary.leakSignals.length
      ? summary.leakSignals.map((signal) => `- ${signal}`)
      : ["- Aucun"]),
    "",
    "## Safety",
    "",
    ...Object.entries(summary.safety).map(([key, value]) => `- ${key}: ${value}`),
    "",
  ].join("\n")}\n`;
}

const checkedAt = new Date().toISOString();
const dateKey = checkedAt.slice(0, 10).replace(/-/g, "");
const pageSource = readText(pagePath);
const pageBodyStart = pageSource.indexOf("export default async function AdminPilotagePage");
const pageBody = pageBodyStart >= 0 ? pageSource.slice(pageBodyStart) : pageSource;
const pageChecks = [
  ...includesAll(pageSource, [
    "type DropshippingOrderOperationsBoard",
    "collectDropshippingOrderOperationsFiles",
    "readLatestDropshippingOrderOperations",
    "buildDropshippingOrderOperationsCsv",
    "dropshippingOrderOperationsExportHref",
    "Commandes dropshipping",
    "Stock et operations fournisseur",
    "Commandes stock a reprendre",
    "Garde-fou stock webhook",
    "npm run catalog:order-operations-board",
    "/admin/dropshipping",
  ]),
  {
    label: "admin guard before promise work",
    ok:
      pageBody.indexOf("if (!isAdminModeEnabled())") >= 0 &&
      pageBody.indexOf("if (!isAdminModeEnabled())") <
        pageBody.indexOf("Promise.all"),
  },
  {
    label: "operations board loaded in Promise.all",
    ok: pageSource.includes("readLatestDropshippingOrderOperations()"),
  },
];

const boardFiles = walk(
  boardRoot,
  (name) =>
    name.startsWith("DROPSHIPPING_ORDER_OPERATIONS_BOARD_") &&
    name.endsWith(".json"),
);
const latestBoardPath = latestFile(boardFiles);
const latestBoard = latestBoardPath
  ? JSON.parse(readText(latestBoardPath))
  : null;
const boardText = latestBoardPath ? readText(latestBoardPath) : "";
const leakSignals = [
  ...(boardText.match(/https?:\/\/|aliexpress|wholesale|shippingAddress/gi) ??
    []),
];

const boardSummary = {
  present: Boolean(latestBoard),
  path: latestBoardPath
    ? path.relative(root, latestBoardPath).replace(/\\/g, "/")
    : null,
  itemCount: latestBoard?.itemCount ?? null,
  stockExceptions: latestBoard?.counts?.stockExceptions ?? null,
  sharedOperationsSource: latestBoard?.sharedOperationsSource ?? null,
  safety: latestBoard?.safety ?? {},
};

const safety = {
  readOnlyAudit: true,
  noCatalogWrite: true,
  noPublication: true,
  noPayment: true,
  noSupplierOrder: true,
  noExternalApiCall: true,
  pageBehindAdminMode:
    pageChecks.find((check) => check.label === "admin guard before promise work")
      ?.ok ?? false,
  latestBoardHasNoSupplierUrlLeak: leakSignals.length === 0,
  latestBoardUsesSharedOperations:
    boardSummary.sharedOperationsSource === "src/lib/dropshipping-operations.ts",
};

const failures = [
  ...pageChecks.filter((check) => !check.ok).map((check) => check.label),
  ...(latestBoard ? [] : ["latest operations board missing"]),
  ...(leakSignals.length ? ["latest operations board leaks sensitive signals"] : []),
  ...(safety.latestBoardUsesSharedOperations
    ? []
    : ["latest operations board is not linked to shared operations helper"]),
];

const summary = {
  ok: failures.length === 0,
  checkedAt,
  mode: "read_only_pilotage_order_operations_panel_audit",
  pageChecks,
  board: boardSummary,
  leakSignals: [...new Set(leakSignals)],
  failureCount: failures.length,
  failures,
  safety,
};

const reportDir = path.join(
  boardRoot,
  `pilotage-order-operations-${dateKey}`,
);
fs.mkdirSync(reportDir, { recursive: true });
const jsonPath = path.join(
  reportDir,
  `AUDIT_PILOTAGE_ORDER_OPERATIONS_${dateKey}.json`,
);
const mdPath = path.join(
  reportDir,
  `AUDIT_PILOTAGE_ORDER_OPERATIONS_${dateKey}.md`,
);
fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      failureCount: summary.failureCount,
      failures: summary.failures,
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

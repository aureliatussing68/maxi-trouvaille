import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const adminDir = path.join(root, "src", "app", "admin");
const outputDir = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const sensitiveTokens = [
  "QuickProductImportForm",
  "ProductImageManager",
  "AdminReviewsPanel",
  "DropshippingAdminPanel",
  "ProductEditForm",
  "readQuickProducts(",
  "readProductMessages(",
  "getAllReviewsForAdmin(",
  "readDropshippingOrders(",
  "getAllProducts(",
  "getCatalogProductBySlug(",
  "readJson(",
  "readCsv(",
  "fs.",
  "Link",
];

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function listPageFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listPageFiles(entryPath);
    }

    return entry.isFile() && entry.name === "page.tsx" ? [entryPath] : [];
  });
}

function firstTokenIndex(source, tokens) {
  return tokens.reduce((best, token) => {
    const index = source.indexOf(token);
    if (index < 0) {
      return best;
    }

    return best < 0 ? index : Math.min(best, index);
  }, -1);
}

function guardIndex(source) {
  const direct = source.search(/if\s*\(!isAdminModeEnabled\(\)\)/);
  const adminEnabled = source.search(/if\s*\(!adminEnabled\)/);
  const adminMode = source.search(/if\s*\(!adminMode\)/);
  return [direct, adminEnabled, adminMode]
    .filter((index) => index >= 0)
    .reduce((best, index) => (best < 0 ? index : Math.min(best, index)), -1);
}

function inspectPage(filePath) {
  const source = readFile(filePath);
  const pageBodyStart = source.indexOf("export default");
  const pageBody = pageBodyStart >= 0 ? source.slice(pageBodyStart) : source;
  const importsAdminMode = source.includes('from "@/lib/admin"');
  const forcesDynamic = source.includes('export const dynamic = "force-dynamic"');
  const guard = guardIndex(pageBody);
  const firstSensitiveIndex = firstTokenIndex(pageBody, sensitiveTokens);
  const pageOk =
    importsAdminMode &&
    forcesDynamic &&
    guard >= 0 &&
    (firstSensitiveIndex < 0 || guard < firstSensitiveIndex);

  return {
    path: path.relative(root, filePath).replace(/\\/g, "/"),
    pageOk,
    importsAdminMode,
    forcesDynamic,
    hasAdminGuard: guard >= 0,
    guardBeforeSensitiveWork: firstSensitiveIndex < 0 || guard < firstSensitiveIndex,
    guardIndex: guard,
    firstSensitiveIndex,
  };
}

function markdownReport(summary) {
  const lines = [
    "# Audit admin page guards",
    "",
    `Date: ${summary.checkedAt}`,
    "",
    `Status: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "## Summary",
    "",
    `- Pages controlees: ${summary.pageCount}`,
    `- Echecs: ${summary.failureCount}`,
    "",
    "## Pages",
    "",
    ...summary.pages.map((page) => `- ${page.pageOk ? "OK" : "ECHEC"} ${page.path}`),
    "",
    "## Echecs",
    "",
    ...(summary.failures.length
      ? summary.failures.map((page) => `- ${page.path}`)
      : ["- Aucun"]),
    "",
    "## Safety",
    "",
    ...Object.entries(summary.safety).map(([key, value]) => `- ${key}: ${value}`),
    "",
  ];

  return `${lines.join("\n")}\n`;
}

const checkedAt = new Date().toISOString();
const dateKey = checkedAt.slice(0, 10).replace(/-/g, "");
const pages = listPageFiles(adminDir).sort().map(inspectPage);
const failures = pages.filter((page) => !page.pageOk);
const summary = {
  ok: failures.length === 0,
  checkedAt,
  mode: "read_only_admin_page_guard_audit",
  pageCount: pages.length,
  failureCount: failures.length,
  pages,
  failures,
  safety: {
    readOnlyAudit: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noMessageSent: true,
  },
};

const reportDir = path.join(outputDir, `admin-page-guards-${dateKey}`);
fs.mkdirSync(reportDir, { recursive: true });
const jsonPath = path.join(reportDir, `AUDIT_ADMIN_PAGE_GUARDS_${dateKey}.json`);
const mdPath = path.join(reportDir, `AUDIT_ADMIN_PAGE_GUARDS_${dateKey}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      pageCount: summary.pageCount,
      failureCount: summary.failureCount,
      failures: summary.failures.map((page) => page.path),
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

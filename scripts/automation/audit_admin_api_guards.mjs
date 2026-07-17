import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const adminApiDir = path.join(root, "src", "app", "api", "admin");
const outputDir = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const httpMethods = ["GET", "POST", "PATCH", "PUT", "DELETE"];
const sensitiveTokens = [
  "request.json(",
  "request.formData(",
  "request.text(",
  "readQuickProducts(",
  "writeQuickProducts(",
  "readDropshippingOrders(",
  "updateDropshippingOrder(",
  "getAllProducts(",
  "decrementQuickProductStock(",
  "updateReviewAdmin(",
  "deleteReview(",
  "fetch(",
  "analyzeWithOpenAi(",
];

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function listRouteFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listRouteFiles(entryPath);
    }

    return entry.isFile() && entry.name === "route.ts" ? [entryPath] : [];
  });
}

function extractFunctionBody(source, method) {
  const marker = `export async function ${method}`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  let openIndex = -1;
  let parenthesisDepth = 0;
  let signatureStarted = false;
  for (let index = markerIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") {
      parenthesisDepth += 1;
      signatureStarted = true;
    }
    if (char === ")") {
      parenthesisDepth -= 1;
      if (signatureStarted && parenthesisDepth === 0) {
        openIndex = source.indexOf("{", index);
        break;
      }
    }
  }

  if (openIndex < 0) {
    return null;
  }

  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openIndex + 1, index);
      }
    }
  }

  return null;
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

function inspectMethod(body) {
  const guardMatch = /if\s*\(!isAdminModeEnabled\(\)\)\s*{\s*return adminApiUnavailable\(\);\s*}/.exec(
    body,
  );
  const guardIndex = guardMatch?.index ?? -1;
  const firstSensitiveIndex = firstTokenIndex(body, sensitiveTokens);

  return {
    hasMaskedAdminGuard: guardIndex >= 0,
    guardBeforeSensitiveWork:
      guardIndex >= 0 && (firstSensitiveIndex < 0 || guardIndex < firstSensitiveIndex),
    guardIndex,
    firstSensitiveIndex,
  };
}

function inspectRoute(filePath) {
  const source = readFile(filePath);
  const methods = httpMethods.flatMap((method) => {
    const body = extractFunctionBody(source, method);
    if (!body) {
      return [];
    }

    return [
      {
        method,
        ...inspectMethod(body),
      },
    ];
  });
  const importsAdminMode = source.includes('from "@/lib/admin"');
  const importsAdminApiUnavailable = source.includes('from "@/lib/admin-api"');
  const routeOk =
    importsAdminMode &&
    importsAdminApiUnavailable &&
    methods.length > 0 &&
    methods.every(
      (method) => method.hasMaskedAdminGuard && method.guardBeforeSensitiveWork,
    );

  return {
    path: path.relative(root, filePath).replace(/\\/g, "/"),
    routeOk,
    importsAdminMode,
    importsAdminApiUnavailable,
    methods,
  };
}

function markdownReport(summary) {
  const lines = [
    "# Audit admin API guards",
    "",
    `Date: ${summary.checkedAt}`,
    "",
    `Status: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "## Summary",
    "",
    `- Routes controlees: ${summary.routeCount}`,
    `- Methodes controlees: ${summary.methodCount}`,
    `- Echecs: ${summary.failureCount}`,
    "",
    "## Routes",
    "",
    ...summary.routes.map(
      (route) =>
        `- ${route.routeOk ? "OK" : "ECHEC"} ${route.path} (${route.methods
          .map((method) => method.method)
          .join(", ")})`,
    ),
    "",
    "## Echecs",
    "",
    ...(summary.failures.length
      ? summary.failures.map((route) => `- ${route.path}`)
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
const routes = listRouteFiles(adminApiDir).sort().map(inspectRoute);
const failures = routes.filter((route) => !route.routeOk);
const summary = {
  ok: failures.length === 0,
  checkedAt,
  mode: "read_only_admin_api_guard_audit",
  routeCount: routes.length,
  methodCount: routes.reduce((count, route) => count + route.methods.length, 0),
  failureCount: failures.length,
  routes,
  failures,
  safety: {
    readOnlyAudit: true,
    noCatalogWrite: true,
    noPayment: true,
    noSupplierOrder: true,
    noMessageSent: true,
  },
};

const reportDir = path.join(outputDir, `admin-api-guards-${dateKey}`);
fs.mkdirSync(reportDir, { recursive: true });
const jsonPath = path.join(reportDir, `AUDIT_ADMIN_API_GUARDS_${dateKey}.json`);
const mdPath = path.join(reportDir, `AUDIT_ADMIN_API_GUARDS_${dateKey}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      routeCount: summary.routeCount,
      methodCount: summary.methodCount,
      failureCount: summary.failureCount,
      failures: summary.failures.map((route) => route.path),
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

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const offlinePagePath = path.join(root, "src", "app", "offline", "page.tsx");
const serviceWorkerPath = path.join(root, "public", "sw.js");

const requiredOfflineSignals = [
  "Chemin demo mobile",
  "CustomerSupportQuickLinks",
  "Paiement Maxi Trouvaille",
  "Rien n&apos;est envoye hors ligne.",
  "/",
  "/boutique",
  "/produits-partenaires",
  "/suivi-colis",
  "/contact",
];

const forbiddenPublicCopy = [
  "AliExpress",
  "Temu",
  "supplier",
  "seller",
  "marketplace",
  "fournisseur",
  "dropshipping",
  "HOLD",
  "Stripe",
  "mailto:",
];

const forbiddenOfflineShortcutUrls = [
  "/admin",
  "/api",
  "/panier",
  "/paiement",
  "/dropshipping",
  "/conditions-dropshipping",
  "/vendre",
  "/deposer-annonce",
];

const requiredDemoRoutes = [
  "/boutique",
  "/produits-partenaires",
  "/nouveautes",
  "/promotions",
  "/suivi-colis",
  "/contact",
];

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

function relativePath(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function readFile(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function lineOf(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function addFinding(findings, filePath, line, rule, detail) {
  findings.push({
    file: relativePath(filePath),
    line,
    rule,
    detail,
  });
}

function parseHrefValues(source) {
  const values = [];
  const pattern = /href:\s*["']([^"']+)["']|href=["']([^"']+)["']/g;

  for (const match of source.matchAll(pattern)) {
    values.push({
      value: match[1] ?? match[2],
      line: lineOf(source, match.index ?? 0),
    });
  }

  return values;
}

function parseArrayStringValues(source, arrayName) {
  const arrayMatch = source.match(new RegExp(`const ${arrayName} = \\[([\\s\\S]*?)\\];`));
  const arraySource = arrayMatch?.[1] ?? "";
  const offset = arrayMatch?.index ?? 0;
  const values = [];
  const pattern = /["']([^"']+)["']/g;

  for (const match of arraySource.matchAll(pattern)) {
    values.push({
      value: match[1],
      line: lineOf(source, offset + (match.index ?? 0)),
    });
  }

  return values;
}

function auditOfflinePage(source, findings) {
  if (!source) {
    addFinding(findings, offlinePagePath, 1, "offline_page_missing", "La page offline est introuvable.");
    return { hrefs: [] };
  }

  if (!/robots:\s*{[\s\S]*index:\s*false[\s\S]*follow:\s*false/.test(source)) {
    addFinding(
      findings,
      offlinePagePath,
      1,
      "offline_noindex_missing",
      "La page offline doit rester noindex/nofollow.",
    );
  }

  for (const signal of requiredOfflineSignals) {
    if (!source.includes(signal)) {
      addFinding(
        findings,
        offlinePagePath,
        1,
        "offline_required_signal_missing",
        `${signal} doit rester present sur la page hors ligne.`,
      );
    }
  }

  const lowerSource = source.toLowerCase();
  for (const forbiddenCopy of forbiddenPublicCopy) {
    const index = lowerSource.indexOf(forbiddenCopy.toLowerCase());
    if (index !== -1) {
      addFinding(
        findings,
        offlinePagePath,
        lineOf(source, index),
        "offline_sensitive_public_copy",
        `${forbiddenCopy} ne doit pas apparaitre sur la page hors ligne.`,
      );
    }
  }

  const hrefs = parseHrefValues(source);
  for (const href of hrefs) {
    for (const forbiddenUrl of forbiddenOfflineShortcutUrls) {
      if (href.value === forbiddenUrl || href.value.startsWith(`${forbiddenUrl}/`)) {
        addFinding(
          findings,
          offlinePagePath,
          href.line,
          "offline_forbidden_shortcut_url",
          `${href.value} ne doit pas etre un raccourci de secours offline.`,
        );
      }
    }
  }

  return { hrefs };
}

function auditServiceWorker(source, findings) {
  if (!source) {
    addFinding(findings, serviceWorkerPath, 1, "service_worker_missing", "public/sw.js est introuvable.");
    return { appShellUrls: [], demoRoutes: [], precacheUrls: [] };
  }

  const appShellUrls = parseArrayStringValues(source, "APP_SHELL");
  const demoRoutes = parseArrayStringValues(source, "DEMO_ROUTES");
  const precacheUrls = [...appShellUrls, ...demoRoutes];

  if (!appShellUrls.some((entry) => entry.value === "/offline")) {
    addFinding(
      findings,
      serviceWorkerPath,
      1,
      "offline_shell_missing",
      "Le service worker doit garder /offline dans l'app shell.",
    );
  }

  for (const route of requiredDemoRoutes) {
    if (!demoRoutes.some((entry) => entry.value === route)) {
      addFinding(
        findings,
        serviceWorkerPath,
        1,
        "demo_route_not_precached",
        `${route} doit rester dans DEMO_ROUTES pour la demo mobile.`,
      );
    }
  }

  if (!source.includes("caches.match(\"/offline\")")) {
    addFinding(
      findings,
      serviceWorkerPath,
      1,
      "offline_fallback_missing",
      "Le service worker doit garder /offline en fallback de navigation.",
    );
  }

  for (const entry of precacheUrls) {
    for (const forbiddenUrl of forbiddenOfflineShortcutUrls) {
      if (entry.value === forbiddenUrl || entry.value.startsWith(`${forbiddenUrl}/`)) {
        addFinding(
          findings,
          serviceWorkerPath,
          entry.line,
          "offline_precache_sensitive_route",
          `${entry.value} ne doit pas etre precache pour la demo mobile.`,
        );
      }
    }
  }

  if (!source.includes("cache.addAll(PRECACHE_URLS)")) {
    addFinding(
      findings,
      serviceWorkerPath,
      1,
      "precache_urls_not_used",
      "Le service worker doit precacher APP_SHELL et DEMO_ROUTES ensemble.",
    );
  }

  return { appShellUrls, demoRoutes, precacheUrls };
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(findings) {
  const headers = ["file", "line", "rule", "detail"];
  const rows = findings.map((finding) => headers.map((header) => csvEscape(finding[header])).join(","));

  return `${headers.join(",")}\n${rows.join("\n")}${rows.length ? "\n" : ""}`;
}

function markdown(summary) {
  const hrefRows = summary.offlineHrefs.map((href) => `| ${href.value} | ${href.line} |`);
  const demoRouteRows = summary.demoRoutes.map((route) => `| ${route.value} | ${route.line} |`);
  const findingRows =
    summary.findings.length === 0
      ? ["| OK | - | - | Aucun ecart detecte |"]
      : summary.findings.map(
          (finding) => `| ${finding.rule} | ${finding.file} | ${finding.line} | ${finding.detail} |`,
        );

  return `${[
    "# Audit offline demo mobile",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    `- Liens offline detectes: ${summary.offlineHrefCount}`,
    `- Routes demo precachees: ${summary.demoRouteCount}`,
    `- Alertes: ${summary.findingCount}`,
    "",
    "## Liens offline",
    "",
    "| URL | Ligne |",
    "|---|---:|",
    ...hrefRows,
    "",
    "## Routes demo precachees",
    "",
    "| URL | Ligne |",
    "|---|---:|",
    ...demoRouteRows,
    "",
    "## Alertes",
    "",
    "| Regle | Fichier | Ligne | Detail |",
    "|---|---|---:|---|",
    ...findingRows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule hors generation de rapport.",
    "- Aucun raccourci offline vers admin, API, panier, paiement ou routes legacy sensibles.",
    "- Aucun paiement, aucune commande partenaire, aucune publication.",
    "",
  ].join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const findings = [];
const offlineSource = readFile(offlinePagePath);
const serviceWorkerSource = readFile(serviceWorkerPath);
const offlineAudit = auditOfflinePage(offlineSource, findings);
const serviceWorkerAudit = auditServiceWorker(serviceWorkerSource, findings);

const outputDir = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  `audit-offline-demo-mobile-${dateKey}`,
);

const summary = {
  ok: findings.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_offline_demo_mobile_audit",
  offlinePagePath: relativePath(offlinePagePath),
  serviceWorkerPath: relativePath(serviceWorkerPath),
  requiredOfflineSignals,
  requiredDemoRoutes,
  forbiddenOfflineShortcutUrls,
  offlineHrefs: offlineAudit.hrefs,
  offlineHrefCount: offlineAudit.hrefs.length,
  appShellUrls: serviceWorkerAudit.appShellUrls,
  demoRoutes: serviceWorkerAudit.demoRoutes,
  demoRouteCount: serviceWorkerAudit.demoRoutes.length,
  precacheUrls: serviceWorkerAudit.precacheUrls,
  precacheUrlCount: serviceWorkerAudit.precacheUrls.length,
  findingCount: findings.length,
  findings,
  safety: {
    readOnlyAudit: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noMessageSent: true,
    noExternalRequest: true,
  },
};

fs.mkdirSync(outputDir, { recursive: true });

const jsonPath = path.join(outputDir, `AUDIT_OFFLINE_DEMO_MOBILE_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_OFFLINE_DEMO_MOBILE_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-audit-offline-demo-mobile-${dateKey}.csv`);

summary.files = {
  json: relativePath(jsonPath),
  md: relativePath(mdPath),
  csv: relativePath(csvPath),
};

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, toCsv(findings), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      offlineHrefCount: summary.offlineHrefCount,
      demoRouteCount: summary.demoRouteCount,
      precacheUrlCount: summary.precacheUrlCount,
      findingCount: summary.findingCount,
      files: summary.files,
      safety: summary.safety,
    },
    null,
    2,
  ),
);

if (!summary.ok) {
  process.exitCode = 1;
}

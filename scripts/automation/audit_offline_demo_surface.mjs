import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const offlinePagePath = path.join(root, "src", "app", "offline", "page.tsx");
const serviceWorkerPath = path.join(root, "public", "sw.js");
const serviceWorkerRegistrationPath = path.join(root, "src", "components", "ServiceWorkerRegister.tsx");
const layoutPath = path.join(root, "src", "app", "layout.tsx");

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

const requiredRegistrationSignals = [
  {
    label: "Client Component isole",
    value: '"use client";',
    detail: "Le composant d'enregistrement doit rester client-only pour utiliser window/navigator.",
  },
  {
    label: "API navigateur gardee",
    value: '"serviceWorker" in navigator',
    detail: "L'enregistrement doit verifier le support navigateur avant d'appeler navigator.serviceWorker.",
  },
  {
    label: "Contexte securise",
    value: "window.isSecureContext",
    detail: "Le service worker doit rester limite aux contextes securises ou au local.",
  },
  {
    label: "Localhost IPv4",
    value: "127.0.0.1",
    detail: "La demo locale IPv4 doit continuer a accepter le service worker.",
  },
  {
    label: "Localhost IPv6",
    value: "::1",
    detail: "La demo locale IPv6 doit continuer a accepter le service worker.",
  },
  {
    label: "Scope racine",
    value: "navigator.serviceWorker",
    detail: "Le composant doit piloter navigator.serviceWorker cote client.",
  },
  {
    label: "URL service worker",
    value: "serviceWorkerUrl = \"/sw.js\"",
    detail: "L'enregistrement doit rester pointe sur public/sw.js.",
  },
  {
    label: "Scope public",
    value: "serviceWorkerScope = \"/\"",
    detail: "Le scope doit couvrir la surface publique de demo.",
  },
  {
    label: "Register silencieux",
    value: ".register(serviceWorkerUrl, { scope: serviceWorkerScope })",
    detail: "Le service worker doit rester enregistre avec le scope public attendu.",
  },
  {
    label: "Update silencieux",
    value: "registration.update()",
    detail: "Le service worker doit pouvoir recuperer une version precache plus recente.",
  },
  {
    label: "Annulation propre",
    value: "cancelled",
    detail: "L'effet doit eviter de poursuivre apres demontage du composant.",
  },
];

const forbiddenRegistrationSignals = [
  "console.",
  "alert(",
  "confirm(",
  "prompt(",
  "fetch(",
  "localStorage",
  "sessionStorage",
  "mailto:",
  "AliExpress",
  "Temu",
  "supplier",
  "fournisseur",
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

function auditServiceWorkerRegistration(source, layoutSource, findings) {
  if (!source) {
    addFinding(
      findings,
      serviceWorkerRegistrationPath,
      1,
      "service_worker_registration_missing",
      "Le composant ServiceWorkerRegister est introuvable.",
    );
    return { signals: [] };
  }

  const signals = [];

  for (const signal of requiredRegistrationSignals) {
    const index = source.indexOf(signal.value);
    if (index === -1) {
      addFinding(
        findings,
        serviceWorkerRegistrationPath,
        1,
        "service_worker_registration_signal_missing",
        signal.detail,
      );
      continue;
    }

    signals.push({
      label: signal.label,
      line: lineOf(source, index),
    });
  }

  for (const forbiddenSignal of forbiddenRegistrationSignals) {
    const index = source.toLowerCase().indexOf(forbiddenSignal.toLowerCase());
    if (index !== -1) {
      addFinding(
        findings,
        serviceWorkerRegistrationPath,
        lineOf(source, index),
        "service_worker_registration_forbidden_signal",
        `${forbiddenSignal} ne doit pas apparaitre dans l'enregistrement PWA client.`,
      );
    }
  }

  if (!layoutSource) {
    addFinding(findings, layoutPath, 1, "layout_missing", "Le layout racine est introuvable.");
    return { signals };
  }

  if (!layoutSource.includes("ServiceWorkerRegister")) {
    addFinding(
      findings,
      layoutPath,
      1,
      "service_worker_registration_not_mounted",
      "ServiceWorkerRegister doit rester monte dans le layout racine.",
    );
  }

  return { signals };
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
  const registrationRows = summary.registrationSignals.map((signal) => `| ${signal.label} | ${signal.line} |`);
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
    `- Signaux enregistrement PWA: ${summary.registrationSignalCount}`,
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
    "## Enregistrement PWA",
    "",
    "| Signal | Ligne |",
    "|---|---:|",
    ...registrationRows,
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
const serviceWorkerRegistrationSource = readFile(serviceWorkerRegistrationPath);
const layoutSource = readFile(layoutPath);
const offlineAudit = auditOfflinePage(offlineSource, findings);
const serviceWorkerAudit = auditServiceWorker(serviceWorkerSource, findings);
const serviceWorkerRegistrationAudit = auditServiceWorkerRegistration(
  serviceWorkerRegistrationSource,
  layoutSource,
  findings,
);

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
  serviceWorkerRegistrationPath: relativePath(serviceWorkerRegistrationPath),
  layoutPath: relativePath(layoutPath),
  requiredOfflineSignals,
  requiredDemoRoutes,
  requiredRegistrationSignals,
  forbiddenOfflineShortcutUrls,
  offlineHrefs: offlineAudit.hrefs,
  offlineHrefCount: offlineAudit.hrefs.length,
  appShellUrls: serviceWorkerAudit.appShellUrls,
  demoRoutes: serviceWorkerAudit.demoRoutes,
  demoRouteCount: serviceWorkerAudit.demoRoutes.length,
  precacheUrls: serviceWorkerAudit.precacheUrls,
  precacheUrlCount: serviceWorkerAudit.precacheUrls.length,
  registrationSignals: serviceWorkerRegistrationAudit.signals,
  registrationSignalCount: serviceWorkerRegistrationAudit.signals.length,
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
      registrationSignalCount: summary.registrationSignalCount,
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

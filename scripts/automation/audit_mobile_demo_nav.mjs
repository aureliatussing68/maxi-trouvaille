import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const navPath = path.join(root, "src", "components", "MobileDemoNav.tsx");
const layoutPath = path.join(root, "src", "app", "layout.tsx");
const manifestPath = path.join(root, "src", "app", "manifest.ts");
const serviceWorkerPath = path.join(root, "public", "sw.js");

const requiredLinks = [
  { href: "/boutique", label: "Boutique" },
  { href: "/produits-partenaires", label: "Partenaires" },
  { href: "/nouveautes", label: "Nouveau" },
  { href: "/promotions", label: "Promos" },
  { href: "/suivi-colis", label: "Suivi" },
];

const forbiddenCopy = [
  "AliExpress",
  "Temu",
  "supplier",
  "seller",
  "marketplace",
  "fournisseur",
  "dropshipping",
  "HOLD",
  "Stripe",
];

const forbiddenHrefs = [
  "/admin",
  "/api",
  "/panier",
  "/paiement",
  "/dropshipping",
  "/conditions-dropshipping",
  "/vendre",
  "/deposer-annonce",
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
  if (!fs.existsSync(filePath)) {
    return "";
  }

  return fs.readFileSync(filePath, "utf8");
}

function lineOf(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function addFinding(findings, filePath, source, index, rule, detail) {
  findings.push({
    file: relativePath(filePath),
    line: index >= 0 ? lineOf(source, index) : 1,
    rule,
    detail,
  });
}

function parseObjectValues(source, objectBody) {
  const values = {};

  for (const property of ["href", "label"]) {
    const match = objectBody.match(new RegExp(`${property}\\s*:\\s*["']([^"']+)["']`));
    values[property] = match?.[1] ?? "";
  }

  return values;
}

function parseMobileLinks(source) {
  const blockMatch = source.match(/const\s+mobileLinks\s*=\s*\[([\s\S]*?)\]\s+satisfies/);

  if (!blockMatch) {
    return [];
  }

  const blockStart = blockMatch.index ?? 0;
  return [...blockMatch[1].matchAll(/\{([\s\S]*?)\}/g)].map((match) => ({
    ...parseObjectValues(source, match[1]),
    line: lineOf(source, blockStart + (match.index ?? 0)),
  }));
}

function parseManifestShortcutUrls(source) {
  return [...source.matchAll(/url:\s*["']([^"']+)["']/g)].map((match) => match[1]);
}

function parseArrayStringValues(source, arrayName) {
  const arrayMatch = source.match(new RegExp(`const ${arrayName} = \\[([\\s\\S]*?)\\];`));
  const arraySource = arrayMatch?.[1] ?? "";
  const offset = arrayMatch?.index ?? 0;

  return [...arraySource.matchAll(/["']([^"']+)["']/g)].map((match) => ({
    value: match[1],
    line: lineOf(source, offset + (match.index ?? 0)),
  }));
}

function auditNav(source, findings) {
  if (!source.trim()) {
    addFinding(findings, navPath, source, -1, "mobile_nav_file_missing", "MobileDemoNav.tsx est introuvable.");
    return [];
  }

  if (!source.startsWith('"use client";')) {
    addFinding(findings, navPath, source, 0, "mobile_nav_not_client", "La barre mobile doit rester un composant client pour lire la route active.");
  }

  if (!source.includes("usePathname")) {
    addFinding(findings, navPath, source, -1, "mobile_nav_active_route_missing", "La barre mobile doit utiliser usePathname pour signaler l'onglet actif.");
  }

  if (!source.includes('aria-label="Navigation rapide mobile"')) {
    addFinding(findings, navPath, source, -1, "mobile_nav_aria_label_missing", "La navigation rapide mobile doit garder son libelle accessible.");
  }

  if (!source.includes("aria-current")) {
    addFinding(findings, navPath, source, -1, "mobile_nav_aria_current_missing", "Le lien actif doit exposer aria-current.");
  }

  const links = parseMobileLinks(source);
  const byHref = new Map(links.map((link) => [link.href, link]));

  if (links.length !== requiredLinks.length) {
    addFinding(
      findings,
      navPath,
      source,
      -1,
      "mobile_nav_link_count_mismatch",
      `La barre mobile doit garder ${requiredLinks.length} liens publics.`,
    );
  }

  for (const requiredLink of requiredLinks) {
    const actual = byHref.get(requiredLink.href);

    if (!actual) {
      addFinding(
        findings,
        navPath,
        source,
        -1,
        "mobile_nav_required_link_missing",
        `${requiredLink.href} doit rester dans la barre mobile.`,
      );
      continue;
    }

    if (actual.label !== requiredLink.label) {
      addFinding(
        findings,
        navPath,
        source,
        -1,
        "mobile_nav_required_label_mismatch",
        `${requiredLink.href} doit garder le libelle ${requiredLink.label}.`,
      );
    }
  }

  for (const link of links) {
    for (const forbiddenHref of forbiddenHrefs) {
      if (link.href === forbiddenHref || link.href.startsWith(`${forbiddenHref}/`)) {
        addFinding(
          findings,
          navPath,
          source,
          -1,
          "mobile_nav_forbidden_href",
          `${link.href} ne doit pas apparaitre dans la barre mobile publique.`,
        );
      }
    }
  }

  const lowerSource = source.toLowerCase();
  for (const word of forbiddenCopy) {
    const index = lowerSource.indexOf(word.toLowerCase());
    if (index !== -1) {
      addFinding(
        findings,
        navPath,
        source,
        index,
        "mobile_nav_sensitive_public_copy",
        `${word} ne doit pas apparaitre dans la barre mobile publique.`,
      );
    }
  }

  return links;
}

function auditLayout(source, findings) {
  if (!source.trim()) {
    addFinding(findings, layoutPath, source, -1, "layout_file_missing", "src/app/layout.tsx est introuvable.");
    return;
  }

  if (!source.includes("MobileDemoNav")) {
    addFinding(findings, layoutPath, source, -1, "mobile_nav_not_mounted", "MobileDemoNav doit rester monte dans le layout racine.");
  }

  if (!source.includes("pb-20")) {
    addFinding(findings, layoutPath, source, -1, "mobile_nav_body_padding_missing", "Le body doit garder un padding bas pour eviter que la barre mobile masque le contenu.");
  }
}

function auditManifestAlignment(source, links, findings) {
  if (!source.trim()) {
    addFinding(findings, manifestPath, source, -1, "manifest_file_missing", "src/app/manifest.ts est introuvable.");
    return;
  }

  const manifestShortcutUrls = parseManifestShortcutUrls(source);
  for (const requiredLink of requiredLinks) {
    if (!manifestShortcutUrls.includes(requiredLink.href)) {
      addFinding(
        findings,
        manifestPath,
        source,
        -1,
        "mobile_nav_manifest_shortcut_missing",
        `${requiredLink.href} doit rester aligne entre barre mobile et manifest PWA.`,
      );
    }
  }

  const navHrefSet = new Set(links.map((link) => link.href));
  const missingInNav = requiredLinks
    .map((link) => link.href)
    .filter((href) => manifestShortcutUrls.includes(href) && !navHrefSet.has(href));

  for (const href of missingInNav) {
    addFinding(
      findings,
      navPath,
      "",
      -1,
      "mobile_nav_manifest_alignment_missing",
      `${href} est attendu dans la barre mobile car il est expose dans le manifest PWA.`,
    );
  }
}

function auditServiceWorkerAlignment(source, links, findings) {
  if (!source.trim()) {
    addFinding(
      findings,
      serviceWorkerPath,
      source,
      -1,
      "service_worker_file_missing",
      "public/sw.js est introuvable.",
    );
    return [];
  }

  const demoRoutes = parseArrayStringValues(source, "DEMO_ROUTES");
  const demoRouteValues = demoRoutes.map((route) => route.value);
  const navHrefSet = new Set(links.map((link) => link.href));

  for (const requiredLink of requiredLinks) {
    if (!demoRouteValues.includes(requiredLink.href)) {
      addFinding(
        findings,
        serviceWorkerPath,
        source,
        -1,
        "mobile_nav_service_worker_route_missing",
        `${requiredLink.href} doit rester precache dans DEMO_ROUTES pour la demo mobile.`,
      );
    }
  }

  for (const route of demoRoutes) {
    for (const forbiddenHref of forbiddenHrefs) {
      if (route.value === forbiddenHref || route.value.startsWith(`${forbiddenHref}/`)) {
        addFinding(
          findings,
          serviceWorkerPath,
          source,
          -1,
          "mobile_nav_service_worker_forbidden_route",
          `${route.value} ne doit pas etre precache dans DEMO_ROUTES.`,
        );
      }
    }

    if (!navHrefSet.has(route.value) && route.value !== "/contact") {
      addFinding(
        findings,
        serviceWorkerPath,
        source,
        -1,
        "mobile_nav_service_worker_untracked_route",
        `${route.value} doit etre dans la barre mobile ou etre une exception support explicite.`,
      );
    }
  }

  if (!source.includes("cache.addAll(PRECACHE_URLS)")) {
    addFinding(
      findings,
      serviceWorkerPath,
      source,
      -1,
      "mobile_nav_service_worker_precache_missing",
      "Le service worker doit utiliser PRECACHE_URLS pour precacher app shell et routes demo.",
    );
  }

  return demoRoutes;
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
  const linkRows = summary.links.map(
    (link) => `| ${link.label} | ${link.href} | ligne ${link.line} |`,
  );
  const serviceWorkerRows = summary.serviceWorkerDemoRoutes.map(
    (route) => `| ${route.value} | ligne ${route.line} |`,
  );
  const findingRows =
    summary.findings.length === 0
      ? ["| OK | - | - | Aucun ecart detecte |"]
      : summary.findings.map(
          (finding) => `| ${finding.rule} | ${finding.file} | ${finding.line} | ${finding.detail} |`,
        );

  return `${[
    "# Audit navigation mobile demo",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    `- Liens requis: ${summary.requiredLinkCount}`,
    `- Liens detectes: ${summary.linkCount}`,
    `- Routes service worker demo: ${summary.serviceWorkerDemoRouteCount}`,
    `- Alertes: ${summary.findingCount}`,
    "",
    "## Liens mobile",
    "",
    "| Libelle | URL | Source |",
    "|---|---|---|",
    ...linkRows,
    "",
    "## Routes service worker demo",
    "",
    "| URL | Source |",
    "|---|---|",
    ...serviceWorkerRows,
    "",
    "## Alertes",
    "",
    "| Regle | Fichier | Ligne | Detail |",
    "|---|---|---:|---|",
    ...findingRows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule sur le catalogue.",
    "- Aucun lien mobile vers panier, paiement, admin, API ou anciennes routes sensibles.",
    "- Alignement avec les raccourcis PWA publics et le service worker demo.",
    "- Aucun paiement, achat, commande fournisseur, publication, message reel ou appel externe.",
    "",
  ].join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const findings = [];
const navSource = readFile(navPath);
const layoutSource = readFile(layoutPath);
const manifestSource = readFile(manifestPath);
const serviceWorkerSource = readFile(serviceWorkerPath);
const links = auditNav(navSource, findings);

auditLayout(layoutSource, findings);
auditManifestAlignment(manifestSource, links, findings);
const serviceWorkerDemoRoutes = auditServiceWorkerAlignment(serviceWorkerSource, links, findings);

const outputDir = path.join(root, "business-maxi-trouvailles", "tableaux-action", `audit-mobile-demo-nav-${dateKey}`);
const summary = {
  ok: findings.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_mobile_demo_nav_audit",
  requiredLinks,
  requiredLinkCount: requiredLinks.length,
  links,
  linkCount: links.length,
  serviceWorkerDemoRoutes,
  serviceWorkerDemoRouteCount: serviceWorkerDemoRoutes.length,
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

const jsonPath = path.join(outputDir, `AUDIT_MOBILE_DEMO_NAV_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_MOBILE_DEMO_NAV_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-audit-mobile-demo-nav-${dateKey}.csv`);

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
      requiredLinkCount: summary.requiredLinkCount,
      linkCount: summary.linkCount,
      serviceWorkerDemoRouteCount: summary.serviceWorkerDemoRouteCount,
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

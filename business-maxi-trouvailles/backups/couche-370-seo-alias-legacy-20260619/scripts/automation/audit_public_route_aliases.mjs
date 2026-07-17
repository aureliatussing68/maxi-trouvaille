import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const expectedAliases = [
  { source: "/aide", destination: "/faq" },
  { source: "/catalogue", destination: "/boutique" },
  { source: "/cgv", destination: "/conditions-generales-vente" },
  { source: "/conditions-dropshipping", destination: "/conditions-produits-partenaires" },
  { source: "/confidentialite", destination: "/politique-confidentialite" },
  { source: "/deposer-annonce", destination: "/produits-partenaires" },
  { source: "/dropshipping", destination: "/produits-partenaires" },
  { source: "/livraison-colis", destination: "/livraison" },
  { source: "/mentions", destination: "/mentions-legales" },
  { source: "/partenaires", destination: "/produits-partenaires" },
  { source: "/produits", destination: "/boutique" },
  { source: "/retours", destination: "/retours-remboursements" },
  { source: "/shop", destination: "/boutique" },
  { source: "/suivi", destination: "/suivi-colis" },
  { source: "/vendre", destination: "/produits-partenaires" },
];

const sitemapRequiredRoutes = [
  "",
  "/boutique",
  "/produits-partenaires",
  "/nouveautes",
  "/promotions",
  "/categories",
  "/livraison",
  "/suivi-colis",
  "/faq",
  "/contact",
  "/conditions-produits-partenaires",
];

const robotsRequiredDisallow = [
  "/admin/",
  "/api/",
  "/panier",
  "/paiement",
  "/dropshipping",
  "/conditions-dropshipping",
];

const files = {
  nextConfig: "next.config.ts",
  sitemap: "src/app/sitemap.ts",
  robots: "src/app/robots.ts",
};

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

function readRequiredFile(relativeFilePath) {
  const absolutePath = path.join(root, relativeFilePath);

  if (!fs.existsSync(absolutePath)) {
    return {
      ok: false,
      absolutePath,
      source: "",
      missing: true,
    };
  }

  return {
    ok: true,
    absolutePath,
    source: fs.readFileSync(absolutePath, "utf8"),
    missing: false,
  };
}

function lineOf(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function addFinding(findings, file, line, rule, detail) {
  findings.push({
    file,
    line,
    rule,
    detail,
  });
}

function parsePublicRouteAliases(source, findings) {
  const blockMatch = source.match(/const\s+publicRouteAliases\s*=\s*\[([\s\S]*?)\];/);

  if (!blockMatch) {
    addFinding(
      findings,
      files.nextConfig,
      1,
      "public_route_alias_block_missing",
      "Le bloc publicRouteAliases est introuvable dans next.config.ts.",
    );
    return [];
  }

  const blockStart = blockMatch.index ?? 0;
  const block = blockMatch[1];

  return [...block.matchAll(/\{([\s\S]*?)\}/g)]
    .map((match) => {
      const body = match[1];
      const sourceMatch = body.match(/source:\s*["']([^"']+)["']/);
      const destinationMatch = body.match(/destination:\s*["']([^"']+)["']/);

      return {
        source: sourceMatch?.[1] ?? "",
        destination: destinationMatch?.[1] ?? "",
        permanent: /permanent:\s*true/.test(body),
        line: lineOf(source, blockStart + (match.index ?? 0)),
      };
    })
    .filter((alias) => alias.source || alias.destination);
}

function parseStaticSitemapPaths(source) {
  return [...source.matchAll(/path:\s*["']([^"']*)["']/g)].map((match) => ({
    path: match[1],
    line: lineOf(source, match.index ?? 0),
  }));
}

function parseStringValues(source) {
  return [...source.matchAll(/["']([^"']+)["']/g)].map((match) => ({
    value: match[1],
    line: lineOf(source, match.index ?? 0),
  }));
}

function auditRequiredFiles(fileSources, findings) {
  for (const [id, relativeFilePath] of Object.entries(files)) {
    const fileSource = fileSources[id];
    if (!fileSource.ok) {
      addFinding(
        findings,
        relativeFilePath,
        1,
        "required_file_missing",
        "Fichier requis introuvable pour l'audit alias publics.",
      );
    }
  }
}

function auditNextConfig(fileSources, findings) {
  if (!fileSources.nextConfig.ok) {
    return [];
  }

  const source = fileSources.nextConfig.source;
  const aliases = parsePublicRouteAliases(source, findings);
  const bySource = new Map(aliases.map((alias) => [alias.source, alias]));
  const duplicateSources = aliases
    .map((alias) => alias.source)
    .filter((aliasSource, index, allSources) => aliasSource && allSources.indexOf(aliasSource) !== index);

  for (const expectedAlias of expectedAliases) {
    const actualAlias = bySource.get(expectedAlias.source);

    if (!actualAlias) {
      addFinding(
        findings,
        files.nextConfig,
        1,
        "public_alias_missing",
        `${expectedAlias.source} doit rediriger vers ${expectedAlias.destination}.`,
      );
      continue;
    }

    if (actualAlias.destination !== expectedAlias.destination) {
      addFinding(
        findings,
        files.nextConfig,
        actualAlias.line,
        "public_alias_destination_mismatch",
        `${actualAlias.source} redirige vers ${actualAlias.destination}, attendu ${expectedAlias.destination}.`,
      );
    }

    if (!actualAlias.permanent) {
      addFinding(
        findings,
        files.nextConfig,
        actualAlias.line,
        "public_alias_not_permanent",
        `${actualAlias.source} doit rester permanent pour produire un 308 cacheable.`,
      );
    }
  }

  for (const duplicateSource of [...new Set(duplicateSources)]) {
    addFinding(
      findings,
      files.nextConfig,
      1,
      "public_alias_duplicate",
      `${duplicateSource} apparait plusieurs fois dans publicRouteAliases.`,
    );
  }

  const spreadIndex = source.indexOf("...publicRouteAliases");
  const hostRedirectIndex = source.indexOf('source: "/:path*"');

  if (spreadIndex === -1) {
    addFinding(
      findings,
      files.nextConfig,
      1,
      "public_aliases_not_used",
      "redirects() doit inclure ...publicRouteAliases.",
    );
  } else if (hostRedirectIndex !== -1 && spreadIndex > hostRedirectIndex) {
    addFinding(
      findings,
      files.nextConfig,
      lineOf(source, spreadIndex),
      "public_aliases_after_host_redirect",
      "Les alias publics doivent rester avant le redirect host canonique.",
    );
  }

  return aliases;
}

function auditSitemap(fileSources, findings) {
  if (!fileSources.sitemap.ok) {
    return {
      staticRoutes: [],
      indexedAliasRoutes: [],
    };
  }

  const staticRoutes = parseStaticSitemapPaths(fileSources.sitemap.source);
  const staticRouteSet = new Set(staticRoutes.map((route) => route.path));

  for (const route of sitemapRequiredRoutes) {
    if (!staticRouteSet.has(route)) {
      addFinding(
        findings,
        files.sitemap,
        1,
        "sitemap_public_route_missing",
        `Le sitemap doit contenir la route publique ${route || "/"}.`,
      );
    }
  }

  const indexedAliasRoutes = [];
  const aliasRouteSet = new Set(expectedAliases.map((alias) => alias.source));

  for (const route of staticRoutes) {
    if (aliasRouteSet.has(route.path)) {
      indexedAliasRoutes.push(route.path);
      addFinding(
        findings,
        files.sitemap,
        route.line,
        "sitemap_indexes_public_alias",
        `${route.path} est un alias et ne doit pas etre indexe directement.`,
      );
    }
  }

  return {
    staticRoutes,
    indexedAliasRoutes,
  };
}

function auditRobots(fileSources, findings) {
  if (!fileSources.robots.ok) {
    return [];
  }

  const values = parseStringValues(fileSources.robots.source);
  const valueSet = new Set(values.map((entry) => entry.value));

  for (const route of robotsRequiredDisallow) {
    if (!valueSet.has(route)) {
      addFinding(
        findings,
        files.robots,
        1,
        "robots_disallow_missing",
        `${route} doit rester bloque dans robots.ts.`,
      );
    }
  }

  return values.filter((entry) => robotsRequiredDisallow.includes(entry.value));
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
  const aliasRows = summary.aliases.map(
    (alias) =>
      `| ${alias.source} | ${alias.destination} | ${alias.permanent ? "oui" : "non"} | ${alias.line} |`,
  );
  const findingRows =
    summary.findings.length === 0
      ? ["| OK | - | - | Aucun ecart detecte |"]
      : summary.findings.map(
          (finding) => `| ${finding.rule} | ${finding.file} | ${finding.line} | ${finding.detail} |`,
        );

  return `${[
    "# Audit alias publics",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    `- Alias attendus: ${summary.expectedAliasCount}`,
    `- Alias detectes: ${summary.aliasCount}`,
    `- Routes sitemap surveillees: ${summary.sitemapRequiredRouteCount}`,
    `- Alertes: ${summary.findingCount}`,
    "",
    "## Alias redirects",
    "",
    "| Source | Destination | Permanent | Ligne |",
    "|---|---|---|---:|",
    ...aliasRows,
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
    "- Aucun changement produit, prix, stock, image ou commande.",
    "- Aucun paiement, achat, commande fournisseur, message reel ou deploiement.",
    "- Les anciennes routes sensibles doivent rester des alias ou etre bloquees cote SEO.",
    "",
  ].join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(root, "business-maxi-trouvailles", "tableaux-action", `audit-alias-publics-${dateKey}`);
const fileSources = Object.fromEntries(Object.entries(files).map(([id, file]) => [id, readRequiredFile(file)]));
const findings = [];

auditRequiredFiles(fileSources, findings);
const aliases = auditNextConfig(fileSources, findings);
const sitemapAudit = auditSitemap(fileSources, findings);
const robotsAudit = auditRobots(fileSources, findings);

const summary = {
  ok: findings.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_public_route_alias_audit",
  expectedAliasCount: expectedAliases.length,
  aliasCount: aliases.length,
  aliases,
  sitemapRequiredRouteCount: sitemapRequiredRoutes.length,
  sitemapStaticRouteCount: sitemapAudit.staticRoutes.length,
  sitemapIndexedAliasRoutes: sitemapAudit.indexedAliasRoutes,
  robotsRequiredDisallowCount: robotsRequiredDisallow.length,
  robotsMatchedDisallowCount: robotsAudit.length,
  findingCount: findings.length,
  findings,
  sources: Object.fromEntries(
    Object.entries(fileSources).map(([id, source]) => [
      id,
      {
        path: relativePath(source.absolutePath),
        exists: source.ok,
      },
    ]),
  ),
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

const jsonPath = path.join(outputDir, `AUDIT_ALIAS_PUBLICS_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_ALIAS_PUBLICS_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-audit-alias-publics-${dateKey}.csv`);

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
      expectedAliasCount: summary.expectedAliasCount,
      aliasCount: summary.aliasCount,
      sitemapStaticRouteCount: summary.sitemapStaticRouteCount,
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

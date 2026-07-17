import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const outputDir = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  `audit-alias-seo-${dateKey}`,
);

const legacyAliases = [
  {
    id: "legacy_partner_products_alias",
    legacyPath: "/dropshipping",
    file: "src/app/dropshipping/page.tsx",
    target: "/produits-partenaires",
  },
  {
    id: "legacy_partner_terms_alias",
    legacyPath: "/conditions-dropshipping",
    file: "src/app/conditions-dropshipping/page.tsx",
    target: "/conditions-produits-partenaires",
  },
];

const requiredRobotsDisallow = [
  "/admin/",
  "/api/",
  "/avis/laisser",
  "/offline",
  "/panier",
  "/paiement",
  "/paiement/annule",
  "/paiement/succes",
];

const requiredSitemapRoutes = [
  "/boutique",
  "/produits-partenaires",
  "/nouveautes",
  "/promotions",
  "/conditions-produits-partenaires",
];

const forbiddenRobotsCopy = [
  { id: "legacy_path_visible", pattern: /\/dropshipping|\/conditions-dropshipping/i },
  { id: "marketplace_a_visible", pattern: /AliExpress/i },
  { id: "marketplace_t_visible", pattern: /Temu/i },
  { id: "supplier_en_visible", pattern: /\bsupplier\b/i },
  { id: "supplier_fr_visible", pattern: /fournisseur/i },
];

function readFile(relativePath) {
  const absolutePath = path.join(root, relativePath);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function addFinding(findings, file, route, rule, detail = "") {
  findings.push({
    file,
    route,
    rule,
    detail,
  });
}

function auditLegacyAliases() {
  const findings = [];

  for (const alias of legacyAliases) {
    const source = readFile(alias.file);

    if (!source) {
      addFinding(findings, alias.file, alias.legacyPath, "legacy_alias_file_missing");
      continue;
    }

    if (!source.includes("permanentRedirect")) {
      addFinding(findings, alias.file, alias.legacyPath, "legacy_alias_not_permanent");
    }

    if (!source.includes(alias.target)) {
      addFinding(
        findings,
        alias.file,
        alias.legacyPath,
        "legacy_alias_wrong_target",
        `Expected target ${alias.target}`,
      );
    }

    if (/\bredirect\s*\(/.test(source)) {
      addFinding(findings, alias.file, alias.legacyPath, "legacy_alias_uses_temporary_redirect");
    }
  }

  return findings;
}

function auditRobots() {
  const file = "src/app/robots.ts";
  const source = readFile(file);
  const findings = [];

  if (!source) {
    addFinding(findings, file, "/robots.txt", "robots_file_missing");
    return findings;
  }

  for (const route of requiredRobotsDisallow) {
    if (!source.includes(`"${route}"`)) {
      addFinding(findings, file, "/robots.txt", "robots_required_disallow_missing", route);
    }
  }

  for (const alias of legacyAliases) {
    if (source.includes(`"${alias.legacyPath}"`)) {
      addFinding(findings, file, "/robots.txt", "robots_exposes_legacy_alias", alias.legacyPath);
    }
  }

  for (const rule of forbiddenRobotsCopy) {
    const match = source.match(rule.pattern);
    if (match) {
      addFinding(findings, file, "/robots.txt", rule.id, match[0]);
    }
  }

  return findings;
}

function auditSitemap() {
  const file = "src/app/sitemap.ts";
  const source = readFile(file);
  const findings = [];

  if (!source) {
    addFinding(findings, file, "/sitemap.xml", "sitemap_file_missing");
    return findings;
  }

  for (const route of requiredSitemapRoutes) {
    if (!source.includes(`path: "${route}"`)) {
      addFinding(findings, file, "/sitemap.xml", "sitemap_public_route_missing", route);
    }
  }

  for (const alias of legacyAliases) {
    if (source.includes(`path: "${alias.legacyPath}"`)) {
      addFinding(findings, file, "/sitemap.xml", "sitemap_exposes_legacy_alias", alias.legacyPath);
    }
  }

  return findings;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(findings) {
  const headers = ["file", "route", "rule", "detail"];
  const rows = findings.map((finding) =>
    headers.map((header) => csvEscape(finding[header])).join(","),
  );

  return `${headers.join(",")}\n${rows.join("\n")}${rows.length ? "\n" : ""}`;
}

function toMarkdown(summary) {
  const aliasRows = summary.legacyAliases.map(
    (alias) => `| ${alias.legacyPath} | ${alias.target} | permanentRedirect |`,
  );
  const findingRows = summary.findings.length
    ? summary.findings.map(
        (finding) =>
          `| ${finding.rule} | ${finding.route} | ${finding.file} | \`${String(finding.detail).replaceAll("|", "\\|")}\` |`,
      )
    : ["| OK | - | - | - |"];

  return `${[
    "# Audit SEO alias legacy",
    "",
    `Date: ${summary.checkedAt}`,
    `Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "## Alias surveilles",
    "",
    "| Ancien chemin | Cible | Attendu |",
    "|---|---|---|",
    ...aliasRows,
    "",
    "## Routes robots disallow requises",
    "",
    ...summary.requiredRobotsDisallow.map((route) => `- ${route}`),
    "",
    "## Routes sitemap publiques requises",
    "",
    ...summary.requiredSitemapRoutes.map((route) => `- ${route}`),
    "",
    "## Alertes",
    "",
    "| Regle | Route | Fichier | Detail |",
    "|---|---|---|---|",
    ...findingRows,
    "",
    "## Garde-fous",
    "",
    "- Audit lecture seule: aucune publication, aucun catalogue modifie.",
    "- Les anciens alias ne sont pas annonces dans robots.",
    "- Les routes vitrine utiles restent dans le sitemap.",
    "",
  ].join("\n")}\n`;
}

const findings = [...auditLegacyAliases(), ...auditRobots(), ...auditSitemap()];
const summary = {
  checkedAt: new Date().toISOString(),
  ok: findings.length === 0,
  mode: "read_only_legacy_alias_seo_audit",
  legacyAliases,
  requiredRobotsDisallow,
  requiredSitemapRoutes,
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

const jsonPath = path.join(outputDir, `AUDIT_ALIAS_SEO_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_ALIAS_SEO_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-audit-alias-seo-${dateKey}.csv`);

summary.files = {
  json: path.relative(root, jsonPath).replace(/\\/g, "/"),
  md: path.relative(root, mdPath).replace(/\\/g, "/"),
  csv: path.relative(root, csvPath).replace(/\\/g, "/"),
};

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, toMarkdown(summary), "utf8");
fs.writeFileSync(csvPath, toCsv(findings), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      legacyAliasCount: summary.legacyAliases.length,
      robotsDisallowCount: summary.requiredRobotsDisallow.length,
      sitemapPublicRouteCount: summary.requiredSitemapRoutes.length,
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

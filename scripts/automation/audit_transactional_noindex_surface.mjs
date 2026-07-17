import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const outputDir = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  `audit-noindex-transactionnel-${dateKey}`,
);

const routeFiles = [
  {
    route: "/panier",
    path: "src/app/panier/page.tsx",
    requireFollowFalse: false,
    requiredSignals: ["robots", "index: false", "CustomerSupportQuickLinks"],
  },
  {
    route: "/paiement",
    path: "src/app/paiement/page.tsx",
    requireFollowFalse: false,
    requiredSignals: ["robots", "index: false", "CustomerSupportQuickLinks"],
  },
  {
    route: "/paiement/annule",
    path: "src/app/paiement/annule/page.tsx",
    requireFollowFalse: true,
    requiredSignals: ["robots", "index: false", "follow: false", "CustomerSupportQuickLinks"],
  },
  {
    route: "/paiement/succes",
    path: "src/app/paiement/succes/page.tsx",
    requireFollowFalse: true,
    requiredSignals: ["robots", "index: false", "follow: false", "CustomerSupportQuickLinks"],
  },
  {
    route: "/avis/laisser",
    path: "src/app/avis/laisser/page.tsx",
    requireFollowFalse: true,
    requiredSignals: ["robots", "index: false", "follow: false"],
  },
  {
    route: "/offline",
    path: "src/app/offline/page.tsx",
    requireFollowFalse: true,
    requiredSignals: ["robots", "index: false", "follow: false", "CustomerSupportQuickLinks"],
  },
];

const expectedPublicRoutes = [
  {
    route: "/produits-partenaires",
    path: "src/app/produits-partenaires/page.tsx",
  },
  {
    route: "/nouveautes",
    path: "src/app/nouveautes/page.tsx",
  },
  {
    route: "/promotions",
    path: "src/app/promotions/page.tsx",
  },
  {
    route: "/boutique",
    path: "src/app/boutique/page.tsx",
  },
];

const forbiddenPublicCopy = [
  { id: "external_marketplace_name_a", pattern: /AliExpress/i },
  { id: "external_marketplace_name_t", pattern: /Temu/i },
  { id: "internal_supplier_en", pattern: /\b(supplier|seller)\b/i },
  { id: "internal_supplier_fr", pattern: /fournisseur/i },
  { id: "hold_jargon_visible", pattern: /\bHOLD\b/i },
  { id: "dropshipping_copy_visible", pattern: /\bdropshipping\b/i },
  { id: "technical_api_word_visible", pattern: /\bAPI\b/i },
];

function readFile(relativePath) {
  const absolutePath = path.join(root, relativePath);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function lineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function addFinding(findings, file, route, line, rule, text = "") {
  findings.push({
    file,
    route,
    line,
    rule,
    text,
  });
}

function scanForbidden(relativePath, route, source) {
  const findings = [];

  for (const rule of forbiddenPublicCopy) {
    const flags = rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`;

    for (const match of source.matchAll(new RegExp(rule.pattern.source, flags))) {
      const line = source.slice(0, match.index ?? 0).split(/\r?\n/).at(-1) ?? "";

      if (/^\s*(const|let|var|import|export|type|function|return|if|for)\b/.test(line)) {
        continue;
      }

      if (/^\s*\([^)]*\)\s*=>/.test(line)) {
        continue;
      }

      addFinding(
        findings,
        relativePath,
        route,
        lineNumber(source, match.index ?? 0),
        rule.id,
        line.trim(),
      );
    }
  }

  return findings;
}

function auditTransactionalRoutes() {
  return routeFiles.flatMap((routeFile) => {
    const source = readFile(routeFile.path);
    const findings = [];

    if (!source) {
      addFinding(findings, routeFile.path, routeFile.route, 1, "transactional_route_missing");
      return findings;
    }

    if (!/metadata\s*:\s*Metadata/.test(source)) {
      addFinding(findings, routeFile.path, routeFile.route, 1, "metadata_export_not_typed");
    }

    for (const signal of routeFile.requiredSignals) {
      if (!source.includes(signal)) {
        addFinding(
          findings,
          routeFile.path,
          routeFile.route,
          1,
          `missing_signal_${signal.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
        );
      }
    }

    if (!/robots\s*:\s*\{[\s\S]*?index\s*:\s*false[\s\S]*?\}/m.test(source)) {
      addFinding(findings, routeFile.path, routeFile.route, 1, "robots_index_false_missing");
    }

    if (routeFile.requireFollowFalse && !/robots\s*:\s*\{[\s\S]*?follow\s*:\s*false[\s\S]*?\}/m.test(source)) {
      addFinding(findings, routeFile.path, routeFile.route, 1, "robots_follow_false_missing");
    }

    findings.push(...scanForbidden(routeFile.path, routeFile.route, source));

    return findings;
  });
}

function auditPublicRoutesStayIndexable() {
  return expectedPublicRoutes.flatMap((routeFile) => {
    const source = readFile(routeFile.path);
    const findings = [];

    if (!source) {
      addFinding(findings, routeFile.path, routeFile.route, 1, "public_route_missing");
      return findings;
    }

    if (/robots\s*:\s*\{[\s\S]*?index\s*:\s*false[\s\S]*?\}/m.test(source)) {
      addFinding(
        findings,
        routeFile.path,
        routeFile.route,
        1,
        "public_route_unexpected_noindex",
      );
    }

    findings.push(...scanForbidden(routeFile.path, routeFile.route, source));

    return findings;
  });
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(findings) {
  const headers = ["file", "route", "line", "rule", "text"];
  const rows = findings.map((finding) => headers.map((header) => csvEscape(finding[header])).join(","));

  return `${headers.join(",")}\n${rows.join("\n")}${rows.length ? "\n" : ""}`;
}

function toMarkdown(summary) {
  const transactionalRows = summary.transactionalRoutes.map(
    (route) => `| ${route.route} | ${route.path} | ${route.requireFollowFalse ? "noindex,nofollow" : "noindex"} |`,
  );
  const publicRows = summary.expectedPublicRoutes.map(
    (route) => `| ${route.route} | ${route.path} | indexable |`,
  );
  const findingRows = summary.findings.length
    ? summary.findings.map(
        (finding) =>
          `| ${finding.rule} | ${finding.route} | ${finding.file} | ${finding.line} | \`${String(finding.text).replaceAll("|", "\\|")}\` |`,
      )
    : ["| OK | - | - | - | - |"];

  return `${[
    "# Audit noindex transactionnel",
    "",
    `Date: ${summary.checkedAt}`,
    `Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "## Routes transactionnelles",
    "",
    "| Route | Fichier | Attendu |",
    "|---|---|---|",
    ...transactionalRows,
    "",
    "## Routes vitrine a garder indexables",
    "",
    "| Route | Fichier | Attendu |",
    "|---|---|---|",
    ...publicRows,
    "",
    "## Alertes",
    "",
    "| Regle | Route | Fichier | Ligne | Extrait |",
    "|---|---|---|---:|---|",
    ...findingRows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule: aucun catalogue modifie, aucun paiement, aucune commande, aucune publication.",
    "- Les pages panier, paiement, avis et hors ligne ne doivent pas etre indexees.",
    "- Les routes vitrine principales restent indexables.",
    "",
  ].join("\n")}\n`;
}

const findings = [...auditTransactionalRoutes(), ...auditPublicRoutesStayIndexable()];
const summary = {
  checkedAt: new Date().toISOString(),
  ok: findings.length === 0,
  mode: "read_only_transactional_noindex_audit",
  transactionalRoutes: routeFiles.map(({ route, path, requireFollowFalse }) => ({
    route,
    path,
    requireFollowFalse,
  })),
  expectedPublicRoutes,
  checkedRouteCount: routeFiles.length + expectedPublicRoutes.length,
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

const jsonPath = path.join(outputDir, `AUDIT_NOINDEX_TRANSACTIONNEL_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_NOINDEX_TRANSACTIONNEL_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-audit-noindex-transactionnel-${dateKey}.csv`);

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
      checkedRouteCount: summary.checkedRouteCount,
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

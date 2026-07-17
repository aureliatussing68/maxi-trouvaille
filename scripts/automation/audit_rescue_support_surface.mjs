import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const outputDir = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  `surface-pages-secours-${dateKey}`,
);

const supportComponentPath = "src/components/CustomerSupportQuickLinks.tsx";
const rescueRouteFiles = [
  {
    path: "src/app/not-found.tsx",
    requiredSignals: [
      "CustomerSupportQuickLinks",
      "/boutique",
      "/contact",
      "produits partenaires",
      "suivi colis",
      "service client",
    ],
  },
  {
    path: "src/app/offline/page.tsx",
    requiredSignals: [
      "CustomerSupportQuickLinks",
      "/boutique",
      "/produits-partenaires",
      "/suivi-colis",
      "Paiement Maxi Trouvaille",
      "service client",
    ],
  },
  {
    path: "src/app/paiement/annule/page.tsx",
    requiredSignals: [
      "CustomerJourneyPanel",
      "CustomerSupportQuickLinks",
      "/panier",
      "/contact",
      "paiement Maxi Trouvaille",
      "service client",
    ],
  },
  {
    path: "src/app/paiement/succes/page.tsx",
    requiredSignals: [
      "OrderSuccess",
      "CustomerJourneyPanel",
      "CustomerSupportQuickLinks",
    ],
  },
  {
    path: "src/app/error.tsx",
    requiredSignals: [
      "\"use client\"",
      "CustomerSupportQuickLinks",
      "/boutique",
      "/contact",
      "service client Maxi Trouvaille",
    ],
  },
];

const requiredSupportLinks = [
  "/suivi-colis",
  "/paiement",
  "/livraison",
  "/retours-remboursements",
  "/faq",
  "/contact",
];

const hardForbidden = [
  { id: "external_marketplace_name_a", pattern: /AliExpress/i },
  { id: "external_marketplace_name_t", pattern: /Temu/i },
  { id: "internal_supplier_en", pattern: /\b(supplier|seller)\b/i },
  { id: "internal_supplier_fr", pattern: /fournisseur/i },
  { id: "payment_provider_brand", pattern: /Stripe/i },
  { id: "real_message_link", pattern: /mailto:/i },
];

const copyForbidden = [
  { id: "hold_jargon_visible", pattern: /\bHOLD\b/i },
  { id: "dropshipping_copy_visible", pattern: /\bdropshipping\b/i },
  { id: "technical_api_word_visible", pattern: /\bAPI\b/i },
  { id: "doubtful_copy_visible", pattern: /fiche fragile|fiche douteuse/i },
  { id: "technical_console_copy_visible", pattern: /\bconsole\b/i },
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

function isObviousCodeOnlyLine(line) {
  const trimmed = line.trim();

  return (
    /^(import|export|const|let|var|function|type|return|async|try|catch|finally|if|useEffect)\b/.test(trimmed) ||
    /^\.(filter|map|slice|includes|then|catch)\b/.test(trimmed) ||
    /\b(console\.|routeFiles|requiredSignals|requiredSupportLinks|findings|source|pattern|process\.exitCode)\b/.test(trimmed) ||
    /^[}"'),;]+$/.test(trimmed)
  );
}

function isLikelyRenderedCopy(line) {
  const trimmed = line.trim();

  if (isObviousCodeOnlyLine(line)) {
    return false;
  }

  return (
    /\b(title|description|label|text|action|name|short_name)\s*:/.test(trimmed) ||
    trimmed.includes(">") ||
    /^(["'`])[^"'`]+(["'`]),?$/.test(trimmed)
  );
}

function addFinding(findings, file, line, rule, text = "") {
  findings.push({
    file,
    line,
    rule,
    text,
  });
}

function scanForbidden(relativePath, source) {
  const findings = [];
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNo = index + 1;

    if (!isObviousCodeOnlyLine(line)) {
      for (const rule of hardForbidden) {
        if (rule.pattern.test(line)) {
          addFinding(findings, relativePath, lineNo, rule.id, line.trim());
        }
      }
    }

    if (!isLikelyRenderedCopy(line)) {
      return;
    }

    for (const rule of copyForbidden) {
      if (rule.pattern.test(line)) {
        addFinding(findings, relativePath, lineNo, rule.id, line.trim());
      }
    }
  });

  return findings;
}

function missingSignalFindings(relativePath, source, signals) {
  return signals.flatMap((signal) =>
    source.toLowerCase().includes(String(signal).toLowerCase())
      ? []
      : [
          {
            file: relativePath,
            line: 1,
            rule: `missing_signal_${String(signal).replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
            text: "",
          },
        ],
  );
}

function auditSupportComponent() {
  const source = readFile(supportComponentPath);
  const findings = [];

  if (!source) {
    addFinding(findings, supportComponentPath, 1, "support_component_missing");
    return findings;
  }

  for (const href of requiredSupportLinks) {
    if (!source.includes(`href: "${href}"`)) {
      addFinding(
        findings,
        supportComponentPath,
        1,
        `missing_support_link_${href.replaceAll("/", "_")}`,
      );
    }
  }

  return [...findings, ...scanForbidden(supportComponentPath, source)];
}

function auditRescueRoutes() {
  return rescueRouteFiles.flatMap((route) => {
    const source = readFile(route.path);

    if (!source) {
      return [
        {
          file: route.path,
          line: 1,
          rule: "rescue_route_missing",
          text: "",
        },
      ];
    }

    return [
      ...missingSignalFindings(route.path, source, route.requiredSignals),
      ...scanForbidden(route.path, source),
    ];
  });
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(findings) {
  const headers = ["file", "line", "rule", "text"];
  const rows = findings.map((finding) => headers.map((header) => csvEscape(finding[header])).join(","));

  return `${headers.join(",")}\n${rows.join("\n")}${rows.length ? "\n" : ""}`;
}

function toMarkdown(summary) {
  const rows = summary.findings.length
    ? summary.findings.map(
        (finding) =>
          `| ${finding.rule} | ${finding.file} | ${finding.line} | \`${String(finding.text).replaceAll("|", "\\|")}\` |`,
      )
    : ["| OK | - | - | - |"];

  return `${[
    "# Audit pages de secours client",
    "",
    `Date: ${summary.checkedAt}`,
    `Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "## Synthese",
    "",
    `- Routes surveillees: ${summary.checkedRouteCount}`,
    `- Liens support attendus: ${summary.requiredSupportLinkCount}`,
    `- Alertes: ${summary.findingCount}`,
    "",
    "| Regle | Fichier | Ligne | Extrait |",
    "|---|---|---:|---|",
    ...rows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule: aucun catalogue modifie, aucun paiement, aucune commande, aucune publication.",
    "- Les pages de secours doivent ramener vers boutique, paiement, suivi colis et service client.",
    "- Aucun jargon technique ou interne ne doit etre visible dans ces pages.",
    "",
  ].join("\n")}\n`;
}

const findings = [...auditSupportComponent(), ...auditRescueRoutes()];
const summary = {
  checkedAt: new Date().toISOString(),
  ok: findings.length === 0,
  supportComponentPath,
  routeFiles: rescueRouteFiles.map((route) => route.path),
  checkedRouteCount: rescueRouteFiles.length,
  requiredSupportLinkCount: requiredSupportLinks.length,
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

const jsonPath = path.join(outputDir, "audit-rescue-support-surface.json");
const mdPath = path.join(outputDir, "RAPPORT_AUDIT_RESCUE_SUPPORT_SURFACE.md");
const csvPath = path.join(outputDir, `maxi-audit-pages-secours-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, toMarkdown(summary), "utf8");
fs.writeFileSync(csvPath, toCsv(findings), "utf8");

console.log(JSON.stringify(summary, null, 2));

if (!summary.ok) {
  process.exitCode = 1;
}

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const outputDir = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  `surface-confiance-legale-${dateKey}`,
);

const supportComponentPath = "src/components/CustomerSupportQuickLinks.tsx";
const legalTrustPanelPath = "src/components/LegalTrustPanel.tsx";
const legalRouteFiles = [
  {
    path: "src/app/conditions-generales-vente/page.tsx",
    requiredSignals: ["LegalTrustPanel", "LegalDocument", "ServiceReadinessPanel"],
  },
  {
    path: "src/app/mentions-legales/page.tsx",
    requiredSignals: ["LegalTrustPanel", "LegalDocument", "ServiceReadinessPanel"],
  },
  {
    path: "src/app/politique-confidentialite/page.tsx",
    requiredSignals: ["LegalTrustPanel", "LegalDocument", "ServiceReadinessPanel"],
  },
  {
    path: "src/app/conditions-produits-partenaires/page.tsx",
    requiredSignals: [
      "CustomerJourneyPanel",
      "CustomerSupportQuickLinks",
      "ServiceReadinessPanel",
      "paiement",
      "suivi",
      "Service client",
      "partenaire logistique",
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
  { id: "api_copy_visible", pattern: /\bAPI\b/i },
  { id: "doubtful_copy_visible", pattern: /fiche fragile|fiche douteuse/i },
];

function readFile(relativePath) {
  const absolutePath = path.join(root, relativePath);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function isObviousCodeOnlyLine(line) {
  const trimmed = line.trim();

  return (
    /^(import|export|const|let|var|function|type|return|async|try|catch|finally|if)\b/.test(trimmed) ||
    /^\.(filter|map|slice|includes)\b/.test(trimmed) ||
    /\b(legalRouteFiles|requiredSignals|documentKey|metrics|getStorefrontControlMetrics)\b/.test(trimmed) ||
    /^[}"'),;]+$/.test(trimmed)
  );
}

function isLikelyRenderedCopy(line) {
  const trimmed = line.trim();

  if (isObviousCodeOnlyLine(line)) {
    return false;
  }

  return (
    /\b(title|description|label|text|badge|emptyTitle|ctaLabel|name|value)\s*:/.test(trimmed) ||
    trimmed.includes(">") ||
    /^(["'`])[^"'`]+(["'`]),?$/.test(trimmed)
  );
}

function scanForbidden(relativePath, source) {
  const findings = [];
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    if (!isObviousCodeOnlyLine(line)) {
      hardForbidden.forEach((rule) => {
        if (rule.pattern.test(line)) {
          findings.push({
            file: relativePath,
            line: lineNumber,
            rule: rule.id,
            text: line.trim(),
          });
        }
      });
    }

    if (!isLikelyRenderedCopy(line)) {
      return;
    }

    copyForbidden.forEach((rule) => {
      if (rule.pattern.test(line)) {
        findings.push({
          file: relativePath,
          line: lineNumber,
          rule: rule.id,
          text: line.trim(),
        });
      }
    });
  });

  return findings;
}

function missingSignalFindings(relativePath, source, signals) {
  return signals.flatMap((signal) =>
    source.includes(signal)
      ? []
      : [
          {
            file: relativePath,
            line: 1,
            rule: `missing_signal_${signal.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
            text: "",
          },
        ],
  );
}

function auditSupportComponent() {
  const source = readFile(supportComponentPath);

  if (!source) {
    return [
      {
        file: supportComponentPath,
        line: 1,
        rule: "support_component_missing",
        text: "",
      },
    ];
  }

  return requiredSupportLinks.flatMap((href) =>
    source.includes(`href: "${href}"`)
      ? []
      : [
          {
            file: supportComponentPath,
            line: 1,
            rule: `missing_support_link_${href.replaceAll("/", "_")}`,
            text: "",
          },
        ],
  );
}

function auditLegalTrustPanel() {
  const source = readFile(legalTrustPanelPath);

  if (!source) {
    return [
      {
        file: legalTrustPanelPath,
        line: 1,
        rule: "legal_trust_panel_missing",
        text: "",
      },
    ];
  }

  return [
    ...missingSignalFindings(legalTrustPanelPath, source, [
      "CustomerSupportQuickLinks",
      "Paiement Maxi Trouvaille",
      "Suivi colis",
      "service client Maxi Trouvaille",
      "/conditions-produits-partenaires",
      "/retours-remboursements",
      "/contact",
    ]),
    ...scanForbidden(legalTrustPanelPath, source),
  ];
}

function auditLegalRoutes() {
  return legalRouteFiles.flatMap((route) => {
    const source = readFile(route.path);

    if (!source) {
      return [
        {
          file: route.path,
          line: 1,
          rule: "legal_route_missing",
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

function toMarkdown(summary) {
  const rows = summary.findings.length
    ? summary.findings.map(
        (finding) =>
          `| ${finding.rule} | ${finding.file} | ${finding.line} | \`${finding.text.replaceAll("|", "\\|")}\` |`,
      )
    : ["| OK | - | - | - |"];

  return `${[
    "# Audit surface confiance legale",
    "",
    `Date: ${summary.checkedAt}`,
    `Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "## Synthese",
    "",
    `- Routes confiance surveillees: ${summary.checkedRouteCount}`,
    `- Liens support attendus: ${summary.requiredSupportLinkCount}`,
    `- Alertes: ${summary.findingCount}`,
    "",
    "| Regle | Fichier | Ligne | Extrait |",
    "|---|---|---:|---|",
    ...rows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule: aucun paiement, aucune commande, aucune publication.",
    "- Les pages confiance doivent relier paiement, suivi colis, service client, livraison et retours.",
    "- Les routes client ne doivent exposer aucune source externe ni jargon interne.",
    "",
  ].join("\n")}\n`;
}

const findings = [
  ...auditSupportComponent(),
  ...auditLegalTrustPanel(),
  ...auditLegalRoutes(),
];
const summary = {
  checkedAt: new Date().toISOString(),
  ok: findings.length === 0,
  supportComponentPath,
  legalTrustPanelPath,
  checkedRouteCount: legalRouteFiles.length,
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
  },
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  path.join(outputDir, "audit-legal-trust-surface.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);
fs.writeFileSync(
  path.join(outputDir, "RAPPORT_AUDIT_LEGAL_TRUST_SURFACE.md"),
  toMarkdown(summary),
  "utf8",
);

console.log(JSON.stringify(summary, null, 2));

if (!summary.ok) {
  process.exitCode = 1;
}

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const outputDir = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  `surface-campagnes-partenaires-${dateKey}`,
);

const componentPath = "src/components/PartnerCampaignLanding.tsx";
const routeFiles = [
  "src/app/nouveautes/page.tsx",
  "src/app/promotions/page.tsx",
];

const requiredComponentSignals = [
  "CustomerJourneyPanel",
  "CustomerSupportQuickLinks",
  "PartnerArticlePreviewPanel",
  "categorySlug={config.categorySlug}",
  "/paiement",
  "/suivi-colis",
  "/produits-partenaires",
  "paiement Maxi",
  "suivi colis",
  "validation complète",
];

const requiredRouteSignals = [
  "PartnerCampaignLanding",
  "paiement Maxi Trouvaille",
  "suivi colis",
  "validation",
];

const hardForbidden = [
  { id: "aliexpress_visible", pattern: /AliExpress/i },
  { id: "temu_visible", pattern: /Temu/i },
  { id: "supplier_visible", pattern: /\b(supplier|seller)\b/i },
  { id: "supplier_fr_visible", pattern: /fournisseur/i },
  { id: "stripe_visible", pattern: /Stripe/i },
  { id: "mailto_visible", pattern: /mailto:/i },
];

const copyForbidden = [
  { id: "hold_jargon_visible", pattern: /\bHOLD\b/i },
  { id: "dropshipping_copy_visible", pattern: /\bdropshipping\b/i },
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
    /^(import|export|const|let|var|function|type)\b/.test(trimmed) ||
    /\b(categorySlug|kind|matchesProduct|isDropshipping|productIds|campaignProducts|partnerProducts)\b/.test(trimmed)
  );
}

function isLikelyRenderedCopy(line) {
  const trimmed = line.trim();

  if (isObviousCodeOnlyLine(line)) {
    return false;
  }

  return (
    /\b(title|description|label|text|badge|emptyTitle|ctaLabel|titleWhenReady|name)\s*:/.test(trimmed) ||
    trimmed.includes(">") ||
    /^["'`][^"'`]+["'`],?$/.test(trimmed)
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

function auditComponent() {
  const source = readFile(componentPath);

  if (!source) {
    return [
      {
        file: componentPath,
        line: 1,
        rule: "partner_campaign_component_missing",
        text: "",
      },
    ];
  }

  const findings = requiredComponentSignals.flatMap((signal) =>
    source.includes(signal)
      ? []
      : [
          {
            file: componentPath,
            line: 1,
            rule: `missing_signal_${signal.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
            text: "",
          },
        ],
  );

  return [...findings, ...scanForbidden(componentPath, source)];
}

function auditRoutes() {
  return routeFiles.flatMap((relativePath) => {
    const source = readFile(relativePath);

    if (!source) {
      return [
        {
          file: relativePath,
          line: 1,
          rule: "partner_campaign_route_missing",
          text: "",
        },
      ];
    }

    const findings = requiredRouteSignals.flatMap((signal) =>
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

    return [...findings, ...scanForbidden(relativePath, source)];
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
    "# Audit surface campagnes partenaires",
    "",
    `Date: ${summary.checkedAt}`,
    `Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "## Synthese",
    "",
    `- Routes surveillees: ${summary.routeCount}`,
    `- Signaux composant: ${summary.requiredComponentSignalCount}`,
    `- Alertes: ${summary.findingCount}`,
    "",
    "| Regle | Fichier | Ligne | Extrait |",
    "|---|---|---:|---|",
    ...rows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule: aucun paiement, aucune commande, aucune publication.",
    "- Les pages nouveautes/promotions doivent rester produits partenaires, paiement Maxi Trouvaille, suivi colis et validation avant vente.",
    "- Les apercus d'articles restent des idees en validation, jamais des fiches achetables.",
    "",
  ].join("\n")}\n`;
}

const findings = [...auditComponent(), ...auditRoutes()];
const summary = {
  checkedAt: new Date().toISOString(),
  ok: findings.length === 0,
  componentPath,
  routeCount: routeFiles.length,
  requiredComponentSignalCount: requiredComponentSignals.length,
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
  path.join(outputDir, "audit-partner-campaign-surface.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);
fs.writeFileSync(
  path.join(outputDir, "RAPPORT_AUDIT_PARTNER_CAMPAIGN_SURFACE.md"),
  toMarkdown(summary),
  "utf8",
);

console.log(JSON.stringify(summary, null, 2));

if (!summary.ok) {
  process.exitCode = 1;
}

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const outputDir = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  `surface-accueil-partenaires-${dateKey}`,
);

const supportComponentPath = "src/components/CustomerSupportQuickLinks.tsx";
const homeRoutePath = "src/app/page.tsx";

const requiredHomeSignals = [
  "CustomerSupportQuickLinks",
  "HeroCarousel",
  "MobilePresentationPathPanel",
  "StorefrontReadinessPanel",
  "PartnerLaunchBoard",
  "PartnerArticlePreviewPanel",
  "CategoryGrid",
  "paiement Maxi Trouvaille",
  "suivi colis",
  "service client",
  "/boutique",
  "/produits-partenaires",
  "/suivi-colis",
  "/contact",
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
    /^(import|export|const|let|var|function|type|return)\b/.test(trimmed) ||
    /^\.(filter|map|slice)\b/.test(trimmed) ||
    /\b(isDropshipping|isProductPurchasable|productIds|catalogProducts|publicProducts|requiredHomeSignals)\b/.test(trimmed) ||
    /^[}"'),;]+$/.test(trimmed)
  );
}

function isLikelyRenderedCopy(line) {
  const trimmed = line.trim();

  if (isObviousCodeOnlyLine(line)) {
    return false;
  }

  return (
    /\b(title|description|label|text|badge|emptyTitle|ctaLabel|titleWhenReady|name|value|cta)\s*:/.test(trimmed) ||
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

function auditHomeRoute() {
  const source = readFile(homeRoutePath);

  if (!source) {
    return [
      {
        file: homeRoutePath,
        line: 1,
        rule: "home_route_missing",
        text: "",
      },
    ];
  }

  return [
    ...missingSignalFindings(homeRoutePath, source, requiredHomeSignals),
    ...scanForbidden(homeRoutePath, source),
  ];
}

function toMarkdown(summary) {
  const rows = summary.findings.length
    ? summary.findings.map(
        (finding) =>
          `| ${finding.rule} | ${finding.file} | ${finding.line} | \`${finding.text.replaceAll("|", "\\|")}\` |`,
      )
    : ["| OK | - | - | - |"];

  return `${[
    "# Audit surface accueil partenaires",
    "",
    `Date: ${summary.checkedAt}`,
    `Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "## Synthese",
    "",
    `- Route accueil surveillee: ${summary.homeRoutePath}`,
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
    "- L'accueil doit presenter rayons partenaires, paiement Maxi Trouvaille, suivi colis, service client et validation avant vente.",
    "- L'accueil ne doit exposer aucune source externe ni jargon interne.",
    "",
  ].join("\n")}\n`;
}

const findings = [...auditSupportComponent(), ...auditHomeRoute()];
const summary = {
  checkedAt: new Date().toISOString(),
  ok: findings.length === 0,
  supportComponentPath,
  homeRoutePath,
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
  path.join(outputDir, "audit-partner-home-surface.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);
fs.writeFileSync(
  path.join(outputDir, "RAPPORT_AUDIT_PARTNER_HOME_SURFACE.md"),
  toMarkdown(summary),
  "utf8",
);

console.log(JSON.stringify(summary, null, 2));

if (!summary.ok) {
  process.exitCode = 1;
}

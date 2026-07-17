import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const outputDir = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  `surface-support-client-${dateKey}`,
);

const componentPath = "src/components/CustomerSupportQuickLinks.tsx";
const supportRouteFiles = [
  "src/app/suivi-colis/page.tsx",
  "src/app/contact/page.tsx",
  "src/app/livraison/page.tsx",
  "src/app/faq/page.tsx",
  "src/app/retours-remboursements/page.tsx",
  "src/app/paiement/page.tsx",
];

const requiredLinks = [
  "/suivi-colis",
  "/paiement",
  "/livraison",
  "/retours-remboursements",
  "/faq",
  "/contact",
];

const requiredSignals = [
  {
    id: "maxi_trouvaille",
    pattern: /Maxi Trouvaille/i,
  },
  {
    id: "payment_wording",
    pattern: /paiement/i,
  },
  {
    id: "tracking_wording",
    pattern: /suivi colis/i,
  },
  {
    id: "customer_service_wording",
    pattern: /service client/i,
  },
  {
    id: "logistics_partner_wording",
    pattern: /partenaire logistique/i,
  },
  {
    id: "partner_products_wording",
    pattern: /produits partenaires/i,
  },
];

const forbiddenPublicPatterns = [
  {
    id: "internal_supplier_fr",
    pattern: /fournisseur/i,
  },
  {
    id: "external_marketplace_name_a",
    pattern: /AliExpress/i,
  },
  {
    id: "external_marketplace_name_t",
    pattern: /Temu/i,
  },
  {
    id: "internal_supplier_en",
    pattern: /\b(supplier|seller)\b/i,
  },
  {
    id: "hold_jargon",
    pattern: /\bHOLD\b/i,
  },
  {
    id: "dropshipping_public_word",
    pattern: /\bdropshipping\b/i,
  },
  {
    id: "payment_provider_brand",
    pattern: /Stripe/i,
  },
  {
    id: "real_message_link",
    pattern: /mailto:/i,
  },
  {
    id: "technical_api_word",
    pattern: /\bAPI\b/i,
  },
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

function findPatternFindings(relativePath, source) {
  const findings = [];

  for (const rule of forbiddenPublicPatterns) {
    for (const match of source.matchAll(new RegExp(rule.pattern, rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`))) {
      findings.push({
        file: relativePath,
        line: lineNumber(source, match.index ?? 0),
        rule: rule.id,
      });
    }
  }

  return findings;
}

function auditComponent() {
  const source = readFile(componentPath);
  const findings = [];

  if (!source) {
    return [
      {
        file: componentPath,
        line: 1,
        rule: "support_component_missing",
      },
    ];
  }

  for (const href of requiredLinks) {
    if (!source.includes(`href: "${href}"`)) {
      findings.push({
        file: componentPath,
        line: 1,
        rule: `missing_link_${href.replaceAll("/", "_")}`,
      });
    }
  }

  for (const signal of requiredSignals) {
    if (!signal.pattern.test(source)) {
      findings.push({
        file: componentPath,
        line: 1,
        rule: `missing_${signal.id}`,
      });
    }
  }

  findings.push(...findPatternFindings(componentPath, source));

  return findings;
}

function auditRoutes() {
  return supportRouteFiles.flatMap((relativePath) => {
    const source = readFile(relativePath);

    if (!source) {
      return [
        {
          file: relativePath,
          line: 1,
          rule: "support_route_missing",
        },
      ];
    }

    const findings = [];

    if (!source.includes("CustomerSupportQuickLinks")) {
      findings.push({
        file: relativePath,
        line: 1,
        rule: "support_quick_links_not_mounted",
      });
    }

    findings.push(...findPatternFindings(relativePath, source));

    return findings;
  });
}

function toMarkdown(summary) {
  const rows = summary.findings.length
    ? summary.findings.map(
        (finding) => `| ${finding.rule} | ${finding.file} | ${finding.line} |`,
      )
    : ["| OK | - | - |"];

  return `${[
    "# Audit surface support client",
    "",
    `Date: ${summary.checkedAt}`,
    `Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "## Synthese",
    "",
    `- Routes support surveillees: ${summary.checkedRouteCount}`,
    `- Liens publics attendus: ${summary.requiredLinkCount}`,
    `- Alertes: ${summary.findingCount}`,
    "",
    "| Regle | Fichier | Ligne |",
    "|---|---|---:|",
    ...rows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule: aucun paiement, aucune commande, aucune publication.",
    "- Les pages client doivent garder le vocabulaire Maxi Trouvaille: paiement, suivi colis, service client, produits partenaires.",
    "- Les routes support doivent rester coherentes sur mobile et renvoyer vers les pages utiles.",
    "",
  ].join("\n")}\n`;
}

const findings = [...auditComponent(), ...auditRoutes()];
const summary = {
  checkedAt: new Date().toISOString(),
  ok: findings.length === 0,
  componentPath,
  checkedRouteCount: supportRouteFiles.length,
  requiredLinkCount: requiredLinks.length,
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
  path.join(outputDir, "audit-customer-support-surface.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);
fs.writeFileSync(
  path.join(outputDir, "RAPPORT_AUDIT_CUSTOMER_SUPPORT_SURFACE.md"),
  toMarkdown(summary),
  "utf8",
);

console.log(JSON.stringify(summary, null, 2));

if (!summary.ok) {
  process.exitCode = 1;
}

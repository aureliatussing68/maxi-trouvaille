import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const journeyFiles = [
  "src/app/page.tsx",
  "src/app/boutique/page.tsx",
  "src/app/produits-partenaires/page.tsx",
  "src/app/panier/page.tsx",
  "src/app/paiement/page.tsx",
  "src/app/suivi-colis/page.tsx",
  "src/app/contact/page.tsx",
  "src/components/CartView.tsx",
  "src/components/CheckoutView.tsx",
  "src/components/CustomerJourneyPanel.tsx",
  "src/components/CustomerSupportQuickLinks.tsx",
  "src/components/MobileDemoNav.tsx",
  "src/components/TrackingLookupForm.tsx",
];

const requiredSignalsByFile = [
  {
    file: "src/app/page.tsx",
    signals: [
      "Maxi Trouvaille",
      "/boutique",
      "/produits-partenaires",
      "/suivi-colis",
      "Paiement Maxi Trouvaille",
      "MobilePresentationPathPanel",
      "CustomerSupportQuickLinks",
    ],
  },
  {
    file: "src/app/boutique/page.tsx",
    signals: [
      "Boutique partenaires",
      "MobilePresentationPathPanel",
      "PartnerDemoPathPanel",
      "PartnerMobileShowcasePanel",
      "StorefrontReadinessPanel",
      "ShopProductExplorer",
    ],
  },
  {
    file: "src/app/produits-partenaires/page.tsx",
    signals: [
      "Boutique partenaires Maxi Trouvaille",
      "Paiement sécurisé",
      "suivi colis",
      "partenaire logistique",
      "CustomerJourneyPanel",
      "CustomerSupportQuickLinks",
      "/paiement",
      "/suivi-colis",
      "/contact",
    ],
  },
  {
    file: "src/app/panier/page.tsx",
    signals: [
      "Panier sous garde",
      "Aucun article non prouvé",
      "Achat verrouillé",
      "CustomerJourneyPanel",
      "CustomerSupportQuickLinks",
      "CartView",
    ],
  },
  {
    file: "src/app/paiement/page.tsx",
    signals: [
      "Paiement Maxi Trouvaille",
      "0 produit achetable sans preuve",
      "index: false",
      "CustomerJourneyPanel",
      "CustomerSupportQuickLinks",
      "CheckoutView",
    ],
  },
  {
    file: "src/app/suivi-colis/page.tsx",
    signals: [
      "Suivi colis",
      "ServiceReadinessPanel",
      "CustomerJourneyPanel",
      "CustomerSupportQuickLinks",
      "TrackingLookupForm",
    ],
  },
  {
    file: "src/app/contact/page.tsx",
    signals: [
      "Service client",
      "Maxi Trouvaille reste le point de contact",
      "ServiceReadinessPanel",
      "CustomerJourneyPanel",
      "CustomerSupportQuickLinks",
      "/suivi-colis",
      "/paiement",
      "/produits-partenaires",
    ],
  },
  {
    file: "src/components/CartView.tsx",
    signals: [
      "Panier prêt, paiement contrôlé",
      "paiement Maxi Trouvaille",
      "/produits-partenaires",
      "/suivi-colis",
      "/api/checkout",
      "isClientProductPurchasable",
    ],
  },
  {
    file: "src/components/CheckoutView.tsx",
    signals: [
      "Paiement Maxi Trouvaille prêt",
      "Le paiement s&apos;ouvre seulement",
      "/produits-partenaires",
      "/suivi-colis",
      "/api/checkout",
      "isClientProductPurchasable",
    ],
  },
  {
    file: "src/components/CustomerJourneyPanel.tsx",
    signals: [
      "Parcours client",
      "Paiement Maxi Trouvaille",
      "Suivi colis",
      "/boutique",
      "/contact",
    ],
  },
  {
    file: "src/components/CustomerSupportQuickLinks.tsx",
    signals: [
      "Support client Maxi Trouvaille",
      "/suivi-colis",
      "/paiement",
      "/livraison",
      "/retours-remboursements",
      "/faq",
      "/contact",
    ],
  },
  {
    file: "src/components/MobileDemoNav.tsx",
    signals: [
      "/boutique",
      "/produits-partenaires",
      "/nouveautes",
      "/promotions",
      "/suivi-colis",
      "Navigation rapide mobile",
    ],
  },
  {
    file: "src/components/TrackingLookupForm.tsx",
    signals: [
      "Suivre un colis",
      "Entrez le numéro transmis par Maxi Trouvaille",
      "service client Maxi Trouvaille",
    ],
  },
];

const requiredFlowLinks = [
  { from: "src/app/page.tsx", href: "/boutique", label: "Accueil vers boutique" },
  {
    from: "src/app/page.tsx",
    href: "/produits-partenaires",
    label: "Accueil vers produits partenaires",
  },
  {
    from: "src/app/produits-partenaires/page.tsx",
    href: "/paiement",
    label: "Partenaires vers paiement garde",
  },
  {
    from: "src/app/produits-partenaires/page.tsx",
    href: "/suivi-colis",
    label: "Partenaires vers suivi colis",
  },
  {
    from: "src/app/produits-partenaires/page.tsx",
    href: "/contact",
    label: "Partenaires vers service client",
  },
  {
    from: "src/components/CartView.tsx",
    href: "/produits-partenaires",
    label: "Panier vide vers rayons partenaires",
  },
  {
    from: "src/components/CheckoutView.tsx",
    href: "/produits-partenaires",
    label: "Paiement vide vers rayons partenaires",
  },
  {
    from: "src/components/CustomerSupportQuickLinks.tsx",
    href: "/contact",
    label: "Support vers contact",
  },
];

const forbiddenHrefPrefixes = [
  "/admin",
  "/api",
  "/dropshipping",
  "/conditions-dropshipping",
  "/deposer-annonce",
  "/vendre",
];

const forbiddenSensitiveSignals = [
  "AliExpress",
  "Temu",
  "supplier",
  "seller",
  "marketplace",
  "source fournisseur",
  "prix fournisseur",
  "lien fournisseur",
  "Stripe",
  "mailto:",
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

function absolutePath(relativeFilePath) {
  return path.join(root, relativeFilePath);
}

function readFile(relativeFilePath) {
  const filePath = absolutePath(relativeFilePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function lineOf(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function addFinding(findings, file, line, rule, detail) {
  findings.push({ file, line, rule, detail });
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

function auditRequiredSignals(sources, findings) {
  const detectedSignals = [];

  for (const requirement of requiredSignalsByFile) {
    const source = sources.get(requirement.file) ?? "";
    if (!source) {
      addFinding(
        findings,
        requirement.file,
        1,
        "journey_file_missing",
        "Le fichier du parcours public mobile est introuvable.",
      );
      continue;
    }

    for (const signal of requirement.signals) {
      const index = source.indexOf(signal);
      if (index === -1) {
        addFinding(
          findings,
          requirement.file,
          1,
          "journey_required_signal_missing",
          `${signal} doit rester present dans le parcours public mobile.`,
        );
        continue;
      }

      detectedSignals.push({
        file: requirement.file,
        signal,
        line: lineOf(source, index),
      });
    }
  }

  return detectedSignals;
}

function auditFlowLinks(sources, findings) {
  const detectedLinks = [];

  for (const flowLink of requiredFlowLinks) {
    const source = sources.get(flowLink.from) ?? "";
    const hrefs = parseHrefValues(source);
    const found = hrefs.find((href) => href.value === flowLink.href);

    if (!found) {
      addFinding(
        findings,
        flowLink.from,
        1,
        "journey_flow_link_missing",
        `${flowLink.label}: ${flowLink.href} doit rester accessible.`,
      );
      continue;
    }

    detectedLinks.push({
      file: flowLink.from,
      href: flowLink.href,
      label: flowLink.label,
      line: found.line,
    });
  }

  return detectedLinks;
}

function auditForbiddenSignals(sources, findings) {
  const hrefsByFile = [];

  for (const [file, source] of sources.entries()) {
    for (const sensitiveSignal of forbiddenSensitiveSignals) {
      const index = source.toLowerCase().indexOf(sensitiveSignal.toLowerCase());
      if (index !== -1) {
        addFinding(
          findings,
          file,
          lineOf(source, index),
          "journey_sensitive_public_signal",
          `${sensitiveSignal} ne doit pas apparaitre dans le parcours public mobile.`,
        );
      }
    }

    const hrefs = parseHrefValues(source);
    hrefsByFile.push(...hrefs.map((href) => ({ file, ...href })));

    for (const href of hrefs) {
      const isForbidden = forbiddenHrefPrefixes.some(
        (prefix) => href.value === prefix || href.value.startsWith(`${prefix}/`),
      );
      if (isForbidden || /^https?:\/\//i.test(href.value)) {
        addFinding(
          findings,
          file,
          href.line,
          "journey_forbidden_href",
          `${href.value} ne doit pas etre un lien du parcours public mobile.`,
        );
      }
    }
  }

  return hrefsByFile;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function findingsToCsv(findings) {
  const headers = ["file", "line", "rule", "detail"];
  const rows = findings.map((finding) => headers.map((header) => csvEscape(finding[header])).join(","));

  return `${headers.join(",")}\n${rows.join("\n")}${rows.length ? "\n" : ""}`;
}

function markdown(summary) {
  const signalRows = summary.detectedSignals.map(
    (signal) => `| ${signal.file} | ${signal.line} | ${signal.signal} |`,
  );
  const linkRows = summary.detectedFlowLinks.map(
    (link) => `| ${link.label} | ${link.file} | ${link.line} | ${link.href} |`,
  );
  const findingRows =
    summary.findings.length === 0
      ? ["| OK | - | - | Aucun ecart detecte |"]
      : summary.findings.map(
          (finding) => `| ${finding.rule} | ${finding.file} | ${finding.line} | ${finding.detail} |`,
        );

  return `${[
    "# Audit parcours public mobile",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    `- Fichiers surveilles: ${summary.fileCount}`,
    `- Signaux detectes: ${summary.detectedSignalCount}`,
    `- Liens de parcours detectes: ${summary.detectedFlowLinkCount}`,
    `- Hrefs publics inspectes: ${summary.hrefCount}`,
    `- Alertes: ${summary.findingCount}`,
    "",
    "## Signaux publics",
    "",
    "| Fichier | Ligne | Signal |",
    "|---|---:|---|",
    ...signalRows,
    "",
    "## Chemin mobile",
    "",
    "| Etape | Fichier | Ligne | Lien |",
    "|---|---|---:|---|",
    ...linkRows,
    "",
    "## Alertes",
    "",
    "| Regle | Fichier | Ligne | Detail |",
    "|---|---|---:|---|",
    ...findingRows,
    "",
    "## Garde-fous",
    "",
    "- Audit lecture seule cote catalogue.",
    "- Aucun paiement, aucune commande, aucun message, aucune publication.",
    "- Aucun lien admin, API, route legacy sensible ou URL externe dans le parcours public mobile.",
    "- Aucune fuite AliExpress, Temu, supplier, seller, marketplace ou prix/lien fournisseur.",
    "",
  ].join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const findings = [];
const sources = new Map(journeyFiles.map((file) => [file, readFile(file)]));
const detectedSignals = auditRequiredSignals(sources, findings);
const detectedFlowLinks = auditFlowLinks(sources, findings);
const hrefs = auditForbiddenSignals(sources, findings);

const outputDir = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  `audit-public-mobile-journey-${dateKey}`,
);

const summary = {
  ok: findings.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_public_mobile_journey_audit",
  files: journeyFiles,
  fileCount: journeyFiles.length,
  requiredSignalsByFile,
  requiredFlowLinks,
  forbiddenHrefPrefixes,
  forbiddenSensitiveSignals,
  detectedSignals,
  detectedSignalCount: detectedSignals.length,
  detectedFlowLinks,
  detectedFlowLinkCount: detectedFlowLinks.length,
  hrefs,
  hrefCount: hrefs.length,
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

const jsonPath = path.join(outputDir, `AUDIT_PUBLIC_MOBILE_JOURNEY_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_PUBLIC_MOBILE_JOURNEY_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-audit-public-mobile-journey-${dateKey}.csv`);

summary.outputFiles = {
  json: path.relative(root, jsonPath).replace(/\\/g, "/"),
  md: path.relative(root, mdPath).replace(/\\/g, "/"),
  csv: path.relative(root, csvPath).replace(/\\/g, "/"),
};

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, findingsToCsv(findings), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      fileCount: summary.fileCount,
      detectedSignalCount: summary.detectedSignalCount,
      detectedFlowLinkCount: summary.detectedFlowLinkCount,
      hrefCount: summary.hrefCount,
      findingCount: summary.findingCount,
      files: summary.outputFiles,
      safety: summary.safety,
    },
    null,
    2,
  ),
);

if (!summary.ok) {
  process.exitCode = 1;
}

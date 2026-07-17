import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  `public-catalog-source-guards-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
);

const publicClientFiles = [
  "src/components/CartProvider.tsx",
  "src/components/CartView.tsx",
  "src/components/CheckoutView.tsx",
  "src/components/ProductCard.tsx",
  "src/components/ShopProductExplorer.tsx",
  "src/components/AddToCartButton.tsx",
  "src/components/Header.tsx",
  "src/components/Footer.tsx",
  "src/components/HeroCarousel.tsx",
  "src/components/MobileDemoNav.tsx",
  "src/components/OrderSuccess.tsx",
  "src/components/CustomerJourneyPanel.tsx",
  "src/components/PartnerArticlePreviewPanel.tsx",
  "src/components/PartnerLaunchBoard.tsx",
  "src/components/ProductMessageForm.tsx",
  "src/components/TrackingLookupForm.tsx",
  "src/components/StorefrontReadinessPanel.tsx",
  "src/components/TrustBar.tsx",
  "src/components/useShippingSelection.ts",
];

const publicRouteFiles = [
  "src/app/page.tsx",
  "src/app/boutique/page.tsx",
  "src/app/categories/page.tsx",
  "src/app/categories/[slug]/page.tsx",
  "src/app/produits-partenaires/page.tsx",
  "src/app/produit/[slug]/page.tsx",
  "src/app/panier/page.tsx",
  "src/app/paiement/page.tsx",
  "src/app/api/cart/eligible-items/route.ts",
  "src/app/sitemap.ts",
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

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function readRelative(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function lineOf(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function collectImportStatements(source, moduleName) {
  const imports = [];
  const importRegex = /import\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["'];?/g;

  for (const match of source.matchAll(importRegex)) {
    if (match[3] !== moduleName) {
      continue;
    }

    imports.push({
      index: match.index ?? 0,
      isTypeOnly: Boolean(match[1]),
      statement: match[0],
      specifier: match[2],
    });
  }

  return imports;
}

function hasNamedImport(statement, name) {
  const namedMatch = statement.match(/\{([\s\S]*?)\}/);
  if (!namedMatch) {
    return false;
  }

  return namedMatch[1]
    .split(",")
    .map((part) => part.trim().split(/\s+as\s+/i)[0]?.trim())
    .includes(name);
}

function addFinding(findings, file, line, rule, detail) {
  findings.push({
    file,
    line,
    rule,
    detail,
  });
}

function auditPublicClientFiles(findings) {
  for (const relativePath of publicClientFiles) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
      addFinding(findings, relativePath, 1, "public_client_file_missing", "Fichier public client introuvable.");
      continue;
    }

    const source = readRelative(relativePath);
    const isClientComponent = /^\s*["']use client["'];?/m.test(source);
    if (!isClientComponent) {
      continue;
    }

    for (const importStatement of collectImportStatements(source, "@/lib/catalog")) {
      if (!importStatement.isTypeOnly) {
        addFinding(
          findings,
          relativePath,
          lineOf(source, importStatement.index),
          "catalog_value_import_in_public_client",
          "Les composants client publics doivent utiliser catalog-client ou des imports type-only.",
        );
      }

      if (hasNamedImport(importStatement.statement, "products")) {
        addFinding(
          findings,
          relativePath,
          lineOf(source, importStatement.index),
          "raw_products_import_in_public_client",
          "`products` ne doit jamais etre importe dans un composant client public.",
        );
      }
    }
  }
}

function auditPublicRoutes(findings) {
  for (const relativePath of publicRouteFiles) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
      addFinding(findings, relativePath, 1, "public_route_file_missing", "Route publique introuvable.");
      continue;
    }

    const source = readRelative(relativePath);
    for (const importStatement of collectImportStatements(source, "@/lib/catalog")) {
      if (hasNamedImport(importStatement.statement, "products")) {
        addFinding(
          findings,
          relativePath,
          lineOf(source, importStatement.index),
          "raw_products_import_in_public_route",
          "Les routes publiques doivent passer par catalog-server/getPublicProducts pour les listes produits.",
        );
      }
    }

    for (const importStatement of collectImportStatements(source, "@/lib/catalog-server")) {
      if (
        hasNamedImport(importStatement.statement, "getCatalogProductBySlug") &&
        relativePath !== "src/app/produit/[slug]/page.tsx"
      ) {
        addFinding(
          findings,
          relativePath,
          lineOf(source, importStatement.index),
          "unfiltered_product_lookup_in_public_route",
          "Lookup produit non filtre reserve a la preview admin noindex de la fiche produit.",
        );
      }
    }
  }
}

function auditCartProvider(findings) {
  const relativePath = "src/components/CartProvider.tsx";
  const source = readRelative(relativePath);
  const bannedMarkers = [
    ["products", "raw_products_marker_in_cart_provider"],
    ["getProductById", "unfiltered_lookup_marker_in_cart_provider"],
    ["staticProductMap", "static_catalog_map_marker_in_cart_provider"],
    ["detailedItems", "detailed_items_in_cart_provider"],
    ["subtotal", "subtotal_in_cart_provider"],
  ];

  for (const [marker, rule] of bannedMarkers) {
    const index = source.indexOf(marker);
    if (index !== -1) {
      addFinding(
        findings,
        relativePath,
        lineOf(source, index),
        rule,
        `Le provider panier global ne doit pas contenir ${marker}.`,
      );
    }
  }
}

function auditCartPages(findings) {
  const cartPage = readRelative("src/app/panier/page.tsx");
  const paymentPage = readRelative("src/app/paiement/page.tsx");

  if (!cartPage.includes("getPublicProducts") || !cartPage.includes("<CartView products={products}")) {
    addFinding(
      findings,
      "src/app/panier/page.tsx",
      1,
      "cart_page_missing_public_products",
      "La page panier doit fournir les produits publics filtres a CartView.",
    );
  }

  if (!paymentPage.includes("getPublicProducts") || !paymentPage.includes("<CheckoutView products={products}")) {
    addFinding(
      findings,
      "src/app/paiement/page.tsx",
      1,
      "payment_page_missing_public_products",
      "La page paiement doit fournir les produits publics filtres a CheckoutView.",
    );
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(findings) {
  const headers = ["file", "line", "rule", "detail"];
  const rows = findings.map((finding) =>
    headers.map((header) => csvEscape(finding[header])).join(","),
  );

  return `${headers.join(",")}\n${rows.join("\n")}${rows.length ? "\n" : ""}`;
}

function toMarkdown(summary) {
  const rows =
    summary.findings.length === 0
      ? ["| OK | - | - | Aucun contournement detecte |"]
      : summary.findings.map(
          (finding) =>
            `| ${finding.rule} | ${finding.file} | ${finding.line} | ${finding.detail} |`,
        );

  return `${[
    "# Audit sources catalogue public",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    `- Fichiers client publics surveilles: ${summary.publicClientFileCount}`,
    `- Routes publiques surveillees: ${summary.publicRouteFileCount}`,
    `- Alertes: ${summary.findingCount}`,
    "",
    "| Regle | Fichier | Ligne | Detail |",
    "|---|---|---:|---|",
    ...rows,
    "",
    "## Garde-fous",
    "",
    "- Le panier global ne doit stocker que les lignes locales.",
    "- Les vues panier et paiement doivent recevoir les produits via `getPublicProducts`.",
    "- Les composants client publics ne doivent pas importer `products` ni de valeur depuis `@/lib/catalog`.",
    "- Les routes publiques ne doivent pas importer `products` directement.",
    "- Lecture seule: aucune publication, aucun paiement, aucune commande fournisseur.",
    "",
  ].join("\n")}`;
}

const { localLabel } = datePartsParis();
const findings = [];

auditPublicClientFiles(findings);
auditPublicRoutes(findings);
auditCartProvider(findings);
auditCartPages(findings);

const summary = {
  generatedAtLocal: localLabel,
  ok: findings.length === 0,
  publicClientFileCount: publicClientFiles.length,
  publicRouteFileCount: publicRouteFiles.length,
  findingCount: findings.length,
  findings,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  path.join(outputDir, "audit-public-catalog-source-guards.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(outputDir, "audit-public-catalog-source-guards.csv"),
  toCsv(findings),
);
fs.writeFileSync(
  path.join(outputDir, "RAPPORT_AUDIT_PUBLIC_CATALOG_SOURCE_GUARDS.md"),
  toMarkdown(summary),
);

console.log(JSON.stringify(summary, null, 2));

if (!summary.ok) {
  process.exitCode = 1;
}

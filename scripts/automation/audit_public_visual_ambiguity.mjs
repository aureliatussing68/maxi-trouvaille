import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const outputDir = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  `surface-visuelle-publique-${dateKey}`,
);

const publicSourceRelativePaths = [
  "src/app/page.tsx",
  "src/app/boutique/page.tsx",
  "src/app/categories/page.tsx",
  "src/app/categories/[slug]/page.tsx",
  "src/app/produit/[slug]/page.tsx",
  "src/app/produits-partenaires/page.tsx",
  "src/components/CategoryGrid.tsx",
  "src/components/CustomerJourneyPanel.tsx",
  "src/components/HeroCarousel.tsx",
  "src/components/MobileDemoNav.tsx",
  "src/components/PartnerArticlePreviewPanel.tsx",
  "src/components/PartnerLaunchBoard.tsx",
  "src/components/ProductCard.tsx",
  "src/components/ShopProductExplorer.tsx",
  "src/components/StorefrontReadinessPanel.tsx",
];

const heroPath = path.join(root, "src", "components", "HeroCarousel.tsx");
const productCardPath = path.join(root, "src", "components", "ProductCard.tsx");
const productPagePath = path.join(root, "src", "app", "produit", "[slug]", "page.tsx");

const forbiddenVisualPatterns = [
  {
    id: "unsplash_stock_visual",
    pattern: /images\.unsplash\.com|unsplash/i,
    reason: "Image stock externe interdite sur la surface publique en phase HOLD.",
  },
  {
    id: "supplier_cdn_visual",
    pattern: /alicdn|aliexpress-media|ae-pic/i,
    reason: "CDN fournisseur interdit cote client.",
  },
];

const forbiddenHeroProductSignals = [
  {
    id: "hero_high_tech_product_like",
    pattern: /accessoires high-tech|produits utiles|bureau/i,
    reason: "Hero trop proche d'une photo produit non prouvee.",
  },
  {
    id: "hero_store_shelves_product_like",
    pattern: /rayons de boutique|shelves|store shelves/i,
    reason: "Hero pouvant etre confondu avec les articles vendus.",
  },
];

function readFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function sourceFindings(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  return lines.flatMap((line, index) =>
    forbiddenVisualPatterns
      .filter((entry) => entry.pattern.test(line))
      .map((entry) => ({
        file: relativePath,
        line: index + 1,
        type: entry.id,
        reason: entry.reason,
        text: line.trim(),
      })),
  );
}

function heroGuardFindings() {
  const source = fs.readFileSync(heroPath, "utf8");
  const findings = [];

  forbiddenHeroProductSignals.forEach((entry) => {
    if (entry.pattern.test(source)) {
      findings.push({
        file: "src/components/HeroCarousel.tsx",
        line: 1,
        type: entry.id,
        reason: entry.reason,
      });
    }
  });

  const localCategoryImageCount = [
    ...source.matchAll(/image:\s*["']\/uploads\/category-images\/[^"']+\.webp["']/g),
  ].length;

  if (localCategoryImageCount < 3) {
    findings.push({
      file: "src/components/HeroCarousel.tsx",
      line: 1,
      type: "hero_local_category_images_missing",
      reason: "Le hero doit utiliser des visuels locaux de rayon, pas des images stock.",
    });
  }

  if (!/validation|verification|qualite|Preuves avant vente/i.test(source)) {
    findings.push({
      file: "src/components/HeroCarousel.tsx",
      line: 1,
      type: "hero_validation_context_missing",
      reason: "Le hero doit signaler le contexte de validation tant que le catalogue est HOLD.",
    });
  }

  if (!/partenaire logistique/i.test(source)) {
    findings.push({
      file: "src/components/HeroCarousel.tsx",
      line: 1,
      type: "hero_logistics_context_missing",
      reason: "Le hero doit rester coherent avec l'expedition par partenaire logistique.",
    });
  }

  return findings;
}

function productCardAirbagFindings() {
  const source = fs.readFileSync(productCardPath, "utf8");
  const checks = [
    {
      ok: source.includes("isClientPublicProduct(product)"),
      type: "product_card_public_gate_missing",
      reason: "ProductCard doit verifier isClientPublicProduct avant rendu client.",
    },
    {
      ok: source.includes("const canRenderPublicProduct = isClientPublicProduct(product);"),
      type: "product_card_public_gate_must_not_use_admin_bypass",
      reason:
        "ProductCard ne doit pas utiliser showAdminControls pour afficher une image produit non publique.",
    },
    {
      ok: !source.includes("showAdminControls || isPublicProduct(product)"),
      type: "product_card_admin_bypass_reintroduced",
      reason:
        "Le raccourci admin ne doit jamais rendre une photo produit HOLD sur la surface client.",
    },
    {
      ok: source.includes("Fiche en validation"),
      type: "product_card_hold_placeholder_missing",
      reason: "ProductCard doit avoir un rendu HOLD neutre sans image produit.",
    },
    {
      ok: source.includes("Image masquée tant que la fiche"),
      type: "product_card_admin_hold_image_lock_copy_missing",
      reason: "Le mode admin doit expliquer que l'image de la fiche HOLD reste masquee.",
    },
    {
      ok: source.includes("Produit en contrôle qualité"),
      type: "product_card_quality_hold_copy_missing",
      reason: "ProductCard doit masquer le titre reel des fiches HOLD.",
    },
  ];

  return checks.flatMap((check) =>
    check.ok
      ? []
      : [
          {
            file: "src/components/ProductCard.tsx",
            line: 1,
            type: check.type,
            reason: check.reason,
          },
        ],
  );
}

function productDetailImageGuardFindings() {
  const source = fs.readFileSync(productPagePath, "utf8");
  const checks = [
    {
      ok: source.includes("const canShowProductImages = isPublicProduct(product);"),
      type: "product_detail_public_image_gate_missing",
      reason:
        "La fiche produit doit verifier isPublicProduct avant de rendre une image produit.",
    },
    {
      ok: source.includes("Image verrouillée"),
      type: "product_detail_hold_placeholder_missing",
      reason: "La fiche produit doit afficher un placeholder HOLD sans image produit.",
    },
    {
      ok:
        source.includes("Prévisualisation HOLD") ||
        source.includes("Prévisualisation contrôlée"),
      type: "product_detail_admin_hold_warning_missing",
      reason:
        "La preview admin d'une fiche en validation doit signaler que l'image et l'achat restent bloques.",
    },
    {
      ok: !source.includes("const galleryImages = product.images?.length ? product.images : [product.image];"),
      type: "product_detail_gallery_without_public_gate",
      reason:
        "La galerie ne doit pas etre construite depuis les images produit sans garde public.",
    },
  ];

  return checks.flatMap((check) =>
    check.ok
      ? []
      : [
          {
            file: "src/app/produit/[slug]/page.tsx",
            line: 1,
            type: check.type,
            reason: check.reason,
          },
        ],
  );
}

function markdownReport(summary) {
  const lines = [
    "# Audit surface visuelle publique",
    "",
    `Date: ${summary.checkedAt}`,
    `Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "## Resume",
    "",
    `- Sources controlees: ${summary.checkedSourceCount}`,
    `- Findings bloquants: ${summary.failureCount}`,
    `- Images stock externes detectees: ${summary.stockVisualFindingCount}`,
    `- Garde HeroCarousel: ${summary.heroGuardOk ? "OK" : "ECHEC"}`,
    `- Garde ProductCard HOLD: ${summary.productCardAirbagOk ? "OK" : "ECHEC"}`,
    `- Garde fiche produit HOLD: ${summary.productDetailImageGuardOk ? "OK" : "ECHEC"}`,
    "",
    "## Findings",
    "",
    ...(summary.failures.length
      ? summary.failures.map(
          (finding) =>
            `- ${finding.file}:${finding.line} - ${finding.type} - ${finding.reason}`,
        )
      : ["- Aucun"]),
    "",
    "## Garde-fous",
    "",
    ...Object.entries(summary.safety).map(([key, value]) => `- ${key}: ${value}`),
    "",
  ];

  return `${lines.join("\n")}\n`;
}

const sourceFailures = publicSourceRelativePaths.flatMap(sourceFindings);
const heroFailures = heroGuardFindings();
const productCardFailures = productCardAirbagFindings();
const productDetailFailures = productDetailImageGuardFindings();
const failures = [
  ...sourceFailures,
  ...heroFailures,
  ...productCardFailures,
  ...productDetailFailures,
];
const checkedAt = new Date().toISOString();

const summary = {
  ok: failures.length === 0,
  checkedAt,
  mode: "read_only_public_visual_ambiguity_audit",
  checkedSourceCount: publicSourceRelativePaths.length,
  failureCount: failures.length,
  stockVisualFindingCount: sourceFailures.length,
  heroGuardOk: heroFailures.length === 0,
  productCardAirbagOk: productCardFailures.length === 0,
  productDetailImageGuardOk: productDetailFailures.length === 0,
  failures,
  safety: {
    readOnlyAudit: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noImageGeneration: true,
  },
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `AUDIT_SURFACE_VISUELLE_PUBLIQUE_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_SURFACE_VISUELLE_PUBLIQUE_${dateKey}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      checkedSourceCount: summary.checkedSourceCount,
      failureCount: summary.failureCount,
      stockVisualFindingCount: summary.stockVisualFindingCount,
      heroGuardOk: summary.heroGuardOk,
      productCardAirbagOk: summary.productCardAirbagOk,
      productDetailImageGuardOk: summary.productDetailImageGuardOk,
      files: { jsonPath, mdPath },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

if (!summary.ok) {
  process.exitCode = 1;
}

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const catalogModulePath = path.join(root, "src", "lib", "catalog.ts");
const outputRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");

const hiddenRemoteToken = "cdn-fixture-hidden.example.invalid";
const hiddenSupplierCdnToken = "ae-pic-fixture-hidden.example.invalid";

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

async function importCatalogModule() {
  const source = fs.readFileSync(catalogModulePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2020,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: catalogModulePath,
  }).outputText;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`;

  return import(dataUrl);
}

function makeHiddenRemoteImage(fileName) {
  return ["https:", "", hiddenRemoteToken, fileName].join("/");
}

function makeHiddenSupplierCdnImage(fileName) {
  return ["https:", "", hiddenSupplierCdnToken, "kf", fileName].join("/");
}

function baseProduct(overrides = {}) {
  const image = overrides.image ?? "/uploads/partner-products/fixture-exact.webp";
  const images = overrides.images ?? [image];

  return {
    id: "fixture-public-image-contract",
    slug: "fixture-public-image-contract",
    name: "Fixture contrat image publique",
    categoryId: "dropshipping-accessoires",
    price: 2490,
    condition: "Neuf",
    stock: 12,
    badge: "Partenaire",
    image,
    images,
    shortDescription: "Fixture locale pour contrat image publique.",
    description: "Produit fictif utilise uniquement pour verifier les blocages image.",
    features: ["Fixture image publique", "Aucune publication reelle"],
    source: "internal",
    status: "published",
    dropshipping: {
      enabled: true,
      supplierName: "Partenaire fixture",
      supplierUrl: "exact-product-proof-fixture",
      supplierSku: "FIXTURE-IMG-001",
      supplierPriceCents: 1000,
      salePriceCents: 2490,
      marginCents: 1490,
      supplierStock: 50,
      deliveryEstimate: "3-5 jours France",
      validationGate: {
        source: "fixture",
        checkedAt: "2026-06-12",
        checks: ["ready", "validated"],
        note: "validated ready",
      },
    },
    imageValidation: {
      status: "verified_source_images",
      checkedAt: "2026-06-12",
      imageCount: images.length,
      reason: "Fixture locale exacte.",
      nextAction: "Aucune action reelle.",
    },
    sourceVerification: {
      status: "ready",
      checkedAt: "2026-06-12",
      deliveryStatus: "ready",
      priceStatus: "ready",
      rightsStatus: "ready",
    },
    internalSourcing: {
      validationStatus: "validated",
    },
    seo: {
      title: "Fixture contrat image publique",
      description: "Fixture locale.",
      imageAlt: "Fixture image exacte",
    },
    imageAlt: "Fixture image exacte",
    ...overrides,
  };
}

function includesAll(actual, expected) {
  return expected.every((item) => actual.includes(item));
}

function markdown(summary) {
  const rows = summary.scenarios.map(
    (scenario) =>
      `| ${scenario.ok ? "OK" : "ECHEC"} | ${scenario.name} | ${scenario.imageKind} | ${scenario.actualPublic ? "public" : "HOLD"} | ${scenario.actualImageBlockers.join(", ") || "aucun"} |`,
  );

  return `${[
    "# Maxi Trouvailles - Test fixtures contrat image publique",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Resultat",
    "",
    `- Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    `- Scenarios: ${summary.scenarios.length}`,
    `- Echecs: ${summary.failureCount}`,
    `- Fuites sensibles detectees: ${summary.sensitiveExportCheck.failureCount}`,
    "",
    "## Scenarios",
    "",
    "| Statut | Scenario | Image fixture | Resultat public | Blockers image |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    "## Garde-fous",
    "",
    "- Fixtures en memoire uniquement.",
    "- Aucun produit reel lu ou modifie.",
    "- Aucune image telechargee.",
    "- Aucun paiement.",
    "- Aucune commande fournisseur.",
    "- Aucune publication.",
    "- Les URLs distantes de fixture ne sont pas exportees.",
    "",
  ].join("\n")}\n`;
}

const scenarios = [
  {
    name: "partner_webp_exact_is_public_ready",
    imageKind: "partner-webp",
    product: baseProduct(),
    expectedImageBlockers: [],
    expectedPublicBlockers: [],
    expectedPublic: true,
  },
  {
    name: "quick_product_webp_exact_is_public_ready",
    imageKind: "quick-webp",
    product: baseProduct({
      image: "/uploads/quick-products/fixture-exact.webp",
      images: ["/uploads/quick-products/fixture-exact.webp"],
    }),
    expectedImageBlockers: [],
    expectedPublicBlockers: [],
    expectedPublic: true,
  },
  {
    name: "remote_image_blocks_public",
    imageKind: "remote-redacted",
    product: baseProduct({
      image: makeHiddenRemoteImage("item.jpg"),
      images: [makeHiddenRemoteImage("item.jpg")],
    }),
    expectedImageBlockers: [
      "image_remote_not_local",
      "image_not_in_exact_product_depot",
      "image_not_webp",
    ],
    expectedPublicBlockers: ["image_remote_not_local"],
    expectedPublic: false,
  },
  {
    name: "supplier_cdn_image_blocks_public",
    imageKind: "supplier-cdn-redacted",
    product: baseProduct({
      image: makeHiddenSupplierCdnImage("item.webp"),
      images: [makeHiddenSupplierCdnImage("item.webp")],
    }),
    expectedImageBlockers: [
      "image_remote_not_local",
      "supplier_cdn_image",
      "image_not_in_exact_product_depot",
    ],
    expectedPublicBlockers: ["supplier_cdn_image"],
    expectedPublic: false,
  },
  {
    name: "category_image_blocks_product_public",
    imageKind: "category-webp",
    product: baseProduct({
      image: "/uploads/category-images/accessoires.webp",
      images: ["/uploads/category-images/accessoires.webp"],
    }),
    expectedImageBlockers: [
      "image_not_exact_product_photo",
      "image_not_in_exact_product_depot",
    ],
    expectedPublicBlockers: ["image_not_exact_product_photo"],
    expectedPublic: false,
  },
  {
    name: "generated_product_image_blocks_public",
    imageKind: "generated-webp",
    product: baseProduct({
      image: "/uploads/generated-products/fixture.webp",
      images: ["/uploads/generated-products/fixture.webp"],
    }),
    expectedImageBlockers: [
      "image_not_exact_product_photo",
      "image_not_in_exact_product_depot",
    ],
    expectedPublicBlockers: ["image_not_exact_product_photo"],
    expectedPublic: false,
  },
  {
    name: "placeholder_image_blocks_public",
    imageKind: "placeholder-webp",
    product: baseProduct({
      image: "/uploads/partner-products/placeholder.webp",
      images: ["/uploads/partner-products/placeholder.webp"],
    }),
    expectedImageBlockers: ["placeholder_or_hold_image"],
    expectedPublicBlockers: ["placeholder_or_hold_image"],
    expectedPublic: false,
  },
  {
    name: "non_webp_product_image_blocks_public",
    imageKind: "partner-jpg",
    product: baseProduct({
      image: "/uploads/partner-products/fixture-exact.jpg",
      images: ["/uploads/partner-products/fixture-exact.jpg"],
    }),
    expectedImageBlockers: ["image_not_webp"],
    expectedPublicBlockers: ["image_not_webp"],
    expectedPublic: false,
  },
  {
    name: "gallery_category_image_blocks_public_even_if_main_is_exact",
    imageKind: "gallery-mixed",
    product: baseProduct({
      image: "/uploads/partner-products/fixture-exact.webp",
      images: [
        "/uploads/partner-products/fixture-exact.webp",
        "/uploads/category-images/accessoires.webp",
      ],
    }),
    expectedImageBlockers: [
      "image_not_exact_product_photo",
      "image_not_in_exact_product_depot",
    ],
    expectedPublicBlockers: ["image_not_exact_product_photo"],
    expectedPublic: false,
  },
  {
    name: "image_validation_hold_blocks_public_even_with_local_webp",
    imageKind: "validation-hold",
    product: baseProduct({
      imageValidation: {
        status: "hold_public_image_not_exact",
        checkedAt: "2026-06-12",
        imageCount: 1,
      },
    }),
    expectedImageBlockers: [],
    expectedPublicBlockers: ["exact_images_not_verified"],
    expectedPublic: false,
  },
];

const catalog = await importCatalogModule();
const scenarioResults = scenarios.map((scenario) => {
  const actualImageBlockers = catalog.getPublicImageBlockers(scenario.product);
  const actualPublicBlockers = catalog.getDropshippingPublicBlockers(scenario.product);
  const actualPublic = catalog.isPublicProduct(scenario.product);
  const ok =
    includesAll(actualImageBlockers, scenario.expectedImageBlockers) &&
    includesAll(actualPublicBlockers, scenario.expectedPublicBlockers) &&
    actualPublic === scenario.expectedPublic &&
    (scenario.expectedImageBlockers.length > 0 || actualImageBlockers.length === 0);

  return {
    name: scenario.name,
    imageKind: scenario.imageKind,
    ok,
    expectedImageBlockers: scenario.expectedImageBlockers,
    actualImageBlockers,
    expectedPublicBlockers: scenario.expectedPublicBlockers,
    actualPublicBlockers,
    expectedPublic: scenario.expectedPublic,
    actualPublic,
  };
});

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(outputRoot, `public-image-contract-fixtures-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: false,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "fixture_only_public_image_contract",
  source: path.relative(root, catalogModulePath).replace(/\\/g, "/"),
  scenarioCount: scenarioResults.length,
  failureCount: scenarioResults.filter((scenario) => !scenario.ok).length,
  scenarios: scenarioResults,
  sensitiveExportCheck: {
    ok: false,
    failureCount: 0,
    failureLabels: [],
  },
  safety: {
    fixtureOnly: true,
    noRealProductsRead: true,
    noCatalogWrite: true,
    noImageDownload: true,
    noPayment: true,
    noSupplierOrder: true,
    noPublication: true,
    noExternalApiCall: true,
  },
};

const firstMarkdown = markdown(summary);
const firstExportText = `${JSON.stringify(summary, null, 2)}\n${firstMarkdown}`;
const sensitiveSignals = [
  { label: "hidden remote token", value: hiddenRemoteToken },
  { label: "hidden supplier cdn token", value: hiddenSupplierCdnToken },
  { label: "remote protocol", value: "http" + "://" },
  { label: "marketplace marker", value: "aliexpress" },
  { label: "supplier field name", value: "supplierUrl" },
  { label: "source url field name", value: "sourceUrl" },
  { label: "product url field name", value: "productUrl" },
];
const leakedSignals = sensitiveSignals.filter((signal) =>
  firstExportText.toLowerCase().includes(signal.value.toLowerCase()),
);
summary.sensitiveExportCheck = {
  ok: leakedSignals.length === 0,
  failureCount: leakedSignals.length,
  failureLabels: leakedSignals.map((signal) => signal.label),
};
summary.ok = summary.failureCount === 0 && summary.sensitiveExportCheck.ok;

const jsonPath = path.join(outputDir, `TEST_PUBLIC_IMAGE_CONTRACT_FIXTURES_${dateKey}.json`);
const mdPath = path.join(outputDir, `TEST_PUBLIC_IMAGE_CONTRACT_FIXTURES_${dateKey}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      scenarioCount: summary.scenarioCount,
      failureCount: summary.failureCount,
      sensitiveExportOk: summary.sensitiveExportCheck.ok,
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

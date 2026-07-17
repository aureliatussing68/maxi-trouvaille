import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const catalogPath = path.join(root, "src", "lib", "catalog.ts");
const quickProductsPath = path.join(root, "data", "quick-products.json");
const outputDir = path.join(root, "business-maxi-trouvailles", "file-validation-fournisseurs");
const topArg = process.argv.find((arg) => arg.startsWith("--top="));
const topLimit = topArg ? Math.max(1, Number(topArg.split("=")[1]) || 15) : 15;

const laneOrder = [
  "lane_0_static_partner_decision",
  "lane_1_fast_supplier_validation",
  "lane_2_delivery_price_rights",
  "lane_3_supplier_recheck",
  "lane_4_quality_or_risk_review",
];

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(readFile(filePath));
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function findMatching(source, startIndex, openChar, closeChar) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === openChar) {
      depth += 1;
    } else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  throw new Error(`No matching ${closeChar} found.`);
}

function extractProductsArray(source) {
  const markerIndex = source.indexOf("export const products");
  if (markerIndex === -1) {
    throw new Error("Cannot find `export const products` in src/lib/catalog.ts.");
  }

  const assignmentIndex = source.indexOf("=", markerIndex);
  if (assignmentIndex === -1) {
    throw new Error("Cannot find products assignment in src/lib/catalog.ts.");
  }

  const arrayStart = source.indexOf("[", assignmentIndex);
  const arrayEnd = findMatching(source, arrayStart, "[", "]");
  return source.slice(arrayStart + 1, arrayEnd);
}

function extractTopLevelObjects(arraySource) {
  const objects = [];
  let quote = null;
  let escaped = false;
  let depth = 0;
  let objectStart = -1;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < arraySource.length; index += 1) {
    const char = arraySource[index];
    const next = arraySource[index + 1];

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        objectStart = index;
      }
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0 && objectStart !== -1) {
        objects.push(arraySource.slice(objectStart, index + 1));
        objectStart = -1;
      }
    }
  }

  return objects;
}

function stringProp(block, prop) {
  const match = block.match(new RegExp(`${prop}:\\s*["'\`]([^"'\`]+)["'\`]`, "s"));
  return match?.[1] ?? "";
}

function numberProp(block, prop) {
  const match = block.match(new RegExp(`${prop}:\\s*(\\d+)`));
  return match ? Number(match[1]) : 0;
}

function arrayPropLength(block, prop) {
  const propIndex = block.indexOf(`${prop}:`);
  if (propIndex === -1) {
    return 0;
  }

  const arrayStart = block.indexOf("[", propIndex);
  if (arrayStart === -1) {
    return 0;
  }

  const arrayEnd = findMatching(block, arrayStart, "[", "]");
  const arrayBody = block.slice(arrayStart + 1, arrayEnd);
  return [...arrayBody.matchAll(/["'`]([^"'`]+)["'`]/g)].length;
}

function staticProductsFromCatalog() {
  const source = readFile(catalogPath);
  const arraySource = extractProductsArray(source);
  const blocks = extractTopLevelObjects(arraySource);

  return blocks.map((block) => ({
    origin: "src/lib/catalog.ts",
    id: stringProp(block, "id"),
    slug: stringProp(block, "slug"),
    name: stringProp(block, "name"),
    categoryId: stringProp(block, "categoryId"),
    status: stringProp(block, "status") || "published",
    stock: numberProp(block, "stock"),
    price: numberProp(block, "price"),
    shortDescription: stringProp(block, "shortDescription"),
    image: stringProp(block, "image"),
    imageCount: arrayPropLength(block, "images"),
    dropshipping: {
      enabled: /dropshipping:\s*{[\s\S]*?enabled:\s*true/.test(block),
      supplierName: stringProp(block, "supplierName"),
      supplierUrl: stringProp(block, "supplierUrl"),
      supplierSku: stringProp(block, "supplierSku"),
      supplierPriceCents: numberProp(block, "supplierPriceCents"),
      salePriceCents: numberProp(block, "salePriceCents"),
      marginCents: numberProp(block, "marginCents"),
      supplierStock: numberProp(block, "supplierStock"),
      deliveryEstimate: stringProp(block, "deliveryEstimate"),
      validationGate: /validationGate:\s*{/.test(block)
        ? {
            note: stringProp(block, "note"),
          }
        : undefined,
    },
    imageValidation: undefined,
    internalSourcing: undefined,
    sourceVerification: undefined,
  }));
}

function quickProductsFromData() {
  const products = readJson(quickProductsPath, []);
  if (!Array.isArray(products)) {
    throw new Error("data/quick-products.json must contain an array.");
  }

  return products.map((product) => ({
    origin: "data/quick-products.json",
    id: product.id,
    slug: product.slug,
    name: product.name,
    categoryId: product.categoryId,
    status: product.status ?? "published",
    stock: Number(product.stock ?? 0),
    price: Number(product.price ?? 0),
    shortDescription: product.shortDescription ?? "",
    image: product.image ?? "",
    imageCount: Array.isArray(product.images) ? product.images.length : 0,
    dropshipping: product.dropshipping ?? {},
    imageValidation: product.imageValidation,
    internalSourcing: product.internalSourcing,
    sourceVerification: product.sourceVerification,
  }));
}

function isPartnerProduct(product) {
  return Boolean(
    product.dropshipping?.enabled ||
      String(product.categoryId ?? "").startsWith("dropshipping-"),
  );
}

function hasExactSupplierUrl(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return false;
  }

  return !(
    normalized.includes("wholesale?") ||
    normalized.includes("searchtext=") ||
    normalized.includes("/w/wholesale-")
  );
}

function hasHoldSignal(product) {
  return (
    normalizeText(product.internalSourcing?.validationStatus).includes("hold") ||
    normalizeText(product.dropshipping?.validationGate?.note).includes("hold")
  );
}

function needsManualDeliveryProof(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return true;
  }

  return (
    normalized.includes("verifier") ||
    normalized.includes("confirmer") ||
    normalized.includes("estime") ||
    normalized.includes("valider")
  );
}

function marginPercent(product) {
  const sale = Number(product.dropshipping?.salePriceCents ?? product.price ?? 0);
  const supplier = Number(product.dropshipping?.supplierPriceCents ?? 0);
  if (!sale || !supplier) {
    return null;
  }

  return Math.round(((sale - supplier) / sale) * 100);
}

function riskFlags(product) {
  const text = normalizeText(
    [product.name, product.categoryId, product.shortDescription].join(" "),
  );
  const flags = [];

  if (text.includes("enfant") || text.includes("bebe") || text.includes("jouet")) {
    flags.push("controle_securite_enfant");
  }

  if (
    text.includes("usb") ||
    text.includes("led") ||
    text.includes("batterie") ||
    text.includes("rechargeable") ||
    text.includes("240w")
  ) {
    flags.push("controle_electrique_ou_batterie");
  }

  if (text.includes("beaute") || text.includes("barbe") || text.includes("cheveux")) {
    flags.push("controle_hygiene_beaute");
  }

  if (text.includes("auto") || text.includes("voiture")) {
    flags.push("controle_usage_auto");
  }

  if (text.includes("chat") || text.includes("chien") || text.includes("animaux")) {
    flags.push("controle_confort_animal");
  }

  if (
    text.includes("cuisson") ||
    text.includes("gourde") ||
    text.includes("gamelle") ||
    text.includes("silicone")
  ) {
    flags.push("controle_matiere_contact");
  }

  return [...new Set(flags)];
}

function evidenceGaps(product) {
  const gaps = [];
  const dropshipping = product.dropshipping ?? {};

  if (product.origin === "src/lib/catalog.ts") {
    gaps.push("decision_garder_remplacer_ou_retirer");
  }

  if (!hasExactSupplierUrl(dropshipping.supplierUrl)) {
    gaps.push("lien_fournisseur_exact");
  }

  if (!dropshipping.supplierSku) {
    gaps.push("sku_fournisseur");
  }

  if (!(dropshipping.supplierPriceCents > 0)) {
    gaps.push("prix_fournisseur");
  }

  if (!(Number(dropshipping.supplierStock ?? product.stock ?? 0) > 0)) {
    gaps.push("stock_fournisseur");
  }

  if (needsManualDeliveryProof(dropshipping.deliveryEstimate)) {
    gaps.push("preuve_delai_france_europe");
  }

  if (product.imageValidation?.status !== "verified_source_images") {
    gaps.push("images_exactes_et_droits");
  }

  if (product.sourceVerification?.rightsStatus === "hold") {
    gaps.push("droits_images");
  }

  if (product.sourceVerification?.priceStatus === "hold") {
    gaps.push("preuve_prix");
  }

  if (product.sourceVerification?.deliveryStatus === "hold") {
    gaps.push("preuve_livraison");
  }

  if (!hasHoldSignal(product)) {
    gaps.push("note_hold");
  }

  return [...new Set(gaps)];
}

function laneFor(product, gaps, flags) {
  if (product.origin === "src/lib/catalog.ts") {
    return "lane_0_static_partner_decision";
  }

  if (
    gaps.every((gap) =>
      [
        "preuve_delai_france_europe",
        "preuve_prix",
        "preuve_livraison",
        "droits_images",
      ].includes(gap),
    ) &&
    flags.length <= 1
  ) {
    return "lane_1_fast_supplier_validation";
  }

  if (
    gaps.includes("preuve_delai_france_europe") ||
    gaps.includes("preuve_prix") ||
    gaps.includes("preuve_livraison") ||
    gaps.includes("droits_images")
  ) {
    return "lane_2_delivery_price_rights";
  }

  if (gaps.includes("lien_fournisseur_exact") || gaps.includes("sku_fournisseur")) {
    return "lane_3_supplier_recheck";
  }

  return "lane_4_quality_or_risk_review";
}

function scoreProduct(product, gaps, flags) {
  const margin = marginPercent(product);
  const stock = Number(product.dropshipping?.supplierStock ?? product.stock ?? 0);
  let score = product.origin === "src/lib/catalog.ts" ? 120 : 100;

  score -= gaps.length * 7;
  score -= flags.length * 3;

  if (margin !== null && margin >= 40) {
    score += 10;
  } else if (margin !== null && margin >= 30) {
    score += 5;
  }

  if (stock >= 80) {
    score += 7;
  } else if (stock >= 30) {
    score += 4;
  }

  if (product.imageValidation?.status === "verified_source_images") {
    score += 8;
  }

  if (product.imageCount >= 4) {
    score += 3;
  }

  return Math.max(0, score);
}

function toQueueItem(product) {
  const gaps = evidenceGaps(product);
  const flags = riskFlags(product);
  const lane = laneFor(product, gaps, flags);
  const margin = marginPercent(product);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    origin: product.origin,
    status: product.status,
    categoryId: product.categoryId,
    lane,
    priorityScore: scoreProduct(product, gaps, flags),
    marginPercent: margin,
    supplierUrl: product.dropshipping?.supplierUrl ?? "",
    supplierUrlExactEnough: hasExactSupplierUrl(product.dropshipping?.supplierUrl),
    supplierSku: product.dropshipping?.supplierSku ?? "",
    supplierPriceCents: product.dropshipping?.supplierPriceCents ?? null,
    salePriceCents: product.dropshipping?.salePriceCents ?? product.price ?? null,
    supplierStock: product.dropshipping?.supplierStock ?? product.stock ?? null,
    deliveryEstimate: product.dropshipping?.deliveryEstimate ?? "",
    imageValidation: product.imageValidation?.status ?? "absent",
    imageCount: product.imageCount,
    holdSignalPresent: hasHoldSignal(product),
    riskFlags: flags,
    evidenceGaps: gaps,
    nextDecision:
      product.origin === "src/lib/catalog.ts"
        ? "Decider si on prouve, remplace ou retire cette fiche statique."
        : "Completer les preuves manquantes avant toute publication.",
    publicationStatus: "HOLD",
  };
}

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function csv(items) {
  const headers = [
    "priorityScore",
    "lane",
    "name",
    "origin",
    "categoryId",
    "marginPercent",
    "supplierUrlExactEnough",
    "supplierSku",
    "deliveryEstimate",
    "imageValidation",
    "evidenceGaps",
    "riskFlags",
    "nextDecision",
  ];

  return `${headers.join(",")}\n${items
    .map((item) => headers.map((header) => csvEscape(item[header])).join(","))
    .join("\n")}\n`;
}

function validationTemplate(items) {
  return {
    generatedAt: new Date().toISOString(),
    instructions:
      "Remplir uniquement avec des preuves reelles. Ne jamais utiliser de faux identifiants ou de valeurs inventees.",
    products: items.map((item) => ({
      id: item.id,
      name: item.name,
      origin: item.origin,
      lane: item.lane,
      currentSupplierUrl: item.supplierUrl,
      evidenceGaps: item.evidenceGaps,
      fill: {
        decision: "",
        exactSupplierProductUrl: "",
        supplierSellerName: "",
        supplierSku: "",
        supplierPriceCents: null,
        supplierStock: null,
        deliveryFranceEuropeProof: "",
        deliveryEstimateForCustomer: "",
        variantToSell: "",
        imagesMatchExactVariant: false,
        imageRightsProof: "",
        finalSalePriceCents: null,
        notes: "",
      },
    })),
  };
}

function markdown(summary) {
  const lines = [
    "# File validation tous partenaires - Maxi Trouvaille",
    "",
    `Date: ${summary.generatedAt}`,
    "",
    "## Synthese",
    "",
    `- Produits partenaires analyses: ${summary.partnerProductCount}`,
    `- Produits en HOLD: ${summary.holdCount}`,
    `- Produits statiques a decider: ${summary.staticPartnerCount}`,
    `- Top prioritaire: ${summary.topQueue.length}`,
    "",
    "## Files",
    "",
    ...Object.entries(summary.byLane).map(([lane, count]) => `- ${lane}: ${count}`),
    "",
    "## Top prioritaire",
    "",
    "| # | Produit | Origine | File | Score | Preuves manquantes |",
    "|---|---|---|---|---:|---|",
    ...summary.topQueue.map((item, index) =>
      [
        `| ${index + 1}`,
        item.name,
        item.origin,
        item.lane,
        item.priorityScore,
        `${item.evidenceGaps.join(", ")} |`,
      ].join(" | "),
    ),
    "",
    "## Preuves manquantes globales",
    "",
    ...Object.entries(summary.byEvidenceGap).map(([gap, count]) => `- ${gap}: ${count}`),
    "",
    "## Regle",
    "",
    "Chaque fiche reste en HOLD tant que fournisseur exact, SKU, prix, stock, delai, variante, images exactes et droits images ne sont pas prouves.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

const allProducts = [...staticProductsFromCatalog(), ...quickProductsFromData()];
const partnerProducts = allProducts.filter(isPartnerProduct);
const queue = partnerProducts
  .map(toQueueItem)
  .sort((a, b) => {
    const laneDiff = laneOrder.indexOf(a.lane) - laneOrder.indexOf(b.lane);
    if (laneDiff !== 0) {
      return laneDiff;
    }

    return b.priorityScore - a.priorityScore || a.name.localeCompare(b.name, "fr");
  });
const topQueue = queue.slice(0, topLimit);
const generatedAt = new Date().toISOString();
const dateKey = generatedAt.slice(0, 10).replace(/-/g, "");
const summary = {
  ok: true,
  generatedAt,
  mode: "read_only_all_partner_validation_queue",
  partnerProductCount: queue.length,
  holdCount: queue.filter((item) => item.status === "draft").length,
  staticPartnerCount: queue.filter((item) => item.origin === "src/lib/catalog.ts").length,
  topLimit,
  byLane: countBy(queue, (item) => item.lane),
  byOrigin: countBy(queue, (item) => item.origin),
  byCategory: countBy(queue, (item) => item.categoryId),
  byEvidenceGap: countBy(queue.flatMap((item) => item.evidenceGaps), (gap) => gap),
  byRiskFlag: countBy(queue.flatMap((item) => item.riskFlags), (flag) => flag),
  topQueue,
  queue,
  safety: {
    readOnlyQueue: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `QUEUE_VALIDATION_TOUS_PARTENAIRES_${dateKey}.json`);
const mdPath = path.join(outputDir, `QUEUE_VALIDATION_TOUS_PARTENAIRES_${dateKey}.md`);
const csvPath = path.join(outputDir, `QUEUE_VALIDATION_TOUS_PARTENAIRES_${dateKey}.csv`);
const templatePath = path.join(outputDir, `TEMPLATE_PREUVES_TOUS_PARTENAIRES_${dateKey}.json`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(queue), "utf8");
fs.writeFileSync(templatePath, `${JSON.stringify(validationTemplate(topQueue), null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      partnerProductCount: summary.partnerProductCount,
      holdCount: summary.holdCount,
      staticPartnerCount: summary.staticPartnerCount,
      byLane: summary.byLane,
      topQueue: summary.topQueue.map((item) => ({
        id: item.id,
        name: item.name,
        lane: item.lane,
        priorityScore: item.priorityScore,
        evidenceGaps: item.evidenceGaps,
      })),
      files: { jsonPath, mdPath, csvPath, templatePath },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const BUSINESS = path.join(ROOT, "business-maxi-trouvailles");

const DIRS = {
  candidates: path.join(BUSINESS, "produits-a-valider"),
  validated: path.join(BUSINESS, "produits-valides"),
  sheets: path.join(BUSINESS, "fiches-produits"),
  exports: path.join(BUSINESS, "exports-publicites"),
  tiktok: path.join(BUSINESS, "exports-publicites", "tiktok"),
  instagram: path.join(BUSINESS, "exports-publicites", "instagram"),
  snapchat: path.join(BUSINESS, "exports-publicites", "snapchat"),
  exportImages: path.join(BUSINESS, "exports-publicites", "images"),
  exportVideos: path.join(BUSINESS, "exports-publicites", "videos"),
  exportScripts: path.join(BUSINESS, "exports-publicites", "scripts"),
  productImages: path.join(BUSINESS, "images-produits"),
  productVideos: path.join(BUSINESS, "videos-produits"),
  logs: path.join(BUSINESS, "logs"),
};

const BLOCKED_KEYWORDS = [
  "nike",
  "adidas",
  "apple",
  "iphone",
  "airpods",
  "lego",
  "disney",
  "pokemon",
  "medicament",
  "complement alimentaire",
  "cosmetique",
  "batterie lithium",
  "laser puissant",
  "arme",
  "couteau",
  "surveillance cachee",
];

const SEED_PRODUCTS = [
  {
    name: "Lampe LED rechargeable magnetique pour bureau",
    supplierPriceCents: 790,
    supplier: "Fournisseur Europe a verifier",
    sourceUrl: "manual://demo/lampe-led-rechargeable",
    delivery: "Europe 5 a 9 jours apres verification fournisseur",
    rating: 4.7,
    visualScore: 9,
    category: "maison",
    idea: "Avant/apres bureau sombre puis eclairage magnetique en 2 secondes.",
  },
  {
    name: "Organisateur de cables de voyage compact",
    supplierPriceCents: 390,
    supplier: "Fournisseur Europe a verifier",
    sourceUrl: "manual://demo/organisateur-cables",
    delivery: "Europe 4 a 8 jours apres verification fournisseur",
    rating: 4.6,
    visualScore: 8,
    category: "accessoires",
    idea: "Sac fouillis contre pochette rangee nette.",
  },
  {
    name: "Mini aspirateur sans fil pour voiture",
    supplierPriceCents: 1290,
    supplier: "Fournisseur Europe a verifier",
    sourceUrl: "manual://demo/mini-aspirateur-voiture",
    delivery: "Europe 6 a 10 jours apres verification fournisseur",
    rating: 4.5,
    visualScore: 9,
    category: "auto-moto",
    idea: "Test miettes siege auto en plan serre.",
  },
  {
    name: "Support telephone voiture rotation 360",
    supplierPriceCents: 420,
    supplier: "Fournisseur Europe a verifier",
    sourceUrl: "manual://demo/support-telephone-voiture",
    delivery: "Europe 5 a 8 jours apres verification fournisseur",
    rating: 4.6,
    visualScore: 7,
    category: "telephonie",
    idea: "Clip, rotation, conduite mains libres en 3 plans.",
  },
  {
    name: "Brosse anti-poils reutilisable pour animaux",
    supplierPriceCents: 560,
    supplier: "Fournisseur Europe a verifier",
    sourceUrl: "manual://demo/brosse-anti-poils",
    delivery: "Europe 5 a 9 jours apres verification fournisseur",
    rating: 4.8,
    visualScore: 9,
    category: "animaux",
    idea: "Canape plein de poils puis passage rapide.",
  },
  {
    name: "Mini humidificateur USB decoratif",
    supplierPriceCents: 690,
    supplier: "Fournisseur Europe a verifier",
    sourceUrl: "manual://demo/mini-humidificateur",
    delivery: "Europe 6 a 10 jours apres verification fournisseur",
    rating: 4.4,
    visualScore: 8,
    category: "maison",
    idea: "Setup bureau, vapeur douce, lumiere ambiance.",
  },
  {
    name: "Kit embouts tournevis precision 24 pieces",
    supplierPriceCents: 650,
    supplier: "Fournisseur Europe a verifier",
    sourceUrl: "manual://demo/kit-tournevis-precision",
    delivery: "Europe 5 a 9 jours apres verification fournisseur",
    rating: 4.7,
    visualScore: 7,
    category: "outillage",
    idea: "Reparer telecommande, lunettes, petit appareil.",
  },
  {
    name: "Sac de rangement compressible pour valise",
    supplierPriceCents: 480,
    supplier: "Fournisseur Europe a verifier",
    sourceUrl: "manual://demo/sac-rangement-valise",
    delivery: "Europe 4 a 8 jours apres verification fournisseur",
    rating: 4.6,
    visualScore: 8,
    category: "accessoires",
    idea: "Valise qui ne ferme pas puis rangement compresse.",
  },
  {
    name: "Veilleuse detecteur de mouvement pour placard",
    supplierPriceCents: 520,
    supplier: "Fournisseur Europe a verifier",
    sourceUrl: "manual://demo/veilleuse-detecteur",
    delivery: "Europe 5 a 9 jours apres verification fournisseur",
    rating: 4.5,
    visualScore: 8,
    category: "electricite",
    idea: "Ouverture placard sombre puis lumiere automatique.",
  },
  {
    name: "Filtre douche economiseur avec jet reglable",
    supplierPriceCents: 890,
    supplier: "Fournisseur Europe a verifier",
    sourceUrl: "manual://demo/filtre-douche",
    delivery: "Europe 6 a 10 jours apres verification fournisseur",
    rating: 4.4,
    visualScore: 7,
    category: "maison",
    idea: "Jet avant/apres et promesse simple sans allegation sante.",
  },
];

function ensureDirs() {
  for (const dir of Object.values(DIRS)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "_");
}

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 72) || "produit";
}

function money(cents) {
  return `${(Math.round(cents) / 100).toFixed(2).replace(".", ",")} €`;
}

function roundPsychological(cents) {
  const euros = Math.max(1, Math.floor(cents / 100));
  let rounded = euros * 100 + 90;
  if (rounded < cents) rounded += 100;
  return rounded;
}

function calculatePrice(supplierPriceCents) {
  const base = Math.max(0, Number(supplierPriceCents) || 0);
  const salePriceCents = roundPsychological(Math.max(base * 2.25, base + 900));
  const crossedPriceCents = roundPsychological(salePriceCents * 1.35);
  return {
    supplierPriceCents: base,
    salePriceCents,
    crossedPriceCents,
    estimatedMarginCents: Math.max(0, salePriceCents - base),
    marginRate: base > 0 ? Number(((salePriceCents - base) / salePriceCents).toFixed(2)) : 0,
  };
}

function riskFor(product) {
  const title = product.name.toLowerCase();
  const blocked = BLOCKED_KEYWORDS.filter((keyword) => title.includes(keyword));
  const flags = [];
  if (blocked.length) flags.push(`mot-cle bloque: ${blocked.join(", ")}`);
  if (product.rating < 4.4) flags.push("note fournisseur trop faible");
  if (product.visualScore < 7) flags.push("potentiel visuel TikTok moyen");
  if (!/europe/i.test(product.delivery)) flags.push("livraison Europe non confirmee");
  return {
    level: flags.length ? "moyen" : "faible",
    flags,
    allowedForDraft: blocked.length === 0,
  };
}

function scoreProduct(product, price) {
  const marginScore = Math.min(30, Math.round(price.marginRate * 40));
  return Math.min(100, product.visualScore * 7 + Math.round(product.rating * 5) + marginScore);
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function log(action, detail) {
  ensureDirs();
  fs.appendFileSync(
    path.join(DIRS.logs, "business_pipeline.log"),
    `[${new Date().toISOString()}] ${action} ${detail ?? ""}\n`,
    "utf8",
  );
}

function makeCandidate(product, index) {
  const pricing = calculatePrice(product.supplierPriceCents);
  const risk = riskFor(product);
  return {
    id: `candidate_${Date.now()}_${index}`,
    status: "a_valider",
    publicationStatus: "not_published",
    name: product.name,
    category: product.category,
    supplierPrice: money(pricing.supplierPriceCents),
    supplierPriceCents: pricing.supplierPriceCents,
    salePrice: money(pricing.salePriceCents),
    salePriceCents: pricing.salePriceCents,
    crossedPrice: money(pricing.crossedPriceCents),
    crossedPriceCents: pricing.crossedPriceCents,
    estimatedMargin: money(pricing.estimatedMarginCents),
    marginRate: pricing.marginRate,
    deliveryEstimate: product.delivery,
    supplier: product.supplier,
    sourceUrl: product.sourceUrl,
    rating: product.rating,
    visualScore: product.visualScore,
    riskLevel: risk.level,
    riskFlags: risk.flags,
    allowedForDraft: risk.allowedForDraft,
    adIdea: product.idea,
    score: scoreProduct(product, pricing),
    validationRequired: true,
    notes: [
      "Verifier le lien fournisseur reel avant publication.",
      "Verifier conformite, delai livraison et retours.",
      "Ne pas publier sans validation humaine.",
    ],
  };
}

function searchProducts(count = 10) {
  ensureDirs();
  const candidates = SEED_PRODUCTS.map(makeCandidate)
    .filter((candidate) => candidate.allowedForDraft)
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
  const output = {
    generatedAt: new Date().toISOString(),
    mode: "demo_local_no_scraping",
    warning: "Liste de demonstration. Brancher une API/source valide avant sourcing reel.",
    candidates,
  };
  const file = path.join(DIRS.candidates, `${stamp()}_candidats_produits.json`);
  writeJson(file, output);
  writeJson(path.join(DIRS.candidates, "latest_candidates.json"), output);
  log("search-products", file);
  return { file, count: candidates.length, candidates };
}

function pickLatestCandidate() {
  const latest = path.join(DIRS.candidates, "latest_candidates.json");
  if (!fs.existsSync(latest)) {
    return searchProducts(10).candidates[0];
  }
  const data = JSON.parse(fs.readFileSync(latest, "utf8"));
  return data.candidates?.[0];
}

function productSheet(candidate = pickLatestCandidate()) {
  if (!candidate) throw new Error("Aucun candidat produit disponible.");
  const slug = slugify(candidate.name);
  const benefits = [
    "Produit facile a comprendre en video courte.",
    "Prix psychologique adapte a une offre promo.",
    "Format utile au quotidien.",
  ];
  const features = [
    `Categorie conseillee : ${candidate.category}`,
    `Prix fournisseur estime : ${candidate.supplierPrice}`,
    `Livraison : ${candidate.deliveryEstimate}`,
    `Source : ${candidate.supplier}`,
  ];
  return {
    id: `draft_${Date.now()}_${slug}`,
    sourceCandidateId: candidate.id,
    status: "brouillon_validation_humaine",
    publicationStatus: "not_published",
    title: candidate.name,
    slug,
    category: candidate.category,
    shortDescription: `${candidate.name} selectionne pour une offre Maxi Trouvailles a verifier avant publication.`,
    longDescription: [
      `${candidate.name} est une idee produit preparee pour Maxi Trouvailles.`,
      "Cette fiche est un brouillon : le fournisseur, la conformite, le stock, le delai de livraison et les visuels doivent etre valides avant toute mise en ligne.",
      "Le positionnement conseille est simple : produit pratique, demonstration rapide, prix promo clair et promesse honnete.",
    ].join("\n\n"),
    benefits,
    features,
    supplier: {
      name: candidate.supplier,
      url: candidate.sourceUrl,
      price: candidate.supplierPrice,
      deliveryEstimate: candidate.deliveryEstimate,
      rating: candidate.rating,
    },
    pricing: {
      supplierPrice: candidate.supplierPrice,
      promoPrice: candidate.salePrice,
      crossedPrice: candidate.crossedPrice,
      estimatedMargin: candidate.estimatedMargin,
      marginRate: candidate.marginRate,
      note: "Prix indicatifs a valider avec le cout reel fournisseur, livraison, retours et taxes.",
    },
    seo: {
      tags: [candidate.category, "bon plan", "maxi trouvailles", "livraison europe", "produit pratique"],
      metaTitle: `${candidate.name} | Maxi Trouvailles`,
      metaDescription: `Decouvrez ${candidate.name} chez Maxi Trouvailles. Fiche en brouillon, livraison et stock a confirmer avant publication.`,
    },
    legal: {
      deliveryText: "Delai indicatif a confirmer avant publication. Ne pas promettre un delai non garanti.",
      returnsText: "Retour/SAV a traiter selon les conditions Maxi Trouvailles et la legislation applicable.",
      safetyCheck: candidate.riskFlags.length ? candidate.riskFlags : ["Aucun risque bloqueur detecte dans le brouillon."],
    },
    adIdea: candidate.adIdea,
    createdAt: new Date().toISOString(),
    validationRequired: true,
  };
}

function sheetToMarkdown(sheet) {
  return `# ${sheet.title}

Statut : ${sheet.status}
Publication : ${sheet.publicationStatus}

## Prix

- Fournisseur : ${sheet.pricing.supplierPrice}
- Promo conseille : ${sheet.pricing.promoPrice}
- Prix barre indicatif : ${sheet.pricing.crossedPrice}
- Marge estimee : ${sheet.pricing.estimatedMargin}

## Description courte

${sheet.shortDescription}

## Description longue

${sheet.longDescription}

## Benefices

${sheet.benefits.map((item) => `- ${item}`).join("\n")}

## Caracteristiques

${sheet.features.map((item) => `- ${item}`).join("\n")}

## SEO

- Slug : ${sheet.slug}
- Meta title : ${sheet.seo.metaTitle}
- Meta description : ${sheet.seo.metaDescription}
- Tags : ${sheet.seo.tags.join(", ")}

## Livraison / retours

- ${sheet.legal.deliveryText}
- ${sheet.legal.returnsText}

## Verification obligatoire

${sheet.legal.safetyCheck.map((item) => `- ${item}`).join("\n")}
`;
}

function prepareProduct() {
  ensureDirs();
  const sheet = productSheet();
  const jsonPath = path.join(DIRS.sheets, `${sheet.slug}.json`);
  const mdPath = path.join(DIRS.sheets, `${sheet.slug}.md`);
  writeJson(jsonPath, sheet);
  fs.writeFileSync(mdPath, sheetToMarkdown(sheet), "utf8");
  writeJson(path.join(DIRS.sheets, "latest_product_sheet.json"), sheet);
  log("prepare-product", jsonPath);
  return { jsonPath, mdPath, sheet };
}

function escapeSvg(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapWords(value, width = 25) {
  const words = String(value).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > width) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 5);
}

function svgAd(sheet, platform) {
  const lines = wrapWords(sheet.title, platform === "snapchat" ? 20 : 24);
  const yStart = 360;
  const textLines = lines
    .map((line, index) => `<text x="90" y="${yStart + index * 72}" font-size="58" font-weight="800" fill="#ffffff">${escapeSvg(line)}</text>`)
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <rect width="1080" height="1920" fill="#111827"/>
  <rect x="56" y="72" width="968" height="1776" rx="42" fill="#0f766e"/>
  <text x="90" y="180" font-size="42" font-weight="700" fill="#ccfbf1">Maxi Trouvailles</text>
  <text x="90" y="270" font-size="46" font-weight="800" fill="#fde68a">Bon plan a verifier</text>
  ${textLines}
  <rect x="90" y="880" width="900" height="360" rx="36" fill="#f8fafc"/>
  <text x="132" y="990" font-size="60" font-weight="900" fill="#111827">${escapeSvg(sheet.pricing.promoPrice)}</text>
  <text x="132" y="1080" font-size="38" fill="#475569">Prix barre indicatif ${escapeSvg(sheet.pricing.crossedPrice)}</text>
  <text x="132" y="1160" font-size="34" fill="#475569">Validation fournisseur obligatoire</text>
  <text x="90" y="1410" font-size="42" font-weight="700" fill="#ffffff">${escapeSvg(platform.toUpperCase())}</text>
  <text x="90" y="1485" font-size="34" fill="#d1fae5">Script, visuel et publication a valider par Mouss.</text>
  <text x="90" y="1715" font-size="34" fill="#ccfbf1">maxitrouvaille.fr</text>
</svg>`;
}

function latestSheet() {
  const latest = path.join(DIRS.sheets, "latest_product_sheet.json");
  if (!fs.existsSync(latest)) {
    return prepareProduct().sheet;
  }
  return JSON.parse(fs.readFileSync(latest, "utf8"));
}

function adScript(sheet, platform) {
  const hook =
    platform === "tiktok"
      ? "Stop, regarde cette trouvaille utile."
      : platform === "instagram"
        ? "Une bonne affaire simple pour le quotidien."
        : "Bon plan rapide a verifier avant rupture.";
  return {
    platform,
    hook,
    screenText: [
      hook,
      sheet.title,
      `Prix promo brouillon : ${sheet.pricing.promoPrice}`,
      "Stock et livraison a confirmer",
      "Validation humaine avant publication",
    ],
    voiceOver: [
      hook,
      `Aujourd'hui, Maxi Trouvailles prepare ${sheet.title}.`,
      "L'idee est simple : un produit pratique, un prix clair, et une fiche propre.",
      "Avant publication, on verifie le fournisseur, le delai, le stock et la conformite.",
    ].join(" "),
    caption: `${sheet.title} - brouillon Maxi Trouvailles. Stock, livraison et prix a confirmer avant publication. #maxitrouvailles #bonplan #destockage`,
    hashtags: ["#maxitrouvailles", "#bonplan", "#destockage", "#shopping", "#trouvaille"],
    visualIdea: sheet.adIdea,
    publicationStatus: "not_published",
  };
}

function prepareAds() {
  ensureDirs();
  const sheet = latestSheet();
  const platforms = ["tiktok", "instagram", "snapchat"];
  const pack = {
    product: sheet.title,
    slug: sheet.slug,
    status: "ads_brouillon_validation_humaine",
    generatedAt: new Date().toISOString(),
    ads: platforms.map((platform) => adScript(sheet, platform)),
  };

  for (const ad of pack.ads) {
    const platformDir = DIRS[ad.platform];
    const jsonPath = path.join(platformDir, `${sheet.slug}_${ad.platform}.json`);
    writeJson(jsonPath, ad);
    fs.writeFileSync(path.join(DIRS.exportImages, `${sheet.slug}_${ad.platform}.svg`), svgAd(sheet, ad.platform), "utf8");
  }

  const md = pack.ads
    .map((ad) => `## ${ad.platform}\n\nAccroche : ${ad.hook}\n\nVoix off : ${ad.voiceOver}\n\nCaption : ${ad.caption}\n\nHashtags : ${ad.hashtags.join(" ")}\n`)
    .join("\n");
  const scriptsPath = path.join(DIRS.exportScripts, `${sheet.slug}_publicites.md`);
  const manifestPath = path.join(DIRS.exports, `${sheet.slug}_ads_manifest.json`);
  fs.writeFileSync(scriptsPath, `# Publicites brouillon - ${sheet.title}\n\n${md}`, "utf8");
  writeJson(manifestPath, pack);
  writeJson(path.join(DIRS.exports, "latest_ads_manifest.json"), pack);
  log("prepare-ads", manifestPath);
  return { manifestPath, scriptsPath, pack };
}

function runDemo() {
  ensureDirs();
  const candidate = makeCandidate(
    {
      name: "Produit fictif - organisateur malin de bureau",
      supplierPriceCents: 590,
      supplier: "Fournisseur demo non reel",
      sourceUrl: "manual://demo/produit-fictif",
      delivery: "Europe 5 a 9 jours apres verification fournisseur",
      rating: 4.6,
      visualScore: 8,
      category: "maison",
      idea: "Bureau en bazar puis avant/apres rangement rapide.",
    },
    1,
  );
  const output = {
    generatedAt: new Date().toISOString(),
    mode: "test_fictif_no_publication",
    warning: "Produit fictif cree pour verifier le pipeline. Ne pas publier.",
    candidates: [candidate],
  };
  const candidateFile = path.join(DIRS.candidates, `${stamp()}_produit_fictif.json`);
  writeJson(candidateFile, output);
  writeJson(path.join(DIRS.candidates, "latest_candidates.json"), output);
  const sheetResult = prepareProduct();
  const adsResult = prepareAds();
  log("demo", candidateFile);
  return {
    candidateFile,
    productSheet: sheetResult.jsonPath,
    adsManifest: adsResult.manifestPath,
  };
}

function status() {
  ensureDirs();
  const checks = {
    businessDir: BUSINESS,
    dirs: Object.fromEntries(Object.entries(DIRS).map(([key, dir]) => [key, fs.existsSync(dir)])),
    apiTemplate: fs.existsSync(path.join(BUSINESS, "api-config", "api_keys.template.env")),
    latestCandidates: fs.existsSync(path.join(DIRS.candidates, "latest_candidates.json")),
    latestProductSheet: fs.existsSync(path.join(DIRS.sheets, "latest_product_sheet.json")),
    latestAdsManifest: fs.existsSync(path.join(DIRS.exports, "latest_ads_manifest.json")),
  };
  return checks;
}

function printResult(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function getArg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function main() {
  ensureDirs();
  const command = process.argv[2] ?? "status";
  if (command === "status") return printResult(status());
  if (command === "search-products") {
    const count = Number(getArg("--count", "10")) || 10;
    return printResult(searchProducts(count));
  }
  if (command === "prepare-product") return printResult(prepareProduct());
  if (command === "prepare-ads") return printResult(prepareAds());
  if (command === "demo") return printResult(runDemo());
  if (command === "open") {
    execFileSync("explorer.exe", [BUSINESS]);
    return printResult({ opened: BUSINESS });
  }
  throw new Error(`Commande inconnue: ${command}`);
}

try {
  main();
} catch (error) {
  log("error", error instanceof Error ? error.message : String(error));
  console.error(error);
  process.exit(1);
}

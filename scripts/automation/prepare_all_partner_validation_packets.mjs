import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const queueDir = path.join(root, "business-maxi-trouvailles", "file-validation-fournisseurs");
const outputBaseDir = path.join(queueDir, "packs-validation-tous-partenaires");
const topArg = process.argv.find((arg) => arg.startsWith("--top="));
const topLimit = topArg ? Math.max(1, Number(topArg.split("=")[1]) || 15) : 15;

const gapInstructions = {
  decision_garder_remplacer_ou_retirer: {
    field: "businessDecision",
    instruction:
      "Decider si cette fiche statique doit etre prouvee, remplacee par un meilleur produit, ou retiree du catalogue partenaire.",
    acceptWhen: "Decision claire: keep_validate, replace, remove ou later.",
  },
  lien_fournisseur_exact: {
    field: "exactSupplierProductUrl",
    instruction:
      "Remplacer toute URL de recherche par une URL article fournisseur exacte correspondant a la variante vendue.",
    acceptWhen: "URL article exacte, pas une page de recherche ou wholesale.",
  },
  sku_fournisseur: {
    field: "supplierSku",
    instruction: "Renseigner le SKU, item ID ou identifiant fournisseur exact.",
    acceptWhen: "Identifiant fournisseur stable et reutilisable dans une commande manuelle.",
  },
  images_exactes_et_droits: {
    field: "imageProof",
    instruction:
      "Verifier que les images representent exactement la variante vendue et que leur usage est acceptable.",
    acceptWhen: "Images exactes, sans logo interdit, et preuve/decision d'usage documentee.",
  },
  preuve_delai_france_europe: {
    field: "deliveryProof",
    instruction:
      "Verifier le delai reel France/Europe avec suivi disponible et noter la plage exacte.",
    acceptWhen: "Delai clair, coherent, idealement court, avec date de verification.",
  },
  preuve_prix: {
    field: "pricingProof",
    instruction: "Recontroler prix fournisseur, frais et marge brute avant publication.",
    acceptWhen: "Prix fournisseur actuel, frais connus et marge boutique recalculee.",
  },
  preuve_livraison: {
    field: "shippingProof",
    instruction: "Verifier pays d'expedition, transporteur et suivi colis.",
    acceptWhen: "Livraison France/Europe documentee, pas seulement estimee.",
  },
  droits_images: {
    field: "imageRightsProof",
    instruction: "Valider droits/usage des images ou planifier remplacement par visuels propres.",
    acceptWhen: "Decision documentee: usage OK ou remplacement images avant publication.",
  },
};

function latestFile(dir, prefix) {
  const matches = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith(".json"))
    .map((entry) => {
      const fullPath = path.join(dir, entry.name);
      return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (matches.length === 0) {
    throw new Error(`No ${prefix}*.json file found in ${dir}.`);
  }

  return matches[0].fullPath;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function formatEuro(cents) {
  if (!Number.isFinite(Number(cents))) {
    return "a verifier";
  }

  return `${(Number(cents) / 100).toFixed(2)} EUR`;
}

function buildActions(gaps) {
  return gaps.map((gap) => ({
    gap,
    ...(gapInstructions[gap] ?? {
      field: "manualReview",
      instruction: `Traiter la preuve manquante: ${gap}.`,
      acceptWhen: "Preuve remplie et verifiee.",
    }),
  }));
}

function packetFromQueueItem(item, rank) {
  const actions = buildActions(item.evidenceGaps ?? []);

  return {
    rank,
    id: item.id,
    slug: item.slug,
    name: item.name,
    origin: item.origin,
    status: item.status,
    categoryId: item.categoryId,
    lane: item.lane,
    priorityScore: item.priorityScore,
    publicationStatus: item.publicationStatus ?? "HOLD",
    supplier: {
      url: item.supplierUrl ?? "",
      urlExactEnough: Boolean(item.supplierUrlExactEnough),
      sku: item.supplierSku ?? "",
      supplierPriceCents: item.supplierPriceCents ?? null,
      salePriceCents: item.salePriceCents ?? null,
      supplierStock: item.supplierStock ?? null,
      deliveryEstimate: item.deliveryEstimate ?? "",
    },
    evidenceGaps: item.evidenceGaps ?? [],
    riskFlags: item.riskFlags ?? [],
    actions,
    formToFill: {
      checkedAt: "",
      decision: item.origin === "src/lib/catalog.ts" ? "" : "continue_validation",
      exactSupplierProductUrl: item.supplierUrlExactEnough ? item.supplierUrl : "",
      supplierSellerName: "",
      supplierSku: item.supplierSku || "",
      exactVariantChosen: "",
      supplierPriceCents: item.supplierPriceCents ?? null,
      supplierStock: item.supplierStock ?? null,
      deliveryFranceEuropeProof: "",
      deliveryEstimateForCustomer: "",
      trackingAvailable: "",
      pricingProof: "",
      shippingProof: "",
      imageProof: "",
      imageRightsProof: "",
      complianceNotes: "",
      finalDecision: "HOLD",
      reviewedByMouss: false,
    },
    safety: {
      publishAllowed: false,
      supplierOrderAllowed: false,
      paymentAllowed: false,
      reason:
        "Pack de validation uniquement. Publication, paiement et commande fournisseur interdits sans validation humaine explicite.",
    },
  };
}

function markdownPacket(packet) {
  const lines = [
    `# Pack validation fournisseur - ${packet.name}`,
    "",
    `Rang: ${packet.rank}`,
    `Origine: ${packet.origin}`,
    `File: ${packet.lane}`,
    `Score: ${packet.priorityScore}`,
    `Statut: ${packet.status}`,
    `Publication: ${packet.publicationStatus}`,
    "",
    "## Produit",
    "",
    `- ID: ${packet.id}`,
    `- Slug: ${packet.slug}`,
    `- Categorie: ${packet.categoryId}`,
    `- Prix fournisseur: ${formatEuro(packet.supplier.supplierPriceCents)}`,
    `- Prix boutique: ${formatEuro(packet.supplier.salePriceCents)}`,
    `- Stock fournisseur: ${packet.supplier.supplierStock ?? "a verifier"}`,
    `- Delai actuel: ${packet.supplier.deliveryEstimate || "a verifier"}`,
    `- URL fournisseur: ${packet.supplier.url || "a verifier"}`,
    `- URL exacte: ${packet.supplier.urlExactEnough}`,
    `- SKU fournisseur: ${packet.supplier.sku || "a verifier"}`,
    "",
    "## Preuves manquantes",
    "",
    ...(packet.evidenceGaps.length
      ? packet.evidenceGaps.map((gap) => `- ${gap}`)
      : ["- Aucune preuve manquante detectee"]),
    "",
    "## Risques a verifier",
    "",
    ...(packet.riskFlags.length
      ? packet.riskFlags.map((flag) => `- ${flag}`)
      : ["- Aucun risque specifique detecte"]),
    "",
    "## Actions",
    "",
    ...packet.actions.map(
      (action) =>
        `- ${action.field}: ${action.instruction} Acceptation: ${action.acceptWhen}`,
    ),
    "",
    "## Formulaire de preuve",
    "",
    "```json",
    JSON.stringify(packet.formToFill, null, 2),
    "```",
    "",
    "## Garde-fous",
    "",
    "- Garder en HOLD tant que le formulaire n'est pas rempli avec de vraies preuves.",
    "- Ne pas publier.",
    "- Ne pas commander fournisseur.",
    "- Ne pas payer.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

function markdownIndex(summary) {
  const lines = [
    "# Index packs validation tous partenaires",
    "",
    `Date: ${summary.generatedAt}`,
    "",
    `Packs generes: ${summary.packetCount}`,
    `Source file: ${summary.queuePath}`,
    "",
    "| Rang | Produit | Origine | File | Score | Preuves manquantes |",
    "|---:|---|---|---|---:|---|",
    ...summary.packets.map(
      (packet) =>
        `| ${packet.rank} | ${packet.name} | ${packet.origin} | ${packet.lane} | ${packet.priorityScore} | ${packet.evidenceGaps.join(", ")} |`,
    ),
    "",
    "## Regle",
    "",
    "Ces packs preparent la validation humaine. Ils ne debloquent jamais automatiquement la publication, le paiement ou une commande fournisseur.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

function proofTemplate(packets) {
  return {
    generatedAt: new Date().toISOString(),
    instructions:
      "Remplir seulement avec des preuves reelles. Ne jamais inventer un fournisseur, un SKU, un prix, un stock, un delai ou un droit image.",
    products: packets.map((packet) => ({
      id: packet.id,
      name: packet.name,
      rank: packet.rank,
      lane: packet.lane,
      evidenceGaps: packet.evidenceGaps,
      fill: packet.formToFill,
    })),
  };
}

const queuePath = latestFile(queueDir, "QUEUE_VALIDATION_TOUS_PARTENAIRES_");
const queuePayload = readJson(queuePath);
const sourceQueue = Array.isArray(queuePayload.topQueue) ? queuePayload.topQueue : [];

if (sourceQueue.length === 0) {
  throw new Error("Validation queue must contain a non-empty topQueue.");
}

const selected = sourceQueue.slice(0, topLimit);
const packets = selected.map((item, index) => packetFromQueueItem(item, index + 1));
const generatedAt = new Date().toISOString();
const dateKey = generatedAt.slice(0, 10).replace(/-/g, "");
const datedOutputDir = path.join(outputBaseDir, dateKey);

fs.mkdirSync(datedOutputDir, { recursive: true });

for (const packet of packets) {
  const fileName = `${String(packet.rank).padStart(2, "0")}-${slugify(packet.name)}.md`;
  fs.writeFileSync(path.join(datedOutputDir, fileName), markdownPacket(packet), "utf8");
}

const summary = {
  ok: true,
  generatedAt,
  mode: "read_only_all_partner_validation_packets",
  queuePath,
  outputDir: datedOutputDir,
  topLimit,
  packetCount: packets.length,
  packets,
  safety: {
    readOnlyPackets: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

const jsonPath = path.join(datedOutputDir, "PACKS_VALIDATION_TOUS_PARTENAIRES.json");
const indexPath = path.join(datedOutputDir, "INDEX_PACKS_VALIDATION_TOUS_PARTENAIRES.md");
const templatePath = path.join(datedOutputDir, "TEMPLATE_PREUVES_PACKS_TOUS_PARTENAIRES.json");

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(indexPath, markdownIndex(summary), "utf8");
fs.writeFileSync(templatePath, `${JSON.stringify(proofTemplate(packets), null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      packetCount: summary.packetCount,
      outputDir: summary.outputDir,
      topProducts: packets.map((packet) => ({
        rank: packet.rank,
        id: packet.id,
        name: packet.name,
        origin: packet.origin,
        lane: packet.lane,
        evidenceGapCount: packet.evidenceGaps.length,
      })),
      files: { jsonPath, indexPath, templatePath },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const quickProductsPath = path.join(root, "data", "quick-products.json");
const actionBoardDir = path.join(root, "business-maxi-trouvailles", "file-validation-fournisseurs");
const outputDir = path.join(actionBoardDir, "packs-validation-partenaire");
const topArg = process.argv.find((arg) => arg.startsWith("--top="));
const topLimit = topArg ? Math.max(1, Number(topArg.split("=")[1]) || 5) : 5;

const blockerInstructions = {
  delai_non_prouve: {
    field: "deliveryProof",
    instruction: "Verifier le delai reel vers France/Europe sur la page fournisseur et noter la plage exacte.",
    acceptWhen: "Delai affiche clair, coherent, avec tracking disponible et maximum conseille 7 jours.",
  },
  validation_fournisseur_hold: {
    field: "supplierReliabilityProof",
    instruction: "Verifier le vendeur exact: nom boutique, note, volume, avis recents, anciennete si disponible.",
    acceptWhen: "Vendeur coherent, pas de signal evident de risque, preuve notee dans le pack.",
  },
  vendeur_non_valide: {
    field: "supplierReliabilityProof",
    instruction: "Remplacer le libelle generique par le vendeur exact et prouver sa fiabilite.",
    acceptWhen: "Nom fournisseur exact et preuve de fiabilite renseignes.",
  },
  fiche_contient_elements_a_confirmer: {
    field: "copyCleanup",
    instruction: "Retirer les mentions 'a verifier/a confirmer/HOLD' seulement apres verification reelle.",
    acceptWhen: "Description finale claire, sans promesse non prouvee.",
  },
  validation_interne_hold: {
    field: "moussReview",
    instruction: "Faire la revue humaine finale avant toute publication.",
    acceptWhen: "Validation explicite de Mouss ou decision de garder en brouillon.",
  },
  preuve_livraison_hold: {
    field: "deliveryProof",
    instruction: "Ajouter une preuve de livraison France/Europe et suivi colis.",
    acceptWhen: "Preuve livraison notee avec date de verification.",
  },
  preuve_prix_hold: {
    field: "pricingProof",
    instruction: "Recontroler prix fournisseur, frais eventuels et marge boutique.",
    acceptWhen: "Prix fournisseur actuel et marge brute calculee.",
  },
  droits_images_hold: {
    field: "imageRightsProof",
    instruction: "Valider l'utilisation propre des images ou prevoir remplacement par visuels propres.",
    acceptWhen: "Droits/usage acceptables documentes ou plan de remplacement images.",
  },
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

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
    throw new Error(`No ${prefix}*.json file found in ${dir}`);
  }

  return matches[0].fullPath;
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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function productByIdOrSlug(products, summary) {
  return products.find((product) => product.id === summary.id || product.slug === summary.slug);
}

function buildPacket(summary, product, index) {
  const dropshipping = product.dropshipping ?? {};
  const sourceVerification = product.sourceVerification ?? {};
  const images = Array.isArray(product.images) ? product.images : [];
  const blockers = summary.blockers ?? [];
  const actionFields = unique(blockers.map((blocker) => blockerInstructions[blocker]?.field));
  const requiredActions = blockers.map((blocker) => ({
    blocker,
    ...(blockerInstructions[blocker] ?? {
      field: "manualReview",
      instruction: `Traiter le blocage: ${blocker}`,
      acceptWhen: "Blocage leve avec preuve documentee.",
    }),
  }));

  return {
    rank: index + 1,
    id: product.id,
    slug: product.slug,
    name: product.name,
    categoryId: product.categoryId,
    lane: summary.lane,
    priorityScore: summary.priorityScore,
    status: product.status ?? "published",
    supplier: {
      name: dropshipping.supplierName ?? "",
      url: dropshipping.supplierUrl ?? "",
      sku: dropshipping.supplierSku ?? "",
      supplierPriceCents: dropshipping.supplierPriceCents ?? null,
      salePriceCents: dropshipping.salePriceCents ?? product.price ?? null,
      marginCents: dropshipping.marginCents ?? null,
      supplierStock: dropshipping.supplierStock ?? product.stock ?? null,
      deliveryEstimate: dropshipping.deliveryEstimate ?? "",
    },
    images: {
      status: product.imageValidation?.status ?? "unknown",
      sourceUrl: product.imageValidation?.sourceUrl ?? "",
      main: product.image ?? "",
      gallery: images,
      count: images.length,
      nextAction: product.imageValidation?.nextAction ?? "",
    },
    evidenceAlreadyStored: {
      internalEvidenceUrl: product.internalSourcing?.evidenceUrl ?? "",
      internalEvidenceNote: product.internalSourcing?.evidenceNote ?? "",
      validationStatus: product.internalSourcing?.validationStatus ?? "",
      deliveryStatus: sourceVerification.deliveryStatus ?? "",
      priceStatus: sourceVerification.priceStatus ?? "",
      rightsStatus: sourceVerification.rightsStatus ?? "",
    },
    blockers,
    riskFlags: summary.riskFlags ?? [],
    actionFields,
    requiredActions,
    formToFill: {
      checkedAt: "",
      exactSupplierName: "",
      exactProductUrl: dropshipping.supplierUrl ?? "",
      exactSkuOrVariant: dropshipping.supplierSku ?? "",
      exactVariantChosen: "",
      currentSupplierPriceCents: "",
      currentSupplierStock: "",
      currentDeliveryFranceEurope: "",
      trackingAvailable: "",
      supplierReliabilityProof: "",
      deliveryProof: "",
      pricingProof: "",
      imageRightsProof: "",
      imageVariantProof: "",
      copyCleanupDone: false,
      complianceNotes: "",
      moussReview: "",
      decision: "HOLD",
    },
    safety: {
      publishAllowed: false,
      supplierOrderAllowed: false,
      paymentAllowed: false,
      reason: "Pack de validation uniquement. Publication et commande interdites sans validation humaine.",
    },
  };
}

function markdownPacket(packet) {
  const lines = [
    `# Pack validation partenaire - ${packet.name}`,
    "",
    `Rang: ${packet.rank}`,
    `File: ${packet.lane}`,
    `Score: ${packet.priorityScore}`,
    `Statut actuel: ${packet.status}`,
    "",
    "## Donnees catalogue",
    "",
    `- ID: ${packet.id}`,
    `- Slug: ${packet.slug}`,
    `- Categorie: ${packet.categoryId}`,
    `- Prix fournisseur actuel: ${formatEuro(packet.supplier.supplierPriceCents)}`,
    `- Prix boutique actuel: ${formatEuro(packet.supplier.salePriceCents)}`,
    `- Stock fournisseur actuel: ${packet.supplier.supplierStock ?? "a verifier"}`,
    `- Delai actuel: ${packet.supplier.deliveryEstimate || "a verifier"}`,
    `- Lien fournisseur: ${packet.supplier.url || "a verifier"}`,
    `- SKU fournisseur: ${packet.supplier.sku || "a verifier"}`,
    "",
    "## Images",
    "",
    `- Statut images: ${packet.images.status}`,
    `- Source images: ${packet.images.sourceUrl || "a verifier"}`,
    `- Image principale: ${packet.images.main || "a verifier"}`,
    `- Nombre images galerie: ${packet.images.count}`,
    "",
    "## Bloquants",
    "",
    ...packet.blockers.map((blocker) => `- ${blocker}`),
    "",
    "## Actions requises",
    "",
    ...packet.requiredActions.map(
      (action) => `- ${action.field}: ${action.instruction} Acceptation: ${action.acceptWhen}`,
    ),
    "",
    "## Formulaire a remplir",
    "",
    "```json",
    JSON.stringify(packet.formToFill, null, 2),
    "```",
    "",
    "## Decision",
    "",
    "- Garder HOLD tant que toutes les preuves ne sont pas remplies.",
    "- Ne pas commander fournisseur.",
    "- Ne pas publier sans validation humaine.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

function markdownIndex(payload) {
  const lines = [
    "# Index packs validation fournisseur - Maxi Trouvaille",
    "",
    `Date: ${payload.generatedAt}`,
    "",
    `Packs generes: ${payload.packetCount}`,
    "",
    "| Rang | Produit | File | Score | Bloquants |",
    "|---:|---|---|---:|---|",
    ...payload.packets.map(
      (packet) =>
        `| ${packet.rank} | ${packet.name} | ${packet.lane} | ${packet.priorityScore} | ${packet.blockers.join(", ")} |`,
    ),
    "",
    "## Regle",
    "",
    "Ces packs servent a lever les HOLD. Ils ne donnent jamais autorisation de publier, payer ou commander sans validation humaine.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

const actionBoardPath = latestFile(actionBoardDir, "ACTION_BOARD_PARTENAIRES_");
const actionBoard = readJson(actionBoardPath);
const products = readJson(quickProductsPath);

if (!Array.isArray(actionBoard.topQueue)) {
  throw new Error("Action board must contain topQueue.");
}

if (!Array.isArray(products)) {
  throw new Error("data/quick-products.json must contain an array.");
}

const selectedSummaries = actionBoard.topQueue.slice(0, topLimit);
const packets = selectedSummaries.map((summary, index) => {
  const product = productByIdOrSlug(products, summary);
  if (!product) {
    throw new Error(`Product not found for action board entry: ${summary.id || summary.slug}`);
  }

  return buildPacket(summary, product, index);
});

const generatedAt = new Date().toISOString();
const dateKey = generatedAt.slice(0, 10).replace(/-/g, "");
const datedOutputDir = path.join(outputDir, dateKey);
fs.mkdirSync(datedOutputDir, { recursive: true });

for (const packet of packets) {
  const fileName = `${String(packet.rank).padStart(2, "0")}-${slugify(packet.name)}.md`;
  fs.writeFileSync(path.join(datedOutputDir, fileName), markdownPacket(packet), "utf8");
}

const payload = {
  ok: true,
  generatedAt,
  mode: "read_only_validation_packets",
  actionBoardPath,
  quickProductsPath,
  topLimit,
  packetCount: packets.length,
  outputDir: datedOutputDir,
  packets,
  safety: {
    noWriteToCatalog: true,
    noPublication: true,
    noSupplierOrder: true,
    noPayment: true,
  },
};

const jsonPath = path.join(datedOutputDir, "PACKS_VALIDATION_PARTENAIRES.json");
const indexPath = path.join(datedOutputDir, "INDEX_PACKS_VALIDATION_PARTENAIRES.md");
fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
fs.writeFileSync(indexPath, markdownIndex(payload), "utf8");

console.log(
  JSON.stringify(
    {
      ok: payload.ok,
      mode: payload.mode,
      packetCount: payload.packetCount,
      outputDir: payload.outputDir,
      files: { jsonPath, indexPath },
      topProducts: packets.map((packet) => ({
        rank: packet.rank,
        name: packet.name,
        lane: packet.lane,
        blockerCount: packet.blockers.length,
      })),
      safety: payload.safety,
    },
    null,
    2,
  ),
);

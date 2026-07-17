import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const quickProductsPath = path.join(root, "data", "quick-products.json");
const packetsRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "file-validation-fournisseurs",
  "packs-validation-partenaire",
);
const applyChanges = process.argv.includes("--apply");
const inputArg = process.argv.find((arg) => arg.startsWith("--input="));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function latestPacketFile() {
  if (!fs.existsSync(packetsRoot)) {
    throw new Error(`Packets root not found: ${packetsRoot}`);
  }

  const datedDirs = fs
    .readdirSync(packetsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const fullPath = path.join(packetsRoot, entry.name);
      return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const dir of datedDirs) {
    const candidate = path.join(dir.fullPath, "PACKS_VALIDATION_PARTENAIRES.json");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`No PACKS_VALIDATION_PARTENAIRES.json found under ${packetsRoot}`);
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isBlank(value) {
  return String(value ?? "").trim().length === 0;
}

function isUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isPositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
}

function parseDeliveryWindowDays(value) {
  const text = normalizeText(value);

  if (!text) {
    return { ok: false, reason: "delai_absent" };
  }

  if (text.includes("verifier") || text.includes("confirmer") || text.includes("a valider")) {
    return { ok: false, reason: "delai_non_prouve" };
  }

  const dayNumbers = [...text.matchAll(/\d+/g)].map((match) => Number(match[0]));
  if (dayNumbers.length === 0) {
    return { ok: false, reason: "delai_sans_nombre" };
  }

  const minDays = Math.min(...dayNumbers);
  const maxDays = Math.max(...dayNumbers);

  if (minDays < 3) {
    return { ok: false, reason: "delai_trop_court_a_recontroler", minDays, maxDays };
  }

  if (maxDays > 14) {
    return { ok: false, reason: "delai_trop_long", minDays, maxDays };
  }

  return { ok: true, minDays, maxDays };
}

function calculateSalePriceCents(supplierPriceCents, currentSalePriceCents) {
  const supplier = Number(supplierPriceCents);
  const currentSale = Number(currentSalePriceCents);
  const targetMarginPrice = Math.ceil(supplier / 0.6);
  const handlingPrice = supplier + 150;
  const recalculated = Math.ceil((Math.max(targetMarginPrice, handlingPrice) + 10) / 100) * 100 - 10;

  if (Number.isFinite(currentSale) && currentSale > 0) {
    const currentMargin = Math.round(((currentSale - supplier) / currentSale) * 100);
    if (currentMargin >= 30) {
      return currentSale;
    }
  }

  return recalculated;
}

function marginPercent(salePriceCents, supplierPriceCents) {
  return Math.round(((salePriceCents - supplierPriceCents) / salePriceCents) * 100);
}

function formBlockers(packet) {
  const form = packet.formToFill ?? {};
  const blockers = [];
  const delivery = parseDeliveryWindowDays(form.currentDeliveryFranceEurope);

  if (isBlank(form.checkedAt)) blockers.push("date_verification_absente");
  if (isBlank(form.exactSupplierName)) blockers.push("nom_fournisseur_exact_absent");
  if (!isUrl(form.exactProductUrl)) blockers.push("url_produit_exacte_invalide");
  if (isBlank(form.exactSkuOrVariant)) blockers.push("sku_ou_variante_absent");
  if (isBlank(form.exactVariantChosen)) blockers.push("variante_choisie_absente");
  if (!isPositiveInteger(form.currentSupplierPriceCents)) blockers.push("prix_fournisseur_invalide");
  if (!isPositiveInteger(form.currentSupplierStock)) blockers.push("stock_fournisseur_invalide");
  if (!delivery.ok) blockers.push(delivery.reason);
  if (isBlank(form.trackingAvailable)) blockers.push("tracking_non_renseigne");
  if (isBlank(form.supplierReliabilityProof) || String(form.supplierReliabilityProof).trim().length < 16) {
    blockers.push("preuve_fiabilite_fournisseur_absente");
  }
  if (isBlank(form.deliveryProof) || String(form.deliveryProof).trim().length < 16) {
    blockers.push("preuve_livraison_absente");
  }
  if (isBlank(form.pricingProof) || String(form.pricingProof).trim().length < 16) {
    blockers.push("preuve_prix_absente");
  }
  if (isBlank(form.imageRightsProof) || String(form.imageRightsProof).trim().length < 16) {
    blockers.push("preuve_droits_images_absente");
  }
  if (isBlank(form.imageVariantProof) || String(form.imageVariantProof).trim().length < 16) {
    blockers.push("preuve_variante_images_absente");
  }
  if (form.copyCleanupDone !== true) blockers.push("nettoyage_texte_non_confirme");
  if (isBlank(form.moussReview)) blockers.push("revue_mouss_absente");

  const decision = normalizeText(form.decision);
  if (!["hold", "ready review", "ready_review"].includes(decision)) {
    blockers.push("decision_non_autorisee");
  }

  return {
    packetId: packet.id,
    name: packet.name,
    slug: packet.slug,
    readyForDraftUpdate: blockers.length === 0,
    blockers: [...new Set(blockers)],
    delivery,
  };
}

function findProduct(products, packet) {
  return products.find((product) => product.id === packet.id || product.slug === packet.slug);
}

function buildUpdatedProduct(product, packet) {
  const form = packet.formToFill;
  const supplierPriceCents = Number(form.currentSupplierPriceCents);
  const supplierStock = Number(form.currentSupplierStock);
  const salePriceCents = calculateSalePriceCents(
    supplierPriceCents,
    product.dropshipping?.salePriceCents ?? product.price,
  );
  const marginCents = salePriceCents - supplierPriceCents;
  const checkedAt = new Date().toISOString();
  const checkedDate = checkedAt.slice(0, 10);
  const decision = normalizeText(form.decision).replace(" ", "_");

  return {
    ...product,
    status: "draft",
    stock: supplierStock,
    price: salePriceCents,
    compareAtPrice: Math.max(
      Number(product.compareAtPrice ?? 0),
      Math.ceil(salePriceCents * 1.18),
    ),
    dropshipping: {
      ...product.dropshipping,
      enabled: true,
      supplierName: form.exactSupplierName,
      supplierUrl: form.exactProductUrl,
      supplierSku: form.exactSkuOrVariant,
      supplierPriceCents,
      supplierStock,
      deliveryEstimate: form.currentDeliveryFranceEurope,
      salePriceCents,
      marginCents,
      syncStatus: "manual_evidence_collected_hold",
      lastSyncAt: checkedDate,
      validationGate: {
        ...(product.dropshipping?.validationGate ?? {}),
        checkedAt: checkedDate,
        checks: [
          "Vendeur exact renseigne",
          "Prix fournisseur actuel renseigne",
          "Stock fournisseur actuel renseigne",
          "Delai France/Europe renseigne",
          "Tracking renseigne",
          "Droits images et variante documentes",
          "Revue humaine encore obligatoire avant publication",
        ],
        note: "Preuves fournisseur collectees depuis pack validation; fiche maintenue en brouillon/HOLD.",
      },
    },
    internalSourcing: {
      ...(product.internalSourcing ?? {}),
      validationStatus:
        decision === "ready_review"
          ? "DRAFT_READY_REVIEW_HOLD - preuves collectees, publication humaine requise"
          : "DRAFT_HOLD - preuves collectees partiellement, publication interdite",
      supplierReliabilityProof: form.supplierReliabilityProof,
      deliveryProof: form.deliveryProof,
      pricingProof: form.pricingProof,
      imageRightsProof: form.imageRightsProof,
      imageVariantProof: form.imageVariantProof,
      complianceNotes: form.complianceNotes,
      moussReview: form.moussReview,
      validationPacketAppliedAt: checkedAt,
      pricingRule: `Prix fournisseur ${supplierPriceCents} cents; prix boutique ${salePriceCents} cents; marge brute estimee ${marginPercent(
        salePriceCents,
        supplierPriceCents,
      )}% avant frais/retours/taxes.`,
    },
    sourceVerification: {
      ...(product.sourceVerification ?? {}),
      status: decision === "ready_review" ? "evidence_collected_ready_review_hold" : "evidence_collected_hold",
      checkedAt: checkedDate,
      productUrl: form.exactProductUrl,
      deliveryEvidence: form.deliveryProof,
      pricingEvidence: form.pricingProof,
      supplierReliabilityProof: form.supplierReliabilityProof,
      imageRightsEvidence: form.imageRightsProof,
      imageVariantProof: form.imageVariantProof,
      trackingAvailable: form.trackingAvailable,
      exactVariantChosen: form.exactVariantChosen,
      deliveryStatus: "evidence_collected",
      priceStatus: "evidence_collected",
      rightsStatus: "evidence_collected",
    },
    imageValidation: {
      ...(product.imageValidation ?? {}),
      checkedAt: checkedDate,
      status: "verified_source_images",
      sourceUrl: form.exactProductUrl,
      reason: "Images conservees et variante documentee via pack validation fournisseur.",
      nextAction: "Revue humaine finale avant toute publication.",
    },
  };
}

function countByBlockers(audits) {
  return audits.reduce((acc, audit) => {
    for (const blocker of audit.blockers) {
      acc[blocker] = (acc[blocker] ?? 0) + 1;
    }

    return acc;
  }, {});
}

function markdown(summary) {
  const lines = [
    "# Application packs validation fournisseur - Maxi Trouvaille",
    "",
    `Date: ${summary.checkedAt}`,
    "",
    `Mode: ${summary.mode}`,
    "",
    "## Synthese",
    "",
    `- Packs analyses: ${summary.packetCount}`,
    `- Prets mise a jour brouillon: ${summary.readyCount}`,
    `- Bloques: ${summary.blockedCount}`,
    `- Produits mis a jour: ${summary.updatedCount}`,
    `- Ecriture catalogue: ${summary.apply.applied ? "oui" : "non"}`,
    "",
    "## Bloquants",
    "",
    ...Object.entries(summary.blockers).map(([blocker, count]) => `- ${blocker}: ${count}`),
    "",
    "## Regles",
    "",
    "- Mise a jour en `draft` uniquement.",
    "- Aucune publication automatique.",
    "- Aucune commande fournisseur.",
    "- Aucune action paiement.",
    "- Backup obligatoire en mode apply.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

const inputPath = inputArg ? path.resolve(root, inputArg.split("=")[1]) : latestPacketFile();
const packetPayload = readJson(inputPath);
const products = readJson(quickProductsPath);

if (!Array.isArray(packetPayload.packets)) {
  throw new Error("PACKS_VALIDATION_PARTENAIRES.json must contain a packets array.");
}

if (!Array.isArray(products)) {
  throw new Error("data/quick-products.json must contain an array.");
}

const packetAudits = packetPayload.packets.map((packet) => {
  const audit = formBlockers(packet);
  const product = findProduct(products, packet);

  if (!product) {
    return {
      ...audit,
      readyForDraftUpdate: false,
      blockers: [...audit.blockers, "produit_catalogue_introuvable"],
    };
  }

  if ((product.status ?? "published") !== "draft") {
    return {
      ...audit,
      readyForDraftUpdate: false,
      blockers: [...audit.blockers, "produit_non_draft"],
    };
  }

  return audit;
});

const readyAudits = packetAudits.filter((audit) => audit.readyForDraftUpdate);
const readyPackets = packetPayload.packets.filter((packet) =>
  readyAudits.some((audit) => audit.packetId === packet.id),
);

let applySummary = { applied: false, backupPath: null, updatedCount: 0 };
if (applyChanges && readyPackets.length > 0) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(root, "backups", `quick-products-before-validation-packets-${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, "quick-products.json.bak");
  fs.copyFileSync(quickProductsPath, backupPath);

  const readyById = new Map(readyPackets.map((packet) => [packet.id, packet]));
  const readyBySlug = new Map(readyPackets.map((packet) => [packet.slug, packet]));
  const updatedProducts = products.map((product) => {
    const packet = readyById.get(product.id) ?? readyBySlug.get(product.slug);
    return packet ? buildUpdatedProduct(product, packet) : product;
  });

  fs.writeFileSync(quickProductsPath, `${JSON.stringify(updatedProducts, null, 2)}\n`, "utf8");
  applySummary = { applied: true, backupPath, updatedCount: readyPackets.length };
}

const checkedAt = new Date().toISOString();
const dateKey = checkedAt.slice(0, 10).replace(/-/g, "");
const outputDir = path.dirname(inputPath);
const modeSuffix = applyChanges ? "apply" : "dry_run";
const summary = {
  ok: true,
  checkedAt,
  mode: modeSuffix,
  inputPath,
  quickProductsPath,
  packetCount: packetPayload.packets.length,
  readyCount: readyAudits.length,
  blockedCount: packetAudits.length - readyAudits.length,
  updatedCount: applySummary.updatedCount,
  blockers: countByBlockers(packetAudits),
  ready: readyAudits,
  blocked: packetAudits.filter((audit) => !audit.readyForDraftUpdate),
  apply: applySummary,
  safety: {
    draftsOnly: true,
    noPublication: true,
    noSupplierOrder: true,
    noPayment: true,
    backupBeforeWrite: true,
  },
};

const jsonPath = path.join(outputDir, `APPLY_PACKS_VALIDATION_${modeSuffix}_${dateKey}.json`);
const mdPath = path.join(outputDir, `APPLY_PACKS_VALIDATION_${modeSuffix}_${dateKey}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      packetCount: summary.packetCount,
      readyCount: summary.readyCount,
      blockedCount: summary.blockedCount,
      updatedCount: summary.updatedCount,
      blockers: summary.blockers,
      files: { jsonPath, mdPath },
      apply: summary.apply,
      safety: summary.safety,
    },
    null,
    2,
  ),
);

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packsRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "file-validation-fournisseurs",
  "packs-validation-tous-partenaires",
);
const inputArg = process.argv.find((arg) => arg.startsWith("--input="));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function token(value) {
  return normalizeText(value).replace(/\s+/g, "_");
}

function isBlank(value) {
  return String(value ?? "").trim().length === 0;
}

function hasProof(value, minLength = 16) {
  return String(value ?? "").trim().length >= minLength;
}

function isPositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
}

function isAffirmative(value) {
  const text = normalizeText(value);
  return (
    value === true ||
    text.includes("oui") ||
    text.includes("yes") ||
    text.includes("true") ||
    text.includes("disponible") ||
    text.includes("available") ||
    text.includes("suivi")
  );
}

function exactUrlStatus(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return { ok: false, reason: "url_produit_exacte_absente" };
  }

  try {
    const url = new URL(raw);
    const normalized = normalizeText(`${url.hostname} ${url.pathname} ${url.search}`);
    const isSearch =
      normalized.includes("wholesale") ||
      normalized.includes("searchtext") ||
      normalized.includes("search") ||
      normalized.includes("keyword");

    if (!["http:", "https:"].includes(url.protocol)) {
      return { ok: false, reason: "url_produit_exacte_protocole_invalide" };
    }

    if (isSearch) {
      return { ok: false, reason: "url_fournisseur_est_une_recherche" };
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: "url_produit_exacte_invalide" };
  }
}

function deliveryStatus(value) {
  const text = normalizeText(value);
  if (!text) {
    return { ok: false, reason: "delai_client_absent" };
  }

  if (text.includes("verifier") || text.includes("confirmer") || text.includes("valider")) {
    return { ok: false, reason: "delai_client_non_prouve" };
  }

  const numbers = [...text.matchAll(/\d+/g)].map((match) => Number(match[0]));
  if (numbers.length === 0) {
    return { ok: false, reason: "delai_client_sans_nombre" };
  }

  const minDays = Math.min(...numbers);
  const maxDays = Math.max(...numbers);

  if (minDays < 2) {
    return { ok: false, reason: "delai_client_trop_optimiste", minDays, maxDays };
  }

  if (maxDays > 14) {
    return { ok: false, reason: "delai_client_trop_long", minDays, maxDays };
  }

  return { ok: true, minDays, maxDays };
}

function latestPacketDir() {
  if (!fs.existsSync(packsRoot)) {
    throw new Error(`Packs root not found: ${packsRoot}`);
  }

  const dirs = fs
    .readdirSync(packsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const fullPath = path.join(packsRoot, entry.name);
      return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const dir of dirs) {
    const candidate = path.join(dir.fullPath, "PACKS_VALIDATION_TOUS_PARTENAIRES.json");
    if (fs.existsSync(candidate)) {
      return dir.fullPath;
    }
  }

  throw new Error(`No PACKS_VALIDATION_TOUS_PARTENAIRES.json found under ${packsRoot}`);
}

function resolveInputDir() {
  if (!inputArg) {
    return latestPacketDir();
  }

  const inputPath = path.resolve(root, inputArg.split("=")[1]);
  const stat = fs.statSync(inputPath);
  return stat.isDirectory() ? inputPath : path.dirname(inputPath);
}

function proofProductsFromTemplate(templatePath) {
  if (!fs.existsSync(templatePath)) {
    return new Map();
  }

  const payload = readJson(templatePath);
  const products = Array.isArray(payload.products) ? payload.products : [];
  return new Map(products.map((product) => [product.id, product]));
}

function businessDecisionStatus(fill) {
  const decision = token(fill.decision);
  const finalDecision = token(fill.finalDecision);
  const effectiveDecision = finalDecision && finalDecision !== "hold" ? finalDecision : decision;
  return {
    decision,
    finalDecision,
    effectiveDecision,
    isBusinessAction: ["replace", "remove", "later"].includes(effectiveDecision),
    isReadyReview: effectiveDecision === "ready_review",
  };
}

function pushIf(blockers, condition, blocker) {
  if (condition) {
    blockers.push(blocker);
  }
}

function validateBusinessAction(fill, decisionInfo, blockers) {
  pushIf(blockers, !["replace", "remove", "later"].includes(decisionInfo.effectiveDecision), "decision_business_invalide");
  pushIf(blockers, !hasProof(fill.complianceNotes), "note_decision_business_absente");
  pushIf(blockers, !isAffirmative(fill.reviewedByMouss), "revue_mouss_absente");
}

function validateSupplierReady(fill, packet, blockers) {
  const url = exactUrlStatus(fill.exactSupplierProductUrl);
  const delivery = deliveryStatus(fill.deliveryEstimateForCustomer);

  pushIf(blockers, !url.ok, url.reason);
  pushIf(blockers, isBlank(fill.supplierSellerName), "nom_vendeur_fournisseur_absent");
  pushIf(blockers, isBlank(fill.supplierSku), "sku_fournisseur_absent");
  pushIf(blockers, isBlank(fill.exactVariantChosen), "variante_exacte_absente");
  pushIf(blockers, !isPositiveInteger(fill.supplierPriceCents), "prix_fournisseur_invalide");
  pushIf(blockers, !isPositiveInteger(fill.supplierStock), "stock_fournisseur_invalide");
  pushIf(blockers, !delivery.ok, delivery.reason);
  pushIf(blockers, !isAffirmative(fill.trackingAvailable), "tracking_non_confirme");
  pushIf(blockers, !hasProof(fill.deliveryFranceEuropeProof), "preuve_delai_france_europe_absente");
  pushIf(blockers, !hasProof(fill.pricingProof), "preuve_prix_absente");
  pushIf(blockers, !hasProof(fill.shippingProof), "preuve_livraison_absente");
  pushIf(blockers, !hasProof(fill.imageProof), "preuve_image_exacte_absente");
  pushIf(blockers, !hasProof(fill.imageRightsProof), "preuve_droits_images_absente");
  pushIf(blockers, !isAffirmative(fill.reviewedByMouss), "revue_mouss_absente");

  if (packet.evidenceGaps.includes("decision_garder_remplacer_ou_retirer")) {
    pushIf(
      blockers,
      !["keep_validate", "continue_validation", "ready_review"].includes(token(fill.decision)),
      "decision_garder_valider_absente",
    );
  }
}

function validatePacket(packet, proofProduct) {
  const fill = { ...(packet.formToFill ?? {}), ...(proofProduct?.fill ?? {}) };
  const blockers = [];
  const decisionInfo = businessDecisionStatus(fill);

  pushIf(blockers, isBlank(fill.checkedAt), "date_verification_absente");
  pushIf(blockers, isBlank(fill.decision), "decision_absente");

  if (decisionInfo.isBusinessAction) {
    validateBusinessAction(fill, decisionInfo, blockers);
  } else {
    validateSupplierReady(fill, packet, blockers);
    pushIf(blockers, !decisionInfo.isReadyReview, "decision_finale_pas_ready_review");
  }

  const uniqueBlockers = [...new Set(blockers)];
  const readyForReview = uniqueBlockers.length === 0 && decisionInfo.isReadyReview;
  const businessActionReady = uniqueBlockers.length === 0 && decisionInfo.isBusinessAction;

  return {
    id: packet.id,
    slug: packet.slug,
    name: packet.name,
    rank: packet.rank,
    lane: packet.lane,
    origin: packet.origin,
    currentPublicationStatus: packet.publicationStatus,
    evidenceGapCount: packet.evidenceGaps.length,
    blockerCount: uniqueBlockers.length,
    blockers: uniqueBlockers,
    status: readyForReview
      ? "ready_review_hold"
      : businessActionReady
        ? "business_action_ready_hold"
        : "HOLD_MISSING_EVIDENCE",
    decision: decisionInfo.effectiveDecision || "hold",
    publicationAllowed: false,
    supplierOrderAllowed: false,
    paymentAllowed: false,
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

function csv(rows) {
  const headers = [
    "rank",
    "status",
    "name",
    "origin",
    "lane",
    "decision",
    "blockerCount",
    "blockers",
  ];

  return `${headers.join(",")}\n${rows
    .map((row) => headers.map((header) => csvEscape(row[header])).join(","))
    .join("\n")}\n`;
}

function markdown(summary) {
  const blockerLines = Object.entries(summary.byBlocker).map(
    ([blocker, count]) => `- ${blocker}: ${count}`,
  );
  const rows = summary.products.map(
    (product) =>
      `| ${product.rank} | ${product.status} | ${product.name} | ${product.origin} | ${product.blockerCount} | ${product.blockers.join(", ")} |`,
  );

  return `${[
    "# Audit preuves packs tous partenaires",
    "",
    `Date: ${summary.checkedAt}`,
    "",
    "## Synthese",
    "",
    `- Packs analyses: ${summary.packetCount}`,
    `- Prets revue humaine: ${summary.readyReviewCount}`,
    `- Decisions business pretes: ${summary.businessActionReadyCount}`,
    `- HOLD preuves manquantes: ${summary.holdCount}`,
    "",
    "## Bloquants",
    "",
    ...(blockerLines.length ? blockerLines : ["- Aucun"]),
    "",
    "## Produits",
    "",
    "| # | Statut | Produit | Origine | Bloquants | Details |",
    "|---:|---|---|---|---:|---|",
    ...rows,
    "",
    "## Regles",
    "",
    "- Ce controle est en lecture seule.",
    "- `ready_review_hold` signifie seulement que le dossier peut passer en revue humaine, pas en publication.",
    "- Publication, paiement et commande fournisseur restent interdits sans validation explicite.",
    "",
  ].join("\n")}\n`;
}

const inputDir = resolveInputDir();
const packetPath = path.join(inputDir, "PACKS_VALIDATION_TOUS_PARTENAIRES.json");
const templatePath = path.join(inputDir, "TEMPLATE_PREUVES_PACKS_TOUS_PARTENAIRES.json");

if (!fs.existsSync(packetPath)) {
  throw new Error(`Packet file not found: ${packetPath}`);
}

const packetPayload = readJson(packetPath);
const proofProducts = proofProductsFromTemplate(templatePath);
const packets = Array.isArray(packetPayload.packets) ? packetPayload.packets : [];

if (packets.length === 0) {
  throw new Error("PACKS_VALIDATION_TOUS_PARTENAIRES.json must contain a non-empty packets array.");
}

const products = packets.map((packet) => validatePacket(packet, proofProducts.get(packet.id)));
const checkedAt = new Date().toISOString();
const dateKey = checkedAt.slice(0, 10).replace(/-/g, "");
const summary = {
  ok: true,
  checkedAt,
  mode: "read_only_all_partner_pack_evidence_audit",
  inputDir,
  packetPath,
  templatePath,
  packetCount: products.length,
  readyReviewCount: products.filter((product) => product.status === "ready_review_hold").length,
  businessActionReadyCount: products.filter(
    (product) => product.status === "business_action_ready_hold",
  ).length,
  holdCount: products.filter((product) => product.status === "HOLD_MISSING_EVIDENCE").length,
  byStatus: countBy(products, (product) => product.status),
  byBlocker: countBy(products.flatMap((product) => product.blockers), (blocker) => blocker),
  products,
  safety: {
    readOnly: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

const jsonPath = path.join(inputDir, `AUDIT_PREUVES_PACKS_TOUS_PARTENAIRES_${dateKey}.json`);
const mdPath = path.join(inputDir, `AUDIT_PREUVES_PACKS_TOUS_PARTENAIRES_${dateKey}.md`);
const csvPath = path.join(inputDir, `AUDIT_PREUVES_PACKS_TOUS_PARTENAIRES_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(products), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      packetCount: summary.packetCount,
      readyReviewCount: summary.readyReviewCount,
      businessActionReadyCount: summary.businessActionReadyCount,
      holdCount: summary.holdCount,
      byStatus: summary.byStatus,
      topBlockers: Object.entries(summary.byBlocker)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([blocker, count]) => ({ blocker, count })),
      files: { jsonPath, mdPath, csvPath },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

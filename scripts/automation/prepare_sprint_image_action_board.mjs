import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessDir = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessDir, "tableaux-action");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

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

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);
}

function collectFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, predicate, out);
    } else if (predicate(entry.name, fullPath)) {
      out.push(fullPath);
    }
  }

  return out;
}

function latestFile(prefix, label) {
  const matches = collectFiles(
    actionRoot,
    (name) => name.startsWith(prefix) && name.endsWith(".json"),
  )
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (matches.length === 0) {
    throw new Error(`No ${label} found under ${actionRoot}`);
  }

  return matches[0].fullPath;
}

function csvEscape(value) {
  const normalized = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${normalized.replace(/"/g, '""')}"`;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function countValues(values) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function riskProfile(product, auditProduct) {
  const name = normalizeText(product.name);
  const isAuto = product.categoryId === "dropshipping-auto-moto" || name.includes("coffre") || name.includes("voiture");
  const supplierImageRisk = product.supplierDomainImageCount > 0;
  const missingLocalRisk = product.missingLocalTargetCount > 0 || auditProduct.holdImageCount > 0;
  return {
    isAutoOrCompatibilitySensitive: isAuto,
    supplierImageRisk,
    missingLocalRisk,
    customerRiskIfIgnored: [
      supplierImageRisk ? "URL/image fournisseur visible ou dependante d'un domaine tiers" : "",
      missingLocalRisk ? "galerie non securisee localement" : "",
      isAuto ? "risque compatibilite/dimensions si la variante exacte n'est pas prouvee" : "",
      "risque remboursement si la photo promet un article different",
    ].filter(Boolean),
  };
}

function recommendedDecision(product, auditProduct) {
  const risk = riskProfile(product, auditProduct);
  if (auditProduct.failureCount > 0) {
    return {
      priorityLane: "P0_CORRIGER_DECISION",
      recommendedChoice: "corriger_decision_invalide",
      firstAction: "Corriger le formulaire image avant toute suite.",
      timeboxMinutes: 10,
    };
  }

  if (risk.isAutoOrCompatibilitySensitive) {
    return {
      priorityLane: "P2_HOLD_OU_REMPLACER",
      recommendedChoice: "verifier_dimensions_ou_remplacer",
      firstAction:
        "Verifier dimensions, fixations et variante exacte; remplacer le produit si la preuve est trop longue a obtenir.",
      timeboxMinutes: 20,
    };
  }

  if (product.supplierDomainImageCount > 0 && product.missingLocalTargetCount > 0) {
    return {
      priorityLane: product.shortlistRank <= 2 ? "P1_PREUVE_IMAGE_RAPIDE" : "P2_IMAGE_A_SECURISER",
      recommendedChoice: "photo_propre_ou_permission_fournisseur",
      firstAction:
        "Choisir entre photo propre du produit exact et permission fournisseur documentee, puis creer les WebP locaux.",
      timeboxMinutes: 15,
    };
  }

  return {
    priorityLane: "P2_CONTROLER_PREUVES",
    recommendedChoice: "controle_preuve_locale",
    firstAction: "Verifier les fichiers locaux et les droits avant revue.",
    timeboxMinutes: 15,
  };
}

function buildAction(product, auditProduct, decisionFile) {
  const imageBlockers = auditProduct.images.flatMap((image) => image.blockers ?? []);
  const blockers = countValues([...(auditProduct.blockers ?? []), ...imageBlockers]);
  const decision = recommendedDecision(product, auditProduct);
  const risk = riskProfile(product, auditProduct);
  const minimumToUnlock = [
    "variante exacte confirmee",
    "decision droits images documentee",
    "fichiers WebP locaux crees",
    "preuve correspondance visuelle",
    "validation Mouss",
  ];

  if (risk.isAutoOrCompatibilitySensitive) {
    minimumToUnlock.unshift("dimensions/fixations/usage auto confirmes");
  }

  return {
    rank: product.shortlistRank,
    productId: product.id,
    productName: product.name,
    categoryId: product.categoryId,
    status: auditProduct.status,
    priorityLane: decision.priorityLane,
    recommendedChoice: decision.recommendedChoice,
    firstAction: decision.firstAction,
    timeboxMinutes: decision.timeboxMinutes,
    imageCount: product.imageCount,
    supplierDomainImageCount: product.supplierDomainImageCount,
    missingLocalTargetCount: product.missingLocalTargetCount,
    blockerCount: auditProduct.blockerCount,
    hardFailureCount: auditProduct.failureCount,
    topBlockers: blockers.slice(0, 5),
    customerRiskIfIgnored: risk.customerRiskIfIgnored,
    minimumToUnlock,
    forbidden: [
      "ne pas publier",
      "ne pas utiliser d'image generee en galerie produit exacte",
      "ne pas commander fournisseur",
      "ne pas afficher la marketplace fournisseur au client",
    ],
    targetFolderPublic:
      product.images.find((image) => image.targetPublicUrl)?.targetPublicUrl.replace(/\/[^/]+$/, "/") ?? "",
    decisionFile,
  };
}

function markdown(summary) {
  const rows = summary.actions.map(
    (action) =>
      `| ${action.rank} | ${mdCell(action.productName)} | ${mdCell(action.priorityLane)} | ${mdCell(action.recommendedChoice)} | ${action.imageCount} | ${action.blockerCount} | ${mdCell(action.firstAction)} |`,
  );

  return `${[
    "# Maxi Trouvailles - Actions images sprint",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Produits: ${summary.productCount}`,
    `- Images: ${summary.imageCount}`,
    `- Produits prets revue: ${summary.readyReviewProductCount}`,
    `- Produits HOLD: ${summary.holdProductCount}`,
    `- Blocages HOLD: ${summary.blockerCount}`,
    "- Action catalogue: aucune",
    "- Images generees: aucune",
    "",
    "## Priorites",
    "",
    "| Rang | Produit | Lane | Choix conseille | Images | Blocages | Premiere action |",
    "|---:|---|---|---|---:|---:|---|",
    ...rows,
    "",
    "## Regle simple",
    "",
    "On ne cherche pas a embellir la fiche tant que l'image exacte n'est pas prouvee. Le chemin rentable est de valider vite: photo propre, droits fournisseur, image licencee exacte, ou remplacement du produit.",
    "",
    "## Sources",
    "",
    `- Audit decisions: ${summary.sources.auditPath}`,
    `- Manifeste images: ${summary.sources.manifestPath}`,
    "",
  ].join("\n")}\n`;
}

function actionCard(action) {
  const blockers = action.topBlockers.map((blocker) => `- ${blocker.name}: ${blocker.count}`).join("\n");
  const risks = action.customerRiskIfIgnored.map((risk) => `- ${risk}`).join("\n");
  const unlock = action.minimumToUnlock.map((item) => `- ${item}`).join("\n");
  const forbidden = action.forbidden.map((item) => `- ${item}`).join("\n");

  return `${[
    `# Action images sprint - ${action.productName}`,
    "",
    `Lane: ${action.priorityLane}`,
    `Statut: ${action.status}`,
    `Choix conseille: ${action.recommendedChoice}`,
    `Premiere action: ${action.firstAction}`,
    `Temps cible: ${action.timeboxMinutes} min`,
    "",
    "## Blocages principaux",
    "",
    blockers || "- aucun",
    "",
    "## Risques client si ignore",
    "",
    risks,
    "",
    "## Minimum pour debloquer",
    "",
    unlock,
    "",
    "## Interdit",
    "",
    forbidden,
    "",
    "## Fichier a remplir",
    "",
    `- ${action.decisionFile}`,
    "",
  ].join("\n")}\n`;
}

function csv(summary) {
  const headers = [
    "rank",
    "productId",
    "productName",
    "priorityLane",
    "recommendedChoice",
    "firstAction",
    "imageCount",
    "supplierDomainImageCount",
    "missingLocalTargetCount",
    "blockerCount",
    "hardFailureCount",
    "topBlockers",
    "targetFolderPublic",
  ];

  return `${headers.join(",")}\n${summary.actions
    .map((action) =>
      headers
        .map((header) =>
          csvEscape(
            header === "topBlockers"
              ? action.topBlockers.map((blocker) => `${blocker.name}:${blocker.count}`)
              : action[header],
          ),
        )
        .join(","),
    )
    .join("\n")}\n`;
}

const auditPath = latestFile(
  "AUDIT_DECISIONS_REMPLACEMENT_IMAGES_SPRINT_",
  "AUDIT_DECISIONS_REMPLACEMENT_IMAGES_SPRINT_*.json",
);
const manifestPath = latestFile("MANIFEST_REMPLACEMENT_IMAGES_SPRINT_", "MANIFEST_REMPLACEMENT_IMAGES_SPRINT_*.json");
const audit = readJson(auditPath);
const manifest = readJson(manifestPath);
const auditById = new Map((audit.products ?? []).map((product) => [product.productId, product]));
const decisionFile = path.basename(
  manifest.files?.fillTemplatePath ?? `A_REMPLIR_DECISIONS_REMPLACEMENT_IMAGES_${datePartsParis().dateKey}.json`,
);

const actions = (manifest.products ?? []).map((product) => {
  const auditProduct = auditById.get(product.id);
  if (!auditProduct) {
    throw new Error(`Missing image decision audit for ${product.id}`);
  }
  return buildAction(product, auditProduct, decisionFile);
});

actions.sort((a, b) => {
  const laneOrder = { P0_CORRIGER_DECISION: 0, P1_PREUVE_IMAGE_RAPIDE: 1, P2_HOLD_OU_REMPLACER: 2, P2_IMAGE_A_SECURISER: 3, P2_CONTROLER_PREUVES: 4 };
  return (laneOrder[a.priorityLane] ?? 99) - (laneOrder[b.priorityLane] ?? 99) || a.rank - b.rank;
});

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `actions-images-sprint-${dateKey}`);
const cardsDir = path.join(outputDir, "fiches-actions");
fs.mkdirSync(cardsDir, { recursive: true });

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_sprint_image_business_action_board",
  productCount: actions.length,
  imageCount: actions.reduce((sum, action) => sum + action.imageCount, 0),
  readyReviewProductCount: audit.readyReviewProductCount,
  holdProductCount: audit.holdProductCount,
  blockerCount: audit.blockerCount,
  actions,
  sources: {
    auditPath,
    manifestPath,
  },
  safety: {
    readOnly: true,
    noImageDownload: true,
    noImageGeneration: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

for (const action of actions) {
  const fileName = `${String(action.rank).padStart(2, "0")}-${slugify(action.productName)}.md`;
  fs.writeFileSync(path.join(cardsDir, fileName), actionCard(action), "utf8");
}

const jsonPath = path.join(outputDir, `ACTIONS_IMAGES_SPRINT_${dateKey}.json`);
const mdPath = path.join(outputDir, `ACTIONS_IMAGES_SPRINT_${dateKey}.md`);
const csvPath = path.join(outputDir, `ACTIONS_IMAGES_SPRINT_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      productCount: summary.productCount,
      imageCount: summary.imageCount,
      holdProductCount: summary.holdProductCount,
      blockerCount: summary.blockerCount,
      files: {
        jsonPath,
        mdPath,
        csvPath,
        cardsDir,
      },
      actions: actions.map((action) => ({
        rank: action.rank,
        productId: action.productId,
        productName: action.productName,
        priorityLane: action.priorityLane,
        recommendedChoice: action.recommendedChoice,
        blockerCount: action.blockerCount,
      })),
      safety: summary.safety,
    },
    null,
    2,
  ),
);

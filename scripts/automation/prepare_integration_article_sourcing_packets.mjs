import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const auditRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "audit-integration-articles",
);
const outputRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "sourcing-integration-articles",
);
const imageDepositRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "depots-images-exactes",
  "integration-articles",
);

const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Math.max(1, Number(limitArg.split("=")[1]) || 5) : 5;

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function walkFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath, predicate));
      continue;
    }

    if (!predicate || predicate(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function findLatestAuditPath() {
  const files = walkFiles(auditRoot, (filePath) => /AUDIT_INTEGRATION_ARTICLES_\d+\.json$/.test(filePath));

  if (files.length === 0) {
    throw new Error(`No integration article audit found in ${auditRoot}`);
  }

  return files
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0].filePath;
}

function slugFromProduct(row) {
  return String(row.slug ?? row.name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
  if (/[",\n\r;]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function categoryChecklist(categoryId) {
  const generic = [
    "URL produit exacte",
    "Nom vendeur ou partenaire",
    "SKU ou reference fournisseur",
    "Variante exacte vendue",
    "Prix fournisseur reel",
    "Stock fournisseur visible",
    "Delai France/Europe avec suivi",
    "Droits images ou permission d usage",
    "Photos WebP exactes deposees",
    "Validation humaine Mouss",
  ];

  const specific = {
    "dropshipping-accessoires": [
      "Verifier dimensions et quantite du lot",
      "Confirmer que la photo montre le lot exact vendu",
    ],
    "dropshipping-animaux": [
      "Verifier matiere sans risque pour animal",
      "Confirmer usage chat/chien et taille exacte",
    ],
    "dropshipping-auto-moto": [
      "Verifier compatibilite et mode de fixation",
      "Ajouter avertissement si usage voiture sensible",
    ],
    "dropshipping-cuisine": [
      "Verifier matiere et contact alimentaire si concerne",
      "Confirmer dimensions et quantite par commande",
    ],
    "dropshipping-enfant": [
      "Verifier securite enfant et conformite",
      "Refuser si preuve securite absente",
    ],
    "dropshipping-high-tech": [
      "Verifier batterie, cable, voltage et normes",
      "Refuser si produit electrique sans preuve claire",
    ],
    "dropshipping-maison": [
      "Verifier dimensions, usage reel et accessoires fournis",
      "Confirmer photos avant/apres non trompeuses",
    ],
    "dropshipping-mode": [
      "Verifier taille, tissu, couleur et fermeture",
      "Confirmer photos de la variante exacte",
    ],
  };

  return [...generic, ...(specific[categoryId] ?? [])];
}

function rejectionRules(categoryId) {
  const rules = [
    "Refuser si l image principale ne correspond pas exactement a l article vendu.",
    "Refuser si le fournisseur ne donne pas de delai France/Europe clair.",
    "Refuser si le stock est flou ou non visible.",
    "Refuser si le prix fournisseur reel rend la marge nette trop faible.",
    "Refuser si les droits images ne sont pas prouvables.",
    "Refuser si une mention marketplace ou partenaire externe doit apparaitre au client.",
  ];

  if (categoryId === "dropshipping-enfant") {
    rules.push("Refuser si la conformite securite enfant n est pas documentee.");
  }

  if (categoryId === "dropshipping-high-tech") {
    rules.push("Refuser si batterie, cable, voltage ou normes restent flous.");
  }

  if (categoryId === "dropshipping-cuisine") {
    rules.push("Refuser si la matiere ou le contact alimentaire reste ambigu.");
  }

  return rules;
}

function searchHints(row) {
  const words = String(row.name)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3)
    .slice(0, 5)
    .join(" ");

  return [
    `${words} fournisseur europe livraison rapide`,
    `${words} grossiste france stock`,
    `${words} fournisseur b2b photos droits`,
  ];
}

function expectedImageFiles(slug) {
  return [`${slug}-main.webp`, `${slug}-detail-1.webp`, `${slug}-variant.webp`];
}

function buildPacket(row, index, dateKey) {
  const slug = slugFromProduct(row);
  const depositDir = path.join(imageDepositRoot, dateKey, slug);
  const expectedFiles = expectedImageFiles(slug);

  return {
    priority: index + 1,
    id: row.id,
    slug,
    name: row.name,
    categoryId: row.categoryId,
    priorityScore: row.priorityScore,
    targetSalePrice: row.targetSalePrice,
    targetMargin: row.targetMargin,
    currentStatus: row.status,
    nextAction: row.nextAction,
    sourceAuditImage: row.image,
    imageDepositDir: depositDir,
    expectedImageFiles: expectedFiles,
    searchHints: searchHints(row),
    requiredEvidence: {
      exactProductUrl: "",
      partnerName: "",
      partnerContactOrStore: "",
      supplierSku: "",
      exactVariant: "",
      supplierPriceCents: "",
      supplierStock: "",
      deliveryToFrance: "",
      trackingAvailable: "",
      deliveryEvidence: "",
      imageRightsEvidence: "",
      exactImageFilesDeposited: expectedFiles.map((fileName) => ({
        fileName,
        deposited: false,
        exactVariantVisible: false,
        rightsOk: false,
      })),
      complianceNotes: "",
      moussValidation: false,
    },
    checklist: categoryChecklist(row.categoryId),
    rejectionRules: rejectionRules(row.categoryId),
    safety: {
      noCatalogWrite: true,
      noPublication: true,
      noPayment: true,
      noSupplierOrder: true,
      proofRequiredBeforeReview: true,
    },
  };
}

function packetMarkdown(packet) {
  const lines = [
    `# Packet sourcing - ${packet.name}`,
    "",
    `Priorite: ${packet.priority}`,
    `Categorie: ${packet.categoryId}`,
    `Score: ${packet.priorityScore}`,
    `Prix cible: ${packet.targetSalePrice}`,
    `Marge cible: ${packet.targetMargin}`,
    `Statut actuel: ${packet.currentStatus}`,
    "",
    "## Action",
    "",
    packet.nextAction,
    "",
    "## Recherches manuelles utiles",
    "",
    ...packet.searchHints.map((hint) => `- ${hint}`),
    "",
    "## Preuves a remplir",
    "",
    "- URL produit exacte:",
    "- Nom partenaire:",
    "- Contact ou boutique partenaire:",
    "- SKU/reference:",
    "- Variante exacte:",
    "- Prix fournisseur reel:",
    "- Stock visible:",
    "- Delai France/Europe:",
    "- Suivi disponible:",
    "- Preuve delai:",
    "- Preuve droits images:",
    "- Notes conformite:",
    "- Validation Mouss: non",
    "",
    "## Images WebP exactes attendues",
    "",
    `Depot: ${packet.imageDepositDir}`,
    "",
    ...packet.expectedImageFiles.map((fileName) => `- ${fileName}`),
    "",
    "## Checklist",
    "",
    ...packet.checklist.map((item) => `- [ ] ${item}`),
    "",
    "## Rejets automatiques",
    "",
    ...packet.rejectionRules.map((item) => `- ${item}`),
    "",
    "## Garde-fous",
    "",
    "- Ne pas publier.",
    "- Ne pas payer.",
    "- Ne pas commander.",
    "- Ne pas exposer le fournisseur au client.",
    "- Ne pas utiliser une image approximative comme preuve.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

function markdownReport(payload) {
  const lines = [
    "# Packets sourcing integration articles",
    "",
    `Date: ${payload.generatedAt}`,
    "",
    "## Synthese",
    "",
    `- Audit source: ${payload.auditPath}`,
    `- Candidats disponibles: ${payload.sourceCandidateCount}`,
    `- Packets generes: ${payload.packetCount}`,
    `- Limite demandee: ${payload.limit}`,
    "",
    "## Packets",
    "",
    "| # | Produit | Score | Prix cible | Marge cible | Dossier images |",
    "|---|---|---:|---:|---:|---|",
    ...payload.packets.map(
      (packet) =>
        `| ${packet.priority} | ${packet.name} | ${packet.priorityScore} | ${packet.targetSalePrice} | ${packet.targetMargin} | ${packet.imageDepositDir} |`,
    ),
    "",
    "## Garde-fous",
    "",
    "- Lecture seule cote catalogue.",
    "- Aucun compte externe connecte.",
    "- Aucun achat, paiement ou commande.",
    "- Images attendues listees seulement comme fichiers a deposer plus tard.",
    "- Validation humaine Mouss obligatoire avant toute revue de publication.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

function csvReport(packets) {
  const header = [
    "priority",
    "id",
    "name",
    "categoryId",
    "priorityScore",
    "targetSalePrice",
    "targetMargin",
    "exactProductUrl",
    "partnerName",
    "supplierSku",
    "exactVariant",
    "supplierPriceCents",
    "supplierStock",
    "deliveryToFrance",
    "trackingAvailable",
    "imageRightsEvidence",
    "imageDepositDir",
    "expectedImageFiles",
    "moussValidation",
    "nextAction",
  ];

  const rows = packets.map((packet) =>
    [
      packet.priority,
      packet.id,
      packet.name,
      packet.categoryId,
      packet.priorityScore,
      packet.targetSalePrice,
      packet.targetMargin,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      packet.imageDepositDir,
      packet.expectedImageFiles.join("|"),
      "false",
      packet.nextAction,
    ]
      .map(csvEscape)
      .join(";"),
  );

  return `${header.join(";")}\n${rows.join("\n")}\n`;
}

const dateKey = localDateKey();
const generatedAt = new Date().toISOString();
const auditPath = findLatestAuditPath();
const audit = readJson(auditPath);

if (!audit.ok) {
  throw new Error(`Latest integration article audit is not OK: ${auditPath}`);
}

const candidates = (audit.sourcingBoard ?? []).filter(
  (row) => row.status === "HOLD_READY_FOR_MANUAL_SOURCING" && (row.blockers ?? []).length === 0,
);
const packets = candidates.slice(0, limit).map((row, index) => buildPacket(row, index, dateKey));

const outputDir = path.join(outputRoot, dateKey);
const packetDir = path.join(outputDir, "packets");
fs.mkdirSync(packetDir, { recursive: true });

for (const packet of packets) {
  fs.mkdirSync(packet.imageDepositDir, { recursive: true });
  fs.writeFileSync(path.join(packetDir, `${packet.slug}.md`), packetMarkdown(packet), "utf8");
  fs.writeFileSync(
    path.join(packet.imageDepositDir, "README_DEPOT_IMAGES_EXACTES.md"),
    [
      `# Depot images exactes - ${packet.name}`,
      "",
      "Deposer ici uniquement des WebP exacts du produit et de la variante vendue.",
      "",
      "Fichiers attendus:",
      "",
      ...packet.expectedImageFiles.map((fileName) => `- ${fileName}`),
      "",
      "Ne pas deposer de photo fournisseur non autorisee, image generee ou visuel approximatif.",
      "",
    ].join("\n"),
    "utf8",
  );
}

const payload = {
  generatedAt,
  mode: "read_only_integration_sourcing_packets",
  auditPath,
  sourceCandidateCount: candidates.length,
  packetCount: packets.length,
  limit,
  packets,
  safety: {
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noNetwork: true,
  },
};

const jsonPath = path.join(outputDir, `PACKETS_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `PACKETS_SOURCING_INTEGRATION_${dateKey}.md`);
const csvPath = path.join(outputDir, `PACKETS_SOURCING_INTEGRATION_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(payload), "utf8");
fs.writeFileSync(csvPath, csvReport(packets), "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: payload.mode,
      auditPath,
      sourceCandidateCount: payload.sourceCandidateCount,
      packetCount: payload.packetCount,
      files: { jsonPath, mdPath, csvPath, packetDir },
      safety: payload.safety,
    },
    null,
    2,
  ),
);

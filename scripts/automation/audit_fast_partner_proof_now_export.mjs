import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ACTION_ROOT = path.join(ROOT, "business-maxi-trouvailles", "tableaux-action");
const DATE_ID = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const OUTPUT_DIR = path.join(ACTION_ROOT, `audit-preuves-rapides-now-${DATE_ID}`);

const REQUIRED_FIELDS = [
  "checkedAt",
  "supplierSellerName",
  "exactVariantChosen",
  "deliveryFranceEuropeProof",
  "deliveryEstimateForCustomer",
  "trackingAvailable",
  "pricingProof",
  "shippingProof",
  "imageProof",
  "imageRightsProof",
  "finalDecision",
  "reviewedByMouss",
];

const FIELD_LABELS = {
  checkedAt: "Date de verification",
  supplierSellerName: "Nom vendeur fournisseur",
  exactVariantChosen: "Variante exacte",
  deliveryFranceEuropeProof: "Preuve delai France/Europe",
  deliveryEstimateForCustomer: "Delai client Maxi",
  trackingAvailable: "Suivi disponible",
  pricingProof: "Preuve prix",
  shippingProof: "Preuve livraison",
  imageProof: "Preuve image exacte",
  imageRightsProof: "Droits image",
  finalDecision: "Decision finale",
  reviewedByMouss: "Revue Mouss",
};

const PLACEHOLDER_VALUES = [
  "a verifier",
  "a remplir",
  "vide",
  "todo",
  "tbd",
  "n/a",
  "na",
  "non renseigne",
  "inconnu",
  "test",
  "placeholder",
];

const TRUE_VALUES = new Set([
  "true",
  "oui",
  "yes",
  "y",
  "1",
  "ok",
  "valide",
  "validé",
  "mouss",
  "revue mouss",
]);

const NO_VALUES = new Set(["false", "non", "no", "n", "0"]);

async function collectFiles(dir, predicate, out = []) {
  let entries;

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectFiles(fullPath, predicate, out);
    } else if (entry.isFile() && predicate(entry.name)) {
      out.push(fullPath);
    }
  }

  return out;
}

async function latestFile(dir, predicate) {
  const files = await collectFiles(dir, predicate);
  const dated = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      mtimeMs: (await fs.stat(filePath)).mtimeMs,
    })),
  );

  return dated.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.filePath;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function toRelative(filePath) {
  return path.relative(ROOT, filePath);
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isBlankOrPlaceholder(value) {
  const normalized = normalize(value);

  return (
    normalized.length === 0 ||
    PLACEHOLDER_VALUES.some(
      (placeholder) => normalized === placeholder || normalized.includes(placeholder),
    )
  );
}

function looksPositive(value) {
  return TRUE_VALUES.has(normalize(value));
}

function looksBooleanAnswer(value) {
  const normalized = normalize(value);

  return TRUE_VALUES.has(normalized) || NO_VALUES.has(normalized);
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ";" && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

async function readCsvOverrides(csvPath) {
  if (!csvPath) {
    return new Map();
  }

  let raw;

  try {
    raw = await fs.readFile(csvPath, "utf8");
  } catch {
    return new Map();
  }

  const [headerLine, ...lines] = raw.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(headerLine);
  const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
  const overrides = new Map();

  for (const line of lines) {
    const cells = parseCsvLine(line);
    const productId = cells[indexes.product_id] ?? "";
    const fieldKey = cells[indexes.field_key] ?? "";
    const value = cells[indexes.current_value] ?? "";

    if (productId && fieldKey && !isBlankOrPlaceholder(value)) {
      overrides.set(`${productId}:${fieldKey}`, value);
    }
  }

  return overrides;
}

function resolveFieldValue(product, field, csvOverrides) {
  const override = csvOverrides.get(`${product.id}:${field.key}`);

  if (override !== undefined) {
    return override;
  }

  return field.currentValue ?? "";
}

function auditField(product, field, csvOverrides) {
  const value = resolveFieldValue(product, field, csvOverrides);
  const issues = [];

  if (isBlankOrPlaceholder(value)) {
    issues.push("missing_or_placeholder");
  }

  if (field.key === "finalDecision" && normalize(value) !== "ready_review") {
    issues.push("final_decision_not_ready_review");
  }

  if (field.key === "reviewedByMouss" && !looksPositive(value)) {
    issues.push("missing_human_review_mouss");
  }

  if (field.key === "trackingAvailable" && !looksBooleanAnswer(value)) {
    issues.push("tracking_answer_not_clear_yes_no");
  }

  if (["imageProof", "imageRightsProof"].includes(field.key)) {
    const normalized = normalize(value);

    if (normalized.includes("genere") || normalized.includes("ia") || normalized.includes("ai")) {
      issues.push("generated_image_not_allowed_for_exact_product_gallery");
    }
  }

  return {
    key: field.key,
    label: field.label ?? FIELD_LABELS[field.key] ?? field.key,
    value,
    ok: issues.length === 0,
    issues,
  };
}

function auditProduct(product, csvOverrides) {
  const fieldsByKey = new Map((product.missingFields ?? []).map((field) => [field.key, field]));
  const auditedFields = REQUIRED_FIELDS.map((fieldKey) =>
    auditField(
      product,
      fieldsByKey.get(fieldKey) ?? {
        key: fieldKey,
        label: FIELD_LABELS[fieldKey] ?? fieldKey,
        currentValue: "",
      },
      csvOverrides,
    ),
  );
  const blockers = auditedFields.flatMap((field) =>
    field.issues.map((issue) => `${field.key}:${issue}`),
  );

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    priority: product.priority,
    categoryId: product.categoryId,
    status: blockers.length === 0 ? "READY_HUMAN_REVIEW_HOLD" : "HOLD_FAST_PROOFS_MISSING",
    fieldCount: auditedFields.length,
    okFieldCount: auditedFields.filter((field) => field.ok).length,
    missingOrInvalidFieldCount: auditedFields.filter((field) => !field.ok).length,
    blockers,
    fields: auditedFields,
    publicationAllowed: false,
    supplierOrderAllowed: false,
    paymentAllowed: false,
  };
}

function markdownReport(audit) {
  const lines = [
    "# Audit preuves rapides maintenant",
    "",
    `Date: ${audit.generatedAtLocal}`,
    `Statut: ${audit.status}`,
    "",
    "## Resume",
    "",
    `- Produits controles: ${audit.productCount}`,
    `- Produits prets revue humaine HOLD: ${audit.readyReviewCount}`,
    `- Produits en HOLD: ${audit.holdCount}`,
    `- Champs manquants ou invalides: ${audit.missingOrInvalidFieldCount}`,
    "",
    "## Garde-fous",
    "",
    "- Publication: bloquee.",
    "- Paiement: bloque.",
    "- Commande fournisseur: bloquee.",
    "- Le passage en revue reste manuel, avec validation Mouss.",
    "",
  ];

  for (const product of audit.products) {
    lines.push(
      `## ${product.priority}. ${product.name}`,
      "",
      `Statut: ${product.status}`,
      `Champs OK: ${product.okFieldCount}/${product.fieldCount}`,
      "",
    );

    if (product.blockers.length > 0) {
      lines.push("### Blocages", "");
      for (const blocker of product.blockers) {
        lines.push(`- ${blocker}`);
      }
      lines.push("");
    } else {
      lines.push("Aucun blocage automatique, revue humaine HOLD requise.", "");
    }
  }

  return `${lines.join("\n")}\n`;
}

function localNow() {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date());
}

async function main() {
  const exportJsonPath = await latestFile(
    ACTION_ROOT,
    (name) => name.startsWith("A_REMPLIR_PREUVES_PARTENAIRES_NOW_") && name.endsWith(".json"),
  );

  if (!exportJsonPath) {
    throw new Error("Aucun export A_REMPLIR_PREUVES_PARTENAIRES_NOW_*.json trouve.");
  }

  const csvPath = exportJsonPath.replace(/\.json$/, ".csv");
  const payload = await readJson(exportJsonPath);
  const csvOverrides = await readCsvOverrides(csvPath);
  const products = (payload.products ?? []).map((product) => auditProduct(product, csvOverrides));
  const missingOrInvalidFieldCount = products.reduce(
    (sum, product) => sum + product.missingOrInvalidFieldCount,
    0,
  );
  const readyReviewCount = products.filter(
    (product) => product.status === "READY_HUMAN_REVIEW_HOLD",
  ).length;
  const holdCount = products.length - readyReviewCount;
  const audit = {
    ok: true,
    generatedAt: new Date().toISOString(),
    generatedAtLocal: localNow(),
    mode: "read_only_fast_partner_proof_now_audit",
    status:
      missingOrInvalidFieldCount === 0 && products.length > 0
        ? "READY_HUMAN_REVIEW_HOLD"
        : "HOLD_FAST_PROOFS_MISSING",
    productCount: products.length,
    readyReviewCount,
    holdCount,
    missingOrInvalidFieldCount,
    csvOverrideCount: csvOverrides.size,
    products,
    sources: {
      exportJsonPath: toRelative(exportJsonPath),
      exportCsvPath: toRelative(csvPath),
    },
    safety: {
      readOnly: true,
      noCatalogWrite: true,
      noPublication: true,
      noPayment: true,
      noSupplierOrder: true,
      noMessageSent: true,
      manualValidationRequired: true,
    },
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIR, `AUDIT_PREUVES_PARTENAIRES_NOW_${DATE_ID}.json`);
  const mdPath = path.join(OUTPUT_DIR, `AUDIT_PREUVES_PARTENAIRES_NOW_${DATE_ID}.md`);

  await fs.writeFile(jsonPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  await fs.writeFile(mdPath, markdownReport(audit), "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        status: audit.status,
        productCount: audit.productCount,
        readyReviewCount: audit.readyReviewCount,
        holdCount: audit.holdCount,
        missingOrInvalidFieldCount: audit.missingOrInvalidFieldCount,
        output: {
          json: toRelative(jsonPath),
          md: toRelative(mdPath),
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

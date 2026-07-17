import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BUSINESS_ROOT = path.join(ROOT, "business-maxi-trouvailles");
const PACKS_ROOT = path.join(
  BUSINESS_ROOT,
  "file-validation-fournisseurs",
  "packs-validation-tous-partenaires",
);
const ACTION_ROOT = path.join(BUSINESS_ROOT, "tableaux-action");
const DATE_ID = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const OUTPUT_DIR = path.join(ACTION_ROOT, `preuves-rapides-a-remplir-${DATE_ID}`);

const FIELD_GUIDE = [
  {
    key: "checkedAt",
    label: "Date de verification",
    instruction: "Renseigner la date exacte de controle fournisseur.",
  },
  {
    key: "supplierSellerName",
    label: "Nom vendeur fournisseur",
    instruction: "Copier le nom du vendeur affiche sur la page fournisseur.",
  },
  {
    key: "exactVariantChosen",
    label: "Variante exacte",
    instruction: "Preciser couleur, format, lot, taille ou option vendue.",
  },
  {
    key: "deliveryFranceEuropeProof",
    label: "Preuve delai France/Europe",
    instruction: "Noter la preuve visible du delai France/Europe.",
  },
  {
    key: "deliveryEstimateForCustomer",
    label: "Delai client Maxi",
    instruction: "Renseigner un delai client propre et prudent.",
  },
  {
    key: "trackingAvailable",
    label: "Suivi disponible",
    instruction: "Confirmer oui/non selon l'option fournisseur visible.",
  },
  {
    key: "pricingProof",
    label: "Preuve prix",
    instruction: "Noter prix produit, frais livraison et devise vus.",
  },
  {
    key: "shippingProof",
    label: "Preuve livraison",
    instruction: "Noter transporteur, frais et zone de livraison.",
  },
  {
    key: "imageProof",
    label: "Preuve image exacte",
    instruction: "Confirmer que l'image represente exactement la variante vendue.",
  },
  {
    key: "imageRightsProof",
    label: "Droits image",
    instruction: "Photo propre, autorisation fournisseur ou maintenir HOLD.",
  },
  {
    key: "finalDecision",
    label: "Decision finale",
    instruction: "Laisser HOLD tant que tout n'est pas pret pour revue humaine.",
  },
  {
    key: "reviewedByMouss",
    label: "Revue Mouss",
    instruction: "Cocher uniquement apres validation humaine explicite.",
  },
];

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

function localNow() {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date());
}

function isBlank(value) {
  return String(value ?? "").trim().length === 0;
}

function fieldValue(fill, key) {
  const value = fill?.[key];

  if (typeof value === "boolean") {
    return value ? "oui" : "non";
  }

  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value);
}

function missingFields(form, auditProduct) {
  const fill = form.formToFill ?? {};
  const blockers = new Set(auditProduct?.blockers ?? []);

  return FIELD_GUIDE.filter((field) => {
    const current = fill[field.key];

    if (field.key === "finalDecision") {
      return String(current ?? "").trim().toUpperCase() !== "READY_REVIEW";
    }

    if (field.key === "reviewedByMouss") {
      return current !== true;
    }

    if (blockers.size > 0) {
      const normalizedKey = field.key
        .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
        .toLowerCase();

      if ([...blockers].some((blocker) => blocker.includes(normalizedKey))) {
        return true;
      }
    }

    return isBlank(current);
  }).map((field) => ({
    ...field,
    currentValue: fieldValue(fill, field.key),
  }));
}

function cents(value) {
  if (!Number.isFinite(value ?? NaN)) {
    return "a verifier";
  }

  return `${((value ?? 0) / 100).toFixed(2)} EUR`;
}

function csvEscape(value) {
  const raw = String(value ?? "");

  if (/[",\n;]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }

  return raw;
}

function markdownExport(exportData) {
  const lines = [
    "# A remplir maintenant - Preuves partenaires rapides",
    "",
    `Date: ${exportData.generatedAtLocal}`,
    `Statut: ${exportData.status}`,
    "",
    "## Resume",
    "",
    `- Produits: ${exportData.productCount}`,
    `- Champs manquants a remplir: ${exportData.missingFieldCount}`,
    `- Produits prets revue HOLD: ${exportData.readyReviewCount}`,
    "",
    "## Regles",
    "",
    "- Remplir seulement avec de vraies preuves visibles.",
    "- Ne pas inventer vendeur, stock, delai, prix ou droits image.",
    "- Garder `finalDecision` a `HOLD` tant que tout n'est pas verifie.",
    "- Aucune publication, aucun paiement et aucune commande fournisseur.",
    "- AliExpress/fournisseur reste interne et ne doit jamais apparaitre cote client.",
    "",
  ];

  for (const product of exportData.products) {
    lines.push(
      `## ${product.priority}. ${product.name}`,
      "",
      `Statut: ${product.status}`,
      `Categorie: ${product.categoryId}`,
      `SKU: ${product.supplier.sku || "a verifier"}`,
      `URL interne fournisseur: ${product.supplier.url || "a verifier"}`,
      `Prix fournisseur: ${product.supplier.supplierPrice}`,
      `Prix boutique: ${product.supplier.salePrice}`,
      `Stock: ${product.supplier.stock ?? "a verifier"}`,
      `Delai actuel: ${product.supplier.currentDeliveryEstimate || "a verifier"}`,
      "",
      "### Champs a remplir",
      "",
    );

    for (const field of product.missingFields) {
      lines.push(
        `- [ ] ${field.label}`,
        `  - Cle: \`${field.key}\``,
        `  - Consigne: ${field.instruction}`,
        `  - Valeur actuelle: ${field.currentValue || "vide"}`,
      );
    }

    lines.push(
      "",
      "### Questions de controle",
      "",
      ...product.questions.map((question, index) => `${index + 1}. ${question}`),
      "",
      "### Garde-fou",
      "",
      product.guardrail,
      "",
    );
  }

  return `${lines.join("\n")}\n`;
}

function csvRows(exportData) {
  const header = [
    "priority",
    "product_id",
    "product_name",
    "category",
    "supplier_sku",
    "field_key",
    "field_label",
    "current_value",
    "instruction",
    "status",
  ];
  const rows = [header];

  for (const product of exportData.products) {
    for (const field of product.missingFields) {
      rows.push([
        product.priority,
        product.id,
        product.name,
        product.categoryId,
        product.supplier.sku,
        field.key,
        field.label,
        field.currentValue,
        field.instruction,
        product.status,
      ]);
    }
  }

  return `${rows.map((row) => row.map(csvEscape).join(";")).join("\n")}\n`;
}

async function main() {
  const formsPath = await latestFile(
    PACKS_ROOT,
    (name) => name.startsWith("FORMULAIRES_PREUVES_RAPIDES_") && name.endsWith(".json"),
  );
  const auditPath = await latestFile(
    PACKS_ROOT,
    (name) => name.startsWith("AUDIT_FORMULAIRES_PREUVES_RAPIDES_") && name.endsWith(".json"),
  );

  if (!formsPath) {
    throw new Error("Aucun FORMULAIRES_PREUVES_RAPIDES_*.json trouve.");
  }

  const formsPayload = await readJson(formsPath);
  const auditPayload = auditPath ? await readJson(auditPath) : null;
  const auditsById = new Map((auditPayload?.products ?? []).map((product) => [product.id, product]));
  const products = (formsPayload.forms ?? []).map((form) => {
    const auditProduct = auditsById.get(form.id);
    const missing = missingFields(form, auditProduct);

    return {
      id: form.id,
      slug: form.slug,
      name: form.name,
      priority: form.priority,
      categoryId: form.categoryId,
      workLane: form.workLane,
      status: auditProduct?.status ?? form.status,
      blockerCount: auditProduct?.blockerCount ?? missing.length,
      blockers: auditProduct?.blockers ?? [],
      missingFieldCount: missing.length,
      missingFields: missing,
      supplier: {
        url: form.supplierContext?.url ?? "",
        sku: form.supplierContext?.sku ?? "",
        supplierPrice: cents(form.supplierContext?.supplierPriceCents),
        salePrice: cents(form.supplierContext?.salePriceCents),
        stock: form.supplierContext?.supplierStock ?? null,
        currentDeliveryEstimate: form.supplierContext?.currentDeliveryEstimate ?? "",
      },
      questions: form.questions ?? [],
      guardrail:
        "Rester HOLD: aucune publication, aucun paiement, aucune commande fournisseur avant validation Mouss.",
    };
  });
  const exportData = {
    ok: true,
    generatedAt: new Date().toISOString(),
    generatedAtLocal: localNow(),
    mode: "read_only_fast_partner_proof_now_export",
    status: products.some((product) => product.missingFieldCount > 0)
      ? "HOLD_FAST_PROOFS_TO_FILL"
      : "READY_HUMAN_REVIEW_HOLD",
    productCount: products.length,
    missingFieldCount: products.reduce((sum, product) => sum + product.missingFieldCount, 0),
    readyReviewCount: auditPayload?.readyReviewCount ?? 0,
    products,
    sources: {
      formsPath: toRelative(formsPath),
      auditPath: auditPath ? toRelative(auditPath) : null,
    },
    outputDirRelative: path.relative(ROOT, OUTPUT_DIR),
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
  const jsonPath = path.join(OUTPUT_DIR, `A_REMPLIR_PREUVES_PARTENAIRES_NOW_${DATE_ID}.json`);
  const mdPath = path.join(OUTPUT_DIR, `A_REMPLIR_PREUVES_PARTENAIRES_NOW_${DATE_ID}.md`);
  const csvPath = path.join(OUTPUT_DIR, `A_REMPLIR_PREUVES_PARTENAIRES_NOW_${DATE_ID}.csv`);

  await fs.writeFile(jsonPath, `${JSON.stringify(exportData, null, 2)}\n`, "utf8");
  await fs.writeFile(mdPath, markdownExport(exportData), "utf8");
  await fs.writeFile(csvPath, csvRows(exportData), "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        status: exportData.status,
        productCount: exportData.productCount,
        missingFieldCount: exportData.missingFieldCount,
        output: {
          json: toRelative(jsonPath),
          md: toRelative(mdPath),
          csv: toRelative(csvPath),
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

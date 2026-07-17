import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sessionRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "session-sourcing-integration-articles",
);
const auditRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "audit-session-sourcing-integration-articles",
);
const outputRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "prochaines-preuves-sourcing-integration-articles",
);

const forbiddenSupplierPattern = /\b(aliexpress|ali\s*express|temu|wish|shein)\b/i;
const sensitivePattern = /\b(api[_-]?key|bearer\s+[a-z0-9._-]+|password|secret|sk-[a-z0-9])/i;

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

function findLatestFile(dir, pattern) {
  const files = walkFiles(dir, (filePath) => pattern.test(filePath));

  if (files.length === 0) {
    return null;
  }

  return files
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0].filePath;
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
  if (/[",\n\r;]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function slugSafe(value) {
  return (
    String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "preuve"
  );
}

function isMissingProofValue(value) {
  if (typeof value === "boolean") {
    return value === false;
  }

  return String(value ?? "").trim().length === 0;
}

function isInternalAdminHref(value) {
  const text = String(value ?? "").trim();
  return text.startsWith("/admin/") && !/^https?:\/\//i.test(text) && !text.startsWith("//");
}

function buildNextProofs(session, limit = 5) {
  const rows = [];
  const products = [...(session.products ?? [])].sort(
    (a, b) =>
      a.priority - b.priority ||
      b.priorityScore - a.priorityScore ||
      a.name.localeCompare(b.name, "fr"),
  );

  for (const product of products) {
    const fields = [...(product.fields ?? [])].sort(
      (a, b) =>
        a.order - b.order ||
        a.zone.localeCompare(b.zone, "fr") ||
        a.label.localeCompare(b.label, "fr"),
    );

    for (const field of fields) {
      if (!field.required) continue;

      const missing = isMissingProofValue(field.currentValue);
      const hold = String(field.status ?? "").toUpperCase().includes("HOLD");

      if (!missing && !hold) continue;

      rows.push({
        productPriority: product.priority,
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        categoryId: product.categoryId,
        priorityScore: product.priorityScore,
        supplierMaxCost: product.supplierMaxCost,
        targetSalePrice: product.targetSalePrice,
        targetMargin: product.targetMargin,
        imageDepositDir: product.imageDepositDir,
        fieldOrder: field.order,
        proofZone: field.zone,
        fieldKey: field.key,
        fieldLabel: field.label,
        expectedFormat: field.expectedFormat,
        rejectIf: field.rejectIf,
        adminHref:
          field.adminHref ||
          product.adminLinks?.proof ||
          "/admin/preuves-partenaires?status=hold#top-verification",
        status: field.status,
        currentValue: field.currentValue ?? "",
      });
    }
  }

  return rows
    .sort(
      (a, b) =>
        a.productPriority - b.productPriority ||
        a.fieldOrder - b.fieldOrder ||
        a.fieldLabel.localeCompare(b.fieldLabel, "fr"),
    )
    .slice(0, limit)
    .map((row, index) => ({
      rank: index + 1,
      ...row,
      manualInput: {
        value: "",
        evidenceNote: "",
        captureOrFilePath: "",
        checkedSameArticle: "",
        moussValidation: "",
        finalDecision: "HOLD_TO_FILL",
      },
      nextAction:
        "Remplir manuellement la preuve, verifier que cela concerne le meme article exact, puis relancer les audits.",
    }));
}

function validateProofs(proofs) {
  const failures = [];

  for (const proof of proofs) {
    if (!isInternalAdminHref(proof.adminHref)) {
      failures.push({
        rank: proof.rank,
        code: "admin_href_not_internal",
        value: proof.adminHref,
      });
    }

    const serialized = JSON.stringify(proof);
    if (forbiddenSupplierPattern.test(serialized)) {
      failures.push({
        rank: proof.rank,
        code: "forbidden_marketplace_string_detected",
      });
    }

    if (sensitivePattern.test(serialized)) {
      failures.push({
        rank: proof.rank,
        code: "sensitive_string_detected",
      });
    }
  }

  return failures;
}

function proofMarkdown(proof) {
  const lines = [
    `# Preuve ${proof.rank} - ${proof.productName}`,
    "",
    `Produit: ${proof.productName}`,
    `Categorie: ${proof.categoryId}`,
    `Zone: ${proof.proofZone}`,
    `Champ: ${proof.fieldLabel}`,
    `Statut: ${proof.status}`,
    `Prix cible: ${proof.targetSalePrice}`,
    `Marge cible: ${proof.targetMargin}`,
    `Cout fournisseur max cible: ${proof.supplierMaxCost || "a calculer"}`,
    "",
    "## Format attendu",
    "",
    proof.expectedFormat,
    "",
    "## Refuser si",
    "",
    proof.rejectIf,
    "",
    "## A remplir manuellement",
    "",
    "- Valeur preuve: ",
    "- Note/preuve locale: ",
    "- Capture ou fichier local: ",
    "- Meme article exact confirme: ",
    "- Validation Mouss: ",
    "- Decision finale: HOLD_TO_FILL",
    "",
    "## Liens et depots",
    "",
    `- Lien admin: ${proof.adminHref}`,
    `- Depot images exactes: ${proof.imageDepositDir}`,
    "",
    "## Garde-fous",
    "",
    "- Ne pas publier.",
    "- Ne pas payer.",
    "- Ne pas commander.",
    "- Ne pas contacter un fournisseur automatiquement.",
    "- Ne pas copier d'image sans droits.",
    "- Garder HOLD jusqu'a preuves completes et validation humaine.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

function markdownReport(payload) {
  const lines = [
    "# Prochaines preuves sourcing integration",
    "",
    `Date: ${payload.generatedAt}`,
    `Statut: ${payload.status}`,
    "",
    "## Synthese",
    "",
    `- Preuves a remplir: ${payload.proofCount}`,
    `- Session source: ${payload.sources.sessionPath}`,
    `- Audit session: ${payload.sources.auditPath ?? "absent"}`,
    `- Statut audit session: ${payload.auditStatus}`,
    "",
    "## Top preuves",
    "",
    "| # | Produit | Zone | Champ | Statut | Action |",
    "|---|---|---|---|---|---|",
    ...payload.proofs.map(
      (proof) =>
        `| ${proof.rank} | ${proof.productName} | ${proof.proofZone} | ${proof.fieldLabel} | ${proof.status} | Remplir manuellement puis relancer audits |`,
    ),
    "",
    "## Garde-fous",
    "",
    "- Lecture seule cote catalogue.",
    "- Aucune preuve inventee.",
    "- Aucun fournisseur contacte.",
    "- Aucun paiement, achat, commande ou publication.",
    "- Les valeurs restent a remplir manuellement.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

function workCsv(proofs) {
  const headers = [
    "rank",
    "product_priority",
    "product_id",
    "product_name",
    "category_id",
    "proof_zone",
    "field_order",
    "field_key",
    "field_label",
    "expected_format",
    "reject_if",
    "status",
    "admin_href",
    "image_deposit_dir",
    "manual_value",
    "evidence_note",
    "capture_or_file_path",
    "checked_same_article",
    "mouss_validation",
    "final_decision",
  ];
  const rows = proofs.map((proof) => [
    proof.rank,
    proof.productPriority,
    proof.productId,
    proof.productName,
    proof.categoryId,
    proof.proofZone,
    proof.fieldOrder,
    proof.fieldKey,
    proof.fieldLabel,
    proof.expectedFormat,
    proof.rejectIf,
    proof.status,
    proof.adminHref,
    proof.imageDepositDir,
    proof.manualInput.value,
    proof.manualInput.evidenceNote,
    proof.manualInput.captureOrFilePath,
    proof.manualInput.checkedSameArticle,
    proof.manualInput.moussValidation,
    proof.manualInput.finalDecision,
  ]);

  return `${headers.join(";")}\n${rows.map((row) => row.map(csvEscape).join(";")).join("\n")}\n`;
}

const dateKey = localDateKey();
const generatedAt = new Date().toISOString();
const sessionPath = findLatestFile(sessionRoot, /SESSION_SOURCING_INTEGRATION_\d+\.json$/);

if (!sessionPath) {
  throw new Error(`No integration sourcing session found in ${sessionRoot}`);
}

const auditPath = findLatestFile(auditRoot, /AUDIT_SESSION_SOURCING_INTEGRATION_\d+\.json$/);
const session = readJson(sessionPath);
const audit = auditPath ? readJson(auditPath) : null;
const proofs = buildNextProofs(session, 5);
const structuralFailures = validateProofs(proofs);

if (proofs.length === 0) {
  structuralFailures.push({
    rank: 0,
    code: "no_next_proofs_found",
  });
}

if (audit && audit.status !== "OK_SESSION_SOURCING_HOLD_SYNC") {
  structuralFailures.push({
    rank: 0,
    code: "session_audit_not_ok",
    value: audit.status,
  });
}

const outputDir = path.join(outputRoot, dateKey);
const proofDir = path.join(outputDir, "preuves");
fs.mkdirSync(proofDir, { recursive: true });

const payload = {
  generatedAt,
  mode: "read_only_integration_next_proofs_workpack",
  status:
    structuralFailures.length === 0
      ? "HOLD_NEXT_PROOFS_WORKPACK_READY"
      : "HOLD_NEXT_PROOFS_WORKPACK_A_CORRIGER",
  proofCount: proofs.length,
  auditStatus: audit?.status ?? "AUDIT_ABSENT",
  sources: {
    sessionPath,
    auditPath,
  },
  structuralFailures,
  proofs,
  safety: {
    readOnly: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noExternalContact: true,
    noImageDownload: true,
    manualValidationRequired: true,
  },
};

for (const proof of proofs) {
  const baseName = `preuve-${String(proof.rank).padStart(2, "0")}-${slugSafe(
    proof.productName,
  )}-${slugSafe(proof.fieldLabel)}`;
  fs.writeFileSync(path.join(proofDir, `${baseName}.md`), proofMarkdown(proof), "utf8");
  fs.writeFileSync(
    path.join(proofDir, `${baseName}.json`),
    `${JSON.stringify(proof, null, 2)}\n`,
    "utf8",
  );
}

const jsonPath = path.join(outputDir, `PROCHAINES_PREUVES_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `PROCHAINES_PREUVES_SOURCING_INTEGRATION_${dateKey}.md`);
const csvPath = path.join(outputDir, `PROCHAINES_PREUVES_SOURCING_INTEGRATION_${dateKey}.csv`);
const fillableCsvPath = path.join(outputDir, `A_REMPLIR_PREUVES_SOURCING_INTEGRATION_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(payload), "utf8");
fs.writeFileSync(csvPath, workCsv(proofs), "utf8");
fs.writeFileSync(fillableCsvPath, workCsv(proofs), "utf8");

console.log(
  JSON.stringify(
    {
      ok: structuralFailures.length === 0,
      mode: payload.mode,
      status: payload.status,
      proofCount: payload.proofCount,
      auditStatus: payload.auditStatus,
      structuralFailureCount: structuralFailures.length,
      files: {
        jsonPath,
        mdPath,
        csvPath,
        fillableCsvPath,
        proofDir,
      },
      safety: payload.safety,
    },
    null,
    2,
  ),
);

if (structuralFailures.length > 0) {
  process.exitCode = 1;
}

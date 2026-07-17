import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const top3Root = path.join(actionRoot, "top3-sourcing-integration-articles");
const top3AuditRoot = path.join(actionRoot, "audit-top3-sourcing-integration-articles");
const sessionRoot = path.join(actionRoot, "session-sourcing-integration-articles");
const outputRoot = path.join(actionRoot, "top3-preuves-paralleles-sourcing-integration-articles");

const criticalFieldKeys = [
  "exactProductUrl",
  "partnerName",
  "supplierSku",
  "exactVariant",
  "supplierPriceCents",
];
const forbiddenPattern = /\b(aliexpress|ali\s*express|alicdn|ae-pic|temu|dhgate|1688)\b/i;
const externalUrlPattern = /https?:\/\//i;
const sensitivePattern =
  /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|bearer|secret|password)\b\s*[:=]\s*["']?[^"',;\s]{8,}/i;
const keyLikePattern = /\b(sk|pk)_(live|test)_[A-Za-z0-9]{12,}\b|\bsk-[A-Za-z0-9]{12,}\b/i;

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

function walkFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return [];

  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
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

function latestFile(dir, pattern) {
  const files = walkFiles(dir, (filePath) => pattern.test(filePath));
  if (files.length === 0) {
    throw new Error(`No file matching ${pattern} found under ${dir}`);
  }

  return files
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0].filePath;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
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

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function isInternalAdminHref(value) {
  const text = String(value ?? "").trim();
  return (
    text.startsWith("/admin/") &&
    !text.startsWith("//") &&
    !externalUrlPattern.test(text) &&
    !forbiddenPattern.test(text) &&
    !sensitivePattern.test(text)
  );
}

function addFailure(failures, scope, code, message, details = {}) {
  failures.push({ scope, code, message, ...details });
}

function validateNoLeaks(value) {
  const serialized = JSON.stringify(value);
  const findings = [];
  const checks = [
    ["external_url", externalUrlPattern],
    ["marketplace_marker", forbiddenPattern],
    ["sensitive_assignment", sensitivePattern],
    ["key_like_value", keyLikePattern],
  ];

  for (const [type, regex] of checks) {
    if (regex.test(serialized)) {
      findings.push(type);
    }
  }

  return findings;
}

function buildProofs({ top3, top3Audit, session, structuralFailures }) {
  const sessionProducts = new Map((session.products ?? []).map((product) => [product.id, product]));
  const proofs = [];

  if (top3.status !== "HOLD_TOP3_SOURCING_READY") {
    addFailure(structuralFailures, "top3", "top3_not_ready", "Le sprint top 3 source n'est pas pret en HOLD.", {
      status: top3.status,
    });
  }

  if (top3Audit.status !== "OK_TOP3_SOURCING_GUARDED" || top3Audit.failureCount !== 0) {
    addFailure(structuralFailures, "top3_audit", "top3_audit_not_ok", "L'audit top 3 source n'est pas OK.", {
      status: top3Audit.status,
      failureCount: top3Audit.failureCount,
    });
  }

  for (const row of [...(top3.rows ?? [])].sort((a, b) => a.sprintRank - b.sprintRank)) {
    const product = sessionProducts.get(row.productId);
    if (!product) {
      addFailure(structuralFailures, "session", "top3_product_missing_in_session", "Produit top 3 absent de la session sourcing.", {
        productId: row.productId,
      });
      continue;
    }

    const fields = new Map((product.fields ?? []).map((field) => [field.key, field]));
    for (const fieldKey of criticalFieldKeys) {
      const field = fields.get(fieldKey);
      if (!field) {
        addFailure(structuralFailures, "session", "critical_field_missing", "Champ critique absent de la session.", {
          productId: row.productId,
          fieldKey,
        });
        continue;
      }

      proofs.push({
        rank: proofs.length + 1,
        top3Rank: row.sprintRank,
        productId: row.productId,
        productSlug: row.slug,
        productName: row.name,
        categoryId: row.categoryId,
        priorityScore: row.priorityScore,
        supplierMaxCost: row.supplierMaxCost,
        targetSalePrice: row.targetSalePrice,
        targetMargin: row.targetMargin,
        imageDepositDirRelative: row.imageDepositDirRelative,
        expectedImageFiles: row.expectedImageFiles ?? [],
        proofZone: field.zone,
        fieldOrder: field.order,
        fieldKey: field.key,
        fieldLabel: field.label,
        expectedFormat: field.expectedFormat,
        rejectIf: field.rejectIf,
        adminHref: field.adminHref || row.adminProofHref,
        status: field.status,
        manualInput: {
          value: "",
          evidenceNote: "",
          captureOrFilePath: "",
          checkedSameArticle: "",
          moussValidation: "",
          finalDecision: "HOLD_TO_FILL",
        },
        nextAction:
          "Remplir cette preuve critique pour le meme article exact, garder HOLD, puis relancer les audits.",
      });
    }
  }

  return proofs;
}

function validateProofs(proofs, structuralFailures) {
  for (const proof of proofs) {
    if (!isInternalAdminHref(proof.adminHref)) {
      addFailure(structuralFailures, "proof", "admin_href_not_internal", "Lien admin preuve non interne.", {
        productId: proof.productId,
        fieldKey: proof.fieldKey,
        adminHref: proof.adminHref,
      });
    }

    if (!criticalFieldKeys.includes(proof.fieldKey)) {
      addFailure(structuralFailures, "proof", "field_not_critical", "Champ non prevu dans le pack parallele.", {
        productId: proof.productId,
        fieldKey: proof.fieldKey,
      });
    }
  }
}

function proofMarkdown(proof) {
  return `${[
    `# Preuve parallele ${proof.rank} - ${proof.productName}`,
    "",
    `Rang top 3: ${proof.top3Rank}`,
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
    "## Images exactes attendues",
    "",
    ...proof.expectedImageFiles.map((fileName) => `- ${fileName}`),
    "",
    "## Liens et depots",
    "",
    `- Lien admin: ${proof.adminHref}`,
    `- Depot images exactes: ${proof.imageDepositDirRelative}`,
    "",
    "## Garde-fous",
    "",
    "- Ne pas publier.",
    "- Ne pas payer.",
    "- Ne pas commander.",
    "- Ne pas contacter un fournisseur automatiquement.",
    "- Ne pas copier d'image sans droits.",
    "- Garder HOLD jusqu'a preuves completes et validation humaine Mouss.",
    "",
  ].join("\n")}\n`;
}

function markdownReport(payload) {
  const rows = payload.proofs.map(
    (proof) =>
      `| ${proof.rank} | ${proof.top3Rank} | ${mdCell(proof.productName)} | ${mdCell(proof.proofZone)} | ${mdCell(
        proof.fieldLabel,
      )} | ${mdCell(proof.adminHref)} |`,
  );

  return `${[
    "# Maxi Trouvailles - Top 3 preuves paralleles sourcing",
    "",
    `Date locale: ${payload.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Statut: ${payload.status}`,
    `- Produits top 3: ${payload.productCount}`,
    `- Preuves critiques: ${payload.proofCount}`,
    `- Champs par produit: ${payload.criticalFieldKeys.join(", ")}`,
    `- Audit top 3 source: ${payload.top3AuditStatus}`,
    "",
    "## Preuves a remplir",
    "",
    "| # | Top 3 | Produit | Zone | Champ | Lien admin |",
    "|---:|---:|---|---|---|---|",
    ...rows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule cote catalogue.",
    "- Aucune preuve inventee.",
    "- Aucun fournisseur contacte.",
    "- Aucun paiement, achat, commande ou publication.",
    "- Les valeurs restent a remplir manuellement.",
    "- Toutes les fiches restent en HOLD jusqu'a validation humaine Mouss.",
    "",
  ].join("\n")}\n`;
}

function workCsv(proofs) {
  const headers = [
    "rank",
    "top3_rank",
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
    "expected_image_files",
    "manual_value",
    "evidence_note",
    "capture_or_file_path",
    "checked_same_article",
    "mouss_validation",
    "final_decision",
  ];
  const rows = proofs.map((proof) => [
    proof.rank,
    proof.top3Rank,
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
    proof.imageDepositDirRelative,
    proof.expectedImageFiles.join(" | "),
    proof.manualInput.value,
    proof.manualInput.evidenceNote,
    proof.manualInput.captureOrFilePath,
    proof.manualInput.checkedSameArticle,
    proof.manualInput.moussValidation,
    proof.manualInput.finalDecision,
  ]);

  return `${headers.join(";")}\n${rows.map((row) => row.map(csvEscape).join(";")).join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const top3Path = latestFile(top3Root, /TOP3_SOURCING_INTEGRATION_\d+\.json$/);
const top3AuditPath = latestFile(top3AuditRoot, /AUDIT_TOP3_SOURCING_INTEGRATION_\d+\.json$/);
const sessionPath = latestFile(sessionRoot, /SESSION_SOURCING_INTEGRATION_\d+\.json$/);
const top3 = readJson(top3Path);
const top3Audit = readJson(top3AuditPath);
const session = readJson(sessionPath);
const structuralFailures = [];
const proofs = buildProofs({ top3, top3Audit, session, structuralFailures });
validateProofs(proofs, structuralFailures);

if (proofs.length === 0) {
  addFailure(structuralFailures, "proofs", "no_parallel_proofs_found", "Aucune preuve parallele generee.");
}

const payload = {
  ok: structuralFailures.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_integration_top3_parallel_proofs_workpack",
  status:
    structuralFailures.length === 0
      ? "HOLD_TOP3_PARALLEL_PROOFS_WORKPACK_READY"
      : "HOLD_TOP3_PARALLEL_PROOFS_WORKPACK_A_CORRIGER",
  productCount: top3.productCount ?? 0,
  proofCount: proofs.length,
  proofsPerProductTarget: criticalFieldKeys.length,
  criticalFieldKeys,
  top3AuditStatus: top3Audit.status ?? "absent",
  structuralFailures,
  proofs,
  sources: {
    top3Path: rel(top3Path),
    top3AuditPath: rel(top3AuditPath),
    sessionPath: rel(sessionPath),
  },
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

const leakFindings = validateNoLeaks(payload);
if (leakFindings.length > 0) {
  payload.ok = false;
  payload.status = "FAIL_TOP3_PARALLEL_PROOFS_SENSITIVE_OUTPUT";
  payload.leakFindings = leakFindings;
}

const outputDir = path.join(outputRoot, dateKey);
const proofDir = path.join(outputDir, "preuves");
fs.mkdirSync(proofDir, { recursive: true });

for (const proof of proofs) {
  const baseName = `preuve-${String(proof.rank).padStart(2, "0")}-top${proof.top3Rank}-${slugSafe(
    proof.productName,
  )}-${slugSafe(proof.fieldLabel)}`;
  fs.writeFileSync(path.join(proofDir, `${baseName}.md`), proofMarkdown(proof), "utf8");
  fs.writeFileSync(path.join(proofDir, `${baseName}.json`), `${JSON.stringify(proof, null, 2)}\n`, "utf8");
}

const jsonPath = path.join(outputDir, `TOP3_PREUVES_PARALLELES_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `TOP3_PREUVES_PARALLELES_SOURCING_INTEGRATION_${dateKey}.md`);
const csvPath = path.join(outputDir, `top3-preuves-paralleles-sourcing-integration-${dateKey}.csv`);
const fillableCsvPath = path.join(outputDir, `A_REMPLIR_TOP3_PREUVES_PARALLELES_SOURCING_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(payload), "utf8");
fs.writeFileSync(csvPath, workCsv(proofs), "utf8");
fs.writeFileSync(fillableCsvPath, workCsv(proofs), "utf8");

console.log(
  JSON.stringify(
    {
      ok: payload.ok,
      mode: payload.mode,
      status: payload.status,
      productCount: payload.productCount,
      proofCount: payload.proofCount,
      proofsPerProductTarget: payload.proofsPerProductTarget,
      structuralFailureCount: payload.structuralFailures.length,
      files: { jsonPath, mdPath, csvPath, fillableCsvPath, proofDir },
      safety: payload.safety,
    },
    null,
    2,
  ),
);

if (!payload.ok) {
  process.exitCode = 1;
}

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workpackRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "prochaines-preuves-sourcing-integration-articles",
);
const outputRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "audit-prochaines-preuves-sourcing-integration-articles",
);
const imageDepositRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "depots-images-exactes",
  "integration-articles",
);

const requiredHeaders = [
  "rank",
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
const requiredSafetyFlags = [
  "readOnly",
  "noCatalogWrite",
  "noPublication",
  "noPayment",
  "noSupplierOrder",
  "noExternalContact",
  "noImageDownload",
  "manualValidationRequired",
];
const placeholderValues = [
  "a remplir",
  "a verifier",
  "todo",
  "tbd",
  "n/a",
  "na",
  "inconnu",
  "non renseigne",
  "placeholder",
  "exemple",
  "example",
  "dummy",
  "test",
  "lorem",
  "xxx",
];
const trueValues = new Set(["true", "oui", "yes", "y", "1", "ok", "valide", "validé"]);
const readyDecisionValues = new Set([
  "ready_review",
  "ready_for_human_review_hold",
  "pret_revue",
  "pret_revue_humaine",
]);
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
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ";" && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function readCsv(filePath) {
  if (!fs.existsSync(filePath)) {
    return { headers: [], rows: [] };
  }

  const lines = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });

  return { headers, rows };
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
    placeholderValues.some(
      (placeholder) => normalized === placeholder || normalized.includes(placeholder),
    )
  );
}

function looksTrue(value) {
  return trueValues.has(normalize(value));
}

function normalizeDecision(value) {
  return normalize(value).replace(/[\s-]+/g, "_");
}

function isReadyDecision(value) {
  return readyDecisionValues.has(normalizeDecision(value));
}

function isInternalAdminHref(value) {
  const text = String(value ?? "").trim();
  return text.startsWith("/admin/") && !text.startsWith("//") && !/^https?:\/\//i.test(text);
}

function isHttpUrl(value) {
  return /^https?:\/\/[^\s]+$/i.test(String(value ?? "").trim());
}

function isHttpsUrl(value) {
  return /^https:\/\/[^\s]+$/i.test(String(value ?? "").trim());
}

function looksSearchUrl(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return (
    /\/search\b/.test(text) ||
    /[?&](q|query|keyword|keywords|search|search_query|s)=/.test(text) ||
    text.includes("/recherche")
  );
}

function isInsidePath(child, parent) {
  if (!child || !parent) return false;

  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function centsFrom(value) {
  const match = String(value ?? "").match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!match) return null;

  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function integerFrom(value) {
  const normalized = String(value ?? "").trim();
  if (!/^\d+$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function valueState(value) {
  if (isBlankOrPlaceholder(value)) return "missing_or_placeholder";
  if (isHttpUrl(value)) return "url_redacted";
  if (/^[a-z]:\\/i.test(String(value ?? "")) || String(value ?? "").startsWith("/")) {
    return "path_or_internal_ref_redacted";
  }
  if (/^\d+(?:[.,]\d+)?$/.test(String(value ?? "").trim())) return "number_redacted";
  return "text_redacted";
}

function valueFingerprint(value) {
  if (isBlankOrPlaceholder(value)) return "";

  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

function addIssue(collection, scope, code, message, details = {}) {
  collection.push({
    scope,
    code,
    message,
    ...details,
  });
}

function proofKey(row) {
  return `${row.rank}:${row.product_id}:${row.field_key}`;
}

function proofExpectedKey(proof) {
  return `${proof.rank}:${proof.productId}:${proof.fieldKey}`;
}

function validateManualFields(proof, row) {
  const blockers = [];
  const manualValue = row?.manual_value ?? "";
  const evidenceNote = row?.evidence_note ?? "";
  const captureOrFilePath = row?.capture_or_file_path ?? "";
  const checkedSameArticle = row?.checked_same_article ?? "";
  const moussValidation = row?.mouss_validation ?? "";
  const finalDecision = row?.final_decision ?? "";
  const manualBundle = [
    manualValue,
    evidenceNote,
    captureOrFilePath,
    checkedSameArticle,
    moussValidation,
    finalDecision,
  ].join(" ");

  if (forbiddenSupplierPattern.test(manualBundle)) {
    blockers.push("forbidden_marketplace_value_detected");
  }

  if (sensitivePattern.test(manualBundle)) {
    blockers.push("sensitive_value_detected");
  }

  if (isBlankOrPlaceholder(manualValue)) {
    blockers.push("manual_value_missing_or_placeholder");
  }

  if (isBlankOrPlaceholder(evidenceNote)) {
    blockers.push("evidence_note_missing_or_placeholder");
  }

  if (isBlankOrPlaceholder(captureOrFilePath)) {
    blockers.push("capture_or_file_path_missing_or_placeholder");
  } else if (isHttpUrl(captureOrFilePath)) {
    blockers.push("capture_or_file_path_must_be_local_or_internal");
  }

  if (!looksTrue(checkedSameArticle)) {
    blockers.push("same_article_not_confirmed");
  }

  if (!looksTrue(moussValidation)) {
    blockers.push("mouss_validation_missing");
  }

  if (!isReadyDecision(finalDecision)) {
    blockers.push("final_decision_not_ready_review");
  }

  if (proof.fieldKey === "exactProductUrl") {
    if (!isHttpsUrl(manualValue)) {
      blockers.push("exact_product_url_must_be_https");
    }

    if (looksSearchUrl(manualValue)) {
      blockers.push("exact_product_url_looks_like_search_url");
    }
  }

  if (proof.fieldKey === "supplierSku") {
    const normalizedSku = normalize(manualValue);
    if (normalizedSku.length < 3 || !/[a-z0-9]/.test(normalizedSku)) {
      blockers.push("supplier_sku_not_stable");
    }
  }

  if (proof.fieldKey === "partnerName" && normalize(manualValue).length < 2) {
    blockers.push("partner_name_too_short");
  }

  if (proof.fieldKey === "exactVariant" && normalize(manualValue).length < 5) {
    blockers.push("exact_variant_too_vague");
  }

  if (proof.fieldKey === "supplierPriceCents") {
    const supplierPriceCents = integerFrom(manualValue);
    const maxCostCents = centsFrom(proof.supplierMaxCost);

    if (!supplierPriceCents || supplierPriceCents <= 0) {
      blockers.push("supplier_price_cents_invalid");
    } else if (maxCostCents && supplierPriceCents > maxCostCents) {
      blockers.push("supplier_price_above_target_max_cost");
    }
  }

  return {
    blockers: [...new Set(blockers)],
    states: {
      manualValue: valueState(manualValue),
      evidenceNote: valueState(evidenceNote),
      captureOrFilePath: valueState(captureOrFilePath),
      checkedSameArticle: looksTrue(checkedSameArticle) ? "confirmed" : "missing",
      moussValidation: looksTrue(moussValidation) ? "confirmed" : "missing",
      finalDecision: isReadyDecision(finalDecision) ? "ready_review" : "hold_or_missing",
      valueFingerprint: valueFingerprint(manualValue),
    },
  };
}

function auditProofRows(workpack, csvRows, failures, warnings) {
  const rowMap = new Map();
  const duplicateKeys = new Set();

  for (const row of csvRows) {
    const key = proofKey(row);
    if (rowMap.has(key)) {
      duplicateKeys.add(key);
      continue;
    }

    rowMap.set(key, row);
  }

  for (const key of duplicateKeys) {
    addIssue(
      failures,
      "fillable_csv",
      "duplicate_proof_row",
      "Le CSV contient une ligne preuve en double.",
      { key },
    );
  }

  const expectedKeys = new Set((workpack.proofs ?? []).map(proofExpectedKey));
  for (const row of csvRows) {
    const key = proofKey(row);
    if (!expectedKeys.has(key)) {
      addIssue(
        failures,
        "fillable_csv",
        "unexpected_proof_row",
        "Le CSV contient une preuve qui n'existe pas dans le workpack actif.",
        { key },
      );
    }
  }

  return (workpack.proofs ?? []).map((proof) => {
    const key = proofExpectedKey(proof);
    const row = rowMap.get(key);
    const structuralBlockers = [];

    if (!row) {
      structuralBlockers.push("row_missing_from_fillable_csv");
      addIssue(
        failures,
        "fillable_csv",
        "proof_row_missing",
        "Une preuve du workpack manque dans le CSV remplissable.",
        { key },
      );
    } else {
      const checks = [
        ["product_name", proof.productName],
        ["category_id", proof.categoryId],
        ["proof_zone", proof.proofZone],
        ["field_label", proof.fieldLabel],
        ["expected_format", proof.expectedFormat],
        ["reject_if", proof.rejectIf],
        ["admin_href", proof.adminHref],
        ["image_deposit_dir", proof.imageDepositDir],
      ];

      for (const [column, expected] of checks) {
        if (String(row[column] ?? "") !== String(expected ?? "")) {
          structuralBlockers.push(`csv_${column}_mismatch`);
          addIssue(
            failures,
            "fillable_csv",
            `proof_${column}_mismatch`,
            "Une colonne structurelle du CSV ne correspond pas au workpack.",
            { key, column },
          );
        }
      }

      if (!isInternalAdminHref(row.admin_href)) {
        structuralBlockers.push("admin_href_not_internal");
      }

      if (!isInsidePath(row.image_deposit_dir, imageDepositRoot)) {
        structuralBlockers.push("image_deposit_dir_outside_expected_root");
      }
    }

    const manualAudit = row ? validateManualFields(proof, row) : { blockers: [], states: {} };
    const blockers = [...new Set([...structuralBlockers, ...manualAudit.blockers])];
    const status = blockers.length === 0 ? "READY_FOR_HUMAN_REVIEW_HOLD" : "HOLD_TO_FILL";

    if (row && manualAudit.blockers.length > 0 && manualAudit.blockers.length < 5) {
      warnings.push({
        scope: "proof",
        code: "partial_manual_fill_detected",
        message: "Une preuve semble partiellement remplie et reste en HOLD.",
        rank: proof.rank,
        fieldKey: proof.fieldKey,
      });
    }

    return {
      rank: proof.rank,
      productId: proof.productId,
      productName: proof.productName,
      categoryId: proof.categoryId,
      proofZone: proof.proofZone,
      fieldKey: proof.fieldKey,
      fieldLabel: proof.fieldLabel,
      rowPresent: Boolean(row),
      status,
      blockerCount: blockers.length,
      blockers,
      manualStates: {
        manualValue: manualAudit.states.manualValue ?? "missing_or_placeholder",
        evidenceNote: manualAudit.states.evidenceNote ?? "missing_or_placeholder",
        captureOrFilePath: manualAudit.states.captureOrFilePath ?? "missing_or_placeholder",
        checkedSameArticle: manualAudit.states.checkedSameArticle ?? "missing",
        moussValidation: manualAudit.states.moussValidation ?? "missing",
        finalDecision: manualAudit.states.finalDecision ?? "hold_or_missing",
        valueFingerprint: manualAudit.states.valueFingerprint ?? "",
      },
      adminHref: proof.adminHref,
    };
  });
}

function markdownReport(payload) {
  const lines = [
    "# Audit prochaines preuves sourcing integration",
    "",
    `Date: ${payload.generatedAt}`,
    `Statut: ${payload.status}`,
    "",
    "## Synthese",
    "",
    `- Workpack: ${payload.sources.workpackPath}`,
    `- CSV terrain: ${payload.sources.fillableCsvPath}`,
    `- Preuves controlees: ${payload.proofCount}`,
    `- Preuves pretes revue humaine HOLD: ${payload.readyProofCount}`,
    `- Preuves encore HOLD: ${payload.holdProofCount}`,
    `- Echecs structurels: ${payload.structuralFailureCount}`,
    `- Blocages metier: ${payload.businessBlockerCount}`,
    `- Alertes: ${payload.warningCount}`,
    "",
    "## Valeurs fournisseur",
    "",
    "Les valeurs manuelles du CSV ne sont pas recopiees dans cet audit. Le rapport ne conserve que l'etat, les blocages et une empreinte courte non exploitable.",
    "",
    "## Preuves",
    "",
    "| # | Produit | Zone | Champ | Etat valeur | Article exact | Mouss | Decision | Statut | Blocages |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...payload.proofs.map((proof) =>
      [
        proof.rank,
        proof.productName,
        proof.proofZone,
        proof.fieldLabel,
        proof.manualStates.manualValue,
        proof.manualStates.checkedSameArticle,
        proof.manualStates.moussValidation,
        proof.manualStates.finalDecision,
        proof.status,
        proof.blockers.join(", ") || "aucun",
      ]
        .map((cell) => String(cell).replace(/\|/g, "/"))
        .join(" | "),
    ).map((row) => `| ${row} |`),
    "",
    "## Garde-fous",
    "",
    "- Lecture seule cote catalogue.",
    "- Aucune publication.",
    "- Aucun paiement ou commande fournisseur.",
    "- Aucun contact fournisseur automatique.",
    "- HOLD tant que preuve exacte, meme article, validation Mouss et decision revue ne sont pas completes.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

function csvReport(proofs) {
  const headers = [
    "rank",
    "product_id",
    "product_name",
    "proof_zone",
    "field_key",
    "field_label",
    "row_present",
    "manual_value_state",
    "evidence_note_state",
    "capture_state",
    "checked_same_article_state",
    "mouss_validation_state",
    "final_decision_state",
    "value_fingerprint",
    "blocker_count",
    "blockers",
    "status",
    "admin_href",
  ];
  const rows = proofs.map((proof) => [
    proof.rank,
    proof.productId,
    proof.productName,
    proof.proofZone,
    proof.fieldKey,
    proof.fieldLabel,
    proof.rowPresent,
    proof.manualStates.manualValue,
    proof.manualStates.evidenceNote,
    proof.manualStates.captureOrFilePath,
    proof.manualStates.checkedSameArticle,
    proof.manualStates.moussValidation,
    proof.manualStates.finalDecision,
    proof.manualStates.valueFingerprint,
    proof.blockerCount,
    proof.blockers.join("|"),
    proof.status,
    proof.adminHref,
  ]);

  return `${headers.join(";")}\n${rows.map((row) => row.map(csvEscape).join(";")).join("\n")}\n`;
}

const dateKey = localDateKey();
const generatedAt = new Date().toISOString();
const workpackPath = findLatestFile(
  workpackRoot,
  /PROCHAINES_PREUVES_SOURCING_INTEGRATION_\d+\.json$/,
);

if (!workpackPath) {
  throw new Error(`No next proofs workpack found in ${workpackRoot}`);
}

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const workpack = readJson(workpackPath);
const workpackDir = path.dirname(workpackPath);
const workpackDateKey = path.basename(workpackPath).match(/_(\d+)\.json$/)?.[1] ?? dateKey;
const fillableCsvPath = path.join(
  workpackDir,
  `A_REMPLIR_PREUVES_SOURCING_INTEGRATION_${workpackDateKey}.csv`,
);
const csv = readCsv(fillableCsvPath);
const structuralFailures = [];
const warnings = [];

if (!fs.existsSync(fillableCsvPath)) {
  addIssue(
    structuralFailures,
    "fillable_csv",
    "fillable_csv_missing",
    "Le CSV a remplir est introuvable pour le workpack actif.",
    { fillableCsvPath },
  );
}

if (workpack.status !== "HOLD_NEXT_PROOFS_WORKPACK_READY") {
  addIssue(
    structuralFailures,
    "workpack",
    "workpack_not_ready",
    "Le workpack source n'est pas dans un statut exploitable.",
    { status: workpack.status },
  );
}

for (const flag of requiredSafetyFlags) {
  if (workpack.safety?.[flag] !== true) {
    addIssue(
      structuralFailures,
      "workpack",
      "missing_safety_flag",
      "Un garde-fou du workpack source est absent.",
      { flag },
    );
  }
}

if ((workpack.structuralFailures ?? []).length > 0) {
  addIssue(
    structuralFailures,
    "workpack",
    "source_workpack_has_structural_failures",
    "Le workpack source contient deja des echecs structurels.",
  );
}

for (const header of requiredHeaders) {
  if (!csv.headers.includes(header)) {
    addIssue(
      structuralFailures,
      "fillable_csv",
      "missing_csv_header",
      "Le CSV terrain ne contient pas une colonne obligatoire.",
      { header },
    );
  }
}

if (csv.rows.length !== (workpack.proofs ?? []).length) {
  addIssue(
    structuralFailures,
    "fillable_csv",
    "proof_row_count_mismatch",
    "Le nombre de lignes du CSV ne correspond pas au workpack.",
    { csvRowCount: csv.rows.length, proofCount: (workpack.proofs ?? []).length },
  );
}

const proofs = auditProofRows(workpack, csv.rows, structuralFailures, warnings);
const businessBlockerCount = proofs.reduce((total, proof) => total + proof.blockerCount, 0);
const readyProofCount = proofs.filter((proof) => proof.status === "READY_FOR_HUMAN_REVIEW_HOLD").length;
const holdProofCount = proofs.length - readyProofCount;
const status =
  structuralFailures.length > 0
    ? "HOLD_NEXT_PROOFS_A_CORRIGER"
    : businessBlockerCount > 0
      ? "HOLD_NEXT_PROOFS_TO_FILL"
      : "READY_FOR_HUMAN_REVIEW_HOLD";

const payload = {
  generatedAt,
  mode: "read_only_audit_integration_next_proofs_workpack",
  status,
  proofCount: proofs.length,
  readyProofCount,
  holdProofCount,
  structuralFailureCount: structuralFailures.length,
  businessBlockerCount,
  warningCount: warnings.length,
  sources: {
    workpackPath,
    fillableCsvPath,
  },
  structuralFailures,
  warnings,
  proofs,
  safety: {
    readOnly: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noExternalContact: true,
    noImageDownload: true,
    valuesRedactedInAudit: true,
    manualValidationRequired: true,
  },
};

const jsonPath = path.join(outputDir, `AUDIT_PROCHAINES_PREUVES_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_PROCHAINES_PREUVES_SOURCING_INTEGRATION_${dateKey}.md`);
const csvPath = path.join(outputDir, `AUDIT_PROCHAINES_PREUVES_SOURCING_INTEGRATION_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(payload), "utf8");
fs.writeFileSync(csvPath, csvReport(proofs), "utf8");

console.log(
  JSON.stringify(
    {
      ok: structuralFailures.length === 0,
      mode: payload.mode,
      status: payload.status,
      proofCount: payload.proofCount,
      readyProofCount: payload.readyProofCount,
      holdProofCount: payload.holdProofCount,
      structuralFailureCount: payload.structuralFailureCount,
      businessBlockerCount: payload.businessBlockerCount,
      warningCount: payload.warningCount,
      files: {
        jsonPath,
        mdPath,
        csvPath,
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

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessRoot = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessRoot, "tableaux-action");
const packRoot = path.join(
  actionRoot,
  "pack-saisie-terrain-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const packAuditRoot = path.join(
  actionRoot,
  "audit-pack-saisie-terrain-lot-actif-prochaine-vague-sourcing-integration-articles",
);
const outputRoot = path.join(
  actionRoot,
  "audit-saisie-terrain-lot-actif-prochaine-vague-sourcing-integration-articles",
);

const proofRequiredFields = [
  "Valeur interne",
  "Note preuve locale",
  "Meme article confirme",
  "Variante exacte confirmee",
  "Validation Mouss",
  "Decision finale",
];
const proofPositiveFields = ["Meme article confirme", "Variante exacte confirmee", "Validation Mouss"];
const requiredSafetyFlags = [
  "readOnlyCompletionGate",
  "noCatalogWrite",
  "noPublicImageWrite",
  "noImageDownload",
  "noImageGeneration",
  "noSupplierValueExport",
  "noPublication",
  "noPayment",
  "noSupplierOrder",
  "noMessageSent",
  "manualValidationRequired",
];
const requiredContractSafetyFlags = [
  "noCatalogWrite",
  "noPublicImageWrite",
  "noImageDownload",
  "noImageGeneration",
  "noSupplierValueExport",
  "noPublication",
  "noPayment",
  "noSupplierOrder",
  "manualValidationRequired",
];
const criticalAcceptanceChecks = [
  "webpFileExistsAndValidHeader",
  "exactProductSameModelConfirmed",
  "exactVariantConfirmed",
  "skuMatchesSupplierProof",
  "supplierPriceRecordedInternally",
  "stockAndDelayRecordedInternally",
  "imageRightsConfirmed",
  "moussValidationApproved",
  "noApproximateImage",
  "noPublicCopy",
  "noMarketplaceClientLeak",
];
const placeholderPattern = /\b(A_REMPLIR|TO_FILL_HOLD|TO_DEPOSIT_HOLD|TO_DECIDE_HOLD)\b/i;
const positiveValuePattern = /\b(OUI|YES|OK|TRUE|CONFIRME|CONFIRMEE|VALIDE|VALIDEE|APPROVED|APPROUVEE)\b/i;
const rejectedValuePattern = /\b(NON|NO|FALSE|REJECT|REJETE|REFUSE)\b/i;
const externalUrlPattern = /https?:\/\//i;
const forbiddenPattern = /\b(aliexpress|ali\s*express|alicdn|ae-pic|temu|dhgate|1688)\b/i;
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
    if (!predicate || predicate(fullPath)) files.push(fullPath);
  }
  return files;
}

function latestFile(dir, pattern, label) {
  const files = walkFiles(dir, (filePath) => pattern.test(filePath));
  if (files.length === 0) throw new Error(`No ${label} found under ${dir}`);
  const todayKey = datePartsParis().dateKey;
  const matches = files
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return matches.find((match) => match.filePath.includes(todayKey))?.filePath ?? matches[0].filePath;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function absFromRel(relativePath) {
  return path.join(root, String(relativePath ?? "").replace(/\//g, path.sep));
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  if (/[",\n\r;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function addIssue(issues, scope, code, message, details = {}) {
  issues.push({ scope, code, message, ...details });
}

function regexEscape(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineValue(content, label) {
  const regex = new RegExp(`^- ${regexEscape(label)}:\\s*(.*)$`, "im");
  const match = content.match(regex);
  return match ? match[1].trim() : "";
}

function isFilled(value) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 && !placeholderPattern.test(normalized);
}

function isPositive(value) {
  const normalized = String(value ?? "").trim();
  return isFilled(normalized) && positiveValuePattern.test(normalized) && !rejectedValuePattern.test(normalized);
}

function isValidWebp(filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return { exists: false, validHeader: false, sizeBytes: 0 };
  }
  const buffer = fs.readFileSync(filePath);
  const validHeader =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return { exists: true, validHeader, sizeBytes: buffer.length };
}

function analyzeProof(entry) {
  const filePath = absFromRel(entry.targetPath);
  const blockers = [];
  if (!fs.existsSync(filePath)) {
    blockers.push("proof_file_missing");
    return {
      ...entry,
      status: "PROOF_INCOMPLETE_HOLD",
      fileExists: false,
      readyForHumanReview: false,
      blockerCount: blockers.length,
      blockers,
    };
  }

  const content = fs.readFileSync(filePath, "utf8");
  const missingFields = [];
  for (const field of proofRequiredFields) {
    const value = lineValue(content, field);
    if (!isFilled(value)) missingFields.push(field);
  }
  for (const field of proofPositiveFields) {
    const value = lineValue(content, field);
    if (!isPositive(value) && !missingFields.includes(field)) missingFields.push(field);
  }
  if (missingFields.length > 0) blockers.push(`proof_fields_incomplete:${missingFields.length}`);

  const readyForHumanReview = blockers.length === 0;
  return {
    ...entry,
    status: readyForHumanReview ? "PROOF_COMPLETE_HOLD" : "PROOF_INCOMPLETE_HOLD",
    fileExists: true,
    readyForHumanReview,
    missingFieldCount: missingFields.length,
    missingFields,
    blockerCount: blockers.length,
    blockers,
  };
}

function contractRequiredProofsComplete(contract) {
  const requiredProofs = contract?.requiredProofs ?? {};
  return Object.entries(requiredProofs)
    .filter(([, value]) => !isFilled(value) || /HOLD|MISSING|BLOCKED/i.test(String(value)))
    .map(([key]) => key);
}

function incompleteAcceptanceChecks(contract) {
  const checks = contract?.acceptanceChecks ?? {};
  return criticalAcceptanceChecks.filter((key) => checks[key] !== true);
}

function contractSafetyFailures(contract) {
  return requiredContractSafetyFlags.filter((flag) => contract?.safety?.[flag] !== true);
}

function analyzeWebp(entry) {
  const filePath = absFromRel(entry.targetPath);
  const contractPath = absFromRel(entry.contractPath);
  const webpState = isValidWebp(filePath);
  const blockers = [];
  let contract = null;

  if (!webpState.exists) blockers.push("webp_file_missing");
  if (webpState.exists && !webpState.validHeader) blockers.push("webp_header_invalid");

  if (!fs.existsSync(contractPath)) {
    blockers.push("webp_contract_missing");
  } else {
    contract = readJson(contractPath);
    const incompleteRequiredProofs = contractRequiredProofsComplete(contract);
    const incompleteChecks = incompleteAcceptanceChecks(contract);
    const safetyFailures = contractSafetyFailures(contract);
    if (incompleteRequiredProofs.length > 0) {
      blockers.push(`contract_required_proofs_incomplete:${incompleteRequiredProofs.length}`);
    }
    if (incompleteChecks.length > 0) {
      blockers.push(`contract_acceptance_checks_incomplete:${incompleteChecks.length}`);
    }
    if (safetyFailures.length > 0) {
      blockers.push(`contract_safety_flags_missing:${safetyFailures.length}`);
    }
    if (
      contract?.decision?.mayCopyToPublicUploads !== false ||
      contract?.decision?.mayPublishProduct !== false ||
      contract?.decision?.mayOrderSupplier !== false
    ) {
      blockers.push("contract_decision_not_safe_hold");
    }
  }

  const readyForHumanReview = blockers.length === 0;
  return {
    ...entry,
    status: readyForHumanReview ? "WEBP_READY_HUMAN_REVIEW_HOLD" : "WEBP_BLOCKED_HOLD",
    fileExists: webpState.exists,
    validHeader: webpState.validHeader,
    sizeBytes: webpState.sizeBytes,
    contractExists: Boolean(contract),
    readyForHumanReview,
    blockerCount: blockers.length,
    blockers,
  };
}

function scanSensitiveArtifacts(files) {
  const findings = [];
  for (const filePath of files) {
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      const checks = [
        ["external_url", externalUrlPattern],
        ["marketplace_marker", forbiddenPattern],
        ["sensitive_assignment", sensitivePattern],
        ["key_like_value", keyLikePattern],
      ];
      for (const [type, regex] of checks) {
        const match = line.match(regex);
        if (match) {
          findings.push({
            file: rel(filePath),
            line: index + 1,
            type,
            sample: match[0].slice(0, 80),
          });
        }
      }
    });
  }
  return findings;
}

function productsFromEntries(pack, analyzedEntries) {
  return (pack.products ?? []).map((product) => {
    const entries = analyzedEntries.filter((entry) => entry.productId === product.productId);
    const proofEntries = entries.filter((entry) => entry.entryType === "proof");
    const webpEntries = entries.filter((entry) => entry.entryType === "webp");
    const blockers = entries
      .filter((entry) => !entry.readyForHumanReview)
      .map((entry) => `${entry.entryType}:${entry.label}`);
    return {
      rank: product.rank,
      batchId: product.batchId,
      productId: product.productId,
      productName: product.productName,
      categoryId: product.categoryId,
      status:
        blockers.length === 0
          ? "READY_FIELD_COMPLETION_HUMAN_REVIEW_HOLD"
          : "BLOCKED_FIELD_COMPLETION_HOLD",
      readyForHumanReview: blockers.length === 0,
      proofEntryCount: proofEntries.length,
      proofReadyCount: proofEntries.filter((entry) => entry.readyForHumanReview).length,
      proofBlockedCount: proofEntries.filter((entry) => !entry.readyForHumanReview).length,
      webpEntryCount: webpEntries.length,
      webpReadyCount: webpEntries.filter((entry) => entry.readyForHumanReview).length,
      webpBlockedCount: webpEntries.filter((entry) => !entry.readyForHumanReview).length,
      blockerCount: blockers.length,
      blockers,
      nextAction:
        blockers.length === 0
          ? "Garder HOLD et ouvrir revue humaine Mouss."
          : `${proofEntries.filter((entry) => !entry.readyForHumanReview).length} preuves et ${webpEntries.filter((entry) => !entry.readyForHumanReview).length} WebP a completer avant revue.`,
    };
  });
}

function summaryMarkdown(summary) {
  const rows = summary.products.map(
    (product) =>
      `| ${product.rank} | ${mdCell(product.productName)} | ${product.status} | ${product.proofReadyCount}/${product.proofEntryCount} | ${product.webpReadyCount}/${product.webpEntryCount} | ${product.blockerCount} |`,
  );
  const issueRows =
    summary.structuralFailures.length === 0
      ? ["| OK | Aucun echec structurel | - |"]
      : summary.structuralFailures.map(
          (issue) => `| ${mdCell(issue.scope)} | ${mdCell(issue.code)} | ${mdCell(issue.message)} |`,
        );

  return `${[
    "# Gate saisie terrain lot actif",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    `Audit: ${summary.auditStatus}`,
    "",
    "## Synthese",
    "",
    `- Lot actif: ${summary.activeBatchId}`,
    `- Produits: ${summary.productCount}`,
    `- Entrees controlees: ${summary.entryCount}`,
    `- Preuves completes: ${summary.proofReadyCount}/${summary.proofEntryCount}`,
    `- WebP prets revue: ${summary.webpReadyCount}/${summary.webpEntryCount}`,
    `- Entrees bloquees HOLD: ${summary.blockedEntryCount}`,
    `- Produits prets revue humaine: ${summary.productReadyCount}`,
    "",
    "## Produits",
    "",
    "| Rang | Produit | Statut | Preuves | WebP | Blocages |",
    "|---:|---|---|---:|---:|---:|",
    ...rows,
    "",
    "## Echecs structurels",
    "",
    "| Portee | Code | Message |",
    "|---|---|---|",
    ...issueRows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule.",
    "- Aucune valeur fournisseur n'est exportee.",
    "- Aucun WebP n'est cree, telecharge ou copie en public.",
    "- Aucune publication ou commande fournisseur.",
    "",
  ].join("\n")}\n`;
}

function entriesCsv(entries) {
  const headers = [
    "rank",
    "product_id",
    "product_name",
    "entry_type",
    "label",
    "status",
    "ready_for_human_review",
    "blocker_count",
    "target_path",
    "contract_path",
  ];
  return `${headers.join(";")}\n${entries
    .map((entry) =>
      [
        entry.rank,
        entry.productId,
        entry.productName,
        entry.entryType,
        entry.label,
        entry.status,
        entry.readyForHumanReview,
        entry.blockerCount,
        entry.targetPath,
        entry.contractPath,
      ]
        .map(csvEscape)
        .join(";"),
    )
    .join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const packPath = latestFile(
  packRoot,
  /FIELD_ENTRY_PACK_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch field entry pack",
);
const packAuditPath = latestFile(
  packAuditRoot,
  /AUDIT_FIELD_ENTRY_PACK_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch field entry pack audit",
);
const pack = readJson(packPath);
const packAudit = readJson(packAuditPath);
const structuralFailures = [];

if (pack.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_FIELD_ENTRY_PACK_READY") {
  addIssue(structuralFailures, "field_entry_pack", "pack_status_invalid", "Le pack de saisie doit rester en HOLD.", {
    status: pack.status,
  });
}
if (packAudit.status !== "OK_NEXT_WAVE_ACTIVE_BATCH_FIELD_ENTRY_PACK_GUARDED") {
  addIssue(structuralFailures, "field_entry_pack_audit", "pack_audit_status_invalid", "L'audit du pack doit etre OK.", {
    status: packAudit.status,
  });
}
if (pack.productCount !== 4 || pack.entryCount !== 32 || pack.proofEntryCount !== 20 || pack.webpEntryCount !== 12) {
  addIssue(structuralFailures, "field_entry_pack", "pack_scope_invalid", "Le pack doit couvrir 4 produits et 32 entrees.", {
    productCount: pack.productCount,
    entryCount: pack.entryCount,
    proofEntryCount: pack.proofEntryCount,
    webpEntryCount: pack.webpEntryCount,
  });
}

const analyzedEntries = (pack.entries ?? []).map((entry) =>
  entry.entryType === "proof" ? analyzeProof(entry) : analyzeWebp(entry),
);
const products = productsFromEntries(pack, analyzedEntries);
const readyEntryCount = analyzedEntries.filter((entry) => entry.readyForHumanReview).length;
const blockedEntryCount = analyzedEntries.length - readyEntryCount;
const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: structuralFailures.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_integration_next_wave_active_batch_field_completion_gate",
  status:
    structuralFailures.length > 0
      ? "FAIL_NEXT_WAVE_ACTIVE_BATCH_FIELD_COMPLETION_GATE"
      : blockedEntryCount === 0
        ? "READY_NEXT_WAVE_ACTIVE_BATCH_FIELD_COMPLETION_HUMAN_REVIEW_HOLD"
        : "HOLD_NEXT_WAVE_ACTIVE_BATCH_FIELD_COMPLETION_BLOCKED",
  auditStatus:
    structuralFailures.length === 0
      ? "OK_NEXT_WAVE_ACTIVE_BATCH_FIELD_COMPLETION_GATE_GUARDED"
      : "FAIL_NEXT_WAVE_ACTIVE_BATCH_FIELD_COMPLETION_GATE",
  activeBatchId: pack.activeBatchId,
  productCount: products.length,
  productReadyCount: products.filter((product) => product.readyForHumanReview).length,
  productBlockedCount: products.filter((product) => !product.readyForHumanReview).length,
  entryCount: analyzedEntries.length,
  readyEntryCount,
  blockedEntryCount,
  proofEntryCount: analyzedEntries.filter((entry) => entry.entryType === "proof").length,
  proofReadyCount: analyzedEntries.filter((entry) => entry.entryType === "proof" && entry.readyForHumanReview).length,
  proofBlockedCount: analyzedEntries.filter((entry) => entry.entryType === "proof" && !entry.readyForHumanReview).length,
  webpEntryCount: analyzedEntries.filter((entry) => entry.entryType === "webp").length,
  webpReadyCount: analyzedEntries.filter((entry) => entry.entryType === "webp" && entry.readyForHumanReview).length,
  webpBlockedCount: analyzedEntries.filter((entry) => entry.entryType === "webp" && !entry.readyForHumanReview).length,
  validWebpFileCount: analyzedEntries.filter((entry) => entry.entryType === "webp" && entry.validHeader).length,
  missingWebpFileCount: analyzedEntries.filter((entry) => entry.entryType === "webp" && !entry.fileExists).length,
  invalidWebpFileCount: analyzedEntries.filter(
    (entry) => entry.entryType === "webp" && entry.fileExists && !entry.validHeader,
  ).length,
  structuralFailureCount: structuralFailures.length,
  structuralFailures,
  failureCount: structuralFailures.length,
  sensitiveFindingCount: 0,
  sensitiveValuesExported: false,
  products,
  entries: analyzedEntries,
  sources: {
    packPath: rel(packPath),
    packAuditPath: rel(packAuditPath),
  },
  safety: {
    readOnlyCompletionGate: true,
    noCatalogWrite: true,
    noPublicImageWrite: true,
    noImageDownload: true,
    noImageGeneration: true,
    noSupplierValueExport: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noMessageSent: true,
    manualValidationRequired: true,
  },
};

for (const flag of requiredSafetyFlags) {
  if (summary.safety[flag] !== true) {
    addIssue(structuralFailures, "safety", `safety_${flag}_missing`, "Garde-fou de sortie manquant.", { flag });
  }
}

const jsonPath = path.join(outputDir, `FIELD_COMPLETION_GATE_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `field-completion-gate-lot-actif-prochaine-vague-sourcing-${dateKey}.md`);
const csvPath = path.join(outputDir, `field-completion-gate-lot-actif-entrees-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, summaryMarkdown(summary), "utf8");
fs.writeFileSync(csvPath, entriesCsv(analyzedEntries), "utf8");

const sensitiveFindings = scanSensitiveArtifacts([jsonPath, mdPath, csvPath]);
if (sensitiveFindings.length > 0) {
  summary.ok = false;
  summary.status = "FAIL_NEXT_WAVE_ACTIVE_BATCH_FIELD_COMPLETION_GATE";
  summary.auditStatus = "FAIL_NEXT_WAVE_ACTIVE_BATCH_FIELD_COMPLETION_GATE";
  summary.sensitiveFindingCount = sensitiveFindings.length;
  summary.sensitiveFindings = sensitiveFindings;
  summary.failureCount = summary.structuralFailureCount + sensitiveFindings.length;
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdPath, summaryMarkdown(summary), "utf8");
}

console.log(
  JSON.stringify(
    {
      status: summary.status,
      auditStatus: summary.auditStatus,
      ok: summary.ok,
      activeBatchId: summary.activeBatchId,
      productCount: summary.productCount,
      entryCount: summary.entryCount,
      readyEntryCount: summary.readyEntryCount,
      blockedEntryCount: summary.blockedEntryCount,
      proofReadyCount: summary.proofReadyCount,
      webpReadyCount: summary.webpReadyCount,
      failureCount: summary.failureCount,
      outputDir: rel(outputDir),
    },
    null,
    2,
  ),
);

if (!summary.ok) process.exitCode = 1;

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const proofsRoot = path.join(actionRoot, "top3-preuves-paralleles-sourcing-integration-articles");
const proofsAuditRoot = path.join(actionRoot, "audit-top3-preuves-paralleles-sourcing-integration-articles");
const webpDepotAuditRoot = path.join(actionRoot, "audit-top3-webp-depot-files-sourcing-integration-articles");
const webpSessionAuditRoot = path.join(actionRoot, "audit-session-depot-top3-webp-sourcing-integration-articles");
const outputRoot = path.join(actionRoot, "audit-top3-business-gate-sourcing-integration-articles");

const readyProofDecisions = new Set([
  "READY_REVIEW",
  "READY_FOR_HUMAN_REVIEW",
  "READY_FOR_HUMAN_REVIEW_HOLD",
  "READY_BUSINESS_REVIEW_HOLD",
]);

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

function latestFile(dir, pattern, label) {
  const files = walkFiles(dir, (filePath) => pattern.test(filePath));
  if (files.length === 0) {
    throw new Error(`No ${label} found under ${dir}`);
  }

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

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  if (/[",\n\r;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function addIssue(issues, scope, code, message, details = {}) {
  issues.push({ scope, code, message, ...details });
}

function proofReady(proof) {
  const manual = proof.manualInput ?? {};
  const finalDecision = String(manual.finalDecision ?? "").trim();
  const checkedSameArticle = String(manual.checkedSameArticle ?? "").trim();
  const moussValidation = String(manual.moussValidation ?? "").trim();

  return (
    readyProofDecisions.has(finalDecision) &&
    checkedSameArticle.length > 0 &&
    !/^no?n?$/i.test(checkedSameArticle) &&
    moussValidation.length > 0 &&
    !/^no?n?$/i.test(moussValidation)
  );
}

function groupedProductSummaries(proofs, imageItems) {
  const summaries = new Map();

  for (const proof of proofs) {
    const current = summaries.get(proof.productId) ?? {
      top3Rank: proof.top3Rank,
      productId: proof.productId,
      productName: proof.productName,
      categoryId: proof.categoryId,
      proofCount: 0,
      readyProofCount: 0,
      missingProofCount: 0,
      imageTaskCount: 0,
      readyImageCount: 0,
      missingImageCount: 0,
      invalidImageCount: 0,
      missingProofLabels: [],
      missingImageLabels: [],
    };

    current.proofCount += 1;
    if (proofReady(proof)) {
      current.readyProofCount += 1;
    } else {
      current.missingProofCount += 1;
      current.missingProofLabels.push(proof.fieldLabel ?? proof.fieldKey);
    }
    summaries.set(proof.productId, current);
  }

  for (const item of imageItems) {
    const current = summaries.get(item.productId) ?? {
      top3Rank: item.top3Rank,
      productId: item.productId,
      productName: item.productName,
      categoryId: item.categoryId,
      proofCount: 0,
      readyProofCount: 0,
      missingProofCount: 0,
      imageTaskCount: 0,
      readyImageCount: 0,
      missingImageCount: 0,
      invalidImageCount: 0,
      missingProofLabels: [],
      missingImageLabels: [],
    };

    current.imageTaskCount += 1;
    if (item.status === "READY_FOR_HUMAN_REVIEW_HOLD") {
      current.readyImageCount += 1;
    } else if (item.status === "MISSING_HOLD") {
      current.missingImageCount += 1;
      current.missingImageLabels.push(`${item.role}: ${item.expectedFileName}`);
    } else {
      current.invalidImageCount += 1;
      current.missingImageLabels.push(`${item.role}: ${item.expectedFileName}`);
    }
    summaries.set(item.productId, current);
  }

  return [...summaries.values()].sort((a, b) => a.top3Rank - b.top3Rank);
}

function markdown(summary) {
  const productRows = summary.productSummaries.map(
    (item) =>
      `| ${item.top3Rank} | ${mdCell(item.productName)} | ${item.readyProofCount}/${item.proofCount} | ${item.readyImageCount}/${item.imageTaskCount} | ${item.missingProofCount + item.missingImageCount + item.invalidImageCount} |`,
  );
  const blockerRows = summary.productSummaries.flatMap((item) => [
    `| ${item.top3Rank} | ${mdCell(item.productName)} | preuves | ${mdCell(item.missingProofLabels.join(", ") || "OK")} |`,
    `| ${item.top3Rank} | ${mdCell(item.productName)} | images | ${mdCell(item.missingImageLabels.join(", ") || "OK")} |`,
  ]);
  const issueRows =
    summary.issues.length === 0
      ? ["| OK | Aucun echec structurel | - |"]
      : summary.issues.map(
          (issue) => `| ${mdCell(issue.scope)} | ${mdCell(issue.code)} | ${mdCell(issue.message)} |`,
        );

  return `${[
    "# Gate business top 3 integration",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Produits: ${summary.productCount}`,
    `- Preuves critiques pretes: ${summary.readyProofCount}/${summary.proofCount}`,
    `- Images exactes pretes: ${summary.readyImageCount}/${summary.imageTaskCount}`,
    `- Blocages business: ${summary.businessBlockerCount}`,
    `- Echecs structurels: ${summary.failureCount}`,
    `- Fuites sensibles: ${summary.sensitiveFindingCount}`,
    "- Publication: bloquee",
    "- Commande fournisseur: bloquee",
    "",
    "## Produits",
    "",
    "| Rang | Produit | Preuves | Images | Blocages |",
    "|---:|---|---:|---:|---:|",
    ...productRows,
    "",
    "## Blocages",
    "",
    "| Rang | Produit | Type | Restant |",
    "|---:|---|---|---|",
    ...blockerRows,
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
    "- Aucune valeur fournisseur brute exportee.",
    "- Aucun telechargement image.",
    "- Aucune copie publique.",
    "- Aucun paiement, aucune publication, aucune commande fournisseur.",
    "- Validation humaine Mouss obligatoire meme si tous les compteurs passent au vert.",
    "",
  ].join("\n")}\n`;
}

function toCsv(summary) {
  const headers = [
    "top3_rank",
    "product_id",
    "product_name",
    "proof_count",
    "ready_proof_count",
    "missing_proof_count",
    "image_task_count",
    "ready_image_count",
    "missing_image_count",
    "invalid_image_count",
    "business_blockers",
  ];

  return `${headers.join(";")}\n${summary.productSummaries
    .map((item) =>
      [
        item.top3Rank,
        item.productId,
        item.productName,
        item.proofCount,
        item.readyProofCount,
        item.missingProofCount,
        item.imageTaskCount,
        item.readyImageCount,
        item.missingImageCount,
        item.invalidImageCount,
        item.missingProofCount + item.missingImageCount + item.invalidImageCount,
      ]
        .map(csvEscape)
        .join(";"),
    )
    .join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const proofsPath = latestFile(
  proofsRoot,
  /TOP3_PREUVES_PARALLELES_SOURCING_INTEGRATION_\d+\.json$/,
  "top3 parallel proofs workpack",
);
const proofsAuditPath = latestFile(
  proofsAuditRoot,
  /AUDIT_TOP3_PREUVES_PARALLELES_SOURCING_INTEGRATION_\d+\.json$/,
  "top3 parallel proofs audit",
);
const depotAuditPath = latestFile(
  webpDepotAuditRoot,
  /AUDIT_TOP3_WEBP_DEPOT_FILES_SOURCING_INTEGRATION_\d+\.json$/,
  "top3 webp depot files audit",
);
const sessionAuditPath = latestFile(
  webpSessionAuditRoot,
  /AUDIT_SESSION_DEPOT_TOP3_WEBP_SOURCING_INTEGRATION_\d+\.json$/,
  "top3 webp depot session audit",
);

const proofs = readJson(proofsPath);
const proofsAudit = readJson(proofsAuditPath);
const depotAudit = readJson(depotAuditPath);
const sessionAudit = readJson(sessionAuditPath);
const issues = [];

if (proofs.status !== "HOLD_TOP3_PARALLEL_PROOFS_WORKPACK_READY") {
  addIssue(issues, "proofs", "proof_workpack_status_invalid", "Le pack preuves top 3 doit rester en HOLD pret.", {
    status: proofs.status,
  });
}

if (proofs.proofCount !== 15 || !Array.isArray(proofs.proofs) || proofs.proofs.length !== 15) {
  addIssue(issues, "proofs", "proof_scope_invalid", "Le gate attend 15 preuves critiques top 3.", {
    proofCount: proofs.proofCount,
    proofRows: Array.isArray(proofs.proofs) ? proofs.proofs.length : 0,
  });
}

if (proofsAudit.status !== "OK_TOP3_PARALLEL_PROOFS_GUARDED" || proofsAudit.failureCount !== 0) {
  addIssue(issues, "proofs_audit", "proof_audit_not_ok", "L'audit preuves top 3 n'est pas OK.", {
    status: proofsAudit.status,
    failureCount: proofsAudit.failureCount,
  });
}

if (
  depotAudit.status !== "HOLD_TOP3_WEBP_FILES_MISSING" &&
  depotAudit.status !== "READY_TOP3_WEBP_FILES_FOR_HUMAN_REVIEW_HOLD"
) {
  addIssue(issues, "webp_depot", "webp_depot_status_invalid", "L'audit depot WebP top 3 n'est pas exploitable.", {
    status: depotAudit.status,
  });
}

if (depotAudit.imageTaskCount !== 9 || depotAudit.failureCount !== 0 || depotAudit.invalidImageCount !== 0) {
  addIssue(issues, "webp_depot", "webp_depot_scope_invalid", "Le depot WebP top 3 doit couvrir 9 images sans invalide.", {
    imageTaskCount: depotAudit.imageTaskCount,
    failureCount: depotAudit.failureCount,
    invalidImageCount: depotAudit.invalidImageCount,
  });
}

if (sessionAudit.status !== "OK_TOP3_WEBP_DEPOT_SESSION_GUARDED" || sessionAudit.failureCount !== 0) {
  addIssue(issues, "webp_session", "webp_session_audit_not_ok", "La session depot WebP top 3 n'est pas auditee OK.", {
    status: sessionAudit.status,
    failureCount: sessionAudit.failureCount,
  });
}

const proofRows = Array.isArray(proofs.proofs) ? proofs.proofs : [];
const imageRows = Array.isArray(depotAudit.items) ? depotAudit.items : [];
const productSummaries = groupedProductSummaries(proofRows, imageRows);
const readyProofCount = proofRows.filter(proofReady).length;
const missingProofCount = proofRows.length - readyProofCount;
const readyImageCount = depotAudit.readyImageCount ?? 0;
const missingImageCount = depotAudit.missingCount ?? 0;
const invalidImageCount = depotAudit.invalidImageCount ?? 0;
const businessBlockerCount = missingProofCount + missingImageCount + invalidImageCount;
const structuralOk =
  issues.length === 0 &&
  proofsAudit.sensitiveFindingCount === 0 &&
  depotAudit.sensitiveFindingCount === 0 &&
  sessionAudit.sensitiveFindingCount === 0;
const status =
  structuralOk && businessBlockerCount === 0
    ? "READY_TOP3_BUSINESS_GATE_HUMAN_REVIEW_HOLD"
    : structuralOk
      ? "HOLD_TOP3_BUSINESS_GATE_BLOCKED"
      : "FAIL_TOP3_BUSINESS_GATE_GUARDS";

const summary = {
  ok: structuralOk,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_integration_top3_business_gate",
  status,
  productCount: productSummaries.length,
  proofCount: proofRows.length,
  readyProofCount,
  missingProofCount,
  imageTaskCount: depotAudit.imageTaskCount ?? imageRows.length,
  readyImageCount,
  missingImageCount,
  invalidImageCount,
  businessBlockerCount,
  failureCount: issues.length,
  sensitiveFindingCount:
    (proofsAudit.sensitiveFindingCount ?? 0) +
    (depotAudit.sensitiveFindingCount ?? 0) +
    (sessionAudit.sensitiveFindingCount ?? 0),
  issues,
  productSummaries,
  sources: {
    proofsPath: rel(proofsPath),
    proofsAuditPath: rel(proofsAuditPath),
    depotAuditPath: rel(depotAuditPath),
    sessionAuditPath: rel(sessionAuditPath),
  },
  safety: {
    readOnlyAudit: true,
    noCatalogWrite: true,
    noSupplierValueExport: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noImageDownload: true,
    noImageFileCreated: true,
    noPublicImageWrite: true,
    manualValidationRequired: true,
  },
};

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const jsonPath = path.join(outputDir, `AUDIT_TOP3_BUSINESS_GATE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_TOP3_BUSINESS_GATE_SOURCING_INTEGRATION_${dateKey}.md`);
const csvPath = path.join(outputDir, `audit-top3-business-gate-sourcing-integration-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, toCsv(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      status: summary.status,
      productCount: summary.productCount,
      proofCount: summary.proofCount,
      readyProofCount: summary.readyProofCount,
      missingProofCount: summary.missingProofCount,
      imageTaskCount: summary.imageTaskCount,
      readyImageCount: summary.readyImageCount,
      missingImageCount: summary.missingImageCount,
      invalidImageCount: summary.invalidImageCount,
      businessBlockerCount: summary.businessBlockerCount,
      failureCount: summary.failureCount,
      sensitiveFindingCount: summary.sensitiveFindingCount,
      files: { jsonPath, mdPath, csvPath },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

if (!summary.ok) {
  process.exitCode = 1;
}

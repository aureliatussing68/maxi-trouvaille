import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const activeBatchRoot = path.join(actionRoot, "lot-actif-prochaine-vague-sourcing-integration-articles");
const activeBatchAuditRoot = path.join(actionRoot, "audit-lot-actif-prochaine-vague-sourcing-integration-articles");
const outputRoot = path.join(actionRoot, "audit-lot-actif-business-gate-prochaine-vague-sourcing-integration-articles");
const allowedDepositPrefix = "business-maxi-trouvailles/depots-images-exactes/integration-articles/";

const readyDecisions = new Set([
  "READY_REVIEW",
  "READY_FOR_HUMAN_REVIEW",
  "READY_FOR_HUMAN_REVIEW_HOLD",
  "READY_BUSINESS_REVIEW_HOLD",
]);

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

function normalizeRel(value) {
  return String(value ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
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
  if (!fs.existsSync(filePath)) return { headers: [], rows: [] };

  const lines = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });

  return { headers, rows };
}

function addIssue(issues, scope, code, message, details = {}) {
  issues.push({ scope, code, message, ...details });
}

function isPositive(value) {
  const text = String(value ?? "").trim();
  return text.length > 0 && !/^no?n?$|^false$|^0$|^non$/i.test(text);
}

function isLocalProofPath(value) {
  const text = normalizeRel(value);
  if (!text) return false;
  return (
    !externalUrlPattern.test(text) &&
    !forbiddenPattern.test(text) &&
    !sensitivePattern.test(text) &&
    !path.isAbsolute(text) &&
    !text.includes("..")
  );
}

function proofReady(row) {
  const decision = String(row.final_decision ?? "").trim();
  return (
    isPositive(row.manual_value) &&
    isPositive(row.evidence_note) &&
    isLocalProofPath(row.local_proof_path) &&
    isPositive(row.checked_same_article) &&
    isPositive(row.mouss_validation) &&
    readyDecisions.has(decision)
  );
}

function imageFileStatus(row) {
  const depositDir = normalizeRel(row.deposit_dir);
  const expectedFileName = path.basename(String(row.expected_file_name ?? ""));
  const declaredLocalPath = normalizeRel(row.local_file_path);
  const expectedRelPath = `${depositDir}/${expectedFileName}`;
  const fileRelPath = declaredLocalPath || expectedRelPath;

  if (!depositDir.startsWith(allowedDepositPrefix) || depositDir.includes("..")) {
    return { status: "invalid_path", fileRelPath, validWebp: false };
  }

  if (!expectedFileName.endsWith(".webp")) {
    return { status: "invalid_filename", fileRelPath, validWebp: false };
  }

  if (declaredLocalPath && declaredLocalPath !== expectedRelPath) {
    return { status: "path_mismatch", fileRelPath, validWebp: false };
  }

  const absolutePath = path.join(root, fileRelPath);
  if (!fs.existsSync(absolutePath)) {
    return { status: "missing", fileRelPath, validWebp: false };
  }

  const header = fs.readFileSync(absolutePath, { encoding: null, flag: "r" }).subarray(0, 12);
  const validWebp =
    header.length >= 12 &&
    header.subarray(0, 4).toString("ascii") === "RIFF" &&
    header.subarray(8, 12).toString("ascii") === "WEBP";

  if (!validWebp) {
    return { status: "invalid_webp", fileRelPath, validWebp: false };
  }

  return { status: "valid_webp", fileRelPath, validWebp: true };
}

function imageReady(row) {
  const file = imageFileStatus(row);
  const decision = String(row.final_decision ?? "").trim();
  return (
    file.validWebp &&
    isPositive(row.checked_same_article) &&
    isPositive(row.rights_confirmed) &&
    isPositive(row.variant_confirmed) &&
    isPositive(row.mouss_validation) &&
    readyDecisions.has(decision)
  );
}

function productSummaries(batch, proofRows, imageRows) {
  return (batch.products ?? []).map((product) => {
    const productProofs = proofRows.filter((row) => row.product_id === product.productId);
    const productImages = imageRows.filter((row) => row.product_id === product.productId);
    const missingProofLabels = productProofs
      .filter((row) => !proofReady(row))
      .map((row) => row.label || row.proof_key || "preuve");
    const missingImageLabels = productImages
      .filter((row) => !imageReady(row))
      .map((row) => `${row.role || "image"}: ${row.expected_file_name || "fichier attendu"}`);
    const invalidImageLabels = productImages
      .filter((row) => {
        const status = imageFileStatus(row).status;
        return !["missing", "valid_webp"].includes(status);
      })
      .map((row) => `${row.role || "image"}: ${imageFileStatus(row).status}`);

    return {
      rank: product.nextWaveRank,
      batchId: product.batchId,
      productId: product.productId,
      productName: product.productName,
      categoryId: product.categoryId,
      proofCount: productProofs.length,
      readyProofCount: productProofs.filter(proofReady).length,
      missingProofCount: missingProofLabels.length,
      imageTaskCount: productImages.length,
      readyImageCount: productImages.filter(imageReady).length,
      missingImageCount: productImages.filter((row) => imageFileStatus(row).status === "missing").length,
      invalidImageCount: invalidImageLabels.length,
      missingProofLabels,
      missingImageLabels,
      invalidImageLabels,
    };
  });
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

function markdown(summary) {
  const productRows = summary.productSummaries.map(
    (item) =>
      `| ${item.rank} | ${mdCell(item.productName)} | ${item.readyProofCount}/${item.proofCount} | ${item.readyImageCount}/${item.imageTaskCount} | ${item.missingProofCount + item.missingImageCount + item.invalidImageCount} |`,
  );
  const blockerRows = summary.productSummaries.flatMap((item) => [
    `| ${item.rank} | ${mdCell(item.productName)} | preuves | ${mdCell(item.missingProofLabels.join(", ") || "OK")} |`,
    `| ${item.rank} | ${mdCell(item.productName)} | images | ${mdCell(item.missingImageLabels.join(", ") || "OK")} |`,
    `| ${item.rank} | ${mdCell(item.productName)} | invalides | ${mdCell(item.invalidImageLabels.join(", ") || "OK")} |`,
  ]);
  const issueRows =
    summary.issues.length === 0
      ? ["| OK | Aucun echec structurel | - |"]
      : summary.issues.map(
          (issue) => `| ${mdCell(issue.scope)} | ${mdCell(issue.code)} | ${mdCell(issue.message)} |`,
        );

  return `${[
    "# Gate business lot actif prochaine vague",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Lot actif: ${summary.activeBatchId}`,
    `- Produits: ${summary.productCount}`,
    `- Preuves critiques pretes: ${summary.readyProofCount}/${summary.proofCount}`,
    `- Images exactes pretes: ${summary.readyImageCount}/${summary.imageTaskCount}`,
    `- Images manquantes: ${summary.missingImageCount}`,
    `- Images invalides: ${summary.invalidImageCount}`,
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
    "batch_id",
    "rank",
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
        item.batchId,
        item.rank,
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
const activeBatchPath = latestFile(
  activeBatchRoot,
  /ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch",
);
const activeBatchAuditPath = latestFile(
  activeBatchAuditRoot,
  /AUDIT_ACTIVE_BATCH_NEXT_WAVE_SOURCING_INTEGRATION_\d+\.json$/,
  "next wave active batch audit",
);

const batch = readJson(activeBatchPath);
const activeBatchAudit = readJson(activeBatchAuditPath);
const proofCsvPath = path.join(root, activeBatchAudit.sources?.proofCsvPath ?? "");
const imageCsvPath = path.join(root, activeBatchAudit.sources?.imageCsvPath ?? "");
const proofCsv = readCsv(proofCsvPath);
const imageCsv = readCsv(imageCsvPath);
const issues = [];

if (batch.status !== "HOLD_NEXT_WAVE_ACTIVE_BATCH_READY") {
  addIssue(issues, "active_batch", "active_batch_status_invalid", "Le lot actif doit rester en HOLD pret.", {
    status: batch.status,
  });
}

if (batch.activeBatchId !== "lot-01") {
  addIssue(issues, "active_batch", "active_batch_id_invalid", "Le gate attend le lot actif lot-01.", {
    activeBatchId: batch.activeBatchId,
  });
}

if (batch.productCount !== 4 || !Array.isArray(batch.products) || batch.products.length !== 4) {
  addIssue(issues, "active_batch", "active_batch_product_scope_invalid", "Le lot actif doit couvrir 4 produits.", {
    productCount: batch.productCount,
    productRows: Array.isArray(batch.products) ? batch.products.length : 0,
  });
}

if (batch.proofTaskCount !== 20 || proofCsv.rows.length !== 20) {
  addIssue(issues, "proofs", "active_batch_proof_scope_invalid", "Le gate attend 20 preuves terrain.", {
    proofTaskCount: batch.proofTaskCount,
    proofCsvRows: proofCsv.rows.length,
  });
}

if (batch.imageTaskCount !== 12 || imageCsv.rows.length !== 12) {
  addIssue(issues, "images", "active_batch_image_scope_invalid", "Le gate attend 12 images WebP.", {
    imageTaskCount: batch.imageTaskCount,
    imageCsvRows: imageCsv.rows.length,
  });
}

if (batch.actionCount !== 32) {
  addIssue(issues, "active_batch", "active_batch_action_count_invalid", "Le lot actif doit exposer 32 actions terrain.", {
    actionCount: batch.actionCount,
  });
}

if (activeBatchAudit.status !== "OK_NEXT_WAVE_ACTIVE_BATCH_GUARDED" || activeBatchAudit.failureCount !== 0) {
  addIssue(issues, "active_batch_audit", "active_batch_audit_not_ok", "L'audit du lot actif n'est pas OK.", {
    status: activeBatchAudit.status,
    failureCount: activeBatchAudit.failureCount,
  });
}

const summaries = productSummaries(batch, proofCsv.rows, imageCsv.rows);
const readyProofCount = proofCsv.rows.filter(proofReady).length;
const missingProofCount = proofCsv.rows.length - readyProofCount;
const imageStates = imageCsv.rows.map((row) => ({ row, file: imageFileStatus(row), ready: imageReady(row) }));
const readyImageCount = imageStates.filter((item) => item.ready).length;
const missingImageCount = imageStates.filter((item) => item.file.status === "missing").length;
const invalidImageCount = imageStates.filter((item) => !["missing", "valid_webp"].includes(item.file.status)).length;
const businessBlockerCount = missingProofCount + missingImageCount + invalidImageCount;
const structuralOk =
  issues.length === 0 &&
  (activeBatchAudit.sensitiveFindingCount ?? 0) === 0 &&
  summaries.length === 4 &&
  proofCsv.rows.every((row) => row.status === "TO_FILL_HOLD") &&
  imageCsv.rows.every((row) => row.status === "TO_DEPOSIT_HOLD");
const status =
  structuralOk && businessBlockerCount === 0
    ? "READY_NEXT_WAVE_ACTIVE_BATCH_BUSINESS_GATE_HUMAN_REVIEW_HOLD"
    : structuralOk
      ? "HOLD_NEXT_WAVE_ACTIVE_BATCH_BUSINESS_GATE_BLOCKED"
      : "FAIL_NEXT_WAVE_ACTIVE_BATCH_BUSINESS_GATE_GUARDS";

const summary = {
  ok: structuralOk,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_integration_next_wave_active_batch_business_gate",
  status,
  activeBatchId: batch.activeBatchId,
  productCount: summaries.length,
  proofCount: proofCsv.rows.length,
  readyProofCount,
  missingProofCount,
  imageTaskCount: imageCsv.rows.length,
  readyImageCount,
  missingImageCount,
  invalidImageCount,
  businessBlockerCount,
  failureCount: issues.length,
  sensitiveFindingCount: activeBatchAudit.sensitiveFindingCount ?? 0,
  issues,
  productSummaries: summaries,
  sources: {
    activeBatchPath: rel(activeBatchPath),
    activeBatchAuditPath: rel(activeBatchAuditPath),
    proofCsvPath: rel(proofCsvPath),
    imageCsvPath: rel(imageCsvPath),
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

const jsonPath = path.join(outputDir, `AUDIT_ACTIVE_BATCH_BUSINESS_GATE_NEXT_WAVE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `audit-lot-actif-business-gate-prochaine-vague-sourcing-${dateKey}.md`);
const csvPath = path.join(outputDir, `audit-lot-actif-business-gate-prochaine-vague-sourcing-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, toCsv(summary), "utf8");

const outputFindings = scanSensitiveArtifacts([jsonPath, mdPath, csvPath]);
if (outputFindings.length > 0) {
  summary.ok = false;
  summary.status = "FAIL_NEXT_WAVE_ACTIVE_BATCH_BUSINESS_GATE_GUARDS";
  summary.sensitiveFindingCount += outputFindings.length;
  summary.issues.push(
    ...outputFindings.map((finding) => ({
      scope: "output",
      code: "sensitive_output_finding",
      message: "Une sortie du gate contient un marqueur sensible.",
      file: finding.file,
      line: finding.line,
      type: finding.type,
    })),
  );
  summary.failureCount = summary.issues.length;
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdPath, markdown(summary), "utf8");
}

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      status: summary.status,
      activeBatchId: summary.activeBatchId,
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

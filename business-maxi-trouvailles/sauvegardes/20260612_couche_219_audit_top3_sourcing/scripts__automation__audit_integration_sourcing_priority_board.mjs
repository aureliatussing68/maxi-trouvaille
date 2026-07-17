import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const boardRoot = path.join(actionRoot, "pilotage-sourcing-integration-articles");
const outputRoot = path.join(actionRoot, "audit-pilotage-sourcing-integration-articles");
const imageDepositRoot = path.join(root, "business-maxi-trouvailles", "depots-images-exactes", "integration-articles");

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
const requiredFilesForBoard = ["json", "md", "csv"];
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function resolveFromRoot(relativeOrAbsolutePath) {
  return path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.resolve(root, relativeOrAbsolutePath);
}

function isInsidePath(child, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
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

function csvEscape(value) {
  const text = String(value ?? "");
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

function missingSessionFields(product) {
  return (product.fields ?? []).filter(
    (field) => field.required && String(field.status ?? "").toUpperCase().includes("HOLD"),
  );
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

function validateBoardArtifacts({ boardPath, board, session, sessionAudit, files }) {
  const issues = [];
  const boardDir = path.dirname(boardPath);
  const sessionProducts = session.products ?? [];
  const sessionIds = new Set(sessionProducts.map((product) => product.id));
  const rowIds = new Set((board.rows ?? []).map((row) => row.productId));
  const sessionMissingFieldCount = sessionProducts.reduce(
    (sum, product) => sum + missingSessionFields(product).length,
    0,
  );
  const sessionExpectedImageCount = sessionProducts.reduce(
    (sum, product) => sum + (product.imageTasks ?? []).length,
    0,
  );
  const boardExpectedImageCount = (board.rows ?? []).reduce((sum, row) => sum + (Number(row.imageTaskCount) || 0), 0);
  const boardMissingFieldCount = (board.rows ?? []).reduce(
    (sum, row) => sum + (Number(row.missingFieldCount) || 0),
    0,
  );

  if (board.mode !== "read_only_integration_sourcing_priority_board") {
    addIssue(issues, "board", "INVALID_MODE", "Le mode du board pilotage est inattendu.", { mode: board.mode });
  }

  if (board.status !== "HOLD_PRIORITY_BOARD_READY") {
    addIssue(issues, "board", "INVALID_STATUS", "Le board doit rester en statut HOLD pret a piloter.", {
      status: board.status,
    });
  }

  for (const flag of requiredSafetyFlags) {
    if (board.safety?.[flag] !== true) {
      addIssue(issues, "safety", "MISSING_SAFETY_FLAG", `Garde-fou manquant: ${flag}.`, { flag });
    }
  }

  for (const extension of requiredFilesForBoard) {
    const expectedPath = path.join(boardDir, `PILOTAGE_SOURCING_INTEGRATION_${boardDateKey(boardPath)}.${extension}`);
    if (!files.includes(expectedPath)) {
      addIssue(issues, "files", "MISSING_BOARD_FILE", `Fichier ${extension} du board introuvable.`, {
        file: rel(expectedPath),
      });
    }
  }

  if ((board.rows ?? []).length !== sessionProducts.length || board.productCount !== sessionProducts.length) {
    addIssue(issues, "counts", "PRODUCT_COUNT_MISMATCH", "Le nombre de produits du board ne suit pas la session.", {
      boardRows: (board.rows ?? []).length,
      boardProductCount: board.productCount,
      sessionProductCount: sessionProducts.length,
    });
  }

  for (const product of sessionProducts) {
    if (!rowIds.has(product.id)) {
      addIssue(issues, "rows", "MISSING_PRODUCT_ROW", "Produit de session absent du board pilotage.", {
        productId: product.id,
      });
    }
  }

  for (const row of board.rows ?? []) {
    if (!sessionIds.has(row.productId)) {
      addIssue(issues, "rows", "UNKNOWN_PRODUCT_ROW", "Produit du board absent de la session source.", {
        productId: row.productId,
      });
    }

    if (row.safetyStatus !== "HOLD_SOURCING_NO_PUBLICATION") {
      addIssue(issues, "rows", "ROW_NOT_HOLD", "Une ligne du board ne porte pas le statut HOLD attendu.", {
        productId: row.productId,
        safetyStatus: row.safetyStatus,
      });
    }

    if (!isInternalAdminHref(row.adminProofHref)) {
      addIssue(issues, "rows", "INVALID_ADMIN_HREF", "Lien admin absent ou non interne.", {
        productId: row.productId,
        adminProofHref: row.adminProofHref,
      });
    }

    const depositDir = resolveFromRoot(row.imageDepositDir ?? "");
    if (!isInsidePath(depositDir, imageDepositRoot)) {
      addIssue(issues, "rows", "INVALID_IMAGE_DEPOSIT_DIR", "Dossier WebP hors depot integration autorise.", {
        productId: row.productId,
        imageDepositDir: row.imageDepositDir,
      });
    }

    if (!String(row.immediateAction ?? "").toUpperCase().includes("HOLD")) {
      addIssue(issues, "rows", "ACTION_WITHOUT_HOLD", "Action immediate sans rappel HOLD.", {
        productId: row.productId,
        immediateAction: row.immediateAction,
      });
    }
  }

  if (board.totalMissingFieldCount !== sessionMissingFieldCount || boardMissingFieldCount !== sessionMissingFieldCount) {
    addIssue(issues, "counts", "MISSING_FIELD_COUNT_MISMATCH", "Compteur de preuves manquantes incoherent.", {
      boardTotalMissingFieldCount: board.totalMissingFieldCount,
      boardRowMissingFieldCount: boardMissingFieldCount,
      sessionMissingFieldCount,
    });
  }

  if (board.expectedImageCount !== sessionExpectedImageCount || boardExpectedImageCount !== sessionExpectedImageCount) {
    addIssue(issues, "counts", "EXPECTED_IMAGE_COUNT_MISMATCH", "Compteur de WebP attendus incoherent.", {
      boardExpectedImageCount: board.expectedImageCount,
      boardRowExpectedImageCount: boardExpectedImageCount,
      sessionExpectedImageCount,
    });
  }

  if (board.validImageCount < 0 || board.validImageCount > board.expectedImageCount) {
    addIssue(issues, "counts", "VALID_IMAGE_COUNT_INVALID", "Compteur de WebP valides impossible.", {
      validImageCount: board.validImageCount,
      expectedImageCount: board.expectedImageCount,
    });
  }

  for (const proof of board.proofLanes?.firstProofs ?? []) {
    if (!isInternalAdminHref(proof.adminHref)) {
      addIssue(issues, "proofs", "INVALID_PROOF_ADMIN_HREF", "Lien admin de preuve non interne.", {
        productId: proof.productId,
        fieldKey: proof.fieldKey,
        adminHref: proof.adminHref,
      });
    }
  }

  if (!["OK_HOLD_SOURCING_SESSION_SYNCED", "OK_SESSION_SOURCING_HOLD_SYNC"].includes(sessionAudit.status)) {
    addIssue(issues, "sources", "SESSION_AUDIT_NOT_SYNCED", "L'audit session source n'est pas synchronise.", {
      status: sessionAudit.status,
    });
  }

  return issues;
}

function boardDateKey(boardPath) {
  const match = path.basename(boardPath).match(/_(\d{8})\.json$/);
  return match?.[1] ?? datePartsParis().dateKey;
}

function toCsv(summary) {
  const headers = ["scope", "code", "message", "productId", "file"];
  const rows = summary.issues.map((issue) =>
    headers.map((header) => csvEscape(issue[header] ?? "")).join(";"),
  );
  return `${headers.join(";")}\n${rows.join("\n")}${rows.length ? "\n" : ""}`;
}

function markdown(summary) {
  const issueRows =
    summary.issues.length === 0
      ? ["| OK | Aucun echec | - | - |"]
      : summary.issues.map(
          (issue) =>
            `| ${mdCell(issue.scope)} | ${mdCell(issue.code)} | ${mdCell(issue.message)} | ${mdCell(
              issue.productId ?? issue.file ?? "-",
            )} |`,
        );

  const sensitiveRows =
    summary.sensitiveFindings.length === 0
      ? ["| OK | Aucun marqueur sensible detecte | - | - |"]
      : summary.sensitiveFindings.map(
          (finding) =>
            `| ${mdCell(finding.type)} | ${mdCell(finding.file)} | ${finding.line} | ${mdCell(finding.sample)} |`,
        );

  return `${[
    "# Audit pilotage sourcing integration",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Statut: ${summary.status}`,
    `- Produits controles: ${summary.productCount}`,
    `- Champs de preuve manquants: ${summary.totalMissingFieldCount}`,
    `- WebP attendus: ${summary.expectedImageCount}`,
    `- WebP valides: ${summary.validImageCount}`,
    `- Echecs structurels: ${summary.failureCount}`,
    `- Alertes sensibles: ${summary.sensitiveFindingCount}`,
    "",
    "## Echecs structurels",
    "",
    "| Portee | Code | Message | Detail |",
    "|---|---|---|---|",
    ...issueRows,
    "",
    "## Scan sensible",
    "",
    "| Type | Fichier | Ligne | Extrait |",
    "|---|---|---:|---|",
    ...sensitiveRows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule.",
    "- Aucune ecriture catalogue.",
    "- Aucune publication.",
    "- Aucun paiement.",
    "- Aucune commande fournisseur.",
    "- Aucun telechargement image.",
    "",
  ].join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const boardPath = latestFile(boardRoot, /PILOTAGE_SOURCING_INTEGRATION_\d+\.json$/);
const boardDir = path.dirname(boardPath);
const boardKey = boardDateKey(boardPath);
const board = readJson(boardPath);
const boardFiles = [
  boardPath,
  path.join(boardDir, `PILOTAGE_SOURCING_INTEGRATION_${boardKey}.md`),
  path.join(boardDir, `PILOTAGE_SOURCING_INTEGRATION_${boardKey}.csv`),
].filter((filePath) => fs.existsSync(filePath));

const sessionPath = resolveFromRoot(board.sources?.sessionPath ?? "");
const sessionAuditPath = resolveFromRoot(board.sources?.sessionAuditPath ?? "");
const session = readJson(sessionPath);
const sessionAudit = readJson(sessionAuditPath);
const issues = validateBoardArtifacts({ boardPath, board, session, sessionAudit, files: boardFiles });
const sensitiveFindings = scanSensitiveArtifacts(boardFiles);

const summary = {
  ok: issues.length === 0 && sensitiveFindings.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_integration_sourcing_priority_board_audit",
  status:
    issues.length === 0 && sensitiveFindings.length === 0
      ? "OK_PRIORITY_BOARD_GUARDED"
      : "FAIL_PRIORITY_BOARD_GUARDS",
  productCount: board.productCount ?? 0,
  totalMissingFieldCount: board.totalMissingFieldCount ?? 0,
  expectedImageCount: board.expectedImageCount ?? 0,
  validImageCount: board.validImageCount ?? 0,
  scannedFileCount: boardFiles.length,
  failureCount: issues.length,
  sensitiveFindingCount: sensitiveFindings.length,
  issues,
  sensitiveFindings,
  sources: {
    boardPath: rel(boardPath),
    sessionPath: rel(sessionPath),
    sessionAuditPath: rel(sessionAuditPath),
  },
  safety: {
    readOnlyAudit: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noImageDownload: true,
    manualValidationRequired: true,
  },
};

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const jsonPath = path.join(outputDir, `AUDIT_PILOTAGE_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_PILOTAGE_SOURCING_INTEGRATION_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-audit-pilotage-sourcing-integration-${dateKey}.csv`);

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
      totalMissingFieldCount: summary.totalMissingFieldCount,
      expectedImageCount: summary.expectedImageCount,
      validImageCount: summary.validImageCount,
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

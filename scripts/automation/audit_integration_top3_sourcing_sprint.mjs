import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const top3Root = path.join(actionRoot, "top3-sourcing-integration-articles");
const outputRoot = path.join(actionRoot, "audit-top3-sourcing-integration-articles");
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

function top3DateKey(top3Path) {
  const match = path.basename(top3Path).match(/_(\d{8})\.json$/);
  return match?.[1] ?? datePartsParis().dateKey;
}

function validateTop3Artifacts({ top3, top3Path, files }) {
  const issues = [];
  const top3Dir = path.dirname(top3Path);
  const fileDateKey = top3DateKey(top3Path);
  const expectedFiles = [
    top3Path,
    path.join(top3Dir, `TOP3_SOURCING_INTEGRATION_${fileDateKey}.md`),
    path.join(top3Dir, `maxi-top3-sourcing-integration-${fileDateKey}.csv`),
  ];

  for (const expectedPath of expectedFiles) {
    if (!files.includes(expectedPath)) {
      addIssue(issues, "files", "MISSING_TOP3_FILE", "Un fichier top 3 attendu est introuvable.", {
        file: rel(expectedPath),
      });
    }
  }

  if (top3.mode !== "read_only_integration_top3_sourcing_sprint") {
    addIssue(issues, "top3", "INVALID_MODE", "Le mode du sprint top 3 est inattendu.", { mode: top3.mode });
  }

  if (top3.status !== "HOLD_TOP3_SOURCING_READY") {
    addIssue(issues, "top3", "INVALID_STATUS", "Le sprint top 3 doit rester pret en HOLD.", { status: top3.status });
  }

  if (top3.sourceAuditStatus !== "OK_PRIORITY_BOARD_GUARDED") {
    addIssue(issues, "sources", "SOURCE_BOARD_AUDIT_NOT_OK", "L'audit du board source n'est pas garde OK.", {
      sourceAuditStatus: top3.sourceAuditStatus,
    });
  }

  for (const flag of requiredSafetyFlags) {
    if (top3.safety?.[flag] !== true) {
      addIssue(issues, "safety", "MISSING_SAFETY_FLAG", `Garde-fou manquant: ${flag}.`, { flag });
    }
  }

  const rows = top3.rows ?? [];
  if (rows.length !== 3 || top3.productCount !== 3) {
    addIssue(issues, "counts", "TOP3_PRODUCT_COUNT_INVALID", "Le sprint top 3 doit contenir exactement 3 produits.", {
      rowCount: rows.length,
      productCount: top3.productCount,
    });
  }

  const rowMissingTotal = rows.reduce((sum, row) => sum + (Number(row.missingFieldCount) || 0), 0);
  if (top3.totalMissingFieldCount !== rowMissingTotal) {
    addIssue(issues, "counts", "MISSING_FIELD_COUNT_MISMATCH", "Le total des preuves sprint est incoherent.", {
      totalMissingFieldCount: top3.totalMissingFieldCount,
      rowMissingTotal,
    });
  }

  const rowImageTotal = rows.reduce(
    (sum, row) => sum + (Array.isArray(row.expectedImageFiles) ? row.expectedImageFiles.length : 0),
    0,
  );
  if (top3.expectedImageCount !== rowImageTotal) {
    addIssue(issues, "counts", "EXPECTED_IMAGE_COUNT_MISMATCH", "Le total WebP sprint est incoherent.", {
      expectedImageCount: top3.expectedImageCount,
      rowImageTotal,
    });
  }

  rows.forEach((row, index) => {
    if (row.sprintRank !== index + 1) {
      addIssue(issues, "rows", "SPRINT_RANK_INVALID", "Le rang sprint doit etre continu.", {
        productId: row.productId,
        sprintRank: row.sprintRank,
        expectedRank: index + 1,
      });
    }

    if (row.safetyStatus !== "HOLD_TOP3_SOURCING_NO_PUBLICATION") {
      addIssue(issues, "rows", "ROW_NOT_HOLD", "Une ligne top 3 ne porte pas le statut HOLD attendu.", {
        productId: row.productId,
        safetyStatus: row.safetyStatus,
      });
    }

    if (!isInternalAdminHref(row.adminProofHref)) {
      addIssue(issues, "rows", "INVALID_ADMIN_HREF", "Lien admin produit absent ou non interne.", {
        productId: row.productId,
        adminProofHref: row.adminProofHref,
      });
    }

    for (const proof of row.firstProofs ?? []) {
      if (!isInternalAdminHref(proof.adminHref)) {
        addIssue(issues, "proofs", "INVALID_PROOF_ADMIN_HREF", "Lien admin de preuve non interne.", {
          productId: row.productId,
          fieldKey: proof.key,
          adminHref: proof.adminHref,
        });
      }
    }

    const depositDir = resolveFromRoot(row.imageDepositDirRelative ?? "");
    if (!isInsidePath(depositDir, imageDepositRoot)) {
      addIssue(issues, "rows", "INVALID_IMAGE_DEPOSIT_DIR", "Dossier WebP hors depot integration autorise.", {
        productId: row.productId,
        imageDepositDirRelative: row.imageDepositDirRelative,
      });
    }

    const expectedImageFiles = Array.isArray(row.expectedImageFiles) ? row.expectedImageFiles : [];
    const denominator = Number(String(row.imageProgress ?? "").split("/")[1]) || expectedImageFiles.length;
    if (expectedImageFiles.length === 0 || expectedImageFiles.length !== denominator) {
      addIssue(issues, "rows", "EXPECTED_IMAGE_FILE_COUNT_INVALID", "La liste des WebP attendus ne suit pas le compteur image.", {
        productId: row.productId,
        expectedImageFileCount: expectedImageFiles.length,
        imageProgress: row.imageProgress,
      });
    }

    expectedImageFiles.forEach((fileName, fileIndex) => {
      if (typeof fileName !== "string" || !/^[a-z0-9][a-z0-9-]*\.webp$/i.test(fileName)) {
        addIssue(issues, "rows", "INVALID_EXPECTED_IMAGE_FILE", "Un fichier WebP attendu est absent ou invalide.", {
          productId: row.productId,
          index: fileIndex,
          fileName,
        });
      }
    });
  });

  return issues;
}

function toCsv(summary) {
  const headers = ["scope", "code", "message", "productId", "file"];
  const rows = summary.issues.map((issue) => headers.map((header) => csvEscape(issue[header] ?? "")).join(";"));
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
    "# Audit top 3 sourcing integration",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Statut: ${summary.status}`,
    `- Produits controles: ${summary.productCount}`,
    `- Champs de preuve: ${summary.totalMissingFieldCount}`,
    `- WebP attendus: ${summary.expectedImageCount}`,
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
    "- HOLD tant que les preuves exactes et la validation Mouss manquent.",
    "",
  ].join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const top3Path = latestFile(top3Root, /TOP3_SOURCING_INTEGRATION_\d+\.json$/);
const top3Dir = path.dirname(top3Path);
const top3Key = top3DateKey(top3Path);
const top3 = readJson(top3Path);
const top3Files = [
  top3Path,
  path.join(top3Dir, `TOP3_SOURCING_INTEGRATION_${top3Key}.md`),
  path.join(top3Dir, `maxi-top3-sourcing-integration-${top3Key}.csv`),
].filter((filePath) => fs.existsSync(filePath));

const issues = validateTop3Artifacts({ top3, top3Path, files: top3Files });
const sensitiveFindings = scanSensitiveArtifacts(top3Files);

const summary = {
  ok: issues.length === 0 && sensitiveFindings.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_integration_top3_sourcing_sprint_audit",
  status:
    issues.length === 0 && sensitiveFindings.length === 0
      ? "OK_TOP3_SOURCING_GUARDED"
      : "FAIL_TOP3_SOURCING_GUARDS",
  productCount: top3.productCount ?? 0,
  totalMissingFieldCount: top3.totalMissingFieldCount ?? 0,
  expectedImageCount: top3.expectedImageCount ?? 0,
  scannedFileCount: top3Files.length,
  failureCount: issues.length,
  sensitiveFindingCount: sensitiveFindings.length,
  issues,
  sensitiveFindings,
  sources: {
    top3Path: rel(top3Path),
    boardPath: top3.sources?.boardPath ?? "",
    boardAuditPath: top3.sources?.boardAuditPath ?? "",
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

const jsonPath = path.join(outputDir, `AUDIT_TOP3_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_TOP3_SOURCING_INTEGRATION_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-audit-top3-sourcing-integration-${dateKey}.csv`);

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

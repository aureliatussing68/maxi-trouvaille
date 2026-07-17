import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const sessionRoot = path.join(actionRoot, "session-depot-top3-webp-sourcing-integration-articles");
const outputRoot = path.join(actionRoot, "audit-session-depot-top3-webp-sourcing-integration-articles");
const allowedDepositRootRelative = "business-maxi-trouvailles/depots-images-exactes/integration-articles";
const allowedDepositRootAbsolute = path.resolve(root, allowedDepositRootRelative);
const requiredSafetyFlags = [
  "readOnlyInputs",
  "noCatalogWrite",
  "noPublication",
  "noPayment",
  "noSupplierOrder",
  "noExternalContact",
  "noImageDownload",
  "noImageFileCreated",
  "noPublicImageWrite",
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
    return null;
  }

  const todayKey = datePartsParis().dateKey;
  const matches = files
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return matches.find((match) => match.filePath.includes(todayKey))?.filePath ?? matches[0].filePath;
}

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function rel(filePath) {
  if (!filePath) return "";
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function normalizeRelative(value) {
  return String(value ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function absFromRelative(relativePath) {
  return path.resolve(root, normalizeRelative(relativePath));
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

function isInsideAllowedDepositRoot(filePath) {
  const resolved = path.resolve(filePath);
  return resolved === allowedDepositRootAbsolute || resolved.startsWith(`${allowedDepositRootAbsolute}${path.sep}`);
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

function validateSession(session, issues) {
  if (!session) {
    addIssue(issues, "session", "session_missing", "La session depot WebP top 3 est introuvable.");
    return;
  }

  if (session.mode !== "manual_integration_top3_webp_depot_session") {
    addIssue(issues, "session", "mode_invalid", "Le mode de session depot WebP top 3 est inattendu.", {
      mode: session.mode,
    });
  }

  if (session.status !== "HOLD_TOP3_WEBP_DEPOT_SESSION_READY") {
    addIssue(issues, "session", "status_invalid", "La session depot WebP top 3 doit rester en HOLD pret.", {
      status: session.status,
    });
  }

  if (session.productCount !== 3 || session.groupCount !== 3 || session.imageTaskCount !== 9) {
    addIssue(issues, "counts", "session_scope_invalid", "La session doit couvrir 3 produits / 9 WebP.", {
      productCount: session.productCount,
      groupCount: session.groupCount,
      imageTaskCount: session.imageTaskCount,
    });
  }

  if (session.instructionFileCount !== 3) {
    addIssue(issues, "counts", "instruction_count_invalid", "La session doit produire 3 fichiers consigne.", {
      instructionFileCount: session.instructionFileCount,
    });
  }

  if (session.depotAudit?.status !== "HOLD_TOP3_WEBP_FILES_MISSING" && session.depotAudit?.status !== "READY_TOP3_WEBP_FILES_FOR_HUMAN_REVIEW_HOLD") {
    addIssue(issues, "sources", "depot_audit_status_invalid", "Le dernier audit depot WebP top 3 n'est pas exploitable.", {
      status: session.depotAudit?.status,
    });
  }

  if (session.workpackAudit?.status !== "OK_TOP3_WEBP_WORKPACK_GUARDED") {
    addIssue(issues, "sources", "workpack_audit_status_invalid", "L'audit workpack WebP top 3 n'est pas OK.", {
      status: session.workpackAudit?.status,
    });
  }

  for (const flag of requiredSafetyFlags) {
    if (session.safety?.[flag] !== true) {
      addIssue(issues, "safety", "missing_safety_flag", "Un garde-fou session est absent.", { flag });
    }
  }

  const groups = Array.isArray(session.groups) ? session.groups : [];
  const items = Array.isArray(session.items) ? session.items : [];

  for (const group of groups) {
    const depositDir = absFromRelative(group.imageDepositDirRelative);
    const instructionPath = absFromRelative(group.instructionPathRelative);
    if (!isInsideAllowedDepositRoot(depositDir) || !fs.existsSync(depositDir)) {
      addIssue(issues, "group", "deposit_dir_invalid", "Dossier depot absent ou hors racine autorisee.", {
        productId: group.productId,
        imageDepositDirRelative: group.imageDepositDirRelative,
      });
    }
    if (!isInsideAllowedDepositRoot(instructionPath) || !fs.existsSync(instructionPath)) {
      addIssue(issues, "group", "instruction_file_invalid", "Fichier consigne absent ou hors racine depot.", {
        productId: group.productId,
        instructionPathRelative: group.instructionPathRelative,
      });
    }
    if (group.imageTaskCount !== 3) {
      addIssue(issues, "group", "group_image_count_invalid", "Chaque produit top 3 doit avoir 3 WebP attendus.", {
        productId: group.productId,
        imageTaskCount: group.imageTaskCount,
      });
    }
  }

  for (const item of items) {
    const targetPath = absFromRelative(item.expectedTargetPathRelative);
    if (!String(item.expectedFileName ?? "").endsWith(".webp")) {
      addIssue(issues, "item", "expected_file_not_webp", "Le fichier attendu doit etre un WebP.", {
        productId: item.productId,
        expectedFileName: item.expectedFileName,
      });
    }
    if (!String(item.expectedTargetPathRelative ?? "").endsWith(`/${item.expectedFileName}`)) {
      addIssue(issues, "item", "target_path_file_mismatch", "Le chemin cible ne correspond pas au fichier attendu.", {
        productId: item.productId,
        expectedFileName: item.expectedFileName,
      });
    }
    if (!isInsideAllowedDepositRoot(targetPath)) {
      addIssue(issues, "item", "target_path_outside_allowed_root", "Chemin cible hors racine depot autorisee.", {
        productId: item.productId,
        expectedTargetPathRelative: item.expectedTargetPathRelative,
      });
    }
  }
}

function markdown(summary) {
  const issueRows =
    summary.issues.length === 0
      ? ["| OK | Aucun echec structurel | - | - |"]
      : summary.issues.map(
          (issue) =>
            `| ${mdCell(issue.scope)} | ${mdCell(issue.code)} | ${mdCell(issue.message)} | ${mdCell(
              issue.productId ?? issue.flag ?? issue.status ?? "-",
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
    "# Audit session depot WebP top 3 integration",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Produits: ${summary.productCount}`,
    `- Dossiers: ${summary.groupCount}`,
    `- WebP attendus: ${summary.imageTaskCount}`,
    `- Fichiers consigne: ${summary.instructionFileCount}`,
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
    "- Lecture seule cote catalogue.",
    "- Aucune image creee.",
    "- Aucun telechargement image.",
    "- Aucune copie publique.",
    "- HOLD maintenu jusqu'a validation humaine Mouss.",
    "",
  ].join("\n")}\n`;
}

function toCsv(summary) {
  const headers = ["scope", "code", "message", "detail"];
  const rows = summary.issues.map((issue) =>
    [issue.scope, issue.code, issue.message, issue.productId ?? issue.flag ?? issue.status ?? ""]
      .map(csvEscape)
      .join(";"),
  );
  return `${headers.join(";")}\n${rows.join("\n")}${rows.length ? "\n" : ""}`;
}

const { dateKey, localLabel } = datePartsParis();
const sessionPath = latestFile(sessionRoot, /SESSION_DEPOT_TOP3_WEBP_SOURCING_INTEGRATION_\d+\.json$/);
const session = readJsonIfExists(sessionPath);
const issues = [];
validateSession(session, issues);

const textFiles = sessionPath
  ? [
      sessionPath,
      path.join(path.dirname(sessionPath), `SESSION_DEPOT_TOP3_WEBP_SOURCING_INTEGRATION_${dateKey}.md`),
      path.join(path.dirname(sessionPath), `session-depot-top3-webp-sourcing-integration-${dateKey}.csv`),
      ...(Array.isArray(session?.groups)
        ? session.groups.map((group) => absFromRelative(group.instructionPathRelative))
        : []),
    ].filter((filePath) => fs.existsSync(filePath))
  : [];
const sensitiveFindings = scanSensitiveArtifacts(textFiles);

const ok = issues.length === 0 && sensitiveFindings.length === 0;
const summary = {
  ok,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_integration_top3_webp_depot_session_audit",
  status: ok ? "OK_TOP3_WEBP_DEPOT_SESSION_GUARDED" : "FAIL_TOP3_WEBP_DEPOT_SESSION_GUARDS",
  productCount: session?.productCount ?? 0,
  groupCount: session?.groupCount ?? 0,
  imageTaskCount: session?.imageTaskCount ?? 0,
  instructionFileCount: session?.instructionFileCount ?? 0,
  scannedFileCount: textFiles.length,
  failureCount: issues.length,
  sensitiveFindingCount: sensitiveFindings.length,
  issues,
  sensitiveFindings,
  sources: {
    sessionPath: rel(sessionPath),
    workpackPath: session?.sources?.workpackPath ?? "",
    depotAuditPath: session?.sources?.depotAuditPath ?? "",
    allowedDepositRootRelative,
  },
  safety: {
    readOnlyAudit: true,
    noCatalogWrite: true,
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

const jsonPath = path.join(outputDir, `AUDIT_SESSION_DEPOT_TOP3_WEBP_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_SESSION_DEPOT_TOP3_WEBP_SOURCING_INTEGRATION_${dateKey}.md`);
const csvPath = path.join(outputDir, `audit-session-depot-top3-webp-sourcing-integration-${dateKey}.csv`);

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
      groupCount: summary.groupCount,
      imageTaskCount: summary.imageTaskCount,
      instructionFileCount: summary.instructionFileCount,
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

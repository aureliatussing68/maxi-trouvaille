import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const planRoot = path.join(actionRoot, "plan-deblocage-top3-sourcing-integration-articles");
const outputRoot = path.join(actionRoot, "audit-plan-deblocage-top3-sourcing-integration-articles");

const requiredHeaders = [
  "step_order",
  "top3_rank",
  "product_id",
  "product_name",
  "category_id",
  "step_type",
  "zone",
  "label",
  "expected_file_name",
  "status",
  "admin_href",
  "next_action",
  "expected_result",
  "rejection_risk",
];
const requiredSafetyFlags = [
  "readOnlyInputs",
  "noCatalogWrite",
  "noSupplierValueExport",
  "noPublication",
  "noPayment",
  "noSupplierOrder",
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
  const text = String(value ?? "");
  if (/[",\n\r;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
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

function addIssue(issues, scope, code, message, details = {}) {
  issues.push({ scope, code, message, ...details });
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

function stepKey(step) {
  return `${step.stepOrder}:${step.productId}:${step.stepType}:${step.label}`;
}

function csvStepKey(row) {
  return `${row.step_order}:${row.product_id}:${row.step_type}:${row.label}`;
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

function validatePlan({ plan, csv }) {
  const issues = [];
  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  const stepKeys = new Set(steps.map(stepKey));
  const csvKeys = new Set(csv.rows.map(csvStepKey));

  if (plan.mode !== "read_only_integration_top3_unblock_plan") {
    addIssue(issues, "plan", "invalid_mode", "Le mode du plan est inattendu.", { mode: plan.mode });
  }

  if (!["HOLD_TOP3_UNBLOCK_PLAN_READY", "READY_TOP3_UNBLOCK_PLAN_HUMAN_REVIEW_HOLD"].includes(plan.status)) {
    addIssue(issues, "plan", "invalid_status", "Le plan doit rester en HOLD ou en revue humaine HOLD.", {
      status: plan.status,
    });
  }

  if (!["HOLD_TOP3_BUSINESS_GATE_BLOCKED", "READY_TOP3_BUSINESS_GATE_HUMAN_REVIEW_HOLD"].includes(plan.gateStatus)) {
    addIssue(issues, "sources", "gate_status_invalid", "Le gate source du plan est invalide.", {
      gateStatus: plan.gateStatus,
    });
  }

  for (const flag of requiredSafetyFlags) {
    if (plan.safety?.[flag] !== true) {
      addIssue(issues, "safety", "missing_safety_flag", "Un garde-fou du plan est absent.", { flag });
    }
  }

  if (plan.productCount !== 3 || plan.stepCount !== 24 || steps.length !== 24) {
    addIssue(issues, "counts", "step_count_mismatch", "Le plan doit couvrir 3 produits / 24 actions.", {
      productCount: plan.productCount,
      stepCount: plan.stepCount,
      stepRows: steps.length,
    });
  }

  if (plan.proofStepCount !== 15 || plan.imageStepCount !== 9) {
    addIssue(issues, "counts", "step_type_counts_invalid", "Le volume preuves/images du plan est invalide.", {
      proofStepCount: plan.proofStepCount,
      imageStepCount: plan.imageStepCount,
    });
  }

  if (plan.status === "HOLD_TOP3_UNBLOCK_PLAN_READY" && plan.remainingStepCount <= 0) {
    addIssue(issues, "counts", "hold_without_remaining_steps", "Un plan HOLD doit garder des actions restantes.", {
      remainingStepCount: plan.remainingStepCount,
    });
  }

  if (plan.remainingStepCount !== steps.filter((step) => step.status === "TO_DO_HOLD").length) {
    addIssue(issues, "counts", "remaining_step_count_mismatch", "Le compteur actions restantes est incoherent.", {
      remainingStepCount: plan.remainingStepCount,
    });
  }

  for (const header of requiredHeaders) {
    if (!csv.headers.includes(header)) {
      addIssue(issues, "csv", "missing_csv_header", "Le CSV du plan ne contient pas une colonne obligatoire.", {
        header,
      });
    }
  }

  if (csv.rows.length !== steps.length) {
    addIssue(issues, "csv", "csv_row_count_mismatch", "Le CSV ne suit pas les actions JSON.", {
      csvRows: csv.rows.length,
      stepRows: steps.length,
    });
  }

  for (const [index, step] of steps.entries()) {
    if (step.stepOrder !== index + 1) {
      addIssue(issues, "step", "step_order_gap", "L'ordre des actions n'est pas continu.", {
        stepOrder: step.stepOrder,
        expected: index + 1,
      });
    }

    if (!["proof", "image"].includes(step.stepType)) {
      addIssue(issues, "step", "invalid_step_type", "Type d'action inattendu.", {
        stepOrder: step.stepOrder,
        stepType: step.stepType,
      });
    }

    if (step.status !== "TO_DO_HOLD") {
      addIssue(issues, "step", "step_not_hold", "Une action doit rester TO_DO_HOLD.", {
        stepOrder: step.stepOrder,
        status: step.status,
      });
    }

    if (!isInternalAdminHref(step.adminHref)) {
      addIssue(issues, "step", "admin_href_not_internal", "Lien admin non interne.", {
        stepOrder: step.stepOrder,
        adminHref: step.adminHref,
      });
    }

    if (step.stepType === "image" && !/^[a-z0-9][a-z0-9-]*\.webp$/i.test(String(step.expectedFileName ?? ""))) {
      addIssue(issues, "step", "invalid_expected_file_name", "Nom WebP attendu invalide.", {
        stepOrder: step.stepOrder,
        expectedFileName: step.expectedFileName,
      });
    }

    if (!csvKeys.has(stepKey(step))) {
      addIssue(issues, "csv", "step_missing_from_csv", "Une action JSON manque dans le CSV.", {
        key: stepKey(step),
      });
    }
  }

  for (const row of csv.rows) {
    if (!stepKeys.has(csvStepKey(row))) {
      addIssue(issues, "csv", "unexpected_csv_row", "Le CSV contient une action absente du JSON.", {
        key: csvStepKey(row),
      });
    }
  }

  return issues;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function markdown(summary) {
  const issueRows =
    summary.issues.length === 0
      ? ["| OK | Aucun echec | - | - |"]
      : summary.issues.map(
          (issue) =>
            `| ${mdCell(issue.scope)} | ${mdCell(issue.code)} | ${mdCell(issue.message)} | ${mdCell(
              issue.stepOrder ?? issue.file ?? issue.key ?? issue.header ?? "-",
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
    "# Audit plan deblocage top 3 sourcing integration",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Statut: ${summary.status}`,
    `- Produits controles: ${summary.productCount}`,
    `- Actions controlees: ${summary.stepCount}`,
    `- Preuves: ${summary.proofStepCount}`,
    `- Images: ${summary.imageStepCount}`,
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
    "- Aucune copie image publique.",
    "- Aucun telechargement image.",
    "- Aucune publication, aucun paiement, aucune commande fournisseur.",
    "- HOLD tant que les preuves exactes et la validation Mouss manquent.",
    "",
  ].join("\n")}\n`;
}

function toCsv(summary) {
  const headers = ["scope", "code", "message", "stepOrder", "file", "key", "header"];
  const rows = summary.issues.map((issue) => headers.map((header) => csvEscape(issue[header] ?? "")).join(";"));
  return `${headers.join(";")}\n${rows.join("\n")}${rows.length ? "\n" : ""}`;
}

function planDateKey(planPath) {
  const match = path.basename(planPath).match(/_(\d{8})\.json$/);
  return match?.[1] ?? datePartsParis().dateKey;
}

const { dateKey, localLabel } = datePartsParis();
const planPath = latestFile(planRoot, /PLAN_DEBLOCAGE_TOP3_SOURCING_INTEGRATION_\d+\.json$/, "top3 unblock plan");
const planDir = path.dirname(planPath);
const planKey = planDateKey(planPath);
const plan = readJson(planPath);
const csvPathSource = path.join(planDir, `plan-deblocage-top3-sourcing-integration-${planKey}.csv`);
const csv = readCsv(csvPathSource);
const planFiles = [
  planPath,
  path.join(planDir, `PLAN_DEBLOCAGE_TOP3_SOURCING_INTEGRATION_${planKey}.md`),
  csvPathSource,
].filter((filePath) => fs.existsSync(filePath));

const issues = validatePlan({ plan, csv });
const sensitiveFindings = scanSensitiveArtifacts(planFiles);

const summary = {
  ok: issues.length === 0 && sensitiveFindings.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_integration_top3_unblock_plan_audit",
  status:
    issues.length === 0 && sensitiveFindings.length === 0
      ? "OK_TOP3_UNBLOCK_PLAN_GUARDED"
      : "FAIL_TOP3_UNBLOCK_PLAN_GUARDS",
  productCount: plan.productCount ?? 0,
  stepCount: plan.stepCount ?? 0,
  proofStepCount: plan.proofStepCount ?? 0,
  imageStepCount: plan.imageStepCount ?? 0,
  remainingStepCount: plan.remainingStepCount ?? 0,
  gateStatus: plan.gateStatus ?? "absent",
  scannedFileCount: planFiles.length,
  failureCount: issues.length,
  sensitiveFindingCount: sensitiveFindings.length,
  issues,
  sensitiveFindings,
  sources: {
    planPath: rel(planPath),
    csvPath: rel(csvPathSource),
    businessGatePath: plan.sources?.businessGatePath ?? "",
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

const jsonPath = path.join(outputDir, `AUDIT_PLAN_DEBLOCAGE_TOP3_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_PLAN_DEBLOCAGE_TOP3_SOURCING_INTEGRATION_${dateKey}.md`);
const csvPath = path.join(outputDir, `audit-plan-deblocage-top3-sourcing-integration-${dateKey}.csv`);

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
      stepCount: summary.stepCount,
      proofStepCount: summary.proofStepCount,
      imageStepCount: summary.imageStepCount,
      remainingStepCount: summary.remainingStepCount,
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

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const gatePrefix = "public-image-copy-gate-";
const requiredSafetyFlags = [
  "dryRunOnly",
  "readOnlyInputs",
  "noCatalogWrite",
  "noImageDownload",
  "noImageFileCreated",
  "noPublicImageWrite",
  "noPublication",
  "noPayment",
  "noSupplierOrder",
  "requiresMoussValidation",
];
const leakPattern =
  /(https?:\/\/|aliexpress|alicdn|ae-pic|temu|supplierUrl|sourceUrl|productUrl|exactProductUrl)/i;

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

function latestDirectoryUnder(dirPath, prefix) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return null;
  }

  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.startsWith(prefix) &&
        !entry.name.startsWith("public-image-copy-gate-audit-"),
    )
    .map((entry) => path.join(dirPath, entry.name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] ?? null;
}

function latestFileUnder(dirPath, prefix) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return null;
  }

  return fs
    .readdirSync(dirPath)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((name) => path.join(dirPath, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] ?? null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function collectTextFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath)
    .filter((name) => [".json", ".md", ".csv"].includes(path.extname(name).toLowerCase()))
    .map((name) => path.join(dirPath, name));
}

function isProofSourcePath(value) {
  const normalized = String(value ?? "").replace(/\\/g, "/");
  return normalized.startsWith("business-maxi-trouvailles/preuves-images-publiques/");
}

function isTargetPublicPath(value) {
  return /^\/uploads\/partner-products\/[^?#]+\.webp$/i.test(String(value ?? ""));
}

function isTargetLocalPath(value) {
  const normalized = String(value ?? "").replace(/\\/g, "/");
  return /^public\/uploads\/partner-products\/[^?#]+\.webp$/i.test(normalized);
}

function assertCondition(condition, code, message, details = {}) {
  if (!condition) {
    return { code, message, details };
  }
  return null;
}

function findLeaks(files) {
  return files
    .map((filePath) => {
      const content = fs.readFileSync(filePath, "utf8");
      if (!leakPattern.test(content)) {
        return null;
      }

      return {
        file: rel(filePath),
        message: "Marqueur externe sensible detecte dans le gate copie image.",
      };
    })
    .filter(Boolean);
}

const gateDir = latestDirectoryUnder(actionRoot, gatePrefix);
const gateJsonPath = latestFileUnder(gateDir, "GATE_COPIE_IMAGES_PUBLIQUES_");
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `public-image-copy-gate-audit-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const failures = [];

if (!gateDir || !gateJsonPath) {
  failures.push({
    code: "gate_missing",
    message: "Aucun gate copie publique images n'a ete trouve.",
    details: {},
  });
} else {
  const gate = readJson(gateJsonPath);
  const items = Array.isArray(gate.items) ? gate.items : [];
  const files = collectTextFiles(gateDir);
  const leaks = findLeaks(files);
  const candidateItems = items.filter((item) => item.decision === "PENDING_MOUSS_VALIDATION");

  failures.push(
    assertCondition(gate.ok === true, "gate_not_ok", "Le gate n'est pas marque OK."),
    assertCondition(
      gate.mode === "dry_run_public_image_copy_gate",
      "gate_mode_invalid",
      "Le mode du gate n'est pas dry-run.",
      { mode: gate.mode },
    ),
    assertCondition(gate.copyApplied === false, "copy_applied_forbidden", "Le gate indique une copie appliquee."),
    assertCondition(
      gate.humanValidationRequired === true,
      "human_validation_flag_missing",
      "Le gate doit exiger validation humaine.",
    ),
    assertCondition(
      gate.readyCopyCandidateCount === candidateItems.length,
      "candidate_count_mismatch",
      "Le compteur candidats ne correspond pas aux lignes PENDING.",
      { readyCopyCandidateCount: gate.readyCopyCandidateCount, pendingItems: candidateItems.length },
    ),
    ...requiredSafetyFlags.map((flag) =>
      assertCondition(
        gate.safety?.[flag] === true,
        `safety_${flag}_missing`,
        `Garde-fou absent ou faux: ${flag}.`,
      ),
    ),
    ...items.flatMap((item, index) => [
      assertCondition(
        ["HOLD", "PENDING_MOUSS_VALIDATION"].includes(item.decision),
        "decision_invalid",
        "Decision gate inconnue.",
        { index, slug: item.slug, decision: item.decision },
      ),
      assertCondition(
        isProofSourcePath(item.sourceFile),
        "source_path_invalid",
        "Source image hors racine preuves.",
        { index, slug: item.slug, sourceFile: item.sourceFile },
      ),
      assertCondition(
        isTargetPublicPath(item.targetPublicPath),
        "target_public_path_invalid",
        "Cible publique hors /uploads/partner-products.",
        { index, slug: item.slug, targetPublicPath: item.targetPublicPath },
      ),
      assertCondition(
        isTargetLocalPath(item.targetLocalPath),
        "target_local_path_invalid",
        "Cible locale hors public/uploads/partner-products.",
        { index, slug: item.slug, targetLocalPath: item.targetLocalPath },
      ),
      assertCondition(
        item.decision !== "PENDING_MOUSS_VALIDATION" ||
          item.blockers?.includes("human_validation_mouss_required"),
        "pending_without_mouss_blocker",
        "Un candidat copie n'a pas le bloqueur validation Mouss.",
        { index, slug: item.slug },
      ),
      assertCondition(
        !leakPattern.test(JSON.stringify(item)),
        "item_leak_marker",
        "Une ligne de gate contient un marqueur externe sensible.",
        { index, slug: item.slug },
      ),
    ]),
    ...leaks.map((leak) => ({
      code: "artifact_leak_marker",
      message: leak.message,
      details: { file: leak.file },
    })),
  );
}

const cleanFailures = failures.filter(Boolean);
const summary = {
  ok: cleanFailures.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "dry_run_public_image_copy_gate_audit",
  gateDir: gateDir ? rel(gateDir) : null,
  gateJson: gateJsonPath ? rel(gateJsonPath) : null,
  failures: cleanFailures,
  safety: {
    readOnlyAudit: true,
    noCatalogWrite: true,
    noImageDownload: true,
    noImageFileCreated: true,
    noPublicImageWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

const jsonPath = path.join(outputDir, `AUDIT_GATE_COPIE_IMAGES_PUBLIQUES_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_GATE_COPIE_IMAGES_PUBLIQUES_${dateKey}.md`);
const mdRows =
  summary.failures.length === 0
    ? ["| OK | Aucun blocage audit | - |"]
    : summary.failures.map(
        (failure) =>
          `| ${failure.code} | ${failure.message} | ${JSON.stringify(failure.details)} |`,
      );

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(
  mdPath,
  `${[
    "# Audit gate copie publique images exactes",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Gate: ${summary.gateJson ?? "absent"}`,
    `Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "| Code | Message | Details |",
    "|---|---|---|",
    ...mdRows,
    "",
    "## Garde-fous",
    "",
    "- Dry-run uniquement.",
    "- Aucune copie publique.",
    "- Aucune modification catalogue.",
    "- Aucune publication.",
    "- Aucun paiement.",
    "- Aucune commande partenaire.",
    "",
  ].join("\n")}\n`,
  "utf8",
);

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      gate: summary.gateJson,
      failureCount: summary.failures.length,
      files: { jsonPath, mdPath },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

if (!summary.ok) {
  process.exitCode = 1;
}

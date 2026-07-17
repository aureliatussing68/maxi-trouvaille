import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const sessionPrefix = "public-image-deposit-session-";
const allowedLanes = new Set([
  "P0_CORRIGER_DEPOT",
  "P0_ATTEND_VALIDATION_MOUSS",
  "P1_REVIEW_HUMAINE",
  "P2_DEPOSER_WEBP",
]);
const requiredSafetyFlags = [
  "readOnlyInputs",
  "noCatalogWrite",
  "noImageDownload",
  "noImageFileCreated",
  "noPublicImageWrite",
  "noPublication",
  "noPayment",
  "noSupplierOrder",
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
        !entry.name.startsWith("public-image-deposit-session-audit-"),
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

function abs(relativePath) {
  return path.join(root, String(relativePath ?? "").replace(/\//g, path.sep));
}

function collectTextFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return collectTextFiles(entryPath);
    }
    if ([".json", ".md", ".csv"].includes(path.extname(entry.name).toLowerCase())) {
      return [entryPath];
    }
    return [];
  });
}

function isTargetPublicPath(value) {
  return /^\/uploads\/partner-products\/[^?#]+\.webp$/i.test(String(value ?? ""));
}

function isProofPath(value) {
  const normalized = String(value ?? "").replace(/\\/g, "/");
  return normalized.startsWith("business-maxi-trouvailles/preuves-images-publiques/");
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
        message: "Marqueur externe sensible detecte dans la session depot.",
      };
    })
    .filter(Boolean);
}

const sessionDir = latestDirectoryUnder(actionRoot, sessionPrefix);
const sessionJsonPath = latestFileUnder(sessionDir, "SESSION_DEPOT_WEBP_IMAGES_PUBLIQUES_");
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `public-image-deposit-session-audit-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const failures = [];

if (!sessionDir || !sessionJsonPath) {
  failures.push({
    code: "session_missing",
    message: "Aucune session depot WebP images publiques n'a ete trouvee.",
    details: {},
  });
} else {
  const session = readJson(sessionJsonPath);
  const items = Array.isArray(session.items) ? session.items : [];
  const files = collectTextFiles(sessionDir);
  const leaks = findLeaks(files);

  failures.push(
    assertCondition(session.ok === true, "session_not_ok", "La session n'est pas marquee OK."),
    assertCondition(
      session.mode === "manual_public_image_deposit_session",
      "session_mode_invalid",
      "Le mode de session n'est pas celui attendu.",
      { mode: session.mode },
    ),
    assertCondition(items.length > 0, "items_missing", "La session ne contient aucune action."),
    assertCondition(
      session.itemCount === items.length,
      "item_count_mismatch",
      "Le compteur itemCount ne correspond pas aux items.",
      { itemCount: session.itemCount, itemsLength: items.length },
    ),
    ...requiredSafetyFlags.map((flag) =>
      assertCondition(
        session.safety?.[flag] === true,
        `safety_${flag}_missing`,
        `Garde-fou absent ou faux: ${flag}.`,
      ),
    ),
    ...items.flatMap((item, index) => [
      assertCondition(
        allowedLanes.has(item.sessionLane),
        "lane_invalid",
        "Lane de session inconnue.",
        { index, slug: item.slug, lane: item.sessionLane },
      ),
      assertCondition(
        isProofPath(item.dropFolder) && fs.existsSync(abs(item.dropFolder)),
        "drop_folder_invalid",
        "Dossier depot absent ou hors racine preuves images.",
        { index, slug: item.slug, dropFolder: item.dropFolder },
      ),
      assertCondition(
        isProofPath(item.expectedFilePath),
        "expected_file_path_invalid",
        "Chemin du WebP attendu hors racine preuves images.",
        { index, slug: item.slug, expectedFilePath: item.expectedFilePath },
      ),
      assertCondition(
        isProofPath(item.checklistPath) && fs.existsSync(abs(item.checklistPath)),
        "checklist_missing",
        "Checklist absente ou hors racine preuves images.",
        { index, slug: item.slug, checklistPath: item.checklistPath },
      ),
      assertCondition(
        isTargetPublicPath(item.targetPublicPath),
        "target_public_path_invalid",
        "Cible publique hors /uploads/partner-products.",
        { index, slug: item.slug, targetPublicPath: item.targetPublicPath },
      ),
      assertCondition(
        String(item.expectedFileName ?? "").endsWith(".webp"),
        "expected_file_not_webp",
        "Le fichier attendu doit etre un WebP.",
        { index, slug: item.slug, expectedFileName: item.expectedFileName },
      ),
      assertCondition(
        !leakPattern.test(JSON.stringify(item)),
        "item_leak_marker",
        "Une entree de session contient un marqueur externe sensible.",
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
  mode: "manual_public_image_deposit_session_audit",
  sessionDir: sessionDir ? rel(sessionDir) : null,
  sessionJson: sessionJsonPath ? rel(sessionJsonPath) : null,
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

const jsonPath = path.join(outputDir, `AUDIT_SESSION_DEPOT_WEBP_IMAGES_PUBLIQUES_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_SESSION_DEPOT_WEBP_IMAGES_PUBLIQUES_${dateKey}.md`);
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
    "# Audit session depot WebP images publiques",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Session: ${summary.sessionJson ?? "absente"}`,
    `Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "| Code | Message | Details |",
    "|---|---|---|",
    ...mdRows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule.",
    "- Aucune creation image.",
    "- Aucune copie publique.",
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
      session: summary.sessionJson,
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

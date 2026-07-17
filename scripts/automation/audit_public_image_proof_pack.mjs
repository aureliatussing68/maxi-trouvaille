import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const packPrefix = "public-image-proof-pack-";
const requiredSafetyFlags = [
  "readOnlyBoard",
  "noCatalogWrite",
  "noImageDownload",
  "noImageFileCreated",
  "noPublicImageWrite",
  "noPublication",
  "noPayment",
  "noSupplierOrder",
  "preservesExistingChecklists",
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
        !entry.name.startsWith("public-image-proof-pack-audit-"),
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

function collectTextFilesFromManifest(pack, packDir) {
  const packFiles = fs
    .readdirSync(packDir)
    .filter((name) => [".json", ".md", ".csv"].includes(path.extname(name).toLowerCase()))
    .map((name) => path.join(packDir, name));
  const itemFiles = (pack.items ?? []).flatMap((item) => [abs(item.checklistPath), abs(item.markerPath)]);

  return [...packFiles, ...itemFiles].filter((filePath) => fs.existsSync(filePath));
}

function isTargetPublicPath(value) {
  return /^\/uploads\/partner-products\/[^?#]+\.webp$/i.test(String(value ?? ""));
}

function isTargetLocalPath(value) {
  const normalized = String(value ?? "").replace(/\\/g, "/");
  return /^public\/uploads\/partner-products\/[^?#]+\.webp$/i.test(normalized);
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
        message: "Marqueur externe sensible detecte dans un artefact de pack.",
      };
    })
    .filter(Boolean);
}

const packDir = latestDirectoryUnder(actionRoot, packPrefix);
const packJsonPath = latestFileUnder(packDir, "PACK_PREUVES_IMAGES_PUBLIQUES_");
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `public-image-proof-pack-audit-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const failures = [];

if (!packDir || !packJsonPath) {
  failures.push({
    code: "pack_missing",
    message: "Aucun pack preuves images publiques n'a ete trouve.",
    details: {},
  });
} else {
  const pack = readJson(packJsonPath);
  const items = Array.isArray(pack.items) ? pack.items : [];
  const files = collectTextFilesFromManifest(pack, packDir);
  const leaks = findLeaks(files);

  failures.push(
    assertCondition(pack.ok === true, "pack_not_ok", "Le pack n'est pas marque OK."),
    assertCondition(
      pack.mode === "manual_public_image_proof_pack",
      "pack_mode_invalid",
      "Le mode du pack n'est pas celui attendu.",
      { mode: pack.mode },
    ),
    assertCondition(items.length > 0, "items_missing", "Aucune fiche image dans le pack."),
    assertCondition(
      pack.itemCount === items.length,
      "item_count_mismatch",
      "Le compteur itemCount ne correspond pas aux items.",
      { itemCount: pack.itemCount, itemsLength: items.length },
    ),
    ...requiredSafetyFlags.map((flag) =>
      assertCondition(
        pack.safety?.[flag] === true,
        `safety_${flag}_missing`,
        `Garde-fou absent ou faux: ${flag}.`,
      ),
    ),
    ...items.flatMap((item, index) => [
      assertCondition(
        isTargetPublicPath(item.targetPublicPath),
        "target_public_path_invalid",
        "Le chemin public cible doit rester dans /uploads/partner-products.",
        { index, slug: item.slug, targetPublicPath: item.targetPublicPath },
      ),
      assertCondition(
        isTargetLocalPath(item.targetLocalPath),
        "target_local_path_invalid",
        "Le chemin local cible doit rester dans public/uploads/partner-products.",
        { index, slug: item.slug, targetLocalPath: item.targetLocalPath },
      ),
      assertCondition(
        isProofPath(item.proofFolder) && fs.existsSync(abs(item.proofFolder)),
        "proof_folder_missing",
        "Le dossier de preuve est absent ou hors racine preuves images.",
        { index, slug: item.slug, proofFolder: item.proofFolder },
      ),
      assertCondition(
        isProofPath(item.dropFolder) && fs.existsSync(abs(item.dropFolder)),
        "drop_folder_missing",
        "Le dossier de depot manuel est absent ou hors racine preuves images.",
        { index, slug: item.slug, dropFolder: item.dropFolder },
      ),
      assertCondition(
        isProofPath(item.checklistPath) && fs.existsSync(abs(item.checklistPath)),
        "checklist_missing",
        "La checklist image est absente.",
        { index, slug: item.slug, checklistPath: item.checklistPath },
      ),
      assertCondition(
        isProofPath(item.markerPath) && fs.existsSync(abs(item.markerPath)),
        "marker_missing",
        "Le marqueur de depot WebP attendu est absent.",
        { index, slug: item.slug, markerPath: item.markerPath },
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
        "Une fiche du pack contient un marqueur externe sensible.",
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
  mode: "manual_public_image_proof_pack_audit",
  packDir: packDir ? rel(packDir) : null,
  packJson: packJsonPath ? rel(packJsonPath) : null,
  failures: cleanFailures,
  safety: {
    readOnlyAudit: true,
    noCatalogWrite: true,
    noImageDownload: true,
    noPublicImageWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

const jsonPath = path.join(outputDir, `AUDIT_PACK_PREUVES_IMAGES_PUBLIQUES_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_PACK_PREUVES_IMAGES_PUBLIQUES_${dateKey}.md`);
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
    "# Audit pack preuves images publiques",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Pack: ${summary.packJson ?? "absent"}`,
    `Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    "",
    "| Code | Message | Details |",
    "|---|---|---|",
    ...mdRows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule cote catalogue.",
    "- Aucun telechargement image.",
    "- Aucune copie dans public/uploads.",
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
      pack: summary.packJson,
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

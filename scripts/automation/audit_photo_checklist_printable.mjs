import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BUSINESS_ROOT = path.join(ROOT, "business-maxi-trouvailles");
const PHOTO_DROP_ROOT = path.join(BUSINESS_ROOT, "depots-photos");
const ACTION_ROOT = path.join(BUSINESS_ROOT, "tableaux-action");
const DATE_ID = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const OUTPUT_DIR = path.join(ACTION_ROOT, `audit-checklist-photos-${DATE_ID}`);

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(dir, predicate, out = []) {
  let entries;

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectFiles(fullPath, predicate, out);
    } else if (entry.isFile() && predicate(entry.name)) {
      out.push(fullPath);
    }
  }

  return out;
}

async function latestFile(dir, predicate) {
  const files = await collectFiles(dir, predicate);
  const dated = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      mtimeMs: (await fs.stat(filePath)).mtimeMs,
    })),
  );

  return dated.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.filePath;
}

async function readText(filePath) {
  if (!filePath || !(await exists(filePath))) {
    return "";
  }

  return fs.readFile(filePath, "utf8");
}

async function hasValidWebpSignature(filePath) {
  if (!(await exists(filePath))) {
    return false;
  }

  const handle = await fs.open(filePath, "r");

  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await handle.read(buffer, 0, 12, 0);

    if (bytesRead < 12) {
      return false;
    }

    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  } finally {
    await handle.close();
  }
}

function toRelative(filePath) {
  return path.relative(ROOT, filePath);
}

function flattenTasks(manifest) {
  return (manifest.products ?? []).flatMap((product) =>
    (product.imageTasks ?? []).map((task) => ({
      productId: product.productId,
      productName: product.productName,
      productRank: product.rank,
      categoryId: product.categoryId,
      role: task.role,
      order: task.order,
      expectedFileName: task.expectedFileName,
      requiredShot: task.requiredShot,
      stagingAbsolutePath:
        task.stagingAbsolutePath ?? path.join(ROOT, task.stagingRelativePath ?? ""),
      stagingRelativePath: task.stagingRelativePath,
      targetPublicUrl: task.targetPublicUrl,
      currentGateStatus: task.currentGateStatus,
      keepHoldUntil: task.keepHoldUntil ?? [],
    })),
  );
}

function taskStatus(taskAudit) {
  if (!taskAudit.checklistEntryPresent) {
    return "HOLD_CHECKLIST_MISSING_ENTRY";
  }

  if (!taskAudit.csvEntryPresent) {
    return "HOLD_CSV_MISSING_ENTRY";
  }

  if (!taskAudit.localFilePresent) {
    return "HOLD_MISSING_LOCAL_WEBP";
  }

  if (!taskAudit.localWebpValid) {
    return "HOLD_INVALID_LOCAL_WEBP";
  }

  return "READY_HUMAN_REVIEW_HOLD";
}

function globalStatus(metrics) {
  if (!metrics.manifestCountOk) {
    return "HOLD_MANIFEST_COUNT_MISMATCH";
  }

  if (metrics.checklistMissingCount > 0) {
    return "HOLD_CHECKLIST_OUT_OF_SYNC";
  }

  if (metrics.csvMissingCount > 0) {
    return "HOLD_CSV_OUT_OF_SYNC";
  }

  if (metrics.invalidLocalFileCount > 0) {
    return "HOLD_INVALID_LOCAL_WEBP";
  }

  if (metrics.missingLocalFileCount > 0) {
    return "HOLD_MISSING_LOCAL_WEBP";
  }

  return "READY_HUMAN_REVIEW_HOLD";
}

function markdownReport(audit) {
  const lines = [
    "# Audit checklist photos produits",
    "",
    `Date: ${audit.generatedAtLocal}`,
    `Statut: ${audit.status}`,
    "",
    "## Synthese",
    "",
    `- Produits: ${audit.metrics.productCount}`,
    `- Photos attendues manifest: ${audit.metrics.expectedImageCountManifest}`,
    `- Taches image trouvees: ${audit.metrics.imageTaskCount}`,
    `- WebP locaux valides: ${audit.metrics.validLocalFileCount}`,
    `- WebP locaux manquants: ${audit.metrics.missingLocalFileCount}`,
    `- WebP locaux invalides: ${audit.metrics.invalidLocalFileCount}`,
    `- Entrees checklist manquantes: ${audit.metrics.checklistMissingCount}`,
    `- Entrees CSV manquantes: ${audit.metrics.csvMissingCount}`,
    "",
    "## Sources",
    "",
    `- Manifest: ${audit.sources.manifestPath}`,
    `- Checklist: ${audit.sources.checklistPath ?? "non trouvee"}`,
    `- CSV: ${audit.sources.csvPath ?? "non trouve"}`,
    "",
    "## Garde-fous",
    "",
    "- Aucune copie dans les uploads publics",
    "- Aucun telechargement ou generation image",
    "- Aucune publication",
    "- Aucune commande fournisseur",
    "- Validation Mouss obligatoire avant toute sortie de HOLD",
    "",
    "## Taches",
    "",
  ];

  for (const task of audit.tasks) {
    lines.push(
      `### ${task.productRank}.${task.order} - ${task.productName} - ${task.role}`,
      "",
      `Statut: ${task.status}`,
      "",
      `Fichier: ${task.expectedFileName}`,
      "",
      `A verifier: ${task.requiredShot}`,
      "",
      `Depot: ${task.stagingRelativePath}`,
      "",
      `Destination future: ${task.targetPublicUrl}`,
      "",
      `Checklist locale: ${task.checklistEntryPresent ? "OK" : "MANQUANTE"}`,
      "",
      `CSV local: ${task.csvEntryPresent ? "OK" : "MANQUANT"}`,
      "",
      `Fichier local: ${task.localFilePresent ? "present" : "absent"}`,
      "",
      `Signature WebP: ${task.localWebpValid ? "OK" : "HOLD"}`,
      "",
    );
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const manifestPath = await latestFile(
    PHOTO_DROP_ROOT,
    (name) => name.startsWith("MANIFEST_DEPOT_PHOTOS_SPRINT_") && name.endsWith(".json"),
  );
  const checklistPath = await latestFile(
    PHOTO_DROP_ROOT,
    (name) => name.startsWith("CHECKLIST_AVANT_COPIE_PHOTOS_") && name.endsWith(".md"),
  );
  const csvPath = await latestFile(
    PHOTO_DROP_ROOT,
    (name) => name.startsWith("NOMS_FICHIERS_ATTENDUS_PHOTOS_") && name.endsWith(".csv"),
  );

  if (!manifestPath) {
    throw new Error("Aucun MANIFEST_DEPOT_PHOTOS_SPRINT_*.json trouve.");
  }

  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const checklistText = await readText(checklistPath);
  const csvText = await readText(csvPath);
  const imageTasks = flattenTasks(manifest);
  const taskAudits = await Promise.all(
    imageTasks.map(async (task) => {
      const localFilePresent = await exists(task.stagingAbsolutePath);
      const localWebpValid = await hasValidWebpSignature(task.stagingAbsolutePath);
      const checklistEntryPresent =
        checklistText.includes(task.expectedFileName) &&
        checklistText.includes(task.productName);
      const csvEntryPresent =
        csvText.includes(task.expectedFileName) && csvText.includes(task.productName);
      const audit = {
        ...task,
        localFilePresent,
        localWebpValid,
        checklistEntryPresent,
        csvEntryPresent,
      };

      return {
        ...audit,
        status: taskStatus(audit),
      };
    }),
  );

  const metrics = {
    productCount: manifest.productCount ?? manifest.products?.length ?? 0,
    expectedImageCountManifest: manifest.expectedImageCount ?? 0,
    imageTaskCount: imageTasks.length,
    manifestCountOk: (manifest.expectedImageCount ?? 0) === imageTasks.length,
    validLocalFileCount: taskAudits.filter((task) => task.localWebpValid).length,
    missingLocalFileCount: taskAudits.filter((task) => !task.localFilePresent).length,
    invalidLocalFileCount: taskAudits.filter(
      (task) => task.localFilePresent && !task.localWebpValid,
    ).length,
    checklistMissingCount: taskAudits.filter((task) => !task.checklistEntryPresent).length,
    csvMissingCount: taskAudits.filter((task) => !task.csvEntryPresent).length,
  };
  const audit = {
    ok: true,
    generatedAt: new Date().toISOString(),
    generatedAtLocal: new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Paris",
    }).format(new Date()),
    status: globalStatus(metrics),
    metrics,
    tasks: taskAudits,
    blockers: [
      ...(metrics.missingLocalFileCount ? ["WebP locaux manquants"] : []),
      ...(metrics.invalidLocalFileCount ? ["WebP locaux invalides"] : []),
      ...(metrics.checklistMissingCount ? ["Checklist locale incomplete"] : []),
      ...(metrics.csvMissingCount ? ["CSV local incomplet"] : []),
      ...(!metrics.manifestCountOk ? ["Manifest incoherent"] : []),
    ],
    sources: {
      manifestPath: toRelative(manifestPath),
      checklistPath: checklistPath ? toRelative(checklistPath) : null,
      csvPath: csvPath ? toRelative(csvPath) : null,
    },
    safety: {
      readOnly: true,
      noPublicUploadsWrite: true,
      noImageDownload: true,
      noImageGeneration: true,
      noCatalogWrite: true,
      noPublication: true,
      noPayment: true,
      noSupplierOrder: true,
      manualValidationRequired: true,
    },
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIR, `AUDIT_CHECKLIST_PHOTOS_${DATE_ID}.json`);
  const mdPath = path.join(OUTPUT_DIR, `AUDIT_CHECKLIST_PHOTOS_${DATE_ID}.md`);

  await fs.writeFile(jsonPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  await fs.writeFile(mdPath, markdownReport(audit), "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        status: audit.status,
        output: {
          json: toRelative(jsonPath),
          md: toRelative(mdPath),
        },
        metrics,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

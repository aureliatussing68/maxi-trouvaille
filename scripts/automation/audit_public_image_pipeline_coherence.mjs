import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const requiredFieldKeys = [
  "source_image_exacte",
  "droits_image",
  "meme_article_exact_confirme",
  "variante_exacte_confirmee",
  "validation_mouss",
  "decision_copie_publique",
];
const leakPattern = /(https?:\/\/|aliexpress|alicdn|ae-pic|temu|dhgate|api[_-]?key|token|password|sk_live|sk_test)/i;

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

function latestDirectoryUnder(dirPath, prefix, excludedPrefix = null) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return null;
  }

  return (
    fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          entry.name.startsWith(prefix) &&
          (!excludedPrefix || !entry.name.startsWith(excludedPrefix)),
      )
      .map((entry) => path.join(dirPath, entry.name))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] ?? null
  );
}

function latestFileUnder(dirPath, prefix) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return null;
  }

  return (
    fs
      .readdirSync(dirPath)
      .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
      .map((name) => path.join(dirPath, name))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] ?? null
  );
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function rel(filePath) {
  return filePath ? path.relative(root, filePath).replace(/\\/g, "/") : null;
}

function collectTextFiles(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath)
    .filter((name) => [".json", ".md", ".csv"].includes(path.extname(name).toLowerCase()))
    .map((name) => path.join(dirPath, name));
}

function bySlug(items) {
  return new Map((Array.isArray(items) ? items : []).map((item) => [item.slug, item]));
}

function isProofPath(value) {
  const normalized = String(value ?? "").replace(/\\/g, "/");
  return normalized.startsWith("business-maxi-trouvailles/preuves-images-publiques/");
}

function isTargetPublicPath(value) {
  return /^\/uploads\/partner-products\/[^?#]+\.webp$/i.test(String(value ?? ""));
}

function assertCondition(condition, code, message, details = {}) {
  if (!condition) {
    return { code, message, details };
  }
  return null;
}

function csvEscape(value) {
  const text = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(failures) {
  const headers = ["code", "message", "details"];
  return `${headers.join(",")}\n${failures
    .map((failure) => headers.map((header) => csvEscape(failure[header])).join(","))
    .join("\n")}\n`;
}

function markdown(summary) {
  const rows =
    summary.failures.length === 0
      ? ["| OK | Aucun echec | - |"]
      : summary.failures.map(
          (failure) => `| ${failure.code} | ${failure.message} | ${csvEscape(failure.details)} |`,
        );

  return `${[
    "# Audit coherence pipeline images publiques",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    `- Fiches controlees: ${summary.itemCount}`,
    `- Lignes formulaire: ${summary.formRowCount}`,
    `- Fichiers scannes: ${summary.scannedFileCount}`,
    `- Echecs: ${summary.failureCount}`,
    "",
    "| Code | Message | Details |",
    "|---|---|---|",
    ...rows,
    "",
    "## Garde-fous",
    "",
    "- Lecture seule.",
    "- Valeurs source/fournisseur non exportees.",
    "- Aucune copie publique.",
    "- Aucune modification catalogue.",
    "- Aucune publication.",
    "- Aucun paiement.",
    "- Aucune commande partenaire.",
    "",
  ].join("\n")}\n`;
}

function findLeaks(files) {
  return files
    .map((filePath) => {
      const content = fs.readFileSync(filePath, "utf8");
      if (!leakPattern.test(content)) {
        return null;
      }

      return {
        code: "artifact_leak_marker",
        message: "Marqueur sensible detecte dans un artefact du pipeline images publiques.",
        details: { file: rel(filePath) },
      };
    })
    .filter(Boolean);
}

function source(name, dirPrefix, filePrefix, excludedPrefix = null) {
  const dir = latestDirectoryUnder(actionRoot, dirPrefix, excludedPrefix);
  const file = latestFileUnder(dir, filePrefix);
  return {
    name,
    dir,
    file,
    data: file ? readJson(file) : null,
  };
}

function sameValueFailures(slug, label, expected, candidates) {
  return candidates
    .map(([sourceName, value]) =>
      assertCondition(
        value === expected,
        "pipeline_value_mismatch",
        "Une valeur cle n'est pas alignee entre les artefacts images publiques.",
        { slug, label, expected, sourceName, value },
      ),
    )
    .filter(Boolean);
}

function fieldKeyCounts(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = `${row.slug}#${row.fieldKey}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

const sources = {
  proofPack: source(
    "proofPack",
    "public-image-proof-pack-",
    "PACK_PREUVES_IMAGES_PUBLIQUES_",
    "public-image-proof-pack-audit-",
  ),
  depositAudit: source(
    "depositAudit",
    "public-image-deposit-files-audit-",
    "AUDIT_DEPOT_WEBP_IMAGES_PUBLIQUES_",
  ),
  operatorPack: source(
    "operatorPack",
    "public-image-operator-pack-",
    "PACK_OPERATEUR_DEPOT_IMAGES_PUBLIQUES_",
    "public-image-operator-pack-audit-",
  ),
  moussBoard: source(
    "moussBoard",
    "public-image-mouss-review-board-",
    "BOARD_MOUSS_IMAGES_PUBLIQUES_",
    "public-image-mouss-review-board-audit-",
  ),
  textProofForm: source(
    "textProofForm",
    "public-image-text-proof-form-",
    "FORMULAIRE_PREUVES_TEXTE_IMAGES_PUBLIQUES_",
    "public-image-text-proof-form-audit-",
  ),
  copyGate: source(
    "copyGate",
    "public-image-copy-gate-",
    "GATE_COPIE_IMAGES_PUBLIQUES_",
    "public-image-copy-gate-audit-",
  ),
};

const failures = [];

for (const item of Object.values(sources)) {
  failures.push(
    assertCondition(Boolean(item.file), "source_missing", "Artefact source introuvable.", {
      source: item.name,
      dir: rel(item.dir),
    }),
  );
}

const proofItems = sources.proofPack.data?.items ?? [];
const depositItems = sources.depositAudit.data?.items ?? [];
const operatorItems = sources.operatorPack.data?.items ?? [];
const moussItems = sources.moussBoard.data?.items ?? [];
const formItems = sources.textProofForm.data?.items ?? [];
const formRows = sources.textProofForm.data?.rows ?? [];
const copyItems = sources.copyGate.data?.items ?? [];
const proofBySlug = bySlug(proofItems);
const depositBySlug = bySlug(depositItems);
const operatorBySlug = bySlug(operatorItems);
const moussBySlug = bySlug(moussItems);
const formItemBySlug = bySlug(formItems);
const copyBySlug = bySlug(copyItems);
const rowFieldCounts = fieldKeyCounts(formRows);
const baseSlugs = proofItems.map((item) => item.slug);
const sourceFiles = Object.values(sources).flatMap((item) => collectTextFiles(item.dir));

if (sources.proofPack.data) {
  failures.push(
    assertCondition(sources.proofPack.data.ok === true, "proof_pack_not_ok", "Le pack preuves n'est pas OK."),
    assertCondition(
      sources.proofPack.data.itemCount === proofItems.length,
      "proof_pack_count_mismatch",
      "Le compteur du pack preuves ne correspond pas aux lignes.",
      { itemCount: sources.proofPack.data.itemCount, rows: proofItems.length },
    ),
  );
}

for (const [sourceName, sourceData] of [
  ["depositAudit", sources.depositAudit.data],
  ["operatorPack", sources.operatorPack.data],
  ["moussBoard", sources.moussBoard.data],
  ["textProofForm", sources.textProofForm.data],
]) {
  failures.push(
    assertCondition(
      !sourceData || sourceData.itemCount === baseSlugs.length,
      "source_item_count_mismatch",
      "Un artefact images publiques n'a pas le meme nombre de fiches que le pack preuves.",
      { sourceName, sourceItemCount: sourceData?.itemCount, proofItemCount: baseSlugs.length },
    ),
  );
}

failures.push(
  assertCondition(
    sources.moussBoard.data?.sensitiveValuesExported !== true,
    "mouss_sensitive_values_exported",
    "Le board Mouss indique exporter des valeurs sensibles.",
  ),
  assertCondition(
    sources.textProofForm.data?.sensitiveValuesExported !== true,
    "text_form_sensitive_values_exported",
    "Le formulaire preuves texte indique exporter des valeurs sensibles.",
  ),
  assertCondition(
    sources.copyGate.data?.copyApplied === false,
    "copy_gate_applied",
    "Le gate copie indique une copie publique appliquee.",
    { copyApplied: sources.copyGate.data?.copyApplied },
  ),
  assertCondition(
    sources.operatorPack.data?.copyApplied === false,
    "operator_pack_copy_applied",
    "Le pack operateur indique une copie publique appliquee.",
    { copyApplied: sources.operatorPack.data?.copyApplied },
  ),
  assertCondition(
    sources.copyGate.data?.humanValidationRequired === true,
    "copy_gate_human_validation_missing",
    "Le gate copie ne marque pas la validation humaine obligatoire.",
  ),
  assertCondition(
    sources.textProofForm.data?.rowCount === formRows.length,
    "text_form_row_count_mismatch",
    "Le compteur de lignes du formulaire ne correspond pas aux lignes.",
    { rowCount: sources.textProofForm.data?.rowCount, rows: formRows.length },
  ),
);

for (const [index, proof] of proofItems.entries()) {
  const deposit = depositBySlug.get(proof.slug);
  const operator = operatorBySlug.get(proof.slug);
  const mouss = moussBySlug.get(proof.slug);
  const formItem = formItemBySlug.get(proof.slug);
  const copy = copyBySlug.get(proof.slug);
  const expectedFieldKeys = new Set(requiredFieldKeys);
  const moussFields = new Set(
    (Array.isArray(mouss?.fieldsToFill) ? mouss.fieldsToFill : []).map((field) =>
      String(field)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, ""),
    ),
  );

  failures.push(
    assertCondition(Boolean(proof.slug), "proof_slug_missing", "Slug manquant dans le pack preuves.", { index }),
    assertCondition(Boolean(deposit), "deposit_slug_missing", "Slug absent de l'audit depot WebP.", {
      slug: proof.slug,
    }),
    assertCondition(Boolean(operator), "operator_slug_missing", "Slug absent du pack operateur.", {
      slug: proof.slug,
    }),
    assertCondition(Boolean(mouss), "mouss_slug_missing", "Slug absent du board Mouss.", { slug: proof.slug }),
    assertCondition(Boolean(formItem), "form_slug_missing", "Slug absent du formulaire preuves texte.", {
      slug: proof.slug,
    }),
    assertCondition(Boolean(copy), "copy_gate_slug_missing", "Slug absent du gate copie.", { slug: proof.slug }),
    assertCondition(
      proofItems[index]?.slug === depositItems[index]?.slug &&
        proofItems[index]?.slug === operatorItems[index]?.slug &&
        proofItems[index]?.slug === moussItems[index]?.slug &&
        proofItems[index]?.slug === formItems[index]?.slug &&
        proofItems[index]?.slug === copyItems[index]?.slug,
      "pipeline_order_mismatch",
      "L'ordre des fiches n'est pas identique dans toute la chaine images publiques.",
      {
        index,
        proof: proofItems[index]?.slug,
        deposit: depositItems[index]?.slug,
        operator: operatorItems[index]?.slug,
        mouss: moussItems[index]?.slug,
        form: formItems[index]?.slug,
        copy: copyItems[index]?.slug,
      },
    ),
    assertCondition(isProofPath(proof.dropFolder), "proof_drop_folder_invalid", "Dossier depot invalide.", {
      slug: proof.slug,
      dropFolder: proof.dropFolder,
    }),
    assertCondition(isProofPath(proof.checklistPath), "proof_checklist_path_invalid", "Checklist invalide.", {
      slug: proof.slug,
      checklistPath: proof.checklistPath,
    }),
    assertCondition(isTargetPublicPath(proof.targetPublicPath), "target_public_path_invalid", "Cible publique invalide.", {
      slug: proof.slug,
      targetPublicPath: proof.targetPublicPath,
    }),
    assertCondition(
      String(proof.expectedFileName ?? "").endsWith(".webp"),
      "expected_file_not_webp",
      "Nom de fichier attendu non WebP.",
      { slug: proof.slug, expectedFileName: proof.expectedFileName },
    ),
    ...sameValueFailures(proof.slug, "expectedFileName", proof.expectedFileName, [
      ["depositAudit", deposit?.expectedFileName],
      ["operatorPack", operator?.expectedFileName],
      ["moussBoard", mouss?.expectedFileName],
      ["textProofForm", formItem?.expectedFileName],
    ]),
    ...sameValueFailures(proof.slug, "targetPublicPath", proof.targetPublicPath, [
      ["operatorPack", operator?.targetPublicPath],
      ["moussBoard", mouss?.targetPublicPath],
      ["textProofForm", formItem?.targetPublicPath],
      ["copyGate", copy?.targetPublicPath],
    ]),
    ...sameValueFailures(proof.slug, "dropFolder", proof.dropFolder, [
      ["depositAudit", deposit?.dropFolder],
      ["operatorPack", operator?.dropFolder],
      ["moussBoard", mouss?.dropFolder],
      ["textProofForm", formItem?.dropFolder],
    ]),
    assertCondition(
      moussFields.size === expectedFieldKeys.size &&
        [...expectedFieldKeys].every((fieldKey) => moussFields.has(fieldKey)),
      "mouss_fields_to_fill_incomplete",
      "Le board Mouss ne couvre pas les 6 champs preuves texte attendus.",
      { slug: proof.slug, fields: [...moussFields] },
    ),
    ...requiredFieldKeys.map((fieldKey) =>
      assertCondition(
        rowFieldCounts.get(`${proof.slug}#${fieldKey}`) === 1,
        "text_form_field_row_missing",
        "Le formulaire ne contient pas exactement une ligne pour un champ preuve attendu.",
        { slug: proof.slug, fieldKey, count: rowFieldCounts.get(`${proof.slug}#${fieldKey}`) ?? 0 },
      ),
    ),
    assertCondition(copy?.decision !== "READY_COPY" || sources.copyGate.data?.copyApplied === false, "copy_ready_applied", "Une ligne prete ne doit pas etre copiee automatiquement.", {
      slug: proof.slug,
      decision: copy?.decision,
    }),
  );
}

for (const [index, row] of formRows.entries()) {
  failures.push(
    assertCondition(row.valueToFill === "A_REMPLIR_DANS_CHECKLIST", "text_form_value_not_placeholder", "Le formulaire contient une valeur remplie.", {
      index,
      slug: row.slug,
      fieldKey: row.fieldKey,
    }),
    assertCondition(!Object.hasOwn(row, "evidenceValues"), "text_form_evidence_values_exported", "Le formulaire expose des valeurs de preuve.", {
      index,
      slug: row.slug,
    }),
    assertCondition(!leakPattern.test(JSON.stringify(row)), "text_form_row_leak_marker", "Marqueur sensible dans une ligne formulaire.", {
      index,
      slug: row.slug,
      fieldKey: row.fieldKey,
    }),
  );
}

failures.push(...findLeaks(sourceFiles));

const cleanFailures = failures.filter(Boolean);
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `public-image-pipeline-coherence-audit-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: cleanFailures.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_public_image_pipeline_coherence_audit",
  sources: Object.fromEntries(Object.entries(sources).map(([key, item]) => [key, rel(item.file)])),
  itemCount: baseSlugs.length,
  formRowCount: formRows.length,
  scannedFileCount: sourceFiles.length,
  failureCount: cleanFailures.length,
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
    noMessageSent: true,
  },
};

const jsonPath = path.join(outputDir, `AUDIT_COHERENCE_PIPELINE_IMAGES_PUBLIQUES_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_COHERENCE_PIPELINE_IMAGES_PUBLIQUES_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-audit-coherence-pipeline-images-publiques-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, toCsv(cleanFailures), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      itemCount: summary.itemCount,
      formRowCount: summary.formRowCount,
      scannedFileCount: summary.scannedFileCount,
      failureCount: summary.failureCount,
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

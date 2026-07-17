import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sessionRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "session-sourcing-integration-articles",
);
const packetRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "sourcing-integration-articles",
);
const intakeAuditRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "audit-sourcing-integration-articles",
);
const executionBoardRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "execution-integration-articles",
);
const imageDepositRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "depots-images-exactes",
  "integration-articles",
);
const outputRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "tableaux-action",
  "audit-session-sourcing-integration-articles",
);

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
const requiredZones = [
  "Fournisseur / SKU",
  "Prix / stock / marge",
  "Livraison / suivi",
  "Images / droits",
  "Validation Mouss",
];
const forbiddenSupplierPattern = /\b(aliexpress|ali\s*express|temu|wish|shein)\b/i;
const sensitivePattern = /\b(api[_-]?key|bearer\s+[a-z0-9._-]+|password|secret|sk-[a-z0-9])/i;

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function walkFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
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

function findLatestFile(dir, pattern) {
  const files = walkFiles(dir, (filePath) => pattern.test(filePath));

  if (files.length === 0) {
    return null;
  }

  return files
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0].filePath;
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
  if (/[",\n\r;]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
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

function readCsvRows(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const lines = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length <= 1) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function samePath(left, right) {
  if (!left || !right) return false;

  return path.resolve(left) === path.resolve(right);
}

function isInsidePath(child, parent) {
  if (!child || !parent) return false;

  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isInternalAdminHref(value) {
  const text = String(value ?? "").trim();
  return (
    text.startsWith("/admin/") &&
    !text.startsWith("//") &&
    !/^https?:\/\//i.test(text) &&
    !forbiddenSupplierPattern.test(text) &&
    !sensitivePattern.test(text)
  );
}

function addIssue(collection, scope, code, message, details = {}) {
  collection.push({
    scope,
    code,
    message,
    ...details,
  });
}

function countZones(products) {
  const counts = Object.fromEntries(requiredZones.map((zone) => [zone, 0]));

  for (const product of products) {
    for (const field of product.fields ?? []) {
      counts[field.zone] = (counts[field.zone] ?? 0) + 1;
    }
  }

  return counts;
}

function listSessionArtifactFiles(sessionPath, sessionDateKey, products) {
  const sessionDir = path.dirname(sessionPath);
  const productDir = path.join(sessionDir, "produits");
  const files = [
    sessionPath,
    path.join(sessionDir, `SESSION_SOURCING_INTEGRATION_${sessionDateKey}.md`),
    path.join(sessionDir, `SESSION_SOURCING_INTEGRATION_CHAMPS_PREUVES_${sessionDateKey}.csv`),
    path.join(sessionDir, `SESSION_SOURCING_INTEGRATION_IMAGES_${sessionDateKey}.csv`),
  ];

  for (const product of products) {
    files.push(path.join(productDir, `${product.slug}.md`));
    files.push(path.join(productDir, `${product.slug}.json`));
  }

  return files;
}

function assertNoLeaksInArtifacts(files, failures) {
  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf8");
    if (forbiddenSupplierPattern.test(content)) {
      addIssue(
        failures,
        "artifacts",
        "forbidden_marketplace_string_detected",
        "Un nom marketplace interdit apparait dans les artefacts de session.",
        { filePath },
      );
    }

    if (sensitivePattern.test(content)) {
      addIssue(
        failures,
        "artifacts",
        "sensitive_string_detected",
        "Une chaine proche d'un secret ou token apparait dans les artefacts de session.",
        { filePath },
      );
    }
  }
}

function auditProduct(product, packet, sessionDir) {
  const failures = [];
  const warnings = [];
  const productDir = path.join(sessionDir, "produits");
  const productJsonPath = path.join(productDir, `${product.slug}.json`);
  const productMarkdownPath = path.join(productDir, `${product.slug}.md`);
  const fields = product.fields ?? [];
  const imageTasks = product.imageTasks ?? [];
  const zones = new Set(fields.map((field) => field.zone));
  const missingZones = requiredZones.filter((zone) => !zones.has(zone));

  if (!packet) {
    addIssue(failures, product.id, "packet_missing", "Produit absent des packets sourcing.");
  }

  if (!String(product.packetStatus ?? "").startsWith("HOLD")) {
    addIssue(failures, product.id, "packet_status_not_hold", "Le statut packet ne reste pas en HOLD.");
  }

  if (!String(product.intakeStatus ?? "").startsWith("HOLD")) {
    addIssue(failures, product.id, "intake_status_not_hold", "Le statut intake ne reste pas en HOLD.");
  }

  if (missingZones.length > 0) {
    addIssue(failures, product.id, "proof_zones_missing", "Zones de preuve manquantes.", {
      missingZones,
    });
  }

  if (fields.length < 10) {
    addIssue(failures, product.id, "proof_fields_too_few", "Moins de 10 champs de preuve dans la fiche session.");
  } else if (fields.length !== 11) {
    addIssue(warnings, product.id, "proof_fields_unexpected_count", "Le nombre de champs differe du gabarit courant.", {
      fieldCount: fields.length,
    });
  }

  for (const field of fields) {
    if (!field.required) {
      addIssue(failures, product.id, "proof_field_not_required", "Un champ de preuve obligatoire est marque non requis.", {
        key: field.key,
      });
    }

    if (field.status !== "TO_FILL_HOLD") {
      addIssue(failures, product.id, "proof_field_status_not_hold", "Un champ de preuve ne reste pas TO_FILL_HOLD.", {
        key: field.key,
        status: field.status,
      });
    }

    if (!isInternalAdminHref(field.adminHref)) {
      addIssue(failures, product.id, "proof_field_admin_href_invalid", "Un lien de preuve sort du format admin interne.", {
        key: field.key,
        adminHref: field.adminHref,
      });
    }
  }

  if (imageTasks.length !== 3) {
    addIssue(failures, product.id, "image_tasks_count_invalid", "Chaque produit doit attendre exactement 3 WebP exacts.", {
      imageTaskCount: imageTasks.length,
    });
  }

  if (!isInsidePath(product.imageDepositDir, imageDepositRoot)) {
    addIssue(failures, product.id, "image_deposit_dir_outside_root", "Le dossier de depot image sort du depot autorise.", {
      imageDepositDir: product.imageDepositDir,
    });
  }

  for (const task of imageTasks) {
    if (task.status !== "MISSING_HOLD") {
      addIssue(failures, product.id, "image_task_status_not_hold", "Une tache image ne reste pas MISSING_HOLD.", {
        fileName: task.fileName,
        status: task.status,
      });
    }

    if (!String(task.fileName ?? "").endsWith(".webp")) {
      addIssue(failures, product.id, "image_task_not_webp", "Un fichier image attendu n'est pas en WebP.", {
        fileName: task.fileName,
      });
    }

    if (!isInsidePath(task.depositPath, imageDepositRoot)) {
      addIssue(failures, product.id, "image_task_deposit_path_outside_root", "Un chemin WebP sort du depot autorise.", {
        fileName: task.fileName,
        depositPath: task.depositPath,
      });
    }

    if (!isInsidePath(task.depositPath, product.imageDepositDir)) {
      addIssue(failures, product.id, "image_task_not_inside_product_dir", "Un chemin WebP ne reste pas dans le dossier du produit.", {
        fileName: task.fileName,
        depositPath: task.depositPath,
      });
    }
  }

  for (const [key, value] of Object.entries(product.adminLinks ?? {})) {
    if (!isInternalAdminHref(value)) {
      addIssue(failures, product.id, "product_admin_link_invalid", "Un lien produit sort du format admin interne.", {
        key,
        value,
      });
    }
  }

  if (!fs.existsSync(productJsonPath)) {
    addIssue(failures, product.id, "product_json_missing", "Formulaire JSON produit manquant.", {
      productJsonPath,
    });
  } else {
    const formJson = readJson(productJsonPath);
    if (formJson.id !== product.id) {
      addIssue(failures, product.id, "product_json_id_mismatch", "Le JSON produit ne correspond pas au produit session.", {
        productJsonPath,
      });
    }
  }

  if (!fs.existsSync(productMarkdownPath)) {
    addIssue(failures, product.id, "product_markdown_missing", "Formulaire Markdown produit manquant.", {
      productMarkdownPath,
    });
  } else {
    const markdown = fs.readFileSync(productMarkdownPath, "utf8");
    if (!markdown.includes(product.name)) {
      addIssue(failures, product.id, "product_markdown_name_missing", "Le Markdown produit ne contient pas le nom produit.", {
        productMarkdownPath,
      });
    }
  }

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    categoryId: product.categoryId,
    priority: product.priority,
    lane: product.lane,
    fieldsCount: fields.length,
    imageTaskCount: imageTasks.length,
    missingZones,
    productJsonPath,
    productMarkdownPath,
    status: failures.length === 0 ? "HOLD_SESSION_READY_TO_FILL" : "HOLD_SESSION_SYNC_TO_FIX",
    failures,
    warnings,
  };
}

function csvReport(payload) {
  const headers = [
    "priority",
    "id",
    "name",
    "status",
    "fields",
    "images",
    "missing_zones",
    "failures",
    "warnings",
    "product_json_path",
    "product_markdown_path",
  ];
  const rows = payload.rows.map((row) =>
    [
      row.priority,
      row.id,
      row.name,
      row.status,
      row.fieldsCount,
      row.imageTaskCount,
      row.missingZones.join("|"),
      row.failures.map((issue) => issue.code).join("|"),
      row.warnings.map((issue) => issue.code).join("|"),
      row.productJsonPath,
      row.productMarkdownPath,
    ]
      .map(csvEscape)
      .join(";"),
  );

  return `${headers.join(";")}\n${rows.join("\n")}\n`;
}

function markdownReport(payload) {
  const lines = [
    "# Audit session sourcing integration articles",
    "",
    `Date: ${payload.generatedAt}`,
    `Statut: ${payload.status}`,
    "",
    "## Synthese",
    "",
    `- Produits session: ${payload.productCount}`,
    `- Packets alignes: ${payload.packetAlignmentOk ? "oui" : "non"}`,
    `- Champs preuve: ${payload.evidenceFieldCount}`,
    `- Lignes CSV preuves: ${payload.evidenceCsvRowCount}`,
    `- Images WebP attendues: ${payload.expectedImageCount}`,
    `- Lignes CSV images: ${payload.imageCsvRowCount}`,
    `- Formulaires produits: ${payload.productFormJsonCount} JSON / ${payload.productFormMarkdownCount} MD`,
    `- Echecs structurels: ${payload.failureCount}`,
    `- Alertes non bloquantes: ${payload.warningCount}`,
    "",
    "## Sources",
    "",
    `- Session: ${payload.sources.sessionPath}`,
    `- Packets: ${payload.sources.packetsPath ?? "absent"}`,
    `- Audit intake: ${payload.sources.intakeAuditPath ?? "absent"}`,
    `- Board execution: ${payload.sources.executionBoardPath ?? "absent"}`,
    "",
    "## Produits",
    "",
    "| # | Produit | Statut | Champs | Images | Zones manquantes |",
    "|---|---|---|---:|---:|---|",
    ...payload.rows.map(
      (row) =>
        `| ${row.priority} | ${row.name} | ${row.status} | ${row.fieldsCount} | ${row.imageTaskCount} | ${row.missingZones.join(", ") || "aucune"} |`,
    ),
    "",
    "## Zones",
    "",
    ...Object.entries(payload.zoneCounts).map(([zone, count]) => `- ${zone}: ${count}`),
    "",
    "## Garde-fous",
    "",
    "- Lecture seule cote catalogue.",
    "- Aucun fournisseur contacte.",
    "- Aucun achat, paiement, commande, publication ou deploiement.",
    "- Liens admin internes uniquement.",
    "- Depots WebP exacts limites au dossier integration articles.",
    "- Statut business maintenu en HOLD tant que les preuves reelles manquent.",
    "",
  ];

  if (payload.failures.length > 0) {
    lines.push("## Echecs", "");
    for (const issue of payload.failures) {
      lines.push(`- ${issue.scope}: ${issue.code} - ${issue.message}`);
    }
    lines.push("");
  }

  if (payload.warnings.length > 0) {
    lines.push("## Alertes", "");
    for (const issue of payload.warnings) {
      lines.push(`- ${issue.scope}: ${issue.code} - ${issue.message}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

const generatedAt = new Date().toISOString();
const dateKey = localDateKey();
const sessionPath = findLatestFile(sessionRoot, /SESSION_SOURCING_INTEGRATION_\d+\.json$/);

if (!sessionPath) {
  throw new Error(`No integration sourcing session found in ${sessionRoot}`);
}

const sessionDateKey = path.basename(sessionPath).match(/(\d{8})/)?.[1] ?? dateKey;
const sessionDir = path.dirname(sessionPath);
const evidenceCsvPath = path.join(
  sessionDir,
  `SESSION_SOURCING_INTEGRATION_CHAMPS_PREUVES_${sessionDateKey}.csv`,
);
const imagesCsvPath = path.join(
  sessionDir,
  `SESSION_SOURCING_INTEGRATION_IMAGES_${sessionDateKey}.csv`,
);
const latestPacketsPath = findLatestFile(packetRoot, /PACKETS_SOURCING_INTEGRATION_\d+\.json$/);
const latestIntakeAuditPath = findLatestFile(intakeAuditRoot, /AUDIT_SOURCING_INTEGRATION_\d+\.json$/);
const latestExecutionBoardPath = findLatestFile(
  executionBoardRoot,
  /EXECUTION_INTEGRATION_ARTICLES_\d+\.json$/,
);
const session = readJson(sessionPath);
const packetsPayload = latestPacketsPath ? readJson(latestPacketsPath) : null;
const intakeAudit = latestIntakeAuditPath ? readJson(latestIntakeAuditPath) : null;
const packets = packetsPayload?.packets ?? [];
const products = session.products ?? [];
const failures = [];
const warnings = [];

if (session.mode !== "read_only_integration_sourcing_terrain_session") {
  addIssue(failures, "session", "mode_invalid", "La session ne declare pas le mode lecture seule attendu.", {
    mode: session.mode,
  });
}

if (session.status !== "HOLD_SOURCING_SESSION") {
  addIssue(failures, "session", "status_not_hold", "La session ne reste pas en HOLD_SOURCING_SESSION.", {
    status: session.status,
  });
}

for (const flag of requiredSafetyFlags) {
  if (session.safety?.[flag] !== true) {
    addIssue(failures, "session", "safety_flag_missing", "Un garde-fou session n'est pas vrai.", {
      flag,
      value: session.safety?.[flag],
    });
  }
}

if (!latestPacketsPath) {
  addIssue(failures, "sources", "latest_packets_missing", "Aucun packet sourcing integration trouve.");
} else if (!samePath(session.sources?.packetsPath, latestPacketsPath)) {
  addIssue(failures, "sources", "session_packets_not_latest", "La session ne pointe pas vers les derniers packets.", {
    sessionPacketsPath: session.sources?.packetsPath,
    latestPacketsPath,
  });
}

if (!latestIntakeAuditPath) {
  addIssue(failures, "sources", "latest_intake_audit_missing", "Aucun audit intake sourcing integration trouve.");
} else if (!samePath(session.sources?.intakeAuditPath, latestIntakeAuditPath)) {
  addIssue(failures, "sources", "session_intake_audit_not_latest", "La session ne pointe pas vers le dernier audit intake.", {
    sessionIntakeAuditPath: session.sources?.intakeAuditPath,
    latestIntakeAuditPath,
  });
}

if (!latestExecutionBoardPath) {
  addIssue(failures, "sources", "latest_execution_board_missing", "Aucun board execution integration trouve.");
} else if (!samePath(session.sources?.executionBoardPath, latestExecutionBoardPath)) {
  addIssue(failures, "sources", "session_execution_board_not_latest", "La session ne pointe pas vers le dernier board execution.", {
    sessionExecutionBoardPath: session.sources?.executionBoardPath,
    latestExecutionBoardPath,
  });
}

if (intakeAudit && !String(intakeAudit.status ?? "").startsWith("HOLD")) {
  addIssue(
    failures,
    "intake_audit",
    "intake_audit_not_hold",
    "Le dernier audit intake n'est pas dans un statut HOLD.",
    { status: intakeAudit.status },
  );
}

if (session.packetCount !== packets.length) {
  addIssue(failures, "counts", "packet_count_mismatch", "Compteur packets incoherent.", {
    sessionPacketCount: session.packetCount,
    actualPacketCount: packets.length,
  });
}

if (session.productCount !== products.length) {
  addIssue(failures, "counts", "product_count_mismatch", "Compteur produits incoherent.", {
    sessionProductCount: session.productCount,
    actualProductCount: products.length,
  });
}

const evidenceFieldCount = products.reduce((sum, product) => sum + (product.fields?.length ?? 0), 0);
const expectedImageCount = products.reduce((sum, product) => sum + (product.imageTasks?.length ?? 0), 0);

if (session.evidenceFieldCount !== evidenceFieldCount) {
  addIssue(failures, "counts", "evidence_field_count_mismatch", "Compteur champs preuve incoherent.", {
    sessionEvidenceFieldCount: session.evidenceFieldCount,
    actualEvidenceFieldCount: evidenceFieldCount,
  });
}

if (session.expectedImageCount !== expectedImageCount) {
  addIssue(failures, "counts", "expected_image_count_mismatch", "Compteur images incoherent.", {
    sessionExpectedImageCount: session.expectedImageCount,
    actualExpectedImageCount: expectedImageCount,
  });
}

const packetById = new Map(packets.map((packet) => [packet.id, packet]));
const sessionIds = products.map((product) => product.id).sort();
const packetIds = packets.map((packet) => packet.id).sort();
const packetAlignmentOk = JSON.stringify(sessionIds) === JSON.stringify(packetIds);

if (!packetAlignmentOk) {
  addIssue(failures, "products", "product_packet_alignment_mismatch", "Les produits session ne correspondent pas aux packets.", {
    sessionIds,
    packetIds,
  });
}

const rows = products.map((product) => auditProduct(product, packetById.get(product.id), sessionDir));
for (const row of rows) {
  failures.push(...row.failures);
  warnings.push(...row.warnings);
}

if (!fs.existsSync(evidenceCsvPath)) {
  addIssue(failures, "csv", "evidence_csv_missing", "CSV champs preuves manquant.", {
    evidenceCsvPath,
  });
}

if (!fs.existsSync(imagesCsvPath)) {
  addIssue(failures, "csv", "images_csv_missing", "CSV images manquant.", {
    imagesCsvPath,
  });
}

const evidenceCsvRows = readCsvRows(evidenceCsvPath);
const imageCsvRows = readCsvRows(imagesCsvPath);

if (evidenceCsvRows.length !== evidenceFieldCount) {
  addIssue(failures, "csv", "evidence_csv_row_count_mismatch", "Nombre de lignes CSV preuves incoherent.", {
    expected: evidenceFieldCount,
    actual: evidenceCsvRows.length,
  });
}

if (imageCsvRows.length !== expectedImageCount) {
  addIssue(failures, "csv", "images_csv_row_count_mismatch", "Nombre de lignes CSV images incoherent.", {
    expected: expectedImageCount,
    actual: imageCsvRows.length,
  });
}

assertNoLeaksInArtifacts(listSessionArtifactFiles(sessionPath, sessionDateKey, products), failures);

const productFormJsonCount = rows.filter((row) => fs.existsSync(row.productJsonPath)).length;
const productFormMarkdownCount = rows.filter((row) => fs.existsSync(row.productMarkdownPath)).length;
const payload = {
  generatedAt,
  mode: "read_only_integration_sourcing_session_audit",
  status:
    failures.length === 0
      ? "OK_SESSION_SOURCING_HOLD_SYNC"
      : "HOLD_SESSION_SOURCING_A_CORRIGER",
  sources: {
    sessionPath,
    packetsPath: latestPacketsPath,
    intakeAuditPath: latestIntakeAuditPath,
    executionBoardPath: latestExecutionBoardPath,
    evidenceCsvPath,
    imagesCsvPath,
  },
  productCount: products.length,
  packetCount: packets.length,
  packetAlignmentOk,
  evidenceFieldCount,
  expectedImageCount,
  evidenceCsvRowCount: evidenceCsvRows.length,
  imageCsvRowCount: imageCsvRows.length,
  productFormJsonCount,
  productFormMarkdownCount,
  zoneCounts: countZones(products),
  failureCount: failures.length,
  warningCount: warnings.length,
  failures,
  warnings,
  rows,
  safety: {
    readOnly: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noExternalContact: true,
    noImageDownload: true,
    manualValidationRequired: true,
  },
};

const outputDir = path.join(outputRoot, dateKey);
fs.mkdirSync(outputDir, { recursive: true });

const jsonPath = path.join(outputDir, `AUDIT_SESSION_SOURCING_INTEGRATION_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_SESSION_SOURCING_INTEGRATION_${dateKey}.md`);
const csvPath = path.join(outputDir, `AUDIT_SESSION_SOURCING_INTEGRATION_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdownReport(payload), "utf8");
fs.writeFileSync(csvPath, csvReport(payload), "utf8");

console.log(
  JSON.stringify(
    {
      ok: payload.failureCount === 0,
      mode: payload.mode,
      status: payload.status,
      productCount: payload.productCount,
      evidenceFieldCount: payload.evidenceFieldCount,
      expectedImageCount: payload.expectedImageCount,
      failureCount: payload.failureCount,
      warningCount: payload.warningCount,
      files: { jsonPath, mdPath, csvPath },
      safety: payload.safety,
    },
    null,
    2,
  ),
);

if (payload.failureCount > 0) {
  process.exitCode = 1;
}

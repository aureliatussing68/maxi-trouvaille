import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");

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

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function existsDir(dirPath) {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

function collectFiles(dirPath) {
  if (!existsDir(dirPath)) {
    return [];
  }

  const files = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(entryPath));
      continue;
    }

    if ([".json", ".md", ".csv", ".txt"].includes(path.extname(entry.name).toLowerCase())) {
      files.push(entryPath);
    }
  }

  return files;
}

function sourceDirs(dateKey) {
  const datedSubdirs = [
    ["integration-articles", dateKey],
    ["audit-integration-articles", dateKey],
    ["sourcing-integration-articles", dateKey],
    ["audit-sourcing-integration-articles", dateKey],
    ["execution-integration-articles", dateKey],
    ["session-sourcing-integration-articles", dateKey],
    ["audit-session-sourcing-integration-articles", dateKey],
    ["prochaines-preuves-sourcing-integration-articles", dateKey],
    ["audit-prochaines-preuves-sourcing-integration-articles", dateKey],
  ].map((parts) => path.join(actionRoot, ...parts));

  const flatDatedDirs = [
    `public-image-action-board-${dateKey}`,
    `public-image-action-board-audit-${dateKey}`,
    `public-image-proof-pack-${dateKey}`,
    `public-image-proof-pack-audit-${dateKey}`,
    `public-image-deposit-files-audit-${dateKey}`,
    `public-image-deposit-session-${dateKey}`,
    `public-image-deposit-session-audit-${dateKey}`,
    `public-image-copy-gate-${dateKey}`,
    `public-image-copy-gate-audit-${dateKey}`,
    `public-image-operator-pack-${dateKey}`,
    `public-image-operator-pack-audit-${dateKey}`,
    `public-image-mouss-review-board-${dateKey}`,
    `public-image-mouss-review-board-audit-${dateKey}`,
    `public-image-text-proof-form-${dateKey}`,
    `public-image-text-proof-form-audit-${dateKey}`,
    `public-image-pipeline-coherence-audit-${dateKey}`,
    `public-catalog-source-guards-${dateKey}`,
    `surface-visuelle-publique-${dateKey}`,
    `audit-seo-hold-visibility-${dateKey}`,
    `surface-publique-dropshipping-${dateKey}`,
    `public-image-contract-fixtures-${dateKey}`,
    `execution-du-jour-${dateKey}`,
    `execution-du-jour-audit-${dateKey}`,
    `audit-artefacts-generes-sensibles-${dateKey}`,
  ].map((name) => path.join(actionRoot, name));

  return [...datedSubdirs, ...flatDatedDirs].filter(existsDir);
}

function matchFindings(line) {
  const findings = [];
  const externalUrlRegex = /https?:\/\/[^\s"'<>;)]+/gi;
  const marketplaceRegex = /\b(aliexpress|ali\s*express|alicdn|ae-pic|temu|dhgate|1688)\b/gi;
  const secretRegex =
    /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|bearer|secret|password)\b\s*[:=]\s*["']?[^"',;\s]{8,}/gi;
  const keyLikeRegex = /\b(sk|pk)_(live|test)_[A-Za-z0-9]{12,}\b|\bsk-[A-Za-z0-9]{12,}\b/g;

  for (const match of line.matchAll(externalUrlRegex)) {
    findings.push({ type: "external_url", value: match[0] });
  }

  for (const match of line.matchAll(marketplaceRegex)) {
    findings.push({ type: "marketplace_marker", value: match[0] });
  }

  for (const match of line.matchAll(secretRegex)) {
    findings.push({ type: "sensitive_assignment", value: match[0].slice(0, 80) });
  }

  for (const match of line.matchAll(keyLikeRegex)) {
    findings.push({ type: "key_like_value", value: match[0].slice(0, 80) });
  }

  return findings;
}

function scanFile(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const findings = [];

  lines.forEach((line, index) => {
    for (const finding of matchFindings(line)) {
      findings.push({
        file: rel(filePath),
        line: index + 1,
        type: finding.type,
        sample: finding.value,
      });
    }
  });

  return findings;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(findings) {
  const headers = ["file", "line", "type", "sample"];
  const rows = findings.map((finding) => headers.map((header) => csvEscape(finding[header])).join(","));
  return `${headers.join(",")}\n${rows.join("\n")}${rows.length > 0 ? "\n" : ""}`;
}

function markdown(summary) {
  const rows =
    summary.findings.length === 0
      ? ["| OK | Aucun marqueur sensible detecte | - | - |"]
      : summary.findings.map(
          (finding) => `| ${finding.type} | ${finding.file} | ${finding.line} | ${finding.sample} |`,
        );

  return `${[
    "# Audit artefacts generes - fuites sensibles",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    `- Dossiers scannes: ${summary.scannedDirectoryCount}`,
    `- Fichiers scannes: ${summary.scannedFileCount}`,
    `- Alertes: ${summary.findingCount}`,
    "",
    "| Type | Fichier | Ligne | Extrait |",
    "|---|---|---:|---|",
    ...rows,
    "",
    "## Notes",
    "",
    "- Les noms de champs vides comme `exactProductUrl` ou `supplierUrlMissingHold` ne sont pas des fuites.",
    "- Les liens internes `/admin/...` et les chemins locaux Windows sont autorises.",
    "- Les URLs externes reelles, marketplaces interdites et valeurs de cle sont bloquees.",
    "",
    "## Garde-fous",
    "",
    "- Lecture seule.",
    "- Aucune modification catalogue.",
    "- Aucune publication.",
    "- Aucun paiement.",
    "- Aucune commande partenaire.",
    "",
  ].join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const dirs = sourceDirs(dateKey);
const files = dirs.flatMap(collectFiles);
const findings = files.flatMap(scanFile);
const outputDir = path.join(actionRoot, `audit-artefacts-generes-sensibles-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: findings.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_generated_artifact_leak_audit",
  scannedDirectories: dirs.map(rel),
  scannedDirectoryCount: dirs.length,
  scannedFileCount: files.length,
  findingCount: findings.length,
  findings,
  safety: {
    readOnlyAudit: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noExternalRequest: true,
  },
};

const jsonPath = path.join(outputDir, `AUDIT_ARTEFACTS_GENERES_SENSIBLES_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_ARTEFACTS_GENERES_SENSIBLES_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-audit-artefacts-generes-sensibles-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, toCsv(findings), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      scannedDirectoryCount: summary.scannedDirectoryCount,
      scannedFileCount: summary.scannedFileCount,
      findingCount: summary.findingCount,
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

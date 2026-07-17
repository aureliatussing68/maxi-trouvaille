import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessDir = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessDir, "tableaux-action");

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

function collectFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, predicate, out);
    } else if (predicate(entry.name, fullPath)) {
      out.push(fullPath);
    }
  }

  return out;
}

function latestFileUnder(dir, predicate, label) {
  const matches = collectFiles(dir, predicate)
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (matches.length === 0) {
    throw new Error(`No ${label} found under ${dir}`);
  }

  const todayKey = datePartsParis().dateKey;
  return matches.find((match) => match.fullPath.includes(todayKey))?.fullPath ?? matches[0].fullPath;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relativePath(filePath) {
  return path.relative(root, filePath);
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function laneLabel(lane) {
  const labels = {
    image_categorie_dropshipping: "Image categorie",
    photo_produit_exacte: "Photo produit",
  };

  return labels[lane] ?? String(lane ?? "").replace(/_/g, " ");
}

function groupKey(item) {
  return `${item.lane}::${item.targetId}::${item.dropFolderRelative}`;
}

function groupVisualItems(items) {
  const groups = new Map();

  for (const item of items) {
    const key = groupKey(item);
    const current = groups.get(key) ?? {
      groupOrder: groups.size + 1,
      lane: item.lane,
      laneLabel: laneLabel(item.lane),
      urgency: item.urgency,
      targetType: item.targetType,
      targetName: item.targetName,
      targetId: item.targetId,
      categoryId: item.categoryId,
      dropFolderRelative: item.dropFolderRelative,
      status: item.safetyStatus,
      itemCount: 0,
      missingCount: 0,
      readyCount: 0,
      firstPriority: item.priority,
      expectedFiles: [],
      checklist: [],
    };

    current.itemCount += 1;
    current.firstPriority = Math.min(current.firstPriority, item.priority);
    if (String(item.currentStatus ?? "").includes("present_valid")) {
      current.readyCount += 1;
    } else {
      current.missingCount += 1;
    }
    current.expectedFiles.push(item.expectedFileName);
    current.checklist.push({
      priority: item.priority,
      fileName: item.expectedFileName,
      requiredShot: item.requiredShot,
      stagingRelativePath: item.stagingRelativePath,
      nextAction: item.nextAction,
      safetyStatus: item.safetyStatus,
    });

    groups.set(key, current);
  }

  return [...groups.values()].sort((a, b) => a.firstPriority - b.firstPriority);
}

function sessionItems(items, groups) {
  const groupByKey = new Map(
    groups.map((group) => [
      `${group.lane}::${group.targetId}::${group.dropFolderRelative}`,
      group,
    ]),
  );

  return items.map((item, index) => {
    const group = groupByKey.get(groupKey(item));
    return {
      sessionOrder: index + 1,
      groupOrder: group?.groupOrder ?? 0,
      urgency: item.urgency,
      lane: item.lane,
      targetType: item.targetType,
      targetName: item.targetName,
      targetId: item.targetId,
      expectedFileName: item.expectedFileName,
      currentStatus: item.currentStatus,
      dropFolderRelative: item.dropFolderRelative,
      stagingRelativePath: item.stagingRelativePath,
      requiredShot: item.requiredShot,
      nextAction: item.nextAction,
      safetyStatus: item.safetyStatus,
      postDepositChecks:
        item.lane === "photo_produit_exacte"
          ? [
              "npm run catalog:photo-drop-kit",
              "npm run catalog:audit-photo-checklist",
              "npm run catalog:audit-sprint-image-human-review",
            ]
          : [
              "npm run catalog:category-image-intake-status",
              "npm run catalog:category-image-promotion-plan",
            ],
    };
  });
}

function sessionStatus(board, audit, items) {
  if (!audit.ok || audit.failureCount > 0) {
    return "HOLD_VISUAL_DEPOSIT_SESSION_AUDIT_REQUIRED";
  }
  if (!board.ok || !String(board.status ?? "").startsWith("HOLD")) {
    return "HOLD_VISUAL_DEPOSIT_SESSION_BOARD_REQUIRED";
  }
  if (items.length === 0) {
    return "READY_VISUAL_DEPOSIT_EMPTY_HUMAN_REVIEW_HOLD";
  }
  return "HOLD_VISUAL_DEPOSIT_SESSION_READY";
}

function csv(session) {
  const headers = [
    "session_order",
    "group_order",
    "urgency",
    "lane",
    "target_type",
    "target_name",
    "expected_file_name",
    "current_status",
    "drop_folder",
    "staging_path",
    "required_shot",
    "next_action",
    "post_deposit_checks",
    "safety_status",
  ];

  const rows = session.items.map((item) => [
    item.sessionOrder,
    item.groupOrder,
    item.urgency,
    item.lane,
    item.targetType,
    item.targetName,
    item.expectedFileName,
    item.currentStatus,
    item.dropFolderRelative,
    item.stagingRelativePath,
    item.requiredShot,
    item.nextAction,
    item.postDepositChecks,
    item.safetyStatus,
  ]);

  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n") + "\n";
}

function markdown(session) {
  const groupBlocks = session.groups.flatMap((group) => [
    `### ${group.groupOrder}. ${group.targetName}`,
    "",
    `- File: ${group.laneLabel}`,
    `- Urgence: ${group.urgency}`,
    `- Dossier depot: \`${group.dropFolderRelative}\``,
    `- Fichiers attendus: ${group.itemCount}`,
    `- Statut: ${group.status}`,
    "",
    "| Priorite | Fichier | Photo/visuel attendu | Action |",
    "|---:|---|---|---|",
    ...group.checklist.map(
      (item) =>
        `| ${item.priority} | ${mdCell(item.fileName)} | ${mdCell(item.requiredShot)} | ${mdCell(item.nextAction)} |`,
    ),
    "",
  ]);

  return `${[
    "# Maxi Trouvailles - Session depot visuels exacts",
    "",
    `Date locale: ${session.generatedAtLocal}`,
    `Statut: ${session.status}`,
    "",
    "## Synthese",
    "",
    `- Visuels a produire ou deposer: ${session.itemCount}`,
    `- Groupes de travail: ${session.groupCount}`,
    `- P0 photos produits: ${session.counts.p0ProductPhotos}`,
    `- P1/P2 images categories: ${session.counts.categoryImages}`,
    `- Audit coherence: ${session.audit.status}`,
    `- Echecs audit: ${session.audit.failureCount}`,
    "- Copie publique: aucune",
    "- Publication: aucune",
    "- Paiement et commande fournisseur: aucun",
    "",
    "## Ordre de session",
    "",
    "| Ordre | Groupe | Urgence | File | Cible | Fichier | Statut |",
    "|---:|---:|---|---|---|---|---|",
    ...session.items.map(
      (item) =>
        `| ${item.sessionOrder} | ${item.groupOrder} | ${item.urgency} | ${mdCell(item.lane)} | ${mdCell(item.targetName)} | ${mdCell(item.expectedFileName)} | ${mdCell(item.currentStatus)} |`,
    ),
    "",
    "## Groupes de travail",
    "",
    ...groupBlocks,
    "## Commandes apres depot",
    "",
    "```powershell",
    "npm run catalog:photo-drop-kit",
    "npm run catalog:audit-photo-checklist",
    "npm run catalog:category-image-intake-status",
    "npm run catalog:audit-visual-production-board",
    "npm run catalog:visual-deposit-session",
    "npm run catalog:daily-execution-board",
    "```",
    "",
    "## Sources",
    "",
    `- Board visuels: ${session.sources.visualBoardPath}`,
    `- Audit board: ${session.sources.visualAuditPath}`,
    "",
  ].join("\n")}\n`;
}

const { dateKey, localLabel } = datePartsParis();
const visualBoardPath = latestFileUnder(
  actionRoot,
  (name) => name.startsWith("VISUELS_EXACTS_A_PRODUIRE_") && name.endsWith(".json"),
  "visual production board",
);
const visualAuditPath = latestFileUnder(
  actionRoot,
  (name) => name.startsWith("AUDIT_VISUELS_EXACTS_A_PRODUIRE_") && name.endsWith(".json"),
  "visual production board audit",
);
const board = readJson(visualBoardPath);
const audit = readJson(visualAuditPath);
const sourceItems = [...(board.items ?? [])].sort((a, b) => a.priority - b.priority);
const groups = groupVisualItems(sourceItems);
const items = sessionItems(sourceItems, groups);
const outputDir = path.join(actionRoot, `session-depot-visuels-exacts-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const session = {
  ok: audit.ok === true && audit.failureCount === 0 && board.ok === true,
  mode: "read_only_visual_deposit_session",
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  status: sessionStatus(board, audit, items),
  itemCount: items.length,
  groupCount: groups.length,
  counts: {
    p0ProductPhotos: items.filter(
      (item) => item.urgency === "P0" && item.lane === "photo_produit_exacte",
    ).length,
    categoryImages: items.filter((item) => item.lane === "image_categorie_dropshipping").length,
    p1CategoryImages: items.filter(
      (item) => item.urgency === "P1" && item.lane === "image_categorie_dropshipping",
    ).length,
    p2CategoryImages: items.filter(
      (item) => item.urgency === "P2" && item.lane === "image_categorie_dropshipping",
    ).length,
  },
  audit: {
    status: audit.status,
    ok: audit.ok,
    failureCount: audit.failureCount,
    failures: audit.failures ?? [],
  },
  safety: {
    readOnly: true,
    noPublicUploadsWrite: true,
    noImageGeneration: true,
    noImageDownload: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    manualValidationRequired: true,
  },
  sources: {
    visualBoardPath: relativePath(visualBoardPath),
    visualAuditPath: relativePath(visualAuditPath),
  },
  outputDir: relativePath(outputDir),
  groups,
  items,
};

const jsonPath = path.join(outputDir, `SESSION_DEPOT_VISUELS_EXACTS_${dateKey}.json`);
const mdPath = path.join(outputDir, `SESSION_DEPOT_VISUELS_EXACTS_${dateKey}.md`);
const csvPath = path.join(outputDir, `SESSION_DEPOT_VISUELS_EXACTS_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(session), "utf8");
fs.writeFileSync(csvPath, csv(session), "utf8");

console.log(
  JSON.stringify(
    {
      ok: session.ok,
      status: session.status,
      itemCount: session.itemCount,
      groupCount: session.groupCount,
      counts: session.counts,
      audit: session.audit,
      files: {
        jsonPath,
        mdPath,
        csvPath,
      },
      safety: session.safety,
    },
    null,
    2,
  ),
);

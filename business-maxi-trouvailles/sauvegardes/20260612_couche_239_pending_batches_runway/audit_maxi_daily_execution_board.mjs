import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionRoot = path.join(root, "business-maxi-trouvailles", "tableaux-action");
const requiredSafetyFlags = [
  "readOnly",
  "noPublicUploadsWrite",
  "noImageGeneration",
  "noImageDownload",
  "noCatalogWrite",
  "noPublication",
  "noPayment",
  "noSupplierOrder",
  "noMessageSent",
  "manualValidationRequired",
];
const sensitivePattern =
  /(https?:\/\/|aliexpress|alicdn|ae-pic|temu|dhgate|api[_-]?key|token|secret|password|sk_live|sk_test)/i;
const forbiddenPositiveActionPattern =
  /\b(publier|publication|commander|commande fournisseur|payer|paiement|deployer|copier dans public\/uploads|utiliser image approximative)\b/i;
const allowedWarningPattern =
  /\b(ne jamais|ne rien|aucun|aucune|interdit|forbidden|bloque|blocages|desactive|désactive|incomplete|sans validation|avant toute|forbiddenActions)\b/i;

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
  return path.relative(root, filePath).replace(/\\/g, "/");
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
    "# Audit tableau execution du jour",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Tableau source: ${summary.boardJson ?? "introuvable"}`,
    "",
    "## Synthese",
    "",
    `- Statut: ${summary.ok ? "OK" : "ECHEC"}`,
    `- Mode source: ${summary.boardMode ?? "inconnu"}`,
    `- Actions controlees: ${summary.actionCount}`,
    `- Lanes controlees: ${summary.laneCount}`,
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
    "- Aucune modification catalogue.",
    "- Aucune copie image publique.",
    "- Aucune publication.",
    "- Aucun paiement.",
    "- Aucune commande partenaire.",
    "- Aucun message externe.",
    "",
  ].join("\n")}\n`;
}

function hasSensitiveMarker(value) {
  return sensitivePattern.test(String(value ?? ""));
}

function hasPositiveForbiddenAction(value) {
  const text = String(value ?? "");
  return forbiddenPositiveActionPattern.test(text) && !allowedWarningPattern.test(text);
}

function actionFailures(action, index) {
  const forbiddenActions = Array.isArray(action.forbiddenActions) ? action.forbiddenActions : [];
  const nextAction = String(action.nextAction ?? "");
  const allowedAction = String(action.allowedAction ?? "");
  const serialized = JSON.stringify(action);

  return [
    assertCondition(action.rank === index + 1, "action_rank_gap", "Le rang d'action n'est pas continu.", {
      index,
      rank: action.rank,
      id: action.id,
    }),
    assertCondition(typeof action.lane === "string" && action.lane.length > 0, "action_lane_missing", "Lane manquante.", {
      index,
      id: action.id,
    }),
    assertCondition(
      typeof action.status === "string" && action.status.length > 0,
      "action_status_missing",
      "Statut action manquant.",
      { index, id: action.id },
    ),
    assertCondition(!hasSensitiveMarker(serialized), "action_sensitive_marker", "Marqueur sensible dans une action.", {
      index,
      id: action.id,
      lane: action.lane,
    }),
    assertCondition(
      !hasPositiveForbiddenAction(nextAction),
      "next_action_forbidden_positive",
      "Une prochaine action ressemble a une action sensible positive.",
      { index, id: action.id, lane: action.lane, nextAction },
    ),
    assertCondition(
      !hasPositiveForbiddenAction(allowedAction),
      "allowed_action_forbidden_positive",
      "Une action autorisee ressemble a une action sensible.",
      { index, id: action.id, lane: action.lane, allowedAction },
    ),
    assertCondition(
      action.lane !== "images_publiques_exactes" ||
        forbiddenActions.some((item) => /copier dans public\/uploads/i.test(String(item))),
      "public_image_forbidden_copy_missing",
      "Une action image publique ne rappelle pas l'interdiction de copie publique.",
      { index, id: action.id, lane: action.lane },
    ),
    assertCondition(
      action.lane !== "images_publiques_exactes" ||
        forbiddenActions.some((item) => /utiliser image approximative/i.test(String(item))),
      "public_image_forbidden_approx_missing",
      "Une action image publique ne rappelle pas l'interdiction d'image approximative.",
      { index, id: action.id, lane: action.lane },
    ),
    assertCondition(
      action.lane !== "images_publiques_exactes" ||
        forbiddenActions.some((item) => /publier fiche/i.test(String(item))),
      "public_image_forbidden_publish_missing",
      "Une action image publique ne rappelle pas l'interdiction de publication.",
      { index, id: action.id, lane: action.lane },
    ),
    assertCondition(
      action.lane !== "images_publiques_exactes" ||
        forbiddenActions.some((item) => /commander fournisseur/i.test(String(item))),
      "public_image_forbidden_order_missing",
      "Une action image publique ne rappelle pas l'interdiction de commande fournisseur.",
      { index, id: action.id, lane: action.lane },
    ),
  ].filter(Boolean);
}

const boardDir = latestDirectoryUnder(actionRoot, "execution-du-jour-", "execution-du-jour-audit-");
const boardJsonPath = latestFileUnder(boardDir, "EXECUTION_DU_JOUR_MAXI_");
const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `execution-du-jour-audit-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const failures = [];
let board = null;
let actions = [];
let lanes = [];
let scannedFiles = [];

if (!boardDir || !boardJsonPath) {
  failures.push({
    code: "board_missing",
    message: "Aucun tableau execution du jour n'a ete trouve.",
    details: {},
  });
} else {
  board = readJson(boardJsonPath);
  actions = Array.isArray(board.actions) ? board.actions : [];
  lanes = Array.isArray(board.lanes) ? board.lanes : [];
  scannedFiles = collectTextFiles(boardDir);

  failures.push(
    assertCondition(board.ok === true, "board_not_ok", "Le tableau n'est pas marque OK."),
    assertCondition(
      board.mode === "read_only_daily_execution_board",
      "board_mode_invalid",
      "Le mode du tableau est invalide.",
      { mode: board.mode },
    ),
    assertCondition(board.actionCount === actions.length, "action_count_mismatch", "actionCount ne correspond pas.", {
      actionCount: board.actionCount,
      rows: actions.length,
    }),
    assertCondition(lanes.length > 0, "lanes_missing", "Aucune lane presente dans le tableau."),
    assertCondition(actions.length > 0, "actions_missing", "Aucune action presente dans le tableau."),
    ...requiredSafetyFlags.map((flag) =>
      assertCondition(board.safety?.[flag] === true, `safety_${flag}_missing`, `Garde-fou absent: ${flag}.`),
    ),
    assertCondition(
      board.metrics?.generatedArtifactLeakFindingCount === 0,
      "generated_artifact_leak_metric_not_zero",
      "Le tableau indique des fuites dans les artefacts generes.",
      { value: board.metrics?.generatedArtifactLeakFindingCount },
    ),
    assertCondition(
      board.metrics?.publicSurfaceFailureCount === 0,
      "public_surface_failure_metric_not_zero",
      "Le tableau indique des echecs sur la surface publique.",
      { value: board.metrics?.publicSurfaceFailureCount },
    ),
    assertCondition(
      board.metrics?.checkoutFailureCount === 0,
      "checkout_failure_metric_not_zero",
      "Le tableau indique des echecs checkout.",
      { value: board.metrics?.checkoutFailureCount },
    ),
    assertCondition(
      board.metrics?.surpriseFailureCount === 0,
      "surprise_failure_metric_not_zero",
      "Le tableau indique des echecs colis surprise/HOLD.",
      { value: board.metrics?.surpriseFailureCount },
    ),
    assertCondition(
      board.metrics?.publicImageCopyApplied === false,
      "public_image_copy_applied",
      "Le tableau indique une copie image publique appliquee.",
      { value: board.metrics?.publicImageCopyApplied },
    ),
    assertCondition(
      board.metrics?.publicImageMoussSensitiveValuesExported !== true,
      "public_image_mouss_sensitive_values_exported",
      "Le tableau indique des valeurs sensibles exportees par le board Mouss.",
      { value: board.metrics?.publicImageMoussSensitiveValuesExported },
    ),
    assertCondition(
      board.metrics?.publicImageTextProofFormSensitiveValuesExported !== true,
      "public_image_text_proof_form_sensitive_values_exported",
      "Le tableau indique des valeurs sensibles exportees par le formulaire preuves texte images.",
      { value: board.metrics?.publicImageTextProofFormSensitiveValuesExported },
    ),
    assertCondition(
      board.metrics?.publicImagePipelineCoherenceStatus === "OK_PUBLIC_IMAGE_PIPELINE_COHERENT",
      "public_image_pipeline_coherence_status_invalid",
      "Le tableau n'indique pas un audit coherence pipeline images publiques OK.",
      { value: board.metrics?.publicImagePipelineCoherenceStatus },
    ),
    assertCondition(
      board.metrics?.publicImagePipelineCoherenceFailureCount === 0,
      "public_image_pipeline_coherence_failure_metric_not_zero",
      "Le tableau indique des echecs de coherence dans le pipeline images publiques.",
      { value: board.metrics?.publicImagePipelineCoherenceFailureCount },
    ),
    assertCondition(
      board.metrics?.publicImagePipelineCoherenceItemCount === board.metrics?.publicImageTextProofFormItemCount,
      "public_image_pipeline_item_count_mismatch",
      "Le nombre de fiches du controle coherence ne correspond pas au formulaire preuves texte images.",
      {
        pipeline: board.metrics?.publicImagePipelineCoherenceItemCount,
        textForm: board.metrics?.publicImageTextProofFormItemCount,
      },
    ),
    assertCondition(
      board.metrics?.publicImagePipelineCoherenceFormRowCount === board.metrics?.publicImageTextProofFormRowCount,
      "public_image_pipeline_form_row_count_mismatch",
      "Le nombre de lignes du controle coherence ne correspond pas au formulaire preuves texte images.",
      {
        pipeline: board.metrics?.publicImagePipelineCoherenceFormRowCount,
        textForm: board.metrics?.publicImageTextProofFormRowCount,
      },
    ),
    assertCondition(
      board.metrics?.publicCatalogSourceGuardStatus === "OK_PUBLIC_CATALOG_SOURCE_GUARDS",
      "public_catalog_source_guard_status_invalid",
      "Le tableau n'indique pas un audit sources catalogue publiques OK.",
      { value: board.metrics?.publicCatalogSourceGuardStatus },
    ),
    assertCondition(
      board.metrics?.publicCatalogSourceGuardFindingCount === 0,
      "public_catalog_source_guard_findings_not_zero",
      "Le tableau indique des contournements sources catalogue publiques.",
      { value: board.metrics?.publicCatalogSourceGuardFindingCount },
    ),
    assertCondition(
      board.metrics?.publicCatalogSourceGuardWatchedFileCount >= 20,
      "public_catalog_source_guard_watch_scope_too_small",
      "Le perimetre de surveillance des sources publiques semble trop faible.",
      { value: board.metrics?.publicCatalogSourceGuardWatchedFileCount },
    ),
    assertCondition(
      board.metrics?.publicVisualAmbiguityStatus === "OK_PUBLIC_VISUAL_SURFACE_SAFE",
      "public_visual_ambiguity_status_invalid",
      "Le tableau n'indique pas un audit surface visuelle publique OK.",
      { value: board.metrics?.publicVisualAmbiguityStatus },
    ),
    assertCondition(
      board.metrics?.publicVisualAmbiguityFailureCount === 0,
      "public_visual_ambiguity_failure_metric_not_zero",
      "Le tableau indique des ambiguites visuelles publiques.",
      { value: board.metrics?.publicVisualAmbiguityFailureCount },
    ),
    assertCondition(
      board.metrics?.publicVisualAmbiguityStockFindingCount === 0,
      "public_visual_stock_metric_not_zero",
      "Le tableau indique des images stock ou CDN interdites.",
      { value: board.metrics?.publicVisualAmbiguityStockFindingCount },
    ),
    assertCondition(
      board.metrics?.publicVisualAmbiguityHeroGuardOk === true &&
        board.metrics?.publicVisualAmbiguityProductCardAirbagOk === true &&
        board.metrics?.publicVisualAmbiguityProductDetailImageGuardOk === true,
      "public_visual_airbags_not_ok",
      "Un garde-fou visuel public est absent ou en echec.",
      {
        hero: board.metrics?.publicVisualAmbiguityHeroGuardOk,
        productCard: board.metrics?.publicVisualAmbiguityProductCardAirbagOk,
        productDetail: board.metrics?.publicVisualAmbiguityProductDetailImageGuardOk,
      },
    ),
    assertCondition(
      board.metrics?.integrationSourcingPriorityBoardAuditStatus === "OK_PRIORITY_BOARD_GUARDED",
      "integration_priority_board_audit_status_invalid",
      "Le tableau n'indique pas un audit pilotage sourcing integration OK.",
      { value: board.metrics?.integrationSourcingPriorityBoardAuditStatus },
    ),
    assertCondition(
      board.metrics?.integrationSourcingPriorityBoardFailureCount === 0,
      "integration_priority_board_audit_failures_not_zero",
      "Le tableau indique des echecs dans le board pilotage sourcing integration.",
      { value: board.metrics?.integrationSourcingPriorityBoardFailureCount },
    ),
    assertCondition(
      board.metrics?.integrationSourcingPriorityBoardSensitiveFindingCount === 0,
      "integration_priority_board_sensitive_findings_not_zero",
      "Le tableau indique une fuite sensible dans le board pilotage sourcing integration.",
      { value: board.metrics?.integrationSourcingPriorityBoardSensitiveFindingCount },
    ),
    assertCondition(
      board.metrics?.integrationSourcingPriorityBoardProductCount > 0 &&
        board.metrics?.integrationSourcingPriorityBoardExpectedImageCount > 0,
      "integration_priority_board_scope_empty",
      "Le board pilotage sourcing integration semble vide.",
      {
        productCount: board.metrics?.integrationSourcingPriorityBoardProductCount,
        expectedImageCount: board.metrics?.integrationSourcingPriorityBoardExpectedImageCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationTop3SourcingStatus === "HOLD_TOP3_SOURCING_READY",
      "integration_top3_sourcing_status_invalid",
      "Le tableau n'indique pas un sprint top 3 sourcing integration pret en HOLD.",
      { value: board.metrics?.integrationTop3SourcingStatus },
    ),
    assertCondition(
      board.metrics?.integrationTop3SourcingProductCount === 3,
      "integration_top3_sourcing_product_count_invalid",
      "Le sprint top 3 sourcing integration ne contient pas 3 produits.",
      { value: board.metrics?.integrationTop3SourcingProductCount },
    ),
    assertCondition(
      board.metrics?.integrationTop3SourcingMissingFieldCount > 0 &&
        board.metrics?.integrationTop3SourcingExpectedImageCount > 0,
      "integration_top3_sourcing_scope_empty",
      "Le sprint top 3 sourcing integration semble vide.",
      {
        missingFieldCount: board.metrics?.integrationTop3SourcingMissingFieldCount,
        expectedImageCount: board.metrics?.integrationTop3SourcingExpectedImageCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationTop3SourcingAuditStatus === "OK_TOP3_SOURCING_GUARDED",
      "integration_top3_sourcing_audit_status_invalid",
      "Le tableau n'indique pas un audit sprint top 3 sourcing OK.",
      { value: board.metrics?.integrationTop3SourcingAuditStatus },
    ),
    assertCondition(
      board.metrics?.integrationTop3SourcingAuditFailureCount === 0,
      "integration_top3_sourcing_audit_failures_not_zero",
      "Le tableau indique des echecs dans l'audit sprint top 3 sourcing.",
      { value: board.metrics?.integrationTop3SourcingAuditFailureCount },
    ),
    assertCondition(
      board.metrics?.integrationTop3SourcingAuditSensitiveFindingCount === 0,
      "integration_top3_sourcing_audit_sensitive_findings_not_zero",
      "Le tableau indique une fuite sensible dans l'audit sprint top 3 sourcing.",
      { value: board.metrics?.integrationTop3SourcingAuditSensitiveFindingCount },
    ),
    assertCondition(
      board.metrics?.integrationTop3ParallelProofsStatus === "HOLD_TOP3_PARALLEL_PROOFS_WORKPACK_READY",
      "integration_top3_parallel_proofs_status_invalid",
      "Le tableau n'indique pas un pack parallele top 3 pret en HOLD.",
      { value: board.metrics?.integrationTop3ParallelProofsStatus },
    ),
    assertCondition(
      board.metrics?.integrationTop3ParallelProofsProductCount === 3 &&
        board.metrics?.integrationTop3ParallelProofsProofCount === 15,
      "integration_top3_parallel_proofs_scope_invalid",
      "Le pack parallele top 3 ne contient pas le volume 3 produits / 15 preuves attendu.",
      {
        productCount: board.metrics?.integrationTop3ParallelProofsProductCount,
        proofCount: board.metrics?.integrationTop3ParallelProofsProofCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationTop3ParallelProofsAuditStatus === "OK_TOP3_PARALLEL_PROOFS_GUARDED",
      "integration_top3_parallel_proofs_audit_status_invalid",
      "Le tableau n'indique pas un audit pack parallele top 3 OK.",
      { value: board.metrics?.integrationTop3ParallelProofsAuditStatus },
    ),
    assertCondition(
      board.metrics?.integrationTop3ParallelProofsAuditFailureCount === 0,
      "integration_top3_parallel_proofs_audit_failures_not_zero",
      "Le tableau indique des echecs dans l'audit pack parallele top 3.",
      { value: board.metrics?.integrationTop3ParallelProofsAuditFailureCount },
    ),
    assertCondition(
      board.metrics?.integrationTop3ParallelProofsAuditSensitiveFindingCount === 0,
      "integration_top3_parallel_proofs_audit_sensitive_findings_not_zero",
      "Le tableau indique une fuite sensible dans l'audit pack parallele top 3.",
      { value: board.metrics?.integrationTop3ParallelProofsAuditSensitiveFindingCount },
    ),
    assertCondition(
      board.metrics?.integrationTop3WebpStatus === "HOLD_TOP3_WEBP_WORKPACK_READY",
      "integration_top3_webp_status_invalid",
      "Le tableau n'indique pas un pack WebP top 3 pret en HOLD.",
      { value: board.metrics?.integrationTop3WebpStatus },
    ),
    assertCondition(
      board.metrics?.integrationTop3WebpProductCount === 3 &&
        board.metrics?.integrationTop3WebpImageTaskCount === 9,
      "integration_top3_webp_scope_invalid",
      "Le pack WebP top 3 ne contient pas le volume 3 produits / 9 WebP attendu.",
      {
        productCount: board.metrics?.integrationTop3WebpProductCount,
        imageTaskCount: board.metrics?.integrationTop3WebpImageTaskCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationTop3WebpAuditStatus === "OK_TOP3_WEBP_WORKPACK_GUARDED",
      "integration_top3_webp_audit_status_invalid",
      "Le tableau n'indique pas un audit pack WebP top 3 OK.",
      { value: board.metrics?.integrationTop3WebpAuditStatus },
    ),
    assertCondition(
      board.metrics?.integrationTop3WebpAuditFailureCount === 0,
      "integration_top3_webp_audit_failures_not_zero",
      "Le tableau indique des echecs dans l'audit pack WebP top 3.",
      { value: board.metrics?.integrationTop3WebpAuditFailureCount },
    ),
    assertCondition(
      board.metrics?.integrationTop3WebpAuditSensitiveFindingCount === 0,
      "integration_top3_webp_audit_sensitive_findings_not_zero",
      "Le tableau indique une fuite sensible dans l'audit pack WebP top 3.",
      { value: board.metrics?.integrationTop3WebpAuditSensitiveFindingCount },
    ),
    assertCondition(
      ["HOLD_TOP3_WEBP_FILES_MISSING", "READY_TOP3_WEBP_FILES_FOR_HUMAN_REVIEW_HOLD"].includes(
        board.metrics?.integrationTop3WebpDepotAuditStatus,
      ),
      "integration_top3_webp_depot_audit_status_invalid",
      "Le tableau n'indique pas un audit depot WebP top 3 exploitable.",
      { value: board.metrics?.integrationTop3WebpDepotAuditStatus },
    ),
    assertCondition(
      board.metrics?.integrationTop3WebpDepotImageTaskCount === 9,
      "integration_top3_webp_depot_scope_invalid",
      "L'audit depot WebP top 3 ne couvre pas les 9 fichiers attendus.",
      { value: board.metrics?.integrationTop3WebpDepotImageTaskCount },
    ),
    assertCondition(
      (board.metrics?.integrationTop3WebpDepotReadyImageCount ?? 0) +
        (board.metrics?.integrationTop3WebpDepotMissingCount ?? 0) +
        (board.metrics?.integrationTop3WebpDepotInvalidCount ?? 0) ===
        9,
      "integration_top3_webp_depot_counts_invalid",
      "Les compteurs depot WebP top 3 ne retombent pas sur 9 images.",
      {
        ready: board.metrics?.integrationTop3WebpDepotReadyImageCount,
        missing: board.metrics?.integrationTop3WebpDepotMissingCount,
        invalid: board.metrics?.integrationTop3WebpDepotInvalidCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationTop3WebpDepotInvalidCount === 0,
      "integration_top3_webp_depot_invalid_files_not_zero",
      "Le tableau indique des fichiers WebP top 3 invalides dans le depot.",
      { value: board.metrics?.integrationTop3WebpDepotInvalidCount },
    ),
    assertCondition(
      board.metrics?.integrationTop3WebpDepotFailureCount === 0,
      "integration_top3_webp_depot_failures_not_zero",
      "Le tableau indique des echecs structurels dans l'audit depot WebP top 3.",
      { value: board.metrics?.integrationTop3WebpDepotFailureCount },
    ),
    assertCondition(
      board.metrics?.integrationTop3WebpDepotSensitiveFindingCount === 0,
      "integration_top3_webp_depot_sensitive_findings_not_zero",
      "Le tableau indique une fuite sensible dans l'audit depot WebP top 3.",
      { value: board.metrics?.integrationTop3WebpDepotSensitiveFindingCount },
    ),
    assertCondition(
      board.metrics?.integrationTop3WebpDepotSessionStatus === "HOLD_TOP3_WEBP_DEPOT_SESSION_READY",
      "integration_top3_webp_depot_session_status_invalid",
      "Le tableau n'indique pas une session depot WebP top 3 prete en HOLD.",
      { value: board.metrics?.integrationTop3WebpDepotSessionStatus },
    ),
    assertCondition(
      board.metrics?.integrationTop3WebpDepotSessionProductCount === 3 &&
        board.metrics?.integrationTop3WebpDepotSessionGroupCount === 3 &&
        board.metrics?.integrationTop3WebpDepotSessionImageTaskCount === 9,
      "integration_top3_webp_depot_session_scope_invalid",
      "La session depot WebP top 3 ne couvre pas 3 produits / 3 dossiers / 9 WebP.",
      {
        productCount: board.metrics?.integrationTop3WebpDepotSessionProductCount,
        groupCount: board.metrics?.integrationTop3WebpDepotSessionGroupCount,
        imageTaskCount: board.metrics?.integrationTop3WebpDepotSessionImageTaskCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationTop3WebpDepotSessionInstructionFileCount === 3,
      "integration_top3_webp_depot_session_instruction_count_invalid",
      "La session depot WebP top 3 ne contient pas 3 fichiers consigne.",
      { value: board.metrics?.integrationTop3WebpDepotSessionInstructionFileCount },
    ),
    assertCondition(
      board.metrics?.integrationTop3WebpDepotSessionAuditStatus === "OK_TOP3_WEBP_DEPOT_SESSION_GUARDED",
      "integration_top3_webp_depot_session_audit_status_invalid",
      "Le tableau n'indique pas un audit session depot WebP top 3 OK.",
      { value: board.metrics?.integrationTop3WebpDepotSessionAuditStatus },
    ),
    assertCondition(
      board.metrics?.integrationTop3WebpDepotSessionAuditFailureCount === 0,
      "integration_top3_webp_depot_session_audit_failures_not_zero",
      "Le tableau indique des echecs dans l'audit session depot WebP top 3.",
      { value: board.metrics?.integrationTop3WebpDepotSessionAuditFailureCount },
    ),
    assertCondition(
      board.metrics?.integrationTop3WebpDepotSessionAuditSensitiveFindingCount === 0,
      "integration_top3_webp_depot_session_audit_sensitive_findings_not_zero",
      "Le tableau indique une fuite sensible dans l'audit session depot WebP top 3.",
      { value: board.metrics?.integrationTop3WebpDepotSessionAuditSensitiveFindingCount },
    ),
    assertCondition(
      ["HOLD_TOP3_BUSINESS_GATE_BLOCKED", "READY_TOP3_BUSINESS_GATE_HUMAN_REVIEW_HOLD"].includes(
        board.metrics?.integrationTop3BusinessGateStatus,
      ),
      "integration_top3_business_gate_status_invalid",
      "Le tableau n'indique pas un gate business top 3 exploitable.",
      { value: board.metrics?.integrationTop3BusinessGateStatus },
    ),
    assertCondition(
      board.metrics?.integrationTop3BusinessGateProofCount === 15 &&
        board.metrics?.integrationTop3BusinessGateImageTaskCount === 9,
      "integration_top3_business_gate_scope_invalid",
      "Le gate business top 3 ne couvre pas 15 preuves / 9 images.",
      {
        proofCount: board.metrics?.integrationTop3BusinessGateProofCount,
        imageTaskCount: board.metrics?.integrationTop3BusinessGateImageTaskCount,
      },
    ),
    assertCondition(
      (board.metrics?.integrationTop3BusinessGateReadyProofCount ?? 0) +
        (board.metrics?.integrationTop3BusinessGateMissingProofCount ?? 0) ===
        15,
      "integration_top3_business_gate_proof_counts_invalid",
      "Les compteurs preuves du gate top 3 ne retombent pas sur 15.",
      {
        ready: board.metrics?.integrationTop3BusinessGateReadyProofCount,
        missing: board.metrics?.integrationTop3BusinessGateMissingProofCount,
      },
    ),
    assertCondition(
      (board.metrics?.integrationTop3BusinessGateReadyImageCount ?? 0) +
        (board.metrics?.integrationTop3BusinessGateMissingImageCount ?? 0) +
        (board.metrics?.integrationTop3BusinessGateInvalidImageCount ?? 0) ===
        9,
      "integration_top3_business_gate_image_counts_invalid",
      "Les compteurs images du gate top 3 ne retombent pas sur 9.",
      {
        ready: board.metrics?.integrationTop3BusinessGateReadyImageCount,
        missing: board.metrics?.integrationTop3BusinessGateMissingImageCount,
        invalid: board.metrics?.integrationTop3BusinessGateInvalidImageCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationTop3BusinessGateStatus !== "HOLD_TOP3_BUSINESS_GATE_BLOCKED" ||
        board.metrics?.integrationTop3BusinessGateBusinessBlockerCount > 0,
      "integration_top3_business_gate_hold_without_blockers",
      "Le gate top 3 est en HOLD sans blocage business visible.",
      { value: board.metrics?.integrationTop3BusinessGateBusinessBlockerCount },
    ),
    assertCondition(
      board.metrics?.integrationTop3BusinessGateFailureCount === 0,
      "integration_top3_business_gate_failures_not_zero",
      "Le tableau indique des echecs structurels dans le gate business top 3.",
      { value: board.metrics?.integrationTop3BusinessGateFailureCount },
    ),
    assertCondition(
      board.metrics?.integrationTop3BusinessGateSensitiveFindingCount === 0,
      "integration_top3_business_gate_sensitive_findings_not_zero",
      "Le tableau indique une fuite sensible dans le gate business top 3.",
      { value: board.metrics?.integrationTop3BusinessGateSensitiveFindingCount },
    ),
    assertCondition(
      ["HOLD_TOP3_UNBLOCK_PLAN_READY", "READY_TOP3_UNBLOCK_PLAN_HUMAN_REVIEW_HOLD"].includes(
        board.metrics?.integrationTop3UnblockPlanStatus,
      ),
      "integration_top3_unblock_plan_status_invalid",
      "Le tableau n'indique pas un plan deblocage top 3 exploitable.",
      { value: board.metrics?.integrationTop3UnblockPlanStatus },
    ),
    assertCondition(
      board.metrics?.integrationTop3UnblockPlanStepCount === 24 &&
        board.metrics?.integrationTop3UnblockPlanProofStepCount === 15 &&
        board.metrics?.integrationTop3UnblockPlanImageStepCount === 9,
      "integration_top3_unblock_plan_scope_invalid",
      "Le plan deblocage top 3 ne couvre pas 24 actions dont 15 preuves et 9 images.",
      {
        stepCount: board.metrics?.integrationTop3UnblockPlanStepCount,
        proofStepCount: board.metrics?.integrationTop3UnblockPlanProofStepCount,
        imageStepCount: board.metrics?.integrationTop3UnblockPlanImageStepCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationTop3UnblockPlanStatus !== "HOLD_TOP3_UNBLOCK_PLAN_READY" ||
        board.metrics?.integrationTop3UnblockPlanRemainingStepCount > 0,
      "integration_top3_unblock_plan_hold_without_remaining_steps",
      "Le plan deblocage top 3 est en HOLD sans action restante.",
      { value: board.metrics?.integrationTop3UnblockPlanRemainingStepCount },
    ),
    assertCondition(
      board.metrics?.integrationTop3UnblockPlanAuditStatus === "OK_TOP3_UNBLOCK_PLAN_GUARDED",
      "integration_top3_unblock_plan_audit_status_invalid",
      "Le tableau n'indique pas un audit plan deblocage top 3 OK.",
      { value: board.metrics?.integrationTop3UnblockPlanAuditStatus },
    ),
    assertCondition(
      board.metrics?.integrationTop3UnblockPlanAuditFailureCount === 0,
      "integration_top3_unblock_plan_audit_failures_not_zero",
      "Le tableau indique des echecs dans l'audit plan deblocage top 3.",
      { value: board.metrics?.integrationTop3UnblockPlanAuditFailureCount },
    ),
    assertCondition(
      board.metrics?.integrationTop3UnblockPlanAuditSensitiveFindingCount === 0,
      "integration_top3_unblock_plan_audit_sensitive_findings_not_zero",
      "Le tableau indique une fuite sensible dans l'audit plan deblocage top 3.",
      { value: board.metrics?.integrationTop3UnblockPlanAuditSensitiveFindingCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveSourcingPlanStatus === "HOLD_NEXT_WAVE_SOURCING_READY",
      "integration_next_wave_sourcing_plan_status_invalid",
      "Le tableau n'indique pas une prochaine vague sourcing prete en HOLD.",
      { value: board.metrics?.integrationNextWaveSourcingPlanStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveSourcingPlanProductCount === 12 &&
        board.metrics?.integrationNextWaveSourcingPlanProofTaskCount === 60 &&
        board.metrics?.integrationNextWaveSourcingPlanImageTaskCount === 36,
      "integration_next_wave_sourcing_plan_scope_invalid",
      "La prochaine vague sourcing ne couvre pas 12 produits / 60 preuves / 36 images.",
      {
        productCount: board.metrics?.integrationNextWaveSourcingPlanProductCount,
        proofTaskCount: board.metrics?.integrationNextWaveSourcingPlanProofTaskCount,
        imageTaskCount: board.metrics?.integrationNextWaveSourcingPlanImageTaskCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveSourcingPlanTotalTaskCount ===
        (board.metrics?.integrationNextWaveSourcingPlanProofTaskCount ?? 0) +
          (board.metrics?.integrationNextWaveSourcingPlanImageTaskCount ?? 0),
      "integration_next_wave_sourcing_plan_total_invalid",
      "Le total actions prochaine vague sourcing est incoherent.",
      { value: board.metrics?.integrationNextWaveSourcingPlanTotalTaskCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveSourcingPlanAuditStatus === "OK_NEXT_WAVE_SOURCING_GUARDED",
      "integration_next_wave_sourcing_plan_audit_status_invalid",
      "Le tableau n'indique pas un audit prochaine vague sourcing OK.",
      { value: board.metrics?.integrationNextWaveSourcingPlanAuditStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveSourcingPlanAuditFailureCount === 0,
      "integration_next_wave_sourcing_plan_audit_failures_not_zero",
      "Le tableau indique des echecs dans l'audit prochaine vague sourcing.",
      { value: board.metrics?.integrationNextWaveSourcingPlanAuditFailureCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveSourcingPlanAuditSensitiveFindingCount === 0,
      "integration_next_wave_sourcing_plan_audit_sensitive_findings_not_zero",
      "Le tableau indique une fuite sensible dans l'audit prochaine vague sourcing.",
      { value: board.metrics?.integrationNextWaveSourcingPlanAuditSensitiveFindingCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveSessionStatus === "HOLD_NEXT_WAVE_SESSION_READY",
      "integration_next_wave_session_status_invalid",
      "Le tableau n'indique pas une session prochaine vague prete en HOLD.",
      { value: board.metrics?.integrationNextWaveSessionStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveSessionBatchCount === 3 &&
        board.metrics?.integrationNextWaveSessionProductCount === 12,
      "integration_next_wave_session_scope_invalid",
      "La session prochaine vague ne couvre pas 3 lots et 12 produits.",
      {
        batchCount: board.metrics?.integrationNextWaveSessionBatchCount,
        productCount: board.metrics?.integrationNextWaveSessionProductCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveSessionProofTaskCount === 60 &&
        board.metrics?.integrationNextWaveSessionImageTaskCount === 36 &&
        board.metrics?.integrationNextWaveSessionDepositInstructionCount === 12,
      "integration_next_wave_session_tasks_invalid",
      "La session prochaine vague ne couvre pas 60 preuves, 36 images et 12 consignes depot.",
      {
        proofTaskCount: board.metrics?.integrationNextWaveSessionProofTaskCount,
        imageTaskCount: board.metrics?.integrationNextWaveSessionImageTaskCount,
        depositInstructionCount: board.metrics?.integrationNextWaveSessionDepositInstructionCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveSessionAuditStatus === "OK_NEXT_WAVE_SESSION_GUARDED",
      "integration_next_wave_session_audit_status_invalid",
      "Le tableau n'indique pas un audit session prochaine vague OK.",
      { value: board.metrics?.integrationNextWaveSessionAuditStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveSessionAuditFailureCount === 0,
      "integration_next_wave_session_audit_failures_not_zero",
      "Le tableau indique des echecs dans l'audit session prochaine vague.",
      { value: board.metrics?.integrationNextWaveSessionAuditFailureCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveSessionAuditSensitiveFindingCount === 0,
      "integration_next_wave_session_audit_sensitive_findings_not_zero",
      "Le tableau indique une fuite sensible dans l'audit session prochaine vague.",
      { value: board.metrics?.integrationNextWaveSessionAuditSensitiveFindingCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchStatus === "HOLD_NEXT_WAVE_ACTIVE_BATCH_READY",
      "integration_next_wave_active_batch_status_invalid",
      "Le tableau n'indique pas un lot actif prochaine vague pret en HOLD.",
      { value: board.metrics?.integrationNextWaveActiveBatchStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchProductCount === 4 &&
        board.metrics?.integrationNextWaveActiveBatchProofTaskCount === 20 &&
        board.metrics?.integrationNextWaveActiveBatchImageTaskCount === 12,
      "integration_next_wave_active_batch_scope_invalid",
      "Le lot actif prochaine vague ne couvre pas 4 produits, 20 preuves et 12 images.",
      {
        productCount: board.metrics?.integrationNextWaveActiveBatchProductCount,
        proofTaskCount: board.metrics?.integrationNextWaveActiveBatchProofTaskCount,
        imageTaskCount: board.metrics?.integrationNextWaveActiveBatchImageTaskCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchActionCount === 32,
      "integration_next_wave_active_batch_action_count_invalid",
      "Le lot actif prochaine vague ne contient pas 32 actions terrain.",
      { value: board.metrics?.integrationNextWaveActiveBatchActionCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchAuditStatus === "OK_NEXT_WAVE_ACTIVE_BATCH_GUARDED",
      "integration_next_wave_active_batch_audit_status_invalid",
      "Le tableau n'indique pas un audit lot actif prochaine vague OK.",
      { value: board.metrics?.integrationNextWaveActiveBatchAuditStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchAuditFailureCount === 0,
      "integration_next_wave_active_batch_audit_failures_not_zero",
      "Le tableau indique des echecs dans l'audit lot actif prochaine vague.",
      { value: board.metrics?.integrationNextWaveActiveBatchAuditFailureCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchAuditSensitiveFindingCount === 0,
      "integration_next_wave_active_batch_audit_sensitive_findings_not_zero",
      "Le tableau indique une fuite sensible dans l'audit lot actif prochaine vague.",
      { value: board.metrics?.integrationNextWaveActiveBatchAuditSensitiveFindingCount },
    ),
    assertCondition(
      [
        "HOLD_NEXT_WAVE_ACTIVE_BATCH_BUSINESS_GATE_BLOCKED",
        "READY_NEXT_WAVE_ACTIVE_BATCH_BUSINESS_GATE_HUMAN_REVIEW_HOLD",
      ].includes(board.metrics?.integrationNextWaveActiveBatchBusinessGateStatus),
      "integration_next_wave_active_batch_business_gate_status_invalid",
      "Le tableau n'indique pas un gate business lot actif exploitable.",
      { value: board.metrics?.integrationNextWaveActiveBatchBusinessGateStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchBusinessGateProofCount === 20 &&
        board.metrics?.integrationNextWaveActiveBatchBusinessGateImageTaskCount === 12,
      "integration_next_wave_active_batch_business_gate_scope_invalid",
      "Le gate business lot actif ne couvre pas 20 preuves et 12 images.",
      {
        proofCount: board.metrics?.integrationNextWaveActiveBatchBusinessGateProofCount,
        imageTaskCount: board.metrics?.integrationNextWaveActiveBatchBusinessGateImageTaskCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchBusinessGateReadyProofCount +
        board.metrics?.integrationNextWaveActiveBatchBusinessGateMissingProofCount ===
        board.metrics?.integrationNextWaveActiveBatchBusinessGateProofCount,
      "integration_next_wave_active_batch_business_gate_proof_counts_invalid",
      "Les compteurs preuves du gate business lot actif sont incoherents.",
      {
        ready: board.metrics?.integrationNextWaveActiveBatchBusinessGateReadyProofCount,
        missing: board.metrics?.integrationNextWaveActiveBatchBusinessGateMissingProofCount,
        total: board.metrics?.integrationNextWaveActiveBatchBusinessGateProofCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchBusinessGateReadyImageCount +
        board.metrics?.integrationNextWaveActiveBatchBusinessGateMissingImageCount +
        board.metrics?.integrationNextWaveActiveBatchBusinessGateInvalidImageCount ===
        board.metrics?.integrationNextWaveActiveBatchBusinessGateImageTaskCount,
      "integration_next_wave_active_batch_business_gate_image_counts_invalid",
      "Les compteurs images du gate business lot actif sont incoherents.",
      {
        ready: board.metrics?.integrationNextWaveActiveBatchBusinessGateReadyImageCount,
        missing: board.metrics?.integrationNextWaveActiveBatchBusinessGateMissingImageCount,
        invalid: board.metrics?.integrationNextWaveActiveBatchBusinessGateInvalidImageCount,
        total: board.metrics?.integrationNextWaveActiveBatchBusinessGateImageTaskCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchBusinessGateFailureCount === 0,
      "integration_next_wave_active_batch_business_gate_failures_not_zero",
      "Le tableau indique des echecs structurels dans le gate business lot actif.",
      { value: board.metrics?.integrationNextWaveActiveBatchBusinessGateFailureCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchBusinessGateSensitiveFindingCount === 0,
      "integration_next_wave_active_batch_business_gate_sensitive_findings_not_zero",
      "Le tableau indique une fuite sensible dans le gate business lot actif.",
      { value: board.metrics?.integrationNextWaveActiveBatchBusinessGateSensitiveFindingCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchMicroPacksStatus ===
        "HOLD_NEXT_WAVE_ACTIVE_BATCH_MICRO_PACKS_READY",
      "integration_next_wave_active_batch_micro_packs_status_invalid",
      "Le tableau n'indique pas des micro-packs lot actif prets en HOLD.",
      { value: board.metrics?.integrationNextWaveActiveBatchMicroPacksStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchMicroPacksProductCount === 4 &&
        board.metrics?.integrationNextWaveActiveBatchMicroPacksProofTaskCount === 20 &&
        board.metrics?.integrationNextWaveActiveBatchMicroPacksImageTaskCount === 12,
      "integration_next_wave_active_batch_micro_packs_scope_invalid",
      "Les micro-packs lot actif ne couvrent pas 4 fiches, 20 preuves et 12 images.",
      {
        productCount: board.metrics?.integrationNextWaveActiveBatchMicroPacksProductCount,
        proofTaskCount: board.metrics?.integrationNextWaveActiveBatchMicroPacksProofTaskCount,
        imageTaskCount: board.metrics?.integrationNextWaveActiveBatchMicroPacksImageTaskCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchMicroPacksActionCount === 32,
      "integration_next_wave_active_batch_micro_packs_action_count_invalid",
      "Les micro-packs lot actif ne contiennent pas 32 actions terrain.",
      { value: board.metrics?.integrationNextWaveActiveBatchMicroPacksActionCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchMicroPacksAuditStatus ===
        "OK_NEXT_WAVE_ACTIVE_BATCH_MICRO_PACKS_GUARDED",
      "integration_next_wave_active_batch_micro_packs_audit_status_invalid",
      "Le tableau n'indique pas un audit micro-packs lot actif OK.",
      { value: board.metrics?.integrationNextWaveActiveBatchMicroPacksAuditStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchMicroPacksAuditFailureCount === 0,
      "integration_next_wave_active_batch_micro_packs_audit_failures_not_zero",
      "Le tableau indique des echecs dans l'audit micro-packs lot actif.",
      { value: board.metrics?.integrationNextWaveActiveBatchMicroPacksAuditFailureCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchMicroPacksAuditSensitiveFindingCount === 0,
      "integration_next_wave_active_batch_micro_packs_audit_sensitive_findings_not_zero",
      "Le tableau indique une fuite sensible dans l'audit micro-packs lot actif.",
      { value: board.metrics?.integrationNextWaveActiveBatchMicroPacksAuditSensitiveFindingCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchProofIntakeStatus ===
        "HOLD_NEXT_WAVE_ACTIVE_BATCH_PROOF_INTAKE_READY",
      "integration_next_wave_active_batch_proof_intake_status_invalid",
      "Le tableau n'indique pas un intake preuves lot actif pret en HOLD.",
      { value: board.metrics?.integrationNextWaveActiveBatchProofIntakeStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchProofIntakeProductCount === 4 &&
        board.metrics?.integrationNextWaveActiveBatchProofIntakeProofTaskCount === 20 &&
        board.metrics?.integrationNextWaveActiveBatchProofIntakeProofFileCount === 20,
      "integration_next_wave_active_batch_proof_intake_scope_invalid",
      "L'intake preuves lot actif ne couvre pas 4 fiches et 20 fichiers preuves.",
      {
        productCount: board.metrics?.integrationNextWaveActiveBatchProofIntakeProductCount,
        proofTaskCount: board.metrics?.integrationNextWaveActiveBatchProofIntakeProofTaskCount,
        proofFileCount: board.metrics?.integrationNextWaveActiveBatchProofIntakeProofFileCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchProofIntakeHoldProofCount === 20,
      "integration_next_wave_active_batch_proof_intake_hold_count_invalid",
      "L'intake preuves lot actif ne conserve pas les 20 preuves en HOLD.",
      { value: board.metrics?.integrationNextWaveActiveBatchProofIntakeHoldProofCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchProofIntakeAuditStatus ===
        "OK_NEXT_WAVE_ACTIVE_BATCH_PROOF_INTAKE_GUARDED",
      "integration_next_wave_active_batch_proof_intake_audit_status_invalid",
      "Le tableau n'indique pas un audit intake preuves lot actif OK.",
      { value: board.metrics?.integrationNextWaveActiveBatchProofIntakeAuditStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchProofIntakeAuditFailureCount === 0,
      "integration_next_wave_active_batch_proof_intake_audit_failures_not_zero",
      "Le tableau indique des echecs dans l'audit intake preuves lot actif.",
      { value: board.metrics?.integrationNextWaveActiveBatchProofIntakeAuditFailureCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchProofIntakeAuditSensitiveFindingCount === 0,
      "integration_next_wave_active_batch_proof_intake_audit_sensitive_findings_not_zero",
      "Le tableau indique une fuite sensible dans l'audit intake preuves lot actif.",
      { value: board.metrics?.integrationNextWaveActiveBatchProofIntakeAuditSensitiveFindingCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeStatus ===
        "HOLD_NEXT_WAVE_ACTIVE_BATCH_WEBP_DEPOSIT_INTAKE_READY",
      "integration_next_wave_active_batch_webp_deposit_intake_status_invalid",
      "Le tableau n'indique pas un intake depots WebP lot actif pret en HOLD.",
      { value: board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeProductCount === 4 &&
        board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeImageTaskCount === 12 &&
        board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeExpectedWebpFileCount === 12,
      "integration_next_wave_active_batch_webp_deposit_intake_scope_invalid",
      "L'intake depots WebP lot actif ne couvre pas 4 fiches et 12 WebP.",
      {
        productCount: board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeProductCount,
        imageTaskCount: board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeImageTaskCount,
        expectedWebpFileCount: board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeExpectedWebpFileCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeReadmeFileCount === 4,
      "integration_next_wave_active_batch_webp_deposit_intake_readmes_invalid",
      "L'intake depots WebP lot actif ne contient pas les 4 READMEs attendus.",
      { value: board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeReadmeFileCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeValidExistingWebpFileCount +
        board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeMissingWebpFileCount +
        board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeInvalidWebpFileCount ===
        board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeExpectedWebpFileCount,
      "integration_next_wave_active_batch_webp_deposit_intake_counts_invalid",
      "Les compteurs WebP du lot actif sont incoherents.",
      {
        valid: board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeValidExistingWebpFileCount,
        missing: board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeMissingWebpFileCount,
        invalid: board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeInvalidWebpFileCount,
        expected: board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeExpectedWebpFileCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeInvalidWebpFileCount === 0,
      "integration_next_wave_active_batch_webp_deposit_intake_invalid_files",
      "Le tableau indique des WebP invalides dans le lot actif.",
      { value: board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeInvalidWebpFileCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeAuditStatus ===
        "OK_NEXT_WAVE_ACTIVE_BATCH_WEBP_DEPOSIT_INTAKE_GUARDED",
      "integration_next_wave_active_batch_webp_deposit_intake_audit_status_invalid",
      "Le tableau n'indique pas un audit intake depots WebP lot actif OK.",
      { value: board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeAuditStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeAuditFailureCount === 0,
      "integration_next_wave_active_batch_webp_deposit_intake_audit_failures_not_zero",
      "Le tableau indique des echecs dans l'audit intake depots WebP lot actif.",
      { value: board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeAuditFailureCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeAuditSensitiveFindingCount === 0,
      "integration_next_wave_active_batch_webp_deposit_intake_audit_sensitive_findings_not_zero",
      "Le tableau indique une fuite sensible dans l'audit intake depots WebP lot actif.",
      { value: board.metrics?.integrationNextWaveActiveBatchWebpDepositIntakeAuditSensitiveFindingCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsStatus ===
        "HOLD_NEXT_WAVE_ACTIVE_BATCH_WEBP_VALIDATION_CONTRACTS_READY",
      "integration_next_wave_active_batch_webp_validation_contracts_status_invalid",
      "Le tableau n'indique pas des contrats validation WebP lot actif prets en HOLD.",
      { value: board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsProductCount === 4 &&
        board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsImageTaskCount === 12 &&
        board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsContractFileCount === 12,
      "integration_next_wave_active_batch_webp_validation_contracts_scope_invalid",
      "Les contrats validation WebP lot actif ne couvrent pas 4 fiches et 12 WebP.",
      {
        productCount: board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsProductCount,
        imageTaskCount: board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsImageTaskCount,
        contractFileCount: board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsContractFileCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsBlockedContractCount ===
        board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsContractFileCount,
      "integration_next_wave_active_batch_webp_validation_contracts_not_all_blocked",
      "Tous les contrats WebP du lot actif doivent rester bloques HOLD.",
      {
        blocked: board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsBlockedContractCount,
        total: board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsContractFileCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsValidWebpFileCount +
        board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsMissingWebpFileCount +
        board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsInvalidWebpFileCount ===
        board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsContractFileCount,
      "integration_next_wave_active_batch_webp_validation_contracts_counts_invalid",
      "Les compteurs contrats/WebP du lot actif sont incoherents.",
      {
        valid: board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsValidWebpFileCount,
        missing: board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsMissingWebpFileCount,
        invalid: board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsInvalidWebpFileCount,
        contracts: board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsContractFileCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsInvalidWebpFileCount === 0,
      "integration_next_wave_active_batch_webp_validation_contracts_invalid_files",
      "Le tableau indique des WebP invalides dans les contrats du lot actif.",
      { value: board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsInvalidWebpFileCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsAuditStatus ===
        "OK_NEXT_WAVE_ACTIVE_BATCH_WEBP_VALIDATION_CONTRACTS_GUARDED",
      "integration_next_wave_active_batch_webp_validation_contracts_audit_status_invalid",
      "Le tableau n'indique pas un audit contrats validation WebP lot actif OK.",
      { value: board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsAuditStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsAuditFailureCount === 0,
      "integration_next_wave_active_batch_webp_validation_contracts_audit_failures_not_zero",
      "Le tableau indique des echecs dans l'audit contrats validation WebP lot actif.",
      { value: board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsAuditFailureCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsAuditSensitiveFindingCount === 0,
      "integration_next_wave_active_batch_webp_validation_contracts_audit_sensitive_findings_not_zero",
      "Le tableau indique une fuite sensible dans l'audit contrats validation WebP lot actif.",
      { value: board.metrics?.integrationNextWaveActiveBatchWebpValidationContractsAuditSensitiveFindingCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardStatus ===
        "HOLD_NEXT_WAVE_ACTIVE_BATCH_MOUSS_REVIEW_BOARD_READY",
      "integration_next_wave_active_batch_mouss_review_board_status_invalid",
      "Le tableau n'indique pas un board revue Mouss lot actif pret en HOLD.",
      { value: board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardProductCount === 4,
      "integration_next_wave_active_batch_mouss_review_board_product_count_invalid",
      "Le board revue Mouss lot actif doit couvrir 4 produits.",
      { value: board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardProductCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardReadyForMoussReviewCount === 0 &&
        board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardBlockedProductCount === 4,
      "integration_next_wave_active_batch_mouss_review_board_readiness_invalid",
      "La revue Mouss lot actif doit garder les 4 produits bloques tant que preuves/WebP manquent.",
      {
        ready: board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardReadyForMoussReviewCount,
        blocked: board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardBlockedProductCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardProofTodoCount === 20 &&
        board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardWebpMissingCount === 12 &&
        board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardBlockedContractCount === 12 &&
        board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardBusinessBlockerCount === 32,
      "integration_next_wave_active_batch_mouss_review_board_counts_invalid",
      "Les compteurs de revue Mouss lot actif sont incoherents.",
      {
        proofTodoCount: board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardProofTodoCount,
        webpMissingCount: board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardWebpMissingCount,
        blockedContractCount: board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardBlockedContractCount,
        businessBlockerCount: board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardBusinessBlockerCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardAuditStatus ===
        "OK_NEXT_WAVE_ACTIVE_BATCH_MOUSS_REVIEW_BOARD_GUARDED",
      "integration_next_wave_active_batch_mouss_review_board_audit_status_invalid",
      "Le tableau n'indique pas un audit revue Mouss lot actif OK.",
      { value: board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardAuditStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardAuditFailureCount === 0,
      "integration_next_wave_active_batch_mouss_review_board_audit_failures_not_zero",
      "Le tableau indique des echecs dans l'audit revue Mouss lot actif.",
      { value: board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardAuditFailureCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardAuditSensitiveFindingCount === 0,
      "integration_next_wave_active_batch_mouss_review_board_audit_sensitive_findings_not_zero",
      "Le tableau indique une fuite sensible dans l'audit revue Mouss lot actif.",
      { value: board.metrics?.integrationNextWaveActiveBatchMoussReviewBoardAuditSensitiveFindingCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchFieldEntryPackStatus ===
        "HOLD_NEXT_WAVE_ACTIVE_BATCH_FIELD_ENTRY_PACK_READY",
      "integration_next_wave_active_batch_field_entry_pack_status_invalid",
      "Le tableau n'indique pas un pack saisie terrain lot actif pret en HOLD.",
      { value: board.metrics?.integrationNextWaveActiveBatchFieldEntryPackStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchFieldEntryPackProductCount === 4 &&
        board.metrics?.integrationNextWaveActiveBatchFieldEntryPackEntryCount === 32 &&
        board.metrics?.integrationNextWaveActiveBatchFieldEntryPackProofEntryCount === 20 &&
        board.metrics?.integrationNextWaveActiveBatchFieldEntryPackWebpEntryCount === 12,
      "integration_next_wave_active_batch_field_entry_pack_scope_invalid",
      "Le pack saisie terrain lot actif doit couvrir 4 produits, 20 preuves et 12 WebP.",
      {
        productCount: board.metrics?.integrationNextWaveActiveBatchFieldEntryPackProductCount,
        entryCount: board.metrics?.integrationNextWaveActiveBatchFieldEntryPackEntryCount,
        proofEntryCount: board.metrics?.integrationNextWaveActiveBatchFieldEntryPackProofEntryCount,
        webpEntryCount: board.metrics?.integrationNextWaveActiveBatchFieldEntryPackWebpEntryCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchFieldEntryPackBlockedEntryCount === 32 &&
        board.metrics?.integrationNextWaveActiveBatchFieldEntryPackReadyEntryCount === 0,
      "integration_next_wave_active_batch_field_entry_pack_readiness_invalid",
      "Toutes les entrees du pack saisie terrain doivent rester bloquees HOLD.",
      {
        blocked: board.metrics?.integrationNextWaveActiveBatchFieldEntryPackBlockedEntryCount,
        ready: board.metrics?.integrationNextWaveActiveBatchFieldEntryPackReadyEntryCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchFieldEntryPackProductSheetCount === 4,
      "integration_next_wave_active_batch_field_entry_pack_sheets_invalid",
      "Le pack saisie terrain lot actif doit contenir 4 fiches produit.",
      { value: board.metrics?.integrationNextWaveActiveBatchFieldEntryPackProductSheetCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchFieldEntryPackAuditStatus ===
        "OK_NEXT_WAVE_ACTIVE_BATCH_FIELD_ENTRY_PACK_GUARDED",
      "integration_next_wave_active_batch_field_entry_pack_audit_status_invalid",
      "Le tableau n'indique pas un audit pack saisie terrain lot actif OK.",
      { value: board.metrics?.integrationNextWaveActiveBatchFieldEntryPackAuditStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchFieldEntryPackAuditFailureCount === 0,
      "integration_next_wave_active_batch_field_entry_pack_audit_failures_not_zero",
      "Le tableau indique des echecs dans l'audit pack saisie terrain lot actif.",
      { value: board.metrics?.integrationNextWaveActiveBatchFieldEntryPackAuditFailureCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchFieldEntryPackAuditSensitiveFindingCount === 0,
      "integration_next_wave_active_batch_field_entry_pack_audit_sensitive_findings_not_zero",
      "Le tableau indique une fuite sensible dans l'audit pack saisie terrain lot actif.",
      { value: board.metrics?.integrationNextWaveActiveBatchFieldEntryPackAuditSensitiveFindingCount },
    ),
    assertCondition(
      [
        "HOLD_NEXT_WAVE_ACTIVE_BATCH_FIELD_COMPLETION_BLOCKED",
        "READY_NEXT_WAVE_ACTIVE_BATCH_FIELD_COMPLETION_HUMAN_REVIEW_HOLD",
      ].includes(board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateStatus),
      "integration_next_wave_active_batch_field_completion_gate_status_invalid",
      "Le tableau n'indique pas un gate saisie terrain lot actif valide.",
      { value: board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateAuditStatus ===
        "OK_NEXT_WAVE_ACTIVE_BATCH_FIELD_COMPLETION_GATE_GUARDED",
      "integration_next_wave_active_batch_field_completion_gate_audit_status_invalid",
      "Le tableau n'indique pas un audit gate saisie terrain lot actif OK.",
      { value: board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateAuditStatus },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateProductCount === 4 &&
        board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateEntryCount === 32 &&
        board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateProofEntryCount === 20 &&
        board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateWebpEntryCount === 12,
      "integration_next_wave_active_batch_field_completion_gate_scope_invalid",
      "Le gate saisie terrain lot actif doit couvrir 4 produits, 20 preuves et 12 WebP.",
      {
        productCount: board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateProductCount,
        entryCount: board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateEntryCount,
        proofEntryCount: board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateProofEntryCount,
        webpEntryCount: board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateWebpEntryCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateReadyEntryCount +
        board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateBlockedEntryCount ===
        board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateEntryCount,
      "integration_next_wave_active_batch_field_completion_gate_readiness_count_mismatch",
      "Les compteurs prets/bloques du gate saisie terrain lot actif ne correspondent pas.",
      {
        ready: board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateReadyEntryCount,
        blocked: board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateBlockedEntryCount,
        total: board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateEntryCount,
      },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateFailureCount === 0,
      "integration_next_wave_active_batch_field_completion_gate_failures_not_zero",
      "Le tableau indique des echecs dans le gate saisie terrain lot actif.",
      { value: board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateFailureCount },
    ),
    assertCondition(
      board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateSensitiveFindingCount === 0 &&
        board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateSensitiveValuesExported !== true,
      "integration_next_wave_active_batch_field_completion_gate_sensitive_findings_not_zero",
      "Le tableau indique une fuite sensible dans le gate saisie terrain lot actif.",
      {
        findings: board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateSensitiveFindingCount,
        exported: board.metrics?.integrationNextWaveActiveBatchFieldCompletionGateSensitiveValuesExported,
      },
    ),
    assertCondition(
      board.metrics?.seoHoldVisibilityStatus === "OK_HOLD_PRODUCTS_NOT_INDEXABLE",
      "seo_hold_visibility_status_invalid",
      "Le tableau n'indique pas un audit SEO HOLD OK.",
      { value: board.metrics?.seoHoldVisibilityStatus },
    ),
    assertCondition(
      board.metrics?.seoHoldVisibilityFailureCount === 0,
      "seo_hold_visibility_failures_not_zero",
      "Le tableau indique des echecs SEO sur les produits HOLD.",
      { value: board.metrics?.seoHoldVisibilityFailureCount },
    ),
    assertCondition(
      board.metrics?.adminApiGuardStatus === "OK_ADMIN_API_GUARDS_ACTIVE",
      "admin_api_guard_status_invalid",
      "Le tableau n'indique pas un audit routes API admin OK.",
      { value: board.metrics?.adminApiGuardStatus },
    ),
    assertCondition(
      board.metrics?.adminApiGuardFailureCount === 0,
      "admin_api_guard_failures_not_zero",
      "Le tableau indique des echecs de garde routes API admin.",
      { value: board.metrics?.adminApiGuardFailureCount },
    ),
    assertCondition(
      board.metrics?.adminPageGuardStatus === "OK_ADMIN_PAGE_GUARDS_ACTIVE",
      "admin_page_guard_status_invalid",
      "Le tableau n'indique pas un audit pages admin OK.",
      { value: board.metrics?.adminPageGuardStatus },
    ),
    assertCondition(
      board.metrics?.adminPageGuardFailureCount === 0,
      "admin_page_guard_failures_not_zero",
      "Le tableau indique des echecs de garde pages admin.",
      { value: board.metrics?.adminPageGuardFailureCount },
    ),
    assertCondition(
      board.metrics?.stripeWebhookStockGuardStatus === "OK_STRIPE_WEBHOOK_STOCK_GUARDS_ACTIVE",
      "stripe_webhook_stock_guard_status_invalid",
      "Le tableau n'indique pas un audit webhook Stripe/stock OK.",
      { value: board.metrics?.stripeWebhookStockGuardStatus },
    ),
    assertCondition(
      board.metrics?.stripeWebhookStockGuardFailureCount === 0,
      "stripe_webhook_stock_guard_failures_not_zero",
      "Le tableau indique des echecs webhook Stripe/stock.",
      { value: board.metrics?.stripeWebhookStockGuardFailureCount },
    ),
    assertCondition(
      board.metrics?.dropshippingOrderAdminSafetyStatus === "OK_ORDER_ADMIN_SUPPLIER_ACTIONS_GUARDED",
      "dropshipping_order_admin_safety_status_invalid",
      "Le tableau n'indique pas un audit admin commandes OK.",
      { value: board.metrics?.dropshippingOrderAdminSafetyStatus },
    ),
    assertCondition(
      board.metrics?.dropshippingOrderAdminSafetyFailureCount === 0,
      "dropshipping_order_admin_safety_failures_not_zero",
      "Le tableau indique des echecs admin commandes.",
      { value: board.metrics?.dropshippingOrderAdminSafetyFailureCount },
    ),
    assertCondition(
      board.metrics?.orderOperationsBoardStatus === "OK_ORDER_OPERATIONS_BOARD_READY",
      "order_operations_board_status_invalid",
      "Le tableau n'indique pas un board operations commandes pret.",
      { value: board.metrics?.orderOperationsBoardStatus },
    ),
    assertCondition(
      board.metrics?.orderOperationsSelfTestFailureCount === 0,
      "order_operations_board_self_test_failures_not_zero",
      "Le board operations commandes indique des echecs d'auto-test.",
      { value: board.metrics?.orderOperationsSelfTestFailureCount },
    ),
    assertCondition(
      board.metrics?.orderOperationsNoSupplierUrlsExported === true &&
        board.metrics?.orderOperationsNoCustomerAddressExported === true,
      "order_operations_board_export_safety_missing",
      "Le board operations commandes ne confirme pas la redaction fournisseur/client.",
      {
        supplierUrls: board.metrics?.orderOperationsNoSupplierUrlsExported,
        customerAddress: board.metrics?.orderOperationsNoCustomerAddressExported,
      },
    ),
    assertCondition(
      board.metrics?.orderOperationsFixturesStatus === "OK_ORDER_OPERATIONS_FIXTURES_PASS",
      "order_operations_fixtures_status_invalid",
      "Le tableau n'indique pas des fixtures operations commandes OK.",
      { value: board.metrics?.orderOperationsFixturesStatus },
    ),
    assertCondition(
      board.metrics?.orderOperationsFixturesScenarioFailureCount === 0,
      "order_operations_fixtures_failures_not_zero",
      "Les fixtures operations commandes indiquent des echecs scenario.",
      { value: board.metrics?.orderOperationsFixturesScenarioFailureCount },
    ),
    assertCondition(
      board.metrics?.orderOperationsFixturesProofGapOk === true &&
        board.metrics?.orderOperationsFixturesSensitiveExportOk === true,
      "order_operations_fixtures_guard_missing",
      "Les fixtures operations commandes ne confirment pas les blocages preuve/export.",
      {
        proofGap: board.metrics?.orderOperationsFixturesProofGapOk,
        sensitiveExport: board.metrics?.orderOperationsFixturesSensitiveExportOk,
      },
    ),
    assertCondition(
      board.metrics?.pilotageOrderOperationsStatus === "OK_PILOTAGE_ORDER_OPERATIONS_GUARDED",
      "pilotage_order_operations_status_invalid",
      "Le tableau n'indique pas un audit pilotage operations commandes OK.",
      { value: board.metrics?.pilotageOrderOperationsStatus },
    ),
    assertCondition(
      board.metrics?.pilotageOrderOperationsFailureCount === 0,
      "pilotage_order_operations_failures_not_zero",
      "Le pilotage operations commandes indique des echecs.",
      { value: board.metrics?.pilotageOrderOperationsFailureCount },
    ),
    assertCondition(
      board.metrics?.pilotageOrderOperationsLatestBoardHasNoSupplierUrlLeak === true &&
        board.metrics?.pilotageOrderOperationsLatestBoardUsesSharedOperations === true,
      "pilotage_order_operations_safety_missing",
      "Le pilotage operations commandes ne confirme pas le board redige et le helper partage.",
      {
        noSupplierLeak: board.metrics?.pilotageOrderOperationsLatestBoardHasNoSupplierUrlLeak,
        sharedOperations: board.metrics?.pilotageOrderOperationsLatestBoardUsesSharedOperations,
      },
    ),
    ...lanes.flatMap((lane, index) => [
      assertCondition(typeof lane.lane === "string" && lane.lane.length > 0, "lane_name_missing", "Lane sans nom.", {
        index,
      }),
      assertCondition(Number.isInteger(lane.actionCount), "lane_action_count_invalid", "Compteur lane invalide.", {
        index,
        lane: lane.lane,
        actionCount: lane.actionCount,
      }),
      assertCondition(!hasSensitiveMarker(JSON.stringify(lane)), "lane_sensitive_marker", "Marqueur sensible dans une lane.", {
        index,
        lane: lane.lane,
      }),
      assertCondition(
        !hasPositiveForbiddenAction(lane.firstAction),
        "lane_first_action_forbidden_positive",
        "Une premiere action de lane ressemble a une action sensible positive.",
        { index, lane: lane.lane, firstAction: lane.firstAction },
      ),
    ]),
    ...actions.flatMap(actionFailures),
    ...scannedFiles
      .map((filePath) =>
        assertCondition(
          !hasSensitiveMarker(fs.readFileSync(filePath, "utf8")),
          "artifact_sensitive_marker",
          "Marqueur sensible dans un fichier du tableau execution.",
          { file: rel(filePath) },
        ),
      )
      .filter(Boolean),
  );
}

const cleanFailures = failures.filter(Boolean);
const summary = {
  ok: cleanFailures.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_daily_execution_board_audit",
  boardDir: boardDir ? rel(boardDir) : null,
  boardJson: boardJsonPath ? rel(boardJsonPath) : null,
  boardMode: board?.mode ?? null,
  actionCount: actions.length,
  laneCount: lanes.length,
  scannedFileCount: scannedFiles.length,
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

const jsonPath = path.join(outputDir, `AUDIT_EXECUTION_DU_JOUR_MAXI_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_EXECUTION_DU_JOUR_MAXI_${dateKey}.md`);
const csvPath = path.join(outputDir, `maxi-audit-execution-du-jour-${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, toCsv(cleanFailures), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      actionCount: summary.actionCount,
      laneCount: summary.laneCount,
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

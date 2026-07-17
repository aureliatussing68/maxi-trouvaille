import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const formPath = path.join(root, "src", "components", "ProductEditForm.tsx");
const proofsPagePath = path.join(root, "src", "app", "admin", "preuves-partenaires", "page.tsx");
const pilotagePagePath = path.join(root, "src", "app", "admin", "pilotage", "page.tsx");
const routePath = path.join(root, "src", "app", "api", "admin", "products", "[slug]", "route.ts");
const outputDir = path.join(root, "business-maxi-trouvailles", "file-validation-fournisseurs");

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

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function relativePath(filePath) {
  return filePath ? path.relative(root, filePath) : "";
}

function checks(formSource, proofsPageSource, pilotagePageSource, routeSource) {
  return [
    {
      id: "client_guard_panel_present",
      ok: formSource.includes("Garde publication dropshipping"),
      failure: "Le formulaire admin doit afficher une garde publication dropshipping.",
    },
    {
      id: "client_guard_computes_blockers",
      ok:
        formSource.includes("publicationReadinessItems") &&
        formSource.includes("publicationBlockers") &&
        formSource.includes("isPublicationBlocked"),
      failure: "Le formulaire doit calculer les blocages avant publication.",
    },
    {
      id: "client_guard_disables_submit",
      ok:
        formSource.includes("disabled={isSaving || isPublicationBlocked}") &&
        formSource.includes("Publication bloquee"),
      failure: "Le bouton de sauvegarde doit bloquer une tentative de publication incomplete.",
    },
    {
      id: "server_blockers_are_displayed",
      ok: formSource.includes("serverBlockers") && formSource.includes("Blocages serveur"),
      failure: "Les blocages HTTP 400 de la route admin doivent etre visibles dans le formulaire.",
    },
    {
      id: "required_fields_match_server_guard",
      ok:
        formSource.includes("verified_source_images") &&
        formSource.includes("hasExactSupplierUrl") &&
        formSource.includes("supplierSku") &&
        formSource.includes("supplierPrice") &&
        formSource.includes("supplierStock") &&
        formSource.includes("needsManualDeliveryCheck") &&
        formSource.includes("validationGate") &&
        routeSource.includes("stock fournisseur manquant"),
      failure: "La checklist UI doit rester alignee avec les preuves serveur obligatoires.",
    },
    {
      id: "proof_shortcuts_present",
      ok:
        formSource.includes("/admin/preuves-partenaires#preuve-") &&
        formSource.includes("/admin/pilotage") &&
        formSource.includes("/admin/photos-produits"),
      failure: "La garde UI doit proposer des raccourcis vers preuves, pilotage et photos.",
    },
    {
      id: "proof_page_slug_anchor_present",
      ok:
        proofsPageSource.includes("id={`preuve-${form.slug}`}") &&
        proofsPageSource.includes("quickProofAnchors") &&
        proofsPageSource.includes("id={`preuve-${product.slug}`}") &&
        proofsPageSource.includes("scroll-mt-24"),
      failure: "La page preuves partenaires doit exposer une ancre par slug produit, y compris hors formulaires rapides.",
    },
    {
      id: "proof_page_search_filter_present",
      ok:
        proofsPageSource.includes("searchParams") &&
        proofsPageSource.includes("Recherche preuves") &&
        proofsPageSource.includes("name=\"q\"") &&
        proofsPageSource.includes("name=\"status\"") &&
        proofsPageSource.includes("name=\"zone\"") &&
        proofsPageSource.includes("proofZoneOptions") &&
        proofsPageSource.includes("proofZoneFilter") &&
        proofsPageSource.includes("matchesProofZoneFilter") &&
        proofsPageSource.includes("proofZoneHref") &&
        proofsPageSource.includes("proofZoneRows") &&
        proofsPageSource.includes("proofZoneCounts") &&
        proofsPageSource.includes("proofZoneCounts[option.value]") &&
        proofsPageSource.includes("Type preuve") &&
        proofsPageSource.includes("Filtres rapides preuves") &&
        proofsPageSource.includes("Sprint zone active") &&
        proofsPageSource.includes("sprint-zone-preuves") &&
        proofsPageSource.includes("zoneSprintItems") &&
        proofsPageSource.includes("zoneSprintDetail") &&
        proofsPageSource.includes("zoneSprintAction") &&
        proofsPageSource.includes("zoneSprintItemHref") &&
        proofsPageSource.includes("buildZoneSprintCsv") &&
        proofsPageSource.includes("zoneSprintExportFilename") &&
        proofsPageSource.includes("zoneSprintExportHref") &&
        proofsPageSource.includes("download={zoneSprintExportFilename}") &&
        proofsPageSource.includes("Exporter sprint CSV") &&
        proofsPageSource.includes("\"action_zone\"") &&
        proofsPageSource.includes("\"checklist_session\"") &&
        proofsPageSource.includes("\"session_image_ok\"") &&
        proofsPageSource.includes("\"session_fournisseur_ok\"") &&
        proofsPageSource.includes("\"session_validation_mouss\"") &&
        proofsPageSource.includes("\"lien_sprint\"") &&
        proofsPageSource.includes("Checklist session") &&
        proofsPageSource.includes("type=\"checkbox\"") &&
        proofsPageSource.includes("Session terrain ${item.slug}") &&
        proofsPageSource.includes("Traiter cette preuve") &&
        proofsPageSource.includes("proofZoneCounts[proofZone]") &&
        proofsPageSource.includes("Images / droits") &&
        proofsPageSource.includes("Fournisseur / SKU") &&
        proofsPageSource.includes("Prix / stock / marge") &&
        proofsPageSource.includes("Livraison / suivi") &&
        proofsPageSource.includes("proofZone !== \"all\"") &&
        proofsPageSource.includes("Zone: {activeProofZone.shortLabel}") &&
        proofsPageSource.includes("aria-label={`${proofZoneCounts[option.value] ?? 0} elements`}") &&
        proofsPageSource.includes("visibleFilteredItems") &&
        proofsPageSource.includes("filteredQuickProofAnchors") &&
        proofsPageSource.includes("filteredForms") &&
        proofsPageSource.includes("buildProofCsv") &&
        proofsPageSource.includes("proofExportRows") &&
        proofsPageSource.includes("download={proofExportFilename}"),
      failure: "La page preuves partenaires doit proposer une recherche par URL, filtrer les listes HOLD par statut et zone de preuve, afficher un sprint zone active avec checklist session, export CSV dedie et exporter le CSV filtre.",
    },
    {
      id: "proof_page_top_verification_board_present",
      ok:
        proofsPageSource.includes("Top produits a verifier maintenant") &&
        proofsPageSource.includes("topVerificationItems") &&
        proofsPageSource.includes("mergeTopVerificationItems") &&
        proofsPageSource.includes("businessPotentialSignal") &&
        proofsPageSource.includes("Score local") &&
        proofsPageSource.includes("Ouvrir preuve") &&
        proofsPageSource.includes("buildTopVerificationCsv") &&
        proofsPageSource.includes("download={topVerificationExportFilename}") &&
        proofsPageSource.includes("Exporter top CSV") &&
        proofsPageSource.includes("topVerificationChecklist") &&
        proofsPageSource.includes("Mini fiche terrain") &&
        proofsPageSource.includes("Validation Mouss") &&
        proofsPageSource.includes("media=\"print\"") &&
        proofsPageSource.includes("proofs-print-root") &&
        proofsPageSource.includes("proofs-print-card") &&
        proofsPageSource.includes("proofs-print-hide") &&
        proofsPageSource.includes("id={`top-verification-${adminAnchorId(item.slug)}`") &&
        proofsPageSource.includes("scroll-mt-24"),
      failure: "La page preuves partenaires doit afficher un classement des produits HOLD a verifier en priorite, l'exporter en CSV court et fournir une mini fiche terrain imprimable.",
    },
    {
      id: "proof_page_daily_terrain_lot_present",
      ok:
        proofsPageSource.includes("Lot terrain du jour") &&
        proofsPageSource.includes("terrainLotItems") &&
        proofsPageSource.includes("isHoldTerrainItem") &&
        proofsPageSource.includes("buildTerrainLotCsv") &&
        proofsPageSource.includes("terrainVisualState") &&
        proofsPageSource.includes("terrainNextAction") &&
        proofsPageSource.includes("terrainProofEffort") &&
        proofsPageSource.includes("terrainLotExportHref") &&
        proofsPageSource.includes("terrainLotExportFilename") &&
        proofsPageSource.includes("\"priorite_visuelle\"") &&
        proofsPageSource.includes("\"etat_visuel\"") &&
        proofsPageSource.includes("\"action_terrain\"") &&
        proofsPageSource.includes("\"preuves_a_remplir\"") &&
        proofsPageSource.includes("\"zones_preuves\"") &&
        proofsPageSource.includes("Etat visuel") &&
        proofsPageSource.includes("Prochaine action terrain") &&
        proofsPageSource.includes("Preuves a remplir") &&
        proofsPageSource.includes("Image/droits") &&
        proofsPageSource.includes("Fournisseur/SKU") &&
        proofsPageSource.includes("Prix/stock/marge") &&
        proofsPageSource.includes("Livraison/suivi") &&
        proofsPageSource.includes("Validation Mouss") &&
        proofsPageSource.includes("Verifier ou produire l'image exacte") &&
        proofsPageSource.includes("Verifier prix fournisseur") &&
        proofsPageSource.includes("Prouver delai France/Europe") &&
        proofsPageSource.includes("Image a prouver") &&
        proofsPageSource.includes("Marge a verrouiller") &&
        proofsPageSource.includes("Delai a prouver") &&
        proofsPageSource.includes("3 fiches HOLD a verrouiller") &&
        proofsPageSource.includes("HOLD strict") &&
        proofsPageSource.includes("Exporter lot CSV") &&
        proofsPageSource.includes("terrainItemHref(item, \"hold\")") &&
        proofsPageSource.includes("id={`lot-terrain-${adminAnchorId(item.slug)}`") &&
        proofsPageSource.includes("Fiche terrain"),
      failure: "La page preuves partenaires doit afficher un lot terrain du jour avec 3 fiches HOLD compactes, un etat visuel image/marge/delai, une prochaine action terrain, un compteur de preuves a remplir, un export CSV dedie et un lien filtre vers chaque fiche terrain.",
    },
    {
      id: "pilotage_hold_today_summary_present",
      ok:
        pilotagePageSource.includes("HOLD du jour") &&
        pilotagePageSource.includes("holdTodaySummary") &&
        pilotagePageSource.includes("proofTerrainHref") &&
        pilotagePageSource.includes("proofZoneTerrainHref") &&
        pilotagePageSource.includes("priorityProofZone") &&
        pilotagePageSource.includes("pilotageProofZoneProgress") &&
        pilotagePageSource.includes("pilotageProofZonesForAction") &&
        pilotagePageSource.includes("pilotageProofZoneOptions") &&
        pilotagePageSource.includes("pilotageProofZoneHref") &&
        pilotagePageSource.includes("Top verification") &&
        pilotagePageSource.includes("Zone prioritaire du jour") &&
        pilotagePageSource.includes("Zone prioritaire") &&
        pilotagePageSource.includes("Ouvrir zone") &&
        pilotagePageSource.includes("holdToday.priorityZone") &&
        pilotagePageSource.includes("Progression zones preuves") &&
        pilotagePageSource.includes("Repartition des blocages terrain") &&
        pilotagePageSource.includes("holdToday.zoneProgressItems") &&
        pilotagePageSource.includes("holdToday.zoneProgressTotal") &&
        pilotagePageSource.includes("sharePercent") &&
        pilotagePageSource.includes("blocages zones") &&
        pilotagePageSource.includes("zone,") &&
        pilotagePageSource.includes("Images / droits") &&
        pilotagePageSource.includes("Prix / stock / marge") &&
        pilotagePageSource.includes("Livraison / suivi") &&
        pilotagePageSource.includes("CSV court") &&
        pilotagePageSource.includes("buildPilotageHoldCsv") &&
        pilotagePageSource.includes("pilotageCsvCell") &&
        pilotagePageSource.includes("pilotageHoldExportHref") &&
        pilotagePageSource.includes("pilotageHoldExportFilename") &&
        pilotagePageSource.includes("download={pilotageHoldExportFilename}") &&
        pilotagePageSource.includes("Exporter recap CSV") &&
        pilotagePageSource.includes("\"type_ligne\"") &&
        pilotagePageSource.includes("\"lien_admin\"") &&
        pilotagePageSource.includes("\"zone\"") &&
        pilotagePageSource.includes("\"sprint\"") &&
        pilotagePageSource.includes("Depot photo exact") &&
        pilotagePageSource.includes("readLatestPhotoDropKitManifest") &&
        pilotagePageSource.includes("collectPhotoDropKitManifestFiles") &&
        pilotagePageSource.includes("PhotoDropKitManifest") &&
        pilotagePageSource.includes("readLatestPhotoMissingWorkOrder") &&
        pilotagePageSource.includes("collectPhotoMissingWorkOrderFiles") &&
        pilotagePageSource.includes("PhotoMissingWorkOrder") &&
        pilotagePageSource.includes("buildPhotoDropKitCsv") &&
        pilotagePageSource.includes("buildPhotoMissingWorkOrderCsv") &&
        pilotagePageSource.includes("photoDropExportHref") &&
        pilotagePageSource.includes("photoDropExportFilename") &&
        pilotagePageSource.includes("photoWorkOrderExportHref") &&
        pilotagePageSource.includes("photoWorkOrderExportFilename") &&
        pilotagePageSource.includes("maxi-depot-photo-exact.csv") &&
        pilotagePageSource.includes("maxi-ordre-travail-photos-manquantes.csv") &&
        pilotagePageSource.includes("Exporter depot photo CSV") &&
        pilotagePageSource.includes("Exporter ordre photos CSV") &&
        pilotagePageSource.includes("photoDropKitGate") &&
        pilotagePageSource.includes("photoDropGate") &&
        pilotagePageSource.includes("Alerte post-depot") &&
        pilotagePageSource.includes("Ordre de travail photos") &&
        pilotagePageSource.includes("photos a produire maintenant") &&
        pilotagePageSource.includes("ORDRE_TRAVAIL_PHOTOS_MANQUANTES") &&
        pilotagePageSource.includes("HOLD PHOTOS MANQUANTES") &&
        pilotagePageSource.includes("Depot images categories") &&
        pilotagePageSource.includes("readLatestCategoryImageIntakeStatus") &&
        pilotagePageSource.includes("collectCategoryImageIntakeStatusFiles") &&
        pilotagePageSource.includes("CategoryImageIntakeStatus") &&
        pilotagePageSource.includes("buildCategoryImageIntakeCsv") &&
        pilotagePageSource.includes("categoryImageExportHref") &&
        pilotagePageSource.includes("categoryImageExportFilename") &&
        pilotagePageSource.includes("maxi-suivi-depots-images-categories.csv") &&
        pilotagePageSource.includes("Exporter suivi categories CSV") &&
        pilotagePageSource.includes("Alerte depot categories") &&
        pilotagePageSource.includes("SUIVI_DEPOTS_IMAGES_CATEGORIES_") &&
        pilotagePageSource.includes("HOLD_IMAGES_CATEGORIES_MANQUANTES") &&
        pilotagePageSource.includes("Depot incomplet") &&
        pilotagePageSource.includes("Depot complet - revue humaine requise") &&
        pilotagePageSource.includes("READY_DEPOT_PHOTO_HUMAN_REVIEW_ONLY") &&
        pilotagePageSource.includes("HOLD_DEPOT_PHOTO_INCOMPLET") &&
        pilotagePageSource.includes("audit-photo-checklist") &&
        pilotagePageSource.includes("audit-sprint-image-human-review") &&
        pilotagePageSource.includes("WebP exacts manquants") &&
        pilotagePageSource.includes("NOMS_FICHIERS_ATTENDUS_PHOTOS_20260611.csv") &&
        pilotagePageSource.includes("WebP attendus") &&
        pilotagePageSource.includes("WebP valides") &&
        pilotagePageSource.includes("Chemin depot") &&
        pilotagePageSource.includes("Photos produits") &&
        pilotagePageSource.includes("Checklist photo") &&
        pilotagePageSource.includes("\"fichier_attendu\"") &&
        pilotagePageSource.includes("\"chemin_depot\"") &&
        pilotagePageSource.includes("Impression") &&
        pilotagePageSource.includes("Sprint preuves terrain") &&
        pilotagePageSource.includes("holdToday.sprintItems") &&
        pilotagePageSource.includes("Checklist session") &&
        pilotagePageSource.includes("Ouvrir sprint") &&
        pilotagePageSource.includes("top-verification") &&
        pilotagePageSource.includes("q: proofTarget") &&
        pilotagePageSource.includes("zone,") &&
        pilotagePageSource.includes("Fiche terrain") &&
        pilotagePageSource.includes("Prochain produit a verifier"),
      failure: "La page pilotage doit afficher le recap HOLD du jour avec top verification, progression des zones preuves, zone prioritaire du jour, sprint preuves terrain, depot photo exact, exports CSV, impression, prochain produit a verifier et liens filtres vers les preuves terrain.",
    },
  ].map((check) => ({ ...check, status: check.ok ? "OK" : "FAILURE" }));
}

function markdown(summary) {
  const checkRows = summary.checks.map(
    (check) => `| ${check.id} | ${check.status} | ${check.failure} |`,
  );

  return `${[
    "# Maxi Trouvailles - Audit UI garde publication admin",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    `Statut: ${summary.status}`,
    "",
    "## Synthese",
    "",
    `- Checks UI: ${summary.checkCount}`,
    `- Echecs UI: ${summary.failureCount}`,
    "- Publication automatique: aucune.",
    "- Paiement/commande fournisseur: aucun.",
    "",
    "## Checks",
    "",
    "| Controle | Statut | Blocage si KO |",
    "|---|---|---|",
    ...checkRows,
    "",
    "## Sources",
    "",
    `- Formulaire: ${summary.sources.formPath}`,
    `- Page preuves: ${summary.sources.proofsPagePath}`,
    `- Page pilotage: ${summary.sources.pilotagePagePath}`,
    `- Route admin: ${summary.sources.routePath}`,
    "",
  ].join("\n")}\n`;
}

const formSource = readFile(formPath);
const proofsPageSource = readFile(proofsPagePath);
const pilotagePageSource = readFile(pilotagePagePath);
const routeSource = readFile(routePath);
const sourceChecks = checks(formSource, proofsPageSource, pilotagePageSource, routeSource);
const failures = sourceChecks.filter((check) => !check.ok);
const { dateKey, localLabel } = datePartsParis();
const summary = {
  ok: failures.length === 0,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_admin_publication_ui_guard_audit",
  status: failures.length === 0 ? "OK_ADMIN_PUBLICATION_UI_GUARD_ACTIVE" : "ADMIN_PUBLICATION_UI_GUARD_FAILURE",
  checkCount: sourceChecks.length,
  failureCount: failures.length,
  checks: sourceChecks,
  failures,
  sources: {
    formPath: relativePath(formPath),
    proofsPagePath: relativePath(proofsPagePath),
    pilotagePagePath: relativePath(pilotagePagePath),
    routePath: relativePath(routePath),
  },
  safety: {
    readOnly: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
    noMessageSent: true,
  },
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `AUDIT_ADMIN_PUBLICATION_UI_GUARD_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_ADMIN_PUBLICATION_UI_GUARD_${dateKey}.md`);

summary.files = {
  json: relativePath(jsonPath),
  md: relativePath(mdPath),
};

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      status: summary.status,
      checkCount: summary.checkCount,
      failureCount: summary.failureCount,
      files: summary.files,
      safety: summary.safety,
    },
    null,
    2,
  ),
);

if (!summary.ok) {
  process.exitCode = 1;
}

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const formPath = path.join(root, "src", "components", "ProductEditForm.tsx");
const proofsPagePath = path.join(root, "src", "app", "admin", "preuves-partenaires", "page.tsx");
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

function checks(formSource, proofsPageSource, routeSource) {
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
        proofsPageSource.includes("visibleFilteredItems") &&
        proofsPageSource.includes("filteredQuickProofAnchors") &&
        proofsPageSource.includes("filteredForms") &&
        proofsPageSource.includes("buildProofCsv") &&
        proofsPageSource.includes("proofExportRows") &&
        proofsPageSource.includes("download={proofExportFilename}"),
      failure: "La page preuves partenaires doit proposer une recherche par URL, filtrer les listes HOLD et exporter le CSV filtre.",
    },
    {
      id: "proof_page_top_verification_board_present",
      ok:
        proofsPageSource.includes("Top produits a verifier maintenant") &&
        proofsPageSource.includes("topVerificationItems") &&
        proofsPageSource.includes("mergeTopVerificationItems") &&
        proofsPageSource.includes("businessPotentialSignal") &&
        proofsPageSource.includes("Score local") &&
        proofsPageSource.includes("Ouvrir preuve"),
      failure: "La page preuves partenaires doit afficher un classement des produits HOLD a verifier en priorite.",
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
    `- Route admin: ${summary.sources.routePath}`,
    "",
  ].join("\n")}\n`;
}

const formSource = readFile(formPath);
const proofsPageSource = readFile(proofsPagePath);
const routeSource = readFile(routePath);
const sourceChecks = checks(formSource, proofsPageSource, routeSource);
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

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const businessDir = path.join(root, "business-maxi-trouvailles");
const actionRoot = path.join(businessDir, "tableaux-action");
const supplierRoot = path.join(businessDir, "file-validation-fournisseurs");
const photoDropRoot = path.join(businessDir, "depots-photos");

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
  if (!fs.existsSync(dir)) return out;
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

function latestFileUnder(dir, prefix) {
  const matches = collectFiles(dir, (name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  const todayKey = datePartsParis().dateKey;
  return matches.find((match) => match.fullPath.includes(todayKey))?.fullPath ?? matches[0]?.fullPath ?? null;
}

function latestFilesUnder(dir, prefix, limit = 10) {
  const todayKey = datePartsParis().dateKey;
  const matches = collectFiles(dir, (name) => name.startsWith(prefix) && name.endsWith(".json"))
    .filter((fullPath) => fullPath.includes(todayKey))
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return matches.slice(0, limit).map((match) => match.fullPath);
}

function readJsonIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relativePath(filePath) {
  return filePath ? path.relative(root, filePath) : "";
}

function csvEscape(value) {
  const normalized = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${normalized.replace(/"/g, '""')}"`;
}

function mdCell(value) {
  return String(value ?? "").replace(/\|/g, ";");
}

function top(items, limit) {
  return items.slice(0, limit);
}

function businessActions(source) {
  return top(source?.nextActions ?? [], 12).map((item) => ({
    lane: "produits_partenaires",
    urgency: item.priority,
    id: item.id,
    label: item.name,
    status: item.status,
    nextAction: item.nextAction,
    blockers: item.requiredProofs ?? [],
    sourceFile: item.sourceFile,
    allowedAction: "remplir preuves, verifier fournisseur, completer decision HOLD",
    forbiddenActions: [
      "publier",
      "commander fournisseur",
      "payer",
      "envoyer message client",
    ],
  }));
}

function categoryImageActions(source) {
  return top(source?.items ?? [], 12).map((item) => ({
    lane: "images_categories",
    urgency: item.rank,
    id: item.categoryId,
    label: item.categoryName,
    status: item.intakeStatus,
    nextAction: item.nextAction,
    blockers: item.blockers ?? [],
    sourceFile: item.stagingRelativePath,
    allowedAction: `deposer WebP exact: ${item.expectedFileName}`,
    forbiddenActions: [
      "copier dans public/uploads/category-images",
      "modifier src/lib/catalog.ts",
      "publier",
    ],
  }));
}

function productPhotoActions(source) {
  const tasks = (source?.products ?? []).flatMap((product) =>
    (product.imageTasks ?? []).map((task) => ({
      lane: "photos_produits",
      urgency: product.rank * 10 + task.order,
      id: `${product.productId}#${task.order}`,
      label: `${product.productName} - ${task.role}`,
      status: task.stagingStatus === "missing" ? "HOLD_PHOTO_MISSING" : task.stagingStatus,
      nextAction: task.requiredShot,
      blockers: task.keepHoldUntil ?? [],
      sourceFile: task.stagingRelativePath,
      allowedAction: `deposer photo WebP exacte: ${task.expectedFileName}`,
      forbiddenActions: [
        "utiliser image fournisseur non autorisee",
        "publier fiche",
        "commander fournisseur",
      ],
    })),
  );
  return top(tasks, 12);
}

function cockpitActions(sources) {
  return (Array.isArray(sources) ? sources : [sources])
    .filter((source) => source?.product)
    .map((source, index) => ({
      lane: "cockpit_produit",
      urgency: -100 + index,
      id: source.product.id,
      label: source.product.name,
      status: source.status,
      nextAction: `remplir ${source.evidenceFieldMissingCount ?? 0} preuves et deposer ${source.imageTaskCount ?? 0} WebP exacts avant revue Mouss`,
      blockers: source.blockers ?? [],
      sourceFile: source.outputDirRelative,
      allowedAction: "remplir le template preuves et deposer les WebP exacts dans le dossier de depot",
      forbiddenActions: [
        "publier",
        "copier dans public/uploads",
        "commander fournisseur",
        "payer",
      ],
    }));
}

function fieldKitAuditActions(source) {
  return top(source?.products ?? [], 6).map((product, index) => ({
    lane: "audit_kit_terrain",
    urgency: -80 + index,
    id: product.productId,
    label: product.productName,
    status: product.status,
    nextAction: product.nextAction,
    blockers: product.blockers ?? [],
    sourceFile: source.files?.json ?? source.outputDirRelative,
    allowedAction: "remplir le JSON kit terrain, deposer les WebP exacts, puis relancer l'audit",
    forbiddenActions: [
      "publier",
      "copier en public sans validation Mouss",
      "commander fournisseur",
      "payer",
    ],
  }));
}

function publicImageOperatorActions(source) {
  if (!source) {
    return [
      {
        lane: "images_publiques_exactes",
        urgency: -95,
        id: "public_image_operator_pack_missing",
        label: "Pack operateur images publiques",
        status: "PUBLIC_IMAGE_OPERATOR_PACK_MISSING",
        nextAction: "relancer catalog:public-image-operator-pack avant depot ou copie image",
        blockers: ["pack operateur absent"],
        sourceFile: "",
        allowedAction: "generer un pack lecture seule",
        forbiddenActions: [
          "copier dans public/uploads",
          "utiliser image approximative",
          "publier fiche",
          "commander fournisseur",
        ],
      },
    ];
  }

  return top(source.items ?? [], 8).map((item) => ({
    lane: "images_publiques_exactes",
    urgency: -95 + (item.rank ?? 0),
    id: item.slug,
    label: item.name,
    status: item.operatorStatus ?? item.gateDecision ?? "HOLD_IMAGE",
    nextAction: item.nextAction,
    blockers: item.blockers ?? [],
    sourceFile: item.dropFolder,
    allowedAction: `deposer WebP exact: ${item.expectedFileName}`,
    forbiddenActions: [
      "copier dans public/uploads",
      "utiliser image approximative",
      "publier fiche",
      "commander fournisseur",
    ],
  }));
}

function publicImageMoussReviewActions(source) {
  if (!source) {
    return [
      {
        lane: "images_publiques_exactes",
        urgency: -86,
        id: "public_image_mouss_review_board_missing",
        label: "Board Mouss images publiques",
        status: "PUBLIC_IMAGE_MOUSS_BOARD_MISSING",
        nextAction: "relancer catalog:public-image-mouss-review-board avant revue Mouss",
        blockers: ["board Mouss absent"],
        sourceFile: "",
        allowedAction: "generer un board lecture seule sans valeur source/fournisseur",
        forbiddenActions: [
          "copier dans public/uploads",
          "utiliser image approximative",
          "publier fiche",
          "commander fournisseur",
        ],
      },
    ];
  }

  return top(source.items ?? [], 4).map((item) => ({
    lane: "images_publiques_exactes",
    urgency: -86 + (item.rank ?? 0),
    id: `${item.slug}#mouss-review`,
    label: `${item.name} - revue Mouss image`,
    status: item.status ?? "HOLD_A_COMPLETER",
    nextAction: item.nextAction,
    blockers: [
      ...(item.fieldsToFill?.length ? [`champs texte: ${item.fieldsToFill.join(", ")}`] : []),
      ...(item.blockers ?? []),
    ],
    sourceFile: item.checklistPath,
    allowedAction: "remplir champs texte, deposer WebP exact, puis relancer les audits",
    forbiddenActions: [
      "copier dans public/uploads",
      "utiliser image approximative",
      "publier fiche",
      "commander fournisseur",
    ],
  }));
}

function publicImageTextProofFormActions(source) {
  if (!source) {
    return [
      {
        lane: "images_publiques_exactes",
        urgency: -81,
        id: "public_image_text_proof_form_missing",
        label: "Formulaire preuves texte images",
        status: "PUBLIC_IMAGE_TEXT_PROOF_FORM_MISSING",
        nextAction: "relancer catalog:public-image-text-proof-form avant remplissage terrain",
        blockers: ["formulaire preuves texte absent"],
        sourceFile: "",
        allowedAction: "generer un formulaire lecture seule sans valeur source/fournisseur",
        forbiddenActions: [
          "copier dans public/uploads",
          "utiliser image approximative",
          "publier fiche",
          "commander fournisseur",
        ],
      },
    ];
  }

  const rows = Array.isArray(source.rows) ? source.rows : [];

  return [
    {
      lane: "images_publiques_exactes",
      urgency: -82,
      id: "public_image_text_proof_form",
      label: "Formulaire preuves texte images",
      status: source.ok ? "OK_TEXT_PROOF_FORM_READY_HOLD" : "TEXT_PROOF_FORM_FAILURE",
      nextAction: `${source.rowCount ?? rows.length} lignes a remplir dans les checklists locales, puis relancer les audits image`,
      blockers: source.evidenceTodoCount > 0 ? [`${source.evidenceTodoCount} fiches avec preuves texte a remplir`] : [],
      sourceFile: source.sourceBoard ?? "",
      allowedAction: "remplir uniquement les checklists locales et garder HOLD",
      forbiddenActions: [
        "copier dans public/uploads",
        "utiliser image approximative",
        "publier fiche",
        "commander fournisseur",
      ],
    },
    ...top(rows, 4).map((row) => ({
      lane: "images_publiques_exactes",
      urgency: -81 + Number.parseFloat(String(row.lineRank ?? "0")),
      id: `${row.slug}#${row.fieldKey}`,
      label: `${row.productName} - ${row.fieldLabel}`,
      status: row.valueToFill === "A_REMPLIR_DANS_CHECKLIST" ? "HOLD_TEXT_PROOF_TO_FILL" : "TEXT_PROOF_FILLED_RECHECK",
      nextAction: row.nextAction,
      blockers: [
        row.expectedFormat ? `format attendu: ${row.expectedFormat}` : "",
        row.rejectIf ? `refuser si: ${row.rejectIf}` : "",
      ].filter(Boolean),
      sourceFile: row.checklistPath,
      allowedAction: "remplir la checklist locale, conserver HOLD, puis relancer audit",
      forbiddenActions: [
        "copier dans public/uploads",
        "utiliser image approximative",
        "publier fiche",
        "commander fournisseur",
      ],
    })),
  ];
}

function integrationNextProofActions(source) {
  return top(source?.proofs ?? [], 5).map((proof) => ({
    lane: "preuves_sourcing_integration",
    urgency: -70 + (proof.rank ?? 0),
    id: `${proof.productId}#${proof.fieldKey}`,
    label: `${proof.productName} - ${proof.fieldLabel}`,
    status: proof.status ?? "TO_FILL_HOLD",
    nextAction: proof.nextAction,
    blockers: [
      proof.expectedFormat ? `format attendu: ${proof.expectedFormat}` : "",
      proof.rejectIf ? `refuser si: ${proof.rejectIf}` : "",
    ].filter(Boolean),
    sourceFile: relativePath(proof.imageDepositDir),
    allowedAction: "remplir preuve manuelle, capture ou fichier, puis garder HOLD avant revue Mouss",
    forbiddenActions: [
      "publier",
      "inventer prix ou stock",
      "utiliser produit similaire",
      "commander fournisseur",
    ],
  }));
}

function integrationNextProofAuditActions(source) {
  return [
    {
      lane: "preuves_sourcing_integration",
      urgency: -64,
      id: "audit_next_proofs_integration",
      label: "Audit prochaines preuves sourcing integration",
      status: source?.status ?? "AUDIT_NEXT_PROOFS_MISSING",
      nextAction: source
        ? `${source.holdProofCount ?? 0} preuves HOLD, ${source.readyProofCount ?? 0} pretes revue, ${source.businessBlockerCount ?? 0} blocages metier`
        : "relancer catalog:audit-integration-next-proofs-workpack avant revue humaine",
      blockers: source?.structuralFailures ?? ["audit prochaines preuves absent"],
      sourceFile: source?.sources?.workpackPath ? relativePath(source.sources.workpackPath) : "",
      allowedAction: "remplir uniquement les preuves manuelles puis relancer l'audit",
      forbiddenActions: [
        "publier",
        "lever HOLD automatiquement",
        "copier image publique",
        "commander fournisseur",
      ],
    },
  ];
}

function publicImageCopyGateActions(source) {
  return [
    {
      lane: "garde_fous",
      urgency: 895,
      id: "public_image_copy_gate",
      label: "Gate copie images publiques",
      status: source?.ok
        ? source.copyApplied
          ? "OK_PUBLIC_IMAGE_COPY_APPLIED"
          : "OK_PUBLIC_IMAGE_COPY_DRY_RUN"
        : "PUBLIC_IMAGE_COPY_GATE_FAILURE",
      nextAction: source
        ? `${source.readyCopyCandidateCount ?? 0} candidat copie, ${source.blockedCount ?? 0} bloques, validation humaine obligatoire`
        : "relancer catalog:public-image-copy-gate avant toute copie image publique",
      blockers: source?.items?.filter((item) => item.decision !== "READY_COPY").map((item) => `${item.slug}: ${(item.blockers ?? []).join(", ")}`) ?? [
        "gate copie images publiques absent",
      ],
      sourceFile: source?.sourceDepositAudit ?? "",
      allowedAction: "dry-run, depot WebP exact et checklist; copie seulement apres validation Mouss",
      forbiddenActions: [
        "copier dans public/uploads sans validation",
        "publier fiche",
        "utiliser image approximative",
        "telecharger image externe",
      ],
    },
  ];
}

function generatedArtifactLeakActions(source) {
  return [
    {
      lane: "garde_fous",
      urgency: 896,
      id: "generated_artifact_leak_audit",
      label: "Audit artefacts generes",
      status: source?.ok ? "OK_ARTIFACTS_NO_LEAK" : "GENERATED_ARTIFACT_LEAK_FAILURE",
      nextAction: source
        ? `${source.findingCount ?? 0} fuite detectee sur ${source.scannedFileCount ?? 0} fichiers generes`
        : "relancer catalog:audit-generated-artifact-leaks apres generation de tableaux",
      blockers: source?.findings ?? ["audit artefacts generes absent"],
      sourceFile: source?.scannedDirectories?.[0] ?? "",
      allowedAction: "corriger ou regenerer les artefacts internes avant partage",
      forbiddenActions: [
        "publier artefact non audite",
        "inclure lien fournisseur brut",
        "inclure prix fournisseur visible client",
      ],
    },
  ];
}

function guardrailActions({ checkout, partnerGates, surprise, publicSurface }) {
  return [
    {
      lane: "garde_fous",
      urgency: 899,
      id: "public_dropshipping_surface",
      label: "Surface publique dropshipping",
      status: publicSurface?.ok ? "OK_NO_PUBLIC_SUPPLIER_LEAK" : "PUBLIC_SURFACE_FAILURE",
      nextAction: publicSurface?.ok
        ? "maintenir zero fuite client: marketplace fournisseur, prix fournisseur, liens fournisseur et images non prouvees restent bloques"
        : "corriger immediatement les fuites publiques avant toute autre couche catalogue",
      blockers: publicSurface?.failures ?? ["audit surface publique manquant"],
      sourceFile: relativePath(latestFileUnder(actionRoot, "AUDIT_SURFACE_PUBLIQUE_DROPSHIPPING_")),
      allowedAction: "audit lecture seule et correction wording client si besoin",
      forbiddenActions: [
        "afficher marketplace fournisseur",
        "afficher lien fournisseur",
        "afficher prix fournisseur",
        "publier fiche sans image exacte",
      ],
    },
    {
      lane: "garde_fous",
      urgency: 900,
      id: "checkout",
      label: "Checkout et Stripe",
      status: checkout?.ok ? "OK_GUARDS_ACTIVE" : "CHECKOUT_GUARD_FAILURE",
      nextAction: checkout?.ok
        ? "maintenir les gardes actifs; ne pas toucher au paiement sans validation Mouss"
        : "corriger les echecs checkout avant toute autre couche sensible",
      blockers: checkout?.guardFailures ?? checkout?.currentFailures ?? [],
      sourceFile: relativePath(latestFileUnder(supplierRoot, "AUDIT_CHECKOUT_ELIGIBILITY_")),
      allowedAction: "audit lecture seule et correction de garde-fous si besoin",
      forbiddenActions: ["creer session Stripe reelle", "deployer", "modifier cles API"],
    },
    {
      lane: "garde_fous",
      urgency: 901,
      id: "partner_publication_gates",
      label: "Publication produits partenaires",
      status: partnerGates?.ok ? "OK_ALL_PARTNERS_HOLD" : "PARTNER_GATE_FAILURE",
      nextAction: partnerGates?.ok
        ? `${partnerGates.draftHoldCount ?? 0} produits partenaires restent en HOLD, ne rien publier`
        : "corriger les gates partenaires avant tout travail catalogue",
      blockers: partnerGates?.failures ?? [],
      sourceFile: relativePath(latestFileUnder(supplierRoot, "AUDIT_ALL_PARTNER_GATES_")),
      allowedAction: "audit et enrichissement preuves en brouillon",
      forbiddenActions: ["publier", "lever HOLD automatiquement", "commander fournisseur"],
    },
    {
      lane: "garde_fous",
      urgency: 902,
      id: "surprise_hold",
      label: "Colis surprises et palettes",
      status: surprise?.ok ? "OK_NON_VENDABLES" : "SURPRISE_HOLD_FAILURE",
      nextAction: surprise?.ok
        ? "conserver badge A venir et achat bloque"
        : "corriger immediatement les produits surprise vendables",
      blockers: surprise?.failures ?? surprise?.guardFailures ?? [],
      sourceFile: relativePath(latestFileUnder(supplierRoot, "AUDIT_SURPRISES_NON_VENDABLES_")),
      allowedAction: "audit hold et correction badge/boutons si besoin",
      forbiddenActions: ["vendre colis surprise", "activer paiement", "publier palettes"],
    },
  ];
}

function seoGuardrailActions(source) {
  return [
    {
      lane: "garde_fous",
      urgency: 898,
      id: "seo_hold_visibility",
      label: "SEO produits HOLD",
      status: source?.ok ? "OK_HOLD_PRODUCTS_NOT_INDEXABLE" : "SEO_HOLD_VISIBILITY_FAILURE",
      nextAction: source?.ok
        ? `${source.nonPublicProductCount ?? 0} produits non publics restent hors sitemap/pre-generation`
        : "corriger sitemap, noindex ou generateStaticParams avant toute publication produit",
      blockers: source?.failures ?? ["audit SEO HOLD manquant"],
      sourceFile: source?.files?.json ?? source?.outputDirRelative ?? "",
      allowedAction: "audit lecture seule et correction noindex/sitemap si besoin",
      forbiddenActions: [
        "indexer brouillons",
        "referencer fiches HOLD",
        "laisser adminPreview indexable",
      ],
    },
  ];
}

function adminPublicationGateActions(source) {
  return [
    {
      lane: "garde_fous",
      urgency: 897,
      id: "admin_publication_gate",
      label: "Publication admin produits",
      status: source?.ok ? "OK_ADMIN_PUBLICATION_GATE_ACTIVE" : "ADMIN_PUBLICATION_GATE_FAILURE",
      nextAction: source?.ok
        ? "le serveur refuse les publications dropshipping sans preuves completes"
        : "corriger immediatement le garde publication admin avant toute fiche produit",
      blockers: source?.sourceFailures ?? source?.riskProducts ?? ["audit publication admin manquant"],
      sourceFile: source?.files?.json ?? "",
      allowedAction: "audit lecture seule et correction du garde serveur si besoin",
      forbiddenActions: [
        "publier produit HOLD",
        "bypasser preuves fournisseur",
        "bypasser images exactes",
      ],
    },
  ];
}

function adminPublicationUiGuardActions(source) {
  return [
    {
      lane: "garde_fous",
      urgency: 897.5,
      id: "admin_publication_ui_guard",
      label: "UI publication admin",
      status: source?.ok ? "OK_ADMIN_PUBLICATION_UI_GUARD_ACTIVE" : "ADMIN_PUBLICATION_UI_GUARD_FAILURE",
      nextAction: source?.ok
        ? "le formulaire admin affiche les blocages et desactive la publication incomplete"
        : "corriger l'UI admin pour rendre les blocages publication visibles avant validation",
      blockers: source?.failures ?? ["audit UI publication admin manquant"],
      sourceFile: source?.files?.json ?? "",
      allowedAction: "audit lecture seule et correction du formulaire admin si besoin",
      forbiddenActions: [
        "publier produit HOLD",
        "masquer les blocages serveur",
        "laisser une publication incomplete sans alerte admin",
      ],
    },
  ];
}

function laneSummary(actions) {
  const byLane = new Map();
  for (const action of actions) {
    const current = byLane.get(action.lane) ?? {
      lane: action.lane,
      actionCount: 0,
      blockedCount: 0,
      readyCount: 0,
      firstAction: "",
    };
    current.actionCount += 1;
    if (!action.status.startsWith("OK_") && (action.status.includes("HOLD") || action.status.includes("FAILURE"))) {
      current.blockedCount += 1;
    }
    if (action.status.includes("READY")) current.readyCount += 1;
    if (!current.firstAction) current.firstAction = action.nextAction;
    byLane.set(action.lane, current);
  }
  return [...byLane.values()];
}

function markdown(summary) {
  const laneRows = summary.lanes.map(
    (lane) =>
      `| ${mdCell(lane.lane)} | ${lane.actionCount} | ${lane.blockedCount} | ${lane.readyCount} | ${mdCell(lane.firstAction)} |`,
  );
  const actionRows = summary.actions.map(
    (action) =>
      `| ${action.rank} | ${mdCell(action.lane)} | ${mdCell(action.label)} | ${mdCell(action.status)} | ${mdCell(action.nextAction)} | ${mdCell(action.allowedAction)} |`,
  );

  return `${[
    "# Maxi Trouvailles - Tableau execution du jour",
    "",
    `Date locale: ${summary.generatedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Actions consolidees: ${summary.actionCount}`,
    `- Produits partenaires en HOLD: ${summary.metrics.partnerDraftHoldCount}`,
    `- Images categories attendues: ${summary.metrics.categoryImagesExpected}`,
    `- Images categories manquantes: ${summary.metrics.categoryImagesMissing}`,
    `- Photos produits sprint attendues: ${summary.metrics.productPhotosExpected}`,
    `- Photos produits sprint manquantes: ${summary.metrics.productPhotosMissing}`,
    `- Cockpits produits actifs: ${summary.metrics.cockpitCount} produits, ${summary.metrics.cockpitEvidenceFieldMissingCount} preuves, ${summary.metrics.cockpitImageTaskCount} images, ${summary.metrics.cockpitBlockerCount} blocages`,
    `- Kit terrain actif: ${summary.metrics.fieldKitEvidenceRowCount} preuves a remplir, ${summary.metrics.fieldKitImageRowCount} images a deposer`,
    `- Audit kit terrain: ${summary.metrics.fieldKitAuditStatus}, ${summary.metrics.fieldKitAuditHoldCount} produits HOLD, ${summary.metrics.fieldKitAuditBlockerCount} blocages`,
    `- Images publiques a deposer: ${summary.metrics.publicImageTodoDepositCount}, candidats copie apres validation: ${summary.metrics.publicImageReadyCopyCandidateCount}`,
    `- Board Mouss images publiques: ${summary.metrics.publicImageMoussReviewItemCount} fiches, ${summary.metrics.publicImageMoussWebpMissingCount} WebP manquants, ${summary.metrics.publicImageMoussEvidenceTodoCount} preuves texte a remplir, ${summary.metrics.publicImageMoussReadyReviewCount} pretes revue`,
    `- Formulaire preuves texte images: ${summary.metrics.publicImageTextProofFormRowCount} lignes, ${summary.metrics.publicImageTextProofFormItemCount} fiches, ${summary.metrics.publicImageTextProofFormEvidenceTodoCount} preuves texte a remplir`,
    `- Gate copie images publiques: ${summary.metrics.publicImageCopyGateStatus}, ${summary.metrics.publicImageBlockedCount} bloquees, copie appliquee: ${summary.metrics.publicImageCopyApplied ? "oui" : "non"}`,
    `- Preuves sourcing integration: ${summary.metrics.integrationNextProofCount} champs, ${summary.metrics.integrationNextProofHoldCount} HOLD, ${summary.metrics.integrationNextProofReadyCount} pretes revue, ${summary.metrics.integrationNextProofBusinessBlockerCount} blocages metier`,
    `- Audit artefacts generes: ${summary.metrics.generatedArtifactLeakFindingCount} fuite sur ${summary.metrics.generatedArtifactLeakScannedFileCount} fichiers`,
    `- Garde publication admin: ${summary.metrics.adminPublicationGateStatus}, ${summary.metrics.adminPublicationGateRiskProductCount} produit rapide a risque`,
    `- UI publication admin: ${summary.metrics.adminPublicationUiGuardStatus}, ${summary.metrics.adminPublicationUiGuardFailureCount} echec UI`,
    `- SEO produits HOLD: ${summary.metrics.seoHoldVisibilityStatus}, ${summary.metrics.seoHoldVisibilityNonPublicProductCount} produits hors indexation`,
    `- Produits achetables publics: ${summary.metrics.expectedPurchasableCount}`,
    `- Produits achetables legacy avant focus dropshipping: ${summary.metrics.legacyPurchasableCount}`,
    `- Fuites surface publique dropshipping: ${summary.metrics.publicSurfaceFailureCount}`,
    `- Warnings surface publique dropshipping: ${summary.metrics.publicSurfaceWarningCount}`,
    `- Produits visibles surface dropshipping: ${summary.metrics.publicSurfaceVisibleDropshippingCount}`,
    "- Publication: aucune",
    "- Paiement/Stripe reel: aucun",
    "- Commande fournisseur: aucune",
    "",
    "## Lots de travail",
    "",
    "| Lot | Actions | Bloquees | Pretes revue | Premiere action |",
    "|---|---:|---:|---:|---|",
    ...laneRows,
    "",
    "## Actions prioritaires",
    "",
    "| Rang | Lot | Element | Statut | Prochaine action | Autorise maintenant |",
    "|---:|---|---|---|---|---|",
    ...actionRows,
    "",
    "## Interdits",
    "",
    "- aucune publication production;",
    "- aucune commande fournisseur;",
    "- aucun paiement ou test Stripe reel;",
    "- aucune copie image publique sans validation Mouss;",
    "- aucun message client automatique.",
    "",
    "## Sources",
    "",
    ...Object.entries(summary.sources).map(([key, value]) => `- ${key}: ${value || "absent"}`),
    "",
  ].join("\n")}\n`;
}

function csv(summary) {
  const headers = [
    "rank",
    "lane",
    "id",
    "label",
    "status",
    "nextAction",
    "allowedAction",
    "forbiddenActions",
    "blockers",
    "sourceFile",
  ];
  return `${headers.join(",")}\n${summary.actions
    .map((item) => headers.map((header) => csvEscape(item[header])).join(","))
    .join("\n")}\n`;
}

const businessPath = latestFileUnder(actionRoot, "QUOI_FAIRE_MAINTENANT_PARTENAIRES_");
const categoryIntakePath = latestFileUnder(actionRoot, "SUIVI_DEPOTS_IMAGES_CATEGORIES_");
const photoDropPath = latestFileUnder(photoDropRoot, "MANIFEST_DEPOT_PHOTOS_SPRINT_");
const cockpitPaths = latestFilesUnder(actionRoot, "COCKPIT_VALIDATION_PRODUIT_", 5);
const fieldKitPath = latestFileUnder(actionRoot, "KIT_TERRAIN_VALIDATION_PRODUITS_");
const fieldKitAuditPath = latestFileUnder(actionRoot, "AUDIT_KIT_TERRAIN_VALIDATION_PRODUITS_");
const seoHoldVisibilityPath = latestFileUnder(actionRoot, "AUDIT_SEO_HOLD_VISIBILITY_");
const adminPublicationGatePath = latestFileUnder(supplierRoot, "AUDIT_ADMIN_PUBLICATION_GATE_");
const adminPublicationUiGuardPath = latestFileUnder(supplierRoot, "AUDIT_ADMIN_PUBLICATION_UI_GUARD_");
const checkoutPath = latestFileUnder(supplierRoot, "AUDIT_CHECKOUT_ELIGIBILITY_");
const partnerGatesPath = latestFileUnder(supplierRoot, "AUDIT_ALL_PARTNER_GATES_");
const surprisePath = latestFileUnder(supplierRoot, "AUDIT_SURPRISES_NON_VENDABLES_");
const publicSurfacePath = latestFileUnder(actionRoot, "AUDIT_SURFACE_PUBLIQUE_DROPSHIPPING_");
const publicImageOperatorPath = latestFileUnder(actionRoot, "PACK_OPERATEUR_DEPOT_IMAGES_PUBLIQUES_");
const publicImageMoussReviewPath = latestFileUnder(actionRoot, "BOARD_MOUSS_IMAGES_PUBLIQUES_");
const publicImageTextProofFormPath = latestFileUnder(actionRoot, "FORMULAIRE_PREUVES_TEXTE_IMAGES_PUBLIQUES_");
const publicImageCopyGatePath = latestFileUnder(actionRoot, "GATE_COPIE_IMAGES_PUBLIQUES_");
const artifactLeakAuditPath = latestFileUnder(actionRoot, "AUDIT_ARTEFACTS_GENERES_SENSIBLES_");
const integrationNextProofsPath = latestFileUnder(actionRoot, "PROCHAINES_PREUVES_SOURCING_INTEGRATION_");
const integrationNextProofsAuditPath = latestFileUnder(actionRoot, "AUDIT_PROCHAINES_PREUVES_SOURCING_INTEGRATION_");

const business = readJsonIfExists(businessPath);
const categoryIntake = readJsonIfExists(categoryIntakePath);
const photoDrop = readJsonIfExists(photoDropPath);
const cockpits = cockpitPaths
  .map((filePath) => readJsonIfExists(filePath))
  .filter(Boolean)
  .sort((a, b) =>
    String(a?.outputDirRelative ?? "").localeCompare(String(b?.outputDirRelative ?? "")),
  );
const fieldKit = readJsonIfExists(fieldKitPath);
const fieldKitAudit = readJsonIfExists(fieldKitAuditPath);
const seoHoldVisibility = readJsonIfExists(seoHoldVisibilityPath);
const adminPublicationGate = readJsonIfExists(adminPublicationGatePath);
const adminPublicationUiGuard = readJsonIfExists(adminPublicationUiGuardPath);
const checkout = readJsonIfExists(checkoutPath);
const partnerGates = readJsonIfExists(partnerGatesPath);
const surprise = readJsonIfExists(surprisePath);
const publicSurface = readJsonIfExists(publicSurfacePath);
const publicImageOperator = readJsonIfExists(publicImageOperatorPath);
const publicImageMoussReview = readJsonIfExists(publicImageMoussReviewPath);
const publicImageTextProofForm = readJsonIfExists(publicImageTextProofFormPath);
const publicImageCopyGate = readJsonIfExists(publicImageCopyGatePath);
const artifactLeakAudit = readJsonIfExists(artifactLeakAuditPath);
const integrationNextProofs = readJsonIfExists(integrationNextProofsPath);
const integrationNextProofsAudit = readJsonIfExists(integrationNextProofsAuditPath);

const actions = [
  ...cockpitActions(cockpits),
  ...publicImageOperatorActions(publicImageOperator),
  ...publicImageMoussReviewActions(publicImageMoussReview),
  ...publicImageTextProofFormActions(publicImageTextProofForm),
  ...fieldKitAuditActions(fieldKitAudit),
  ...integrationNextProofActions(integrationNextProofs),
  ...integrationNextProofAuditActions(integrationNextProofsAudit),
  ...businessActions(business),
  ...categoryImageActions(categoryIntake),
  ...productPhotoActions(photoDrop),
  ...publicImageCopyGateActions(publicImageCopyGate),
  ...generatedArtifactLeakActions(artifactLeakAudit),
  ...adminPublicationGateActions(adminPublicationGate),
  ...adminPublicationUiGuardActions(adminPublicationUiGuard),
  ...seoGuardrailActions(seoHoldVisibility),
  ...guardrailActions({ checkout, partnerGates, surprise, publicSurface }),
]
  .sort((a, b) => a.urgency - b.urgency || a.lane.localeCompare(b.lane))
  .map((action, index) => ({
    rank: index + 1,
    ...action,
  }));

const { dateKey, localLabel } = datePartsParis();
const outputDir = path.join(actionRoot, `execution-du-jour-${dateKey}`);
fs.mkdirSync(outputDir, { recursive: true });

const summary = {
  ok: true,
  generatedAt: new Date().toISOString(),
  generatedAtLocal: localLabel,
  mode: "read_only_daily_execution_board",
  actionCount: actions.length,
  lanes: laneSummary(actions),
  metrics: {
    partnerActionCount: business?.actionCount ?? 0,
    partnerDraftHoldCount: partnerGates?.draftHoldCount ?? 0,
    partnerPublishedCount: partnerGates?.publishedPartnerCount ?? 0,
    categoryImagesExpected: categoryIntake?.expectedImageCount ?? 0,
    categoryImagesMissing: categoryIntake?.missingCount ?? 0,
    categoryImagesReadyHumanReview: categoryIntake?.humanReviewReadyCount ?? 0,
    productPhotosExpected: photoDrop?.expectedImageCount ?? 0,
    productPhotosMissing: (photoDrop?.expectedImageCount ?? 0) - (photoDrop?.presentValidWebpCount ?? 0),
    cockpitCount: cockpits.length,
    cockpitEvidenceFieldMissingCount: cockpits.reduce(
      (sum, cockpit) => sum + (cockpit?.evidenceFieldMissingCount ?? 0),
      0,
    ),
    cockpitImageTaskCount: cockpits.reduce(
      (sum, cockpit) => sum + (cockpit?.imageTaskCount ?? 0),
      0,
    ),
    cockpitBlockerCount: cockpits.reduce(
      (sum, cockpit) => sum + (cockpit?.blockers?.length ?? 0),
      0,
    ),
    fieldKitEvidenceRowCount: fieldKit?.evidenceRowCount ?? 0,
    fieldKitImageRowCount: fieldKit?.imageRowCount ?? 0,
    fieldKitAuditStatus: fieldKitAudit?.status ?? "absent",
    fieldKitAuditReadyReviewCount: fieldKitAudit?.readyReviewCount ?? 0,
    fieldKitAuditHoldCount: fieldKitAudit?.holdCount ?? 0,
    fieldKitAuditBlockerCount: fieldKitAudit?.blockerCount ?? 0,
    fieldKitAuditEvidenceMissingOrInvalidCount: fieldKitAudit?.evidenceMissingOrInvalidCount ?? 0,
    fieldKitAuditMissingImageFileCount: fieldKitAudit?.missingImageFileCount ?? 0,
    fieldKitAuditInvalidImageFileCount: fieldKitAudit?.invalidImageFileCount ?? 0,
    publicImageOperatorItemCount: publicImageOperator?.itemCount ?? 0,
    publicImageTodoDepositCount: publicImageOperator?.todoDepositCount ?? 0,
    publicImageReadyCopyCandidateCount: publicImageOperator?.readyCopyCandidateCount ?? 0,
    publicImageMoussReviewItemCount: publicImageMoussReview?.itemCount ?? 0,
    publicImageMoussWebpMissingCount: publicImageMoussReview?.webpMissingCount ?? 0,
    publicImageMoussEvidenceTodoCount: publicImageMoussReview?.evidenceTodoCount ?? 0,
    publicImageMoussReadyReviewCount: publicImageMoussReview?.readyReviewCount ?? 0,
    publicImageMoussSensitiveValuesExported: publicImageMoussReview?.sensitiveValuesExported ?? false,
    publicImageTextProofFormItemCount: publicImageTextProofForm?.itemCount ?? 0,
    publicImageTextProofFormRowCount: publicImageTextProofForm?.rowCount ?? 0,
    publicImageTextProofFormWebpMissingCount: publicImageTextProofForm?.webpMissingCount ?? 0,
    publicImageTextProofFormEvidenceTodoCount: publicImageTextProofForm?.evidenceTodoCount ?? 0,
    publicImageTextProofFormSensitiveValuesExported: publicImageTextProofForm?.sensitiveValuesExported ?? false,
    publicImageCopyGateStatus: publicImageCopyGate?.ok ? publicImageCopyGate.mode ?? "OK" : "absent_or_failure",
    publicImageCopyGateReadyCandidateCount: publicImageCopyGate?.readyCopyCandidateCount ?? 0,
    publicImageBlockedCount: publicImageCopyGate?.blockedCount ?? 0,
    publicImageCopyApplied: publicImageCopyGate?.copyApplied ?? false,
    generatedArtifactLeakFindingCount: artifactLeakAudit?.findingCount ?? 0,
    generatedArtifactLeakScannedFileCount: artifactLeakAudit?.scannedFileCount ?? 0,
    generatedArtifactLeakScannedDirectoryCount: artifactLeakAudit?.scannedDirectoryCount ?? 0,
    integrationNextProofCount: integrationNextProofs?.proofCount ?? 0,
    integrationNextProofAuditStatus: integrationNextProofsAudit?.status ?? "absent",
    integrationNextProofReadyCount: integrationNextProofsAudit?.readyProofCount ?? 0,
    integrationNextProofHoldCount: integrationNextProofsAudit?.holdProofCount ?? 0,
    integrationNextProofBusinessBlockerCount: integrationNextProofsAudit?.businessBlockerCount ?? 0,
    seoHoldVisibilityStatus: seoHoldVisibility?.status ?? "absent",
    seoHoldVisibilityFailureCount: seoHoldVisibility?.failureCount ?? 0,
    seoHoldVisibilityPublicProductCount: seoHoldVisibility?.publicProductCount ?? 0,
    seoHoldVisibilityNonPublicProductCount: seoHoldVisibility?.nonPublicProductCount ?? 0,
    adminPublicationGateStatus: adminPublicationGate?.status ?? "absent",
    adminPublicationGateSourceFailureCount: adminPublicationGate?.sourceFailureCount ?? 0,
    adminPublicationGateRiskProductCount: adminPublicationGate?.riskProductCount ?? 0,
    adminPublicationUiGuardStatus: adminPublicationUiGuard?.status ?? "absent",
    adminPublicationUiGuardFailureCount: adminPublicationUiGuard?.failureCount ?? 0,
    expectedPurchasableCount: checkout?.expectedPurchasableCount ?? 0,
    legacyPurchasableCount: checkout?.legacyPurchasableCount ?? 0,
    publicSurfaceVisibleDropshippingCount: publicSurface?.visibleDropshippingCount ?? 0,
    publicSurfacePurchasableDropshippingCount: publicSurface?.purchasableDropshippingCount ?? 0,
    publicSurfaceFailureCount: publicSurface?.failureCount ?? 0,
    publicSurfaceWarningCount: publicSurface?.warningCount ?? 0,
    checkoutFailureCount: checkout?.failureCount ?? 0,
    surpriseFailureCount: surprise?.failureCount ?? 0,
  },
  actions,
  outputDir,
  outputDirRelative: relativePath(outputDir),
  sources: {
    businessPath: relativePath(businessPath),
    categoryIntakePath: relativePath(categoryIntakePath),
    photoDropPath: relativePath(photoDropPath),
    cockpitPaths: cockpitPaths.map(relativePath),
    fieldKitPath: relativePath(fieldKitPath),
    fieldKitAuditPath: relativePath(fieldKitAuditPath),
    seoHoldVisibilityPath: relativePath(seoHoldVisibilityPath),
    adminPublicationGatePath: relativePath(adminPublicationGatePath),
    adminPublicationUiGuardPath: relativePath(adminPublicationUiGuardPath),
    checkoutPath: relativePath(checkoutPath),
    partnerGatesPath: relativePath(partnerGatesPath),
    surprisePath: relativePath(surprisePath),
    publicSurfacePath: relativePath(publicSurfacePath),
    publicImageOperatorPath: relativePath(publicImageOperatorPath),
    publicImageMoussReviewPath: relativePath(publicImageMoussReviewPath),
    publicImageTextProofFormPath: relativePath(publicImageTextProofFormPath),
    publicImageCopyGatePath: relativePath(publicImageCopyGatePath),
    artifactLeakAuditPath: relativePath(artifactLeakAuditPath),
    integrationNextProofsPath: relativePath(integrationNextProofsPath),
    integrationNextProofsAuditPath: relativePath(integrationNextProofsAuditPath),
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
    noMessageSent: true,
    manualValidationRequired: true,
  },
};

const jsonPath = path.join(outputDir, `EXECUTION_DU_JOUR_MAXI_${dateKey}.json`);
const mdPath = path.join(outputDir, `EXECUTION_DU_JOUR_MAXI_${dateKey}.md`);
const csvPath = path.join(outputDir, `EXECUTION_DU_JOUR_MAXI_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(summary), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      actionCount: summary.actionCount,
      metrics: summary.metrics,
      files: {
        jsonPath,
        mdPath,
        csvPath,
      },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

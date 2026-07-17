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

function failureLabels(failures, fallback) {
  if (!Array.isArray(failures) || failures.length === 0) return [fallback];
  return failures.map((failure, index) => {
    if (typeof failure === "string") return `echec_${index + 1}`;
    return failure?.name ?? failure?.code ?? failure?.label ?? `echec_${index + 1}`;
  });
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

function publicImagePipelineCoherenceActions(source) {
  return [
    {
      lane: "garde_fous",
      urgency: 894,
      id: "public_image_pipeline_coherence",
      label: "Coherence pipeline images publiques",
      status: source?.ok ? "OK_PUBLIC_IMAGE_PIPELINE_COHERENT" : "PUBLIC_IMAGE_PIPELINE_COHERENCE_FAILURE",
      nextAction: source
        ? `${source.failureCount ?? 0} echec coherence, ${source.itemCount ?? 0} fiches, ${source.formRowCount ?? 0} lignes formulaire`
        : "relancer catalog:audit-public-image-pipeline-coherence avant toute copie image publique",
      blockers: source?.failures ?? ["audit coherence pipeline images publiques absent"],
      sourceFile: source?.sources?.proofPack ?? "",
      allowedAction: "relancer l'audit coherence lecture seule et corriger uniquement les artefacts HOLD",
      forbiddenActions: [
        "copier dans public/uploads",
        "utiliser image approximative",
        "publier fiche",
        "commander fournisseur",
      ],
    },
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

function integrationSourcingPriorityBoardAuditActions(source) {
  return [
    {
      lane: "preuves_sourcing_integration",
      urgency: -65,
      id: "audit_pilotage_sourcing_integration",
      label: "Audit pilotage sourcing integration",
      status: source?.status ?? "AUDIT_PRIORITY_BOARD_MISSING",
      nextAction: source
        ? `${source.productCount ?? 0} produits, ${source.totalMissingFieldCount ?? 0} preuves, ${source.expectedImageCount ?? 0} WebP attendus, ${source.failureCount ?? 0} echec`
        : "relancer catalog:audit-integration-sourcing-priority-board avant usage terrain du board sourcing",
      blockers: source?.ok ? [] : failureLabels(source?.issues, "audit pilotage sourcing integration absent"),
      sourceFile: source?.sources?.boardPath ?? "",
      allowedAction: "utiliser le board en lecture seule pour prioriser preuves et depots WebP exacts",
      forbiddenActions: [
        "lever HOLD automatiquement",
        "publier",
        "copier image publique",
        "commander fournisseur",
      ],
    },
  ];
}

function integrationTop3SourcingActions(source) {
  if (!source) {
    return [
      {
        lane: "preuves_sourcing_integration",
        urgency: -73,
        id: "top3_sourcing_integration_missing",
        label: "Sprint top 3 sourcing integration",
        status: "TOP3_SOURCING_INTEGRATION_MISSING",
        nextAction: "relancer catalog:integration-top3-sourcing-sprint avant le remplissage terrain des preuves",
        blockers: ["sprint top 3 sourcing absent"],
        sourceFile: "",
        allowedAction: "generer un sprint lecture seule depuis le board pilotage garde OK",
        forbiddenActions: [
          "lever HOLD automatiquement",
          "publier",
          "copier image publique",
          "commander fournisseur",
        ],
      },
    ];
  }

  return (source.rows ?? []).map((row) => ({
    lane: "preuves_sourcing_integration",
    urgency: -74 + (row.sprintRank ?? 0),
    id: `${row.productId}#top3-sourcing`,
    label: `${row.name} - sprint sourcing`,
    status: row.safetyStatus ?? source.status ?? "HOLD_TOP3_SOURCING_READY",
    nextAction: row.sprintAction,
    blockers: [
      `${row.missingFieldCount ?? 0} preuves a remplir`,
      `${row.expectedImageFiles?.length ?? 0} WebP exacts attendus`,
      ...((row.missingZones ?? []).slice(0, 3)),
    ],
    sourceFile: row.imageDepositDirRelative,
    allowedAction: "remplir les preuves manuelles et deposer les WebP exacts en conservant HOLD",
    forbiddenActions: [
      "lever HOLD automatiquement",
      "publier",
      "copier image publique",
      "commander fournisseur",
    ],
  }));
}

function integrationTop3SourcingAuditActions(source) {
  return [
    {
      lane: "preuves_sourcing_integration",
      urgency: -72,
      id: "audit_top3_sourcing_integration",
      label: "Audit sprint top 3 sourcing integration",
      status: source?.status ?? "AUDIT_TOP3_SOURCING_MISSING",
      nextAction: source
        ? `${source.productCount ?? 0} produits, ${source.expectedImageCount ?? 0} WebP attendus, ${source.failureCount ?? 0} echec, ${source.sensitiveFindingCount ?? 0} fuite`
        : "relancer catalog:audit-integration-top3-sourcing-sprint avant execution terrain du top 3",
      blockers: source?.ok ? [] : failureLabels(source?.issues, "audit sprint top 3 sourcing absent"),
      sourceFile: source?.sources?.top3Path ?? "",
      allowedAction: "utiliser le sprint top 3 uniquement si l'audit reste OK et HOLD",
      forbiddenActions: [
        "lever HOLD automatiquement",
        "publier",
        "copier image publique",
        "commander fournisseur",
      ],
    },
  ];
}

function integrationTop3ParallelProofsActions(source, audit) {
  return [
    {
      lane: "preuves_sourcing_integration",
      urgency: -71,
      id: "top3_parallel_proofs_workpack",
      label: "Pack parallele top 3 preuves critiques",
      status: audit?.status ?? source?.status ?? "TOP3_PARALLEL_PROOFS_MISSING",
      nextAction: source
        ? `${source.proofCount ?? 0} preuves critiques, ${source.productCount ?? 0} produits, audit ${audit?.status ?? "absent"}`
        : "relancer catalog:integration-top3-parallel-proofs-workpack puis son audit",
      blockers: audit?.ok ? [] : failureLabels(audit?.issues, "pack parallele top 3 absent ou non audite"),
      sourceFile: audit?.sources?.workpackPath ?? source?.sources?.top3Path ?? "",
      allowedAction: "remplir manuellement le CSV parallele puis relancer les audits",
      forbiddenActions: [
        "lever HOLD automatiquement",
        "publier",
        "copier image publique",
        "commander fournisseur",
      ],
    },
  ];
}

function integrationTop3WebpActions(source, audit) {
  return [
    {
      lane: "images_exactes",
      urgency: -70,
      id: "top3_webp_workpack",
      label: "Pack WebP exacts top 3 sourcing",
      status: audit?.status ?? source?.status ?? "TOP3_WEBP_WORKPACK_MISSING",
      nextAction: source
        ? `${source.imageTaskCount ?? 0} WebP exacts attendus, ${source.productCount ?? 0} produits, audit ${audit?.status ?? "absent"}`
        : "relancer catalog:integration-top3-webp-workpack puis son audit",
      blockers: audit?.ok ? [] : failureLabels(audit?.issues, "pack WebP top 3 absent ou non audite"),
      sourceFile: audit?.sources?.workpackPath ?? source?.sources?.top3Path ?? "",
      allowedAction: "deposer seulement des WebP exacts locaux apres preuve droits/image et validation Mouss",
      forbiddenActions: [
        "telecharger automatiquement",
        "copier image publique",
        "lever HOLD automatiquement",
        "publier",
        "commander fournisseur",
      ],
    },
  ];
}

function integrationTop3WebpDepotFilesActions(source) {
  const waitingItems = Array.isArray(source?.items)
    ? source.items.filter((item) => item.status !== "READY_FOR_HUMAN_REVIEW_HOLD").slice(0, 10)
    : [];

  return [
    {
      lane: "images_exactes",
      urgency: -69,
      id: "top3_webp_depot_files_audit",
      label: "Audit depots WebP top 3",
      status: source?.status ?? "TOP3_WEBP_DEPOT_FILES_AUDIT_MISSING",
      nextAction: source
        ? `${source.readyImageCount ?? 0}/${source.imageTaskCount ?? 0} WebP valides, ${source.missingCount ?? 0} manquants, ${source.invalidImageCount ?? 0} invalides`
        : "relancer catalog:audit-integration-top3-webp-depot-files apres le workpack WebP",
      blockers: source?.ok
        ? waitingItems.map(
            (item) =>
              `${item.productName ?? item.productId ?? "produit"} / ${item.role ?? "image"}: ${(item.blockers ?? []).join(", ")}`,
          )
        : failureLabels(source?.issues, "audit depots WebP top 3 absent ou en echec"),
      sourceFile: source?.sources?.workpackPath ?? "",
      allowedAction: "deposer ou corriger uniquement les WebP exacts locaux puis relancer l'audit",
      forbiddenActions: [
        "telecharger automatiquement",
        "copier image publique",
        "lever HOLD automatiquement",
        "publier",
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
      blockers: source?.ok ? [] : failureLabels(source?.findings, "audit artefacts generes absent"),
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

function publicCatalogSourceGuardActions(source) {
  return [
    {
      lane: "garde_fous",
      urgency: 897.7,
      id: "public_catalog_source_guards",
      label: "Sources catalogue publiques",
      status: source?.ok ? "OK_PUBLIC_CATALOG_SOURCE_GUARDS" : "PUBLIC_CATALOG_SOURCE_GUARD_FAILURE",
      nextAction: source
        ? `${source.findingCount ?? 0} contournement source sur ${(source.publicClientFileCount ?? 0) + (source.publicRouteFileCount ?? 0)} fichiers surveilles`
        : "relancer catalog:audit-public-catalog-source-guards avant toute evolution panier/boutique",
      blockers: source?.findings ?? ["audit sources catalogue public absent"],
      sourceFile: "src/lib/catalog-server.ts",
      allowedAction: "corriger uniquement les imports publics pour repasser par les filtres publics",
      forbiddenActions: [
        "importer products dans une surface publique",
        "exposer lien fournisseur",
        "exposer prix fournisseur visible client",
        "publier fiche sans image exacte",
      ],
    },
  ];
}

function publicVisualAmbiguityActions(source) {
  return [
    {
      lane: "garde_fous",
      urgency: 897.6,
      id: "public_visual_ambiguity",
      label: "Surface visuelle publique",
      status: source?.ok ? "OK_PUBLIC_VISUAL_SURFACE_SAFE" : "PUBLIC_VISUAL_AMBIGUITY_FAILURE",
      nextAction: source
        ? `${source.failureCount ?? 0} ambiguite visuelle, ${source.stockVisualFindingCount ?? 0} image stock ou CDN interdite`
        : "relancer catalog:audit-public-visual-ambiguity avant toute evolution visuelle publique",
      blockers: source?.failures ?? ["audit surface visuelle publique absent"],
      sourceFile: "src/components/ProductCard.tsx",
      allowedAction: "corriger uniquement les garde-fous visuels publics et relancer l'audit",
      forbiddenActions: [
        "utiliser image approximative",
        "afficher image fournisseur non prouvee",
        "publier fiche",
        "copier dans public/uploads",
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

function adminApiGuardActions(source) {
  return [
    {
      lane: "garde_fous",
      urgency: 897.55,
      id: "admin_api_guards",
      label: "Routes API admin",
      status: source?.ok ? "OK_ADMIN_API_GUARDS_ACTIVE" : "ADMIN_API_GUARD_FAILURE",
      nextAction: source?.ok
        ? `${source.routeCount ?? 0} routes admin et ${source.methodCount ?? 0} methodes masquees par ADMIN_MODE`
        : "corriger immediatement les routes admin avant toute action sensible",
      blockers: source?.failures ?? ["audit routes API admin manquant"],
      sourceFile: source?.files?.jsonPath ?? "",
      allowedAction: "audit lecture seule et correction du garde ADMIN_MODE si besoin",
      forbiddenActions: [
        "lire payload admin sans ADMIN_MODE",
        "appeler OpenAI sans ADMIN_MODE",
        "muter catalogue ou commande sans ADMIN_MODE",
      ],
    },
  ];
}

function adminPageGuardActions(source) {
  return [
    {
      lane: "garde_fous",
      urgency: 897.56,
      id: "admin_page_guards",
      label: "Pages admin",
      status: source?.ok ? "OK_ADMIN_PAGE_GUARDS_ACTIVE" : "ADMIN_PAGE_GUARD_FAILURE",
      nextAction: source?.ok
        ? `${source.pageCount ?? 0} pages admin protegees par ADMIN_MODE avant lecture/rendu sensible`
        : "corriger immediatement les pages admin avant toute exposition de pilotage",
      blockers: source?.failures ?? ["audit pages admin manquant"],
      sourceFile: source?.files?.jsonPath ?? "",
      allowedAction: "audit lecture seule et correction des gardes de page admin si besoin",
      forbiddenActions: [
        "rendre formulaire admin sans ADMIN_MODE",
        "lire fichiers pilotage sans ADMIN_MODE",
        "exposer commandes ou messages sans ADMIN_MODE",
      ],
    },
  ];
}

function stripeWebhookStockGuardActions(source) {
  return [
    {
      lane: "garde_fous",
      urgency: 897.57,
      id: "stripe_webhook_stock_guards",
      label: "Webhook Stripe stock",
      status: source?.ok ? "OK_STRIPE_WEBHOOK_STOCK_GUARDS_ACTIVE" : "STRIPE_WEBHOOK_STOCK_GUARD_FAILURE",
      nextAction: source?.ok
        ? `${source.checkCount ?? 0} controles actifs; aucune action paiement reelle, aucun stock hors webhook signe`
        : "corriger avant toute evolution checkout ou stock, sans action paiement reelle",
      blockers: source?.ok ? [] : failureLabels(source?.failures, "audit webhook stock manquant"),
      sourceFile: source?.files?.jsonPath ?? "",
      allowedAction: "audit lecture seule et correction de garde-fous; aucune action paiement ni fournisseur",
      forbiddenActions: [
        "creer paiement reel",
        "declencher commande fournisseur",
        "modifier cle ou valeur sensible",
        "deployer",
      ],
    },
  ];
}

function dropshippingOrderAdminSafetyActions(source) {
  return [
    {
      lane: "garde_fous",
      urgency: 897.58,
      id: "dropshipping_order_admin_safety",
      label: "Admin commandes dropshipping",
      status: source?.ok ? "OK_ORDER_ADMIN_SUPPLIER_ACTIONS_GUARDED" : "ORDER_ADMIN_SUPPLIER_ACTION_GUARD_FAILURE",
      nextAction: source?.ok
        ? `${source.checkCount ?? 0} controles admin actifs; aucune suite fournisseur sans paiement confirme et stock valide`
        : "corriger avant toute operation commande, sans action fournisseur",
      blockers: source?.ok ? [] : failureLabels(source?.failures, "audit admin commandes manquant"),
      sourceFile: source?.files?.jsonPath ?? "",
      allowedAction: "audit lecture seule et correction des blocages admin; aucune action fournisseur",
      forbiddenActions: [
        "commander fournisseur",
        "envoyer message client",
        "forcer suivi colis",
        "bypasser stock webhook",
      ],
    },
  ];
}

function orderOperationsBoardActions(source) {
  return [
    {
      lane: "operations_commandes",
      urgency: 620,
      id: "dropshipping_order_operations_board",
      label: "Operations commandes dropshipping",
      status: source?.ok ? "OK_ORDER_OPERATIONS_BOARD_READY" : "ORDER_OPERATIONS_BOARD_FAILURE",
      nextAction: source?.ok
        ? `${source.counts?.stockExceptions ?? 0} stock a reprendre, ${source.counts?.readySupplierPrep ?? 0} pretes validation humaine, ${source.counts?.waitTracking ?? 0} suivis attendus`
        : "regenerer le board commandes lecture seule avant toute operation",
      blockers: source?.selfTestFailures ?? ["board operations commandes manquant"],
      sourceFile: source?.source ?? "",
      allowedAction: "tri interne lecture seule et validation humaine avant toute suite",
      forbiddenActions: [
        "commander fournisseur",
        "payer",
        "exporter adresse client",
        "afficher URL fournisseur",
      ],
    },
  ];
}

function orderOperationsFixturesActions(source) {
  const scenarioFailureCount =
    source?.scenarioFailureCount ?? source?.scenarios?.filter((scenario) => !scenario.ok).length ?? 0;

  return [
    {
      lane: "garde_fous",
      urgency: 897.59,
      id: "dropshipping_order_operations_fixtures",
      label: "Fixtures operations commandes",
      status: source?.ok ? "OK_ORDER_OPERATIONS_FIXTURES_PASS" : "ORDER_OPERATIONS_FIXTURE_FAILURE",
      nextAction: source?.ok
        ? `${scenarioFailureCount} echec scenario; preuves manquantes et exports sensibles restent controles`
        : "corriger les scenarios fixture avant toute evolution operations commandes",
      blockers: source?.scenarios?.filter((scenario) => !scenario.ok).map((scenario) => scenario.name) ?? [
        "fixtures operations commandes manquantes",
      ],
      sourceFile: source?.source ?? "",
      allowedAction: "relancer les tests fixtures lecture seule sans commandes reelles",
      forbiddenActions: [
        "lire commandes reelles depuis les fixtures",
        "commander fournisseur",
        "publier",
        "envoyer message client",
      ],
    },
  ];
}

function pilotageOrderOperationsActions(source) {
  return [
    {
      lane: "garde_fous",
      urgency: 897.61,
      id: "pilotage_order_operations",
      label: "Pilotage operations commandes",
      status: source?.ok ? "OK_PILOTAGE_ORDER_OPERATIONS_GUARDED" : "PILOTAGE_ORDER_OPERATIONS_FAILURE",
      nextAction: source?.ok
        ? `${source.pageChecks?.length ?? 0} controles page OK; board operations charge derriere ADMIN_MODE`
        : "corriger la page pilotage avant toute lecture operations commandes",
      blockers: source?.ok ? [] : failureLabels(source?.failures, "audit pilotage operations manquant"),
      sourceFile: source?.board?.path ?? "",
      allowedAction: "audit lecture seule et correction du panneau admin protege",
      forbiddenActions: [
        "exposer commandes hors ADMIN_MODE",
        "exporter adresse client",
        "afficher URL fournisseur",
        "envoyer message client",
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
    `- Coherence pipeline images publiques: ${summary.metrics.publicImagePipelineCoherenceStatus}, ${summary.metrics.publicImagePipelineCoherenceItemCount} fiches, ${summary.metrics.publicImagePipelineCoherenceFormRowCount} lignes, ${summary.metrics.publicImagePipelineCoherenceFailureCount} echec`,
    `- Sprint top 3 sourcing integration: ${summary.metrics.integrationTop3SourcingStatus}, ${summary.metrics.integrationTop3SourcingProductCount} produits, ${summary.metrics.integrationTop3SourcingMissingFieldCount} preuves, ${summary.metrics.integrationTop3SourcingExpectedImageCount} WebP`,
    `- Audit sprint top 3 sourcing: ${summary.metrics.integrationTop3SourcingAuditStatus}, ${summary.metrics.integrationTop3SourcingAuditFailureCount} echec, ${summary.metrics.integrationTop3SourcingAuditSensitiveFindingCount} fuite sur ${summary.metrics.integrationTop3SourcingAuditScannedFileCount} fichiers`,
    `- Pack parallele top 3 preuves: ${summary.metrics.integrationTop3ParallelProofsAuditStatus}, ${summary.metrics.integrationTop3ParallelProofsProductCount} produits, ${summary.metrics.integrationTop3ParallelProofsProofCount} preuves, ${summary.metrics.integrationTop3ParallelProofsAuditFailureCount} echec`,
    `- Pack WebP top 3: ${summary.metrics.integrationTop3WebpAuditStatus}, ${summary.metrics.integrationTop3WebpProductCount} produits, ${summary.metrics.integrationTop3WebpImageTaskCount} WebP, ${summary.metrics.integrationTop3WebpAuditFailureCount} echec`,
    `- Depots WebP top 3: ${summary.metrics.integrationTop3WebpDepotAuditStatus}, ${summary.metrics.integrationTop3WebpDepotReadyImageCount}/${summary.metrics.integrationTop3WebpDepotImageTaskCount} valides, ${summary.metrics.integrationTop3WebpDepotMissingCount} manquants, ${summary.metrics.integrationTop3WebpDepotInvalidCount} invalides`,
    `- Pilotage sourcing integration: ${summary.metrics.integrationSourcingPriorityBoardAuditStatus}, ${summary.metrics.integrationSourcingPriorityBoardProductCount} produits, ${summary.metrics.integrationSourcingPriorityBoardMissingFieldCount} preuves, ${summary.metrics.integrationSourcingPriorityBoardExpectedImageCount} WebP attendus, ${summary.metrics.integrationSourcingPriorityBoardFailureCount} echec`,
    `- Preuves sourcing integration: ${summary.metrics.integrationNextProofCount} champs, ${summary.metrics.integrationNextProofHoldCount} HOLD, ${summary.metrics.integrationNextProofReadyCount} pretes revue, ${summary.metrics.integrationNextProofBusinessBlockerCount} blocages metier`,
    `- Audit artefacts generes: ${summary.metrics.generatedArtifactLeakFindingCount} fuite sur ${summary.metrics.generatedArtifactLeakScannedFileCount} fichiers`,
    `- Sources catalogue publiques: ${summary.metrics.publicCatalogSourceGuardStatus}, ${summary.metrics.publicCatalogSourceGuardFindingCount} contournement sur ${summary.metrics.publicCatalogSourceGuardWatchedFileCount} fichiers surveilles`,
    `- Surface visuelle publique: ${summary.metrics.publicVisualAmbiguityStatus}, ${summary.metrics.publicVisualAmbiguityFailureCount} ambiguite, ${summary.metrics.publicVisualAmbiguityStockFindingCount} image stock/CDN`,
    `- Garde publication admin: ${summary.metrics.adminPublicationGateStatus}, ${summary.metrics.adminPublicationGateRiskProductCount} produit rapide a risque`,
    `- UI publication admin: ${summary.metrics.adminPublicationUiGuardStatus}, ${summary.metrics.adminPublicationUiGuardFailureCount} echec UI`,
    `- Routes API admin: ${summary.metrics.adminApiGuardStatus}, ${summary.metrics.adminApiGuardRouteCount} routes, ${summary.metrics.adminApiGuardFailureCount} echec`,
    `- Pages admin: ${summary.metrics.adminPageGuardStatus}, ${summary.metrics.adminPageGuardPageCount} pages, ${summary.metrics.adminPageGuardFailureCount} echec`,
    `- Webhook Stripe stock: ${summary.metrics.stripeWebhookStockGuardStatus}, ${summary.metrics.stripeWebhookStockGuardCheckCount} controles, ${summary.metrics.stripeWebhookStockGuardFailureCount} echec`,
    `- Admin commandes dropshipping: ${summary.metrics.dropshippingOrderAdminSafetyStatus}, ${summary.metrics.dropshippingOrderAdminSafetyCheckCount} controles, ${summary.metrics.dropshippingOrderAdminSafetyFailureCount} echec`,
    `- Operations commandes: ${summary.metrics.orderOperationsBoardStatus}, ${summary.metrics.orderOperationsTotalOrders} commandes, ${summary.metrics.orderOperationsStockExceptions} stock a reprendre, ${summary.metrics.orderOperationsReadySupplierPrep} pretes validation humaine`,
    `- Fixtures operations commandes: ${summary.metrics.orderOperationsFixturesStatus}, ${summary.metrics.orderOperationsFixturesScenarioFailureCount} echec scenario`,
    `- Pilotage operations commandes: ${summary.metrics.pilotageOrderOperationsStatus}, ${summary.metrics.pilotageOrderOperationsFailureCount} echec`,
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
const adminApiGuardsPath = latestFileUnder(actionRoot, "AUDIT_ADMIN_API_GUARDS_");
const adminPageGuardsPath = latestFileUnder(actionRoot, "AUDIT_ADMIN_PAGE_GUARDS_");
const stripeWebhookStockGuardsPath = latestFileUnder(actionRoot, "AUDIT_STRIPE_WEBHOOK_STOCK_GUARDS_");
const dropshippingOrderAdminSafetyPath = latestFileUnder(actionRoot, "AUDIT_DROPSHIPPING_ORDER_ADMIN_SAFETY_");
const orderOperationsBoardPath = latestFileUnder(actionRoot, "DROPSHIPPING_ORDER_OPERATIONS_BOARD_");
const orderOperationsFixturesPath = latestFileUnder(actionRoot, "TEST_DROPSHIPPING_ORDER_OPERATIONS_FIXTURES_");
const pilotageOrderOperationsPath = latestFileUnder(actionRoot, "AUDIT_PILOTAGE_ORDER_OPERATIONS_");
const checkoutPath = latestFileUnder(supplierRoot, "AUDIT_CHECKOUT_ELIGIBILITY_");
const partnerGatesPath = latestFileUnder(supplierRoot, "AUDIT_ALL_PARTNER_GATES_");
const surprisePath = latestFileUnder(supplierRoot, "AUDIT_SURPRISES_NON_VENDABLES_");
const publicSurfacePath = latestFileUnder(actionRoot, "AUDIT_SURFACE_PUBLIQUE_DROPSHIPPING_");
const publicImageOperatorPath = latestFileUnder(actionRoot, "PACK_OPERATEUR_DEPOT_IMAGES_PUBLIQUES_");
const publicImageMoussReviewPath = latestFileUnder(actionRoot, "BOARD_MOUSS_IMAGES_PUBLIQUES_");
const publicImageTextProofFormPath = latestFileUnder(actionRoot, "FORMULAIRE_PREUVES_TEXTE_IMAGES_PUBLIQUES_");
const publicImageCopyGatePath = latestFileUnder(actionRoot, "GATE_COPIE_IMAGES_PUBLIQUES_");
const publicImagePipelineCoherencePath = latestFileUnder(actionRoot, "AUDIT_COHERENCE_PIPELINE_IMAGES_PUBLIQUES_");
const artifactLeakAuditPath = latestFileUnder(actionRoot, "AUDIT_ARTEFACTS_GENERES_SENSIBLES_");
const publicCatalogSourceGuardsPath = latestFileUnder(actionRoot, "audit-public-catalog-source-guards");
const publicVisualAmbiguityPath = latestFileUnder(actionRoot, "AUDIT_SURFACE_VISUELLE_PUBLIQUE_");
const integrationSourcingPriorityBoardAuditPath = latestFileUnder(actionRoot, "AUDIT_PILOTAGE_SOURCING_INTEGRATION_");
const integrationTop3SourcingPath = latestFileUnder(actionRoot, "TOP3_SOURCING_INTEGRATION_");
const integrationTop3SourcingAuditPath = latestFileUnder(actionRoot, "AUDIT_TOP3_SOURCING_INTEGRATION_");
const integrationTop3ParallelProofsPath = latestFileUnder(actionRoot, "TOP3_PREUVES_PARALLELES_SOURCING_INTEGRATION_");
const integrationTop3ParallelProofsAuditPath = latestFileUnder(
  actionRoot,
  "AUDIT_TOP3_PREUVES_PARALLELES_SOURCING_INTEGRATION_",
);
const integrationTop3WebpPath = latestFileUnder(actionRoot, "TOP3_WEBP_SOURCING_INTEGRATION_");
const integrationTop3WebpAuditPath = latestFileUnder(actionRoot, "AUDIT_TOP3_WEBP_SOURCING_INTEGRATION_");
const integrationTop3WebpDepotFilesAuditPath = latestFileUnder(
  actionRoot,
  "AUDIT_TOP3_WEBP_DEPOT_FILES_SOURCING_INTEGRATION_",
);
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
const adminApiGuards = readJsonIfExists(adminApiGuardsPath);
const adminPageGuards = readJsonIfExists(adminPageGuardsPath);
const stripeWebhookStockGuards = readJsonIfExists(stripeWebhookStockGuardsPath);
const dropshippingOrderAdminSafety = readJsonIfExists(dropshippingOrderAdminSafetyPath);
const orderOperationsBoard = readJsonIfExists(orderOperationsBoardPath);
const orderOperationsFixtures = readJsonIfExists(orderOperationsFixturesPath);
const pilotageOrderOperations = readJsonIfExists(pilotageOrderOperationsPath);
const checkout = readJsonIfExists(checkoutPath);
const partnerGates = readJsonIfExists(partnerGatesPath);
const surprise = readJsonIfExists(surprisePath);
const publicSurface = readJsonIfExists(publicSurfacePath);
const publicImageOperator = readJsonIfExists(publicImageOperatorPath);
const publicImageMoussReview = readJsonIfExists(publicImageMoussReviewPath);
const publicImageTextProofForm = readJsonIfExists(publicImageTextProofFormPath);
const publicImageCopyGate = readJsonIfExists(publicImageCopyGatePath);
const publicImagePipelineCoherence = readJsonIfExists(publicImagePipelineCoherencePath);
const artifactLeakAudit = readJsonIfExists(artifactLeakAuditPath);
const publicCatalogSourceGuards = readJsonIfExists(publicCatalogSourceGuardsPath);
const publicVisualAmbiguity = readJsonIfExists(publicVisualAmbiguityPath);
const integrationSourcingPriorityBoardAudit = readJsonIfExists(integrationSourcingPriorityBoardAuditPath);
const integrationTop3Sourcing = readJsonIfExists(integrationTop3SourcingPath);
const integrationTop3SourcingAudit = readJsonIfExists(integrationTop3SourcingAuditPath);
const integrationTop3ParallelProofs = readJsonIfExists(integrationTop3ParallelProofsPath);
const integrationTop3ParallelProofsAudit = readJsonIfExists(integrationTop3ParallelProofsAuditPath);
const integrationTop3Webp = readJsonIfExists(integrationTop3WebpPath);
const integrationTop3WebpAudit = readJsonIfExists(integrationTop3WebpAuditPath);
const integrationTop3WebpDepotFilesAudit = readJsonIfExists(integrationTop3WebpDepotFilesAuditPath);
const integrationNextProofs = readJsonIfExists(integrationNextProofsPath);
const integrationNextProofsAudit = readJsonIfExists(integrationNextProofsAuditPath);

const actions = [
  ...cockpitActions(cockpits),
  ...publicImageOperatorActions(publicImageOperator),
  ...publicImageMoussReviewActions(publicImageMoussReview),
  ...publicImageTextProofFormActions(publicImageTextProofForm),
  ...fieldKitAuditActions(fieldKitAudit),
  ...integrationTop3SourcingActions(integrationTop3Sourcing),
  ...integrationTop3SourcingAuditActions(integrationTop3SourcingAudit),
  ...integrationTop3ParallelProofsActions(integrationTop3ParallelProofs, integrationTop3ParallelProofsAudit),
  ...integrationTop3WebpActions(integrationTop3Webp, integrationTop3WebpAudit),
  ...integrationTop3WebpDepotFilesActions(integrationTop3WebpDepotFilesAudit),
  ...integrationNextProofActions(integrationNextProofs),
  ...integrationSourcingPriorityBoardAuditActions(integrationSourcingPriorityBoardAudit),
  ...integrationNextProofAuditActions(integrationNextProofsAudit),
  ...businessActions(business),
  ...categoryImageActions(categoryIntake),
  ...productPhotoActions(photoDrop),
  ...publicImagePipelineCoherenceActions(publicImagePipelineCoherence),
  ...publicImageCopyGateActions(publicImageCopyGate),
  ...generatedArtifactLeakActions(artifactLeakAudit),
  ...publicVisualAmbiguityActions(publicVisualAmbiguity),
  ...publicCatalogSourceGuardActions(publicCatalogSourceGuards),
  ...adminPublicationGateActions(adminPublicationGate),
  ...adminPublicationUiGuardActions(adminPublicationUiGuard),
  ...adminApiGuardActions(adminApiGuards),
  ...adminPageGuardActions(adminPageGuards),
  ...stripeWebhookStockGuardActions(stripeWebhookStockGuards),
  ...dropshippingOrderAdminSafetyActions(dropshippingOrderAdminSafety),
  ...orderOperationsBoardActions(orderOperationsBoard),
  ...orderOperationsFixturesActions(orderOperationsFixtures),
  ...pilotageOrderOperationsActions(pilotageOrderOperations),
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
    publicImagePipelineCoherenceStatus: publicImagePipelineCoherence?.ok
      ? "OK_PUBLIC_IMAGE_PIPELINE_COHERENT"
      : "absent_or_failure",
    publicImagePipelineCoherenceItemCount: publicImagePipelineCoherence?.itemCount ?? 0,
    publicImagePipelineCoherenceFormRowCount: publicImagePipelineCoherence?.formRowCount ?? 0,
    publicImagePipelineCoherenceFailureCount: publicImagePipelineCoherence?.failureCount ?? 0,
    publicImagePipelineCoherenceScannedFileCount: publicImagePipelineCoherence?.scannedFileCount ?? 0,
    generatedArtifactLeakFindingCount: artifactLeakAudit?.findingCount ?? 0,
    generatedArtifactLeakScannedFileCount: artifactLeakAudit?.scannedFileCount ?? 0,
    generatedArtifactLeakScannedDirectoryCount: artifactLeakAudit?.scannedDirectoryCount ?? 0,
    publicCatalogSourceGuardStatus: publicCatalogSourceGuards?.ok
      ? "OK_PUBLIC_CATALOG_SOURCE_GUARDS"
      : "absent_or_failure",
    publicCatalogSourceGuardFindingCount: publicCatalogSourceGuards?.findingCount ?? 0,
    publicCatalogSourceGuardClientFileCount: publicCatalogSourceGuards?.publicClientFileCount ?? 0,
    publicCatalogSourceGuardRouteFileCount: publicCatalogSourceGuards?.publicRouteFileCount ?? 0,
    publicCatalogSourceGuardWatchedFileCount:
      (publicCatalogSourceGuards?.publicClientFileCount ?? 0) + (publicCatalogSourceGuards?.publicRouteFileCount ?? 0),
    publicVisualAmbiguityStatus: publicVisualAmbiguity?.ok
      ? "OK_PUBLIC_VISUAL_SURFACE_SAFE"
      : "absent_or_failure",
    publicVisualAmbiguityFailureCount: publicVisualAmbiguity?.failureCount ?? 0,
    publicVisualAmbiguityStockFindingCount: publicVisualAmbiguity?.stockVisualFindingCount ?? 0,
    publicVisualAmbiguityCheckedSourceCount: publicVisualAmbiguity?.checkedSourceCount ?? 0,
    publicVisualAmbiguityHeroGuardOk: publicVisualAmbiguity?.heroGuardOk ?? false,
    publicVisualAmbiguityProductCardAirbagOk: publicVisualAmbiguity?.productCardAirbagOk ?? false,
    publicVisualAmbiguityProductDetailImageGuardOk:
      publicVisualAmbiguity?.productDetailImageGuardOk ?? false,
    integrationTop3SourcingStatus: integrationTop3Sourcing?.status ?? "absent",
    integrationTop3SourcingProductCount: integrationTop3Sourcing?.productCount ?? 0,
    integrationTop3SourcingMissingFieldCount: integrationTop3Sourcing?.totalMissingFieldCount ?? 0,
    integrationTop3SourcingExpectedImageCount: integrationTop3Sourcing?.expectedImageCount ?? 0,
    integrationTop3SourcingAuditStatus: integrationTop3SourcingAudit?.status ?? "absent",
    integrationTop3SourcingAuditFailureCount: integrationTop3SourcingAudit?.failureCount ?? 0,
    integrationTop3SourcingAuditSensitiveFindingCount: integrationTop3SourcingAudit?.sensitiveFindingCount ?? 0,
    integrationTop3SourcingAuditScannedFileCount: integrationTop3SourcingAudit?.scannedFileCount ?? 0,
    integrationTop3ParallelProofsStatus: integrationTop3ParallelProofs?.status ?? "absent",
    integrationTop3ParallelProofsProductCount: integrationTop3ParallelProofs?.productCount ?? 0,
    integrationTop3ParallelProofsProofCount: integrationTop3ParallelProofs?.proofCount ?? 0,
    integrationTop3ParallelProofsAuditStatus: integrationTop3ParallelProofsAudit?.status ?? "absent",
    integrationTop3ParallelProofsAuditFailureCount: integrationTop3ParallelProofsAudit?.failureCount ?? 0,
    integrationTop3ParallelProofsAuditSensitiveFindingCount:
      integrationTop3ParallelProofsAudit?.sensitiveFindingCount ?? 0,
    integrationTop3WebpStatus: integrationTop3Webp?.status ?? "absent",
    integrationTop3WebpProductCount: integrationTop3Webp?.productCount ?? 0,
    integrationTop3WebpImageTaskCount: integrationTop3Webp?.imageTaskCount ?? 0,
    integrationTop3WebpAuditStatus: integrationTop3WebpAudit?.status ?? "absent",
    integrationTop3WebpAuditFailureCount: integrationTop3WebpAudit?.failureCount ?? 0,
    integrationTop3WebpAuditSensitiveFindingCount: integrationTop3WebpAudit?.sensitiveFindingCount ?? 0,
    integrationTop3WebpDepotAuditStatus: integrationTop3WebpDepotFilesAudit?.status ?? "absent",
    integrationTop3WebpDepotImageTaskCount: integrationTop3WebpDepotFilesAudit?.imageTaskCount ?? 0,
    integrationTop3WebpDepotReadyImageCount: integrationTop3WebpDepotFilesAudit?.readyImageCount ?? 0,
    integrationTop3WebpDepotMissingCount: integrationTop3WebpDepotFilesAudit?.missingCount ?? 0,
    integrationTop3WebpDepotInvalidCount: integrationTop3WebpDepotFilesAudit?.invalidImageCount ?? 0,
    integrationTop3WebpDepotFailureCount: integrationTop3WebpDepotFilesAudit?.failureCount ?? 0,
    integrationTop3WebpDepotSensitiveFindingCount: integrationTop3WebpDepotFilesAudit?.sensitiveFindingCount ?? 0,
    integrationNextProofCount: integrationNextProofs?.proofCount ?? 0,
    integrationSourcingPriorityBoardAuditStatus: integrationSourcingPriorityBoardAudit?.status ?? "absent",
    integrationSourcingPriorityBoardProductCount: integrationSourcingPriorityBoardAudit?.productCount ?? 0,
    integrationSourcingPriorityBoardMissingFieldCount:
      integrationSourcingPriorityBoardAudit?.totalMissingFieldCount ?? 0,
    integrationSourcingPriorityBoardExpectedImageCount: integrationSourcingPriorityBoardAudit?.expectedImageCount ?? 0,
    integrationSourcingPriorityBoardValidImageCount: integrationSourcingPriorityBoardAudit?.validImageCount ?? 0,
    integrationSourcingPriorityBoardFailureCount: integrationSourcingPriorityBoardAudit?.failureCount ?? 0,
    integrationSourcingPriorityBoardSensitiveFindingCount:
      integrationSourcingPriorityBoardAudit?.sensitiveFindingCount ?? 0,
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
    adminApiGuardStatus: adminApiGuards?.ok ? "OK_ADMIN_API_GUARDS_ACTIVE" : "absent_or_failure",
    adminApiGuardRouteCount: adminApiGuards?.routeCount ?? 0,
    adminApiGuardMethodCount: adminApiGuards?.methodCount ?? 0,
    adminApiGuardFailureCount: adminApiGuards?.failureCount ?? 0,
    adminPageGuardStatus: adminPageGuards?.ok ? "OK_ADMIN_PAGE_GUARDS_ACTIVE" : "absent_or_failure",
    adminPageGuardPageCount: adminPageGuards?.pageCount ?? 0,
    adminPageGuardFailureCount: adminPageGuards?.failureCount ?? 0,
    stripeWebhookStockGuardStatus: stripeWebhookStockGuards?.ok
      ? "OK_STRIPE_WEBHOOK_STOCK_GUARDS_ACTIVE"
      : "absent_or_failure",
    stripeWebhookStockGuardCheckCount: stripeWebhookStockGuards?.checkCount ?? 0,
    stripeWebhookStockGuardFailureCount: stripeWebhookStockGuards?.failureCount ?? 0,
    dropshippingOrderAdminSafetyStatus: dropshippingOrderAdminSafety?.ok
      ? "OK_ORDER_ADMIN_SUPPLIER_ACTIONS_GUARDED"
      : "absent_or_failure",
    dropshippingOrderAdminSafetyCheckCount: dropshippingOrderAdminSafety?.checkCount ?? 0,
    dropshippingOrderAdminSafetyFailureCount: dropshippingOrderAdminSafety?.failureCount ?? 0,
    dropshippingOrderAdminSafetyDisabledGuardedControlCount:
      dropshippingOrderAdminSafety?.disabledGuardedControlCount ?? 0,
    orderOperationsBoardStatus: orderOperationsBoard?.ok ? "OK_ORDER_OPERATIONS_BOARD_READY" : "absent_or_failure",
    orderOperationsTotalOrders: orderOperationsBoard?.counts?.totalOrders ?? 0,
    orderOperationsPaidOrders: orderOperationsBoard?.counts?.paidOrders ?? 0,
    orderOperationsStockDoneOrders: orderOperationsBoard?.counts?.stockDoneOrders ?? 0,
    orderOperationsStockExceptions: orderOperationsBoard?.counts?.stockExceptions ?? 0,
    orderOperationsReadySupplierPrep: orderOperationsBoard?.counts?.readySupplierPrep ?? 0,
    orderOperationsWaitPayment: orderOperationsBoard?.counts?.waitPayment ?? 0,
    orderOperationsWaitTracking: orderOperationsBoard?.counts?.waitTracking ?? 0,
    orderOperationsReadyFollowUp: orderOperationsBoard?.counts?.readyFollowUp ?? 0,
    orderOperationsSelfTestFailureCount:
      orderOperationsBoard?.selfTestFailureCount ?? orderOperationsBoard?.selfTestFailures?.length ?? 0,
    orderOperationsNoSupplierUrlsExported: orderOperationsBoard?.safety?.noSupplierUrlsExported ?? false,
    orderOperationsNoCustomerAddressExported: orderOperationsBoard?.safety?.noCustomerAddressExported ?? false,
    orderOperationsFixturesStatus: orderOperationsFixtures?.ok ? "OK_ORDER_OPERATIONS_FIXTURES_PASS" : "absent_or_failure",
    orderOperationsFixturesScenarioFailureCount:
      orderOperationsFixtures?.scenarioFailureCount ??
      orderOperationsFixtures?.scenarios?.filter((scenario) => !scenario.ok).length ??
      0,
    orderOperationsFixturesProofGapOk:
      orderOperationsFixtures?.proofGapOk ?? orderOperationsFixtures?.proofGapCheck?.ok ?? false,
    orderOperationsFixturesSensitiveExportOk:
      orderOperationsFixtures?.sensitiveExportOk ?? orderOperationsFixtures?.sensitiveExportCheck?.ok ?? false,
    pilotageOrderOperationsStatus: pilotageOrderOperations?.ok
      ? "OK_PILOTAGE_ORDER_OPERATIONS_GUARDED"
      : "absent_or_failure",
    pilotageOrderOperationsFailureCount: pilotageOrderOperations?.failureCount ?? 0,
    pilotageOrderOperationsPageCheckCount: pilotageOrderOperations?.pageChecks?.length ?? 0,
    pilotageOrderOperationsLatestBoardHasNoSupplierUrlLeak:
      pilotageOrderOperations?.safety?.latestBoardHasNoSupplierUrlLeak ?? false,
    pilotageOrderOperationsLatestBoardUsesSharedOperations:
      pilotageOrderOperations?.safety?.latestBoardUsesSharedOperations ?? false,
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
    adminApiGuardsPath: relativePath(adminApiGuardsPath),
    adminPageGuardsPath: relativePath(adminPageGuardsPath),
    stripeWebhookStockGuardsPath: relativePath(stripeWebhookStockGuardsPath),
    dropshippingOrderAdminSafetyPath: relativePath(dropshippingOrderAdminSafetyPath),
    orderOperationsBoardPath: relativePath(orderOperationsBoardPath),
    orderOperationsFixturesPath: relativePath(orderOperationsFixturesPath),
    pilotageOrderOperationsPath: relativePath(pilotageOrderOperationsPath),
    checkoutPath: relativePath(checkoutPath),
    partnerGatesPath: relativePath(partnerGatesPath),
    surprisePath: relativePath(surprisePath),
    publicSurfacePath: relativePath(publicSurfacePath),
    publicImageOperatorPath: relativePath(publicImageOperatorPath),
    publicImageMoussReviewPath: relativePath(publicImageMoussReviewPath),
    publicImageTextProofFormPath: relativePath(publicImageTextProofFormPath),
    publicImageCopyGatePath: relativePath(publicImageCopyGatePath),
    publicImagePipelineCoherencePath: relativePath(publicImagePipelineCoherencePath),
    artifactLeakAuditPath: relativePath(artifactLeakAuditPath),
    publicCatalogSourceGuardsPath: relativePath(publicCatalogSourceGuardsPath),
    publicVisualAmbiguityPath: relativePath(publicVisualAmbiguityPath),
    integrationSourcingPriorityBoardAuditPath: relativePath(integrationSourcingPriorityBoardAuditPath),
    integrationTop3SourcingPath: relativePath(integrationTop3SourcingPath),
    integrationTop3SourcingAuditPath: relativePath(integrationTop3SourcingAuditPath),
    integrationTop3ParallelProofsPath: relativePath(integrationTop3ParallelProofsPath),
    integrationTop3ParallelProofsAuditPath: relativePath(integrationTop3ParallelProofsAuditPath),
    integrationTop3WebpPath: relativePath(integrationTop3WebpPath),
    integrationTop3WebpAuditPath: relativePath(integrationTop3WebpAuditPath),
    integrationTop3WebpDepotFilesAuditPath: relativePath(integrationTop3WebpDepotFilesAuditPath),
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

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const formsRoot = path.join(
  root,
  "business-maxi-trouvailles",
  "file-validation-fournisseurs",
  "packs-validation-tous-partenaires",
);
const inputArg = process.argv.find((arg) => arg.startsWith("--input="));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

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

function isBlank(value) {
  return String(value ?? "").trim().length === 0;
}

function hasProof(value, minLength = 16) {
  return String(value ?? "").trim().length >= minLength;
}

function isPositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
}

function isAffirmative(value) {
  const text = normalizeText(value);
  return (
    value === true ||
    text.includes("oui") ||
    text.includes("yes") ||
    text.includes("true") ||
    text.includes("disponible") ||
    text.includes("available") ||
    text.includes("suivi")
  );
}

function exactUrlStatus(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return { ok: false, blocker: "url_fournisseur_absente" };
  }

  try {
    const url = new URL(raw);
    const normalized = normalizeText(`${url.hostname} ${url.pathname} ${url.search}`);

    if (!["http:", "https:"].includes(url.protocol)) {
      return { ok: false, blocker: "url_fournisseur_protocole_invalide" };
    }

    if (
      normalized.includes("wholesale") ||
      normalized.includes("searchtext") ||
      normalized.includes("search") ||
      normalized.includes("keyword")
    ) {
      return { ok: false, blocker: "url_fournisseur_est_une_recherche" };
    }

    return { ok: true };
  } catch {
    return { ok: false, blocker: "url_fournisseur_invalide" };
  }
}

function deliveryStatus(value) {
  const text = normalizeText(value);
  if (!text) {
    return { ok: false, blocker: "delai_client_absent" };
  }

  if (text.includes("verifier") || text.includes("confirmer") || text.includes("valider")) {
    return { ok: false, blocker: "delai_client_non_prouve" };
  }

  const numbers = [...text.matchAll(/\d+/g)].map((match) => Number(match[0]));
  if (numbers.length === 0) {
    return { ok: false, blocker: "delai_client_sans_nombre" };
  }

  const minDays = Math.min(...numbers);
  const maxDays = Math.max(...numbers);
  if (minDays < 2) {
    return { ok: false, blocker: "delai_client_trop_optimiste" };
  }

  if (maxDays > 14) {
    return { ok: false, blocker: "delai_client_trop_long" };
  }

  return { ok: true, minDays, maxDays };
}

function collectFiles(dir, predicate, out = []) {
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

function latestTemplateFile() {
  const matches = collectFiles(
    formsRoot,
    (name) => name.startsWith("A_REMPLIR_TEMPLATE_PREUVES_RAPIDES_") && name.endsWith(".json"),
  )
    .map((fullPath) => ({ fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (matches.length === 0) {
    throw new Error(`No A_REMPLIR_TEMPLATE_PREUVES_RAPIDES_*.json found under ${formsRoot}`);
  }

  return matches[0].fullPath;
}

function resolveInputFile() {
  if (!inputArg) {
    return latestTemplateFile();
  }

  const inputPath = path.resolve(root, inputArg.split("=")[1]);
  const stat = fs.statSync(inputPath);

  if (stat.isDirectory()) {
    const matches = fs
      .readdirSync(inputPath, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.startsWith("A_REMPLIR_TEMPLATE_PREUVES_RAPIDES_") &&
          entry.name.endsWith(".json"),
      )
      .map((entry) => {
        const fullPath = path.join(inputPath, entry.name);
        return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    if (matches.length === 0) {
      throw new Error(`No fast evidence template found in ${inputPath}`);
    }

    return matches[0].fullPath;
  }

  return inputPath;
}

function productBlockers(product) {
  const fill = product.fill ?? {};
  const blockers = [];
  const url = exactUrlStatus(fill.exactSupplierProductUrl);
  const delivery = deliveryStatus(fill.deliveryEstimateForCustomer);

  if (isBlank(fill.checkedAt)) blockers.push("date_verification_absente");
  if (normalizeText(fill.decision) !== "continue validation") blockers.push("decision_invalide");
  if (!url.ok) blockers.push(url.blocker);
  if (isBlank(fill.supplierSellerName)) blockers.push("nom_vendeur_fournisseur_absent");
  if (isBlank(fill.supplierSku)) blockers.push("sku_fournisseur_absent");
  if (isBlank(fill.exactVariantChosen)) blockers.push("variante_exacte_absente");
  if (!isPositiveInteger(fill.supplierPriceCents)) blockers.push("prix_fournisseur_invalide");
  if (!isPositiveInteger(fill.supplierStock)) blockers.push("stock_fournisseur_invalide");
  if (!delivery.ok) blockers.push(delivery.blocker);
  if (!isAffirmative(fill.trackingAvailable)) blockers.push("tracking_non_confirme");
  if (!hasProof(fill.deliveryFranceEuropeProof)) blockers.push("preuve_delai_france_europe_absente");
  if (!hasProof(fill.pricingProof)) blockers.push("preuve_prix_absente");
  if (!hasProof(fill.shippingProof)) blockers.push("preuve_livraison_absente");
  if (!hasProof(fill.imageProof)) blockers.push("preuve_image_exacte_absente");
  if (!hasProof(fill.imageRightsProof)) blockers.push("preuve_droits_images_absente");
  if (normalizeText(fill.finalDecision) !== "ready review") {
    blockers.push("decision_finale_pas_ready_review");
  }
  if (fill.reviewedByMouss !== true) blockers.push("revue_mouss_absente");

  return [...new Set(blockers)];
}

function auditProduct(product) {
  const blockers = productBlockers(product);
  return {
    id: product.id,
    name: product.name,
    priority: product.priority,
    status: blockers.length === 0 ? "ready_review_hold" : "HOLD_MISSING_EVIDENCE",
    blockerCount: blockers.length,
    blockers,
    publicationAllowed: false,
    supplierOrderAllowed: false,
    paymentAllowed: false,
  };
}

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function csv(items) {
  const headers = ["priority", "status", "name", "blockerCount", "blockers"];
  return `${headers.join(",")}\n${items
    .map((item) => headers.map((header) => csvEscape(item[header])).join(","))
    .join("\n")}\n`;
}

function markdown(summary) {
  const blockerLines = Object.entries(summary.byBlocker)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
    .map(([blocker, count]) => `- ${blocker}: ${count}`);
  const rows = summary.products.map(
    (product) =>
      `| ${product.priority} | ${product.status} | ${product.name} | ${product.blockerCount} | ${product.blockers.join(", ")} |`,
  );

  return `${[
    "# Audit formulaires preuves rapides",
    "",
    `Date locale: ${summary.checkedAtLocal}`,
    "",
    "## Synthese",
    "",
    `- Formulaires analyses: ${summary.productCount}`,
    `- Prets revue humaine: ${summary.readyReviewCount}`,
    `- Bloques: ${summary.holdCount}`,
    "",
    "## Bloquants",
    "",
    ...(blockerLines.length ? blockerLines : ["- Aucun"]),
    "",
    "## Produits",
    "",
    "| Priorite | Statut | Produit | Bloquants | Details |",
    "|---:|---|---|---:|---|",
    ...rows,
    "",
    "## Regles",
    "",
    "- Audit en lecture seule.",
    "- `ready_review_hold` ne publie rien: cela veut seulement dire que Mouss peut relire le dossier.",
    "- Paiement, commande fournisseur et publication restent interdits sans validation explicite.",
    "",
  ].join("\n")}\n`;
}

const inputPath = resolveInputFile();
const payload = readJson(inputPath);
const products = Array.isArray(payload.products) ? payload.products.map(auditProduct) : [];

if (products.length === 0) {
  throw new Error("Fast evidence template must contain a non-empty products array.");
}

const { dateKey, localLabel } = datePartsParis();
const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  checkedAtLocal: localLabel,
  mode: "read_only_fast_partner_evidence_audit",
  inputPath,
  productCount: products.length,
  readyReviewCount: products.filter((product) => product.status === "ready_review_hold").length,
  holdCount: products.filter((product) => product.status === "HOLD_MISSING_EVIDENCE").length,
  byStatus: countBy(products, (product) => product.status),
  byBlocker: countBy(products.flatMap((product) => product.blockers), (blocker) => blocker),
  products,
  safety: {
    readOnly: true,
    noCatalogWrite: true,
    noPublication: true,
    noPayment: true,
    noSupplierOrder: true,
  },
};

const outputDir = path.dirname(inputPath);
const jsonPath = path.join(outputDir, `AUDIT_FORMULAIRES_PREUVES_RAPIDES_${dateKey}.json`);
const mdPath = path.join(outputDir, `AUDIT_FORMULAIRES_PREUVES_RAPIDES_${dateKey}.md`);
const csvPath = path.join(outputDir, `AUDIT_FORMULAIRES_PREUVES_RAPIDES_${dateKey}.csv`);

fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(mdPath, markdown(summary), "utf8");
fs.writeFileSync(csvPath, csv(products), "utf8");

console.log(
  JSON.stringify(
    {
      ok: summary.ok,
      mode: summary.mode,
      productCount: summary.productCount,
      readyReviewCount: summary.readyReviewCount,
      holdCount: summary.holdCount,
      byStatus: summary.byStatus,
      topBlockers: Object.entries(summary.byBlocker)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([blocker, count]) => ({ blocker, count })),
      files: { jsonPath, mdPath, csvPath },
      safety: summary.safety,
    },
    null,
    2,
  ),
);

#!/usr/bin/env node
/**
 * GARDE-FOU — fuite de donnees internes dans les pages publiques.
 *
 * Ce que ce script empeche de revenir :
 *
 * Les pages publiques passaient l'objet produit COMPLET a des composants
 * "use client". Next.js serialise alors tout l'objet dans la charge utile RSC
 * de la page (<script>self.__next_f.push(...)</script>). Resultat : le prix
 * d'achat reel (dropshipping.supplierPriceCents), la marge (marginCents), le
 * lien et la reference AliExpress (supplierUrl / supplierSku), le stock
 * fournisseur et toutes les notes de validation interne etaient LISIBLES par
 * n'importe quel visiteur dans le code source de la page — sans rien afficher
 * a l'ecran.
 *
 * Le colmatage se fait dans src/lib/public-product.ts (liste blanche des champs
 * autorises a sortir). Ce script verifie que le colmatage tient :
 *
 *   1. Controles STATIQUES (aucun serveur necessaire) : la liste blanche existe
 *      toujours, elle n'a pas ete remplacee par une recopie complete
 *      ({ ...product }), et aucun composant public ne lit de champ sensible.
 *   2. Controles EN LIGNE : telechargement des pages publiques, puis recherche
 *      des champs sensibles dans la reponse brute (HTML + charge utile RSC).
 *
 * Utilisation :
 *   npm run catalog:audit-public-payload-leaks              (site local)
 *   npm run catalog:audit-public-payload-leaks -- --base=https://maxitrouvaille.fr
 *   npm run catalog:audit-public-payload-leaks -- --offline (controles de code seuls)
 *
 * Sortie : 0 si tout est propre, 1 des qu'un champ sensible est trouve.
 * Le script est en LECTURE SEULE : il n'ecrit ni le catalogue, ni les images,
 * ni aucun fichier du site.
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

const baseUrl = String(
  readArg("base", process.env.PUBLIC_AUDIT_BASE_URL ?? "http://localhost:3000"),
).replace(/\/$/, "");
const offline = args.includes("--offline");
const timeoutMs = Number(readArg("timeout", "20000")) || 20000;

/**
 * Pages publiques a controler. Ce sont toutes les surfaces qui affichent des
 * listes de produits, plus le panier et le paiement (ou le client est le plus
 * attentif au prix) et la fiche produit.
 */
const publicPaths = [
  "/",
  "/boutique",
  "/produits-partenaires",
  "/nouveautes",
  "/promotions",
  "/categories",
  "/categories/cuisine-partenaires",
  "/categories/maison-partenaires",
  "/panier",
  "/paiement",
  "/api/cart/eligible-items",
];

/**
 * GROUPE A — noms de champs internes et identifiants techniques.
 *
 * Aucun d'eux n'a la moindre raison d'apparaitre dans une page publique : leur
 * simple presence signifie qu'un objet produit brut est reparti au navigateur.
 */
const forbiddenFieldNames = [
  "supplierpricecents",
  "suppliersku",
  "supplierurl",
  "supplierstock",
  "suppliername",
  "margincents",
  "salepricecents",
  "markuppercent",
  "pricingrule",
  "pricingupdatedat",
  "internalsourcing",
  "sourceverification",
  "imagevalidation",
  "validationgate",
  "sourcepricerange",
  "sourcesignal",
  "evidenceurl",
  "evidencenote",
  "findnichedetailurl",
  "imageholdreasons",
  "istestproduct",
  "syncstatus",
  "lastsyncat",
  "pricereferenceurl",
  "excludedimagenote",
];

/** GROUPE B — identite du fournisseur et outils de sourcing. */
const forbiddenSupplierSignals = [
  "aliexpress",
  "alicdn",
  "ae-pic",
  "findniche",
  "ae-1005",
  "1688.com",
  "temu.com",
];

/** GROUPE C — phrases de coulisses reperees dans les notes internes. */
const forbiddenPhrases = [
  "fournisseur aliexpress",
  "prix de vente et marge",
  "marge cible",
  "prix d'achat",
  "prix fournisseur",
  "panier impulsif",
  "annonce aliexpress publique",
];

const findings = [];

function addFinding(scope, target, reason, detail) {
  findings.push({ scope, target, reason, detail });
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function readSource(relativePath) {
  const absolutePath = path.join(root, relativePath);
  return fs.existsSync(absolutePath)
    ? fs.readFileSync(absolutePath, "utf8")
    : null;
}

// ---------------------------------------------------------------------------
// 1. Controles statiques : la liste blanche est-elle toujours en place ?
// ---------------------------------------------------------------------------

const whitelistPath = "src/lib/public-product.ts";
const catalogServerPath = "src/lib/catalog-server.ts";
const catalogClientPath = "src/lib/catalog-client.ts";

/**
 * Composants et pages qui envoient des produits au navigateur. Aucun ne doit
 * mentionner un champ sensible : s'il en lit un, c'est qu'il en recoit un.
 */
const publicSurfaceFiles = [
  "src/components/ProductCard.tsx",
  "src/components/ProductShelf.tsx",
  "src/components/ShopProductExplorer.tsx",
  "src/components/CartView.tsx",
  "src/components/CheckoutView.tsx",
  "src/components/ProductReviewForm.tsx",
  "src/components/useShippingSelection.ts",
  "src/lib/catalog-client.ts",
  "src/app/boutique/page.tsx",
  "src/app/panier/page.tsx",
  "src/app/paiement/page.tsx",
  "src/app/produits-partenaires/page.tsx",
  "src/app/page.tsx",
  "src/app/categories/[slug]/page.tsx",
  "src/app/avis/laisser/page.tsx",
  "src/components/PartnerCampaignLanding.tsx",
];

const whitelistSource = readSource(whitelistPath);

if (!whitelistSource) {
  addFinding(
    "static",
    whitelistPath,
    "whitelist_missing",
    "La liste blanche de sortie a disparu : toute la fiche produit repartirait au navigateur.",
  );
} else {
  const whitelistCode = whitelistSource
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");

  if (!whitelistSource.includes("export function toPublicProduct(")) {
    addFinding(
      "static",
      whitelistPath,
      "to_public_product_missing",
      "toPublicProduct() est introuvable.",
    );
  }

  // Le piege d'origine : une recopie complete de l'objet. sanitizeQuickProducts
  // fait deja `{ ...maybeProduct }` cote catalogue ; si la liste blanche s'y
  // remet, tout nouveau champ ajoute au JSON repartirait automatiquement.
  if (/\.\.\.\s*(product|maybeProduct|raw|source)\s*[,}]/.test(whitelistCode)) {
    addFinding(
      "static",
      whitelistPath,
      "spread_forbidden_in_whitelist",
      "La liste blanche recopie l'objet produit entier ({ ...product }) : ce n'est plus une liste blanche.",
    );
  }

  // Les noms de champs sont cites dans les commentaires d'explication du
  // fichier : on ne controle donc que le CODE, commentaires retires.
  const whitelistCodeText = normalize(whitelistCode);

  for (const fieldName of forbiddenFieldNames) {
    if (whitelistCodeText.includes(fieldName)) {
      addFinding(
        "static",
        whitelistPath,
        "sensitive_field_in_whitelist",
        `Le champ "${fieldName}" est recopie par la liste blanche.`,
      );
    }
  }
}

const catalogServerSource = readSource(catalogServerPath);

if (!catalogServerSource) {
  addFinding("static", catalogServerPath, "file_missing", "Fichier introuvable.");
} else {
  if (!catalogServerSource.includes("toPublicProduct")) {
    addFinding(
      "static",
      catalogServerPath,
      "public_products_not_filtered",
      "getPublicProducts() ne passe plus par la liste blanche toPublicProduct().",
    );
  }

  if (/export\s+async\s+function\s+getPublicSourceProducts/.test(catalogServerSource)) {
    addFinding(
      "static",
      catalogServerPath,
      "raw_public_products_exported",
      "getPublicSourceProducts() (fiches completes) est exporte : il pourrait etre passe a une page.",
    );
  }
}

const catalogClientSource = readSource(catalogClientPath);

if (
  catalogClientSource &&
  /^\s*import\s+(?!type)/m.test(catalogClientSource)
) {
  addFinding(
    "static",
    catalogClientPath,
    "runtime_import_in_client_helpers",
    "catalog-client.ts ne doit contenir que des imports de type.",
  );
}

for (const relativePath of publicSurfaceFiles) {
  const source = readSource(relativePath);

  if (!source) {
    addFinding("static", relativePath, "file_missing", "Fichier introuvable.");
    continue;
  }

  const codeOnly = normalize(
    source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " "),
  );

  for (const fieldName of [...forbiddenFieldNames, ...forbiddenSupplierSignals]) {
    if (codeOnly.includes(fieldName)) {
      addFinding(
        "static",
        relativePath,
        "sensitive_field_read_in_public_surface",
        `Ce fichier public manipule "${fieldName}".`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Controles en ligne : que contient reellement la page envoyee au client ?
// ---------------------------------------------------------------------------

async function fetchBody(url, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "maxi-trouvaille-payload-leak-audit",
        ...headers,
      },
      signal: controller.signal,
      redirect: "follow",
    });

    return { status: response.status, body: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

function scanBody(target, body) {
  const haystack = normalize(body);
  const hits = [];

  for (const fieldName of forbiddenFieldNames) {
    if (haystack.includes(fieldName)) {
      hits.push({ kind: "champ interne", needle: fieldName });
    }
  }

  for (const signal of forbiddenSupplierSignals) {
    if (haystack.includes(signal)) {
      hits.push({ kind: "source fournisseur", needle: signal });
    }
  }

  for (const phrase of forbiddenPhrases) {
    if (haystack.includes(normalize(phrase))) {
      hits.push({ kind: "note interne", needle: phrase });
    }
  }

  for (const hit of hits) {
    const index = haystack.indexOf(normalize(hit.needle));
    addFinding(
      "online",
      target,
      "sensitive_data_in_public_response",
      `${hit.kind} « ${hit.needle} » trouve dans la reponse (extrait : ${body
        .slice(Math.max(0, index - 60), index + 90)
        .replace(/\s+/g, " ")
        .trim()}).`,
    );
  }

  return hits.length;
}

const checkedTargets = [];

if (!offline) {
  const pathsToCheck = [...publicPaths];

  // Une fiche produit reelle, decouverte depuis la boutique : inutile de coder
  // un slug en dur, il changerait a chaque vague d'import.
  try {
    const shop = await fetchBody(`${baseUrl}/boutique`, {});
    const slugMatch = shop.body.match(/\/produit\/([a-z0-9][a-z0-9-]{2,})/i);

    if (slugMatch) {
      pathsToCheck.push(`/produit/${slugMatch[1]}`);
    }
  } catch {
    // L'erreur reelle est signalee ci-dessous par la boucle principale.
  }

  for (const pagePath of pathsToCheck) {
    const url = `${baseUrl}${pagePath}`;

    try {
      // Reponse normale (HTML + charge utile RSC integree).
      const page = await fetchBody(url, {});
      checkedTargets.push({ url, status: page.status, bytes: page.body.length });

      if (page.status >= 500) {
        addFinding("online", url, "page_error", `Reponse HTTP ${page.status}.`);
        continue;
      }

      scanBody(url, page.body);

      // Reponse de navigation interne : c'est la MEME charge utile, servie a
      // part quand le client change de page sans recharger. Elle doit etre
      // aussi propre que la page complete.
      if (!pagePath.startsWith("/api/")) {
        const flight = await fetchBody(url, { RSC: "1" });
        scanBody(`${url} (navigation RSC)`, flight.body);
      }
    } catch (error) {
      addFinding(
        "online",
        url,
        "page_unreachable",
        `Impossible de telecharger la page (${
          error instanceof Error ? error.message : String(error)
        }). Lancez le site (npm run dev) ou utilisez --base=... / --offline.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Verdict
// ---------------------------------------------------------------------------

const report = {
  mode: offline ? "controles_de_code_seuls" : "controles_de_code_et_en_ligne",
  baseUrl: offline ? null : baseUrl,
  checkedFileCount: publicSurfaceFiles.length + 3,
  checkedPages: checkedTargets,
  findingCount: findings.length,
  findings,
  safety: {
    readOnlyAudit: true,
    noCatalogWrite: true,
    noImageWrite: true,
    noPublication: true,
    noPayment: true,
  },
};

console.log(JSON.stringify(report, null, 2));

if (findings.length > 0) {
  console.error(
    `\nECHEC : ${findings.length} fuite(s) potentielle(s) de donnees internes.\n` +
      "Rappel : tout ce qui part vers un composant \"use client\" doit passer par " +
      "toPublicProduct() (src/lib/public-product.ts).",
  );
  process.exit(1);
}

console.error(
  "\nOK : aucune donnee interne (prix d'achat, marge, source fournisseur) dans les pages publiques.",
);

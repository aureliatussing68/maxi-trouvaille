/**
 * Connecteur CJ Dropshipping — le maillon qui manquait a la chaine.
 *
 * POURQUOI CJ ET PAS ALIEXPRESS
 *
 * L'audit du 09/08/2026 a tranche sur trois sources concordantes (Ali2Woo,
 * AutoDS, DSers — le partenaire officiel d'AliExpress) : l'API AliExpress sait
 * CREER une commande, mais le PAIEMENT reste un clic manuel sur AliExpress,
 * pour tout le monde, y compris le partenaire officiel. L'objectif « le client
 * paie et la commande part toute seule chez le fournisseur » est donc
 * inatteignable avec AliExpress. CJ expose ce qui manque : un paiement par
 * SOLDE PREPAYE via API (`payType: 2` a la creation, ou `payBalanceV2`).
 *
 * ETAT : INERTE TANT QUE LE COMPTE N'EXISTE PAS
 *
 * Tout ce fichier est verrouille par deux variables d'environnement :
 *   - CJ_API_KEY   : la cle API du compte CJ (a creer par Mustapha,
 *                    Personal Center -> API -> Add API). SENSIBLE.
 *   - CJ_ENABLED   : "true" pour activer la commande automatique au webhook.
 * Sans elles, chaque fonction repond « non configure » sans le moindre appel
 * reseau. On peut donc deployer ce code aujourd'hui sans aucun risque.
 *
 * Autres variables (optionnelles) :
 *   - CJ_AUTOPAY          : "true" = payer du solde CJ a la creation
 *                           (payType 2). Sinon payType 3 : la commande est
 *                           creee chez CJ et attend un paiement du solde —
 *                           aucune carte, aucun paiement automatique surprise.
 *   - CJ_DEFAULT_LOGISTIC : nom du transporteur CJ (defaut "CJPacket Ordinary" ;
 *                           a confirmer a la premiere commande de test).
 *   - CJ_FROM_COUNTRY     : entrepot d'origine (defaut "CN").
 *   - CJ_SANDBOX          : "1" = mode bac a sable CJ (isSandbox), pour tester
 *                           la chaine complete sans depenser un centime.
 *
 * JETONS : l'accessToken CJ vaut 15 jours, le refreshToken 180 jours
 * (documentation CJ, verifiee le 09/08/2026). En serverless rien ne survit
 * entre deux appels : le jeton est donc range dans la table Postgres
 * `cj_state` (une seule ligne). La doc precise aussi que rappeler
 * getAccessToken dans les 24 h renvoie le meme jeton (cache serveur), donc
 * un raté de table ne casse rien : on redemande.
 *
 * SECURITE DE PAIEMENT : le seul argent que ce connecteur peut engager est le
 * SOLDE PREPAYE que Mustapha aura charge chez CJ. Pas de carte enregistree
 * cote code, pas de decouvert possible : solde vide = commande en attente,
 * jamais de dette. C'est le garde-fou structurel du systeme.
 */

import postgres from "postgres";
import type { DropshippingOrder } from "@/lib/dropshipping-shared";

const CJ_BASE = "https://developers.cjdropshipping.com/api2.0/v1";

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

export function getCjConfig() {
  const apiKey = (process.env.CJ_API_KEY ?? "").trim();

  return {
    apiKey,
    configured:
      apiKey.length > 10 && !apiKey.toLowerCase().includes("remplacez"),
    enabled: process.env.CJ_ENABLED === "true",
    autopay: process.env.CJ_AUTOPAY === "true",
    defaultLogistic:
      (process.env.CJ_DEFAULT_LOGISTIC ?? "").trim() || "CJPacket Ordinary",
    fromCountry: (process.env.CJ_FROM_COUNTRY ?? "").trim() || "CN",
    sandbox: process.env.CJ_SANDBOX === "1",
  };
}

/* ------------------------------------------------------------------ */
/*  Mapping produit -> CJ                                              */
/* ------------------------------------------------------------------ */

/**
 * Une ligne du fichier data/cj-products.json : le pont entre une fiche du
 * site et le produit CJ correspondant. `vid` est l'identifiant de VARIANTE
 * CJ (celui que createOrderV2 exige) ; il ne peut etre rempli qu'en
 * cherchant le produit dans le catalogue CJ, donc avec un compte.
 */
export type CjProductMapping = {
  /** Slug de la fiche sur maxitrouvaille.fr — la cle du mapping. */
  slug: string;
  /** Nom affiche, pour s'y retrouver en relisant le fichier. */
  productName: string;
  /** Identifiant de variante CJ (createOrderV2). VIDE tant que non mappe. */
  vid: string;
  /** SKU CJ, purement informatif. */
  cjSku: string;
  /** Ce qu'il faut chercher dans le catalogue CJ pour trouver ce produit. */
  rechercheCj: string;
  /** URL de l'annonce AliExpress d'origine, pour comparer les visuels. */
  referenceAliExpress: string;
  /** Date de verification du mapping (vid confirme sur le produit CJ). */
  verifieLe: string;
  note: string;
};

let mappingCache: Map<string, CjProductMapping> | null = null;

async function loadCjMapping(): Promise<Map<string, CjProductMapping>> {
  if (mappingCache) {
    return mappingCache;
  }

  try {
    const { promises: fs } = await import("fs");
    const path = await import("path");
    const raw = await fs.readFile(
      path.join(process.cwd(), "data", "cj-products.json"),
      "utf8",
    );
    const parsed = JSON.parse(raw) as { produits?: CjProductMapping[] };
    mappingCache = new Map(
      (parsed.produits ?? [])
        .filter((entry) => entry.slug)
        .map((entry) => [entry.slug, entry]),
    );
  } catch {
    mappingCache = new Map();
  }

  return mappingCache;
}

/** Lignes de la commande qui n'ont pas encore de variante CJ confirmee. */
export async function getUnmappedCjLines(order: DropshippingOrder) {
  const mapping = await loadCjMapping();

  return order.lines.filter((line) => {
    const entry = mapping.get(line.productSlug);
    return !entry || !entry.vid.trim();
  });
}

/* ------------------------------------------------------------------ */
/*  Jeton d'acces (table cj_state)                                     */
/* ------------------------------------------------------------------ */

let sqlClient: ReturnType<typeof postgres> | null = null;
let schemaReady: Promise<void> | null = null;

function getSqlClient() {
  const databaseUrl =
    process.env.DROPSHIPPING_ORDERS_DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    "";

  if (!databaseUrl) {
    return null;
  }

  sqlClient ??= postgres(databaseUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });

  return sqlClient;
}

async function ensureCjSchema() {
  const sql = getSqlClient();
  if (!sql) {
    return;
  }

  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS cj_state (
        id integer PRIMARY KEY DEFAULT 1,
        access_token text NOT NULL DEFAULT '',
        access_expiry timestamptz,
        refresh_token text NOT NULL DEFAULT '',
        refresh_expiry timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK (id = 1)
      )
    `;
  })();

  await schemaReady;
}

type CjApiResponse<T> = {
  result: boolean;
  code: number;
  message: string;
  data: T | null;
};

async function callCj<T>(
  endpoint: string,
  options: {
    method?: "GET" | "POST";
    token?: string;
    body?: unknown;
    query?: Record<string, string>;
  } = {},
): Promise<CjApiResponse<T>> {
  const url = new URL(`${CJ_BASE}${endpoint}`);

  for (const [key, value] of Object.entries(options.query ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    method: options.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { "CJ-Access-Token": options.token } : {}),
    },
    body:
      options.method === "GET" ? undefined : JSON.stringify(options.body ?? {}),
    // CJ limite a 1 requete/seconde sur le palier gratuit : chaque appel de
    // ce connecteur est unitaire (une commande = un appel), on reste loin
    // du plafond. Aucun retry automatique ici : un echec remonte, il ne
    // se rejoue pas en silence.
    signal: AbortSignal.timeout(20000),
  });

  const payload = (await response.json()) as CjApiResponse<T>;

  if (!response.ok || !payload.result) {
    throw new Error(
      `CJ ${endpoint} : ${payload.code ?? response.status} ${payload.message ?? "erreur inconnue"}`,
    );
  }

  return payload;
}

/**
 * Jeton valide, depuis la table si possible, sinon redemande a CJ.
 * La marge de 24 h sur l'expiration evite d'utiliser un jeton qui meurt
 * pendant le traitement d'une commande.
 */
export async function getCjAccessToken(): Promise<string> {
  const config = getCjConfig();

  if (!config.configured) {
    throw new Error("CJ_API_KEY absente : connecteur non configure.");
  }

  const sql = getSqlClient();

  if (sql) {
    await ensureCjSchema();
    const rows = await sql`
      SELECT access_token, access_expiry FROM cj_state WHERE id = 1
    `;
    const row = rows[0];

    if (
      row?.access_token &&
      row.access_expiry &&
      new Date(row.access_expiry as string).getTime() >
        Date.now() + 24 * 3600 * 1000
    ) {
      return row.access_token as string;
    }
  }

  const auth = await callCj<{
    accessToken: string;
    accessTokenExpiryDate: string;
    refreshToken: string;
    refreshTokenExpiryDate: string;
  }>("/authentication/getAccessToken", {
    body: { apiKey: config.apiKey },
  });

  if (!auth.data?.accessToken) {
    throw new Error("CJ getAccessToken : reponse sans jeton.");
  }

  if (sql) {
    await ensureCjSchema();
    await sql`
      INSERT INTO cj_state (id, access_token, access_expiry, refresh_token, refresh_expiry, updated_at)
      VALUES (1, ${auth.data.accessToken}, ${auth.data.accessTokenExpiryDate ?? null},
              ${auth.data.refreshToken ?? ""}, ${auth.data.refreshTokenExpiryDate ?? null}, now())
      ON CONFLICT (id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        access_expiry = EXCLUDED.access_expiry,
        refresh_token = EXCLUDED.refresh_token,
        refresh_expiry = EXCLUDED.refresh_expiry,
        updated_at = now()
    `;
  }

  return auth.data.accessToken;
}

/* ------------------------------------------------------------------ */
/*  Adresse France -> format CJ                                        */
/* ------------------------------------------------------------------ */

/**
 * createOrderV2 exige une province. Nos adresses n'en ont pas : en France
 * c'est le departement qui joue ce role, et il se lit dans les deux premiers
 * chiffres du code postal. Table verifiee sur la liste officielle des
 * departements ; les codes 97x sont ceux des DROM.
 */
const DEPARTEMENTS: Record<string, string> = {
  "01": "Ain",
  "02": "Aisne",
  "03": "Allier",
  "04": "Alpes-de-Haute-Provence",
  "05": "Hautes-Alpes",
  "06": "Alpes-Maritimes",
  "07": "Ardeche",
  "08": "Ardennes",
  "09": "Ariege",
  "10": "Aube",
  "11": "Aude",
  "12": "Aveyron",
  "13": "Bouches-du-Rhone",
  "14": "Calvados",
  "15": "Cantal",
  "16": "Charente",
  "17": "Charente-Maritime",
  "18": "Cher",
  "19": "Correze",
  "20": "Corse",
  "21": "Cote-d'Or",
  "22": "Cotes-d'Armor",
  "23": "Creuse",
  "24": "Dordogne",
  "25": "Doubs",
  "26": "Drome",
  "27": "Eure",
  "28": "Eure-et-Loir",
  "29": "Finistere",
  "30": "Gard",
  "31": "Haute-Garonne",
  "32": "Gers",
  "33": "Gironde",
  "34": "Herault",
  "35": "Ille-et-Vilaine",
  "36": "Indre",
  "37": "Indre-et-Loire",
  "38": "Isere",
  "39": "Jura",
  "40": "Landes",
  "41": "Loir-et-Cher",
  "42": "Loire",
  "43": "Haute-Loire",
  "44": "Loire-Atlantique",
  "45": "Loiret",
  "46": "Lot",
  "47": "Lot-et-Garonne",
  "48": "Lozere",
  "49": "Maine-et-Loire",
  "50": "Manche",
  "51": "Marne",
  "52": "Haute-Marne",
  "53": "Mayenne",
  "54": "Meurthe-et-Moselle",
  "55": "Meuse",
  "56": "Morbihan",
  "57": "Moselle",
  "58": "Nievre",
  "59": "Nord",
  "60": "Oise",
  "61": "Orne",
  "62": "Pas-de-Calais",
  "63": "Puy-de-Dome",
  "64": "Pyrenees-Atlantiques",
  "65": "Hautes-Pyrenees",
  "66": "Pyrenees-Orientales",
  "67": "Bas-Rhin",
  "68": "Haut-Rhin",
  "69": "Rhone",
  "70": "Haute-Saone",
  "71": "Saone-et-Loire",
  "72": "Sarthe",
  "73": "Savoie",
  "74": "Haute-Savoie",
  "75": "Paris",
  "76": "Seine-Maritime",
  "77": "Seine-et-Marne",
  "78": "Yvelines",
  "79": "Deux-Sevres",
  "80": "Somme",
  "81": "Tarn",
  "82": "Tarn-et-Garonne",
  "83": "Var",
  "84": "Vaucluse",
  "85": "Vendee",
  "86": "Vienne",
  "87": "Haute-Vienne",
  "88": "Vosges",
  "89": "Yonne",
  "90": "Territoire de Belfort",
  "91": "Essonne",
  "92": "Hauts-de-Seine",
  "93": "Seine-Saint-Denis",
  "94": "Val-de-Marne",
  "95": "Val-d'Oise",
  "971": "Guadeloupe",
  "972": "Martinique",
  "973": "Guyane",
  "974": "La Reunion",
  "976": "Mayotte",
};

export function provinceDepuisCodePostal(postalCode: string, city: string) {
  const propre = postalCode.replace(/\s/g, "");

  if (propre.startsWith("97")) {
    return DEPARTEMENTS[propre.slice(0, 3)] ?? city;
  }

  return DEPARTEMENTS[propre.slice(0, 2)] ?? city;
}

/** "FR" pour "France" et ses variantes ; sinon le pays tel quel si deja un code. */
export function codePaysDepuisLibelle(country: string) {
  const propre = country.trim().toUpperCase();

  if (propre === "FR" || propre === "FRANCE") {
    return "FR";
  }

  return propre.length === 2 ? propre : "";
}

/* ------------------------------------------------------------------ */
/*  Commande fournisseur                                               */
/* ------------------------------------------------------------------ */

export type CjFulfillmentResult =
  | { tente: false; raison: string }
  | {
      tente: true;
      reussi: true;
      cjOrderId: string;
      paye: boolean;
      montants: { commande?: number; produits?: number; port?: number };
    }
  | { tente: true; reussi: false; erreur: string };

/**
 * Envoie une commande payee chez CJ. C'est LE maillon automatique :
 * appele par le webhook Stripe apres l'enregistrement du paiement.
 *
 * Ne tente RIEN si : connecteur desactive, commande deja transmise
 * (supplierOrderReference presente), pays hors format, ou une ligne sans
 * variante CJ confirmee. Chaque refus renvoie sa raison en clair — elle
 * finit dans la note interne de la commande, jamais dans le vide.
 */
export async function tenterCommandeFournisseurCj(
  order: DropshippingOrder,
): Promise<CjFulfillmentResult> {
  const config = getCjConfig();

  if (!config.configured || !config.enabled) {
    return { tente: false, raison: "connecteur CJ non configure ou desactive" };
  }

  if (order.supplierOrderReference) {
    return {
      tente: false,
      raison: `deja transmise (reference ${order.supplierOrderReference})`,
    };
  }

  const countryCode = codePaysDepuisLibelle(order.shippingAddress.country);

  if (!countryCode) {
    return {
      tente: false,
      raison: `pays de livraison non reconnu : « ${order.shippingAddress.country} »`,
    };
  }

  const lignesNonMappees = await getUnmappedCjLines(order);

  if (lignesNonMappees.length > 0) {
    return {
      tente: false,
      raison: `produit(s) sans variante CJ confirmee : ${lignesNonMappees
        .map((line) => line.productSlug)
        .join(", ")}`,
    };
  }

  const mapping = await loadCjMapping();

  try {
    const token = await getCjAccessToken();

    const creation = await callCj<{
      orderId: string;
      orderAmount?: number;
      productAmount?: number;
      postageAmount?: number;
    }>("/shopping/order/createOrderV2", {
      token,
      body: {
        orderNumber: order.orderNumber,
        shippingCountryCode: countryCode,
        shippingCountry: order.shippingAddress.country,
        shippingProvince: provinceDepuisCodePostal(
          order.shippingAddress.postalCode,
          order.shippingAddress.city,
        ),
        shippingCity: order.shippingAddress.city,
        shippingAddress: order.shippingAddress.street,
        shippingZip: order.shippingAddress.postalCode,
        shippingCustomerName: order.customer.name,
        shippingPhone: order.customer.phone || undefined,
        logisticName: config.defaultLogistic,
        fromCountryCode: config.fromCountry,
        // 2 = paye immediatement depuis le solde CJ ; 3 = cree seulement,
        // paiement du solde a declencher ensuite. Jamais de carte.
        payType: config.autopay ? 2 : 3,
        ...(config.sandbox ? { isSandbox: 1 } : {}),
        products: order.lines.map((line) => ({
          vid: mapping.get(line.productSlug)?.vid ?? "",
          quantity: line.quantity,
        })),
      },
    });

    if (!creation.data?.orderId) {
      return {
        tente: true,
        reussi: false,
        erreur: "CJ createOrderV2 : reponse sans orderId.",
      };
    }

    return {
      tente: true,
      reussi: true,
      cjOrderId: creation.data.orderId,
      paye: config.autopay,
      montants: {
        commande: creation.data.orderAmount,
        produits: creation.data.productAmount,
        port: creation.data.postageAmount,
      },
    };
  } catch (error) {
    return {
      tente: true,
      reussi: false,
      erreur: error instanceof Error ? error.message : String(error),
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Suivi : la commande CJ est-elle expediee ?                         */
/* ------------------------------------------------------------------ */

export type CjOrderStatusResult = {
  cjStatus: string;
  trackNumber: string;
};

/** Statut + numero de suivi d'une commande CJ (getOrderDetail). */
export async function getCjOrderStatus(
  cjOrderId: string,
): Promise<CjOrderStatusResult> {
  const token = await getCjAccessToken();

  const detail = await callCj<{
    orderStatus?: string;
    trackNumber?: string;
  }>("/shopping/order/getOrderDetail", {
    method: "GET",
    token,
    query: { orderId: cjOrderId },
  });

  return {
    cjStatus: detail.data?.orderStatus ?? "",
    trackNumber: (detail.data?.trackNumber ?? "").trim(),
  };
}

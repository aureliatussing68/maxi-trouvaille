/**
 * Diagnostic de la boutique — l'etat reel, mesure depuis la production.
 *
 * POURQUOI CETTE PAGE EXISTE
 * --------------------------
 * Les variables d'environnement de l'hebergeur sont marquees "Sensitive" :
 * une fois posees, plus personne ne peut les relire, pas meme en ligne de
 * commande. Impossible, donc, de verifier de l'exterieur si la base repond,
 * si les emails sont configures, si la cle de paiement est en mode reel.
 * Cette page repond a ces questions depuis l'interieur du serveur.
 *
 * SECURITE
 * --------
 * - repond 404 (comme si le fichier n'existait pas) tant que la variable
 *   MAXI_DIAG_TOKEN n'est pas posee, ou si le jeton fourni ne correspond pas ;
 * - ne renvoie JAMAIS la valeur d'une variable secrete : uniquement des
 *   "presente / absente", des longueurs et des prefixes non sensibles ;
 * - refuse d'etre indexee (x-robots-tag) et n'est jamais mise en cache.
 *
 * USAGE : https://<le-site>/api/diagnostic?token=<MAXI_DIAG_TOKEN>
 */

import postgres from "postgres";
import { readRecentEmailIncidents } from "@/lib/email-incidents";
import {
  champsManquants,
  champsRecommandesManquants,
  vendeurComplet,
} from "@/lib/legal-identity";
import { getEmailSettings } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLES_ATTENDUES = [
  "dropshipping_orders",
  "email_incidents",
  "product_stats",
  "product_reviews",
];

function getDiagToken() {
  const brut = process.env.MAXI_DIAG_TOKEN;

  if (typeof brut !== "string") {
    return "";
  }

  const valeur = brut.trim();

  if (!valeur || valeur.toLowerCase().includes("remplacez_moi")) {
    return "";
  }

  return valeur;
}

function introuvable() {
  return new Response(JSON.stringify({ error: "Introuvable." }), {
    status: 404,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-robots-tag": "noindex, nofollow",
      "cache-control": "no-store",
    },
  });
}

/** Presence d'une variable, sans jamais reveler sa valeur. */
function presence(nom: string) {
  const valeur = (process.env[nom] ?? "").trim();

  return {
    presente: valeur.length > 0,
    longueur: valeur.length,
  };
}

/** Prefixe d'une cle Stripe : sk_live_ / sk_test_. Ne revele aucun secret. */
function modeStripe() {
  const cle = (process.env.STRIPE_SECRET_KEY ?? "").trim();

  if (!cle) {
    return "cle_absente";
  }

  if (cle.startsWith("sk_live_")) {
    return "PRODUCTION (sk_live_)";
  }

  if (cle.startsWith("sk_test_")) {
    return "TEST (sk_test_)";
  }

  return "prefixe_inconnu";
}

function getDatabaseUrl() {
  return (
    process.env.DROPSHIPPING_ORDERS_DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    ""
  );
}

async function diagnostiquerBase() {
  const url = getDatabaseUrl();

  if (!url) {
    return {
      configuree: false,
      joignable: false,
      message:
        "Aucune URL de base trouvee (DROPSHIPPING_ORDERS_DATABASE_URL, POSTGRES_URL, DATABASE_URL).",
    };
  }

  let hote = "?";

  try {
    hote = new URL(url).hostname;
  } catch {
    hote = "adresse illisible";
  }

  const sql = postgres(url, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    prepare: false,
  });

  const debut = Date.now();

  try {
    const version = await sql<{ v: string }[]>`SELECT version() AS v`;
    const latenceMs = Date.now() - debut;

    const tables = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    const nomsTables = tables.map((t) => t.table_name);

    const comptes: Record<string, number | string> = {};

    for (const nom of TABLES_ATTENDUES) {
      if (!nomsTables.includes(nom)) {
        comptes[nom] = "table absente (elle se creera au premier acces)";
        continue;
      }

      try {
        const r = await sql.unsafe<{ n: number }[]>(
          `SELECT count(*)::int AS n FROM "${nom}"`,
        );
        comptes[nom] = r[0]?.n ?? 0;
      } catch {
        comptes[nom] = "lecture impossible";
      }
    }

    return {
      configuree: true,
      joignable: true,
      hote,
      latenceMs,
      moteur: (version[0]?.v ?? "").split(" ").slice(0, 2).join(" "),
      tablesPresentes: nomsTables,
      comptes,
    };
  } catch (error) {
    return {
      configuree: true,
      joignable: false,
      hote,
      message:
        error instanceof Error
          ? error.message.slice(0, 300)
          : "erreur inconnue",
    };
  } finally {
    await sql.end({ timeout: 5 }).catch(() => undefined);
  }
}

/**
 * Liste courte des dernieres commandes.
 *
 * On ne renvoie VOLONTAIREMENT ni nom, ni adresse, ni email, ni telephone :
 * cette page sert a diagnostiquer, pas a consulter des donnees clients. Meme
 * protegee par un jeton, elle ne doit jamais devenir une porte de sortie pour
 * des donnees personnelles.
 */
async function listerCommandes(limite = 20) {
  const url = getDatabaseUrl();

  if (!url) {
    return [];
  }

  const sql = postgres(url, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    prepare: false,
  });

  try {
    const lignes = await sql<
      { data: Record<string, unknown>; created_at: Date }[]
    >`
      SELECT data, created_at FROM dropshipping_orders
      ORDER BY created_at DESC
      LIMIT ${limite}
    `;

    return lignes.map((ligne) => ({
      reference: String(ligne.data?.orderNumber ?? "?"),
      paiement: String(ligne.data?.paymentStatus ?? "?"),
      statut: String(ligne.data?.status ?? "?"),
      creeeLe: ligne.created_at?.toISOString?.() ?? "",
    }));
  } catch {
    return [];
  } finally {
    await sql.end({ timeout: 5 }).catch(() => undefined);
  }
}

/**
 * Supprime UNE commande, designee par sa reference exacte.
 *
 * Trois verrous, parce qu'une suppression ne se rattrape pas :
 *   1. il faut le jeton de diagnostic ;
 *   2. il faut nommer la commande — aucun effacement en masse n'est possible ;
 *   3. une commande PAYEE est refusee, quoi qu'il arrive. Une vente reelle est
 *      une piece comptable : elle se conserve dix ans, elle ne s'efface pas.
 */
async function supprimerCommandeNonPayee(reference: string) {
  const url = getDatabaseUrl();

  if (!url) {
    return { supprimee: false, motif: "aucune base de donnees configuree" };
  }

  const sql = postgres(url, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    prepare: false,
  });

  try {
    const existantes = await sql<{ paiement: string }[]>`
      SELECT data->>'paymentStatus' AS paiement
      FROM dropshipping_orders
      WHERE data->>'orderNumber' = ${reference}
    `;

    if (existantes.length === 0) {
      return {
        supprimee: false,
        motif: "aucune commande avec cette reference",
      };
    }

    if (existantes.some((ligne) => ligne.paiement === "paid")) {
      return {
        supprimee: false,
        motif:
          "cette commande est PAYEE : suppression refusee (piece comptable a conserver)",
      };
    }

    const effacees = await sql<{ n: string }[]>`
      DELETE FROM dropshipping_orders
      WHERE data->>'orderNumber' = ${reference}
        AND data->>'paymentStatus' <> 'paid'
      RETURNING id
    `;

    return {
      supprimee: effacees.length > 0,
      nombre: effacees.length,
      motif: effacees.length > 0 ? "" : "rien n'a ete supprime",
    };
  } catch (error) {
    return {
      supprimee: false,
      motif:
        error instanceof Error
          ? error.message.slice(0, 200)
          : "erreur inconnue",
    };
  } finally {
    await sql.end({ timeout: 5 }).catch(() => undefined);
  }
}

/**
 * Suppression d'une commande de test.
 * DELETE /api/diagnostic?token=<jeton>&commande=<reference>
 */
export async function DELETE(request: Request) {
  const attendu = getDiagToken();

  if (!attendu) {
    return introuvable();
  }

  const params = new URL(request.url).searchParams;

  if ((params.get("token") ?? "") !== attendu) {
    return introuvable();
  }

  const reference = (params.get("commande") ?? "").trim();

  if (!reference) {
    return new Response(
      JSON.stringify({
        error:
          "Precise la commande a supprimer : ?commande=<reference>. Aucune suppression en masse n'est possible.",
      }),
      {
        status: 400,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    );
  }

  const resultat = await supprimerCommandeNonPayee(reference);

  return new Response(JSON.stringify({ reference, ...resultat }, null, 2), {
    status: resultat.supprimee ? 200 : 409,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-robots-tag": "noindex, nofollow",
      "cache-control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const attendu = getDiagToken();

  if (!attendu) {
    return introuvable();
  }

  const fourni = new URL(request.url).searchParams.get("token") ?? "";

  if (fourni !== attendu) {
    return introuvable();
  }

  const emails = getEmailSettings();
  const base = await diagnostiquerBase();

  const incidents = await readRecentEmailIncidents(10).catch(() => []);

  const alertes: string[] = [];

  if (!emails.apiKey) {
    alertes.push(
      "RESEND_API_KEY absente : aucun email ne part, ni au client ni au commercant.",
    );
  } else if (!emails.hasCustomFrom) {
    alertes.push(
      "EMAIL_FROM absente : les emails partiraient de l'adresse de test partagee du fournisseur, qui REFUSE (403) tout destinataire autre que le titulaire du compte. Aucun client ne recevrait sa confirmation.",
    );
  }

  if (emails.disabledBySwitch) {
    alertes.push(
      "MAXI_EMAILS_ENABLED est sur off : tous les envois sont coupes.",
    );
  }

  if (!emails.notificationTo) {
    alertes.push(
      "MAXI_ORDER_NOTIFICATION_EMAIL absente : aucune alerte ne part vers le commercant quand une commande tombe.",
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    alertes.push(
      "STRIPE_WEBHOOK_SECRET absente : le site rejette les notifications de paiement de Stripe.",
    );
  }

  if (base.configuree && !base.joignable) {
    alertes.push(
      "La base de donnees est configuree mais ne repond pas : les commandes ne seront pas conservees.",
    );
  }

  if (!base.configuree) {
    alertes.push(
      "Aucune base de donnees : sur l'hebergeur, les commandes sont ecrites dans un dossier temporaire qui disparait.",
    );
  }

  if (process.env.ADMIN_MODE === "true") {
    alertes.push(
      "ADMIN_MODE=true en production : les pages d'administration sont ouvertes SANS mot de passe. A retirer immediatement.",
    );
  }

  if (incidents.length > 0) {
    alertes.push(
      `${incidents.length} email(s) recents ne sont PAS partis — voir la section emailsNonPartis.`,
    );
  }

  const juridiqueManquant = champsManquants();

  if (juridiqueManquant.length > 0) {
    alertes.push(
      `Identite legale incomplete (${juridiqueManquant.length}) : ${juridiqueManquant.join(", ")}. Ces trous sont VISIBLES sur les pages legales du site.`,
    );
  }

  const corps = {
    verifieLe: new Date().toISOString(),
    tout_va_bien: alertes.length === 0,
    alertes,
    paiement: {
      mode: modeStripe(),
      paiementsReelsActives: process.env.STRIPE_ENABLE_LIVE_PAYMENTS === "true",
      webhookSecret: presence("STRIPE_WEBHOOK_SECRET"),
    },
    emails: {
      actifs: emails.enabled,
      coupeParInterrupteur: emails.disabledBySwitch,
      expediteur: emails.from,
      expediteurPersonnalise: emails.hasCustomFrom,
      repondreA: emails.replyTo,
      alerteCommercantVers: emails.notificationTo || "(non configuree)",
      cleEnvoi: presence("RESEND_API_KEY"),
    },
    base,
    juridique: {
      vendeurAffiche: vendeurComplet(),
      champsObligatoiresManquants: juridiqueManquant,
      champsRecommandesManquants: champsRecommandesManquants(),
      pretAPublier: juridiqueManquant.length === 0,
    },
    dernieresCommandes: await listerCommandes(20).catch(() => []),
    emailsNonPartis: incidents,
    site: {
      url: emails.siteUrl,
      region: process.env.VERCEL_REGION ?? "(inconnue)",
      adminOuvert: process.env.ADMIN_MODE === "true",
    },
  };

  return new Response(JSON.stringify(corps, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-robots-tag": "noindex, nofollow",
      "cache-control": "no-store",
    },
  });
}

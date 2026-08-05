/**
 * Journal des emails qui ne sont PAS partis.
 *
 * POURQUOI CE FICHIER EXISTE
 * --------------------------
 * Avant lui, un email refuse par le fournisseur d'envoi disparaissait sans
 * laisser de trace exploitable : `mailer.ts` ecrivait un `console.warn` dans
 * les journaux de l'hebergeur, et le webhook Stripe avalait l'echec dans un
 * `catch {}` vide. Resultat : un client pouvait payer, ne jamais recevoir sa
 * confirmation, et personne ne l'apprenait.
 *
 * Le cas concret qui a motive ce fichier : sans la variable EMAIL_FROM, les
 * emails partent de l'adresse de test partagee du fournisseur, qui refuse
 * (HTTP 403) tout destinataire autre que le titulaire du compte. Symptome :
 * rien. Absolument rien.
 *
 * REGLES DE CONCEPTION (les memes que le reste du module email)
 * ------------------------------------------------------------
 * - ne jette JAMAIS : un incident non enregistre ne doit pas casser un
 *   paiement deja encaisse ;
 * - n'ecrit rien au niveau module : rien ne s'execute pendant `next build` ;
 * - sans base de donnees, se rabat sur un `console.error` (visible dans les
 *   journaux d'execution de l'hebergeur) et n'echoue pas ;
 * - ne distingue pas "email volontairement non envoye" de "email refuse" :
 *   c'est a l'appelant de ne signaler que les vrais echecs, via
 *   `isRealEmailFailure`.
 */

import postgres from "postgres";

export type EmailIncidentKind =
  | "confirmation-client"
  | "alerte-commercant"
  | "expedition-client"
  | "reponse-client"
  | "test";

export type EmailIncident = {
  id: string;
  kind: EmailIncidentKind;
  recipient: string;
  reason: string;
  detail: string;
  orderReference: string;
  createdAt: string;
};

/**
 * Raisons qui signifient "on n'avait pas a envoyer", et qui ne sont donc PAS
 * des incidents. Tout le reste en est un.
 */
const RAISONS_BENIGNES = new Set([
  "emails_inactifs",
  "cle_email_absente",
  "emails_desactives_par_interrupteur",
  "deja_envoye",
  "statut_non_expedie",
  "commande_non_payee",
  "adresse_notification_absente",
  "destinataire_absent",
]);

/**
 * Un envoi rate est-il un vrai probleme ?
 *
 * `email_client_absent` EST compte comme un incident : une commande payee
 * sans adresse email exploitable est une anomalie, pas un fonctionnement
 * normal.
 */
export function isRealEmailFailure(reason: string) {
  const valeur = String(reason ?? "").trim();
  return valeur.length > 0 && !RAISONS_BENIGNES.has(valeur);
}

let sqlClient: ReturnType<typeof postgres> | null = null;
let schemaReady: Promise<void> | null = null;

function getDatabaseUrl() {
  return (
    process.env.DROPSHIPPING_ORDERS_DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    ""
  );
}

function getSqlClient() {
  const databaseUrl = getDatabaseUrl();

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

async function ensureSchema() {
  const sql = getSqlClient();

  if (!sql) {
    return;
  }

  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS email_incidents (
        id text PRIMARY KEY,
        kind text NOT NULL,
        recipient text NOT NULL DEFAULT '',
        reason text NOT NULL DEFAULT '',
        detail text NOT NULL DEFAULT '',
        order_reference text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS email_incidents_created_idx
        ON email_incidents (created_at DESC)
    `;
  })();

  await schemaReady;
}

function tronque(valeur: unknown, longueur: number) {
  return String(valeur ?? "")
    .trim()
    .slice(0, longueur);
}

/**
 * Enregistre un email qui n'est pas parti.
 *
 * Ecrit TOUJOURS un `console.error` (donc visible dans les journaux
 * d'execution meme sans base), puis tente l'enregistrement durable.
 */
export async function recordEmailIncident(input: {
  kind: EmailIncidentKind;
  recipient?: string;
  reason: string;
  detail?: string;
  orderReference?: string;
}): Promise<void> {
  const kind = input.kind;
  const recipient = tronque(input.recipient, 200);
  const reason = tronque(input.reason, 120);
  const detail = tronque(input.detail, 500);
  const orderReference = tronque(input.orderReference, 120);

  // Niveau ERREUR, pas avertissement : c'est ce qui rend l'echec reperable
  // dans les journaux de l'hebergeur, qui colorent les erreurs.
  console.error(
    `[email-incident] ${kind} NON ENVOYE — raison=${reason} destinataire=${recipient || "?"} commande=${orderReference || "?"} detail=${detail || "-"}`,
  );

  try {
    const sql = getSqlClient();

    if (!sql) {
      return;
    }

    await ensureSchema();

    const id = `inc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

    await sql`
      INSERT INTO email_incidents (id, kind, recipient, reason, detail, order_reference)
      VALUES (${id}, ${kind}, ${recipient}, ${reason}, ${detail}, ${orderReference})
    `;
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 200) : "erreur inconnue";
    console.error(
      `[email-incident] enregistrement durable impossible : ${message}`,
    );
  }
}

/**
 * Signale un envoi rate SEULEMENT si c'en est vraiment un.
 * Raccourci utilise par tous les appelants, pour eviter de dupliquer le test.
 */
export async function recordEmailFailureIfReal(input: {
  kind: EmailIncidentKind;
  reason: string;
  recipient?: string;
  detail?: string;
  orderReference?: string;
}): Promise<boolean> {
  if (!isRealEmailFailure(input.reason)) {
    return false;
  }

  await recordEmailIncident(input);
  return true;
}

/** Derniers incidents, du plus recent au plus ancien. Pour le diagnostic. */
export async function readRecentEmailIncidents(
  limit = 20,
): Promise<EmailIncident[]> {
  const sql = getSqlClient();

  if (!sql) {
    return [];
  }

  await ensureSchema();

  const bornes = Math.min(Math.max(1, Math.trunc(limit)), 100);

  const rows = await sql<
    {
      id: string;
      kind: string;
      recipient: string;
      reason: string;
      detail: string;
      order_reference: string;
      created_at: Date;
    }[]
  >`
    SELECT id, kind, recipient, reason, detail, order_reference, created_at
    FROM email_incidents
    ORDER BY created_at DESC
    LIMIT ${bornes}
  `;

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as EmailIncidentKind,
    recipient: row.recipient,
    reason: row.reason,
    detail: row.detail,
    orderReference: row.order_reference,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  }));
}

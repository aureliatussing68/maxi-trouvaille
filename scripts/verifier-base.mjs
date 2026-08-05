/**
 * Vérification de la base de données des commandes.
 *
 * À lancer UNE FOIS, après avoir branché Postgres, pour prouver que le site
 * peut vraiment écrire et relire une commande. Ne modifie aucune donnée
 * existante : la ligne de test est écrite puis effacée.
 *
 *   node scripts/verifier-base.mjs
 *
 * Le script lit l'URL de connexion dans .env.local (ou dans les variables
 * d'environnement du terminal), dans le MÊME ordre que le site :
 *   DROPSHIPPING_ORDERS_DATABASE_URL, puis POSTGRES_URL, puis DATABASE_URL.
 *
 * REGLE : l'URL de connexion contient un mot de passe. Ce script ne l'affiche
 * JAMAIS, ni en entier ni en partie, même en cas d'erreur.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Charge .env.local sans écraser ce qui est déjà dans l'environnement. */
function chargerEnvLocal() {
  for (const nomFichier of [".env.local", ".env"]) {
    let contenu = "";

    try {
      contenu = readFileSync(join(racine, nomFichier), "utf8");
    } catch {
      continue;
    }

    for (const ligne of contenu.split(/\r?\n/)) {
      const trait = ligne.trim();

      if (!trait || trait.startsWith("#")) {
        continue;
      }

      const separateur = trait.indexOf("=");

      if (separateur < 1) {
        continue;
      }

      const cle = trait.slice(0, separateur).trim();
      let valeur = trait.slice(separateur + 1).trim();

      if (
        (valeur.startsWith('"') && valeur.endsWith('"')) ||
        (valeur.startsWith("'") && valeur.endsWith("'"))
      ) {
        valeur = valeur.slice(1, -1);
      }

      if (!(cle in process.env)) {
        process.env[cle] = valeur;
      }
    }
  }
}

function trouverUrl() {
  const noms = [
    "DROPSHIPPING_ORDERS_DATABASE_URL",
    "POSTGRES_URL",
    "DATABASE_URL",
  ];

  for (const nom of noms) {
    const valeur = (process.env[nom] ?? "").trim();

    if (valeur) {
      return { nom, valeur };
    }
  }

  return null;
}

/** Décrit la base SANS révéler le mot de passe. */
function decrire(url) {
  try {
    const analyse = new URL(url);
    return `${analyse.hostname} / base "${analyse.pathname.replace(/^\//, "") || "?"}"`;
  } catch {
    return "adresse illisible";
  }
}

function echec(message, detail) {
  console.error(`\n[ECHEC] ${message}`);

  if (detail) {
    console.error(`         ${detail}`);
  }

  process.exit(1);
}

chargerEnvLocal();

const trouve = trouverUrl();

if (!trouve) {
  echec(
    "aucune URL de base de données trouvée.",
    "Attendu : DROPSHIPPING_ORDERS_DATABASE_URL, POSTGRES_URL ou DATABASE_URL.",
  );
}

console.log(`\nVariable utilisée : ${trouve.nom}`);
console.log(`Serveur           : ${decrire(trouve.valeur)}`);

const sql = postgres(trouve.valeur, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 15,
  prepare: false,
});

const identifiantTest = `verification-${process.pid}-${Math.floor(
  Date.now() / 1000,
)}`;

let etape = "connexion";

try {
  await sql`SELECT 1`;
  console.log("1/5  Connexion                       OK");

  etape = "création de la table";
  await sql`
    CREATE TABLE IF NOT EXISTS dropshipping_orders (
      id text PRIMARY KEY,
      stripe_session_id text NOT NULL DEFAULT '',
      data jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS dropshipping_orders_session_idx
      ON dropshipping_orders (stripe_session_id)
  `;
  console.log("2/5  Table dropshipping_orders       OK");

  etape = "écriture";
  await sql`
    INSERT INTO dropshipping_orders (id, stripe_session_id, data)
    VALUES (
      ${identifiantTest},
      ${"cs_test_verification"},
      ${sql.json({ verification: true, ecritLe: new Date().toISOString() })}
    )
  `;
  console.log("3/5  Écriture d'une commande test    OK");

  etape = "relecture";
  const relu = await sql`
    SELECT id, data FROM dropshipping_orders WHERE id = ${identifiantTest}
  `;

  if (relu.length !== 1 || relu[0].data?.verification !== true) {
    throw new Error("la ligne écrite n'a pas été relue correctement");
  }

  console.log("4/5  Relecture                       OK");

  etape = "nettoyage";
  await sql`DELETE FROM dropshipping_orders WHERE id = ${identifiantTest}`;
  console.log("5/5  Nettoyage de la ligne test      OK");

  const total = await sql`SELECT count(*)::int AS n FROM dropshipping_orders`;

  console.log(
    `\n[OK] La base fonctionne. Commandes réelles actuellement stockées : ${total[0].n}.`,
  );
  console.log(
    "     Une commande payée sera désormais conservée durablement.\n",
  );
} catch (erreur) {
  const detail = erreur instanceof Error ? erreur.message : "erreur inconnue";

  echec(
    `la base a refusé l'étape « ${etape} ».`,
    detail.includes("password") || detail.includes("authentication")
      ? "Identifiants refusés : l'URL de connexion est incomplète ou périmée."
      : detail.slice(0, 300),
  );
} finally {
  await sql.end({ timeout: 5 }).catch(() => {});
}

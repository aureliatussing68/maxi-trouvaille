/**
 * Envoi d'emails Maxi Trouvaille.
 *
 * REGLE D'INERTIE (ne pas casser) :
 * - aucune librairie npm ajoutee : appel HTTP direct, comme le fait deja
 *   src/app/api/admin/products/photo-analysis/route.ts ;
 * - aucune initialisation au niveau module : rien ne s'execute pendant
 *   `next build` ;
 * - si RESEND_API_KEY est absente (ou encore sur une valeur "remplacez_moi"),
 *   sendEmail n'envoie rien, ne plante pas, et renvoie un succes neutre.
 *
 * Fournisseur : Resend (https://resend.com). Pour changer de fournisseur,
 * seule la fonction sendEmail est a reecrire.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 8000;

export type EmailRecipient = string | string[];

export type SendEmailInput = {
  to: EmailRecipient;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; sent: true; provider: "resend"; id: string | null }
  | { ok: true; sent: false; reason: string }
  | { ok: false; sent: false; reason: string; detail?: string };

export type EmailSettings = {
  apiKey: string;
  from: string;
  replyTo: string;
  siteUrl: string;
  enabled: boolean;
  disabledBySwitch: boolean;
  hasCustomFrom: boolean;
};

function readEnvValue(name: string) {
  const raw = process.env[name];

  if (typeof raw !== "string") {
    return "";
  }

  const value = raw.trim();

  if (!value || value.toLowerCase().includes("remplacez_moi")) {
    return "";
  }

  return value;
}

function isSwitchedOff() {
  const raw = (process.env.MAXI_EMAILS_ENABLED ?? "").trim().toLowerCase();
  return raw === "false" || raw === "0" || raw === "off" || raw === "non";
}

/**
 * Lit la configuration email. Ne jette jamais, ne contacte rien.
 */
export function getEmailSettings(): EmailSettings {
  const apiKey = readEnvValue("RESEND_API_KEY");
  const customFrom = readEnvValue("EMAIL_FROM");
  const disabledBySwitch = isSwitchedOff();

  return {
    apiKey,
    // Tant que le domaine n'est pas verifie chez Resend, l'adresse de test
    // onboarding@resend.dev permet d'envoyer vers sa propre adresse.
    from: customFrom || "Maxi Trouvaille <onboarding@resend.dev>",
    replyTo: readEnvValue("EMAIL_REPLY_TO") || "contact@maxitrouvaille.fr",
    siteUrl: readEnvValue("NEXT_PUBLIC_SITE_URL") || "https://maxitrouvaille.fr",
    enabled: Boolean(apiKey) && !disabledBySwitch,
    disabledBySwitch,
    hasCustomFrom: Boolean(customFrom),
  };
}

export function isEmailSendingEnabled() {
  return getEmailSettings().enabled;
}

function normalizeRecipients(to: EmailRecipient) {
  const list = Array.isArray(to) ? to : [to];

  return list
    .map((value) => String(value ?? "").trim())
    .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    .slice(0, 10);
}

/**
 * Envoie un email. Ne jette JAMAIS : le resultat est toujours un objet.
 * Sans cle configuree, renvoie { ok: true, sent: false } et se contente
 * d'une trace dans les logs serveur.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const settings = getEmailSettings();

  if (!settings.enabled) {
    const reason = settings.disabledBySwitch
      ? "emails_desactives_par_interrupteur"
      : "cle_email_absente";
    console.info(`[mailer] envoi ignore (${reason}) : ${input.subject}`);
    return { ok: true, sent: false, reason };
  }

  const recipients = normalizeRecipients(input.to);

  if (recipients.length === 0) {
    console.info("[mailer] envoi ignore (aucun destinataire valide).");
    return { ok: true, sent: false, reason: "destinataire_absent" };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.from?.trim() || settings.from,
        to: recipients,
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo?.trim() || settings.replyTo,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      console.warn(
        `[mailer] refus du service d'envoi (${response.status}) : ${detail}`,
      );
      return {
        ok: false,
        sent: false,
        reason: `reponse_${response.status}`,
        detail,
      };
    }

    const payload = (await response.json().catch(() => null)) as
      | { id?: unknown }
      | null;
    const id = typeof payload?.id === "string" ? payload.id : null;

    return { ok: true, sent: true, provider: "resend", id };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message.slice(0, 300) : "erreur inconnue";
    console.warn(`[mailer] envoi impossible : ${detail}`);
    return { ok: false, sent: false, reason: "erreur_reseau", detail };
  }
}

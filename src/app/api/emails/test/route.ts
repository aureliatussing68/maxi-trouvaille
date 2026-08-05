/**
 * Page de test des emails Maxi Trouvaille.
 *
 * INERTE PAR DEFAUT : tant que la variable MAXI_EMAIL_TEST_TOKEN n'existe
 * pas (ou vaut encore "remplacez_moi"), cette adresse repond 404 exactement
 * comme si le fichier n'existait pas.
 *
 * Une fois la variable posee, ouvrir https://<le-site>/api/emails/test
 * affiche un petit formulaire : code d'acces + adresse email de test.
 * Aucune donnee client n'est utilisee ici, uniquement un exemple fictif.
 */

import {
  renderCustomerReplyEmail,
  renderNewOrderAlertEmail,
  renderOrderConfirmationEmail,
  renderShippingEmail,
  escapeHtml,
  type EmailContent,
} from "@/lib/email-templates";
import { getEmailSettings, sendEmail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const templateIds = [
  "confirmation",
  "alerte",
  "expedition",
  "reponse",
] as const;

type TemplateId = (typeof templateIds)[number];

const templateLabels: Record<TemplateId, string> = {
  confirmation: "Confirmation de commande (au client)",
  alerte: "Alerte nouvelle commande (à moi)",
  expedition: "Commande expédiée",
  reponse: "Réponse à un message client",
};

function getTestToken() {
  const raw = process.env.MAXI_EMAIL_TEST_TOKEN;

  if (typeof raw !== "string") {
    return "";
  }

  const value = raw.trim();

  if (!value || value.toLowerCase().includes("remplacez_moi")) {
    return "";
  }

  return value;
}

function notFound() {
  return new Response(JSON.stringify({ error: "Introuvable." }), {
    status: 404,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

function htmlResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

function sanitizeTemplate(value: unknown): TemplateId {
  return templateIds.find((id) => id === value) ?? "confirmation";
}

function buildSampleContent(
  templateId: TemplateId,
  siteUrl: string,
  supportEmail: string,
): EmailContent {
  if (templateId === "expedition") {
    return renderShippingEmail({
      customerName: "Client Test",
      orderNumber: "MT-DROP-TEST-0001",
      trackingNumber: "TEST123456789FR",
      shippingMethodLabel: "Livraison suivie à domicile",
      shippingAddress: {
        name: "Client Test",
        street: "1 rue de l'Exemple",
        postalCode: "75001",
        city: "Paris",
        country: "France",
      },
      lines: [
        { name: "Article de démonstration (email de test)", quantity: 1 },
      ],
      siteUrl,
      supportEmail,
    });
  }

  if (templateId === "alerte") {
    return renderNewOrderAlertEmail({
      orderNumber: "MT-DROP-TEST-0001",
      orderDateIso: new Date().toISOString(),
      customerName: "Client Test",
      customerEmail: "client-test@exemple.fr",
      customerPhone: "06 00 00 00 00",
      shippingAddress: {
        name: "Client Test",
        street: "1 rue de l'Exemple",
        postalCode: "75001",
        city: "Paris",
        country: "FR",
      },
      shippingMethodLabel: "Livraison suivie à domicile",
      lines: [
        {
          name: "Article de démonstration (email de test)",
          quantity: 1,
          unitPriceCents: 1990,
          supplierName: "Fournisseur de démonstration",
          supplierSku: "REF-DEMO-0001",
          supplierPriceCents: 640,
        },
      ],
      totalPaidCents: 2380,
      supplierTotalCents: 640,
      estimatedMarginCents: 1350,
      stripeSessionId: "cs_test_exemple",
      warnings: [
        "Ceci est un email de démonstration : aucune commande réelle n'est concernée.",
      ],
      siteUrl,
      supportEmail,
    });
  }

  if (templateId === "reponse") {
    return renderCustomerReplyEmail({
      customerName: "Client Test",
      productName: "Article de démonstration (email de test)",
      originalMessage:
        "Bonjour, ce message est un exemple pour tester l'affichage.",
      replyText:
        "Ceci est un email de TEST envoyé depuis la page de vérification de Maxi Trouvaille.\n\nAucun vrai client n'a reçu ce message. Si vous lisez ces lignes, l'envoi d'emails fonctionne.",
      siteUrl,
      supportEmail,
    });
  }

  return renderOrderConfirmationEmail({
    customerName: "Client Test",
    orderNumber: "MT-DROP-TEST-0001",
    orderDateIso: new Date().toISOString(),
    lines: [
      {
        name: "Article de démonstration (email de test)",
        quantity: 1,
        unitPriceCents: 1990,
      },
    ],
    itemsTotalCents: 1990,
    shippingPriceCents: 390,
    totalPaidCents: 2380,
    shippingMethodLabel: "Livraison suivie à domicile",
    shippingAddress: {
      name: "Client Test",
      street: "1 rue de l'Exemple",
      postalCode: "75001",
      city: "Paris",
      country: "France",
    },
    deliveryEstimate: "7 à 14 jours ouvrés",
    siteUrl,
    supportEmail,
  });
}

function renderPage(message: string, tone: "info" | "ok" | "error") {
  const colors = {
    info: { background: "#fbfaf7", border: "#e8e1d5", text: "#625f58" },
    ok: { background: "#eef8f6", border: "#0f766e", text: "#0f766e" },
    error: { background: "#fdf2f4", border: "#be123c", text: "#be123c" },
  }[tone];

  const settings = getEmailSettings();
  const options = templateIds
    .map(
      (id) =>
        `<option value="${id}">${escapeHtml(templateLabels[id])}</option>`,
    )
    .join("");

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Test des emails - Maxi Trouvaille</title>
  </head>
  <body style="margin:0;background:#fbfaf7;font-family:Arial,Helvetica,sans-serif;color:#171717;">
    <div style="max-width:560px;margin:0 auto;padding:28px 16px;">
      <h1 style="font-size:22px;margin:0 0 6px 0;">Test des emails</h1>
      <p style="margin:0 0 18px 0;color:#625f58;font-size:14px;">Envoie un email d'exemple pour vérifier que tout fonctionne. Aucun vrai client n'est contacté.</p>

      <div style="padding:12px 14px;border-radius:10px;background:${colors.background};border:1px solid ${colors.border};color:${colors.text};font-size:14px;line-height:1.6;margin-bottom:18px;">
        ${message}
      </div>

      <div style="padding:12px 14px;border-radius:10px;background:#ffffff;border:1px solid #e8e1d5;font-size:13px;line-height:1.6;color:#625f58;margin-bottom:18px;">
        <strong style="color:#171717;">État actuel</strong><br />
        Clé d'envoi : ${settings.apiKey ? "présente" : "<strong>absente</strong> (aucun email ne partira)"}<br />
        Interrupteur MAXI_EMAILS_ENABLED : ${settings.disabledBySwitch ? "<strong>sur off</strong>" : "ouvert"}<br />
        Adresse d'expédition : ${escapeHtml(settings.from)}${settings.hasCustomFrom ? "" : " (adresse de test Resend : n'envoie qu'à votre propre adresse d'inscription)"}<br />
        Réponses dirigées vers : ${escapeHtml(settings.replyTo)}
      </div>

      <form method="post" style="background:#ffffff;border:1px solid #e8e1d5;border-radius:12px;padding:16px;">
        <label style="display:block;font-size:13px;font-weight:bold;margin-bottom:4px;">Code d'accès</label>
        <input type="password" name="token" required style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #e8e1d5;border-radius:8px;font-size:16px;margin-bottom:14px;" />

        <label style="display:block;font-size:13px;font-weight:bold;margin-bottom:4px;">Envoyer le test à</label>
        <input type="email" name="to" required placeholder="votre@email.fr" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #e8e1d5;border-radius:8px;font-size:16px;margin-bottom:14px;" />

        <label style="display:block;font-size:13px;font-weight:bold;margin-bottom:4px;">Quel email tester</label>
        <select name="template" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #e8e1d5;border-radius:8px;font-size:16px;margin-bottom:16px;">${options}</select>

        <button type="submit" style="width:100%;padding:13px;border:0;border-radius:8px;background:#171717;color:#ffffff;font-size:15px;font-weight:bold;cursor:pointer;">Envoyer l'email de test</button>
      </form>
    </div>
  </body>
</html>`;
}

export async function GET() {
  if (!getTestToken()) {
    return notFound();
  }

  return htmlResponse(
    renderPage(
      "Renseigne ton code d'accès et ton adresse email, puis choisis l'email à tester.",
      "info",
    ),
  );
}

export async function POST(request: Request) {
  const expectedToken = getTestToken();

  if (!expectedToken) {
    return notFound();
  }

  const contentType = request.headers.get("content-type") ?? "";
  let token = "";
  let to = "";
  let templateId: TemplateId = "confirmation";
  let wantsJson = false;

  try {
    if (contentType.includes("application/json")) {
      wantsJson = true;
      const payload = (await request.json()) as Record<string, unknown>;
      token = String(payload.token ?? "").trim();
      to = String(payload.to ?? "").trim();
      templateId = sanitizeTemplate(payload.template);
    } else {
      const formData = await request.formData();
      token = String(formData.get("token") ?? "").trim();
      to = String(formData.get("to") ?? "").trim();
      templateId = sanitizeTemplate(formData.get("template"));
    }
  } catch {
    return wantsJson
      ? Response.json({ error: "Requete invalide." }, { status: 400 })
      : htmlResponse(renderPage("Requête invalide.", "error"), 400);
  }

  if (token !== expectedToken) {
    return wantsJson
      ? Response.json({ error: "Code d'acces incorrect." }, { status: 403 })
      : htmlResponse(renderPage("Code d'accès incorrect.", "error"), 403);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return wantsJson
      ? Response.json({ error: "Adresse email invalide." }, { status: 400 })
      : htmlResponse(renderPage("Adresse email invalide.", "error"), 400);
  }

  const settings = getEmailSettings();
  const content = buildSampleContent(
    templateId,
    settings.siteUrl,
    settings.replyTo,
  );
  const result = await sendEmail({
    to,
    subject: `[TEST] ${content.subject}`,
    html: content.html,
    text: `Ceci est un email de TEST.\n\n${content.text}`,
  });

  if (wantsJson) {
    return Response.json({ result }, { status: result.ok ? 200 : 502 });
  }

  if (result.sent) {
    return htmlResponse(
      renderPage(
        `C'est parti : l'email « ${escapeHtml(templateLabels[templateId])} » a été envoyé à ${escapeHtml(to)}. Regarde ta boîte de réception (et les indésirables).`,
        "ok",
      ),
    );
  }

  if (result.ok) {
    return htmlResponse(
      renderPage(
        `Aucun email envoyé : ${escapeHtml(result.reason)}. Vérifie que la clé d'envoi est bien enregistrée chez l'hébergeur, puis relance un déploiement.`,
        "error",
      ),
    );
  }

  return htmlResponse(
    renderPage(
      `Le service d'envoi a refusé : ${escapeHtml(result.reason)}${result.detail ? ` — ${escapeHtml(result.detail)}` : ""}`,
      "error",
    ),
    502,
  );
}

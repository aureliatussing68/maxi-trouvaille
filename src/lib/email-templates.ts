/**
 * Gabarits d'emails Maxi Trouvaille.
 *
 * Ce fichier ne fait AUCUN appel reseau, ne lit AUCUNE variable
 * d'environnement et n'ecrit AUCUN fichier : il fabrique uniquement du
 * texte. Il est donc totalement inerte tant que personne ne l'appelle.
 *
 * Regle de contenu : aucun chiffre invente. Les delais, prix et adresses
 * affiches viennent tous de la commande reelle ou des pages publiques du
 * site (page Livraison : "7 a 14 jours ouvres").
 *
 * Seule exception a la regle « aucun import » : l'identite legale du vendeur.
 * Elle est lue depuis legal-identity.ts, jamais recopiee ici — l'article
 * R123-237 du code de commerce impose de l'afficher sur toute correspondance
 * professionnelle, et un jour ou l'autre elle changera.
 */

import {
  DELAI_RETRACTATION_JOURS,
  adressePostale,
  champFacultatif,
  identiteVendeurUneLigne,
  mentionTva,
  vendeurLegal,
} from "@/lib/legal-identity";

/**
 * Mention fiscale sous les totaux de l'email de confirmation — cet email fait
 * office de facture pour le client, la mention TVA doit donc y figurer.
 * Uniquement quand le statut est connu : un email envoye ne se corrige pas,
 * il ne doit jamais montrer le trou « [A COMPLETER ...] » des pages du site.
 */
function mentionFiscale() {
  return champFacultatif("statutTva") ? mentionTva() : "";
}

export type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

export type OrderEmailLine = {
  name: string;
  quantity: number;
  unitPriceCents?: number;
  totalPriceCents?: number;
  deliveryEstimate?: string;
};

export type OrderEmailAddress = {
  name?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
};

export type OrderConfirmationEmailInput = {
  customerName?: string;
  orderNumber?: string;
  orderDateIso?: string;
  lines?: OrderEmailLine[];
  itemsTotalCents?: number | null;
  shippingPriceCents?: number | null;
  totalPaidCents?: number | null;
  shippingMethodLabel?: string;
  shippingAddress?: OrderEmailAddress;
  deliveryEstimate?: string;
  siteUrl?: string;
  supportEmail?: string;
};

export type ShippingEmailInput = {
  customerName?: string;
  orderNumber?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippingMethodLabel?: string;
  shippingAddress?: OrderEmailAddress;
  lines?: OrderEmailLine[];
  siteUrl?: string;
  supportEmail?: string;
};

export type CustomerReplyEmailInput = {
  customerName?: string;
  productName?: string;
  productUrl?: string;
  originalMessage?: string;
  replyText: string;
  siteUrl?: string;
  supportEmail?: string;
};

/** Delai affiche publiquement sur la page /livraison du site. */
export const PUBLIC_DELIVERY_ESTIMATE = "7 à 14 jours ouvrés";

export const DEFAULT_SUPPORT_EMAIL = "contact@maxitrouvaille.fr";
export const DEFAULT_SITE_URL = "https://maxitrouvaille.fr";

const palette = {
  background: "#fbfaf7",
  paper: "#ffffff",
  text: "#171717",
  muted: "#625f58",
  line: "#e8e1d5",
  brand: "#ffbf38",
  brandDark: "#7a5a06",
  teal: "#0f766e",
  softTeal: "#eef8f6",
};

const fontStack = "Arial, Helvetica, sans-serif";

export function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatEuroCents(cents: number | null | undefined) {
  const safe =
    typeof cents === "number" && Number.isFinite(cents) ? Math.round(cents) : 0;
  return `${(Math.max(0, safe) / 100).toFixed(2).replace(".", ",")} €`;
}

function cleanText(value: unknown, maxLength = 400) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function getFirstName(fullName: string | undefined) {
  const name = cleanText(fullName, 120);
  if (!name) {
    return "";
  }

  return name.split(/\s+/)[0] ?? "";
}

function formatFrenchDate(iso: string | undefined) {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function normalizeSiteUrl(siteUrl: string | undefined) {
  const value = cleanText(siteUrl, 200) || DEFAULT_SITE_URL;
  return value.replace(/\/+$/, "");
}

function safeUrl(value: string | undefined) {
  const raw = cleanText(value, 500);

  if (!raw) {
    return "";
  }

  return /^https?:\/\//i.test(raw) ? raw : "";
}

function paragraphsToHtml(value: string) {
  return cleanText(value, 4000)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 14px 0;">${escapeHtml(block).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");
}

function renderButton(label: string, url: string) {
  const href = safeUrl(url);

  if (!href) {
    return "";
  }

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 6px 0;">
      <tr>
        <td style="border-radius:8px;background:${palette.text};">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 22px;font-family:${fontStack};font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`;
}

function renderShell({
  title,
  preheader,
  bodyHtml,
  siteUrl,
  supportEmail,
}: {
  title: string;
  preheader: string;
  bodyHtml: string;
  siteUrl: string;
  supportEmail: string;
}) {
  const year = new Date().getFullYear();
  const homeUrl = normalizeSiteUrl(siteUrl);

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${palette.background};">
    <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${palette.background};">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${palette.background};padding:24px 10px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${palette.paper};border:1px solid ${palette.line};border-radius:14px;overflow:hidden;">
            <tr>
              <td style="background:${palette.brand};padding:22px 24px;">
                <div style="font-family:${fontStack};font-size:22px;font-weight:bold;color:${palette.text};letter-spacing:-0.3px;">Maxi Trouvaille</div>
                <div style="font-family:${fontStack};font-size:13px;color:${palette.brandDark};padding-top:4px;">Boutique en ligne à petits prix</div>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 24px 8px 24px;font-family:${fontStack};font-size:15px;line-height:1.65;color:${palette.text};">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="background:${palette.background};border-top:1px solid ${palette.line};padding:18px 24px;font-family:${fontStack};font-size:12px;line-height:1.6;color:${palette.muted};">
                <p style="margin:0 0 6px 0;">Une question ? Répondez simplement à cet email, ou écrivez à <a href="mailto:${escapeHtml(supportEmail)}" style="color:${palette.teal};">${escapeHtml(supportEmail)}</a>.</p>
                <p style="margin:0 0 10px 0;"><a href="${escapeHtml(homeUrl)}" style="color:${palette.teal};">maxitrouvaille.fr</a> — © ${year} Maxi Trouvaille</p>
                <p style="margin:0;border-top:1px solid ${palette.line};padding-top:10px;">${escapeHtml(identiteVendeurUneLigne())}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderLinesTable(lines: OrderEmailLine[]) {
  if (lines.length === 0) {
    return "";
  }

  const rows = lines
    .map((line) => {
      const quantity = Math.max(1, Math.trunc(Number(line.quantity)) || 1);
      const unit =
        typeof line.unitPriceCents === "number" ? line.unitPriceCents : null;
      const total =
        typeof line.totalPriceCents === "number"
          ? line.totalPriceCents
          : unit === null
            ? null
            : unit * quantity;
      const estimate = cleanText(line.deliveryEstimate, 120);

      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${palette.line};font-family:${fontStack};font-size:14px;color:${palette.text};">
            <strong>${escapeHtml(cleanText(line.name, 220) || "Article")}</strong><br />
            <span style="font-size:13px;color:${palette.muted};">Quantité : ${quantity}${
              unit === null
                ? ""
                : ` — ${escapeHtml(formatEuroCents(unit))} l'unité`
            }</span>
            ${estimate ? `<br /><span style="font-size:13px;color:${palette.muted};">Livraison estimée : ${escapeHtml(estimate)}</span>` : ""}
          </td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid ${palette.line};font-family:${fontStack};font-size:14px;font-weight:bold;color:${palette.text};white-space:nowrap;">
            ${total === null ? "" : escapeHtml(formatEuroCents(total))}
          </td>
        </tr>`;
    })
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:6px 0 4px 0;">
      ${rows}
    </table>`;
}

function renderTotalsRow(label: string, value: string, strong = false) {
  return `
    <tr>
      <td style="padding:6px 0;font-family:${fontStack};font-size:${strong ? "16px" : "14px"};color:${strong ? palette.text : palette.muted};${strong ? "font-weight:bold;" : ""}">${escapeHtml(label)}</td>
      <td align="right" style="padding:6px 0;font-family:${fontStack};font-size:${strong ? "16px" : "14px"};color:${palette.text};font-weight:bold;white-space:nowrap;">${escapeHtml(value)}</td>
    </tr>`;
}

function renderAddressBlock(
  address: OrderEmailAddress | undefined,
  methodLabel: string,
) {
  const name = cleanText(address?.name, 160);
  const street = cleanText(address?.street, 250);
  const postalCode = cleanText(address?.postalCode, 20);
  const city = cleanText(address?.city, 120);
  const country = cleanText(address?.country, 80);
  const cityLine = [postalCode, city].filter(Boolean).join(" ");
  const parts = [name, street, cityLine, country].filter(Boolean);

  if (parts.length === 0 && !methodLabel) {
    return "";
  }

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:18px 0 4px 0;background:${palette.background};border:1px solid ${palette.line};border-radius:10px;">
      <tr>
        <td style="padding:14px 16px;font-family:${fontStack};font-size:14px;line-height:1.6;color:${palette.text};">
          <strong style="font-size:13px;text-transform:uppercase;letter-spacing:0.4px;color:${palette.muted};">Livraison</strong><br />
          ${parts.map((part) => escapeHtml(part)).join("<br />")}
          ${methodLabel ? `${parts.length ? "<br />" : ""}<span style="color:${palette.muted};">Mode choisi : ${escapeHtml(methodLabel)}</span>` : ""}
        </td>
      </tr>
    </table>`;
}

function addressToText(
  address: OrderEmailAddress | undefined,
  methodLabel: string,
) {
  const name = cleanText(address?.name, 160);
  const street = cleanText(address?.street, 250);
  const cityLine = [
    cleanText(address?.postalCode, 20),
    cleanText(address?.city, 120),
  ]
    .filter(Boolean)
    .join(" ");
  const country = cleanText(address?.country, 80);
  const parts = [name, street, cityLine, country].filter(Boolean);

  if (parts.length === 0 && !methodLabel) {
    return "";
  }

  const lines = ["Livraison :", ...parts];

  if (methodLabel) {
    lines.push(`Mode choisi : ${methodLabel}`);
  }

  return lines.join("\n");
}

function linesToText(lines: OrderEmailLine[]) {
  return lines
    .map((line) => {
      const quantity = Math.max(1, Math.trunc(Number(line.quantity)) || 1);
      const unit =
        typeof line.unitPriceCents === "number" ? line.unitPriceCents : null;
      const total =
        typeof line.totalPriceCents === "number"
          ? line.totalPriceCents
          : unit === null
            ? null
            : unit * quantity;

      const priceText = total === null ? "" : ` — ${formatEuroCents(total)}`;
      return `- ${cleanText(line.name, 220) || "Article"} x${quantity}${priceText}`;
    })
    .join("\n");
}

/**
 * Bloc de retractation joint a la confirmation de commande.
 *
 * POURQUOI IL EXISTE
 * ------------------
 * L'article L221-13 du code de la consommation impose de confirmer la commande
 * « sur un support durable » AVEC les informations legales, dont le droit de
 * retractation et le formulaire type. Une page du site ne vaut pas support
 * durable (arret CJUE Content Services, C-49/11) : l'email, si.
 *
 * L'email de confirmation ne contenait rien de tout cela — ni retractation, ni
 * garanties, ni identite du vendeur — alors que les CGV designent elles-memes
 * cet email comme la preuve de la commande.
 */
function renderRetractationTexte(siteUrl: string) {
  const site = normalizeSiteUrl(siteUrl);

  return [
    "— — —",
    `VOTRE DROIT DE RÉTRACTATION (${DELAI_RETRACTATION_JOURS} jours)`,
    `Vous disposez de ${DELAI_RETRACTATION_JOURS} jours à compter de la réception de votre commande pour changer d'avis, sans avoir à vous justifier et sans pénalité.`,
    `Pour l'exercer, écrivez-nous à ${champFacultatif("email")} ou à ${adressePostale()}. Toute déclaration sans ambiguïté suffit.`,
    "Frais de retour à votre charge, sauf si le produit est défectueux ou non conforme : dans ce cas nous les prenons en charge.",
    `Remboursement intégral, frais de livraison standard compris, au plus tard ${DELAI_RETRACTATION_JOURS} jours après réception de votre décision.`,
    "",
    "FORMULAIRE TYPE DE RÉTRACTATION (à utiliser seulement si vous le souhaitez)",
    `À l'attention de ${vendeurLegal()} — ${champFacultatif("nomCommercial")}, ${adressePostale()}, ${champFacultatif("email")} :`,
    "Je vous notifie ma rétractation du contrat portant sur la vente du bien ci-dessous.",
    "— Commandé le : ……  / Reçu le : ……",
    "— Numéro de commande : ……",
    "— Produit(s) : ……",
    "— Nom et adresse du consommateur : ……",
    "— Date : ……",
    "",
    "GARANTIES LÉGALES",
    "Vous bénéficiez de la garantie légale de conformité (2 ans, articles L217-3 et suivants du code de la consommation) et de la garantie des vices cachés (articles 1641 et suivants du code civil). Elles s'exercent auprès de nous, sans contact avec le partenaire logistique.",
    "",
    `Détail : ${site}/retractation — Conditions générales : ${site}/conditions-generales-vente`,
    identiteVendeurUneLigne(),
  ];
}

function renderRetractationHtml(siteUrl: string) {
  const site = normalizeSiteUrl(siteUrl);
  const lignes = [
    `<strong>Votre droit de rétractation (${DELAI_RETRACTATION_JOURS} jours)</strong>`,
    `Vous disposez de ${DELAI_RETRACTATION_JOURS} jours à compter de la réception de votre commande pour changer d'avis, sans avoir à vous justifier et sans pénalité. Écrivez-nous à ${champFacultatif("email")} ou à ${adressePostale()}.`,
    `Frais de retour à votre charge, sauf produit défectueux ou non conforme. Remboursement intégral, frais de livraison standard compris, au plus tard ${DELAI_RETRACTATION_JOURS} jours après réception de votre décision.`,
    `<strong>Garanties légales</strong> — garantie de conformité (2 ans, articles L217-3 et suivants du code de la consommation) et garantie des vices cachés (articles 1641 et suivants du code civil). Elles s'exercent auprès de nous.`,
    `Formulaire type de rétractation et modalités complètes : <a href="${escapeHtml(site)}/retractation" style="color:${palette.teal};">${escapeHtml(site)}/retractation</a> — Conditions générales : <a href="${escapeHtml(site)}/conditions-generales-vente" style="color:${palette.teal};">nos CGV</a>.`,
  ];

  return `
    <div style="margin-top:22px;border:1px solid ${palette.line};border-radius:10px;padding:16px;background:${palette.background};font-family:${fontStack};font-size:13px;line-height:1.6;color:${palette.muted};">
      ${lignes.map((ligne) => `<p style="margin:0 0 8px 0;">${ligne}</p>`).join("")}
    </div>`;
}

export function renderOrderConfirmationEmail(
  input: OrderConfirmationEmailInput,
): EmailContent {
  const siteUrl = normalizeSiteUrl(input.siteUrl);
  const supportEmail =
    cleanText(input.supportEmail, 180) || DEFAULT_SUPPORT_EMAIL;
  const firstName = getFirstName(input.customerName);
  const orderNumber = cleanText(input.orderNumber, 60);
  const orderDate = formatFrenchDate(input.orderDateIso);
  const lines = Array.isArray(input.lines) ? input.lines.slice(0, 40) : [];
  const methodLabel = cleanText(input.shippingMethodLabel, 120);
  const deliveryEstimate = cleanText(input.deliveryEstimate, 120);
  const trackingUrl = `${siteUrl}/suivi-colis`;

  const itemsTotal =
    typeof input.itemsTotalCents === "number" ? input.itemsTotalCents : null;
  const shippingPrice =
    typeof input.shippingPriceCents === "number"
      ? input.shippingPriceCents
      : null;
  const totalPaid =
    typeof input.totalPaidCents === "number" ? input.totalPaidCents : null;
  const expectedTotal =
    itemsTotal === null && shippingPrice === null
      ? null
      : (itemsTotal ?? 0) + (shippingPrice ?? 0);
  const discount =
    totalPaid !== null &&
    expectedTotal !== null &&
    expectedTotal - totalPaid > 0
      ? expectedTotal - totalPaid
      : 0;

  const subject = orderNumber
    ? `Merci ! Votre commande ${orderNumber} est confirmée`
    : "Merci ! Votre commande Maxi Trouvaille est confirmée";

  const totalsRows = [
    itemsTotal === null
      ? ""
      : renderTotalsRow("Articles", formatEuroCents(itemsTotal)),
    shippingPrice === null
      ? ""
      : renderTotalsRow(
          "Livraison",
          shippingPrice > 0 ? formatEuroCents(shippingPrice) : "Offerte",
        ),
    discount > 0
      ? renderTotalsRow("Remise appliquée", `- ${formatEuroCents(discount)}`)
      : "",
    totalPaid === null
      ? ""
      : renderTotalsRow("Total payé", formatEuroCents(totalPaid), true),
  ]
    .filter(Boolean)
    .join("");

  const bodyHtml = `
    <h1 style="margin:0 0 12px 0;font-size:23px;line-height:1.3;color:${palette.text};">${
      firstName
        ? `Merci ${escapeHtml(firstName)} !`
        : "Merci pour votre commande !"
    }</h1>
    <p style="margin:0 0 14px 0;">Votre paiement est bien reçu et votre commande est enregistrée. Nous préparons votre colis.</p>
    ${
      orderNumber || orderDate
        ? `<p style="margin:0 0 16px 0;font-size:14px;color:${palette.muted};">${[
            orderNumber
              ? `Commande n° <strong style="color:${palette.text};">${escapeHtml(orderNumber)}</strong>`
              : "",
            orderDate ? `du ${escapeHtml(orderDate)}` : "",
          ]
            .filter(Boolean)
            .join(" ")}</p>`
        : ""
    }
    ${
      lines.length
        ? `<h2 style="margin:22px 0 4px 0;font-size:16px;color:${palette.text};">Votre commande</h2>${renderLinesTable(lines)}`
        : ""
    }
    ${
      totalsRows
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:10px 0 4px 0;">${totalsRows}</table>`
        : ""
    }
    ${
      totalsRows && mentionFiscale()
        ? `<p style="margin:2px 0 4px 0;font-size:12px;color:${palette.muted};">${escapeHtml(mentionFiscale())}</p>`
        : ""
    }
    ${renderAddressBlock(input.shippingAddress, methodLabel)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:18px 0 4px 0;background:${palette.softTeal};border-radius:10px;">
      <tr>
        <td style="padding:14px 16px;font-family:${fontStack};font-size:14px;line-height:1.6;color:${palette.text};">
          <strong>Et maintenant ?</strong><br />
          ${
            deliveryEstimate
              ? `Livraison estimée : <strong>${escapeHtml(deliveryEstimate)}</strong>.<br />`
              : ""
          }
          Dès que votre colis part, vous recevez un email avec le numéro de suivi.
        </td>
      </tr>
    </table>
    ${renderButton("Suivre ma commande", trackingUrl)}
    <p style="margin:14px 0 18px 0;font-size:14px;color:${palette.muted};">Merci de votre confiance, et à très vite sur Maxi Trouvaille.</p>`;

  const textParts = [
    firstName ? `Merci ${firstName} !` : "Merci pour votre commande !",
    "",
    "Votre paiement est bien reçu et votre commande est enregistrée. Nous préparons votre colis.",
  ];

  if (orderNumber) {
    textParts.push(
      "",
      `Commande n° ${orderNumber}${orderDate ? ` du ${orderDate}` : ""}`,
    );
  }

  if (lines.length) {
    textParts.push("", "Votre commande :", linesToText(lines));
  }

  if (itemsTotal !== null) {
    textParts.push("", `Articles : ${formatEuroCents(itemsTotal)}`);
  }

  if (shippingPrice !== null) {
    textParts.push(
      `Livraison : ${shippingPrice > 0 ? formatEuroCents(shippingPrice) : "Offerte"}`,
    );
  }

  if (discount > 0) {
    textParts.push(`Remise appliquée : - ${formatEuroCents(discount)}`);
  }

  if (totalPaid !== null) {
    textParts.push(`Total payé : ${formatEuroCents(totalPaid)}`);
  }

  if ((itemsTotal !== null || totalPaid !== null) && mentionFiscale()) {
    textParts.push(mentionFiscale());
  }

  const addressText = addressToText(input.shippingAddress, methodLabel);

  if (addressText) {
    textParts.push("", addressText);
  }

  if (deliveryEstimate) {
    textParts.push("", `Livraison estimée : ${deliveryEstimate}`);
  }

  textParts.push(
    "",
    "Dès que votre colis part, vous recevez un email avec le numéro de suivi.",
    `Suivi de commande : ${trackingUrl}`,
    "",
    `Une question ? Répondez à cet email ou écrivez à ${supportEmail}.`,
    "Merci de votre confiance, et à très vite sur Maxi Trouvaille.",
    "",
    ...renderRetractationTexte(siteUrl),
  );

  return {
    subject,
    html: renderShell({
      title: subject,
      preheader: "Votre paiement est bien reçu, nous préparons votre colis.",
      bodyHtml: `${bodyHtml}${renderRetractationHtml(siteUrl)}`,
      siteUrl,
      supportEmail,
    }),
    text: textParts.join("\n"),
  };
}

export function renderShippingEmail(input: ShippingEmailInput): EmailContent {
  const siteUrl = normalizeSiteUrl(input.siteUrl);
  const supportEmail =
    cleanText(input.supportEmail, 180) || DEFAULT_SUPPORT_EMAIL;
  const firstName = getFirstName(input.customerName);
  const orderNumber = cleanText(input.orderNumber, 60);
  const trackingNumber = cleanText(input.trackingNumber, 80);
  const methodLabel = cleanText(input.shippingMethodLabel, 120);
  const lines = Array.isArray(input.lines) ? input.lines.slice(0, 40) : [];
  const trackingPageUrl = `${siteUrl}/suivi-colis`;
  const trackingUrl = safeUrl(input.trackingUrl) || trackingPageUrl;

  const subject = orderNumber
    ? `Votre commande ${orderNumber} est expédiée`
    : "Votre commande Maxi Trouvaille est expédiée";

  const bodyHtml = `
    <h1 style="margin:0 0 12px 0;font-size:23px;line-height:1.3;color:${palette.text};">${
      firstName
        ? `Bonne nouvelle ${escapeHtml(firstName)} !`
        : "Bonne nouvelle !"
    }</h1>
    <p style="margin:0 0 14px 0;">Votre colis vient de partir${orderNumber ? ` (commande n° <strong>${escapeHtml(orderNumber)}</strong>)` : ""}.</p>
    ${
      trackingNumber
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:16px 0 4px 0;background:${palette.softTeal};border-radius:10px;">
      <tr>
        <td style="padding:16px;font-family:${fontStack};font-size:14px;line-height:1.6;color:${palette.text};">
          <span style="font-size:13px;text-transform:uppercase;letter-spacing:0.4px;color:${palette.muted};">Numéro de suivi</span><br />
          <strong style="font-size:19px;letter-spacing:0.5px;">${escapeHtml(trackingNumber)}</strong>
          ${methodLabel ? `<br /><span style="color:${palette.muted};">${escapeHtml(methodLabel)}</span>` : ""}
        </td>
      </tr>
    </table>`
        : `<p style="margin:0 0 14px 0;">Le numéro de suivi vous sera communiqué dès qu'il est disponible.</p>`
    }
    ${renderButton(trackingNumber ? "Suivre mon colis" : "Voir le suivi de commande", trackingUrl)}
    ${
      lines.length
        ? `<h2 style="margin:22px 0 4px 0;font-size:16px;color:${palette.text};">Dans ce colis</h2>${renderLinesTable(
            lines.map((line) => ({
              ...line,
              unitPriceCents: undefined,
              totalPriceCents: undefined,
            })),
          )}`
        : ""
    }
    ${renderAddressBlock(input.shippingAddress, methodLabel)}
    <p style="margin:18px 0;font-size:14px;color:${palette.muted};">Si le suivi n'affiche rien tout de suite, c'est normal : il peut mettre un peu de temps à se mettre à jour. En cas de doute, répondez à cet email, on vérifie pour vous.</p>`;

  const textParts = [
    firstName ? `Bonne nouvelle ${firstName} !` : "Bonne nouvelle !",
    "",
    `Votre colis vient de partir${orderNumber ? ` (commande n° ${orderNumber})` : ""}.`,
  ];

  if (trackingNumber) {
    textParts.push("", `Numéro de suivi : ${trackingNumber}`);

    if (methodLabel) {
      textParts.push(methodLabel);
    }
  } else {
    textParts.push(
      "",
      "Le numéro de suivi vous sera communiqué dès qu'il est disponible.",
    );
  }

  textParts.push("", `Suivi : ${trackingUrl}`);

  if (lines.length) {
    textParts.push(
      "",
      "Dans ce colis :",
      linesToText(
        lines.map((line) => ({
          ...line,
          unitPriceCents: undefined,
          totalPriceCents: undefined,
        })),
      ),
    );
  }

  const addressText = addressToText(input.shippingAddress, methodLabel);

  if (addressText) {
    textParts.push("", addressText);
  }

  textParts.push(
    "",
    "Si le suivi n'affiche rien tout de suite, c'est normal : il peut mettre un peu de temps à se mettre à jour.",
    `Une question ? Répondez à cet email ou écrivez à ${supportEmail}.`,
  );

  return {
    subject,
    html: renderShell({
      title: subject,
      preheader: trackingNumber
        ? `Numéro de suivi : ${trackingNumber}`
        : "Votre colis vient de partir.",
      bodyHtml,
      siteUrl,
      supportEmail,
    }),
    text: textParts.join("\n"),
  };
}

export function renderCustomerReplyEmail(
  input: CustomerReplyEmailInput,
): EmailContent {
  const siteUrl = normalizeSiteUrl(input.siteUrl);
  const supportEmail =
    cleanText(input.supportEmail, 180) || DEFAULT_SUPPORT_EMAIL;
  const firstName = getFirstName(input.customerName);
  const productName = cleanText(input.productName, 220);
  const productUrl = safeUrl(input.productUrl);
  const originalMessage = cleanText(input.originalMessage, 2000);
  const replyText = cleanText(input.replyText, 4000);

  const subject = productName
    ? `Votre question sur ${productName}`
    : "Votre message à Maxi Trouvaille";

  const bodyHtml = `
    <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:${palette.text};">${
      firstName ? `Bonjour ${escapeHtml(firstName)},` : "Bonjour,"
    }</h1>
    <p style="margin:0 0 14px 0;">Merci pour votre message${productName ? ` au sujet de <strong>${escapeHtml(productName)}</strong>` : ""}. Voici notre réponse.</p>
    <div style="margin:16px 0;padding:16px;background:${palette.background};border:1px solid ${palette.line};border-radius:10px;font-size:15px;line-height:1.65;color:${palette.text};">
      ${paragraphsToHtml(replyText) || `<p style="margin:0;">${escapeHtml(replyText)}</p>`}
    </div>
    ${
      originalMessage
        ? `<div style="margin:16px 0;padding:12px 16px;border-left:3px solid ${palette.line};font-size:13px;line-height:1.6;color:${palette.muted};">
      <strong style="display:block;margin-bottom:6px;">Votre message</strong>
      ${escapeHtml(originalMessage).replace(/\n/g, "<br />")}
    </div>`
        : ""
    }
    ${productUrl ? renderButton("Revoir le produit", productUrl) : ""}
    <p style="margin:18px 0;font-size:14px;color:${palette.muted};">Cette réponse ne répond pas complètement à votre question ? Répondez simplement à cet email, une personne de l'équipe vous répondra.</p>
    <p style="margin:0 0 18px 0;font-size:14px;">Belle journée,<br /><strong>L'équipe Maxi Trouvaille</strong></p>`;

  const textParts = [
    firstName ? `Bonjour ${firstName},` : "Bonjour,",
    "",
    `Merci pour votre message${productName ? ` au sujet de ${productName}` : ""}. Voici notre réponse.`,
    "",
    replyText,
  ];

  if (originalMessage) {
    textParts.push("", "Votre message :", originalMessage);
  }

  if (productUrl) {
    textParts.push("", `Revoir le produit : ${productUrl}`);
  }

  textParts.push(
    "",
    "Cette réponse ne répond pas complètement à votre question ? Répondez simplement à cet email, une personne de l'équipe vous répondra.",
    "",
    "Belle journée,",
    "L'équipe Maxi Trouvaille",
    `${supportEmail} — ${siteUrl}`,
  );

  return {
    subject,
    html: renderShell({
      title: subject,
      preheader: "Voici la réponse de Maxi Trouvaille à votre message.",
      bodyHtml,
      siteUrl,
      supportEmail,
    }),
    text: textParts.join("\n"),
  };
}

/* -------------------------------------------------------------------------
 * Email interne : une commande vient d'etre payee.
 *
 * Destinataire : le commercant, PAS le client. C'est un bon de travail, pas
 * un email commercial. Il contient donc volontairement ce qu'un email client
 * ne doit jamais contenir : reference fournisseur, prix d'achat, marge.
 *
 * Regle de conception : l'adresse doit pouvoir etre copiee-collee d'un bloc
 * dans le formulaire du fournisseur, sans retaper un seul caractere. C'est
 * la raison d'etre de cet email.
 * ---------------------------------------------------------------------- */

export type NewOrderAlertLine = OrderEmailLine & {
  supplierName?: string;
  supplierSku?: string;
  supplierUrl?: string;
  supplierPriceCents?: number;
};

export type NewOrderAlertEmailInput = {
  orderNumber?: string;
  orderDateIso?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: OrderEmailAddress;
  shippingMethodLabel?: string;
  lines?: NewOrderAlertLine[];
  totalPaidCents?: number | null;
  supplierTotalCents?: number | null;
  estimatedMarginCents?: number | null;
  stripeSessionId?: string;
  /** Anomalies detectees sur la commande (adresse incomplete, stock, ...). */
  warnings?: string[];
  siteUrl?: string;
  supportEmail?: string;
};

/**
 * Construit le bloc adresse pret a copier-coller.
 * Une ligne par champ, aucun libelle parasite : ce qui sort d'ici doit
 * pouvoir etre colle tel quel.
 */
function addressToCopyBlock(
  address: OrderEmailAddress | undefined,
  customerName: string,
  phone: string,
) {
  const lignes = [
    cleanText(address?.name, 160) || customerName,
    cleanText(address?.street, 250),
    [cleanText(address?.postalCode, 20), cleanText(address?.city, 120)]
      .filter(Boolean)
      .join(" "),
    cleanText(address?.country, 80),
    phone,
  ].filter(Boolean);

  return lignes.join("\n");
}

function renderSupplierLinesTable(lines: NewOrderAlertLine[]) {
  if (lines.length === 0) {
    return "";
  }

  const rows = lines
    .map((line) => {
      const nom = cleanText(line.name, 220) || "Article";
      const quantite = Math.max(1, Math.trunc(Number(line.quantity) || 1));
      const sku = cleanText(line.supplierSku, 120);
      const fournisseur = cleanText(line.supplierName, 120);
      const url = safeUrl(line.supplierUrl);
      const achat =
        typeof line.supplierPriceCents === "number"
          ? formatEuroCents(line.supplierPriceCents * quantite)
          : "";

      const details = [
        fournisseur ? `Fournisseur : ${escapeHtml(fournisseur)}` : "",
        sku ? `Référence : <strong>${escapeHtml(sku)}</strong>` : "",
        url
          ? `<a href="${escapeHtml(url)}" style="color:${palette.teal};">ouvrir la fiche fournisseur</a>`
          : "",
      ]
        .filter(Boolean)
        .join(" &middot; ");

      return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${palette.line};font-family:${fontStack};font-size:14px;line-height:1.5;color:${palette.text};">
          <strong>${escapeHtml(nom)}</strong> &times;${quantite}
          ${details ? `<div style="padding-top:4px;font-size:12px;color:${palette.muted};">${details}</div>` : ""}
        </td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid ${palette.line};font-family:${fontStack};font-size:14px;color:${palette.muted};white-space:nowrap;vertical-align:top;">${escapeHtml(achat)}</td>
      </tr>`;
    })
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:8px 0 4px 0;">
      <tr>
        <td style="padding:0 0 6px 0;font-family:${fontStack};font-size:12px;text-transform:uppercase;letter-spacing:0.4px;color:${palette.muted};">À commander chez le fournisseur</td>
        <td align="right" style="padding:0 0 6px 0;font-family:${fontStack};font-size:12px;text-transform:uppercase;letter-spacing:0.4px;color:${palette.muted};">Coût d'achat</td>
      </tr>
      ${rows}
    </table>`;
}

export function renderNewOrderAlertEmail(
  input: NewOrderAlertEmailInput,
): EmailContent {
  const siteUrl = normalizeSiteUrl(input.siteUrl);
  const supportEmail =
    cleanText(input.supportEmail, 180) || DEFAULT_SUPPORT_EMAIL;
  const orderNumber = cleanText(input.orderNumber, 60);
  const orderDate = formatFrenchDate(input.orderDateIso);
  const customerName = cleanText(input.customerName, 160);
  const customerEmail = cleanText(input.customerEmail, 180);
  const customerPhone = cleanText(input.customerPhone, 40);
  const methodLabel = cleanText(input.shippingMethodLabel, 120);
  const lines = Array.isArray(input.lines) ? input.lines.slice(0, 40) : [];
  const sessionId = cleanText(input.stripeSessionId, 120);
  const warnings = (Array.isArray(input.warnings) ? input.warnings : [])
    .map((value) => cleanText(value, 220))
    .filter(Boolean)
    .slice(0, 6);

  const totalPaid =
    typeof input.totalPaidCents === "number" ? input.totalPaidCents : null;
  const supplierTotal =
    typeof input.supplierTotalCents === "number"
      ? input.supplierTotalCents
      : null;
  const margin =
    typeof input.estimatedMarginCents === "number"
      ? input.estimatedMarginCents
      : totalPaid !== null && supplierTotal !== null
        ? totalPaid - supplierTotal
        : null;

  const montant = totalPaid === null ? "" : formatEuroCents(totalPaid);

  const subject = [
    "Commande payée",
    orderNumber ? `n° ${orderNumber}` : "",
    montant ? `— ${montant}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const copyBlock = addressToCopyBlock(
    input.shippingAddress,
    customerName,
    customerPhone,
  );

  const totalsRows = [
    totalPaid === null
      ? ""
      : renderTotalsRow("Encaissé (client)", formatEuroCents(totalPaid), true),
    supplierTotal === null
      ? ""
      : renderTotalsRow(
          "Coût fournisseur estimé",
          formatEuroCents(supplierTotal),
        ),
    margin === null
      ? ""
      : renderTotalsRow("Marge estimée", formatEuroCents(margin)),
  ]
    .filter(Boolean)
    .join("");

  const warningsHtml =
    warnings.length === 0
      ? ""
      : `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:18px 0 4px 0;background:#fff7ed;border:1px solid #fdba74;border-radius:10px;">
      <tr>
        <td style="padding:14px 16px;font-family:${fontStack};font-size:14px;line-height:1.6;color:${palette.text};">
          <strong style="font-size:13px;text-transform:uppercase;letter-spacing:0.4px;color:#9a3412;">À vérifier avant de commander</strong>
          <ul style="margin:8px 0 0 0;padding-left:18px;">
            ${warnings.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}
          </ul>
        </td>
      </tr>
    </table>`;

  const bodyHtml = `
    <h1 style="margin:0 0 6px 0;font-size:21px;line-height:1.3;color:${palette.text};">Commande payée${orderNumber ? ` — ${escapeHtml(orderNumber)}` : ""}</h1>
    <p style="margin:0 0 18px 0;color:${palette.muted};font-size:14px;">${[orderDate, montant ? `${montant} encaissés` : ""].filter(Boolean).join(" &middot; ")}</p>
    ${warningsHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:18px 0 4px 0;background:${palette.softTeal};border:1px solid ${palette.teal};border-radius:10px;">
      <tr>
        <td style="padding:14px 16px;font-family:${fontStack};font-size:15px;line-height:1.7;color:${palette.text};">
          <strong style="font-size:13px;text-transform:uppercase;letter-spacing:0.4px;color:${palette.teal};">Adresse de livraison — à copier telle quelle</strong>
          <div style="padding-top:8px;font-family:Consolas, Menlo, monospace;font-size:14px;white-space:pre-line;">${escapeHtml(copyBlock || "adresse absente")}</div>
          ${methodLabel ? `<div style="padding-top:8px;font-size:13px;color:${palette.muted};">Mode choisi : ${escapeHtml(methodLabel)}</div>` : ""}
        </td>
      </tr>
    </table>
    ${renderSupplierLinesTable(lines)}
    ${totalsRows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:12px 0 4px 0;border-top:1px solid ${palette.line};">${totalsRows}</table>` : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:18px 0 4px 0;background:${palette.background};border:1px solid ${palette.line};border-radius:10px;">
      <tr>
        <td style="padding:14px 16px;font-family:${fontStack};font-size:14px;line-height:1.6;color:${palette.text};">
          <strong style="font-size:13px;text-transform:uppercase;letter-spacing:0.4px;color:${palette.muted};">Client</strong><br />
          ${[customerName, customerEmail, customerPhone]
            .filter(Boolean)
            .map((value) => escapeHtml(value))
            .join("<br />")}
          ${sessionId ? `<div style="padding-top:8px;font-size:12px;color:${palette.muted};">Session Stripe : ${escapeHtml(sessionId)}</div>` : ""}
        </td>
      </tr>
    </table>
    ${renderButton("Voir le paiement dans Stripe", "https://dashboard.stripe.com/payments")}`;

  const textParts = [
    `COMMANDE PAYÉE${orderNumber ? ` — ${orderNumber}` : ""}`,
    [orderDate, montant ? `${montant} encaissés` : ""]
      .filter(Boolean)
      .join(" | "),
  ];

  if (warnings.length > 0) {
    textParts.push("", "À VÉRIFIER AVANT DE COMMANDER :");
    warnings.forEach((value) => textParts.push(`- ${value}`));
  }

  textParts.push("", "ADRESSE DE LIVRAISON (à copier telle quelle) :", "");
  textParts.push(copyBlock || "adresse absente");

  if (methodLabel) {
    textParts.push("", `Mode choisi : ${methodLabel}`);
  }

  if (lines.length > 0) {
    textParts.push("", "À COMMANDER CHEZ LE FOURNISSEUR :");

    lines.forEach((line) => {
      const quantite = Math.max(1, Math.trunc(Number(line.quantity) || 1));
      const sku = cleanText(line.supplierSku, 120);
      const url = safeUrl(line.supplierUrl);
      const achat =
        typeof line.supplierPriceCents === "number"
          ? ` — achat ${formatEuroCents(line.supplierPriceCents * quantite)}`
          : "";

      textParts.push(
        `- ${cleanText(line.name, 220) || "Article"} x${quantite}${sku ? ` (réf. ${sku})` : ""}${achat}`,
      );

      if (url) {
        textParts.push(`  ${url}`);
      }
    });
  }

  textParts.push("");

  if (totalPaid !== null) {
    textParts.push(`Encaissé : ${formatEuroCents(totalPaid)}`);
  }

  if (supplierTotal !== null) {
    textParts.push(
      `Coût fournisseur estimé : ${formatEuroCents(supplierTotal)}`,
    );
  }

  if (margin !== null) {
    textParts.push(`Marge estimée : ${formatEuroCents(margin)}`);
  }

  textParts.push(
    "",
    "CLIENT :",
    ...[customerName, customerEmail, customerPhone].filter(Boolean),
  );

  if (sessionId) {
    textParts.push(`Session Stripe : ${sessionId}`);
  }

  textParts.push(
    "",
    "Paiements Stripe : https://dashboard.stripe.com/payments",
  );

  return {
    subject,
    html: renderShell({
      title: subject,
      preheader: `Adresse et références fournisseur prêtes${montant ? ` — ${montant}` : ""}.`,
      bodyHtml,
      siteUrl,
      supportEmail,
    }),
    text: textParts.join("\n"),
  };
}

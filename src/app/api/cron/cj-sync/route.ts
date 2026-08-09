/**
 * Synchronisation du suivi CJ — le dernier maillon automatique.
 *
 * Passe une fois par jour (cron Vercel, voir vercel.json) sur les commandes
 * au statut « commandé fournisseur » qui portent une référence CJ, demande
 * leur état à CJ, et dès qu'un numéro de suivi apparaît : la commande passe
 * à « expédié », le numéro est enregistré, et l'email d'expédition part au
 * client — avec les mêmes verrous anti-doublon que le passage manuel en
 * admin (sendDropshippingShippingEmail refuse tout second envoi).
 *
 * PROTECTION : la route accepte soit l'en-tête `Authorization: Bearer
 * <CRON_SECRET>` que Vercel ajoute lui-même à ses crons quand la variable
 * CRON_SECRET existe, soit `?token=<MAXI_DIAG_TOKEN>` pour un déclenchement
 * manuel de vérification. Sans l'un des deux : 404, comme le diagnostic.
 *
 * INERTE tant que le connecteur CJ n'est pas configuré : réponse « non
 * configuré », zéro appel réseau. Limite de débit CJ (1 requête/seconde en
 * palier gratuit) respectée par une pause entre chaque commande, et au plus
 * 20 commandes par passage — largement au-dessus du volume actuel.
 */

import { NextResponse } from "next/server";
import { getCjConfig, getCjOrderStatus } from "@/lib/cj-client";
import {
  readDropshippingOrders,
  updateDropshippingOrder,
} from "@/lib/dropshipping-server";
import { sendDropshippingShippingEmail } from "@/lib/order-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COMMANDES_MAX_PAR_PASSAGE = 20;
const PAUSE_ENTRE_APPELS_MS = 1100;

function attendre(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function accesAutorise(request: Request) {
  const cronSecret = (process.env.CRON_SECRET ?? "").trim();
  const diagToken = (process.env.MAXI_DIAG_TOKEN ?? "").trim();
  const authHeader = request.headers.get("authorization") ?? "";
  const queryToken = new URL(request.url).searchParams.get("token") ?? "";

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  return Boolean(
    diagToken &&
    !diagToken.toLowerCase().includes("remplacez") &&
    queryToken === diagToken,
  );
}

export async function GET(request: Request) {
  if (!accesAutorise(request)) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  const config = getCjConfig();

  if (!config.configured) {
    return NextResponse.json({
      etat: "connecteur CJ non configure — rien a faire",
      traitees: 0,
    });
  }

  const orders = await readDropshippingOrders();
  const aSuivre = orders
    .filter(
      (order) =>
        order.status === "commande-fournisseur" &&
        Boolean(order.supplierOrderReference) &&
        order.paymentStatus === "paid",
    )
    .slice(0, COMMANDES_MAX_PAR_PASSAGE);

  const resultats: Array<{
    orderNumber: string;
    issue: string;
  }> = [];

  for (const order of aSuivre) {
    try {
      const statut = await getCjOrderStatus(order.supplierOrderReference ?? "");

      if (!statut.trackNumber) {
        resultats.push({
          orderNumber: order.orderNumber,
          issue: `pas encore expedie (statut CJ : ${statut.cjStatus || "inconnu"})`,
        });
      } else {
        const misAJour = await updateDropshippingOrder(order.id, {
          status: "expedie",
          trackingNumber: statut.trackNumber,
          internalNote: `${order.internalNote ? `${order.internalNote} | ` : ""}Suivi ${statut.trackNumber} recupere automatiquement chez CJ.`,
        });

        let email = "commande introuvable apres mise a jour";

        if (misAJour) {
          const envoi = await sendDropshippingShippingEmail(misAJour);
          email = envoi.sent ? "email expedition envoye" : envoi.reason;
        }

        resultats.push({
          orderNumber: order.orderNumber,
          issue: `expedie, suivi ${statut.trackNumber}, ${email}`,
        });
      }
    } catch (error) {
      resultats.push({
        orderNumber: order.orderNumber,
        issue: `erreur CJ : ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    await attendre(PAUSE_ENTRE_APPELS_MS);
  }

  return NextResponse.json({
    etat: "ok",
    traitees: aSuivre.length,
    resultats,
  });
}

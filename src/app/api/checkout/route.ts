import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getCatalogProductById } from "@/lib/catalog-server";
import {
  getPublicDeliveryEstimate,
  isDropshippingProduct,
  isProductPurchasable,
} from "@/lib/catalog";
import { clampQuantity } from "@/lib/format";
import { validateShippingSelection } from "@/lib/shipping";
import { recordDropshippingCheckoutDraft } from "@/lib/dropshipping-server";

export const runtime = "nodejs";

type IncomingCartLine = {
  productId?: unknown;
  quantity?: unknown;
};

type CheckoutPayload = {
  items?: IncomingCartLine[];
  shipping?: unknown;
};

const stripeApiVersion = "2026-04-22.dahlia";

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

function getStripeProductImages(image: string, siteUrl: string) {
  if (/^https?:\/\//.test(image)) {
    return [image];
  }

  if (!siteUrl.startsWith("https://")) {
    return undefined;
  }

  return [new URL(image, `${siteUrl}/`).toString()];
}

function getStripeMode(secretKey: string) {
  if (
    secretKey.startsWith("sk_test_") &&
    secretKey.length > 30 &&
    !secretKey.includes("remplacez_moi") &&
    secretKey !== "sk_test_..."
  ) {
    return "test";
  }

  if (
    secretKey.startsWith("sk_live_") &&
    secretKey.length > 30 &&
    process.env.STRIPE_ENABLE_LIVE_PAYMENTS === "true"
  ) {
    return "live";
  }

  return null;
}

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return NextResponse.json(
      {
        error:
          "Paiement temporairement indisponible. Merci de reessayer plus tard.",
      },
      { status: 400 },
    );
  }

  const stripeMode = getStripeMode(secretKey);

  if (!stripeMode) {
    return NextResponse.json(
      {
        error:
          "Paiement temporairement indisponible. Merci de reessayer plus tard.",
      },
      { status: 400 },
    );
  }

  let payload: CheckoutPayload;

  try {
    payload = (await request.json()) as { items?: IncomingCartLine[] };
  } catch {
    return NextResponse.json({ error: "Panier invalide." }, { status: 400 });
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return NextResponse.json({ error: "Panier vide." }, { status: 400 });
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: stripeApiVersion,
  });
  const siteUrl = getSiteUrl();
  type CheckoutSessionCreateParams = NonNullable<
    Parameters<typeof stripe.checkout.sessions.create>[0]
  >;
  const lineItems: NonNullable<CheckoutSessionCreateParams["line_items"]> = [];
  const cartProducts = [];
  const seenProductIds = new Set<string>();
  const cartLines: Array<{ productId: string; quantity: number }> = [];

  for (const item of payload.items) {
    const productId = typeof item.productId === "string" ? item.productId : "";

    if (!productId || seenProductIds.has(productId)) {
      return NextResponse.json(
        { error: "Panier invalide : produit duplique ou absent." },
        { status: 400 },
      );
    }

    seenProductIds.add(productId);
    const product = await getCatalogProductById(productId);

    if (!product) {
      return NextResponse.json(
        { error: "Un produit du panier n'existe plus." },
        { status: 400 },
      );
    }

    if (!isProductPurchasable(product)) {
      return NextResponse.json(
        {
          error: `${product.name} n'est pas disponible a l'achat pour le moment.`,
        },
        { status: 400 },
      );
    }

    if (product.source !== "internal") {
      return NextResponse.json(
        {
          error:
            "Les annonces vendeur utiliseront un paiement marketplace separe lors d'une future version.",
        },
        { status: 400 },
      );
    }

    const quantity = clampQuantity(Number(item.quantity));
    if (quantity > product.stock) {
      return NextResponse.json(
        { error: `Stock insuffisant pour ${product.name}.` },
        { status: 400 },
      );
    }

    cartProducts.push(product);
    cartLines.push({ productId, quantity });
    lineItems.push({
      quantity,
      price_data: {
        currency: "eur",
        unit_amount: product.price,
        product_data: {
          name: product.name,
          description: product.shortDescription,
          images: getStripeProductImages(product.image, siteUrl),
          metadata: {
            productId: product.id,
            source: product.source,
            fulfillment: isDropshippingProduct(product)
              ? "dropshipping_partner"
              : "maxi_trouvaille",
            deliveryEstimate: getPublicDeliveryEstimate(product),
          },
        },
      },
    });
  }

  const shippingValidation = validateShippingSelection(
    payload.shipping,
    cartProducts,
  );

  if (!shippingValidation.ok) {
    return NextResponse.json(
      { error: shippingValidation.error },
      { status: 400 },
    );
  }

  if (shippingValidation.method.price > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: shippingValidation.method.price,
        product_data: {
          name: `Livraison - ${shippingValidation.method.label}`,
          description: shippingValidation.method.description,
          metadata: {
            shippingMethod: shippingValidation.method.id,
          },
        },
      },
    });
  }

  const customerEmail = shippingValidation.selection.customer.email.trim();
  const shippingCustomer = shippingValidation.selection.customer;
  const reviewProductIds = cartProducts.map((product) => product.id).join(",");

  let session: Stripe.Checkout.Session;

  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      customer_email: customerEmail || undefined,
      success_url: `${siteUrl}/paiement/succes?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/panier`,
      metadata: {
        project: "maxi-trouvaille",
        checkoutMode: stripeMode,
        hasDropshippingItems: cartProducts.some(isDropshippingProduct) ? "true" : "false",
        reviewProductIds: reviewProductIds.slice(0, 500),
        shippingMethod: shippingValidation.method.id,
        shippingPriceCents: String(shippingValidation.method.price),
        // Store only the minimum order handoff details needed by admin tools.
        shippingName: `${shippingCustomer.firstName} ${shippingCustomer.lastName}`
          .trim()
          .slice(0, 120),
        shippingStreet: shippingCustomer.street.slice(0, 250),
        shippingCity: shippingCustomer.city.slice(0, 120),
        shippingPostalCode: shippingCustomer.postalCode.slice(0, 20),
        shippingPhone: shippingCustomer.phone.slice(0, 80),
        shippingEmail: shippingCustomer.email.slice(0, 120),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Stripe a refuse la creation de la session.";

    return NextResponse.json(
      { error: `Erreur Stripe : ${message}` },
      { status: 400 },
    );
  }

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe n'a pas renvoye d'URL de paiement." },
      { status: 500 },
    );
  }

  try {
    await recordDropshippingCheckoutDraft({
      stripeSessionId: session.id,
      products: cartProducts,
      cartLines,
      shippingValidation,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Paiement Stripe prepare, mais l'enregistrement admin partenaire a echoue. Reessayez avant d'envoyer le client payer.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getCatalogProductById } from "@/lib/catalog-server";
import { clampQuantity } from "@/lib/format";
import { validateShippingSelection } from "@/lib/shipping";

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

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return NextResponse.json(
      {
        error:
          "Configuration Stripe test absente. Ajoutez STRIPE_SECRET_KEY=sk_test_... dans .env.local.",
      },
      { status: 400 },
    );
  }

  if (!secretKey.startsWith("sk_test_")) {
    return NextResponse.json(
      {
        error:
          "Paiement reel desactive. Utilisez uniquement une cle Stripe de test commencant par sk_test_.",
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

  for (const item of payload.items) {
    const productId = typeof item.productId === "string" ? item.productId : "";
    const product = await getCatalogProductById(productId);

    if (!product) {
      return NextResponse.json(
        { error: "Un produit du panier n'existe plus." },
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

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: lineItems,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    customer_email: customerEmail || undefined,
    success_url: `${siteUrl}/paiement/succes`,
    cancel_url: `${siteUrl}/panier`,
    metadata: {
      project: "maxi-trouvaille",
      checkoutMode: "test-only",
      shippingMethod: shippingValidation.method.id,
      shippingPriceCents: String(shippingValidation.method.price),
      // Test-mode shortcut. Production future: store full shipping/contact
      // details in an order table, then send only the internal order id to Stripe.
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

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe n'a pas renvoye d'URL de paiement." },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}

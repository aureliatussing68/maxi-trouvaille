import { NextResponse } from "next/server";
import { isAdminModeEnabled } from "@/lib/admin";
import { adminApiUnavailable } from "@/lib/admin-api";
import { categories, type Product } from "@/lib/catalog";
import { readQuickProducts, writeQuickProducts } from "@/lib/catalog-server";
import { defaultProductImage } from "@/lib/quick-products";
import {
  calculateDropshippingSalePrice,
  normalizeSupplierUrl,
  parseMoneyToCents,
  type DropshippingRoundingMode,
} from "@/lib/dropshipping-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function slugify(value: string) {
  return (
    normalizeText(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 72) || "produit-partenaire"
  );
}

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getBoolean(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value === "true" || value === "on" || value === "1";
}

const requiredValidationChecks = [
  {
    key: "validationSupplierLinkChecked",
    label: "Lien fournisseur verifie",
  },
  {
    key: "validationPriceMarginChecked",
    label: "Prix et marge verifies",
  },
  {
    key: "validationDeliveryStockChecked",
    label: "Stock et delai a confirmer",
  },
  {
    key: "validationNoAutoPurchaseConfirmed",
    label: "Aucun achat automatique",
  },
] as const;

function getMissingValidationChecks(formData: FormData) {
  return requiredValidationChecks
    .filter((check) => !getBoolean(formData, check.key))
    .map((check) => check.label);
}

function getDropshippingCategory(formData: FormData) {
  const categoryId = getString(formData, "categoryId");
  const category = categories.find((item) => item.id === categoryId);

  if (category && (category.id === "dropshipping" || category.parentId === "dropshipping")) {
    return category.id;
  }

  return "dropshipping-nouveautes";
}

function getImages(formData: FormData) {
  const images = getString(formData, "images")
    .split(/[\n,;]/)
    .map((image) => image.trim())
    .filter((image) => /^https?:\/\//.test(image) || image.startsWith("/uploads/"))
    .slice(0, 10);

  return images.length > 0 ? images : [defaultProductImage];
}

export async function POST(request: Request) {
  if (!isAdminModeEnabled()) {
    return adminApiUnavailable();
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Formulaire d'import invalide." },
      { status: 400 },
    );
  }
  const supplierUrl = normalizeSupplierUrl(getString(formData, "supplierUrl"));

  if (!supplierUrl) {
    return NextResponse.json(
      { error: "Ajoutez le lien fournisseur." },
      { status: 400 },
    );
  }

  const title = getString(formData, "title") || "Produit partenaire";
  if (title.length < 3) {
    return NextResponse.json(
      { error: "Ajoutez un titre produit plus precis." },
      { status: 400 },
    );
  }

  const missingValidationChecks = getMissingValidationChecks(formData);
  if (missingValidationChecks.length > 0) {
    return NextResponse.json(
      {
        error: `Validation humaine incomplete: ${missingValidationChecks.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const description =
    getString(formData, "description") ||
    "Produit neuf vendu par Maxi Trouvaille et expedie par partenaire logistique.";
  const supplierPriceCents = parseMoneyToCents(getString(formData, "supplierPrice"));
  const marginPercent = Number.parseFloat(getString(formData, "marginPercent")) || 0;
  const fixedMarginCents = parseMoneyToCents(getString(formData, "fixedMargin"));
  const roundingMode = (getString(formData, "roundingMode") ||
    "x90") as DropshippingRoundingMode;
  const calculated = calculateDropshippingSalePrice({
    supplierPriceCents,
    marginPercent,
    fixedMarginCents,
    roundingMode,
  });
  const manualSalePrice = parseMoneyToCents(getString(formData, "salePrice"));
  const salePriceCents = manualSalePrice || calculated.salePriceCents;

  if (supplierPriceCents <= 0) {
    return NextResponse.json(
      { error: "Ajoutez un prix fournisseur valide avant import." },
      { status: 400 },
    );
  }

  if (salePriceCents <= supplierPriceCents) {
    return NextResponse.json(
      { error: "Le prix de vente doit etre superieur au prix fournisseur." },
      { status: 400 },
    );
  }

  const supplierStock =
    Math.max(0, Math.trunc(Number(getString(formData, "supplierStock"))) || 0) || 1;
  const images = getImages(formData);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const isPromotion = getBoolean(formData, "isPromotion");
  const isNew = getBoolean(formData, "isNew");
  const compareAtPrice = parseMoneyToCents(getString(formData, "compareAtPrice"));
  const validationNote = getString(formData, "validationNote");

  const product: Product = {
    id: `quick_drop_${now}_${Math.random().toString(36).slice(2, 8)}`,
    slug: `${slugify(title)}-${now.toString(36)}`,
    name: title,
    categoryId: getDropshippingCategory(formData),
    price: salePriceCents,
    compareAtPrice: compareAtPrice > salePriceCents ? compareAtPrice : undefined,
    condition: "Neuf - produit partenaire",
    stock: supplierStock,
    badge: isPromotion ? "Promotion" : isNew ? "Nouveauté" : "Partenaire",
    image: images[0],
    images,
    shortDescription: description.slice(0, 150),
    description,
    features: [
      "Paiement securise sur Maxi Trouvaille",
      "Produit expedie par partenaire logistique",
      `Livraison estimee : ${getString(formData, "deliveryEstimate") || "8 a 15 jours ouvres"}`,
      "Suivi colis ajoute des que le fournisseur confirme l'expedition",
      "Service client Maxi Trouvaille",
    ],
    source: "internal",
    status: "draft",
    livraisonDisponible: "colissimo uniquement",
    dropshipping: {
      enabled: true,
      supplierName: getString(formData, "supplierName") || "Fournisseur partenaire",
      supplierUrl,
      supplierSku: getString(formData, "supplierSku"),
      supplierPriceCents,
      salePriceCents,
      marginCents: Math.max(0, salePriceCents - supplierPriceCents),
      supplierStock,
      deliveryEstimate: getString(formData, "deliveryEstimate") || "8 a 15 jours ouvres",
      isPromotion,
      isNew,
      logisticsPartnerLabel: "partenaire logistique",
      syncStatus: "manual",
      lastSyncAt: nowIso,
      validationGate: {
        source: getString(formData, "validationSource") || "admin-manual",
        checkedAt: nowIso,
        checks: requiredValidationChecks.map((check) => check.label),
        candidateId: getString(formData, "candidateId") || undefined,
        candidateCategory: getString(formData, "candidateCategory") || undefined,
        sourceGeneratedAt: getString(formData, "sourceGeneratedAt") || undefined,
        note: validationNote || undefined,
      },
    },
  };

  const products = await readQuickProducts();
  const updatedProducts = [product, ...products];
  await writeQuickProducts(updatedProducts);

  return NextResponse.json({ product, products: updatedProducts });
}

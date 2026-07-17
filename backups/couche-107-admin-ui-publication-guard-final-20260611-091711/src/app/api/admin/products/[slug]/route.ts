import { promises as fs } from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdminModeEnabled } from "@/lib/admin";
import { categories, getCategoryById, type Product } from "@/lib/catalog";
import { readQuickProducts, writeQuickProducts } from "@/lib/catalog-server";
import {
  defaultProductImage,
  getProductConditionLabel,
  normalizeProductCondition,
  parsePriceToCents,
} from "@/lib/quick-products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

type PhotoOrderItem = {
  id: string;
  type: "existing" | "new";
  value?: string;
};

const productStatuses = ["published", "draft", "archived"] as const;
const deliveryOptions = [
  "toutes",
  "remise uniquement",
  "mondial relay uniquement",
  "colissimo uniquement",
  "sur devis",
] as const;

type ProductPublicationEvidence = Product & {
  imageValidation?: {
    status?: string;
  };
  internalSourcing?: {
    validationStatus?: string;
  };
};

function getBoolean(value: FormDataEntryValue | null) {
  return value === "true" || value === "on" || value === "1";
}

function getExtension(file: File) {
  const fromName = path.extname(file.name).toLowerCase();
  if (fromName && fromName.length <= 8) {
    return fromName;
  }

  if (file.type === "image/png") {
    return ".png";
  }

  if (file.type === "image/webp") {
    return ".webp";
  }

  return ".jpg";
}

async function saveImages(files: File[]) {
  const images = files.slice(0, 10).filter((file) => file.size > 0);
  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "quick-products",
  );
  await fs.mkdir(uploadDir, { recursive: true });

  const savedPaths: string[] = [];
  for (const file of images) {
    if (!file.type.startsWith("image/")) {
      continue;
    }

    const filename = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}${getExtension(file)}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await fs.writeFile(path.join(uploadDir, filename), buffer);
    savedPaths.push(`/uploads/quick-products/${filename}`);
  }

  return savedPaths;
}

function parsePhotoOrder(value: FormDataEntryValue | null): PhotoOrderItem[] {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((item): PhotoOrderItem[] => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const maybeItem = item as Partial<PhotoOrderItem>;
      if (
        typeof maybeItem.id !== "string" ||
        (maybeItem.type !== "existing" && maybeItem.type !== "new")
      ) {
        return [];
      }

      return [
        {
          id: maybeItem.id,
          type: maybeItem.type,
          value: typeof maybeItem.value === "string" ? maybeItem.value : undefined,
        },
      ];
    });
  } catch {
    return [];
  }
}

function getStatus(value: FormDataEntryValue | null): Product["status"] {
  return productStatuses.some((status) => status === value)
    ? (value as Product["status"])
    : "published";
}

function getDeliveryAvailability(
  value: FormDataEntryValue | null,
): Product["livraisonDisponible"] {
  return deliveryOptions.some((option) => option === value)
    ? (value as Product["livraisonDisponible"])
    : "toutes";
}

function getBadge(status: Product["status"], stock: number) {
  if (status === "draft") {
    return "Brouillon";
  }

  if (status === "archived") {
    return "Archive";
  }

  return stock > 0 ? "Ajout rapide" : "Rupture";
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function includesHold(value: unknown) {
  return normalizeText(value).includes("hold");
}

function needsManualCheck(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return true;
  }

  return (
    normalized.includes("a verifier") ||
    normalized.includes("a confirmer") ||
    normalized.includes("estime") ||
    normalized.includes("estimated")
  );
}

function hasExactSupplierUrl(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return false;
  }

  if (
    normalized.includes("wholesale?") ||
    normalized.includes("searchtext=") ||
    normalized.includes("/w/wholesale-")
  ) {
    return false;
  }

  return true;
}

function isPartnerProductCandidate(product: Product) {
  return Boolean(
    product.dropshipping?.enabled ||
      product.categoryId === "dropshipping" ||
      product.categoryId.startsWith("dropshipping-"),
  );
}

function getPartnerPublicationBlockers(product: Product) {
  if (product.status !== "published" || !isPartnerProductCandidate(product)) {
    return [];
  }

  const evidence = product as ProductPublicationEvidence;
  const blockers: string[] = [];
  const dropshipping = product.dropshipping;

  if (
    includesHold(evidence.internalSourcing?.validationStatus) ||
    includesHold(dropshipping?.validationGate?.note)
  ) {
    blockers.push("signal HOLD encore present");
  }

  if (evidence.imageValidation?.status !== "verified_source_images") {
    blockers.push("images exactes non verifiees");
  }

  if (!hasExactSupplierUrl(dropshipping?.supplierUrl)) {
    blockers.push("lien fournisseur exact manquant");
  }

  if (!dropshipping?.supplierSku) {
    blockers.push("SKU fournisseur manquant");
  }

  if (!(dropshipping?.supplierPriceCents && dropshipping.supplierPriceCents > 0)) {
    blockers.push("prix fournisseur manquant");
  }

  if (!(dropshipping?.supplierStock && dropshipping.supplierStock > 0)) {
    blockers.push("stock fournisseur manquant");
  }

  if (needsManualCheck(dropshipping?.deliveryEstimate)) {
    blockers.push("delai livraison a verifier");
  }

  if (!dropshipping?.validationGate) {
    blockers.push("gate validation fournisseur manquante");
  }

  return blockers;
}

async function buildImageList(product: Product, formData: FormData) {
  const order = parsePhotoOrder(formData.get("photoOrder"));
  const existingImages = new Set(
    (product.images?.length ? product.images : [product.image]).filter(Boolean),
  );
  const newIds = formData.getAll("newImageIds").map(String);
  const newFiles = formData
    .getAll("newImages")
    .filter((entry): entry is File => entry instanceof File);
  const savedImages = await saveImages(newFiles);
  const savedById = new Map(
    newIds.map((id, index) => [id, savedImages[index]] as const),
  );

  const orderedImages = order.flatMap((item): string[] => {
    if (item.type === "existing" && item.value && existingImages.has(item.value)) {
      return [item.value];
    }

    if (item.type === "new") {
      const savedImage = savedById.get(item.id);
      return savedImage ? [savedImage] : [];
    }

    return [];
  });

  const uniqueImages = Array.from(new Set(orderedImages)).slice(0, 10);
  return uniqueImages.length > 0 ? uniqueImages : [defaultProductImage];
}

export async function GET(_request: Request, context: RouteContext) {
  if (!isAdminModeEnabled()) {
    return NextResponse.json({ error: "Mode admin desactive." }, { status: 403 });
  }

  const { slug } = await context.params;
  const product = (await readQuickProducts()).find((item) => item.slug === slug);

  if (!product) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }

  return NextResponse.json({ product });
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isAdminModeEnabled()) {
    return NextResponse.json({ error: "Mode admin desactive." }, { status: 403 });
  }

  const { slug } = await context.params;
  const quickProducts = await readQuickProducts();
  const productIndex = quickProducts.findIndex((product) => product.slug === slug);

  if (productIndex < 0) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }

  const currentProduct = quickProducts[productIndex];
  const formData = await request.formData();
  const title = String(formData.get("title") ?? currentProduct.name).trim();
  const description = String(
    formData.get("description") ?? currentProduct.description,
  ).trim();
  const categoryId = categories.some(
    (category) => category.id === formData.get("categoryId"),
  )
    ? String(formData.get("categoryId"))
    : currentProduct.categoryId;
  const condition = getProductConditionLabel(
    normalizeProductCondition(formData.get("condition")),
  );
  const stock = Math.max(
    0,
    Math.trunc(Number(formData.get("stock") ?? currentProduct.stock)) || 0,
  );
  const status = getStatus(formData.get("status"));
  const livraisonDisponible = getDeliveryAvailability(
    formData.get("livraisonDisponible"),
  );
  const dropshippingEnabled = getBoolean(formData.get("dropshippingEnabled"));
  const supplierPriceCents = parsePriceToCents(
    String(formData.get("supplierPrice") ?? ""),
  );
  const supplierStock = Math.max(
    0,
    Math.trunc(Number(formData.get("supplierStock") ?? 0)) || 0,
  );
  const deliveryEstimate = String(formData.get("deliveryEstimate") ?? "").trim();
  const supplierUrl = String(formData.get("supplierUrl") ?? "").trim();
  const supplierSku = String(formData.get("supplierSku") ?? "").trim();
  const isPromotion = getBoolean(formData.get("isPromotion"));
  const isNew = getBoolean(formData.get("isNew"));
  const images = await buildImageList(currentProduct, formData);
  const category = getCategoryById(categoryId);
  const price = parsePriceToCents(
    String(formData.get("price") ?? currentProduct.price / 100),
  );

  // Future marketplace: a seller will only edit listings matching their sellerId,
  // while an admin role will keep the right to edit every listing.
  const updatedProduct: Product = {
    ...currentProduct,
    name: title || currentProduct.name,
    description: description || "Produit ajoute rapidement.",
    shortDescription: (description || currentProduct.description).slice(0, 150),
    price,
    categoryId,
    condition,
    stock,
    badge: getBadge(status, stock),
    image: images[0],
    images,
    status,
    livraisonDisponible,
    dropshipping: dropshippingEnabled
      ? {
          enabled: true,
          supplierName:
            currentProduct.dropshipping?.supplierName ?? "Fournisseur partenaire",
          supplierUrl,
          supplierSku,
          supplierPriceCents,
          salePriceCents: price,
          marginCents: Math.max(0, price - supplierPriceCents),
          supplierStock,
          deliveryEstimate: deliveryEstimate || "8 a 15 jours ouvres",
          isPromotion,
          isNew,
          logisticsPartnerLabel: "partenaire logistique",
          syncStatus: "manual",
          lastSyncAt: currentProduct.dropshipping?.lastSyncAt,
          validationGate: currentProduct.dropshipping?.validationGate,
        }
      : undefined,
    features: [
      "Produit modifiable depuis l'admin Maxi Trouvaille",
      `Etat : ${condition}`,
      `Quantite disponible : ${stock}`,
      `Categorie : ${category?.name ?? "Categorie a verifier"}`,
      `Statut : ${status === "published" ? "publie" : status}`,
      `Livraison : ${livraisonDisponible}`,
      ...(dropshippingEnabled
        ? [
            "Mode produit partenaire : oui",
            `Prix fournisseur : ${(supplierPriceCents / 100).toFixed(2)} €`,
            `Marge estimee : ${(Math.max(0, price - supplierPriceCents) / 100).toFixed(2)} €`,
            `Delai fournisseur : ${deliveryEstimate || "8 a 15 jours ouvres"}`,
          ]
        : []),
    ],
  };

  const publicationBlockers = getPartnerPublicationBlockers(updatedProduct);
  if (publicationBlockers.length > 0) {
    return NextResponse.json(
      {
        error:
          "Publication bloquee: preuves dropshipping incompletes. Gardez le produit en brouillon/HOLD.",
        blockers: publicationBlockers,
      },
      { status: 400 },
    );
  }

  const updatedProducts = [...quickProducts];
  updatedProducts[productIndex] = updatedProduct;
  await writeQuickProducts(updatedProducts);

  revalidatePath("/boutique");
  revalidatePath(`/produit/${currentProduct.slug}`);
  revalidatePath(`/produit/${updatedProduct.slug}`);
  revalidatePath(`/admin/produits/${currentProduct.slug}/modifier`);

  return NextResponse.json({ product: updatedProduct });
}

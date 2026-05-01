import { promises as fs } from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdminModeEnabled } from "@/lib/admin";
import { categories, getCategoryById, type Product } from "@/lib/catalog";
import { readQuickProducts, writeQuickProducts } from "@/lib/catalog-server";
import { defaultProductImage, parsePriceToCents } from "@/lib/quick-products";

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
  const condition =
    formData.get("condition") === "neuf" ? "Neuf" : "Occasion";
  const stock = Math.max(
    0,
    Math.trunc(Number(formData.get("stock") ?? currentProduct.stock)) || 0,
  );
  const status = getStatus(formData.get("status"));
  const livraisonDisponible = getDeliveryAvailability(
    formData.get("livraisonDisponible"),
  );
  const images = await buildImageList(currentProduct, formData);
  const category = getCategoryById(categoryId);

  // Future marketplace: a seller will only edit listings matching their sellerId,
  // while an admin role will keep the right to edit every listing.
  const updatedProduct: Product = {
    ...currentProduct,
    name: title || currentProduct.name,
    description: description || "Produit ajoute rapidement.",
    shortDescription: (description || currentProduct.description).slice(0, 150),
    price: parsePriceToCents(String(formData.get("price") ?? currentProduct.price / 100)),
    categoryId,
    condition,
    stock,
    badge: getBadge(status, stock),
    image: images[0],
    images,
    status,
    livraisonDisponible,
    features: [
      "Produit modifiable depuis l'admin Maxi Trouvaille",
      `Etat : ${condition}`,
      `Quantite disponible : ${stock}`,
      `Categorie : ${category?.name ?? "Categorie a verifier"}`,
      `Statut : ${status === "published" ? "publie" : status}`,
      `Livraison : ${livraisonDisponible}`,
    ],
  };

  const updatedProducts = [...quickProducts];
  updatedProducts[productIndex] = updatedProduct;
  await writeQuickProducts(updatedProducts);

  revalidatePath("/boutique");
  revalidatePath(`/produit/${currentProduct.slug}`);
  revalidatePath(`/produit/${updatedProduct.slug}`);
  revalidatePath(`/admin/produits/${currentProduct.slug}/modifier`);

  return NextResponse.json({ product: updatedProduct });
}

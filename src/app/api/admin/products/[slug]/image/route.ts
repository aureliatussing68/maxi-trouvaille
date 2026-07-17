import { promises as fs } from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdminModeEnabled } from "@/lib/admin";
import { adminApiUnavailable } from "@/lib/admin-api";
import { readQuickProducts, writeQuickProducts } from "@/lib/catalog-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

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

async function saveImage(file: File) {
  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "quick-products",
  );
  await fs.mkdir(uploadDir, { recursive: true });

  const filename = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}${getExtension(file)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await fs.writeFile(path.join(uploadDir, filename), buffer);
  return `/uploads/quick-products/${filename}`;
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isAdminModeEnabled()) {
    return adminApiUnavailable();
  }

  const formData = await request.formData();
  const image = formData.get("image");

  if (!(image instanceof File) || !image.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Ajoutez une image valide." },
      { status: 400 },
    );
  }

  const { slug } = await context.params;
  const quickProducts = await readQuickProducts();
  const productIndex = quickProducts.findIndex((product) => product.slug === slug);

  if (productIndex < 0) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }

  const savedImage = await saveImage(image);
  const currentProduct = quickProducts[productIndex];
  const updatedProduct = {
    ...currentProduct,
    image: savedImage,
    images: [savedImage],
  };
  const updatedProducts = [...quickProducts];
  updatedProducts[productIndex] = updatedProduct;

  await writeQuickProducts(updatedProducts);

  revalidatePath("/boutique");
  revalidatePath("/admin/ajout-images");
  revalidatePath(`/produit/${updatedProduct.slug}`);

  return NextResponse.json({ product: updatedProduct });
}

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { createQuickProduct, type QuickProductInput } from "@/lib/quick-products";
import { readQuickProducts, writeQuickProducts } from "@/lib/catalog-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ products: await readQuickProducts() });
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

async function readInput(request: Request): Promise<QuickProductInput> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    return (await request.json()) as QuickProductInput;
  }

  const formData = await request.formData();
  const files = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File);
  const images = await saveImages(files);

  return {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    price: String(formData.get("price") ?? ""),
    categoryId: String(formData.get("categoryId") ?? "colis-surprise"),
    condition:
      formData.get("condition") === "neuf" || formData.get("condition") === "occasion"
        ? (formData.get("condition") as QuickProductInput["condition"])
        : "occasion",
    stock: String(formData.get("stock") ?? "1"),
    livraisonDisponible:
      formData.get("livraisonDisponible") === "remise uniquement" ||
      formData.get("livraisonDisponible") === "mondial relay uniquement" ||
      formData.get("livraisonDisponible") === "colissimo uniquement" ||
      formData.get("livraisonDisponible") === "sur devis"
        ? (formData.get("livraisonDisponible") as QuickProductInput["livraisonDisponible"])
        : "toutes",
    images,
  };
}

export async function POST(request: Request) {
  const input = await readInput(request);
  const product = createQuickProduct(input);
  const products = await readQuickProducts();

  await writeQuickProducts([product, ...products]);

  return NextResponse.json({ product });
}

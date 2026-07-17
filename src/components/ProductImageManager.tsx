"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/format";

export type ImageManagerProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  categoryName: string;
  image: string;
};

type UploadState = {
  status: "idle" | "uploading" | "done" | "error";
  message: string;
};

type ProductImageManagerProps = {
  products: ImageManagerProduct[];
};

export function ProductImageManager({ products }: ProductImageManagerProps) {
  const [items, setItems] = useState(products);
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function setUploadState(productId: string, state: UploadState) {
    setUploadStates((current) => ({ ...current, [productId]: state }));
  }

  async function uploadImage(product: ImageManagerProduct, file: File) {
    setUploadState(product.id, {
      status: "uploading",
      message: "Upload en cours...",
    });

    try {
      const body = new FormData();
      body.append("image", file);

      const response = await fetch(
        `/api/admin/products/${encodeURIComponent(product.slug)}/image`,
        {
          method: "PATCH",
          body,
        },
      );
      const data = (await response.json()) as {
        product?: { image?: string };
        error?: string;
      };

      if (!response.ok || !data.product?.image) {
        throw new Error(data.error ?? "Upload impossible.");
      }

      setItems((current) =>
        current.map((item) =>
          item.id === product.id ? { ...item, image: data.product?.image ?? item.image } : item,
        ),
      );
      setUploadState(product.id, {
        status: "done",
        message: "Image ajoutee.",
      });
    } catch (error) {
      setUploadState(product.id, {
        status: "error",
        message: error instanceof Error ? error.message : "Upload impossible.",
      });
    } finally {
      const input = inputRefs.current[product.id];
      if (input) {
        input.value = "";
      }
    }
  }

  return (
    <section className="container-page py-8">
      <div className="grid gap-3">
        {items.map((product) => {
          const state = uploadStates[product.id] ?? {
            status: "idle",
            message: "Image temporaire",
          };
          const isUploading = state.status === "uploading";

          return (
            <article
              key={product.id}
              className="grid gap-4 rounded-lg border border-line bg-paper p-4 shadow-sm md:grid-cols-[120px_1fr_auto]"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-line bg-[#ede7db]">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="120px"
                  className="object-cover"
                />
              </div>

              <div className="min-w-0">
                <h2 className="text-base font-black leading-6">{product.name}</h2>
                <div className="mt-2 flex flex-wrap gap-2 text-sm font-bold text-muted">
                  <span>{formatPrice(product.price)}</span>
                  <span>·</span>
                  <span>{product.categoryName}</span>
                </div>
                <p
                  className={`mt-2 text-sm font-bold ${
                    state.status === "error" ? "text-rose" : "text-muted"
                  }`}
                >
                  {state.message}
                </p>
              </div>

              <div className="flex items-center">
                <input
                  ref={(input) => {
                    inputRefs.current[product.id] = input;
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      uploadImage(product, file);
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => inputRefs.current[product.id]?.click()}
                  className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-black text-white hover:bg-[#2b2b2b] disabled:cursor-not-allowed disabled:opacity-65 md:w-auto"
                >
                  {isUploading ? (
                    <Loader2 className="animate-spin" size={18} aria-hidden="true" />
                  ) : (
                    <ImagePlus size={18} aria-hidden="true" />
                  )}
                  Ajouter image
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

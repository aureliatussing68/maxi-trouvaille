"use client";

import type { DragEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Save,
  Star,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { ProductStatsBadges } from "@/components/ProductEngagement";
import { categories, type Product } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import type { ProductStats } from "@/lib/product-stats";

type ProductEditFormProps = {
  product: Product;
  stats: ProductStats;
};

type ProductStatus = NonNullable<Product["status"]>;

type EditablePhoto =
  | {
      id: string;
      type: "existing";
      url: string;
    }
  | {
      id: string;
      type: "new";
      file: File;
      previewUrl: string;
    };

const maxPhotos = 10;

function getConditionValue(condition: string) {
  return condition.toLowerCase().includes("neuf") ? "neuf" : "occasion";
}

function getInitialPhotos(product: Product): EditablePhoto[] {
  const images = product.images?.length ? product.images : [product.image];

  return images.filter(Boolean).slice(0, maxPhotos).map((url, index) => ({
    id: `existing-${index}-${url}`,
    type: "existing",
    url,
  }));
}

function getPhotoUrl(photo: EditablePhoto) {
  return photo.type === "existing" ? photo.url : photo.previewUrl;
}

export function ProductEditForm({ product, stats }: ProductEditFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<EditablePhoto[]>([]);
  const [form, setForm] = useState({
    title: product.name,
    description: product.description,
    price: (product.price / 100).toFixed(2),
    categoryId: product.categoryId,
    condition: getConditionValue(product.condition),
    stock: String(product.stock),
    status: (product.status ?? "published") as ProductStatus,
    livraisonDisponible: product.livraisonDisponible ?? "toutes",
  });
  const [photos, setPhotos] = useState<EditablePhoto[]>(() =>
    getInitialPhotos(product),
  );
  const [message, setMessage] = useState("Pret a modifier ce produit.");
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const previewPrice = useMemo(() => {
    const value = Number.parseFloat(form.price.replace(",", "."));
    return Number.isFinite(value) ? formatPrice(Math.round(value * 100)) : "0,00 €";
  }, [form.price]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => {
        if (photo.type === "new") {
          URL.revokeObjectURL(photo.previewUrl);
        }
      });
    };
  }, []);

  function patchForm(patch: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function addPhotos(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (imageFiles.length === 0) {
      return;
    }

    setPhotos((currentPhotos) => {
      const remainingSlots = maxPhotos - currentPhotos.length;
      const selectedFiles = imageFiles.slice(0, remainingSlots);
      const nextPhotos: EditablePhoto[] = selectedFiles.map((file) => ({
        id: `new-${crypto.randomUUID()}`,
        type: "new",
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      setMessage(
        imageFiles.length > remainingSlots
          ? "Maximum 10 photos par produit."
          : `${currentPhotos.length + nextPhotos.length} photo(s) prete(s).`,
      );

      return [...currentPhotos, ...nextPhotos];
    });
  }

  function removePhoto(photoId: string) {
    setPhotos((currentPhotos) => {
      const photo = currentPhotos.find((item) => item.id === photoId);
      if (photo?.type === "new") {
        URL.revokeObjectURL(photo.previewUrl);
      }

      return currentPhotos.filter((item) => item.id !== photoId);
    });
  }

  function makeMainPhoto(photoId: string) {
    setPhotos((currentPhotos) => {
      const selected = currentPhotos.find((photo) => photo.id === photoId);
      if (!selected) {
        return currentPhotos;
      }

      return [
        selected,
        ...currentPhotos.filter((photo) => photo.id !== photoId),
      ];
    });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    addPhotos(event.dataTransfer.files);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("Enregistrement en cours...");

    try {
      const body = new FormData();
      body.append("title", form.title);
      body.append("description", form.description);
      body.append("price", form.price);
      body.append("categoryId", form.categoryId);
      body.append("condition", form.condition);
      body.append("stock", form.stock);
      body.append("status", form.status);
      body.append("livraisonDisponible", form.livraisonDisponible);
      body.append(
        "photoOrder",
        JSON.stringify(
          photos.map((photo) =>
            photo.type === "existing"
              ? { id: photo.id, type: "existing", value: photo.url }
              : { id: photo.id, type: "new" },
          ),
        ),
      );

      photos.forEach((photo) => {
        if (photo.type === "new") {
          body.append("newImageIds", photo.id);
          body.append("newImages", photo.file);
        }
      });

      const response = await fetch(
        `/api/admin/products/${encodeURIComponent(product.slug)}`,
        {
          method: "PATCH",
          body,
        },
      );
      const data = (await response.json()) as { product?: Product; error?: string };

      if (!response.ok || !data.product) {
        throw new Error(data.error ?? "Modification impossible.");
      }

      setMessage("Produit modifie avec succes.");
      router.push(`/produit/${data.product.slug}?adminMessage=updated`);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Modification impossible.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={saveProduct}
      className="container-page grid gap-6 py-10 lg:grid-cols-[1fr_360px]"
    >
      <section className="grid gap-4 rounded-lg border border-line bg-paper p-5 shadow-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="focus-ring inline-flex min-h-10 w-fit items-center gap-2 rounded-md border border-line px-3 text-sm font-black hover:bg-[#f1eadf]"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Retour
        </button>

        <div>
          <p className="text-sm font-black uppercase text-teal">
            Admin produit
          </p>
          <h1 className="mt-2 text-3xl font-black">Modifier le produit</h1>
        </div>

        <label className="grid gap-2 text-sm font-bold">
          Titre
          <input
            value={form.title}
            onChange={(event) => patchForm({ title: event.target.value })}
            className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
          />
        </label>

        <label className="grid gap-2 text-sm font-bold">
          Description
          <textarea
            value={form.description}
            onChange={(event) => patchForm({ description: event.target.value })}
            rows={8}
            className="focus-ring rounded-md border border-line px-3 py-3 text-base"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold">
            Prix
            <input
              value={form.price}
              onChange={(event) => patchForm({ price: event.target.value })}
              className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
              inputMode="decimal"
            />
          </label>

          <label className="grid gap-2 text-sm font-bold">
            Quantite disponible
            <input
              value={form.stock}
              onChange={(event) => patchForm({ stock: event.target.value })}
              className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
              min={0}
              type="number"
            />
          </label>

          <label className="grid gap-2 text-sm font-bold">
            Statut
            <select
              value={form.status}
              onChange={(event) =>
                patchForm({ status: event.target.value as ProductStatus })
              }
              className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
            >
              <option value="published">Publie</option>
              <option value="draft">Brouillon</option>
              <option value="archived">Archive</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-bold">
            Categorie
            <select
              value={form.categoryId}
              onChange={(event) => patchForm({ categoryId: event.target.value })}
              className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-bold">
            Etat
            <select
              value={form.condition}
              onChange={(event) => patchForm({ condition: event.target.value })}
              className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
            >
              <option value="neuf">Neuf</option>
              <option value="occasion">Occasion</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-bold">
            Livraison disponible
            <select
              value={form.livraisonDisponible}
              onChange={(event) =>
                patchForm({
                  livraisonDisponible: event.target.value as Product["livraisonDisponible"],
                })
              }
              className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
            >
              <option value="toutes">Toutes les options</option>
              <option value="remise uniquement">Remise uniquement</option>
              <option value="mondial relay uniquement">Mondial Relay uniquement</option>
              <option value="colissimo uniquement">Colissimo uniquement</option>
              <option value="sur devis">Objet volumineux / sur devis</option>
            </select>
          </label>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`rounded-lg border border-dashed p-4 ${
            isDragging ? "border-teal bg-[#eef8f6]" : "border-line bg-[#fbfaf7]"
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-paper text-teal">
                <UploadCloud size={22} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-black">Photos existantes et nouvelles</h2>
                <p className="text-sm text-muted">
                  La premiere photo devient l&apos;image principale. Max 10.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-paper px-4 py-2 text-sm font-black hover:bg-[#f1eadf]"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus size={18} aria-hidden="true" />
              Ajouter photos
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) {
                addPhotos(event.target.files);
              }
            }}
          />

          {photos.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="relative aspect-square overflow-hidden rounded-md border border-line bg-paper"
                >
                  <div
                    className="h-full w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${getPhotoUrl(photo)})` }}
                  />
                  {index === 0 ? (
                    <span className="absolute left-1 top-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-black">
                      Principale
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => makeMainPhoto(photo.id)}
                      className="focus-ring absolute left-1 top-1 flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-teal"
                      aria-label="Utiliser comme image principale"
                    >
                      <Star size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="focus-ring absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-rose"
                    aria-label="Supprimer la photo du produit"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-md bg-paper p-3 text-sm font-bold text-muted">
              Aucune photo selectionnee. Une image par defaut sera utilisee.
            </p>
          )}
        </div>
      </section>

      <aside className="h-fit rounded-lg border border-line bg-paper p-5 shadow-sm">
        <p className="text-sm font-black uppercase text-teal">Sauvegarde</p>
        <div className="mt-4 rounded-md bg-[#f6f1e8] p-3 text-sm font-bold text-muted">
          {message}
        </div>
        <div className="mt-5 grid gap-3 rounded-md border border-line p-4 text-sm">
          <div className="border-b border-line pb-3">
            <span className="mb-2 block font-bold text-muted">Statistiques</span>
            <ProductStatsBadges stats={stats} />
          </div>
          <div className="flex justify-between gap-3">
            <span className="font-bold text-muted">Prix</span>
            <span className="font-black">{previewPrice}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="font-bold text-muted">Photos</span>
            <span className="font-black">{photos.length}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="font-bold text-muted">Stock</span>
            <span className="font-black">{form.stock || "0"}</span>
          </div>
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className="focus-ring mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-black text-white hover:bg-[#2b2b2b] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Enregistrer
        </button>
      </aside>
    </form>
  );
}

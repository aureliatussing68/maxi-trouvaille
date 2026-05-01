"use client";

import type { ClipboardEvent, DragEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  FileText,
  ImagePlus,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  UploadCloud,
  WandSparkles,
} from "lucide-react";
import { categories, type Product } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import {
  detectCategoryId,
  detectPrice,
  generateCommerceDescription,
  QUICK_PRODUCTS_UPDATED_EVENT,
  sanitizeQuickProducts,
  type QuickProductInput,
} from "@/lib/quick-products";

const maxPhotos = 10;

const initialForm: QuickProductInput = {
  title: "",
  description: "",
  price: "",
  categoryId: "colis-surprise",
  condition: "occasion",
  stock: "1",
  livraisonDisponible: "toutes",
};

type SelectedPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

export function QuickProductImportForm() {
  const [form, setForm] = useState<QuickProductInput>(initialForm);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [message, setMessage] = useState("Pret pour l'import rapide.");
  const titleRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<SelectedPhoto[]>([]);

  const previewPrice = useMemo(() => {
    const value = Number.parseFloat(String(form.price).replace(",", "."));
    return Number.isFinite(value) ? formatPrice(Math.round(value * 100)) : "0,00 €";
  }, [form.price]);

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch("/api/admin/products", { cache: "no-store" });
        const data = (await response.json()) as { products?: unknown };
        setProducts(sanitizeQuickProducts(data.products));
      } catch {
        setProducts([]);
      }
    }

    loadProducts();
  }, []);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, []);

  function patchForm(patch: Partial<QuickProductInput>) {
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
      const nextPhotos = selectedFiles.map((file) => ({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      if (imageFiles.length > remainingSlots) {
        setMessage("Maximum 10 photos par produit.");
      } else {
        setMessage(`${currentPhotos.length + nextPhotos.length} photo(s) prete(s).`);
      }

      return [...currentPhotos, ...nextPhotos];
    });
  }

  function removePhoto(photoId: string) {
    setPhotos((currentPhotos) => {
      const photo = currentPhotos.find((item) => item.id === photoId);
      if (photo) {
        URL.revokeObjectURL(photo.previewUrl);
      }

      return currentPhotos.filter((item) => item.id !== photoId);
    });
  }

  function resetForm() {
    photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    setForm(initialForm);
    setPhotos([]);
    setCategoryTouched(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function applySmartDetection(text: string, nextText = "") {
    const price = detectPrice(text);
    const detectedCategory = detectCategoryId(
      `${form.title} ${form.description} ${text} ${nextText}`,
    );

    setForm((current) => ({
      ...current,
      price: price || current.price,
      categoryId: categoryTouched ? current.categoryId : detectedCategory,
    }));
  }

  function handleTitlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    applySmartDetection(text);

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length > 1) {
      event.preventDefault();
      const price = detectPrice(text);
      const descriptionLines = lines
        .slice(1)
        .filter((line) => !detectPrice(line));

      setForm((current) => ({
        ...current,
        title: lines[0] ?? current.title,
        description:
          current.description || descriptionLines.join("\n") || current.description,
        price: price || current.price,
        categoryId: categoryTouched
          ? current.categoryId
          : detectCategoryId(lines.join(" ")),
      }));
    }
  }

  function handleDescriptionPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    applySmartDetection(event.clipboardData.getData("text"));
  }

  function handlePricePaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    const price = detectPrice(text);

    if (price) {
      event.preventDefault();
      patchForm({ price });
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    addPhotos(event.dataTransfer.files);
  }

  function getFirstPhotoContext() {
    const firstPhoto = photos[0];
    if (!firstPhoto) {
      return Promise.resolve("");
    }

    return new Promise<string>((resolve) => {
      const image = new Image();
      image.onload = () => {
        const orientation =
          image.width > image.height
            ? "photo horizontale"
            : image.width < image.height
              ? "photo verticale"
              : "photo carree";
        resolve(
          `La premiere image ajoutee sert de photo principale (${orientation}, ${image.width} x ${image.height}px), ce qui permet de presenter l'article clairement.`,
        );
      };
      image.onerror = () => {
        resolve("Une photo principale est ajoutee pour aider l'acheteur a visualiser le produit.");
      };
      image.src = firstPhoto.previewUrl;
    });
  }

  async function generateDescription(useImage: boolean) {
    setIsGeneratingDescription(true);
    setMessage(
      useImage
        ? "Generation avec la premiere image..."
        : "Generation de description...",
    );

    try {
      const imageContext = useImage ? await getFirstPhotoContext() : "";
      const description = generateCommerceDescription({
        title: form.title,
        categoryId: form.categoryId,
        condition: form.condition,
        stock: form.stock,
        price: form.price,
        imageContext,
      });

      patchForm({ description });
      setMessage(
        useImage && photos.length === 0
          ? "Description generee sans image : aucune photo selectionnee."
          : "Description generee, vous pouvez la modifier.",
      );
    } finally {
      setIsGeneratingDescription(false);
    }
  }

  async function saveProduct(shouldContinue: boolean) {
    setIsSaving(true);
    setMessage("Ajout en cours...");

    try {
      const body = new FormData();
      body.append("title", form.title);
      body.append("description", form.description);
      body.append("price", form.price);
      body.append("categoryId", form.categoryId);
      body.append("condition", form.condition);
      body.append("stock", String(form.stock ?? "1"));
      body.append("livraisonDisponible", form.livraisonDisponible ?? "toutes");
      photos.forEach((photo) => body.append("images", photo.file));

      const response = await fetch("/api/admin/products", {
        method: "POST",
        body,
      });
      const data = (await response.json()) as { product?: Product; error?: string };

      if (!response.ok || !data.product) {
        throw new Error(data.error ?? "Ajout impossible.");
      }

      const nextProducts = [data.product, ...products];
      setProducts(nextProducts);
      window.dispatchEvent(
        new CustomEvent(QUICK_PRODUCTS_UPDATED_EVENT, {
          detail: { products: nextProducts },
        }),
      );
      setMessage(`Ajoute : ${data.product.name}`);

      if (shouldContinue) {
        resetForm();
        window.setTimeout(() => titleRef.current?.focus(), 0);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ajout impossible.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveProduct(false);
  }

  return (
    <div className="container-page grid gap-6 py-10 lg:grid-cols-[1fr_380px]">
      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-lg border border-line bg-paper p-5 shadow-sm"
      >
        <div className="flex items-start gap-3 rounded-lg bg-[#eef8f6] p-4 text-sm leading-6 text-[#115e59]">
          <WandSparkles className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
          <p>
            Collez vite vos infos. Si le texte contient un prix en euros, il est
            detecte automatiquement. La categorie est proposee avec des mots cles simples.
          </p>
        </div>

        <label className="grid gap-2 text-sm font-bold">
          Titre
          <input
            ref={titleRef}
            value={form.title}
            onChange={(event) => {
              const title = event.target.value;
              patchForm({
                title,
                categoryId: categoryTouched
                  ? form.categoryId
                  : detectCategoryId(`${title} ${form.description}`),
              });
            }}
            onPaste={handleTitlePaste}
            className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
            placeholder="Ex : mannequin tete vitrine 25 €"
            autoFocus
          />
        </label>

        <div className="grid gap-2 text-sm font-bold">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Description</span>
            <span className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={isGeneratingDescription}
                onClick={() => generateDescription(false)}
                className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line bg-paper px-3 py-2 text-xs font-black hover:bg-[#f1eadf] disabled:cursor-not-allowed disabled:opacity-65"
              >
                {isGeneratingDescription ? (
                  <Loader2 className="animate-spin" size={15} />
                ) : (
                  <FileText size={15} />
                )}
                Générer description
              </button>
              <button
                type="button"
                disabled={isGeneratingDescription}
                onClick={() => generateDescription(true)}
                className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-line bg-paper px-3 py-2 text-xs font-black hover:bg-[#f1eadf] disabled:cursor-not-allowed disabled:opacity-65"
              >
                {isGeneratingDescription ? (
                  <Loader2 className="animate-spin" size={15} />
                ) : (
                  <ImagePlus size={15} />
                )}
                Générer description avec image
              </button>
            </span>
          </div>
          <textarea
            aria-label="Description"
            value={form.description}
            onChange={(event) => {
              const description = event.target.value;
              patchForm({
                description,
                categoryId: categoryTouched
                  ? form.categoryId
                  : detectCategoryId(`${form.title} ${description}`),
              });
            }}
            onPaste={handleDescriptionPaste}
            rows={7}
            className="focus-ring rounded-md border border-line px-3 py-3 text-base"
            placeholder="Description copiee depuis Leboncoin"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <label className="grid gap-2 text-sm font-bold">
            Prix
            <input
              value={form.price}
              onChange={(event) => {
                const value = event.target.value;
                patchForm({ price: detectPrice(value) || value });
              }}
              onPaste={handlePricePaste}
              className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
              placeholder="19.90"
              inputMode="decimal"
            />
          </label>

          <label className="grid gap-2 text-sm font-bold">
            Quantite disponible
            <input
              value={String(form.stock ?? "1")}
              onChange={(event) => patchForm({ stock: event.target.value })}
              className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
              min={0}
              type="number"
            />
          </label>

          <label className="grid gap-2 text-sm font-bold">
            Categorie
            <select
              value={form.categoryId}
              onChange={(event) => {
                setCategoryTouched(true);
                patchForm({ categoryId: event.target.value });
              }}
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
              onChange={(event) =>
                patchForm({
                  condition: event.target.value as QuickProductInput["condition"],
                })
              }
              className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
            >
              <option value="neuf">Neuf</option>
              <option value="occasion">Occasion</option>
            </select>
          </label>
        </div>

        <label className="grid gap-2 text-sm font-bold">
          Livraison disponible
          <select
            value={form.livraisonDisponible ?? "toutes"}
            onChange={(event) =>
              patchForm({
                livraisonDisponible: event.target
                  .value as QuickProductInput["livraisonDisponible"],
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
                <h2 className="text-sm font-black">Photos produit</h2>
                <p className="text-sm text-muted">
                  Glissez les images ici ou importez depuis le PC. Max 10.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-paper px-4 py-2 text-sm font-black hover:bg-[#f1eadf]"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus size={18} aria-hidden="true" />
              Importer images
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
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
              {photos.map((photo, index) => (
                <div key={photo.id} className="relative aspect-square overflow-hidden rounded-md border border-line bg-paper">
                  <div
                    className="h-full w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${photo.previewUrl})` }}
                  />
                  {index === 0 ? (
                    <span className="absolute left-1 top-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-black">
                      Principale
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="focus-ring absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-rose"
                    aria-label="Retirer la photo"
                    onClick={() => removePhoto(photo.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={isSaving}
            className="focus-ring inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md bg-foreground px-5 py-3 text-sm font-black text-white hover:bg-[#2b2b2b] disabled:cursor-not-allowed disabled:opacity-65"
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
            Ajouter produit
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => saveProduct(true)}
            className="focus-ring inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md bg-brand px-5 py-3 text-sm font-black text-foreground hover:bg-[#ffd166] disabled:cursor-not-allowed disabled:opacity-65"
          >
            <RotateCcw size={18} />
            Ajouter et continuer
          </button>
        </div>
      </form>

      <aside className="h-fit rounded-lg border border-line bg-paper p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase text-teal">Session import</p>
            <h2 className="mt-2 text-2xl font-black">{products.length} produit(s)</h2>
          </div>
          <CheckCircle2 className="text-teal" size={26} aria-hidden="true" />
        </div>
        <div className="mt-4 rounded-md bg-[#f6f1e8] p-3 text-sm font-bold text-muted">
          {message}
        </div>
        <div className="mt-5 grid gap-3">
          <div className="rounded-md border border-line p-3">
            <div className="text-xs font-black uppercase text-muted">Apercu prix</div>
            <div className="mt-1 text-2xl font-black">{previewPrice}</div>
            <div className="mt-1 text-xs font-bold text-muted">
              Stock : {form.stock || "1"} / Photos : {photos.length}
            </div>
          </div>
          {products.slice(0, 8).map((product) => (
            <div key={product.id} className="rounded-md border border-line p-3">
              <div className="text-sm font-black">{product.name}</div>
              <div className="mt-1 flex justify-between gap-3 text-xs text-muted">
                <span>{formatPrice(product.price)}</span>
                <span>Stock {product.stock}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

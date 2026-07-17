"use client";

import type { ClipboardEvent, DragEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
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
  productConditionOptions,
  QUICK_PRODUCTS_UPDATED_EVENT,
  sanitizeQuickProducts,
  type ProductConditionValue,
  type QuickProductInput,
} from "@/lib/quick-products";

const maxPhotos = 10;

const initialForm: QuickProductInput = {
  title: "",
  description: "",
  price: "",
  categoryId: "colis-surprise-palettes",
  condition: "a_verifier",
  stock: "1",
  keywords: "",
  marketPriceEstimate: "",
  priceReviewNote: "",
  productType: "",
  usage: "",
  strengths: "",
  livraisonDisponible: "toutes",
};

type SelectedPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

type PhotoAnalysisResult = {
  productType: string;
  usage: string;
  title: string;
  description: string;
  strengths: string[];
  categoryId: string;
  condition: ProductConditionValue;
  conditionLabel: string;
  keywords: string[];
  estimatedNewPriceRange: string;
  recommendedPrice: string;
  priceReviewNote: string;
  priceNeedsReview: boolean;
  confidence: "haute" | "moyenne" | "faible";
  warning: string;
};

export function QuickProductImportForm() {
  const [form, setForm] = useState<QuickProductInput>(initialForm);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingFromImage, setIsGeneratingFromImage] = useState(false);
  const [photoAnalysis, setPhotoAnalysis] = useState<PhotoAnalysisResult | null>(
    null,
  );
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

  function addPhotos(files: FileList | File[], shouldGenerateFromImage = false) {
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (imageFiles.length === 0) {
      return;
    }

    let photosForAnalysis: SelectedPhoto[] = [];

    setPhotos((currentPhotos) => {
      const remainingSlots = maxPhotos - currentPhotos.length;
      const selectedFiles = imageFiles.slice(0, remainingSlots);
      const nextPhotos = selectedFiles.map((file) => ({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      photosForAnalysis = [...currentPhotos, ...nextPhotos];

      if (imageFiles.length > remainingSlots) {
        setMessage("Maximum 10 photos par produit.");
      } else {
        setMessage(`${currentPhotos.length + nextPhotos.length} photo(s) prete(s).`);
      }

      return photosForAnalysis;
    });

    if (shouldGenerateFromImage) {
      window.setTimeout(() => generateFromImage(photosForAnalysis), 0);
    }
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
    setPhotoAnalysis(null);
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
    addPhotos(event.dataTransfer.files, true);
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
        keywords: form.keywords,
        strengths: form.strengths,
        marketPriceEstimate: form.marketPriceEstimate,
        priceReviewNote: form.priceReviewNote,
        productType: form.productType,
        usage: form.usage,
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

  async function generateFromImage(photosToAnalyze = photos) {
    if (photosToAnalyze.length === 0) {
      setMessage("Ajoutez au moins une image pour generer une fiche.");
      return;
    }

    setIsGeneratingFromImage(true);
    setMessage("Analyse image et estimation du prix en cours...");

    try {
      const body = new FormData();
      photosToAnalyze.slice(0, 6).forEach((photo) => {
        body.append("images", photo.file);
      });
      body.append("currentTitle", form.title);
      body.append("currentDescription", form.description);

      const response = await fetch("/api/admin/products/photo-analysis", {
        method: "POST",
        body,
      });
      const data = (await response.json()) as {
        result?: PhotoAnalysisResult;
        source?: "openai" | "fallback";
        error?: string;
      };

      if (!response.ok || !data.result) {
        throw new Error(data.error ?? "Generation depuis image impossible.");
      }

      const result = data.result;
      setPhotoAnalysis(result);
      setCategoryTouched(false);
      patchForm({
        title: result.title,
        description: result.description,
        price: result.recommendedPrice || form.price,
        categoryId: result.categoryId,
        condition: result.condition,
        keywords: result.keywords.join(", "),
        marketPriceEstimate: result.estimatedNewPriceRange,
        priceReviewNote: result.priceReviewNote,
        productType: result.productType,
        usage: result.usage,
        strengths: result.strengths.join("\n"),
      });
      setMessage(
        result.priceNeedsReview
          ? "Fiche generee. Prix estime a verifier avant validation."
          : "Fiche generee avec prix conseille base sur environ 50% du neuf.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Generation depuis image impossible.",
      );
    } finally {
      setIsGeneratingFromImage(false);
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
      body.append("keywords", String(form.keywords ?? ""));
      body.append("marketPriceEstimate", String(form.marketPriceEstimate ?? ""));
      body.append("priceReviewNote", String(form.priceReviewNote ?? ""));
      body.append("productType", String(form.productType ?? ""));
      body.append("usage", String(form.usage ?? ""));
      body.append("strengths", String(form.strengths ?? ""));
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

  function renderPhotoZone() {
    return (
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
              <h2 className="text-sm font-black">Images produit</h2>
              <p className="text-sm text-muted">
                Glissez une ou plusieurs images. Max 10.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={photos.length === 0 || isGeneratingFromImage}
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-black text-white hover:bg-[#2b2b2b] disabled:cursor-not-allowed disabled:opacity-65"
              onClick={() => generateFromImage()}
            >
              {isGeneratingFromImage ? (
                <Loader2 className="animate-spin" size={18} aria-hidden="true" />
              ) : (
                <WandSparkles size={18} aria-hidden="true" />
              )}
              Générer depuis image
            </button>
            <button
              type="button"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-paper px-4 py-2 text-sm font-black hover:bg-[#f1eadf]"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus size={18} aria-hidden="true" />
              Importer images
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) {
              addPhotos(event.target.files, true);
            }
          }}
        />

        {photos.length > 0 ? (
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className="relative aspect-square overflow-hidden rounded-md border border-line bg-paper"
              >
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

        {photoAnalysis ? (
          <div className="mt-4 grid gap-3 rounded-md border border-line bg-paper p-4 text-sm">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
              <div>
                <p className="font-black uppercase text-teal">
                  Proposition générée
                </p>
                <p className="mt-1 font-bold text-muted">
                  {photoAnalysis.productType} · {photoAnalysis.usage}
                </p>
              </div>
              <span className="w-fit rounded-md bg-[#f6f1e8] px-2.5 py-1 text-xs font-black text-muted">
                Confiance : {photoAnalysis.confidence}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-line p-3">
                <div className="text-xs font-black uppercase text-muted">
                  Prix neuf
                </div>
                <div className="mt-1 font-black">
                  {photoAnalysis.estimatedNewPriceRange}
                </div>
              </div>
              <div className="rounded-md border border-line p-3">
                <div className="text-xs font-black uppercase text-muted">
                  Prix conseillé
                </div>
                <div className="mt-1 font-black">
                  {photoAnalysis.recommendedPrice
                    ? `${photoAnalysis.recommendedPrice} €`
                    : "À vérifier"}
                </div>
              </div>
              <div className="rounded-md border border-line p-3">
                <div className="text-xs font-black uppercase text-muted">État</div>
                <div className="mt-1 font-black">
                  {photoAnalysis.conditionLabel}
                </div>
              </div>
            </div>
            {photoAnalysis.priceNeedsReview || photoAnalysis.warning ? (
              <div className="flex items-start gap-2 rounded-md bg-[#fff7ed] p-3 font-bold text-[#9a3412]">
                <AlertTriangle
                  className="mt-0.5 shrink-0"
                  size={16}
                  aria-hidden="true"
                />
                <span>{photoAnalysis.warning || "Prix estimé à vérifier"}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
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
            Glissez une image pour obtenir une fiche modifiable avec type produit,
            prix neuf estime, prix conseille a environ 50% et mots-cles de recherche.
          </p>
        </div>

        {renderPhotoZone()}

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

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold">
            Type produit
            <input
              value={String(form.productType ?? "")}
              onChange={(event) => patchForm({ productType: event.target.value })}
              className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
              placeholder="Ex : support telephone voiture"
            />
          </label>

          <label className="grid gap-2 text-sm font-bold">
            Usage
            <input
              value={String(form.usage ?? "")}
              onChange={(event) => patchForm({ usage: event.target.value })}
              className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
              placeholder="Ex : maintenir un smartphone au tableau de bord"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold">
            Prix neuf estimé
            <input
              value={String(form.marketPriceEstimate ?? "")}
              onChange={(event) =>
                patchForm({ marketPriceEstimate: event.target.value })
              }
              className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
              placeholder="Ex : 30 € à 40 €"
            />
          </label>

          <label className="grid gap-2 text-sm font-bold">
            Note prix
            <input
              value={String(form.priceReviewNote ?? "")}
              onChange={(event) =>
                patchForm({ priceReviewNote: event.target.value })
              }
              className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
              placeholder="Prix estimé à vérifier"
            />
          </label>
        </div>

        <label className="grid gap-2 text-sm font-bold">
          Points forts
          <textarea
            value={String(form.strengths ?? "")}
            onChange={(event) => patchForm({ strengths: event.target.value })}
            rows={4}
            className="focus-ring rounded-md border border-line px-3 py-3 text-base"
            placeholder="Un point fort par ligne"
          />
        </label>

        <label className="grid gap-2 text-sm font-bold">
          Mots-clés recherche
          <input
            value={String(form.keywords ?? "")}
            onChange={(event) => patchForm({ keywords: event.target.value })}
            className="focus-ring min-h-12 rounded-md border border-line px-3 text-base"
            placeholder="destockage, amazon, accessoire, lot"
          />
        </label>

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
              {productConditionOptions.map((condition) => (
                <option key={condition.value} value={condition.value}>
                  {condition.label}
                </option>
              ))}
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
            {form.marketPriceEstimate ? (
              <div className="mt-2 text-xs font-bold text-muted">
                Neuf estimé : {form.marketPriceEstimate}
              </div>
            ) : null}
            {form.priceReviewNote ? (
              <div className="mt-1 text-xs font-black text-[#9a3412]">
                {form.priceReviewNote}
              </div>
            ) : null}
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

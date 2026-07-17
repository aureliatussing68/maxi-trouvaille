import { NextResponse } from "next/server";
import { categories } from "@/lib/catalog";
import { isAdminModeEnabled } from "@/lib/admin";
import { adminApiUnavailable } from "@/lib/admin-api";
import {
  detectCategoryId,
  generateCommerceDescription,
  getProductConditionLabel,
  normalizeKeywords,
  normalizeProductCondition,
  type ProductConditionValue,
} from "@/lib/quick-products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxAnalyzedImages = 6;
const maxImageBytes = 8 * 1024 * 1024;

type OpenAiProductDraft = {
  productType: string;
  usage: string;
  title: string;
  description: string;
  strengths: string[];
  categoryId: string;
  condition: ProductConditionValue;
  keywords: string[];
  estimatedNewPriceMin: number;
  estimatedNewPriceMax: number;
  priceNeedsReview: boolean;
  confidence: "haute" | "moyenne" | "faible";
  warning: string;
};

type ProductPhotoDraft = OpenAiProductDraft & {
  estimatedNewPriceRange: string;
  recommendedPrice: string;
  priceReviewNote: string;
  conditionLabel: string;
};

function getText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanList(value: unknown, fallback: string[] = []) {
  const list = Array.isArray(value) ? value : [];
  const cleaned = list
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 8);

  return cleaned.length > 0 ? cleaned : fallback;
}

function formatPriceValue(value: number) {
  return `${Math.round(value)} €`;
}

function formatRange(min: number, max: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) {
    return "Prix neuf estimé à vérifier";
  }

  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);

  if (Math.abs(safeMax - safeMin) < 1) {
    return formatPriceValue(safeMin);
  }

  return `${formatPriceValue(safeMin)} à ${formatPriceValue(safeMax)}`;
}

function roundToSimplePrice(value: number) {
  const simplePrices = [
    3, 5, 7, 9, 10, 12, 15, 19, 25, 29, 35, 39, 45, 49, 59, 69, 79, 89, 99,
    119, 149, 179, 199, 249, 299, 399, 499, 699, 899,
  ];

  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  const closest = simplePrices.reduce((best, price) =>
    Math.abs(price - value) < Math.abs(best - value) ? price : best,
  );

  return String(closest);
}

function getRecommendedPrice(min: number, max: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) {
    return "";
  }

  return roundToSimplePrice(((min + max) / 2) * 0.5);
}

function extractResponseText(data: unknown) {
  if (!data || typeof data !== "object") {
    return "";
  }

  const maybeData = data as { output_text?: unknown; output?: unknown };
  if (typeof maybeData.output_text === "string") {
    return maybeData.output_text;
  }

  if (!Array.isArray(maybeData.output)) {
    return "";
  }

  return maybeData.output
    .flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) {
        return [];
      }

      return content.flatMap((part) => {
        if (!part || typeof part !== "object") {
          return [];
        }

        const text = (part as { text?: unknown; refusal?: unknown }).text;
        const refusal = (part as { text?: unknown; refusal?: unknown }).refusal;
        if (typeof text === "string") {
          return [text];
        }

        return typeof refusal === "string" ? [refusal] : [];
      });
    })
    .join("\n");
}

function sanitizeDraft(input: Partial<OpenAiProductDraft>): ProductPhotoDraft {
  const productType = cleanText(input.productType, "Produit à vérifier");
  const usage = cleanText(input.usage, "Usage à vérifier");
  const categoryId = categories.some((category) => category.id === input.categoryId)
    ? String(input.categoryId)
    : detectCategoryId(`${productType} ${usage} ${input.title ?? ""}`);
  const condition = normalizeProductCondition(input.condition);
  const strengths = cleanList(input.strengths, [
    "Bonne affaire issue de déstockage ou retour client",
    "Produit à contrôler avant mise en vente",
  ]);
  const keywords = normalizeKeywords(input.keywords).slice(0, 12);
  const estimatedNewPriceMin = Math.max(0, Number(input.estimatedNewPriceMin) || 0);
  const estimatedNewPriceMax = Math.max(0, Number(input.estimatedNewPriceMax) || 0);
  const confidence = input.confidence ?? "faible";
  const priceNeedsReview =
    Boolean(input.priceNeedsReview) ||
    confidence === "faible" ||
    estimatedNewPriceMin <= 0 ||
    estimatedNewPriceMax <= 0;
  const recommendedPrice = getRecommendedPrice(
    estimatedNewPriceMin,
    estimatedNewPriceMax,
  );
  const priceReviewNote = priceNeedsReview
    ? "Prix estimé à vérifier"
    : "Prix conseillé calculé à environ 50% du prix neuf estimé";
  const title = cleanText(input.title, productType);
  const description =
    cleanText(input.description, "") ||
    generateCommerceDescription({
      title,
      categoryId,
      condition,
      price: recommendedPrice,
      keywords,
      strengths,
      marketPriceEstimate: formatRange(estimatedNewPriceMin, estimatedNewPriceMax),
      priceReviewNote,
      productType,
      usage,
    });

  return {
    productType,
    usage,
    title,
    description,
    strengths,
    categoryId,
    condition,
    conditionLabel: getProductConditionLabel(condition),
    keywords,
    estimatedNewPriceMin,
    estimatedNewPriceMax,
    estimatedNewPriceRange: formatRange(estimatedNewPriceMin, estimatedNewPriceMax),
    recommendedPrice,
    priceNeedsReview,
    priceReviewNote,
    confidence,
    warning: cleanText(
      input.warning,
      priceNeedsReview ? "Prix estimé à vérifier" : "",
    ),
  };
}

function makeFallbackDraft(formData: FormData): ProductPhotoDraft {
  const filenameContext = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File)
    .map((file) => file.name.replace(/\.[^.]+$/, ""))
    .join(" ");
  const title = getText(formData.get("currentTitle")) || "Produit à vérifier";
  const categoryId = detectCategoryId(`${title} ${filenameContext}`);

  return sanitizeDraft({
    productType: title,
    usage: "Usage à vérifier depuis la photo",
    title,
    description: generateCommerceDescription({
      title,
      categoryId,
      condition: "a_verifier",
      imageContext:
        "Analyse image complète indisponible : vérifier le produit, l'état et le prix avant publication",
      priceReviewNote: "Prix estimé à vérifier",
    }),
    strengths: ["Article issu d'arrivage à contrôler", "Prix à confirmer avant vente"],
    categoryId,
    condition: "a_verifier",
    keywords: normalizeKeywords(filenameContext),
    estimatedNewPriceMin: 0,
    estimatedNewPriceMax: 0,
    priceNeedsReview: true,
    confidence: "faible",
    warning:
      "Analyse image complète indisponible. Ajoutez OPENAI_API_KEY pour identifier le produit depuis la photo.",
  });
}

async function fileToInputImage(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/jpeg";

  return {
    type: "input_image",
    detail: "auto",
    image_url: `data:${mimeType};base64,${buffer.toString("base64")}`,
  };
}

async function analyzeWithOpenAi(files: File[], formData: FormData) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const images = [];
  let totalBytes = 0;

  for (const file of files.slice(0, maxAnalyzedImages)) {
    if (!file.type.startsWith("image/") || file.size <= 0) {
      continue;
    }

    if (file.size > maxImageBytes || totalBytes + file.size > maxImageBytes) {
      continue;
    }

    images.push(await fileToInputImage(file));
    totalBytes += file.size;
  }

  if (images.length === 0) {
    return null;
  }

  const categoryChoices = categories
    .map((category) => `${category.id}: ${category.name}`)
    .join("\n");
  const prompt = [
    "Analyse ces photos pour créer une fiche produit de déstockage Maxi Trouvaille.",
    "Contexte : bonnes affaires, produits utiles, retours clients, fins de série, produits partenaires neufs ou quasi neufs.",
    "Objectif : identifier le type de produit et son usage, puis générer une fiche courte, claire et vendeuse.",
    "Prix : estime une fourchette réaliste du prix neuf vendu sur des marketplaces type Amazon, sans inventer une marque ou un modèle précis. Si le produit n'est pas assez clair, mets estimatedNewPriceMin et estimatedNewPriceMax à 0 et priceNeedsReview à true.",
    "Le serveur calculera le prix de vente à environ 50% du prix neuf estimé, puis l'arrondira.",
    'Sécurité : si tu n’es pas sûr, utilise "a_verifier", confidence "faible", et warning "prix estimé à vérifier". Ne copie jamais une description Amazon.',
    "Catégories disponibles :",
    categoryChoices,
    `Contexte déjà saisi : titre="${getText(formData.get("currentTitle"))}", description="${getText(formData.get("currentDescription"))}".`,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_PRODUCT_PHOTO_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            ...images,
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "maxi_product_photo_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "productType",
              "usage",
              "title",
              "description",
              "strengths",
              "categoryId",
              "condition",
              "keywords",
              "estimatedNewPriceMin",
              "estimatedNewPriceMax",
              "priceNeedsReview",
              "confidence",
              "warning",
            ],
            properties: {
              productType: { type: "string" },
              usage: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              strengths: {
                type: "array",
                minItems: 2,
                maxItems: 5,
                items: { type: "string" },
              },
              categoryId: {
                type: "string",
                enum: categories.map((category) => category.id),
              },
              condition: {
                type: "string",
                enum: [
                  "neuf",
                  "neuf_sans_emballage",
                  "tres_bon_etat",
                  "destockage",
                  "colis_perdu",
                  "occasion",
                  "a_verifier",
                ],
              },
              keywords: {
                type: "array",
                minItems: 3,
                maxItems: 12,
                items: { type: "string" },
              },
              estimatedNewPriceMin: { type: "number" },
              estimatedNewPriceMax: { type: "number" },
              priceNeedsReview: { type: "boolean" },
              confidence: { type: "string", enum: ["haute", "moyenne", "faible"] },
              warning: { type: "string" },
            },
          },
        },
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data?.error?.message === "string"
        ? data.error.message
        : "Analyse image impossible.",
    );
  }

  return JSON.parse(extractResponseText(data)) as Partial<OpenAiProductDraft>;
}

export async function POST(request: Request) {
  if (!isAdminModeEnabled()) {
    return adminApiUnavailable();
  }

  const formData = await request.formData();
  const files = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Ajoutez au moins une image pour générer une fiche produit." },
      { status: 400 },
    );
  }

  try {
    const openAiDraft = await analyzeWithOpenAi(files, formData);
    const result = openAiDraft
      ? sanitizeDraft(openAiDraft)
      : makeFallbackDraft(formData);

    return NextResponse.json({
      result,
      source: openAiDraft ? "openai" : "fallback",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Analyse image impossible.",
      },
      { status: 500 },
    );
  }
}

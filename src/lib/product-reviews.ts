import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import postgres from "postgres";
import { getAllProducts } from "@/lib/catalog-server";

export type ReviewStatus = "pending" | "approved" | "hidden";

export type ProductReview = {
  id: string;
  productId: string;
  purchaseToken: string;
  rating: number;
  customerName: string;
  comment: string;
  status: ReviewStatus;
  adminReply: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductReviewSummary = {
  averageRating: number;
  totalReviews: number;
};

export type ReviewTokenDetails = {
  token: string;
  checkoutSessionId: string;
  productIds: string[];
  customerEmail: string;
  createdAt: string;
  expiresAt: string;
};

export type ReviewAdminItem = ProductReview & {
  productName: string;
  productSlug: string;
};

export type RecentReview = ProductReview & {
  productName: string;
  productSlug: string;
};

type ReviewsFile = {
  tokens: Record<string, ReviewTokenDetails>;
  reviews: ProductReview[];
};

type ReviewRow = {
  id: string;
  product_id: string;
  purchase_token: string;
  rating: number;
  customer_name: string;
  comment: string;
  status: ReviewStatus;
  admin_reply: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type ReviewTokenRow = {
  token: string;
  checkout_session_id: string;
  product_ids: string[] | string;
  customer_email: string | null;
  created_at: Date | string;
  expires_at: Date | string;
};

type ReviewSummaryRow = {
  product_id: string;
  average_rating: number | string | null;
  total_reviews: number | string;
};

const reviewsFilePath = path.join(process.cwd(), "data", "product-reviews.json");

let sqlClient: ReturnType<typeof postgres> | null = null;
let schemaReady: Promise<void> | null = null;

const emptyReviewSummary: ProductReviewSummary = {
  averageRating: 0,
  totalReviews: 0,
};

function getDatabaseUrl() {
  return (
    process.env.PRODUCT_REVIEWS_DATABASE_URL ??
    process.env.PRODUCT_STATS_DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    ""
  );
}

export function isReviewStorageConfigured() {
  return Boolean(getDatabaseUrl()) || process.env.VERCEL !== "1";
}

function canUseJsonFallback() {
  return !getDatabaseUrl() && process.env.VERCEL !== "1";
}

function getSqlClient() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    return null;
  }

  sqlClient ??= postgres(databaseUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });

  return sqlClient;
}

async function ensureReviewSchema() {
  const sql = getSqlClient();
  if (!sql) {
    return;
  }

  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS review_purchase_tokens (
        token text PRIMARY KEY,
        checkout_session_id text NOT NULL,
        product_ids jsonb NOT NULL,
        customer_email text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS product_reviews (
        id text PRIMARY KEY,
        product_id text NOT NULL,
        purchase_token text NOT NULL REFERENCES review_purchase_tokens(token) ON DELETE CASCADE,
        rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
        customer_name text NOT NULL,
        comment text NOT NULL,
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'hidden')),
        admin_reply text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (purchase_token, product_id)
      )
    `;
  })();

  await schemaReady;
}

function clampRating(input: unknown) {
  const rating = Math.trunc(Number(input));
  return Number.isFinite(rating) ? Math.min(5, Math.max(1, rating)) : 0;
}

function cleanText(input: unknown, maxLength: number) {
  return String(input ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeDate(input: Date | string) {
  return input instanceof Date ? input.toISOString() : new Date(input).toISOString();
}

function normalizeProductIds(input: unknown) {
  if (Array.isArray(input)) {
    return input.map(String).filter(Boolean);
  }

  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter(Boolean);
      }
    } catch {
      return input.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }

  return [];
}

function normalizeReview(row: ReviewRow): ProductReview {
  return {
    id: row.id,
    productId: row.product_id,
    purchaseToken: row.purchase_token,
    rating: clampRating(row.rating),
    customerName: cleanText(row.customer_name, 80),
    comment: cleanText(row.comment, 1200),
    status:
      row.status === "approved" || row.status === "hidden"
        ? row.status
        : "pending",
    adminReply: cleanText(row.admin_reply ?? "", 800),
    createdAt: normalizeDate(row.created_at),
    updatedAt: normalizeDate(row.updated_at),
  };
}

function normalizeToken(row: ReviewTokenRow): ReviewTokenDetails {
  return {
    token: row.token,
    checkoutSessionId: row.checkout_session_id,
    productIds: normalizeProductIds(row.product_ids),
    customerEmail: cleanText(row.customer_email ?? "", 160),
    createdAt: normalizeDate(row.created_at),
    expiresAt: normalizeDate(row.expires_at),
  };
}

function getTokenExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 45);
  return expiresAt;
}

async function readReviewsFile(): Promise<ReviewsFile> {
  try {
    const content = await fs.readFile(reviewsFilePath, "utf8");
    const data = JSON.parse(content) as Partial<ReviewsFile>;
    return {
      tokens: data.tokens ?? {},
      reviews: Array.isArray(data.reviews) ? data.reviews : [],
    };
  } catch {
    return {
      tokens: {},
      reviews: [],
    };
  }
}

async function writeReviewsFile(data: ReviewsFile) {
  await fs.mkdir(path.dirname(reviewsFilePath), { recursive: true });
  await fs.writeFile(reviewsFilePath, JSON.stringify(data, null, 2), "utf8");
}

export async function createReviewPurchaseToken(input: {
  checkoutSessionId: string;
  productIds: string[];
  customerEmail?: string;
}) {
  const productIds = [...new Set(input.productIds.filter(Boolean))];
  if (productIds.length === 0 || !isReviewStorageConfigured()) {
    return null;
  }

  const existingToken = await getReviewTokenByCheckoutSession(
    input.checkoutSessionId,
  );
  if (existingToken) {
    return existingToken;
  }

  const token = randomUUID();
  const now = new Date();
  const expiresAt = getTokenExpiry();

  const sql = getSqlClient();
  if (sql) {
    await ensureReviewSchema();
    const rows = await sql<ReviewTokenRow[]>`
      INSERT INTO review_purchase_tokens (
        token,
        checkout_session_id,
        product_ids,
        customer_email,
        expires_at
      )
      VALUES (
        ${token},
        ${input.checkoutSessionId},
        ${sql.json(productIds)},
        ${cleanText(input.customerEmail ?? "", 160)},
        ${expiresAt}
      )
      RETURNING token, checkout_session_id, product_ids, customer_email, created_at, expires_at
    `;

    return rows[0] ? normalizeToken(rows[0]) : null;
  }

  const data = await readReviewsFile();
  const details: ReviewTokenDetails = {
    token,
    checkoutSessionId: input.checkoutSessionId,
    productIds,
    customerEmail: cleanText(input.customerEmail ?? "", 160),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  data.tokens[token] = details;
  await writeReviewsFile(data);
  return details;
}

export async function getReviewTokenByCheckoutSession(checkoutSessionId: string) {
  const sql = getSqlClient();
  if (sql) {
    await ensureReviewSchema();
    const rows = await sql<ReviewTokenRow[]>`
      SELECT token, checkout_session_id, product_ids, customer_email, created_at, expires_at
      FROM review_purchase_tokens
      WHERE checkout_session_id = ${checkoutSessionId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    return rows[0] ? normalizeToken(rows[0]) : null;
  }

  if (!canUseJsonFallback()) {
    return null;
  }

  const data = await readReviewsFile();
  return (
    Object.values(data.tokens).find(
      (token) => token.checkoutSessionId === checkoutSessionId,
    ) ?? null
  );
}

export async function getReviewTokenDetails(token: string) {
  const sql = getSqlClient();
  if (sql) {
    await ensureReviewSchema();
    const rows = await sql<ReviewTokenRow[]>`
      SELECT token, checkout_session_id, product_ids, customer_email, created_at, expires_at
      FROM review_purchase_tokens
      WHERE token = ${token}
      LIMIT 1
    `;

    return rows[0] ? normalizeToken(rows[0]) : null;
  }

  if (!canUseJsonFallback()) {
    return null;
  }

  const data = await readReviewsFile();
  return data.tokens[token] ?? null;
}

export async function getReviewedProductIdsForToken(token: string) {
  const sql = getSqlClient();
  if (sql) {
    await ensureReviewSchema();
    const rows = await sql<{ product_id: string }[]>`
      SELECT product_id
      FROM product_reviews
      WHERE purchase_token = ${token}
    `;

    return rows.map((row) => row.product_id);
  }

  if (!canUseJsonFallback()) {
    return [];
  }

  const data = await readReviewsFile();
  return data.reviews
    .filter((review) => review.purchaseToken === token)
    .map((review) => review.productId);
}

export async function createProductReview(input: {
  token: string;
  productId: string;
  rating: unknown;
  customerName: unknown;
  comment: unknown;
}) {
  const token = await getReviewTokenDetails(input.token);
  if (!token || new Date(token.expiresAt).getTime() < Date.now()) {
    return { ok: false as const, error: "Lien d'avis invalide ou expire." };
  }

  if (!token.productIds.includes(input.productId)) {
    return { ok: false as const, error: "Ce produit n'est pas lie a cet achat." };
  }

  const rating = clampRating(input.rating);
  const customerName = cleanText(input.customerName, 80);
  const comment = cleanText(input.comment, 1200);

  if (!rating || customerName.length < 2 || comment.length < 10) {
    return {
      ok: false as const,
      error: "Ajoutez une note, un nom et un commentaire de 10 caracteres minimum.",
    };
  }

  const alreadyReviewed = (await getReviewedProductIdsForToken(token.token)).includes(
    input.productId,
  );
  if (alreadyReviewed) {
    return { ok: false as const, error: "Un avis existe deja pour ce produit." };
  }

  const now = new Date().toISOString();
  const review: ProductReview = {
    id: randomUUID(),
    productId: input.productId,
    purchaseToken: token.token,
    rating,
    customerName,
    comment,
    status: "pending",
    adminReply: "",
    createdAt: now,
    updatedAt: now,
  };

  const sql = getSqlClient();
  if (sql) {
    await ensureReviewSchema();
    const rows = await sql<ReviewRow[]>`
      INSERT INTO product_reviews (
        id,
        product_id,
        purchase_token,
        rating,
        customer_name,
        comment,
        status,
        admin_reply
      )
      VALUES (
        ${review.id},
        ${review.productId},
        ${review.purchaseToken},
        ${review.rating},
        ${review.customerName},
        ${review.comment},
        'pending',
        ''
      )
      RETURNING id, product_id, purchase_token, rating, customer_name, comment, status, admin_reply, created_at, updated_at
    `;

    return { ok: true as const, review: normalizeReview(rows[0]) };
  }

  if (!canUseJsonFallback()) {
    return {
      ok: false as const,
      error: "Base de donnees avis non configuree.",
    };
  }

  const data = await readReviewsFile();
  data.reviews.push(review);
  await writeReviewsFile(data);
  return { ok: true as const, review };
}

export async function getApprovedReviewSummaryMap(productIds: string[]) {
  const uniqueProductIds = [...new Set(productIds.filter(Boolean))];
  const summaryMap = new Map<string, ProductReviewSummary>(
    uniqueProductIds.map((productId) => [productId, emptyReviewSummary]),
  );

  const sql = getSqlClient();
  if (sql && uniqueProductIds.length > 0) {
    await ensureReviewSchema();
    const rows = await sql<ReviewSummaryRow[]>`
      SELECT
        product_id,
        AVG(rating)::float AS average_rating,
        COUNT(*)::int AS total_reviews
      FROM product_reviews
      WHERE status = 'approved' AND product_id IN ${sql(uniqueProductIds)}
      GROUP BY product_id
    `;

    rows.forEach((row) => {
      summaryMap.set(row.product_id, {
        averageRating: Number(row.average_rating ?? 0),
        totalReviews: Number(row.total_reviews ?? 0),
      });
    });

    return summaryMap;
  }

  if (!canUseJsonFallback()) {
    return summaryMap;
  }

  const data = await readReviewsFile();
  uniqueProductIds.forEach((productId) => {
    const reviews = data.reviews.filter(
      (review) => review.productId === productId && review.status === "approved",
    );
    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? reviews.reduce((total, review) => total + review.rating, 0) / totalReviews
        : 0;

    summaryMap.set(productId, {
      averageRating,
      totalReviews,
    });
  });

  return summaryMap;
}

export async function getApprovedReviewSummary(productId: string) {
  return (
    (await getApprovedReviewSummaryMap([productId])).get(productId) ??
    emptyReviewSummary
  );
}

export async function getApprovedReviewsForProduct(productId: string) {
  const sql = getSqlClient();
  if (sql) {
    await ensureReviewSchema();
    const rows = await sql<ReviewRow[]>`
      SELECT id, product_id, purchase_token, rating, customer_name, comment, status, admin_reply, created_at, updated_at
      FROM product_reviews
      WHERE product_id = ${productId} AND status = 'approved'
      ORDER BY created_at DESC
    `;

    return rows.map(normalizeReview);
  }

  if (!canUseJsonFallback()) {
    return [];
  }

  const data = await readReviewsFile();
  return data.reviews
    .filter((review) => review.productId === productId && review.status === "approved")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function enrichReviews<T extends ProductReview>(reviews: T[]) {
  const products = await getAllProducts();
  const productMap = new Map(products.map((product) => [product.id, product]));

  return reviews.map((review) => {
    const product = productMap.get(review.productId);
    return {
      ...review,
      productName: product?.name ?? "Produit supprime",
      productSlug: product?.slug ?? "",
    };
  });
}

export async function getRecentApprovedReviews(limit = 3): Promise<RecentReview[]> {
  const sql = getSqlClient();
  if (sql) {
    await ensureReviewSchema();
    const rows = await sql<ReviewRow[]>`
      SELECT id, product_id, purchase_token, rating, customer_name, comment, status, admin_reply, created_at, updated_at
      FROM product_reviews
      WHERE status = 'approved'
      ORDER BY rating DESC, created_at DESC
      LIMIT ${limit}
    `;

    return enrichReviews(rows.map(normalizeReview));
  }

  if (!canUseJsonFallback()) {
    return [];
  }

  const data = await readReviewsFile();
  const reviews = data.reviews
    .filter((review) => review.status === "approved")
    .sort((a, b) => b.rating - a.rating || b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);

  return enrichReviews(reviews);
}

export async function getAllReviewsForAdmin(): Promise<ReviewAdminItem[]> {
  const sql = getSqlClient();
  if (sql) {
    await ensureReviewSchema();
    const rows = await sql<ReviewRow[]>`
      SELECT id, product_id, purchase_token, rating, customer_name, comment, status, admin_reply, created_at, updated_at
      FROM product_reviews
      ORDER BY created_at DESC
    `;

    return enrichReviews(rows.map(normalizeReview));
  }

  if (!canUseJsonFallback()) {
    return [];
  }

  const data = await readReviewsFile();
  return enrichReviews(
    data.reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export async function updateReviewAdmin(input: {
  reviewId: string;
  status?: ReviewStatus;
  adminReply?: unknown;
}) {
  const status =
    input.status === "approved" || input.status === "hidden" || input.status === "pending"
      ? input.status
      : undefined;
  const adminReply = cleanText(input.adminReply ?? "", 800);
  const now = new Date().toISOString();

  const sql = getSqlClient();
  if (sql) {
    await ensureReviewSchema();
    const rows = await sql<ReviewRow[]>`
      UPDATE product_reviews
      SET
        status = COALESCE(${status ?? null}, status),
        admin_reply = ${adminReply},
        updated_at = now()
      WHERE id = ${input.reviewId}
      RETURNING id, product_id, purchase_token, rating, customer_name, comment, status, admin_reply, created_at, updated_at
    `;

    return rows[0] ? normalizeReview(rows[0]) : null;
  }

  if (!canUseJsonFallback()) {
    return null;
  }

  const data = await readReviewsFile();
  const reviewIndex = data.reviews.findIndex((review) => review.id === input.reviewId);
  if (reviewIndex < 0) {
    return null;
  }

  data.reviews[reviewIndex] = {
    ...data.reviews[reviewIndex],
    status: status ?? data.reviews[reviewIndex].status,
    adminReply,
    updatedAt: now,
  };
  await writeReviewsFile(data);
  return data.reviews[reviewIndex];
}

export async function deleteReview(reviewId: string) {
  const sql = getSqlClient();
  if (sql) {
    await ensureReviewSchema();
    const rows = await sql<{ id: string }[]>`
      DELETE FROM product_reviews
      WHERE id = ${reviewId}
      RETURNING id
    `;

    return rows.length > 0;
  }

  if (!canUseJsonFallback()) {
    return false;
  }

  const data = await readReviewsFile();
  const nextReviews = data.reviews.filter((review) => review.id !== reviewId);
  const deleted = nextReviews.length !== data.reviews.length;
  data.reviews = nextReviews;
  await writeReviewsFile(data);
  return deleted;
}

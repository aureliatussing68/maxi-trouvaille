import { promises as fs } from "fs";
import path from "path";
import postgres from "postgres";

export type ProductStats = {
  views: number;
  favorites: number;
};

type ProductStatsRow = ProductStats & {
  product_id: string;
};

type ProductStatsFile = {
  products: Record<string, ProductStats>;
  viewEvents: Record<string, string>;
  favorites: Record<string, true>;
};

const emptyStats: ProductStats = {
  views: 0,
  favorites: 0,
};

const statsFilePath = path.join(process.cwd(), "data", "product-stats.json");

let sqlClient: ReturnType<typeof postgres> | null = null;
let schemaReady: Promise<void> | null = null;

function getDatabaseUrl() {
  return (
    process.env.PRODUCT_STATS_DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    ""
  );
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

async function ensureDatabaseSchema() {
  const sql = getSqlClient();
  if (!sql) {
    return;
  }

  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS product_stats (
        product_id text PRIMARY KEY,
        views integer NOT NULL DEFAULT 0 CHECK (views >= 0),
        favorites integer NOT NULL DEFAULT 0 CHECK (favorites >= 0),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS product_view_events (
        product_id text NOT NULL,
        visitor_id text NOT NULL,
        bucket text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (product_id, visitor_id, bucket)
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS product_favorites (
        product_id text NOT NULL,
        visitor_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (product_id, visitor_id)
      )
    `;
  })();

  await schemaReady;
}

function sanitizeCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
}

function normalizeStats(input: Partial<ProductStats> | undefined): ProductStats {
  return {
    views: sanitizeCount(input?.views),
    favorites: sanitizeCount(input?.favorites),
  };
}

function getViewBucket(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getViewEventKey(productId: string, visitorId: string, bucket = getViewBucket()) {
  return `${productId}:${visitorId}:${bucket}`;
}

function getFavoriteKey(productId: string, visitorId: string) {
  return `${productId}:${visitorId}`;
}

async function readStatsFile(): Promise<ProductStatsFile> {
  try {
    const content = await fs.readFile(statsFilePath, "utf8");
    const data = JSON.parse(content) as Partial<ProductStatsFile>;

    return {
      products: Object.fromEntries(
        Object.entries(data.products ?? {}).map(([productId, stats]) => [
          productId,
          normalizeStats(stats),
        ]),
      ),
      viewEvents: data.viewEvents ?? {},
      favorites: data.favorites ?? {},
    };
  } catch {
    return {
      products: {},
      viewEvents: {},
      favorites: {},
    };
  }
}

async function writeStatsFile(data: ProductStatsFile) {
  await fs.mkdir(path.dirname(statsFilePath), { recursive: true });
  await fs.writeFile(statsFilePath, JSON.stringify(data, null, 2), "utf8");
}

async function getDatabaseStatsMap(productIds: string[]) {
  const statsMap = new Map<string, ProductStats>();
  const sql = getSqlClient();

  if (!sql || productIds.length === 0) {
    return statsMap;
  }

  await ensureDatabaseSchema();

  const rows = await sql<ProductStatsRow[]>`
    SELECT product_id, views::int AS views, favorites::int AS favorites
    FROM product_stats
    WHERE product_id IN ${sql(productIds)}
  `;

  rows.forEach((row) => {
    statsMap.set(row.product_id, normalizeStats(row));
  });

  return statsMap;
}

async function getJsonStatsMap(productIds: string[]) {
  const data = await readStatsFile();
  const statsMap = new Map<string, ProductStats>();

  productIds.forEach((productId) => {
    statsMap.set(productId, normalizeStats(data.products[productId]));
  });

  return statsMap;
}

export function normalizeStatsVisitorId(input: unknown) {
  if (typeof input !== "string") {
    return "";
  }

  const visitorId = input.trim();
  return /^[a-zA-Z0-9:_-]{12,120}$/.test(visitorId) ? visitorId : "";
}

export async function getProductStatsMap(productIds: string[]) {
  const uniqueProductIds = [...new Set(productIds.filter(Boolean))];
  const statsMap = new Map<string, ProductStats>(
    uniqueProductIds.map((productId) => [productId, emptyStats]),
  );

  if (getSqlClient()) {
    const databaseStats = await getDatabaseStatsMap(uniqueProductIds);
    databaseStats.forEach((stats, productId) => {
      statsMap.set(productId, stats);
    });

    return statsMap;
  }

  if (canUseJsonFallback()) {
    const jsonStats = await getJsonStatsMap(uniqueProductIds);
    jsonStats.forEach((stats, productId) => {
      statsMap.set(productId, stats);
    });
  }

  return statsMap;
}

export async function getProductStats(productId: string) {
  return (await getProductStatsMap([productId])).get(productId) ?? emptyStats;
}

export async function registerProductView(productId: string, visitorId: string) {
  const cleanVisitorId = normalizeStatsVisitorId(visitorId);
  if (!productId || !cleanVisitorId) {
    return {
      counted: false,
      stats: await getProductStats(productId),
    };
  }

  const sql = getSqlClient();
  if (sql) {
    await ensureDatabaseSchema();
    await sql`
      INSERT INTO product_stats (product_id)
      VALUES (${productId})
      ON CONFLICT (product_id) DO NOTHING
    `;

    const insertedRows = await sql<{ product_id: string }[]>`
      INSERT INTO product_view_events (product_id, visitor_id, bucket)
      VALUES (${productId}, ${cleanVisitorId}, ${getViewBucket()})
      ON CONFLICT DO NOTHING
      RETURNING product_id
    `;
    const counted = insertedRows.length > 0;

    if (counted) {
      await sql`
        UPDATE product_stats
        SET views = views + 1, updated_at = now()
        WHERE product_id = ${productId}
      `;
    }

    return {
      counted,
      stats: await getProductStats(productId),
    };
  }

  if (!canUseJsonFallback()) {
    return {
      counted: false,
      stats: await getProductStats(productId),
    };
  }

  const data = await readStatsFile();
  const eventKey = getViewEventKey(productId, cleanVisitorId);
  const counted = !data.viewEvents[eventKey];

  if (counted) {
    data.viewEvents[eventKey] = new Date().toISOString();
    const stats = normalizeStats(data.products[productId]);
    data.products[productId] = {
      ...stats,
      views: stats.views + 1,
    };
    await writeStatsFile(data);
  }

  return {
    counted,
    stats: normalizeStats(data.products[productId]),
  };
}

export async function setProductFavorite(
  productId: string,
  visitorId: string,
  favorite: boolean,
) {
  const cleanVisitorId = normalizeStatsVisitorId(visitorId);
  if (!productId || !cleanVisitorId) {
    return {
      favorited: false,
      stats: await getProductStats(productId),
    };
  }

  const sql = getSqlClient();
  if (sql) {
    await ensureDatabaseSchema();
    await sql`
      INSERT INTO product_stats (product_id)
      VALUES (${productId})
      ON CONFLICT (product_id) DO NOTHING
    `;

    if (favorite) {
      const insertedRows = await sql<{ product_id: string }[]>`
        INSERT INTO product_favorites (product_id, visitor_id)
        VALUES (${productId}, ${cleanVisitorId})
        ON CONFLICT DO NOTHING
        RETURNING product_id
      `;

      if (insertedRows.length > 0) {
        await sql`
          UPDATE product_stats
          SET favorites = favorites + 1, updated_at = now()
          WHERE product_id = ${productId}
        `;
      }
    } else {
      const deletedRows = await sql<{ product_id: string }[]>`
        DELETE FROM product_favorites
        WHERE product_id = ${productId} AND visitor_id = ${cleanVisitorId}
        RETURNING product_id
      `;

      if (deletedRows.length > 0) {
        await sql`
          UPDATE product_stats
          SET favorites = GREATEST(favorites - 1, 0), updated_at = now()
          WHERE product_id = ${productId}
        `;
      }
    }

    return {
      favorited: favorite,
      stats: await getProductStats(productId),
    };
  }

  if (!canUseJsonFallback()) {
    return {
      favorited: favorite,
      stats: await getProductStats(productId),
    };
  }

  const data = await readStatsFile();
  const favoriteKey = getFavoriteKey(productId, cleanVisitorId);
  const stats = normalizeStats(data.products[productId]);
  const wasFavorited = Boolean(data.favorites[favoriteKey]);

  if (favorite && !wasFavorited) {
    data.favorites[favoriteKey] = true;
    data.products[productId] = {
      ...stats,
      favorites: stats.favorites + 1,
    };
  }

  if (!favorite && wasFavorited) {
    delete data.favorites[favoriteKey];
    data.products[productId] = {
      ...stats,
      favorites: Math.max(0, stats.favorites - 1),
    };
  }

  await writeStatsFile(data);

  return {
    favorited: favorite,
    stats: normalizeStats(data.products[productId]),
  };
}

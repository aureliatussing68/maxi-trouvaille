import { promises as fs } from "fs";
import path from "path";
import postgres from "postgres";

export type ProductMessage = {
  id: string;
  customerName: string;
  customerEmail: string;
  message: string;
  productId: string;
  productName: string;
  productPrice: number;
  productUrl: string;
  createdAt: string;
};

export type ProductMessageInput = Omit<ProductMessage, "id" | "createdAt">;

type ProductMessageRow = {
  id: string;
  customer_name: string;
  customer_email: string;
  message: string;
  product_id: string;
  product_name: string;
  product_price: number | string;
  product_url: string | null;
  created_at: Date | string;
};

const localMessagesPath = path.join(process.cwd(), "data", "product-messages.json");
const temporaryMessagesPath = path.join(
  "/tmp",
  "maxi-trouvaille-product-messages.json",
);

let sqlClient: ReturnType<typeof postgres> | null = null;
let schemaReady: Promise<void> | null = null;

function getDatabaseUrl() {
  return (
    process.env.PRODUCT_MESSAGES_DATABASE_URL ??
    process.env.PRODUCT_STATS_DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    ""
  );
}

function canUseJsonFallback() {
  return !getDatabaseUrl();
}

function getMessagesPath() {
  return process.env.VERCEL === "1" && !getDatabaseUrl()
    ? temporaryMessagesPath
    : localMessagesPath;
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

async function ensureMessagesSchema() {
  const sql = getSqlClient();
  if (!sql) {
    return;
  }

  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS product_messages (
        id text PRIMARY KEY,
        customer_name text NOT NULL,
        customer_email text NOT NULL,
        message text NOT NULL,
        product_id text NOT NULL,
        product_name text NOT NULL,
        product_price integer NOT NULL DEFAULT 0 CHECK (product_price >= 0),
        product_url text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `;
  })();

  await schemaReady;
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeDate(input: Date | string) {
  return input instanceof Date ? input.toISOString() : new Date(input).toISOString();
}

function sanitizeMessage(input: unknown): ProductMessage[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((item): ProductMessage[] => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const maybeMessage = item as Partial<ProductMessage>;
    if (
      typeof maybeMessage.id !== "string" ||
      typeof maybeMessage.customerName !== "string" ||
      typeof maybeMessage.customerEmail !== "string" ||
      typeof maybeMessage.message !== "string" ||
      typeof maybeMessage.productId !== "string" ||
      typeof maybeMessage.productName !== "string" ||
      typeof maybeMessage.productUrl !== "string" ||
      typeof maybeMessage.createdAt !== "string"
    ) {
      return [];
    }

    return [
      {
        id: maybeMessage.id,
        customerName: cleanText(maybeMessage.customerName, 120),
        customerEmail: cleanText(maybeMessage.customerEmail, 180),
        message: cleanText(maybeMessage.message, 2000),
        productId: cleanText(maybeMessage.productId, 120),
        productName: cleanText(maybeMessage.productName, 220),
        productPrice: Math.max(0, Math.trunc(Number(maybeMessage.productPrice)) || 0),
        productUrl: cleanText(maybeMessage.productUrl, 500),
        createdAt: maybeMessage.createdAt,
      },
    ];
  });
}

export async function readProductMessages() {
  const sql = getSqlClient();

  if (sql) {
    await ensureMessagesSchema();
    const rows = await sql<ProductMessageRow[]>`
      SELECT
        id,
        customer_name,
        customer_email,
        message,
        product_id,
        product_name,
        product_price,
        product_url,
        created_at
      FROM product_messages
      ORDER BY created_at DESC
    `;

    return rows.map((row) => ({
      id: row.id,
      customerName: cleanText(row.customer_name, 120),
      customerEmail: cleanText(row.customer_email, 180),
      message: cleanText(row.message, 2000),
      productId: cleanText(row.product_id, 120),
      productName: cleanText(row.product_name, 220),
      productPrice: Math.max(0, Math.trunc(Number(row.product_price)) || 0),
      productUrl: cleanText(row.product_url, 500),
      createdAt: normalizeDate(row.created_at),
    }));
  }

  if (!canUseJsonFallback()) {
    return [];
  }

  try {
    const content = await fs.readFile(getMessagesPath(), "utf8");
    return sanitizeMessage(JSON.parse(content));
  } catch {
    return [];
  }
}

export async function createProductMessage(input: ProductMessageInput) {
  const message: ProductMessage = {
    ...input,
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };

  const sql = getSqlClient();

  if (sql) {
    await ensureMessagesSchema();
    await sql`
      INSERT INTO product_messages (
        id,
        customer_name,
        customer_email,
        message,
        product_id,
        product_name,
        product_price,
        product_url,
        created_at
      )
      VALUES (
        ${message.id},
        ${message.customerName},
        ${message.customerEmail},
        ${message.message},
        ${message.productId},
        ${message.productName},
        ${message.productPrice},
        ${message.productUrl},
        ${message.createdAt}
      )
    `;

    return message;
  }

  const messages = await readProductMessages();
  const messagesPath = getMessagesPath();
  await fs.mkdir(path.dirname(messagesPath), { recursive: true });
  await fs.writeFile(
    messagesPath,
    JSON.stringify([message, ...messages], null, 2),
    "utf8",
  );

  return message;
}

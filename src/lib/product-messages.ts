import { promises as fs } from "fs";
import path from "path";
import postgres from "postgres";

/**
 * Champs de service client assiste. TOUS OPTIONNELS : un message enregistre
 * avant l'activation de la fonctionnalite reste parfaitement valide.
 */
export type ProductMessageSupport = {
  supportCategory?: string;
  supportStatus?: string;
  supportDraft?: string;
  supportDraftSource?: string;
  supportDraftModel?: string;
  supportReason?: string;
  supportDraftAt?: string;
  supportSentAt?: string;
};

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
} & ProductMessageSupport;

export type ProductMessageInput = Omit<
  ProductMessage,
  "id" | "createdAt" | keyof ProductMessageSupport
>;

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
  support_category: string | null;
  support_status: string | null;
  support_draft: string | null;
  support_draft_source: string | null;
  support_draft_model: string | null;
  support_reason: string | null;
  support_draft_at: Date | string | null;
  support_sent_at: Date | string | null;
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

    // CREATE TABLE IF NOT EXISTS n'ajoute jamais de colonne a une table deja
    // creee : les colonnes de service client doivent etre ajoutees a part,
    // sinon l'INSERT casse en production sur une base existante.
    await sql`ALTER TABLE product_messages ADD COLUMN IF NOT EXISTS support_category text`;
    await sql`ALTER TABLE product_messages ADD COLUMN IF NOT EXISTS support_status text`;
    await sql`ALTER TABLE product_messages ADD COLUMN IF NOT EXISTS support_draft text`;
    await sql`ALTER TABLE product_messages ADD COLUMN IF NOT EXISTS support_draft_source text`;
    await sql`ALTER TABLE product_messages ADD COLUMN IF NOT EXISTS support_draft_model text`;
    await sql`ALTER TABLE product_messages ADD COLUMN IF NOT EXISTS support_reason text`;
    await sql`ALTER TABLE product_messages ADD COLUMN IF NOT EXISTS support_draft_at timestamptz`;
    await sql`ALTER TABLE product_messages ADD COLUMN IF NOT EXISTS support_sent_at timestamptz`;
  })();

  await schemaReady;
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeDate(input: Date | string) {
  return input instanceof Date ? input.toISOString() : new Date(input).toISOString();
}

function optionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value.trim().slice(0, maxLength);
  return cleaned || undefined;
}

function optionalDate(input: Date | string | null | undefined) {
  if (!input) {
    return undefined;
  }

  const parsed = input instanceof Date ? input : new Date(input);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * Lecture des champs de service client. Ils sont toujours facultatifs :
 * jamais de rejet ni de valeur par defaut inventee.
 */
function readSupportFields(source: Partial<ProductMessageSupport>): ProductMessageSupport {
  return {
    supportCategory: optionalText(source.supportCategory, 40),
    supportStatus: optionalText(source.supportStatus, 40),
    supportDraft: optionalText(source.supportDraft, 4000),
    supportDraftSource: optionalText(source.supportDraftSource, 40),
    supportDraftModel: optionalText(source.supportDraftModel, 80),
    supportReason: optionalText(source.supportReason, 500),
    supportDraftAt: optionalText(source.supportDraftAt, 40),
    supportSentAt: optionalText(source.supportSentAt, 40),
  };
}

function mapRow(row: ProductMessageRow): ProductMessage {
  return {
    id: row.id,
    customerName: cleanText(row.customer_name, 120),
    customerEmail: cleanText(row.customer_email, 180),
    message: cleanText(row.message, 2000),
    productId: cleanText(row.product_id, 120),
    productName: cleanText(row.product_name, 220),
    productPrice: Math.max(0, Math.trunc(Number(row.product_price)) || 0),
    productUrl: cleanText(row.product_url, 500),
    createdAt: normalizeDate(row.created_at),
    ...supportFieldsFromRow(row),
  };
}

function supportFieldsFromRow(row: ProductMessageRow): ProductMessageSupport {
  return {
    supportCategory: optionalText(row.support_category, 40),
    supportStatus: optionalText(row.support_status, 40),
    supportDraft: optionalText(row.support_draft, 4000),
    supportDraftSource: optionalText(row.support_draft_source, 40),
    supportDraftModel: optionalText(row.support_draft_model, 80),
    supportReason: optionalText(row.support_reason, 500),
    supportDraftAt: optionalDate(row.support_draft_at),
    supportSentAt: optionalDate(row.support_sent_at),
  };
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
        ...readSupportFields(maybeMessage),
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
        created_at,
        support_category,
        support_status,
        support_draft,
        support_draft_source,
        support_draft_model,
        support_reason,
        support_draft_at,
        support_sent_at
      FROM product_messages
      ORDER BY created_at DESC
    `;

    return rows.map(mapRow);
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

/**
 * Met a jour uniquement les champs de service client d'un message.
 * Les champs absents du patch sont conserves tels quels.
 * Rend null si le message n'existe pas.
 */
export async function updateProductMessageSupport(
  id: string,
  patch: ProductMessageSupport,
): Promise<ProductMessage | null> {
  const messageId = cleanText(id, 120);
  if (!messageId) {
    return null;
  }

  const support = readSupportFields(patch);
  const sql = getSqlClient();

  if (sql) {
    await ensureMessagesSchema();
    const rows = await sql<ProductMessageRow[]>`
      UPDATE product_messages
      SET
        support_category = COALESCE(${support.supportCategory ?? null}::text, support_category),
        support_status = COALESCE(${support.supportStatus ?? null}::text, support_status),
        support_draft = COALESCE(${support.supportDraft ?? null}::text, support_draft),
        support_draft_source = COALESCE(${support.supportDraftSource ?? null}::text, support_draft_source),
        support_draft_model = COALESCE(${support.supportDraftModel ?? null}::text, support_draft_model),
        support_reason = COALESCE(${support.supportReason ?? null}::text, support_reason),
        support_draft_at = COALESCE(${support.supportDraftAt ?? null}::timestamptz, support_draft_at),
        support_sent_at = COALESCE(${support.supportSentAt ?? null}::timestamptz, support_sent_at)
      WHERE id = ${messageId}
      RETURNING
        id,
        customer_name,
        customer_email,
        message,
        product_id,
        product_name,
        product_price,
        product_url,
        created_at,
        support_category,
        support_status,
        support_draft,
        support_draft_source,
        support_draft_model,
        support_reason,
        support_draft_at,
        support_sent_at
    `;

    return rows[0] ? mapRow(rows[0]) : null;
  }

  if (!canUseJsonFallback()) {
    return null;
  }

  const messages = await readProductMessages();
  const index = messages.findIndex((entry) => entry.id === messageId);
  if (index < 0) {
    return null;
  }

  const updated: ProductMessage = { ...messages[index] };
  for (const [key, value] of Object.entries(support)) {
    if (value !== undefined) {
      (updated as Record<string, unknown>)[key] = value;
    }
  }

  messages[index] = updated;
  const messagesPath = getMessagesPath();
  await fs.mkdir(path.dirname(messagesPath), { recursive: true });
  await fs.writeFile(messagesPath, JSON.stringify(messages, null, 2), "utf8");

  return updated;
}

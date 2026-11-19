import { neon } from '@neondatabase/serverless';
import type { ErpData } from '../types';
import { productStock } from '../utils/helpers';

export const DEFAULT_NEON_DATABASE_URL =
  'postgresql://neondb_owner:npg_RfVCzb2Hku6s@ep-rapid-pond-b4jw3kx5-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

export const NEON_STORAGE_KEY = 'mnazir_beauty_neon_db_url';
export const NEON_AUTOSYNC_KEY = 'mnazir_beauty_neon_auto_sync';

export interface NeonConnectionStatus {
  success: boolean;
  message: string;
  version?: string;
  database?: string;
  latencyMs?: number;
  tablesCount?: number;
  lastSyncedAt?: string;
}

export function sanitizeNeonUrl(rawUrl: string): string {
  let url = (rawUrl || '').trim();
  if (url && !url.includes('sslmode=')) {
    url += url.includes('?') ? '&sslmode=require' : '?sslmode=require';
  }
  return url;
}

export function getSavedNeonUrl(): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    const fromEnv = env?.VITE_NEON_DATABASE_URL || env?.DATABASE_URL;
    if (fromEnv && fromEnv.trim()) return sanitizeNeonUrl(fromEnv.trim());

    const fromStorage = localStorage.getItem(NEON_STORAGE_KEY);
    if (fromStorage && fromStorage.trim()) return sanitizeNeonUrl(fromStorage.trim());

    localStorage.setItem(NEON_STORAGE_KEY, DEFAULT_NEON_DATABASE_URL);
    localStorage.setItem(NEON_AUTOSYNC_KEY, 'true');
    return DEFAULT_NEON_DATABASE_URL;
  } catch {
    return DEFAULT_NEON_DATABASE_URL;
  }
}

export function isAutoSyncEnabled(): boolean {
  try {
    return localStorage.getItem(NEON_AUTOSYNC_KEY) !== 'false';
  } catch {
    return true;
  }
}

export async function testNeonConnection(rawUrl?: string): Promise<NeonConnectionStatus> {
  const url = sanitizeNeonUrl(rawUrl || getSavedNeonUrl());
  if (!url) {
    return { success: false, message: 'URL PostgreSQL Neon non configurée.' };
  }

  const t0 = performance.now();
  try {
    const sql = neon(url);
    const info = await sql`SELECT version(), current_database()`;
    const tables = await sql`
      SELECT COUNT(*)::int AS cnt
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'mnazir_beauty_%'
    `;
    const latencyMs = Math.round(performance.now() - t0);
    return {
      success: true,
      message: 'Connecté à Neon Cloud PostgreSQL',
      version: String(info[0]?.version || 'PostgreSQL').split(' on ')[0],
      database: String(info[0]?.current_database || 'neondb'),
      latencyMs,
      tablesCount: Number(tables[0]?.cnt || 0),
    };
  } catch (err) {
    return {
      success: false,
      message: (err as Error).message || 'Échec de connexion à Neon PostgreSQL',
    };
  }
}

export async function initializeNeonSchema(rawUrl?: string): Promise<void> {
  const url = sanitizeNeonUrl(rawUrl || getSavedNeonUrl());
  const sql = neon(url);

  await sql`
    CREATE TABLE IF NOT EXISTS mnazir_beauty_erp_state (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS mnazir_beauty_products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      buy_price NUMERIC DEFAULT 0,
      sell_price NUMERIC DEFAULT 0,
      stock_total INTEGER DEFAULT 0,
      variants JSONB,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS mnazir_beauty_customers (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      loyalty_points INTEGER DEFAULT 0,
      total_spent NUMERIC DEFAULT 0,
      credit_balance NUMERIC DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS mnazir_beauty_sales (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL,
      doc_type TEXT,
      sale_date TEXT,
      sale_time TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      total NUMERIC DEFAULT 0,
      amount_paid NUMERIC DEFAULT 0,
      amount_remaining NUMERIC DEFAULT 0,
      status TEXT,
      channel TEXT,
      items JSONB,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS mnazir_beauty_orders (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL,
      customer_name TEXT,
      customer_phone TEXT,
      garment TEXT,
      quantity INTEGER DEFAULT 1,
      price NUMERIC DEFAULT 0,
      amount_paid NUMERIC DEFAULT 0,
      status TEXT,
      due_date TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS mnazir_beauty_deliveries (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL,
      delivery_date TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      neighborhood TEXT,
      courier TEXT,
      fee NUMERIC DEFAULT 0,
      amount_to_collect NUMERIC DEFAULT 0,
      status TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS mnazir_beauty_expenses (
      id TEXT PRIMARY KEY,
      expense_date TEXT,
      category TEXT,
      label TEXT,
      amount NUMERIC DEFAULT 0,
      method TEXT,
      cashier TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function pushErpDataToNeon(data: ErpData, rawUrl?: string): Promise<void> {
  const url = sanitizeNeonUrl(rawUrl || getSavedNeonUrl());
  if (!url) return;
  const sql = neon(url);

  await initializeNeonSchema(url);

  const payloadJson = JSON.stringify(data);
  await sql`
    INSERT INTO mnazir_beauty_erp_state (id, payload, updated_at)
    VALUES ('main_state', ${payloadJson}::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE
    SET payload = EXCLUDED.payload, updated_at = NOW()
  `;

  // Synchronisation relationnelle des produits
  for (const p of data.products) {
    const stockTotal = productStock(p);
    const vJson = JSON.stringify(p.variants || []);
    await sql`
      INSERT INTO mnazir_beauty_products (id, name, category, buy_price, sell_price, stock_total, variants, updated_at)
      VALUES (${p.id}, ${p.name}, ${p.category}, ${p.buyPrice}, ${p.sellPrice}, ${stockTotal}, ${vJson}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          category = EXCLUDED.category,
          buy_price = EXCLUDED.buy_price,
          sell_price = EXCLUDED.sell_price,
          stock_total = EXCLUDED.stock_total,
          variants = EXCLUDED.variants,
          updated_at = NOW()
    `;
  }

  // Synchronisation relationnelle des clientes
  for (const c of data.customers) {
    await sql`
      INSERT INTO mnazir_beauty_customers (id, full_name, phone, address, loyalty_points, total_spent, credit_balance, updated_at)
      VALUES (${c.id}, ${c.fullName}, ${c.phone}, ${c.address || ''}, ${c.loyaltyPoints}, ${c.totalSpent}, ${c.creditBalance}, NOW())
      ON CONFLICT (id) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          phone = EXCLUDED.phone,
          address = EXCLUDED.address,
          loyalty_points = EXCLUDED.loyalty_points,
          total_spent = EXCLUDED.total_spent,
          credit_balance = EXCLUDED.credit_balance,
          updated_at = NOW()
    `;
  }

  // Synchronisation relationnelle des 40 dernières ventes pour requêtes SQL rapides
  for (const s of data.sales.slice(0, 40)) {
    const itemsJson = JSON.stringify(s.items || []);
    await sql`
      INSERT INTO mnazir_beauty_sales (id, number, doc_type, sale_date, sale_time, customer_name, customer_phone, total, amount_paid, amount_remaining, status, channel, items, updated_at)
      VALUES (${s.id}, ${s.number}, ${s.docType}, ${s.date}, ${s.time}, ${s.customerName}, ${s.customerPhone || ''}, ${s.total}, ${s.amountPaid}, ${s.amountRemaining}, ${s.status}, ${s.channel}, ${itemsJson}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
      SET total = EXCLUDED.total,
          amount_paid = EXCLUDED.amount_paid,
          amount_remaining = EXCLUDED.amount_remaining,
          status = EXCLUDED.status,
          updated_at = NOW()
    `;
  }

  // Synchronisation relationnelle des lots de production
  for (const o of data.orders) {
    await sql`
      INSERT INTO mnazir_beauty_orders (id, number, customer_name, customer_phone, garment, quantity, price, amount_paid, status, due_date, updated_at)
      VALUES (${o.id}, ${o.number}, ${o.customerName}, ${o.customerPhone}, ${o.garment}, ${o.quantity}, ${o.price}, ${o.amountPaid}, ${o.status}, ${o.dueDate}, NOW())
      ON CONFLICT (id) DO UPDATE
      SET status = EXCLUDED.status,
          amount_paid = EXCLUDED.amount_paid,
          price = EXCLUDED.price,
          updated_at = NOW()
    `;
  }

  // Synchronisation relationnelle des livraisons
  for (const l of data.deliveries) {
    await sql`
      INSERT INTO mnazir_beauty_deliveries (id, number, delivery_date, customer_name, customer_phone, neighborhood, courier, fee, amount_to_collect, status, updated_at)
      VALUES (${l.id}, ${l.number}, ${l.date}, ${l.customerName}, ${l.customerPhone}, ${l.neighborhood}, ${l.courier}, ${l.fee}, ${l.amountToCollect}, ${l.status}, NOW())
      ON CONFLICT (id) DO UPDATE
      SET status = EXCLUDED.status,
          courier = EXCLUDED.courier,
          amount_to_collect = EXCLUDED.amount_to_collect,
          updated_at = NOW()
    `;
  }

  // Synchronisation relationnelle des dépenses
  for (const e of data.expenses) {
    await sql`
      INSERT INTO mnazir_beauty_expenses (id, expense_date, category, label, amount, method, cashier, updated_at)
      VALUES (${e.id}, ${e.date}, ${e.category}, ${e.label}, ${e.amount}, ${e.method}, ${e.cashier}, NOW())
      ON CONFLICT (id) DO UPDATE
      SET amount = EXCLUDED.amount,
          label = EXCLUDED.label,
          updated_at = NOW()
    `;
  }
}

export async function pullErpDataFromNeon(rawUrl?: string): Promise<ErpData | null> {
  const url = sanitizeNeonUrl(rawUrl || getSavedNeonUrl());
  if (!url) return null;
  const sql = neon(url);

  await initializeNeonSchema(url);

  const rows = await sql`
    SELECT payload FROM mnazir_beauty_erp_state WHERE id = 'main_state' LIMIT 1
  `;
  if (rows.length > 0 && rows[0]?.payload) {
    const payload = typeof rows[0].payload === 'string' ? JSON.parse(rows[0].payload) : rows[0].payload;
    if (payload && Array.isArray(payload.products)) {
      return payload as ErpData;
    }
  }
  return null;
}

export async function runCustomSqlQuery(query: string, rawUrl?: string): Promise<{ rows: Record<string, unknown>[]; durationMs: number }> {
  const url = sanitizeNeonUrl(rawUrl || getSavedNeonUrl());
  const sql = neon(url);
  const t0 = performance.now();
  const rows = await (sql as unknown as { query: (q: string) => Promise<Record<string, unknown>[]> }).query
    ? await (sql as unknown as { query: (q: string) => Promise<Record<string, unknown>[]> }).query(query)
    : await sql([query] as unknown as TemplateStringsArray);
  return {
    rows: Array.isArray(rows) ? rows : [],
    durationMs: Math.round(performance.now() - t0),
  };
}

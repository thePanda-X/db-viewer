import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

const CLEAR = process.env.DEMO_DB_CLEAR !== 'false';
const SQLITE_FILE =
  process.env.SQLITE_DEMO_FILE ?? path.join('demo-data', 'demo.sqlite');
const POSTGRES_SCHEMA = process.env.POSTGRES_DEMO_SCHEMA ?? 'demo';
const SKIP_POSTGRES = process.env.POSTGRES_DEMO_SKIP === 'true';

const customers = [
  {
    id: 1,
    name: 'Alice Smith',
    email: 'alice@example.com',
    tier: 'enterprise',
    active: true,
    city: 'Seattle',
    country: 'US',
    signup: '2024-01-11T10:20:00Z',
    notes: 'Needs quarterly compliance exports.',
  },
  {
    id: 2,
    name: 'Bob Jones',
    email: 'bob@example.com',
    tier: 'standard',
    active: true,
    city: 'Austin',
    country: 'US',
    signup: '2024-02-19T15:12:00Z',
    notes: null,
  },
  {
    id: 3,
    name: 'Carla Ruiz',
    email: 'carla@example.es',
    tier: 'trial',
    active: false,
    city: 'Madrid',
    country: 'ES',
    signup: '2024-03-02T08:45:00Z',
    notes: 'Trial expired after import testing.',
  },
  {
    id: 4,
    name: 'Devon Chen',
    email: 'devon@example.sg',
    tier: 'standard',
    active: true,
    city: 'Singapore',
    country: 'SG',
    signup: '2024-04-23T02:30:00Z',
    notes: 'Prefers API-first workflows.',
  },
  {
    id: 5,
    name: 'Eve Taylor',
    email: 'eve@example.co.uk',
    tier: 'enterprise',
    active: true,
    city: 'London',
    country: 'GB',
    signup: '2024-05-17T19:05:00Z',
    notes: 'Runs large CSV exports weekly.',
  },
];

const products = [
  { id: 1, sku: 'WGT-PRO', name: 'Premium Widget', price: 149.99, stock: 42 },
  { id: 2, sku: 'GDT-BASIC', name: 'Basic Gadget', price: 24.5, stock: 0 },
  { id: 3, sku: 'DEV-ULTRA', name: 'Ultra Device', price: 399, stock: 13 },
  { id: 4, sku: 'KIT-ECO', name: 'Eco Starter Kit', price: 59.95, stock: 117 },
  { id: 5, sku: 'ACC-CABLE', name: 'Braided Cable', price: 12.99, stock: 250 },
];

const orders = [
  {
    id: 1001,
    customerId: 1,
    status: 'paid',
    total: 562.97,
    placed: '2024-06-01T12:00:00Z',
  },
  {
    id: 1002,
    customerId: 2,
    status: 'pending',
    total: 84.45,
    placed: '2024-06-03T16:30:00Z',
  },
  {
    id: 1003,
    customerId: 1,
    status: 'shipped',
    total: 149.99,
    placed: '2024-06-05T09:15:00Z',
  },
  {
    id: 1004,
    customerId: 4,
    status: 'cancelled',
    total: 399,
    placed: '2024-06-08T22:10:00Z',
  },
  {
    id: 1005,
    customerId: 5,
    status: 'paid',
    total: 212.93,
    placed: '2024-06-11T07:55:00Z',
  },
  {
    id: 1006,
    customerId: 3,
    status: 'refunded',
    total: 24.5,
    placed: '2024-06-13T13:45:00Z',
  },
];

const orderItems = [
  { orderId: 1001, productId: 1, qty: 2, unit: 149.99 },
  { orderId: 1001, productId: 3, qty: 1, unit: 399 },
  { orderId: 1002, productId: 4, qty: 1, unit: 59.95 },
  { orderId: 1002, productId: 2, qty: 1, unit: 24.5 },
  { orderId: 1003, productId: 1, qty: 1, unit: 149.99 },
  { orderId: 1004, productId: 3, qty: 1, unit: 399 },
  { orderId: 1005, productId: 4, qty: 3, unit: 59.95 },
  { orderId: 1005, productId: 5, qty: 1, unit: 12.99 },
  { orderId: 1006, productId: 2, qty: 1, unit: 24.5 },
];

const tickets = [
  {
    id: 1,
    customerId: 1,
    priority: 'high',
    subject: 'Export timeout',
    open: true,
  },
  {
    id: 2,
    customerId: 2,
    priority: 'low',
    subject: 'Invoice copy request',
    open: false,
  },
  {
    id: 3,
    customerId: 5,
    priority: 'urgent',
    subject: 'SAML login failing',
    open: true,
  },
];

function json(value: unknown): string {
  return JSON.stringify(value);
}

type SqliteDatabase = {
  exec(sql: string): void;
  pragma?(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
  };
  transaction?(fn: () => void): () => void;
  close(): void;
};

async function openSqliteDatabase(filePath: string): Promise<SqliteDatabase> {
  if ('bun' in process.versions) {
    const mod = (await import('bun:sqlite')) as {
      Database: new (path: string) => SqliteDatabase;
    };
    return new mod.Database(filePath);
  }

  const mod = (await import('better-sqlite3')) as {
    default: new (path: string) => SqliteDatabase;
  };
  return new mod.default(filePath);
}

async function seedPostgres() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE ?? 'testdb',
    user: process.env.PGUSER ?? 'postgres',
    password: process.env.PGPASSWORD ?? 'postgres',
  });

  await client.connect();
  try {
    if (CLEAR)
      await client.query(`DROP SCHEMA IF EXISTS ${POSTGRES_SCHEMA} CASCADE`);
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${POSTGRES_SCHEMA}`);
    await client.query(`SET search_path TO ${POSTGRES_SCHEMA}`);
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE ${POSTGRES_SCHEMA}.customer_tier AS ENUM ('trial', 'standard', 'enterprise');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE ${POSTGRES_SCHEMA}.order_status AS ENUM ('pending', 'paid', 'shipped', 'cancelled', 'refunded');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE TABLE IF NOT EXISTS customers (
        id integer PRIMARY KEY,
        name text NOT NULL,
        email text NOT NULL UNIQUE,
        tier customer_tier NOT NULL,
        active boolean NOT NULL DEFAULT true,
        city text NOT NULL,
        country char(2) NOT NULL,
        signup_at timestamptz NOT NULL,
        notes text,
        preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
        tags text[] NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS products (
        id integer PRIMARY KEY,
        sku text NOT NULL UNIQUE,
        name text NOT NULL,
        price numeric(10, 2) NOT NULL CHECK (price >= 0),
        stock integer NOT NULL CHECK (stock >= 0),
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb
      );

      CREATE TABLE IF NOT EXISTS orders (
        id integer PRIMARY KEY,
        customer_id integer NOT NULL REFERENCES customers(id),
        status order_status NOT NULL,
        total numeric(10, 2) NOT NULL,
        placed_at timestamptz NOT NULL,
        shipping_address jsonb
      );

      CREATE TABLE IF NOT EXISTS order_items (
        order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id integer NOT NULL REFERENCES products(id),
        quantity integer NOT NULL CHECK (quantity > 0),
        unit_price numeric(10, 2) NOT NULL,
        PRIMARY KEY (order_id, product_id)
      );

      CREATE TABLE IF NOT EXISTS support_tickets (
        id integer PRIMARY KEY,
        customer_id integer REFERENCES customers(id),
        priority text NOT NULL,
        subject text NOT NULL,
        open boolean NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE OR REPLACE VIEW order_summary AS
        SELECT o.id AS order_id, c.name AS customer, o.status, o.total, o.placed_at,
          count(oi.product_id)::integer AS line_count
        FROM orders o
        JOIN customers c ON c.id = o.customer_id
        LEFT JOIN order_items oi ON oi.order_id = o.id
        GROUP BY o.id, c.name;
    `);

    for (const customer of customers) {
      await client.query(
        `INSERT INTO customers VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [
          customer.id,
          customer.name,
          customer.email,
          customer.tier,
          customer.active,
          customer.city,
          customer.country,
          customer.signup,
          customer.notes,
          json({ theme: customer.id % 2 ? 'dark' : 'light', rowsPerPage: 50 }),
          [customer.tier, customer.country.toLowerCase()],
        ],
      );
    }
    for (const product of products) {
      await client.query(
        `INSERT INTO products VALUES ($1,$2,$3,$4,$5,$6::jsonb)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [
          product.id,
          product.sku,
          product.name,
          product.price,
          product.stock,
          json({ taxable: product.price > 20 }),
        ],
      );
    }
    for (const order of orders) {
      await client.query(
        `INSERT INTO orders VALUES ($1,$2,$3,$4,$5,$6::jsonb)
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
        [
          order.id,
          order.customerId,
          order.status,
          order.total,
          order.placed,
          json({ city: 'Demo City', country: 'US' }),
        ],
      );
    }
    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items VALUES ($1,$2,$3,$4)
         ON CONFLICT (order_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
        [item.orderId, item.productId, item.qty, item.unit],
      );
    }
    for (const ticket of tickets) {
      await client.query(
        `INSERT INTO support_tickets (id, customer_id, priority, subject, open) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO UPDATE SET subject = EXCLUDED.subject`,
        [
          ticket.id,
          ticket.customerId,
          ticket.priority,
          ticket.subject,
          ticket.open,
        ],
      );
    }
    console.log(`Seeded PostgreSQL schema "${POSTGRES_SCHEMA}".`);
  } finally {
    await client.end();
  }
}

async function seedSqlite() {
  fs.mkdirSync(path.dirname(SQLITE_FILE), { recursive: true });
  if (CLEAR && fs.existsSync(SQLITE_FILE)) fs.unlinkSync(SQLITE_FILE);
  const db = await openSqliteDatabase(SQLITE_FILE);
  try {
    if (db.pragma) db.pragma('foreign_keys = ON');
    else db.exec('PRAGMA foreign_keys = ON');
    db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        tier TEXT NOT NULL CHECK (tier IN ('trial', 'standard', 'enterprise')),
        active INTEGER NOT NULL DEFAULT 1,
        city TEXT NOT NULL,
        country TEXT NOT NULL,
        signup_at TEXT NOT NULL,
        notes TEXT,
        preferences TEXT NOT NULL DEFAULT '{}',
        tags TEXT NOT NULL DEFAULT '[]'
      );
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        sku TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        price REAL NOT NULL CHECK (price >= 0),
        stock INTEGER NOT NULL CHECK (stock >= 0),
        metadata TEXT NOT NULL DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'shipped', 'cancelled', 'refunded')),
        total REAL NOT NULL,
        placed_at TEXT NOT NULL,
        shipping_address TEXT
      );
      CREATE TABLE IF NOT EXISTS order_items (
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price REAL NOT NULL,
        PRIMARY KEY (order_id, product_id)
      );
      CREATE TABLE IF NOT EXISTS support_tickets (
        id INTEGER PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        priority TEXT NOT NULL,
        subject TEXT NOT NULL,
        open INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE VIEW IF NOT EXISTS order_summary AS
        SELECT o.id AS order_id, c.name AS customer, o.status, o.total, o.placed_at,
          count(oi.product_id) AS line_count
        FROM orders o
        JOIN customers c ON c.id = o.customer_id
        LEFT JOIN order_items oi ON oi.order_id = o.id
        GROUP BY o.id, c.name;
    `);

    const tx = db.transaction(() => {
      const insertCustomer = db.prepare(
        `INSERT OR REPLACE INTO customers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const c of customers)
        insertCustomer.run(
          c.id,
          c.name,
          c.email,
          c.tier,
          c.active ? 1 : 0,
          c.city,
          c.country,
          c.signup,
          c.notes,
          json({ theme: c.id % 2 ? 'dark' : 'light', rowsPerPage: 50 }),
          json([c.tier, c.country.toLowerCase()]),
        );
      const insertProduct = db.prepare(
        `INSERT OR REPLACE INTO products VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const p of products)
        insertProduct.run(
          p.id,
          p.sku,
          p.name,
          p.price,
          p.stock,
          json({ taxable: p.price > 20 }),
        );
      const insertOrder = db.prepare(
        `INSERT OR REPLACE INTO orders VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const o of orders)
        insertOrder.run(
          o.id,
          o.customerId,
          o.status,
          o.total,
          o.placed,
          json({ city: 'Demo City', country: 'US' }),
        );
      const insertItem = db.prepare(
        `INSERT OR REPLACE INTO order_items VALUES (?, ?, ?, ?)`,
      );
      for (const i of orderItems)
        insertItem.run(i.orderId, i.productId, i.qty, i.unit);
      const insertTicket = db.prepare(
        `INSERT OR REPLACE INTO support_tickets (id, customer_id, priority, subject, open) VALUES (?, ?, ?, ?, ?)`,
      );
      for (const t of tickets)
        insertTicket.run(
          t.id,
          t.customerId,
          t.priority,
          t.subject,
          t.open ? 1 : 0,
        );
    });
    tx();
    console.log(`Created SQLite demo database at ${SQLITE_FILE}.`);
  } finally {
    db.close();
  }
}

async function main() {
  let failed = false;

  if (!SKIP_POSTGRES) {
    try {
      await seedPostgres();
    } catch (err) {
      failed = true;
      console.error('Failed to seed PostgreSQL demo database.');
      console.error(err);
    }
  }

  try {
    await seedSqlite();
  } catch (err) {
    failed = true;
    console.error('Failed to create SQLite demo database.');
    console.error(err);
  }

  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

import { Pool, types } from 'pg';
import type pg from 'pg';
import type {
  ColumnMeta,
  DatabaseInfo,
  DeleteRowsRequest,
  ForeignKey,
  InsertRowRequest,
  InsertRowResponse,
  PostgresConfig,
  QueryRequest,
  QueryResponse,
  QueryResult,
  SaveChangesRequest,
  SaveChangesResponse,
  TableInfo,
  TableMeta,
} from '../src/types/postgres';
import type {
  SqlDeleteRowsResponse,
  SqlLookupRowsResponse,
} from '../shared/types/sql';

const DEFAULT_STATEMENT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_ROWS = 10_000;

types.setTypeParser(20, (val) => (val == null ? val : Number(val)));
types.setTypeParser(21, (val) => (val == null ? val : Number(val)));
types.setTypeParser(1700, (val) => (val == null ? val : Number(val)));
types.setTypeParser(114, (val) => (val == null ? val : val));
types.setTypeParser(3802, (val) => (val == null ? val : val));
types.setTypeParser(2950, (val) => (val == null ? val : val));

const pools = new Map<string, pg.Pool>();

const enumValueCache = new Map<string, Map<string, string[]>>();
const enumCacheIndex = new Map<string, Set<string>>();

function buildEnumCacheKey(
  connectionId: string,
  database: string,
  schema: string,
  table: string,
): string {
  return `${connectionId}::${database}::${schema}::${table}`;
}

function getCachedEnumValues(key: string): Map<string, string[]> | null {
  return enumValueCache.get(key) ?? null;
}

function setCachedEnumValues(
  key: string,
  connectionId: string,
  values: Map<string, string[]>,
): void {
  enumValueCache.set(key, values);
  const set = enumCacheIndex.get(connectionId) ?? new Set<string>();
  set.add(key);
  enumCacheIndex.set(connectionId, set);
}

function invalidateEnumCacheForConnection(connectionId: string): void {
  const keys = enumCacheIndex.get(connectionId);
  if (!keys) return;
  for (const k of keys) enumValueCache.delete(k);
  enumCacheIndex.delete(connectionId);
}

function invalidateEnumCacheForDatabase(
  connectionId: string,
  database: string,
): void {
  const keys = enumCacheIndex.get(connectionId);
  if (!keys) return;
  const prefix = `${connectionId}::${database}::`;
  for (const k of keys) {
    if (k.startsWith(prefix)) enumValueCache.delete(k);
  }
  const remaining = new Set<string>();
  for (const k of keys) if (!k.startsWith(prefix)) remaining.add(k);
  if (remaining.size > 0) enumCacheIndex.set(connectionId, remaining);
  else enumCacheIndex.delete(connectionId);
}

function buildPoolKey(connectionId: string, database: string): string {
  return `${connectionId}::${database}`;
}

function createPool(
  connectionId: string,
  config: PostgresConfig,
  database: string,
): pg.Pool {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    database,
    user: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: DEFAULT_STATEMENT_TIMEOUT_MS,
  });
  pool.on('error', (err) => {
    console.error(
      `[postgres] idle pool error for ${connectionId}@${database}:`,
      err,
    );
  });
  return pool;
}

function getPool(
  connectionId: string,
  config: PostgresConfig,
  database: string,
): pg.Pool {
  const key = buildPoolKey(connectionId, database);
  const existing = pools.get(key);
  if (existing) return existing;
  const pool = createPool(connectionId, config, database);
  pools.set(key, pool);
  return pool;
}

function dropPool(connectionId: string, database?: string): void {
  if (database) {
    const key = buildPoolKey(connectionId, database);
    const pool = pools.get(key);
    if (pool) {
      void pool.end().catch((err) => {
        console.error(`[postgres] error ending pool ${key}:`, err);
      });
      pools.delete(key);
    }
    invalidateEnumCacheForDatabase(connectionId, database);
    return;
  }
  for (const [key, pool] of pools.entries()) {
    if (!key.startsWith(`${connectionId}::`)) continue;
    void pool.end().catch((err) => {
      console.error(`[postgres] error ending pool ${key}:`, err);
    });
    pools.delete(key);
  }
  invalidateEnumCacheForConnection(connectionId);
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

function postgresErrorCode(err: unknown): string | null {
  if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    typeof err.code === 'string'
  ) {
    return err.code;
  }
  return null;
}

function postgresConstraintName(err: unknown): string | null {
  if (
    err &&
    typeof err === 'object' &&
    'constraint' in err &&
    typeof err.constraint === 'string'
  ) {
    return err.constraint;
  }
  return null;
}

async function describeConstraint(
  client: pg.PoolClient,
  schema: string,
  table: string,
  constraint: string,
): Promise<string | null> {
  const result = await client.query(
    `SELECT array_agg(a.attname ORDER BY cols.ord)::text[] AS columns
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       JOIN unnest(c.conkey) WITH ORDINALITY AS cols(attnum, ord) ON TRUE
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = cols.attnum
      WHERE n.nspname = $1
        AND t.relname = $2
        AND c.conname = $3
      GROUP BY c.oid`,
    [schema, table, constraint],
  );
  const columns = result.rows[0]?.columns;
  if (!Array.isArray(columns) || columns.length === 0) return null;
  return columns.map(String).join(', ');
}

function rowsToColumns(rows: Record<string, unknown>[]): {
  columns: string[];
  rows: unknown[][];
} {
  if (rows.length === 0) {
    return { columns: [], rows: [] };
  }
  const first = rows[0];
  const columns = Object.keys(first);
  const projected = rows.map((r) => columns.map((c) => r[c]));
  return { columns, rows: projected };
}

export async function runQuery(
  connectionId: string,
  config: PostgresConfig,
  req: QueryRequest,
): Promise<QueryResponse> {
  const maxRows = req.maxRows ?? DEFAULT_MAX_ROWS;
  const database = config.database;
  const pool = getPool(connectionId, config, database);
  const started = Date.now();
  let client: pg.PoolClient | null = null;
  try {
    client = await pool.connect();
    let result: pg.QueryResult;
    if (
      req.sql.trim().toUpperCase().startsWith('SELECT') ||
      req.sql.trim().toUpperCase().startsWith('WITH')
    ) {
      const wrapped = `SELECT * FROM (${req.sql}) AS _dbvwr_query LIMIT $${(req.params?.length ?? 0) + 1}`;
      const params = [...(req.params ?? []), maxRows + 1];
      result = await client.query(wrapped, params);
    } else {
      result = await client.query(req.sql, req.params ?? []);
    }
    const allRows = result.rows as Record<string, unknown>[];
    const truncated = allRows.length > maxRows;
    const limited = truncated ? allRows.slice(0, maxRows) : allRows;
    const { columns, rows } = rowsToColumns(limited);
    const queryResult: QueryResult = {
      columns,
      rows,
      rowCount: allRows.length,
      affectedRows: result.rowCount ?? null,
      durationMs: Date.now() - started,
      truncated,
    };
    return { ok: true, result: queryResult };
  } catch (err) {
    return { ok: false, error: toErrorMessage(err) };
  } finally {
    if (client) client.release();
  }
}

export async function runReadOnlyQuery(
  connectionId: string,
  config: PostgresConfig,
  req: QueryRequest,
): Promise<QueryResponse> {
  const maxRows = req.maxRows ?? DEFAULT_MAX_ROWS;
  const database = config.database;
  const pool = getPool(connectionId, config, database);
  const started = Date.now();
  let client: pg.PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SET TRANSACTION READ ONLY');
    let result: pg.QueryResult;
    if (
      req.sql.trim().toUpperCase().startsWith('SELECT') ||
      req.sql.trim().toUpperCase().startsWith('WITH')
    ) {
      const wrapped = `SELECT * FROM (${req.sql}) AS _dbvwr_query LIMIT $${(req.params?.length ?? 0) + 1}`;
      const params = [...(req.params ?? []), maxRows + 1];
      result = await client.query(wrapped, params);
    } else {
      result = await client.query(req.sql, req.params ?? []);
    }
    const allRows = result.rows as Record<string, unknown>[];
    const truncated = allRows.length > maxRows;
    const limited = truncated ? allRows.slice(0, maxRows) : allRows;
    const { columns, rows } = rowsToColumns(limited);
    await client.query('COMMIT');
    const queryResult: QueryResult = {
      columns,
      rows,
      rowCount: allRows.length,
      affectedRows: result.rowCount ?? null,
      durationMs: Date.now() - started,
      truncated,
    };
    return { ok: true, result: queryResult };
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[postgres] rollback failed:', rollbackErr);
      }
    }
    return { ok: false, error: toErrorMessage(err) };
  } finally {
    if (client) client.release();
  }
}

export async function listDatabases(
  connectionId: string,
  config: PostgresConfig,
): Promise<DatabaseInfo[]> {
  const res = await runReadOnlyQuery(connectionId, config, {
    sql: 'SELECT datname AS name FROM pg_database WHERE datistemplate = false ORDER BY datname',
  });
  if (!res.ok) throw new Error(res.error);
  const current = config.database;
  return res.result.rows.map((row) => ({
    name: String(row[0]),
    current: String(row[0]) === current,
  }));
}

export async function listTables(
  connectionId: string,
  config: PostgresConfig,
  database: string,
): Promise<TableInfo[]> {
  const res = await runReadOnlyQuery(
    connectionId,
    { ...config, database },
    {
      sql: `SELECT table_schema, table_name, table_type
          FROM information_schema.tables
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          ORDER BY table_schema, table_name`,
    },
  );
  if (!res.ok) throw new Error(res.error);
  return res.result.rows.map((row) => {
    const type = String(row[2]).toLowerCase();
    return {
      schema: String(row[0]),
      name: String(row[1]),
      type: type === 'view' ? 'view' : 'table',
    };
  });
}

export async function getTableMeta(
  connectionId: string,
  config: PostgresConfig,
  database: string,
  schema: string,
  table: string,
): Promise<TableMeta> {
  const qualified = `${ident(schema)}.${ident(table)}`;
  const res = await runReadOnlyQuery(
    connectionId,
    { ...config, database },
    {
      sql: `SELECT column_name, data_type, udt_name, is_nullable, is_generated
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position`,
      params: [schema, table],
    },
  );
  if (!res.ok) throw new Error(res.error);
  if (res.result.rows.length === 0) {
    throw new Error(`Table ${qualified} not found in ${database}`);
  }

  const pkRes = await runReadOnlyQuery(
    connectionId,
    { ...config, database },
    {
      sql: `SELECT a.attname
          FROM pg_index i
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          JOIN pg_class c ON c.oid = i.indrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE i.indisprimary
            AND n.nspname = $1
            AND c.relname = $2
          ORDER BY array_position(i.indkey, a.attnum)`,
      params: [schema, table],
    },
  );
  if (!pkRes.ok) throw new Error(pkRes.error);
  const primaryKey = pkRes.result.rows.map((r) => String(r[0]));

  const cacheKey = buildEnumCacheKey(connectionId, database, schema, table);
  let enumByUdt = getCachedEnumValues(cacheKey);
  if (!enumByUdt) {
    enumByUdt = await fetchNativeEnumValues(
      connectionId,
      { ...config, database },
      schema,
      table,
    );
    setCachedEnumValues(cacheKey, connectionId, enumByUdt);
  }

  const columns: ColumnMeta[] = res.result.rows.map((row) => {
    const name = String(row[0]);
    const dataType = String(row[1]);
    const udtName = String(row[2]);
    const col: ColumnMeta = {
      name,
      dataType,
      udtName,
      isNullable: String(row[3]).toUpperCase() === 'YES',
      isGenerated: String(row[4]) === 'ALWAYS' || String(row[4]) === 'YES',
      isPrimaryKey: primaryKey.includes(name),
    };
    if (dataType === 'USER-DEFINED') {
      const values = enumByUdt.get(udtName);
      if (values && values.length > 0) col.enumValues = values;
    }
    return col;
  });

  return { columns, primaryKey: primaryKey.length > 0 ? primaryKey : null };
}

async function fetchNativeEnumValues(
  connectionId: string,
  config: PostgresConfig,
  schema: string,
  table: string,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const res = await runReadOnlyQuery(connectionId, config, {
    sql: `SELECT t.typname AS udt_name, e.enumlabel AS value
          FROM pg_type t
          JOIN pg_enum e ON e.enumtypid = t.oid
          JOIN information_schema.columns c
            ON c.udt_name = t.typname
           AND c.table_schema = $1
           AND c.table_name = $2
          WHERE t.typtype = 'e'
          ORDER BY t.typname, e.enumsortorder`,
    params: [schema, table],
  });
  if (!res.ok) return out;
  for (const row of res.result.rows) {
    const udt = String(row[0]);
    const value = String(row[1]);
    let list = out.get(udt);
    if (!list) {
      list = [];
      out.set(udt, list);
    }
    list.push(value);
  }
  return out;
}

function ident(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return `"${name}"`;
}

export async function getTableRelations(
  connectionId: string,
  config: PostgresConfig,
  database: string,
  schema: string,
  table: string,
): Promise<ForeignKey[]> {
  const res = await runReadOnlyQuery(
    connectionId,
    { ...config, database },
    {
      sql: `SELECT
            c.conname        AS constraint_name,
            n1.nspname       AS source_schema,
            c1.relname       AS source_table,
            a.attname        AS column_name,
            nr.nspname       AS ref_schema,
            cr.relname       AS ref_table,
            af.attname       AS ref_column,
            tf.typname       AS ref_udt_name,
            local_ord.ord    AS ordinal
          FROM pg_constraint c
          JOIN pg_class     c1  ON c1.oid = c.conrelid
          JOIN pg_namespace n1  ON n1.oid = c1.relnamespace
          JOIN pg_class     cr  ON cr.oid = c.confrelid
          JOIN pg_namespace nr  ON nr.oid = cr.relnamespace
          JOIN unnest(c.conkey)  WITH ORDINALITY AS local_ord(attnum, ord) ON TRUE
          JOIN unnest(c.confkey) WITH ORDINALITY AS ref_ord(attnum, ord) ON ref_ord.ord = local_ord.ord
          JOIN pg_attribute a  ON a.attrelid = c1.oid  AND a.attnum  = local_ord.attnum
          JOIN pg_attribute af ON af.attrelid = cr.oid  AND af.attnum = ref_ord.attnum
          JOIN pg_type      tf ON tf.oid = af.atttypid
          WHERE c.contype = 'f'
            AND n1.nspname = $1
            AND c1.relname = $2
          ORDER BY c.conname, local_ord.ord::int`,
      params: [schema, table],
    },
  );
  if (!res.ok) throw new Error(res.error);
  if (res.result.rows.length === 0) return [];

  type Row = {
    constraintName: string;
    sourceSchema: string;
    sourceTable: string;
    columnName: string;
    refSchema: string;
    refTable: string;
    refColumn: string;
    refUdtName: string;
    constraintColumns: string[];
  };
  const grouped = new Map<string, Row>();
  for (const r of res.result.rows) {
    const constraintName = String(r[0]);
    let row = grouped.get(constraintName);
    if (!row) {
      row = {
        constraintName,
        sourceSchema: String(r[1]),
        sourceTable: String(r[2]),
        columnName: String(r[3]),
        refSchema: String(r[4]),
        refTable: String(r[5]),
        refColumn: String(r[6]),
        refUdtName: String(r[7]),
        constraintColumns: [],
      };
      grouped.set(constraintName, row);
    }
    row.constraintColumns.push(String(r[3]));
  }
  return Array.from(grouped.values()).map((r) => ({
    constraintName: r.constraintName,
    sourceSchema: r.sourceSchema,
    sourceTable: r.sourceTable,
    column: r.columnName,
    referencedSchema: r.refSchema,
    referencedTable: r.refTable,
    referencedColumn: r.refColumn,
    referencedUdtName: r.refUdtName,
    constraintColumns: r.constraintColumns,
  }));
}

export async function getIncomingTableRelations(
  connectionId: string,
  config: PostgresConfig,
  database: string,
  schema: string,
  table: string,
): Promise<ForeignKey[]> {
  const res = await runReadOnlyQuery(
    connectionId,
    { ...config, database },
    {
      sql: `SELECT
            c.conname        AS constraint_name,
            n1.nspname       AS source_schema,
            c1.relname       AS source_table,
            a.attname        AS column_name,
            nr.nspname       AS ref_schema,
            cr.relname       AS ref_table,
            af.attname       AS ref_column,
            tf.typname       AS ref_udt_name,
            local_ord.ord    AS ordinal
          FROM pg_constraint c
          JOIN pg_class     c1  ON c1.oid = c.conrelid
          JOIN pg_namespace n1  ON n1.oid = c1.relnamespace
          JOIN pg_class     cr  ON cr.oid = c.confrelid
          JOIN pg_namespace nr  ON nr.oid = cr.relnamespace
          JOIN unnest(c.conkey)  WITH ORDINALITY AS local_ord(attnum, ord) ON TRUE
          JOIN unnest(c.confkey) WITH ORDINALITY AS ref_ord(attnum, ord) ON ref_ord.ord = local_ord.ord
          JOIN pg_attribute a  ON a.attrelid = c1.oid  AND a.attnum  = local_ord.attnum
          JOIN pg_attribute af ON af.attrelid = cr.oid  AND af.attnum = ref_ord.attnum
          JOIN pg_type      tf ON tf.oid = af.atttypid
          WHERE c.contype = 'f'
            AND nr.nspname = $1
            AND cr.relname = $2
          ORDER BY c.conname, local_ord.ord::int`,
      params: [schema, table],
    },
  );
  if (!res.ok) throw new Error(res.error);
  if (res.result.rows.length === 0) return [];

  type Row = {
    constraintName: string;
    sourceSchema: string;
    sourceTable: string;
    columnName: string;
    refSchema: string;
    refTable: string;
    refColumn: string;
    refUdtName: string;
    constraintColumns: string[];
  };
  const grouped = new Map<string, Row>();
  for (const r of res.result.rows) {
    const constraintName = String(r[0]);
    let row = grouped.get(constraintName);
    if (!row) {
      row = {
        constraintName,
        sourceSchema: String(r[1]),
        sourceTable: String(r[2]),
        columnName: String(r[3]),
        refSchema: String(r[4]),
        refTable: String(r[5]),
        refColumn: String(r[6]),
        refUdtName: String(r[7]),
        constraintColumns: [],
      };
      grouped.set(constraintName, row);
    }
    row.constraintColumns.push(String(r[3]));
  }
  return Array.from(grouped.values()).map((r) => ({
    constraintName: r.constraintName,
    sourceSchema: r.sourceSchema,
    sourceTable: r.sourceTable,
    column: r.columnName,
    referencedSchema: r.refSchema,
    referencedTable: r.refTable,
    referencedColumn: r.refColumn,
    referencedUdtName: r.refUdtName,
    constraintColumns: r.constraintColumns,
  }));
}

export async function lookupRows(
  connectionId: string,
  config: PostgresConfig,
  database: string,
  schema: string,
  table: string,
  columns: string[],
  search?: { column: string; query: string },
  limit?: number,
): Promise<SqlLookupRowsResponse> {
  const maxRows = limit ?? 50;
  const colList = columns.map((c) => ident(c)).join(', ');
  let whereClause = '';
  const params: unknown[] = [];
  if (search && search.query.trim()) {
    params.push(`%${search.query}%`);
    whereClause = ` WHERE ${ident(search.column)}::text ILIKE $1`;
  }
  const sql = `SELECT ${colList} FROM ${ident(schema)}.${ident(table)}${whereClause} LIMIT $${params.length + 1}`;
  params.push(maxRows);
  const res = await runReadOnlyQuery(
    connectionId,
    { ...config, database },
    { sql, params },
  );
  if (!res.ok) throw new Error(res.error);
  return { columns, rows: res.result.rows };
}

function literalize(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number')
    return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === 'object')
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

export async function saveChanges(
  connectionId: string,
  config: PostgresConfig,
  req: SaveChangesRequest,
): Promise<SaveChangesResponse> {
  if (req.updates.length === 0) return { ok: true, updated: 0 };
  const database = req.database;
  const pool = getPool(connectionId, { ...config, database }, database);
  let client: pg.PoolClient | null = null;
  let updated = 0;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const tableIdent = `${ident(req.schema)}.${ident(req.table)}`;

    for (let i = 0; i < req.updates.length; i++) {
      const change = req.updates[i];
      const setEntries = Object.entries(change.changes);
      if (setEntries.length === 0) continue;
      const setSql = setEntries
        .map(([col]) => `${ident(col)} = ${literalize(change.changes[col])}`)
        .join(', ');
      const whereSql = req.primaryKey
        .map((pk) => `${ident(pk)} = ${literalize(change.original[pk])}`)
        .join(' AND ');
      const sql = `UPDATE ${tableIdent} SET ${setSql} WHERE ${whereSql} RETURNING 1`;
      const result = await client.query(sql);
      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return {
          ok: false,
          error: `Row ${i + 1} no longer matches its original values (it may have been changed or deleted by another user).`,
          failedRowIndex: i,
        };
      }
      updated += result.rowCount ?? 0;
    }

    await client.query('COMMIT');
    return { ok: true, updated };
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[postgres] rollback failed:', rollbackErr);
      }
    }
    return { ok: false, error: toErrorMessage(err) };
  } finally {
    if (client) client.release();
  }
}

export async function insertRow(
  connectionId: string,
  config: PostgresConfig,
  req: InsertRowRequest,
): Promise<InsertRowResponse> {
  const database = req.database;
  const pool = getPool(connectionId, { ...config, database }, database);
  const entries = Object.entries(req.values);
  let client: pg.PoolClient | null = null;
  try {
    client = await pool.connect();
    const tableIdent = `${ident(req.schema)}.${ident(req.table)}`;
    const sql =
      entries.length === 0
        ? `INSERT INTO ${tableIdent} DEFAULT VALUES`
        : `INSERT INTO ${tableIdent} (${entries.map(([col]) => ident(col)).join(', ')}) VALUES (${entries.map((_, i) => `$${i + 1}`).join(', ')})`;
    const result = await client.query(
      sql,
      entries.map(([, value]) => value),
    );
    return { ok: true, inserted: result.rowCount ?? 0 };
  } catch (err) {
    if (client && postgresErrorCode(err) === '23505') {
      const constraint = postgresConstraintName(err);
      if (constraint) {
        try {
          const columns = await describeConstraint(
            client,
            req.schema,
            req.table,
            constraint,
          );
          if (columns) {
            return {
              ok: false,
              error: `Duplicate value for unique column${columns.includes(',') ? 's' : ''} ${columns}. Choose a different value or leave it empty if the database should provide one.`,
            };
          }
        } catch {
          // Fall through to the original database error if constraint lookup fails.
        }
      }
    }
    return { ok: false, error: toErrorMessage(err) };
  } finally {
    if (client) client.release();
  }
}

export async function deleteRows(
  connectionId: string,
  config: PostgresConfig,
  req: DeleteRowsRequest,
): Promise<SqlDeleteRowsResponse> {
  if (req.rows.length === 0) return { ok: true, deleted: 0 };
  const database = req.database;
  const pool = getPool(connectionId, { ...config, database }, database);
  let client: pg.PoolClient | null = null;
  let deleted = 0;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const tableIdent = `${ident(req.schema)}.${ident(req.table)}`;

    for (const row of req.rows) {
      const whereSql = req.primaryKey
        .map((pk) => `${ident(pk)} = ${literalize(row[pk])}`)
        .join(' AND ');
      const sql = `DELETE FROM ${tableIdent} WHERE ${whereSql} RETURNING 1`;
      const result = await client.query(sql);
      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return {
          ok: false,
          error:
            'Some rows could not be found (they may have been deleted already).',
        };
      }
      deleted += result.rowCount ?? 0;
    }

    await client.query('COMMIT');
    return { ok: true, deleted };
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[postgres] rollback failed:', rollbackErr);
      }
    }
    return { ok: false, error: toErrorMessage(err) };
  } finally {
    if (client) client.release();
  }
}

export function disconnect(connectionId: string, database?: string): void {
  dropPool(connectionId, database);
}

import fs from 'node:fs/promises';
import { Pool, types } from 'pg';
import type pg from 'pg';
import type {
  ColumnMeta,
  DatabaseInfo,
  DeleteRowsRequest,
  ExportDatabaseRequest,
  ExportDatabaseResponse,
  ForeignKey,
  ImportDatabaseRequest,
  ImportDatabaseResponse,
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
} from '../shared/types/postgres';
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
    if (req.schema) {
      await client.query(`SET search_path TO ${ident(req.schema)}, public`);
    }
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
    if (client) {
      if (req.schema) {
        try {
          await client.query('RESET search_path');
        } catch (resetErr) {
          console.error('[postgres] reset search_path failed:', resetErr);
        }
      }
      client.release();
    }
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
    if (req.schema) {
      await client.query(
        `SET LOCAL search_path TO ${ident(req.schema)}, public`,
      );
    }
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

interface PostgresExportColumn {
  name: string;
  typeSql: string;
  udtName: string;
  nullable: boolean;
  defaultSql: string | null;
  identity: '' | 'a' | 'd';
  generated: '' | 's';
  generatedSql: string | null;
}

interface PostgresExportTable {
  schema: string;
  name: string;
  columns: PostgresExportColumn[];
  rows: Record<string, string | null>[];
}

interface PostgresExportSequence {
  schema: string;
  name: string;
  create: boolean;
  dataType: string;
  startValue: string;
  minValue: string;
  maxValue: string;
  incrementBy: string;
  cycle: boolean;
  cacheSize: string;
  lastValue: string | null;
  isCalled: boolean | null;
}

interface PostgresExportConstraint {
  schema: string;
  table: string;
  name: string;
  type: string;
  definition: string;
}

interface PostgresExportIndex {
  schema: string;
  table: string;
  name: string;
  definition: string;
}

interface PostgresExportEnum {
  schema: string;
  name: string;
  values: string[];
}

interface PostgresExportDomain {
  schema: string;
  name: string;
  baseType: string;
  nullable: boolean;
  defaultSql: string | null;
  checks: string[];
}

interface PostgresExportView {
  schema: string;
  name: string;
  definition: string;
}

interface PostgresExportExtension {
  name: string;
  schema: string;
  version: string;
}

interface PostgresDatabaseExport {
  format: 'db-vwr.postgres.export';
  version: 1;
  exportedAt: string;
  sourceDatabase: string;
  schemas: string[];
  extensions?: PostgresExportExtension[];
  enums: PostgresExportEnum[];
  domains: PostgresExportDomain[];
  sequences: PostgresExportSequence[];
  tables: PostgresExportTable[];
  constraints: PostgresExportConstraint[];
  indexes: PostgresExportIndex[];
  views: PostgresExportView[];
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function quoteLiteralText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function qualifiedIdent(schema: string, name: string): string {
  return `${quoteIdent(schema)}.${quoteIdent(name)}`;
}

function assertPostgresExport(value: unknown): PostgresDatabaseExport {
  if (
    !value ||
    typeof value !== 'object' ||
    (value as { format?: unknown }).format !== 'db-vwr.postgres.export' ||
    (value as { version?: unknown }).version !== 1
  ) {
    throw new Error('File is not a db-vwr PostgreSQL export JSON');
  }
  return value as PostgresDatabaseExport;
}

async function queryRows<T extends object>(
  client: pg.PoolClient,
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await client.query(sql, params ?? []);
  return result.rows as T[];
}

function createDirectPool(config: PostgresConfig, database: string): pg.Pool {
  return new Pool({
    host: config.host,
    port: config.port,
    database,
    user: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 0,
  });
}

async function exportSequences(
  client: pg.PoolClient,
): Promise<PostgresExportSequence[]> {
  const sequences = await queryRows<{
    schema: string;
    name: string;
    data_type: string;
    start_value: string;
    min_value: string;
    max_value: string;
    increment_by: string;
    cycle: boolean;
    cache_size: string;
    is_identity_owned: boolean;
  }>(
    client,
    `SELECT n.nspname AS schema,
            c.relname AS name,
            format_type(s.seqtypid, NULL) AS data_type,
            s.seqstart::text AS start_value,
            s.seqmin::text AS min_value,
            s.seqmax::text AS max_value,
            s.seqincrement::text AS increment_by,
            s.seqcycle AS cycle,
            s.seqcache::text AS cache_size,
            EXISTS (
              SELECT 1
                FROM pg_depend d
               WHERE d.objid = c.oid
                 AND d.deptype = 'i'
            ) AS is_identity_owned
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_sequence s ON s.seqrelid = c.oid
      WHERE c.relkind = 'S'
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_toast%'
      ORDER BY n.nspname, c.relname`,
  );

  const out: PostgresExportSequence[] = [];
  for (const seq of sequences) {
    const state = await queryRows<{
      last_value: string;
      is_called: boolean;
    }>(
      client,
      `SELECT last_value::text, is_called FROM ${qualifiedIdent(seq.schema, seq.name)}`,
    );
    out.push({
      schema: seq.schema,
      name: seq.name,
      create: !seq.is_identity_owned,
      dataType: seq.data_type,
      startValue: seq.start_value,
      minValue: seq.min_value,
      maxValue: seq.max_value,
      incrementBy: seq.increment_by,
      cycle: seq.cycle,
      cacheSize: seq.cache_size,
      lastValue: state[0]?.last_value ?? null,
      isCalled: state[0]?.is_called ?? null,
    });
  }
  return out;
}

async function exportTableRows(
  client: pg.PoolClient,
  schema: string,
  table: string,
  columns: PostgresExportColumn[],
): Promise<Record<string, string | null>[]> {
  if (columns.length === 0) return [];
  const pairs: string[] = [];
  for (const col of columns) {
    if (col.generated) continue;
    const colIdent = quoteIdent(col.name);
    const valueSql =
      col.udtName === 'bytea'
        ? `CASE WHEN ${colIdent} IS NULL THEN NULL ELSE encode(${colIdent}, 'base64') END`
        : `CASE WHEN ${colIdent} IS NULL THEN NULL ELSE ${colIdent}::text END`;
    pairs.push(`${quoteLiteralText(col.name)}, ${valueSql}`);
  }
  if (pairs.length === 0) return [];
  const rows = await queryRows<{ row_data: string }>(
    client,
    `SELECT jsonb_build_object(${pairs.join(', ')})::text AS row_data FROM ${qualifiedIdent(schema, table)}`,
  );
  return rows.map(
    (row) => JSON.parse(row.row_data) as Record<string, string | null>,
  );
}

export async function exportDatabase(
  connectionId: string,
  config: PostgresConfig,
  req: ExportDatabaseRequest,
): Promise<ExportDatabaseResponse> {
  const pool = createDirectPool(config, req.database);
  let client: pg.PoolClient | null = null;
  try {
    client = await pool.connect();
    const schemas = (
      await queryRows<{ name: string }>(
        client,
        `SELECT nspname AS name
           FROM pg_namespace
          WHERE nspname NOT IN ('pg_catalog', 'information_schema')
            AND nspname NOT LIKE 'pg_toast%'
          ORDER BY nspname`,
      )
    ).map((row) => row.name);

    const extensions = await queryRows<PostgresExportExtension>(
      client,
      `SELECT e.extname AS name,
              n.nspname AS schema,
              e.extversion AS version
         FROM pg_extension e
         JOIN pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname <> 'plpgsql'
        ORDER BY e.extname`,
    );

    const enums = await queryRows<PostgresExportEnum>(
      client,
      `SELECT n.nspname AS schema, t.typname AS name,
              array_agg(e.enumlabel ORDER BY e.enumsortorder)::text[] AS values
         FROM pg_type t
         JOIN pg_namespace n ON n.oid = t.typnamespace
         JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typtype = 'e'
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        GROUP BY n.nspname, t.typname
        ORDER BY n.nspname, t.typname`,
    );

    const domains = await queryRows<PostgresExportDomain>(
      client,
      `SELECT n.nspname AS schema,
              t.typname AS name,
              format_type(t.typbasetype, t.typtypmod) AS "baseType",
              NOT t.typnotnull AS nullable,
              t.typdefault AS "defaultSql",
              COALESCE(array_agg(pg_get_constraintdef(c.oid, true) ORDER BY c.conname) FILTER (WHERE c.oid IS NOT NULL), ARRAY[]::text[]) AS checks
         FROM pg_type t
         JOIN pg_namespace n ON n.oid = t.typnamespace
         LEFT JOIN pg_constraint c ON c.contypid = t.oid
        WHERE t.typtype = 'd'
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        GROUP BY n.nspname, t.typname, t.typbasetype, t.typtypmod, t.typnotnull, t.typdefault
        ORDER BY n.nspname, t.typname`,
    );

    const tableRefs = await queryRows<{
      oid: number;
      schema: string;
      name: string;
    }>(
      client,
      `SELECT c.oid::int AS oid, n.nspname AS schema, c.relname AS name
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'p')
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND n.nspname NOT LIKE 'pg_toast%'
        ORDER BY n.nspname, c.relname`,
    );

    const tables: PostgresExportTable[] = [];
    let rowCount = 0;
    for (const tableRef of tableRefs) {
      const columns = await queryRows<PostgresExportColumn>(
        client,
        `SELECT a.attname AS name,
                format_type(a.atttypid, a.atttypmod) AS "typeSql",
                t.typname AS "udtName",
                NOT a.attnotnull AS nullable,
                pg_get_expr(d.adbin, d.adrelid) AS "defaultSql",
                a.attidentity AS identity,
                a.attgenerated AS generated,
                CASE WHEN a.attgenerated <> '' THEN pg_get_expr(d.adbin, d.adrelid) ELSE NULL END AS "generatedSql"
           FROM pg_attribute a
           JOIN pg_type t ON t.oid = a.atttypid
           LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
          WHERE a.attrelid = $1
            AND a.attnum > 0
            AND NOT a.attisdropped
          ORDER BY a.attnum`,
        [tableRef.oid],
      );
      const rows = await exportTableRows(
        client,
        tableRef.schema,
        tableRef.name,
        columns,
      );
      rowCount += rows.length;
      tables.push({
        schema: tableRef.schema,
        name: tableRef.name,
        columns,
        rows,
      });
    }

    const constraints = await queryRows<PostgresExportConstraint>(
      client,
      `SELECT n.nspname AS schema,
              cls.relname AS table,
              con.conname AS name,
              con.contype AS type,
              pg_get_constraintdef(con.oid, true) AS definition
         FROM pg_constraint con
         JOIN pg_class cls ON cls.oid = con.conrelid
         JOIN pg_namespace n ON n.oid = cls.relnamespace
        WHERE con.conrelid <> 0
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY n.nspname, cls.relname,
                 CASE con.contype WHEN 'c' THEN 1 WHEN 'p' THEN 2 WHEN 'u' THEN 3 WHEN 'x' THEN 4 WHEN 'f' THEN 5 ELSE 6 END,
                 con.conname`,
    );

    const indexes = await queryRows<PostgresExportIndex>(
      client,
      `SELECT schemaname AS schema,
              tablename AS table,
              indexname AS name,
              indexdef AS definition
         FROM pg_indexes i
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
          AND NOT EXISTS (
            SELECT 1
              FROM pg_constraint c
             WHERE c.conname = i.indexname
               AND c.connamespace = to_regnamespace(i.schemaname)
          )
        ORDER BY schemaname, tablename, indexname`,
    );

    const views = await queryRows<PostgresExportView>(
      client,
      `SELECT n.nspname AS schema,
              c.relname AS name,
              pg_get_viewdef(c.oid, true) AS definition
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'v'
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY n.nspname, c.relname`,
    );

    const exportJson: PostgresDatabaseExport = {
      format: 'db-vwr.postgres.export',
      version: 1,
      exportedAt: new Date().toISOString(),
      sourceDatabase: req.database,
      schemas,
      extensions,
      enums,
      domains,
      sequences: await exportSequences(client),
      tables,
      constraints,
      indexes,
      views,
    };

    await fs.writeFile(
      req.filePath,
      JSON.stringify(exportJson, null, 2),
      'utf8',
    );
    return {
      ok: true,
      filePath: req.filePath,
      tables: tables.length,
      rows: rowCount,
    };
  } finally {
    if (client) client.release();
    await pool.end();
    dropPool(connectionId, req.database);
  }
}

async function recreateDatabase(
  connectionId: string,
  config: PostgresConfig,
  database: string,
): Promise<void> {
  dropPool(connectionId, database);
  const maintenanceDatabase =
    database === 'postgres' ? 'template1' : 'postgres';
  const pool = createDirectPool(config, maintenanceDatabase);
  let client: pg.PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()`,
      [database],
    );
    await client.query(`DROP DATABASE IF EXISTS ${quoteIdent(database)}`);
    await client.query(`CREATE DATABASE ${quoteIdent(database)}`);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

function columnDefinition(column: PostgresExportColumn): string {
  let sql = `${quoteIdent(column.name)} ${column.typeSql}`;
  if (column.generated && column.generatedSql) {
    sql += ` GENERATED ALWAYS AS (${column.generatedSql}) STORED`;
  } else if (column.identity) {
    sql += ` GENERATED ${column.identity === 'a' ? 'ALWAYS' : 'BY DEFAULT'} AS IDENTITY`;
  } else if (column.defaultSql) {
    sql += ` DEFAULT ${column.defaultSql}`;
  }
  if (!column.nullable) sql += ' NOT NULL';
  return sql;
}

function inferExtensionCandidates(
  parsed: PostgresDatabaseExport,
): Array<{ name: string; schema?: string; required: boolean }> {
  const candidates = new Map<
    string,
    { name: string; schema?: string; required: boolean }
  >();
  for (const extension of parsed.extensions ?? []) {
    candidates.set(extension.name, {
      name: extension.name,
      schema: extension.schema,
      required: true,
    });
  }

  const sqlFragments: string[] = [];
  for (const domain of parsed.domains) {
    if (domain.defaultSql) sqlFragments.push(domain.defaultSql);
    sqlFragments.push(...domain.checks);
  }
  for (const table of parsed.tables) {
    for (const column of table.columns) {
      if (column.defaultSql) sqlFragments.push(column.defaultSql);
      if (column.generatedSql) sqlFragments.push(column.generatedSql);
    }
  }
  const sql = sqlFragments.join('\n').toLowerCase();

  if (/\buuid_generate_v[145]\s*\(/.test(sql)) {
    candidates.set('uuid-ossp', { name: 'uuid-ossp', required: false });
  }
  if (/\bgen_random_uuid\s*\(/.test(sql)) {
    candidates.set('pgcrypto', { name: 'pgcrypto', required: false });
  }
  if (/\buuid_generate_v7\s*\(/.test(sql)) {
    candidates.set('pg_uuidv7', { name: 'pg_uuidv7', required: false });
  }
  if (/\buuidv7\s*\(/.test(sql)) {
    candidates.set('uuidv7', { name: 'uuidv7', required: false });
  }

  return Array.from(candidates.values());
}

async function createExtension(
  client: pg.PoolClient,
  extension: { name: string; schema?: string; required: boolean },
): Promise<void> {
  const schemaSql = extension.schema
    ? ` WITH SCHEMA ${quoteIdent(extension.schema)}`
    : '';
  try {
    await client.query(
      `CREATE EXTENSION IF NOT EXISTS ${quoteIdent(extension.name)}${schemaSql}`,
    );
  } catch (err) {
    if (extension.required) throw err;
    console.warn(
      `[postgres] inferred extension ${extension.name} could not be created:`,
      err,
    );
  }
}

async function importRows(
  client: pg.PoolClient,
  table: PostgresExportTable,
): Promise<number> {
  const insertColumns = table.columns.filter((column) => !column.generated);
  if (table.rows.length === 0) return 0;
  if (insertColumns.length === 0) return 0;

  const colSql = insertColumns
    .map((column) => quoteIdent(column.name))
    .join(', ');
  const casts = insertColumns.map((column, index) => {
    const param = `$${index + 1}`;
    return column.udtName === 'bytea'
      ? `decode(${param}, 'base64')`
      : `${param}::${column.typeSql}`;
  });
  const overriding = insertColumns.some((column) => column.identity)
    ? ' OVERRIDING SYSTEM VALUE'
    : '';
  const sql = `INSERT INTO ${qualifiedIdent(table.schema, table.name)} (${colSql})${overriding} VALUES (${casts.join(', ')})`;
  for (const row of table.rows) {
    await client.query(
      sql,
      insertColumns.map((column) => row[column.name] ?? null),
    );
  }
  return table.rows.length;
}

export async function importDatabase(
  connectionId: string,
  config: PostgresConfig,
  req: ImportDatabaseRequest,
): Promise<ImportDatabaseResponse> {
  const parsed = assertPostgresExport(
    JSON.parse(await fs.readFile(req.filePath, 'utf8')),
  );
  await recreateDatabase(connectionId, config, req.database);

  const pool = createDirectPool(config, req.database);
  let client: pg.PoolClient | null = null;
  let rows = 0;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    for (const schema of parsed.schemas) {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)}`);
    }
    for (const extension of inferExtensionCandidates(parsed)) {
      await createExtension(client, extension);
    }
    for (const item of parsed.enums) {
      await client.query(
        `CREATE TYPE ${qualifiedIdent(item.schema, item.name)} AS ENUM (${item.values.map(quoteLiteralText).join(', ')})`,
      );
    }
    for (const domain of parsed.domains) {
      let sql = `CREATE DOMAIN ${qualifiedIdent(domain.schema, domain.name)} AS ${domain.baseType}`;
      if (domain.defaultSql) sql += ` DEFAULT ${domain.defaultSql}`;
      if (!domain.nullable) sql += ' NOT NULL';
      for (const check of domain.checks) sql += ` ${check}`;
      await client.query(sql);
    }
    for (const sequence of parsed.sequences) {
      if (sequence.create === false) continue;
      await client.query(
        `CREATE SEQUENCE ${qualifiedIdent(sequence.schema, sequence.name)} AS ${sequence.dataType} INCREMENT BY ${sequence.incrementBy} MINVALUE ${sequence.minValue} MAXVALUE ${sequence.maxValue} START WITH ${sequence.startValue} CACHE ${sequence.cacheSize}${sequence.cycle ? ' CYCLE' : ''}`,
      );
    }
    for (const table of parsed.tables) {
      await client.query(
        `CREATE TABLE ${qualifiedIdent(table.schema, table.name)} (${table.columns.map(columnDefinition).join(', ')})`,
      );
    }
    for (const table of parsed.tables) {
      rows += await importRows(client, table);
    }
    const orderedConstraints = [
      ...parsed.constraints.filter((constraint) => constraint.type !== 'f'),
      ...parsed.constraints.filter((constraint) => constraint.type === 'f'),
    ];
    for (const constraint of orderedConstraints) {
      await client.query(
        `ALTER TABLE ${qualifiedIdent(constraint.schema, constraint.table)} ADD CONSTRAINT ${quoteIdent(constraint.name)} ${constraint.definition}`,
      );
    }
    for (const index of parsed.indexes) {
      await client.query(index.definition);
    }
    for (const sequence of parsed.sequences) {
      if (sequence.lastValue === null || sequence.isCalled === null) continue;
      await client.query('SELECT setval($1::regclass, $2::bigint, $3)', [
        qualifiedIdent(sequence.schema, sequence.name),
        sequence.lastValue,
        sequence.isCalled,
      ]);
    }
    for (const view of parsed.views) {
      await client.query(
        `CREATE VIEW ${qualifiedIdent(view.schema, view.name)} AS ${view.definition}`,
      );
    }

    await client.query('COMMIT');
    dropPool(connectionId, req.database);
    return {
      ok: true,
      database: req.database,
      tables: parsed.tables.length,
      rows,
    };
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[postgres] rollback failed:', rollbackErr);
      }
    }
    throw err;
  } finally {
    if (client) client.release();
    await pool.end();
  }
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
      const params: unknown[] = [];
      const setSql = setEntries
        .map(([col, value]) => {
          params.push(value);
          return `${ident(col)} = $${params.length}`;
        })
        .join(', ');
      const whereSql = req.primaryKey
        .map((pk) => {
          params.push(change.original[pk]);
          return `${ident(pk)} = $${params.length}`;
        })
        .join(' AND ');
      const sql = `UPDATE ${tableIdent} SET ${setSql} WHERE ${whereSql} RETURNING 1`;
      const result = await client.query(sql, params);
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
      const params: unknown[] = [];
      const whereSql = req.primaryKey
        .map((pk) => {
          params.push(row[pk]);
          return `${ident(pk)} = $${params.length}`;
        })
        .join(' AND ');
      const sql = `DELETE FROM ${tableIdent} WHERE ${whereSql} RETURNING 1`;
      const result = await client.query(sql, params);
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

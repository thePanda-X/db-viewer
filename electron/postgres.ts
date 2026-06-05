import { Pool, types } from 'pg'
import type pg from 'pg'
import type {
  ColumnMeta,
  DatabaseInfo,
  PostgresConfig,
  QueryRequest,
  QueryResponse,
  QueryResult,
  SaveChangesRequest,
  SaveChangesResponse,
  TableInfo,
  TableMeta,
} from '../src/types/postgres'

const DEFAULT_STATEMENT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_ROWS = 10_000

types.setTypeParser(20, (val) => (val == null ? val : Number(val)))
types.setTypeParser(21, (val) => (val == null ? val : Number(val)))
types.setTypeParser(1700, (val) => (val == null ? val : Number(val)))
types.setTypeParser(114, (val) => (val == null ? val : val))
types.setTypeParser(3802, (val) => (val == null ? val : val))
types.setTypeParser(2950, (val) => (val == null ? val : val))

const pools = new Map<string, pg.Pool>()

function buildPoolKey(connectionId: string, database: string): string {
  return `${connectionId}::${database}`
}

function createPool(connectionId: string, config: PostgresConfig, database: string): pg.Pool {
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
  })
  pool.on('error', (err) => {
    console.error(`[postgres] idle pool error for ${connectionId}@${database}:`, err)
  })
  return pool
}

function getPool(connectionId: string, config: PostgresConfig, database: string): pg.Pool {
  const key = buildPoolKey(connectionId, database)
  const existing = pools.get(key)
  if (existing) return existing
  const pool = createPool(connectionId, config, database)
  pools.set(key, pool)
  return pool
}

function dropPool(connectionId: string, database?: string): void {
  if (database) {
    const key = buildPoolKey(connectionId, database)
    const pool = pools.get(key)
    if (pool) {
      void pool.end().catch((err) => {
        console.error(`[postgres] error ending pool ${key}:`, err)
      })
      pools.delete(key)
    }
    return
  }
  for (const [key, pool] of pools.entries()) {
    if (!key.startsWith(`${connectionId}::`)) continue
    void pool.end().catch((err) => {
      console.error(`[postgres] error ending pool ${key}:`, err)
    })
    pools.delete(key)
  }
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return 'Unknown error'
  }
}

function rowsToColumns(rows: Record<string, unknown>[]): {
  columns: string[]
  rows: unknown[][]
} {
  if (rows.length === 0) {
    return { columns: [], rows: [] }
  }
  const first = rows[0]
  const columns = Object.keys(first)
  const projected = rows.map((r) => columns.map((c) => r[c]))
  return { columns, rows: projected }
}

export async function runQuery(
  connectionId: string,
  config: PostgresConfig,
  req: QueryRequest,
): Promise<QueryResponse> {
  const maxRows = req.maxRows ?? DEFAULT_MAX_ROWS
  const database = config.database
  const pool = getPool(connectionId, config, database)
  const started = Date.now()
  let client: pg.PoolClient | null = null
  try {
    client = await pool.connect()
    let result: pg.QueryResult
    if (req.sql.trim().toUpperCase().startsWith('SELECT') || req.sql.trim().toUpperCase().startsWith('WITH')) {
      const wrapped = `SELECT * FROM (${req.sql}) AS _dbvwr_query LIMIT $${(req.params?.length ?? 0) + 1}`
      const params = [...(req.params ?? []), maxRows + 1]
      result = await client.query(wrapped, params)
    } else {
      result = await client.query(req.sql, req.params ?? [])
    }
    const allRows = result.rows as Record<string, unknown>[]
    const truncated = allRows.length > maxRows
    const limited = truncated ? allRows.slice(0, maxRows) : allRows
    const { columns, rows } = rowsToColumns(limited)
    const queryResult: QueryResult = {
      columns,
      rows,
      rowCount: allRows.length,
      affectedRows: result.rowCount ?? null,
      durationMs: Date.now() - started,
      truncated,
    }
    return { ok: true, result: queryResult }
  } catch (err) {
    return { ok: false, error: toErrorMessage(err) }
  } finally {
    if (client) client.release()
  }
}

export async function runReadOnlyQuery(
  connectionId: string,
  config: PostgresConfig,
  req: QueryRequest,
): Promise<QueryResponse> {
  const maxRows = req.maxRows ?? DEFAULT_MAX_ROWS
  const database = config.database
  const pool = getPool(connectionId, config, database)
  const started = Date.now()
  let client: pg.PoolClient | null = null
  try {
    client = await pool.connect()
    await client.query('BEGIN')
    await client.query('SET TRANSACTION READ ONLY')
    let result: pg.QueryResult
    if (req.sql.trim().toUpperCase().startsWith('SELECT') || req.sql.trim().toUpperCase().startsWith('WITH')) {
      const wrapped = `SELECT * FROM (${req.sql}) AS _dbvwr_query LIMIT $${(req.params?.length ?? 0) + 1}`
      const params = [...(req.params ?? []), maxRows + 1]
      result = await client.query(wrapped, params)
    } else {
      result = await client.query(req.sql, req.params ?? [])
    }
    const allRows = result.rows as Record<string, unknown>[]
    const truncated = allRows.length > maxRows
    const limited = truncated ? allRows.slice(0, maxRows) : allRows
    const { columns, rows } = rowsToColumns(limited)
    await client.query('COMMIT')
    const queryResult: QueryResult = {
      columns,
      rows,
      rowCount: allRows.length,
      affectedRows: result.rowCount ?? null,
      durationMs: Date.now() - started,
      truncated,
    }
    return { ok: true, result: queryResult }
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK')
      } catch (rollbackErr) {
        console.error('[postgres] rollback failed:', rollbackErr)
      }
    }
    return { ok: false, error: toErrorMessage(err) }
  } finally {
    if (client) client.release()
  }
}

export async function listDatabases(
  connectionId: string,
  config: PostgresConfig,
): Promise<DatabaseInfo[]> {
  const res = await runReadOnlyQuery(connectionId, config, {
    sql: 'SELECT datname AS name FROM pg_database WHERE datistemplate = false ORDER BY datname',
  })
  if (!res.ok) throw new Error(res.error)
  const current = config.database
  return res.result.rows.map((row) => ({
    name: String(row[0]),
    current: String(row[0]) === current,
  }))
}

export async function listTables(
  connectionId: string,
  config: PostgresConfig,
  database: string,
): Promise<TableInfo[]> {
  const res = await runReadOnlyQuery(connectionId, { ...config, database }, {
    sql: `SELECT table_schema, table_name, table_type
          FROM information_schema.tables
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          ORDER BY table_schema, table_name`,
  })
  if (!res.ok) throw new Error(res.error)
  return res.result.rows.map((row) => {
    const type = String(row[2]).toLowerCase()
    return {
      schema: String(row[0]),
      name: String(row[1]),
      type: type === 'view' ? 'view' : 'table',
    }
  })
}

export async function getTableMeta(
  connectionId: string,
  config: PostgresConfig,
  database: string,
  schema: string,
  table: string,
): Promise<TableMeta> {
  const qualified = `${ident(schema)}.${ident(table)}`
  const res = await runReadOnlyQuery(connectionId, { ...config, database }, {
    sql: `SELECT column_name, data_type, udt_name, is_nullable, is_generated
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position`,
    params: [schema, table],
  })
  if (!res.ok) throw new Error(res.error)
  if (res.result.rows.length === 0) {
    throw new Error(`Table ${qualified} not found in ${database}`)
  }

  const pkRes = await runReadOnlyQuery(connectionId, { ...config, database }, {
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
  })
  if (!pkRes.ok) throw new Error(pkRes.error)
  const primaryKey = pkRes.result.rows.map((r) => String(r[0]))

  const columns: ColumnMeta[] = res.result.rows.map((row) => ({
    name: String(row[0]),
    dataType: String(row[1]),
    udtName: String(row[2]),
    isNullable: String(row[3]).toUpperCase() === 'YES',
    isGenerated: String(row[4]) === 'ALWAYS' || String(row[4]) === 'YES',
    isPrimaryKey: primaryKey.includes(String(row[0])),
  }))

  return { columns, primaryKey: primaryKey.length > 0 ? primaryKey : null }
}

function ident(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`)
  }
  return `"${name}"`
}

function literalize(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (value instanceof Date) return `'${value.toISOString()}'`
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
  return `'${String(value).replace(/'/g, "''")}'`
}

export async function saveChanges(
  connectionId: string,
  config: PostgresConfig,
  req: SaveChangesRequest,
): Promise<SaveChangesResponse> {
  if (req.updates.length === 0) return { ok: true, updated: 0 }
  const database = req.database
  const pool = getPool(connectionId, { ...config, database }, database)
  let client: pg.PoolClient | null = null
  let updated = 0
  try {
    client = await pool.connect()
    await client.query('BEGIN')
    const tableIdent = `${ident(req.schema)}.${ident(req.table)}`

    for (let i = 0; i < req.updates.length; i++) {
      const change = req.updates[i]
      const setEntries = Object.entries(change.changes)
      if (setEntries.length === 0) continue
      const setSql = setEntries
        .map(([col]) => `${ident(col)} = ${literalize(change.changes[col])}`)
        .join(', ')
      const whereSql = req.primaryKey
        .map((pk) => `${ident(pk)} = ${literalize(change.original[pk])}`)
        .join(' AND ')
      const sql = `UPDATE ${tableIdent} SET ${setSql} WHERE ${whereSql} RETURNING 1`
      const result = await client.query(sql)
      if (result.rowCount === 0) {
        await client.query('ROLLBACK')
        return {
          ok: false,
          error: `Row ${i + 1} no longer matches its original values (it may have been changed or deleted by another user).`,
          failedRowIndex: i,
        }
      }
      updated += result.rowCount ?? 0
    }

    await client.query('COMMIT')
    return { ok: true, updated }
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK')
      } catch (rollbackErr) {
        console.error('[postgres] rollback failed:', rollbackErr)
      }
    }
    return { ok: false, error: toErrorMessage(err) }
  } finally {
    if (client) client.release()
  }
}

export function disconnect(connectionId: string, database?: string): void {
  dropPool(connectionId, database)
}

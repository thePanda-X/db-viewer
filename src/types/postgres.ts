export interface PostgresConfig {
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl: boolean
}

export interface QueryRequest {
  sql: string
  params?: unknown[]
  maxRows?: number
}

export interface QueryResult {
  columns: string[]
  rows: unknown[][]
  rowCount: number
  affectedRows: number | null
  durationMs: number
  truncated: boolean
}

export type QueryResponse = { ok: true; result: QueryResult } | { ok: false; error: string }

export interface DatabaseInfo {
  name: string
  current: boolean
}

export interface TableInfo {
  schema: string
  name: string
  type: 'table' | 'view'
}

export interface ColumnMeta {
  name: string
  dataType: string
  udtName: string
  isNullable: boolean
  isGenerated: boolean
  isPrimaryKey: boolean
  /**
   * Allowed values when the column is a native PostgreSQL `CREATE TYPE … AS
   * ENUM` (or a domain over one). Ordered as the database declares them.
   * Undefined for non-enum columns.
   */
  enumValues?: string[]
}

export interface TableMeta {
  columns: ColumnMeta[]
  primaryKey: string[] | null
}

export interface ForeignKey {
  /** Name of the constraint in the database (used to group composite FKs) */
  constraintName: string
  /** Referencing column on the local table */
  column: string
  /** Referenced schema, table, and column on the other side */
  referencedSchema: string
  referencedTable: string
  referencedColumn: string
  /**
   * Postgres UDT name of the referenced column (e.g. `int4`, `uuid`, `timestamp`).
   * Used to pre-validate navigation values before opening a new tab.
   */
  referencedUdtName: string
  /**
   * All columns that share this constraint, in ordinal order. A length of 1
   * means the FK is a single-column reference; longer means composite. We only
   * enable navigation for single-column FKs.
   */
  constraintColumns: string[]
}

export interface SaveChange {
  original: Record<string, unknown>
  changes: Record<string, unknown>
}

export interface SaveChangesRequest {
  database: string
  schema: string
  table: string
  primaryKey: string[]
  updates: SaveChange[]
}

export type SaveChangesResponse =
  | { ok: true; updated: number }
  | { ok: false; error: string; failedRowIndex?: number }

export type EditableColumnKind = 'text' | 'number' | 'boolean' | 'datetime' | 'json' | 'readonly'

export function editableKindFor(udtName: string): EditableColumnKind {
  switch (udtName) {
    case 'bool':
      return 'boolean'
    case 'int2':
    case 'int4':
    case 'int8':
    case 'float4':
    case 'float8':
    case 'numeric':
      return 'number'
    case 'date':
    case 'time':
    case 'timetz':
    case 'timestamp':
    case 'timestamptz':
      return 'datetime'
    case 'json':
    case 'jsonb':
      return 'json'
    default:
      return 'text'
  }
}

/**
 * Best-effort pre-check for a value we're about to use in a parameterized
 * WHERE clause against a foreign-key target. Returns `null` if the value is
 * likely safe to send to Postgres, or a human-readable reason if it almost
 * certainly won't type-check (e.g. a UUID-shaped string for a `timestamp`).
 */
export function validateForeignKeyValue(
  referencedUdtName: string,
  value: unknown,
): string | null {
  if (value === null || value === undefined) return null
  const kind = editableKindFor(referencedUdtName)
  switch (kind) {
    case 'datetime':
      if (typeof value === 'string') {
        if (Number.isNaN(new Date(value).getTime())) {
          return `value is not a valid date for the target column of type ${referencedUdtName}`
        }
        return null
      }
      return `value is not a string, but the target column expects a date (${referencedUdtName})`
    case 'json':
      if (value !== null && typeof value === 'object') return null
      if (typeof value === 'string') {
        try {
          JSON.parse(value)
          return null
        } catch {
          return `value is not valid JSON for the target column of type ${referencedUdtName}`
        }
      }
      return `value is not a JSON value, but the target column expects ${referencedUdtName}`
    case 'boolean':
      if (typeof value === 'boolean') return null
      if (typeof value === 'number' && (value === 0 || value === 1)) return null
      if (typeof value === 'string' && /^(true|false|t|f|yes|no)$/i.test(value.trim())) return null
      return `value is not a valid boolean for the target column of type ${referencedUdtName}`
    case 'number':
      if (typeof value === 'number') return Number.isFinite(value) ? null : 'value is not a finite number'
      if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return null
      return `value is not a valid number for the target column of type ${referencedUdtName}`
    default:
      // 'text' / 'readonly' / unknown — let Postgres handle the cast.
      return null
  }
}

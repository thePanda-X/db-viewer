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

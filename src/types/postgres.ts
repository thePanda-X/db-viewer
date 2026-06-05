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
}

export interface TableMeta {
  columns: ColumnMeta[]
  primaryKey: string[] | null
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

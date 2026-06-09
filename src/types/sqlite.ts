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

export interface TableInfo {
  name: string
  type: 'table' | 'view'
}

export interface ColumnMeta {
  name: string
  dataType: string
  isNullable: boolean
  isPrimaryKey: boolean
  defaultValue: unknown
}

export interface TableMeta {
  columns: ColumnMeta[]
  primaryKey: string[] | null
}

export interface ForeignKey {
  column: string
  referencedTable: string
  referencedColumn: string
}

export interface SaveChange {
  original: Record<string, unknown>
  changes: Record<string, unknown>
}

export interface SaveChangesRequest {
  table: string
  primaryKey: string[]
  updates: SaveChange[]
}

export type SaveChangesResponse =
  | { ok: true; updated: number }
  | { ok: false; error: string; failedRowIndex?: number }

export type EditableColumnKind = 'text' | 'number' | 'boolean' | 'datetime' | 'json' | 'readonly'

export function editableKindFor(dataType: string): EditableColumnKind {
  const dt = dataType.toUpperCase()
  if (dt.includes('INT') || dt.includes('DOUBLE') || dt.includes('FLOAT') || dt.includes('REAL') || dt.includes('NUMERIC')) {
    return 'number'
  }
  if (dt.includes('BOOL')) {
    return 'boolean'
  }
  if (dt.includes('DATE') || dt.includes('TIME')) {
    return 'datetime'
  }
  if (dt.includes('JSON')) {
    return 'json'
  }
  return 'text'
}

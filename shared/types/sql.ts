export interface SqlQueryRequest {
  sql: string
  params?: unknown[]
  maxRows?: number
}

export interface SqlQueryResult {
  columns: string[]
  rows: unknown[][]
  rowCount: number
  affectedRows: number | null
  durationMs: number
  truncated: boolean
}

export type SqlQueryResponse = { ok: true; result: SqlQueryResult } | { ok: false; error: string }

export interface SqlSaveChange {
  original: Record<string, unknown>
  changes: Record<string, unknown>
}

export type SqlSaveChangesResponse =
  | { ok: true; updated: number }
  | { ok: false; error: string; failedRowIndex?: number }

export interface SqlColumnMetaBase {
  name: string
  dataType: string
  isNullable: boolean
  isPrimaryKey: boolean
}

export interface SqlTableMeta<TColumn extends SqlColumnMetaBase = SqlColumnMetaBase> {
  columns: TColumn[]
  primaryKey: string[] | null
}

export type SqlTableKind = 'table' | 'view'
export type EditableColumnKind = 'text' | 'number' | 'boolean' | 'datetime' | 'json' | 'readonly'

export interface SqlDeleteRowsRequest {
  primaryKey: string[]
  rows: Record<string, unknown>[]
}

export type SqlDeleteRowsResponse =
  | { ok: true; deleted: number }
  | { ok: false; error: string }

export interface SqlInsertRowRequest {
  values: Record<string, unknown>
}

export type SqlInsertRowResponse =
  | { ok: true; inserted: number }
  | { ok: false; error: string }

export interface SqlLookupRowsRequest {
  schema?: string
  table: string
  columns: string[]
  search?: { column: string; query: string }
  limit?: number
}

export interface SqlLookupRowsResponse {
  columns: string[]
  rows: unknown[][]
}

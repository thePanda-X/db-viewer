import type {
  EditableColumnKind as SharedEditableColumnKind,
  SqlInsertRowResponse,
  SqlQueryRequest,
  SqlQueryResponse,
  SqlSaveChange,
  SqlSaveChangesResponse,
  SqlTableMeta,
} from '../../shared/types/sql'

export type QueryRequest = SqlQueryRequest
export type QueryResult = Extract<SqlQueryResponse, { ok: true }>['result']
export type QueryResponse = SqlQueryResponse

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

export type TableMeta = SqlTableMeta<ColumnMeta>

export interface ForeignKey {
  column: string
  referencedTable: string
  referencedColumn: string
}

export interface DeleteRowsRequest {
  table: string
  primaryKey: string[]
  rows: Record<string, unknown>[]
}

export type DeleteRowsResponse = import('../../shared/types/sql').SqlDeleteRowsResponse

export interface InsertRowRequest {
  table: string
  values: Record<string, unknown>
}

export type InsertRowResponse = SqlInsertRowResponse

export type SaveChange = SqlSaveChange

export interface SaveChangesRequest {
  table: string
  primaryKey: string[]
  updates: SaveChange[]
}

export type SaveChangesResponse = SqlSaveChangesResponse

export type EditableColumnKind = SharedEditableColumnKind

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

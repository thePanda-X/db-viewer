import type {
  EditableColumnKind as SharedEditableColumnKind,
  SqlDeleteRowsResponse,
  SqlInsertRowResponse,
  SqlQueryRequest,
  SqlQueryResponse,
  SqlSaveChange,
  SqlSaveChangesResponse,
  SqlTableMeta,
} from './sql';

export type QueryRequest = SqlQueryRequest;
export type QueryResult = Extract<SqlQueryResponse, { ok: true }>['result'];
export type QueryResponse = SqlQueryResponse;

export interface TableInfo {
  name: string;
  type: 'table' | 'view';
}

export interface ColumnMeta {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  defaultValue: unknown;
}

export type TableMeta = SqlTableMeta<ColumnMeta>;

export interface ForeignKey {
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface DeleteRowsRequest {
  table: string;
  primaryKey: string[];
  rows: Record<string, unknown>[];
}

export type DeleteRowsResponse = SqlDeleteRowsResponse;

export interface InsertRowRequest {
  table: string;
  values: Record<string, unknown>;
}

export type InsertRowResponse = SqlInsertRowResponse;
export type SaveChange = SqlSaveChange;

export interface SaveChangesRequest {
  table: string;
  primaryKey: string[];
  updates: SaveChange[];
}

export type SaveChangesResponse = SqlSaveChangesResponse;
export type EditableColumnKind = SharedEditableColumnKind;

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
import type { PostgresConfig as SharedPostgresConfig } from './connection';

export type EditableColumnKind = SharedEditableColumnKind;
export type PostgresConfig = SharedPostgresConfig;

export type QueryRequest = SqlQueryRequest;
export type QueryResult = Extract<SqlQueryResponse, { ok: true }>['result'];
export type QueryResponse = SqlQueryResponse;

export interface DatabaseInfo {
  name: string;
  current: boolean;
}

export interface TableInfo {
  schema: string;
  name: string;
  type: 'table' | 'view';
}

export interface ColumnMeta {
  name: string;
  dataType: string;
  udtName: string;
  isNullable: boolean;
  isGenerated: boolean;
  isPrimaryKey: boolean;
  enumValues?: string[];
}

export type TableMeta = SqlTableMeta<ColumnMeta>;

export interface ForeignKey {
  constraintName: string;
  sourceSchema: string;
  sourceTable: string;
  column: string;
  referencedSchema: string;
  referencedTable: string;
  referencedColumn: string;
  referencedUdtName: string;
  constraintColumns: string[];
}

export interface DeleteRowsRequest {
  database: string;
  schema: string;
  table: string;
  primaryKey: string[];
  rows: Record<string, unknown>[];
}

export type DeleteRowsResponse = SqlDeleteRowsResponse;

export interface InsertRowRequest {
  database: string;
  schema: string;
  table: string;
  values: Record<string, unknown>;
}

export type InsertRowResponse = SqlInsertRowResponse;
export type SaveChange = SqlSaveChange;

export interface SaveChangesRequest {
  database: string;
  schema: string;
  table: string;
  primaryKey: string[];
  updates: SaveChange[];
}

export type SaveChangesResponse = SqlSaveChangesResponse;

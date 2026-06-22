import { registerHandler } from '../handlerRegistry';
import {
  deleteRows as sqliteDeleteRows,
  disconnect as sqliteDisconnect,
  getTableMeta as sqliteGetTableMeta,
  getTableRelations as sqliteGetTableRelations,
  insertRow as sqliteInsertRow,
  listTables as sqliteListTables,
  lookupRows as sqliteLookupRows,
  runQuery as sqliteRunQuery,
  runReadOnlyQuery as sqliteRunReadOnlyQuery,
  saveChanges as sqliteSaveChanges,
} from '../sqlite';
import type {
  DeleteRowsRequest as SqliteDeleteRowsRequest,
  InsertRowRequest as SqliteInsertRowRequest,
  QueryRequest as SqliteQueryRequest,
  QueryResponse as SqliteQueryResponse,
  SaveChangesRequest as SqliteSaveChangesRequest,
  SaveChangesResponse as SqliteSaveChangesResponse,
} from '../../src/types/sqlite';
import type { SqlDeleteRowsResponse } from '../../shared/types/sql';

export function registerSqliteHandlers(): void {
  registerHandler({
    channel: 'sqlite:query',
    handler: (args: {
      connectionId: string;
      filePath: string;
      request: SqliteQueryRequest;
    }): Promise<SqliteQueryResponse> =>
      sqliteRunQuery(args.connectionId, args.filePath, args.request),
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'sqlite:readOnlyQuery',
    handler: (args: {
      connectionId: string;
      filePath: string;
      request: SqliteQueryRequest;
    }): Promise<SqliteQueryResponse> =>
      sqliteRunReadOnlyQuery(args.connectionId, args.filePath, args.request),
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'sqlite:listTables',
    handler: (args: { connectionId: string; filePath: string }) =>
      sqliteListTables(args.connectionId, args.filePath),
    errorMode: 'errorPayload',
  });

  registerHandler({
    channel: 'sqlite:getTableMeta',
    handler: async (args: {
      connectionId: string;
      filePath: string;
      table: string;
    }) => {
      const meta = await sqliteGetTableMeta(
        args.connectionId,
        args.filePath,
        args.table,
      );
      return meta;
    },
    errorMode: 'okKey',
    okKey: 'meta',
  });

  registerHandler({
    channel: 'sqlite:getTableRelations',
    handler: async (args: {
      connectionId: string;
      filePath: string;
      table: string;
    }) => {
      const relations = await sqliteGetTableRelations(
        args.connectionId,
        args.filePath,
        args.table,
      );
      return relations;
    },
    errorMode: 'okKey',
    okKey: 'relations',
  });

  registerHandler({
    channel: 'sqlite:lookupRows',
    handler: async (args: {
      connectionId: string;
      filePath: string;
      table: string;
      columns: string[];
      search?: { column: string; query: string };
      limit?: number;
    }) => {
      const result = await sqliteLookupRows(
        args.connectionId,
        args.filePath,
        args.table,
        args.columns,
        args.search,
        args.limit,
      );
      return result;
    },
    errorMode: 'okKey',
    okKey: 'result',
  });

  registerHandler({
    channel: 'sqlite:insertRow',
    handler: (args: {
      connectionId: string;
      filePath: string;
      request: SqliteInsertRowRequest;
    }) => sqliteInsertRow(args.connectionId, args.filePath, args.request),
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'sqlite:saveChanges',
    handler: (args: {
      connectionId: string;
      filePath: string;
      request: SqliteSaveChangesRequest;
    }): Promise<SqliteSaveChangesResponse> =>
      sqliteSaveChanges(args.connectionId, args.filePath, args.request),
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'sqlite:deleteRows',
    handler: (args: {
      connectionId: string;
      filePath: string;
      request: SqliteDeleteRowsRequest;
    }): Promise<SqlDeleteRowsResponse> =>
      sqliteDeleteRows(args.connectionId, args.filePath, args.request),
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'sqlite:disconnect',
    handler: (args: { connectionId: string }) => {
      sqliteDisconnect(args.connectionId);
      return { ok: true };
    },
    errorMode: 'raw',
  });
}

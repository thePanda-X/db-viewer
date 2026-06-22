import { registerHandler } from '../handlerRegistry';
import {
  deleteRows as pgDeleteRows,
  disconnect as pgDisconnect,
  getIncomingTableRelations,
  getTableMeta,
  getTableRelations,
  insertRow as pgInsertRow,
  listDatabases,
  listTables,
  lookupRows,
  runQuery,
  runReadOnlyQuery,
  saveChanges,
} from '../postgres';
import type {
  DeleteRowsRequest,
  InsertRowRequest,
  PostgresConfig,
  QueryRequest,
  QueryResponse,
  SaveChangesRequest,
  SaveChangesResponse,
} from '../../src/types/postgres';
import type { SqlDeleteRowsResponse } from '../../shared/types/sql';

export function registerPostgresHandlers(): void {
  registerHandler({
    channel: 'postgres:query',
    handler: (args: {
      connectionId: string;
      config: PostgresConfig;
      request: QueryRequest;
    }): Promise<QueryResponse> =>
      runQuery(args.connectionId, args.config, args.request),
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'postgres:readOnlyQuery',
    handler: (args: {
      connectionId: string;
      config: PostgresConfig;
      request: QueryRequest;
    }): Promise<QueryResponse> =>
      runReadOnlyQuery(args.connectionId, args.config, args.request),
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'postgres:listDatabases',
    handler: (args: { connectionId: string; config: PostgresConfig }) =>
      listDatabases(args.connectionId, args.config),
    errorMode: 'errorPayload',
  });

  registerHandler({
    channel: 'postgres:listTables',
    handler: (args: {
      connectionId: string;
      config: PostgresConfig;
      database: string;
    }) => listTables(args.connectionId, args.config, args.database),
    errorMode: 'errorPayload',
  });

  registerHandler({
    channel: 'postgres:getTableMeta',
    handler: async (args: {
      connectionId: string;
      config: PostgresConfig;
      database?: string;
      schema: string;
      table: string;
    }) => {
      const meta = await getTableMeta(
        args.connectionId,
        args.config,
        args.database ?? args.config.database,
        args.schema,
        args.table,
      );
      return meta;
    },
    errorMode: 'okKey',
    okKey: 'meta',
  });

  registerHandler({
    channel: 'postgres:getTableRelations',
    handler: async (args: {
      connectionId: string;
      config: PostgresConfig;
      database?: string;
      schema: string;
      table: string;
    }) => {
      const relations = await getTableRelations(
        args.connectionId,
        args.config,
        args.database ?? args.config.database,
        args.schema,
        args.table,
      );
      return relations;
    },
    errorMode: 'okKey',
    okKey: 'relations',
  });

  registerHandler({
    channel: 'postgres:getIncomingTableRelations',
    handler: async (args: {
      connectionId: string;
      config: PostgresConfig;
      database?: string;
      schema: string;
      table: string;
    }) => {
      const relations = await getIncomingTableRelations(
        args.connectionId,
        args.config,
        args.database ?? args.config.database,
        args.schema,
        args.table,
      );
      return relations;
    },
    errorMode: 'okKey',
    okKey: 'relations',
  });

  registerHandler({
    channel: 'postgres:lookupRows',
    handler: async (args: {
      connectionId: string;
      config: PostgresConfig;
      database: string;
      schema: string;
      table: string;
      columns: string[];
      search?: { column: string; query: string };
      limit?: number;
    }) => {
      const result = await lookupRows(
        args.connectionId,
        args.config,
        args.database,
        args.schema,
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
    channel: 'postgres:insertRow',
    handler: (args: {
      connectionId: string;
      config: PostgresConfig;
      request: InsertRowRequest;
    }) => pgInsertRow(args.connectionId, args.config, args.request),
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'postgres:saveChanges',
    handler: (args: {
      connectionId: string;
      config: PostgresConfig;
      request: SaveChangesRequest;
    }): Promise<SaveChangesResponse> =>
      saveChanges(args.connectionId, args.config, args.request),
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'postgres:deleteRows',
    handler: (args: {
      connectionId: string;
      config: PostgresConfig;
      request: DeleteRowsRequest;
    }): Promise<SqlDeleteRowsResponse> =>
      pgDeleteRows(args.connectionId, args.config, args.request),
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'postgres:disconnect',
    handler: (args: { connectionId: string; database?: string }) => {
      pgDisconnect(args.connectionId, args.database);
      return { ok: true };
    },
    errorMode: 'raw',
  });
}

import type { Connection, PostgresConfig } from '@/types/connection'
import type {
  QueryRequest,
  QueryResponse,
  SaveChangesRequest,
  SaveChangesResponse,
  TableMeta,
  DatabaseInfo,
  TableInfo,
} from '@/types/postgres'

export interface OpenFileOptions {
  filters?: Array<{ name: string; extensions: string[] }>
}

export const api = {
  connections: {
    list: (): Promise<Connection[]> => window.api.connections.list() as Promise<Connection[]>,
    save: (connections: Connection[]): Promise<Connection[]> =>
      window.api.connections.save(connections) as Promise<Connection[]>,
  },
  dialog: {
    openFile: (options?: OpenFileOptions): Promise<string | null> =>
      window.api.dialog.openFile(options),
  },
  postgres: {
    query: (args: {
      connectionId: string
      config: PostgresConfig
      request: QueryRequest
    }): Promise<QueryResponse> => window.api.postgres.query(args),
    readOnlyQuery: (args: {
      connectionId: string
      config: PostgresConfig
      request: QueryRequest
    }): Promise<QueryResponse> => window.api.postgres.readOnlyQuery(args),
    listDatabases: (args: {
      connectionId: string
      config: PostgresConfig
    }): Promise<DatabaseInfo[] | { error: string }> =>
      window.api.postgres.listDatabases(args),
    listTables: (args: {
      connectionId: string
      config: PostgresConfig
      database: string
    }): Promise<TableInfo[] | { error: string }> => window.api.postgres.listTables(args),
    getTableMeta: (args: {
      connectionId: string
      config: PostgresConfig
      database: string
      schema: string
      table: string
    }): Promise<{ ok: true; meta: TableMeta } | { ok: false; error: string }> =>
      window.api.postgres.getTableMeta(args),
    saveChanges: (args: {
      connectionId: string
      config: PostgresConfig
      request: SaveChangesRequest
    }): Promise<SaveChangesResponse> => window.api.postgres.saveChanges(args),
    disconnect: (args: { connectionId: string; database?: string }): Promise<{ ok: true }> =>
      window.api.postgres.disconnect(args),
  },
}

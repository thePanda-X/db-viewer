import type { Connection, PostgresConfig, RedisConfig } from '@/types/connection'
import type {
  QueryRequest,
  QueryResponse,
  SaveChangesRequest,
  SaveChangesResponse,
  TableMeta,
  DatabaseInfo,
  TableInfo,
  ForeignKey,
} from '@/types/postgres'
import type {
  QueryRequest as SqliteQueryRequest,
  QueryResponse as SqliteQueryResponse,
  TableMeta as SqliteTableMeta,
  ForeignKey as SqliteForeignKey,
  SaveChangesRequest as SqliteSaveChangesRequest,
  SaveChangesResponse as SqliteSaveChangesResponse,
  TableInfo as SqliteTableInfo,
} from '@/types/sqlite'
import type {
  RedisCommandResult,
  RedisKeyMeta,
  RedisKeyType,
  RedisKeyValue,
} from '@/types/redis'

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
    getTableRelations: (args: {
      connectionId: string
      config: PostgresConfig
      database: string
      schema: string
      table: string
    }): Promise<{ ok: true; relations: ForeignKey[] } | { ok: false; error: string }> =>
      window.api.postgres.getTableRelations(args),
    saveChanges: (args: {
      connectionId: string
      config: PostgresConfig
      request: SaveChangesRequest
    }): Promise<SaveChangesResponse> => window.api.postgres.saveChanges(args),
    disconnect: (args: { connectionId: string; database?: string }): Promise<{ ok: true }> =>
      window.api.postgres.disconnect(args),
  },
  sqlite: {
    query: (args: {
      connectionId: string
      filePath: string
      request: SqliteQueryRequest
    }): Promise<SqliteQueryResponse> => window.api.sqlite.query(args),
    readOnlyQuery: (args: {
      connectionId: string
      filePath: string
      request: SqliteQueryRequest
    }): Promise<SqliteQueryResponse> => window.api.sqlite.readOnlyQuery(args),
    listTables: (args: {
      connectionId: string
      filePath: string
    }): Promise<SqliteTableInfo[] | { error: string }> => window.api.sqlite.listTables(args),
    getTableMeta: (args: {
      connectionId: string
      filePath: string
      table: string
    }): Promise<{ ok: true; meta: SqliteTableMeta } | { ok: false; error: string }> =>
      window.api.sqlite.getTableMeta(args),
    getTableRelations: (args: {
      connectionId: string
      filePath: string
      table: string
    }): Promise<{ ok: true; relations: SqliteForeignKey[] } | { ok: false; error: string }> =>
      window.api.sqlite.getTableRelations(args),
    saveChanges: (args: {
      connectionId: string
      filePath: string
      request: SqliteSaveChangesRequest
    }): Promise<SqliteSaveChangesResponse> => window.api.sqlite.saveChanges(args),
    disconnect: (args: { connectionId: string }): Promise<{ ok: true }> =>
      window.api.sqlite.disconnect(args),
  },
  redis: {
    ping: (args: { connectionId: string; config: RedisConfig }) =>
      window.api.redis.ping(args) as Promise<
        { ok: true; reply: string } | { ok: false; error: string }
      >,
    scanAll: (args: { connectionId: string; config: RedisConfig; match: string }) =>
      window.api.redis.scanAll(args) as Promise<
        { ok: true; keys: string[] } | { ok: false; error: string }
      >,
    getMeta: (args: { connectionId: string; config: RedisConfig; key: string }) =>
      window.api.redis.getMeta(args) as Promise<
        { ok: true; meta: RedisKeyMeta } | { ok: false; error: string }
      >,
    getValue: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      type: RedisKeyType
    }) =>
      window.api.redis.getValue(args) as Promise<
        { ok: true; value: RedisKeyValue } | { ok: false; error: string }
      >,
    deleteKeys: (args: { connectionId: string; config: RedisConfig; keys: string[] }) =>
      window.api.redis.deleteKeys(args) as Promise<
        { ok: true; deleted: number } | { ok: false; error: string }
      >,
    setTtl: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      ms: number
    }): Promise<{ ok: true } | { ok: false; error: string }> => window.api.redis.setTtl(args),
    setString: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      value: string
    }): Promise<{ ok: true } | { ok: false; error: string }> => window.api.redis.setString(args),
    setHashField: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      field: string
      value: string
    }): Promise<{ ok: true } | { ok: false; error: string }> =>
      window.api.redis.setHashField(args),
    deleteHashField: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      field: string
    }): Promise<{ ok: true } | { ok: false; error: string }> =>
      window.api.redis.deleteHashField(args),
    pushListElement: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      value: string
      position: 'head' | 'tail'
    }): Promise<{ ok: true; length: number } | { ok: false; error: string }> =>
      window.api.redis.pushListElement(args),
    removeListElement: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      index: number
    }): Promise<{ ok: true } | { ok: false; error: string }> =>
      window.api.redis.removeListElement(args),
    addSetMember: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      member: string
    }): Promise<{ ok: true } | { ok: false; error: string }> =>
      window.api.redis.addSetMember(args),
    removeSetMember: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      member: string
    }): Promise<{ ok: true } | { ok: false; error: string }> =>
      window.api.redis.removeSetMember(args),
    setZsetMember: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      member: string
      score: number
    }): Promise<{ ok: true } | { ok: false; error: string }> =>
      window.api.redis.setZsetMember(args),
    removeZsetMember: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      member: string
    }): Promise<{ ok: true } | { ok: false; error: string }> =>
      window.api.redis.removeZsetMember(args),
    addStreamEntry: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      fields: string[]
    }): Promise<{ ok: true; id: string } | { ok: false; error: string }> =>
      window.api.redis.addStreamEntry(args),
    executeCommand: (args: {
      connectionId: string
      config: RedisConfig
      command: string[]
    }): Promise<{ ok: true; result: RedisCommandResult } | { ok: false; error: string }> =>
      window.api.redis.executeCommand(args),
    disconnect: (args: { connectionId: string; db?: number }): Promise<{ ok: true }> =>
      window.api.redis.disconnect(args),
  },
}

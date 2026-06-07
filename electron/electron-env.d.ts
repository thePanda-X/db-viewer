/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    APP_ROOT: string
    VITE_PUBLIC: string
  }
}

interface OpenFileOptions {
  filters?: Array<{ name: string; extensions: string[] }>
}

interface PostgresExposedConfig {
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl: boolean
}

interface PostgresQueryRequest {
  sql: string
  params?: unknown[]
  maxRows?: number
}

interface PostgresQueryResult {
  columns: string[]
  rows: unknown[][]
  rowCount: number
  affectedRows: number | null
  durationMs: number
  truncated: boolean
}

type PostgresQueryResponse =
  | { ok: true; result: PostgresQueryResult }
  | { ok: false; error: string }

interface PostgresDatabaseInfo {
  name: string
  current: boolean
}

interface PostgresTableInfo {
  schema: string
  name: string
  type: 'table' | 'view'
}

interface PostgresColumnMeta {
  name: string
  dataType: string
  udtName: string
  isNullable: boolean
  isGenerated: boolean
  isPrimaryKey: boolean
}

interface PostgresTableMeta {
  columns: PostgresColumnMeta[]
  primaryKey: string[] | null
}

interface PostgresForeignKey {
  constraintName: string
  column: string
  referencedSchema: string
  referencedTable: string
  referencedColumn: string
  referencedUdtName: string
  constraintColumns: string[]
}

interface PostgresSaveChange {
  original: Record<string, unknown>
  changes: Record<string, unknown>
}

interface PostgresSaveChangesRequest {
  database: string
  schema: string
  table: string
  primaryKey: string[]
  updates: PostgresSaveChange[]
}

type PostgresSaveChangesResponse =
  | { ok: true; updated: number }
  | { ok: false; error: string; failedRowIndex?: number }

interface RedisExposedConfig {
  host: string
  port: number
  password: string
  db: number
  tls: boolean
}

type RedisKeyType = 'string' | 'list' | 'set' | 'zset' | 'hash' | 'stream' | 'none'

interface RedisKeyMeta {
  type: RedisKeyType
  ttl: number
  length: number | null
}

type RedisKeyValue =
  | { kind: 'string'; value: string | null }
  | { kind: 'list'; value: string[] }
  | { kind: 'set'; value: string[] }
  | { kind: 'zset'; value: { member: string; score: number }[] }
  | { kind: 'hash'; value: Record<string, string> }
  | { kind: 'stream'; value: { id: string; fields: string[] }[] }
  | { kind: 'none' }

type RedisCommandReply =
  | string
  | number
  | null
  | RedisCommandReply[]
  | { [k: string]: RedisCommandReply }

interface RedisCommandResult {
  reply: RedisCommandReply
  durationMs: number
}

interface ExposedApi {
  connections: {
    list: () => Promise<unknown[]>
    save: (connections: unknown[]) => Promise<unknown[]>
  }
  dialog: {
    openFile: (options?: OpenFileOptions) => Promise<string | null>
  }
  postgres: {
    query: (args: {
      connectionId: string
      config: PostgresExposedConfig
      request: PostgresQueryRequest
    }) => Promise<PostgresQueryResponse>
    readOnlyQuery: (args: {
      connectionId: string
      config: PostgresExposedConfig
      request: PostgresQueryRequest
    }) => Promise<PostgresQueryResponse>
    listDatabases: (args: {
      connectionId: string
      config: PostgresExposedConfig
    }) => Promise<PostgresDatabaseInfo[] | { error: string }>
    listTables: (args: {
      connectionId: string
      config: PostgresExposedConfig
      database: string
    }) => Promise<PostgresTableInfo[] | { error: string }>
    getTableMeta: (args: {
      connectionId: string
      config: PostgresExposedConfig
      database: string
      schema: string
      table: string
    }) => Promise<{ ok: true; meta: PostgresTableMeta } | { ok: false; error: string }>
    getTableRelations: (args: {
      connectionId: string
      config: PostgresExposedConfig
      database: string
      schema: string
      table: string
    }) => Promise<{ ok: true; relations: PostgresForeignKey[] } | { ok: false; error: string }>
    saveChanges: (args: {
      connectionId: string
      config: PostgresExposedConfig
      request: PostgresSaveChangesRequest
    }) => Promise<PostgresSaveChangesResponse>
    disconnect: (args: { connectionId: string; database?: string }) => Promise<{ ok: true }>
  }
  redis: {
    ping: (args: { connectionId: string; config: RedisExposedConfig }) => Promise<
      { ok: true; reply: string } | { ok: false; error: string }
    >
    scanAll: (args: {
      connectionId: string
      config: RedisExposedConfig
      match: string
    }) => Promise<{ ok: true; keys: string[] } | { ok: false; error: string }>
    getMeta: (args: {
      connectionId: string
      config: RedisExposedConfig
      key: string
    }) => Promise<{ ok: true; meta: RedisKeyMeta } | { ok: false; error: string }>
    getValue: (args: {
      connectionId: string
      config: RedisExposedConfig
      key: string
      type: RedisKeyType
    }) => Promise<{ ok: true; value: RedisKeyValue } | { ok: false; error: string }>
    deleteKeys: (args: {
      connectionId: string
      config: RedisExposedConfig
      keys: string[]
    }) => Promise<{ ok: true; deleted: number } | { ok: false; error: string }>
    setTtl: (args: {
      connectionId: string
      config: RedisExposedConfig
      key: string
      ms: number
    }) => Promise<{ ok: true } | { ok: false; error: string }>
    setString: (args: {
      connectionId: string
      config: RedisExposedConfig
      key: string
      value: string
    }) => Promise<{ ok: true } | { ok: false; error: string }>
    setHashField: (args: {
      connectionId: string
      config: RedisExposedConfig
      key: string
      field: string
      value: string
    }) => Promise<{ ok: true } | { ok: false; error: string }>
    deleteHashField: (args: {
      connectionId: string
      config: RedisExposedConfig
      key: string
      field: string
    }) => Promise<{ ok: true } | { ok: false; error: string }>
    pushListElement: (args: {
      connectionId: string
      config: RedisExposedConfig
      key: string
      value: string
      position: 'head' | 'tail'
    }) => Promise<{ ok: true; length: number } | { ok: false; error: string }>
    removeListElement: (args: {
      connectionId: string
      config: RedisExposedConfig
      key: string
      index: number
    }) => Promise<{ ok: true } | { ok: false; error: string }>
    addSetMember: (args: {
      connectionId: string
      config: RedisExposedConfig
      key: string
      member: string
    }) => Promise<{ ok: true } | { ok: false; error: string }>
    removeSetMember: (args: {
      connectionId: string
      config: RedisExposedConfig
      key: string
      member: string
    }) => Promise<{ ok: true } | { ok: false; error: string }>
    setZsetMember: (args: {
      connectionId: string
      config: RedisExposedConfig
      key: string
      member: string
      score: number
    }) => Promise<{ ok: true } | { ok: false; error: string }>
    removeZsetMember: (args: {
      connectionId: string
      config: RedisExposedConfig
      key: string
      member: string
    }) => Promise<{ ok: true } | { ok: false; error: string }>
    addStreamEntry: (args: {
      connectionId: string
      config: RedisExposedConfig
      key: string
      fields: string[]
    }) => Promise<{ ok: true; id: string } | { ok: false; error: string }>
    executeCommand: (args: {
      connectionId: string
      config: RedisExposedConfig
      command: string[]
    }) => Promise<{ ok: true; result: RedisCommandResult } | { ok: false; error: string }>
    disconnect: (args: { connectionId: string; db?: number }) => Promise<{ ok: true }>
  }
}

interface Window {
  ipcRenderer: import('electron').IpcRenderer
  api: ExposedApi
}

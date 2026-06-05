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
    saveChanges: (args: {
      connectionId: string
      config: PostgresExposedConfig
      request: PostgresSaveChangesRequest
    }) => Promise<PostgresSaveChangesResponse>
    disconnect: (args: { connectionId: string; database?: string }) => Promise<{ ok: true }>
  }
}

interface Window {
  ipcRenderer: import('electron').IpcRenderer
  api: ExposedApi
}

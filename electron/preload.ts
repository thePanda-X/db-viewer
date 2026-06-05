import { ipcRenderer, contextBridge } from 'electron'
import type {
  PostgresConfig,
  QueryRequest,
  QueryResponse,
  SaveChangesRequest,
  SaveChangesResponse,
  TableMeta,
} from '../src/types/postgres'

export interface OpenFileOptions {
  filters?: Array<{ name: string; extensions: string[] }>
}

interface DatabaseInfo {
  name: string
  current: boolean
}

interface TableInfo {
  schema: string
  name: string
  type: 'table' | 'view'
}

const api = {
  connections: {
    list: (): Promise<unknown[]> => ipcRenderer.invoke('connections:list'),
    save: (connections: unknown[]): Promise<unknown[]> =>
      ipcRenderer.invoke('connections:save', connections),
  },
  dialog: {
    openFile: (options?: OpenFileOptions): Promise<string | null> =>
      ipcRenderer.invoke('dialog:openFile', options),
  },
  postgres: {
    query: (args: {
      connectionId: string
      config: PostgresConfig
      request: QueryRequest
    }): Promise<QueryResponse> =>
      ipcRenderer.invoke('postgres:query', args) as Promise<QueryResponse>,
    readOnlyQuery: (args: {
      connectionId: string
      config: PostgresConfig
      request: QueryRequest
    }): Promise<QueryResponse> =>
      ipcRenderer.invoke('postgres:readOnlyQuery', args) as Promise<QueryResponse>,
    listDatabases: (args: {
      connectionId: string
      config: PostgresConfig
    }): Promise<DatabaseInfo[] | { error: string }> =>
      ipcRenderer.invoke('postgres:listDatabases', args) as Promise<DatabaseInfo[] | { error: string }>,
    listTables: (args: {
      connectionId: string
      config: PostgresConfig
      database: string
    }): Promise<TableInfo[] | { error: string }> =>
      ipcRenderer.invoke('postgres:listTables', args) as Promise<TableInfo[] | { error: string }>,
    getTableMeta: (args: {
      connectionId: string
      config: PostgresConfig
      database: string
      schema: string
      table: string
    }): Promise<{ ok: true; meta: TableMeta } | { ok: false; error: string }> =>
      ipcRenderer.invoke('postgres:getTableMeta', args) as Promise<
        { ok: true; meta: TableMeta } | { ok: false; error: string }
      >,
    saveChanges: (args: {
      connectionId: string
      config: PostgresConfig
      request: SaveChangesRequest
    }): Promise<SaveChangesResponse> =>
      ipcRenderer.invoke('postgres:saveChanges', args) as Promise<SaveChangesResponse>,
    disconnect: (args: { connectionId: string; database?: string }): Promise<{ ok: true }> =>
      ipcRenderer.invoke('postgres:disconnect', args) as Promise<{ ok: true }>,
  },
}

contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

contextBridge.exposeInMainWorld('api', api)

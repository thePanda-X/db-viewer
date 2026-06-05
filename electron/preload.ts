import { ipcRenderer, contextBridge } from 'electron'
import type {
  PostgresConfig,
  QueryRequest,
  QueryResponse,
  SaveChangesRequest,
  SaveChangesResponse,
  TableMeta,
} from '../src/types/postgres'
import type { RedisConfig } from '../src/types/connection'
import type {
  RedisCommandResult,
  RedisKeyMeta,
  RedisKeyType,
  RedisKeyValue,
} from '../src/types/redis'

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
  redis: {
    ping: (args: { connectionId: string; config: RedisConfig }): Promise<
      { ok: true; reply: string } | { ok: false; error: string }
    > => ipcRenderer.invoke('redis:ping', args) as Promise<
      { ok: true; reply: string } | { ok: false; error: string }
    >,
    scanAll: (args: {
      connectionId: string
      config: RedisConfig
      match: string
    }): Promise<{ ok: true; keys: string[] } | { ok: false; error: string }> =>
      ipcRenderer.invoke('redis:scanAll', args) as Promise<
        { ok: true; keys: string[] } | { ok: false; error: string }
      >,
    getMeta: (args: {
      connectionId: string
      config: RedisConfig
      key: string
    }): Promise<{ ok: true; meta: RedisKeyMeta } | { ok: false; error: string }> =>
      ipcRenderer.invoke('redis:getMeta', args) as Promise<
        { ok: true; meta: RedisKeyMeta } | { ok: false; error: string }
      >,
    getValue: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      type: RedisKeyType
    }): Promise<{ ok: true; value: RedisKeyValue } | { ok: false; error: string }> =>
      ipcRenderer.invoke('redis:getValue', args) as Promise<
        { ok: true; value: RedisKeyValue } | { ok: false; error: string }
      >,
    deleteKeys: (args: {
      connectionId: string
      config: RedisConfig
      keys: string[]
    }): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> =>
      ipcRenderer.invoke('redis:deleteKeys', args) as Promise<
        { ok: true; deleted: number } | { ok: false; error: string }
      >,
    setTtl: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      ms: number
    }): Promise<{ ok: true } | { ok: false; error: string }> =>
      ipcRenderer.invoke('redis:setTtl', args) as Promise<
        { ok: true } | { ok: false; error: string }
      >,
    setString: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      value: string
    }): Promise<{ ok: true } | { ok: false; error: string }> =>
      ipcRenderer.invoke('redis:setString', args) as Promise<
        { ok: true } | { ok: false; error: string }
      >,
    setHashField: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      field: string
      value: string
    }): Promise<{ ok: true } | { ok: false; error: string }> =>
      ipcRenderer.invoke('redis:setHashField', args) as Promise<
        { ok: true } | { ok: false; error: string }
      >,
    deleteHashField: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      field: string
    }): Promise<{ ok: true } | { ok: false; error: string }> =>
      ipcRenderer.invoke('redis:deleteHashField', args) as Promise<
        { ok: true } | { ok: false; error: string }
      >,
    pushListElement: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      value: string
      position: 'head' | 'tail'
    }): Promise<{ ok: true; length: number } | { ok: false; error: string }> =>
      ipcRenderer.invoke('redis:pushListElement', args) as Promise<
        { ok: true; length: number } | { ok: false; error: string }
      >,
    removeListElement: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      index: number
    }): Promise<{ ok: true } | { ok: false; error: string }> =>
      ipcRenderer.invoke('redis:removeListElement', args) as Promise<
        { ok: true } | { ok: false; error: string }
      >,
    addSetMember: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      member: string
    }): Promise<{ ok: true } | { ok: false; error: string }> =>
      ipcRenderer.invoke('redis:addSetMember', args) as Promise<
        { ok: true } | { ok: false; error: string }
      >,
    removeSetMember: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      member: string
    }): Promise<{ ok: true } | { ok: false; error: string }> =>
      ipcRenderer.invoke('redis:removeSetMember', args) as Promise<
        { ok: true } | { ok: false; error: string }
      >,
    setZsetMember: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      member: string
      score: number
    }): Promise<{ ok: true } | { ok: false; error: string }> =>
      ipcRenderer.invoke('redis:setZsetMember', args) as Promise<
        { ok: true } | { ok: false; error: string }
      >,
    removeZsetMember: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      member: string
    }): Promise<{ ok: true } | { ok: false; error: string }> =>
      ipcRenderer.invoke('redis:removeZsetMember', args) as Promise<
        { ok: true } | { ok: false; error: string }
      >,
    addStreamEntry: (args: {
      connectionId: string
      config: RedisConfig
      key: string
      fields: string[]
    }): Promise<{ ok: true; id: string } | { ok: false; error: string }> =>
      ipcRenderer.invoke('redis:addStreamEntry', args) as Promise<
        { ok: true; id: string } | { ok: false; error: string }
      >,
    executeCommand: (args: {
      connectionId: string
      config: RedisConfig
      command: string[]
    }): Promise<{ ok: true; result: RedisCommandResult } | { ok: false; error: string }> =>
      ipcRenderer.invoke('redis:executeCommand', args) as Promise<
        { ok: true; result: RedisCommandResult } | { ok: false; error: string }
      >,
    disconnect: (args: {
      connectionId: string
      db?: number
    }): Promise<{ ok: true }> =>
      ipcRenderer.invoke('redis:disconnect', args) as Promise<{ ok: true }>,
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

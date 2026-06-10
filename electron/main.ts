import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { listConnections, setConnections } from './connections'
import {
  disconnect as pgDisconnect,
  getTableMeta,
  getTableRelations,
  listDatabases,
  listTables,
  runQuery,
  runReadOnlyQuery,
  saveChanges,
} from './postgres'
import {
  disconnect as sqliteDisconnect,
  getTableMeta as sqliteGetTableMeta,
  getTableRelations as sqliteGetTableRelations,
  listTables as sqliteListTables,
  runQuery as sqliteRunQuery,
  runReadOnlyQuery as sqliteRunReadOnlyQuery,
  saveChanges as sqliteSaveChanges,
} from './sqlite'
import {
  addSetMember as redisAddSetMember,
  addStreamEntry as redisAddStreamEntry,
  deleteHashField as redisDeleteHashField,
  deleteKeys as redisDeleteKeys,
  disconnect as redisDisconnect,
  executeCommand as redisExecuteCommand,
  getMeta as redisGetMeta,
  getValue as redisGetValue,
  ping as redisPing,
  pushListElement as redisPushListElement,
  removeListElement as redisRemoveListElement,
  removeSetMember as redisRemoveSetMember,
  removeZsetMember as redisRemoveZsetMember,
  scanAll as redisScanAll,
  setHashField as redisSetHashField,
  setStringValue as redisSetStringValue,
  setTtl as redisSetTtl,
  setZsetMember as redisSetZsetMember,
} from './redis'
import {
  deleteDocument as opensearchDeleteDocument,
  disconnect as opensearchDisconnect,
  executeRequest as opensearchExecuteRequest,
  getIndexMeta as opensearchGetIndexMeta,
  listIndices as opensearchListIndices,
  ping as opensearchPing,
  searchDocuments as opensearchSearchDocuments,
  updateDocument as opensearchUpdateDocument,
} from './opensearch'
import type {
  PostgresConfig,
  QueryRequest,
  QueryResponse,
  SaveChangesRequest,
  SaveChangesResponse,
  TableMeta,
  ForeignKey,
} from '../src/types/postgres'
import type {
  QueryRequest as SqliteQueryRequest,
  QueryResponse as SqliteQueryResponse,
  SaveChangesRequest as SqliteSaveChangesRequest,
  SaveChangesResponse as SqliteSaveChangesResponse,
  TableMeta as SqliteTableMeta,
  ForeignKey as SqliteForeignKey,
} from '../src/types/sqlite'
import type { RedisCommandResult, RedisKeyMeta, RedisKeyValue, RedisKeyType } from '../src/types/redis'
import type { OpenSearchConfig } from '../src/types/connection'
import type {
  OpenSearchClusterInfo,
  OpenSearchIndexInfo,
  OpenSearchIndexMeta,
  OpenSearchRawRequest,
  OpenSearchRawResponse,
  OpenSearchSearchRequest,
  OpenSearchSearchResult,
} from '../src/types/opensearch'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

interface PostgresInvokeArgs {
  connectionId: string
  config: PostgresConfig
  database?: string
}

interface TableMetaArgs extends PostgresInvokeArgs {
  schema: string
  table: string
}

interface ListTablesArgs extends PostgresInvokeArgs {
  database: string
}

function toErrorPayload(err: unknown) {
  return { error: err instanceof Error ? err.message : String(err) }
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return 'Unknown error'
  }
}

type IpcHandler<TArgs, TResult> = (args: TArgs) => Promise<TResult> | TResult

function register<TArgs, TResult>(channel: string, handler: IpcHandler<TArgs, TResult>) {
  ipcMain.handle(channel, async (_event, args: TArgs) => handler(args))
}

async function withErrorPayload<T>(fn: () => Promise<T> | T): Promise<T | { error: string }> {
  try {
    return await fn()
  } catch (err) {
    return toErrorPayload(err)
  }
}

async function withOkPayload<TKey extends string, TValue>(
  key: TKey,
  fn: () => Promise<TValue> | TValue,
): Promise<({ ok: true } & Record<TKey, TValue>) | { ok: false; error: string }> {
  try {
    return { ok: true, [key]: await fn() } as { ok: true } & Record<TKey, TValue>
  } catch (err) {
    return { ok: false, error: toErrorMessage(err) }
  }
}

async function withResultPayload<T>(
  fn: () => Promise<T> | T,
): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  return withOkPayload('result', fn)
}

async function withSuccess(fn: () => Promise<unknown> | unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await fn()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: toErrorMessage(err) }
  }
}

app.whenReady().then(() => {
  const isMac = process.platform === 'darwin'

  const openConfigFolder = async () => {
    try {
      const err = await shell.openPath(app.getPath('userData'))
      if (err) {
        console.error('[menu] failed to open config folder:', err)
      }
    } catch (err) {
      console.error('[menu] failed to open config folder', err)
    }
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Config Folder',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => {
            void openConfigFolder()
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const },
              {
                label: 'Speech',
                submenu: [
                  { role: 'startSpeaking' as const },
                  { role: 'stopSpeaking' as const },
                ],
              },
            ]
          : [
              { role: 'delete' as const },
              { type: 'separator' as const },
              { role: 'selectAll' as const },
            ]),
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: isMac
        ? [
            { role: 'minimize' as const },
            { role: 'zoom' as const },
            { type: 'separator' as const },
            { role: 'front' as const },
          ]
        : [{ role: 'minimize' as const }, { role: 'close' as const }],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))

  register('connections:list', () => listConnections())

  register('connections:save', (connections: unknown[]) => setConnections(connections))

  register('dialog:openFile', async (options?: { filters?: Electron.FileFilter[] }) => {
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: options?.filters,
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(
    'postgres:query',
    async (_event, args: { connectionId: string; config: PostgresConfig; request: QueryRequest }): Promise<QueryResponse> => {
      try {
        return await runQuery(args.connectionId, args.config, args.request)
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    },
  )

  ipcMain.handle(
    'postgres:readOnlyQuery',
    async (_event, args: { connectionId: string; config: PostgresConfig; request: QueryRequest }): Promise<QueryResponse> => {
      try {
        return await runReadOnlyQuery(args.connectionId, args.config, args.request)
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    },
  )

  ipcMain.handle(
    'postgres:listDatabases',
    async (_event, args: { connectionId: string; config: PostgresConfig }) =>
      withErrorPayload(() => listDatabases(args.connectionId, args.config)),
  )

  ipcMain.handle(
    'postgres:listTables',
    async (_event, args: ListTablesArgs) => {
      try {
        return await listTables(args.connectionId, args.config, args.database)
      } catch (err) {
        return toErrorPayload(err)
      }
    },
  )

  ipcMain.handle(
    'postgres:getTableMeta',
    async (_event, args: TableMetaArgs): Promise<{ ok: true; meta: TableMeta } | { ok: false; error: string }> => {
      try {
        const meta = await getTableMeta(
          args.connectionId,
          args.config,
          args.database ?? args.config.database,
          args.schema,
          args.table,
        )
        return { ok: true, meta }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    },
  )

  ipcMain.handle(
    'postgres:getTableRelations',
    async (
      _event,
      args: TableMetaArgs,
    ): Promise<{ ok: true; relations: ForeignKey[] } | { ok: false; error: string }> => {
      try {
        const relations = await getTableRelations(
          args.connectionId,
          args.config,
          args.database ?? args.config.database,
          args.schema,
          args.table,
        )
        return { ok: true, relations }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    },
  )

  ipcMain.handle(
    'postgres:saveChanges',
    async (
      _event,
      args: { connectionId: string; config: PostgresConfig; request: SaveChangesRequest },
    ): Promise<SaveChangesResponse> => {
      try {
        return await saveChanges(args.connectionId, args.config, args.request)
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    },
  )

  ipcMain.handle(
    'postgres:disconnect',
    async (_event, args: { connectionId: string; database?: string }) => {
      pgDisconnect(args.connectionId, args.database)
      return { ok: true }
    },
  )

  ipcMain.handle(
    'sqlite:query',
    async (_event, args: { connectionId: string; filePath: string; request: SqliteQueryRequest }): Promise<SqliteQueryResponse> => {
      try {
        return await sqliteRunQuery(args.connectionId, args.filePath, args.request)
      } catch (err) {
        return { ok: false, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'sqlite:readOnlyQuery',
    async (_event, args: { connectionId: string; filePath: string; request: SqliteQueryRequest }): Promise<SqliteQueryResponse> => {
      try {
        return await sqliteRunReadOnlyQuery(args.connectionId, args.filePath, args.request)
      } catch (err) {
        return { ok: false, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'sqlite:listTables',
    async (_event, args: { connectionId: string; filePath: string }) => {
      try {
        return await sqliteListTables(args.connectionId, args.filePath)
      } catch (err) {
        return toErrorPayload(err)
      }
    },
  )

  ipcMain.handle(
    'sqlite:getTableMeta',
    async (_event, args: { connectionId: string; filePath: string; table: string }): Promise<{ ok: true; meta: SqliteTableMeta } | { ok: false; error: string }> => {
      try {
        const meta = await sqliteGetTableMeta(args.connectionId, args.filePath, args.table)
        return { ok: true, meta }
      } catch (err) {
        return { ok: false, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'sqlite:getTableRelations',
    async (_event, args: { connectionId: string; filePath: string; table: string }): Promise<{ ok: true; relations: SqliteForeignKey[] } | { ok: false; error: string }> => {
      try {
        const relations = await sqliteGetTableRelations(args.connectionId, args.filePath, args.table)
        return { ok: true, relations }
      } catch (err) {
        return { ok: false, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'sqlite:saveChanges',
    async (_event, args: { connectionId: string; filePath: string; request: SqliteSaveChangesRequest }): Promise<SqliteSaveChangesResponse> => {
      try {
        return await sqliteSaveChanges(args.connectionId, args.filePath, args.request)
      } catch (err) {
        return { ok: false, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'sqlite:disconnect',
    async (_event, args: { connectionId: string }) => {
      sqliteDisconnect(args.connectionId)
      return { ok: true }
    },
  )

  type RedisInvokeArgs = {
    connectionId: string
    config: import('../src/types/connection').RedisConfig
  }

  ipcMain.handle(
    'redis:ping',
    async (_event, args: RedisInvokeArgs) => {
      try {
        const reply = await redisPing(args.connectionId, args.config)
        return { ok: true as const, reply }
      } catch (err) {
        return { ok: false as const, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'redis:scanAll',
    async (_event, args: RedisInvokeArgs & { match: string }) => {
      try {
        const keys = await redisScanAll(args.connectionId, args.config, args.match)
        return { ok: true as const, keys }
      } catch (err) {
        return { ok: false as const, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'redis:getMeta',
    async (_event, args: RedisInvokeArgs & { key: string }): Promise<
      { ok: true; meta: RedisKeyMeta } | { ok: false; error: string }
    > => {
      try {
        const meta = await redisGetMeta(args.connectionId, args.config, args.key)
        return { ok: true, meta }
      } catch (err) {
        return { ok: false, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'redis:getValue',
    async (
      _event,
      args: RedisInvokeArgs & { key: string; type: RedisKeyType },
    ): Promise<{ ok: true; value: RedisKeyValue } | { ok: false; error: string }> => {
      try {
        const value = await redisGetValue(args.connectionId, args.config, args.key, args.type)
        return { ok: true, value }
      } catch (err) {
        return { ok: false, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'redis:deleteKeys',
    async (_event, args: RedisInvokeArgs & { keys: string[] }) => {
      try {
        const deleted = await redisDeleteKeys(args.connectionId, args.config, args.keys)
        return { ok: true as const, deleted }
      } catch (err) {
        return { ok: false as const, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'redis:setTtl',
    async (_event, args: RedisInvokeArgs & { key: string; ms: number }) => {
      try {
        await redisSetTtl(args.connectionId, args.config, args.key, args.ms)
        return { ok: true as const }
      } catch (err) {
        return { ok: false as const, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'redis:setString',
    async (_event, args: RedisInvokeArgs & { key: string; value: string }) => {
      try {
        await redisSetStringValue(args.connectionId, args.config, args.key, args.value)
        return { ok: true as const }
      } catch (err) {
        return { ok: false as const, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'redis:setHashField',
    async (
      _event,
      args: RedisInvokeArgs & { key: string; field: string; value: string },
    ) => {
      try {
        await redisSetHashField(args.connectionId, args.config, args.key, args.field, args.value)
        return { ok: true as const }
      } catch (err) {
        return { ok: false as const, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'redis:deleteHashField',
    async (_event, args: RedisInvokeArgs & { key: string; field: string }) => {
      try {
        await redisDeleteHashField(args.connectionId, args.config, args.key, args.field)
        return { ok: true as const }
      } catch (err) {
        return { ok: false as const, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'redis:pushListElement',
    async (
      _event,
      args: RedisInvokeArgs & { key: string; value: string; position: 'head' | 'tail' },
    ) => {
      try {
        const length = await redisPushListElement(
          args.connectionId,
          args.config,
          args.key,
          args.value,
          args.position,
        )
        return { ok: true as const, length }
      } catch (err) {
        return { ok: false as const, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'redis:removeListElement',
    async (_event, args: RedisInvokeArgs & { key: string; index: number }) => {
      try {
        await redisRemoveListElement(args.connectionId, args.config, args.key, args.index)
        return { ok: true as const }
      } catch (err) {
        return { ok: false as const, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'redis:addSetMember',
    async (_event, args: RedisInvokeArgs & { key: string; member: string }) => {
      try {
        await redisAddSetMember(args.connectionId, args.config, args.key, args.member)
        return { ok: true as const }
      } catch (err) {
        return { ok: false as const, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'redis:removeSetMember',
    async (_event, args: RedisInvokeArgs & { key: string; member: string }) => {
      try {
        await redisRemoveSetMember(args.connectionId, args.config, args.key, args.member)
        return { ok: true as const }
      } catch (err) {
        return { ok: false as const, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'redis:setZsetMember',
    async (
      _event,
      args: RedisInvokeArgs & { key: string; member: string; score: number },
    ) => {
      try {
        await redisSetZsetMember(
          args.connectionId,
          args.config,
          args.key,
          args.member,
          args.score,
        )
        return { ok: true as const }
      } catch (err) {
        return { ok: false as const, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'redis:removeZsetMember',
    async (_event, args: RedisInvokeArgs & { key: string; member: string }) => {
      try {
        await redisRemoveZsetMember(args.connectionId, args.config, args.key, args.member)
        return { ok: true as const }
      } catch (err) {
        return { ok: false as const, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'redis:addStreamEntry',
    async (_event, args: RedisInvokeArgs & { key: string; fields: string[] }) => {
      try {
        const id = await redisAddStreamEntry(args.connectionId, args.config, args.key, args.fields)
        return { ok: true as const, id }
      } catch (err) {
        return { ok: false as const, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'redis:executeCommand',
    async (
      _event,
      args: RedisInvokeArgs & { command: string[] },
    ): Promise<{ ok: true; result: RedisCommandResult } | { ok: false; error: string }> => {
      try {
        const result = await redisExecuteCommand(args.connectionId, args.config, args.command)
        return { ok: true, result }
      } catch (err) {
        return { ok: false, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'redis:disconnect',
    async (_event, args: { connectionId: string; db?: number }) => {
      redisDisconnect(args.connectionId, args.db)
      return { ok: true }
    },
  )

  type OpenSearchInvokeArgs = {
    connectionId: string
    config: OpenSearchConfig
  }

  ipcMain.handle(
    'opensearch:ping',
    async (_event, args: OpenSearchInvokeArgs): Promise<
      { ok: true; result: OpenSearchClusterInfo } | { ok: false; error: string }
    > => withResultPayload(() => opensearchPing(args.connectionId, args.config)),
  )

  ipcMain.handle(
    'opensearch:listIndices',
    async (_event, args: OpenSearchInvokeArgs & { includeSystem: boolean }): Promise<
      { ok: true; result: OpenSearchIndexInfo[] } | { ok: false; error: string }
    > => {
      try {
        const result = await opensearchListIndices(args.connectionId, args.config, args.includeSystem)
        return { ok: true, result }
      } catch (err) {
        return { ok: false, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'opensearch:getIndexMeta',
    async (_event, args: OpenSearchInvokeArgs & { index: string }): Promise<
      { ok: true; result: OpenSearchIndexMeta } | { ok: false; error: string }
    > => {
      try {
        const result = await opensearchGetIndexMeta(args.connectionId, args.config, args.index)
        return { ok: true, result }
      } catch (err) {
        return { ok: false, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'opensearch:searchDocuments',
    async (_event, args: OpenSearchInvokeArgs & { request: OpenSearchSearchRequest }): Promise<
      { ok: true; result: OpenSearchSearchResult } | { ok: false; error: string }
    > => {
      try {
        const result = await opensearchSearchDocuments(args.connectionId, args.config, args.request)
        return { ok: true, result }
      } catch (err) {
        return { ok: false, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'opensearch:updateDocument',
    async (_event, args: OpenSearchInvokeArgs & { index: string; id: string; source: unknown }) => {
      return withSuccess(() => opensearchUpdateDocument(args.connectionId, args.config, args.index, args.id, args.source))
    },
  )

  ipcMain.handle(
    'opensearch:deleteDocument',
    async (_event, args: OpenSearchInvokeArgs & { index: string; id: string }) => {
      try {
        await opensearchDeleteDocument(args.connectionId, args.config, args.index, args.id)
        return { ok: true as const }
      } catch (err) {
        return { ok: false as const, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'opensearch:executeRequest',
    async (_event, args: OpenSearchInvokeArgs & { request: OpenSearchRawRequest }): Promise<
      { ok: true; result: OpenSearchRawResponse } | { ok: false; error: string }
    > => {
      try {
        const result = await opensearchExecuteRequest(args.connectionId, args.config, args.request)
        return { ok: true, result }
      } catch (err) {
        return { ok: false, error: toErrorMessage(err) }
      }
    },
  )

  ipcMain.handle(
    'opensearch:disconnect',
    async (_event, args: { connectionId: string }) => {
      opensearchDisconnect(args.connectionId)
      return { ok: true }
    },
  )

  createWindow()
})

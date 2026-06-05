import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { listConnections, setConnections } from './connections'
import {
  disconnect as pgDisconnect,
  getTableMeta,
  listDatabases,
  listTables,
  runQuery,
  runReadOnlyQuery,
  saveChanges,
} from './postgres'
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
import type {
  PostgresConfig,
  QueryRequest,
  QueryResponse,
  SaveChangesRequest,
  SaveChangesResponse,
  TableMeta,
} from '../src/types/postgres'
import type { RedisCommandResult, RedisKeyMeta, RedisKeyValue, RedisKeyType } from '../src/types/redis'

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
        { role: 'reload' },
        { role: 'forceReload' },
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

  ipcMain.handle('connections:list', async () => {
    return listConnections()
  })

  ipcMain.handle('connections:save', async (_event, connections: unknown[]) => {
    return setConnections(connections)
  })

  ipcMain.handle('dialog:openFile', async (_event, options?: { filters?: Electron.FileFilter[] }) => {
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
    async (_event, args: { connectionId: string; config: PostgresConfig }) => {
      try {
        return await listDatabases(args.connectionId, args.config)
      } catch (err) {
        return toErrorPayload(err)
      }
    },
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

  createWindow()
})

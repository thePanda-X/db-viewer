import { app, BrowserWindow, dialog, Menu, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { listConnections, setConnections } from './connections';
import { listFolders, setFolders } from './folders';
import { registerHandler } from './handlerRegistry';
import {
  registerPostgresHandlers,
  registerSqliteHandlers,
  registerRedisHandlers,
  registerOpensearchHandlers,
  registerKafkaHandlers,
  registerRabbitmqHandlers,
} from './handlers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, '..');

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

let win: BrowserWindow | null;
let updateCheckInProgress = false;
let manualUpdateCheck = false;

type UpdaterStatus =
  | { type: 'checking'; manual: boolean }
  | { type: 'available'; currentVersion: string; version: string }
  | { type: 'not-available'; currentVersion: string; manual: boolean }
  | { type: 'downloading'; version?: string }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string; manual: boolean };

let latestUpdaterStatus: UpdaterStatus | null = null;

function sendUpdaterStatus(status: UpdaterStatus) {
  latestUpdaterStatus = status;
  win?.webContents.send('updater:status', status);
}

async function checkForUpdates(manual = false) {
  if (VITE_DEV_SERVER_URL || !app.isPackaged || updateCheckInProgress) {
    if (manual) {
      sendUpdaterStatus({
        type: 'not-available',
        currentVersion: app.getVersion(),
        manual,
      });
    }
    return;
  }

  updateCheckInProgress = true;
  manualUpdateCheck = manual;
  sendUpdaterStatus({ type: 'checking', manual });

  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    console.error('[updater] failed to check for updates', err);
    manualUpdateCheck = false;
    sendUpdaterStatus({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
      manual,
    });
  } finally {
    updateCheckInProgress = false;
  }
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    manualUpdateCheck = false;
    sendUpdaterStatus({
      type: 'available',
      currentVersion: app.getVersion(),
      version: info.version,
    });
  });

  autoUpdater.on('update-not-available', () => {
    const manual = manualUpdateCheck;
    manualUpdateCheck = false;

    sendUpdaterStatus({
      type: 'not-available',
      currentVersion: app.getVersion(),
      manual,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdaterStatus({
      type: 'downloaded',
      version: info.version,
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] error', err);
    sendUpdaterStatus({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
      manual: manualUpdateCheck,
    });
    manualUpdateCheck = false;
  });
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  });

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  const isMac = process.platform === 'darwin';

  const openConfigFolder = async () => {
    try {
      const err = await shell.openPath(app.getPath('userData'));
      if (err) {
        console.error('[menu] failed to open config folder:', err);
      }
    } catch (err) {
      console.error('[menu] failed to open config folder', err);
    }
  };

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
            void openConfigFolder();
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            void checkForUpdates(true);
          },
        },
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
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  registerHandler({
    channel: 'app:version',
    handler: () => app.getVersion(),
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'app:checkForUpdates',
    handler: (manual?: boolean) => checkForUpdates(Boolean(manual)),
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'app:downloadUpdate',
    handler: async () => {
      sendUpdaterStatus({ type: 'downloading' });
      try {
        await autoUpdater.downloadUpdate();
      } catch (err) {
        console.error('[updater] failed to download update', err);
        sendUpdaterStatus({
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
          manual: false,
        });
      }
    },
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'app:installUpdate',
    handler: () => autoUpdater.quitAndInstall(false, true),
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'app:getUpdaterStatus',
    handler: () => latestUpdaterStatus,
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'connections:list',
    handler: () => listConnections(),
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'connections:save',
    handler: (connections: unknown[]) => setConnections(connections),
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'folders:list',
    handler: () => listFolders(),
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'folders:save',
    handler: (folders: unknown[]) => setFolders(folders),
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'dialog:openFile',
    handler: async (options?: { filters?: Electron.FileFilter[] }) => {
      if (!win) return null;
      const result = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: options?.filters,
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0];
    },
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'dialog:saveFile',
    handler: async (options?: {
      defaultPath?: string;
      filters?: Electron.FileFilter[];
    }) => {
      if (!win) return null;
      const result = await dialog.showSaveDialog(win, {
        defaultPath: options?.defaultPath,
        filters: options?.filters,
      });
      if (result.canceled || !result.filePath) return null;
      return result.filePath;
    },
    errorMode: 'raw',
  });

  registerPostgresHandlers();
  registerSqliteHandlers();
  registerRedisHandlers();
  registerOpensearchHandlers();
  registerKafkaHandlers();
  registerRabbitmqHandlers();

  setupAutoUpdater();
  createWindow();
  void checkForUpdates();
});

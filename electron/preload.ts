import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, ipcChannel, type IpcNamespace } from '../shared/ipc';

const UPDATE_STATUS_CHANNEL = 'updater:status';
const SHOW_CHANGELOG_CHANNEL = 'app:showChangelog';

type ApiNamespace<TNamespace extends IpcNamespace> = {
  [TOperation in (typeof IPC_CHANNELS)[TNamespace][number]]: (
    args?: unknown,
  ) => Promise<unknown>;
};

type ExposedApi = {
  [TNamespace in IpcNamespace]: ApiNamespace<TNamespace>;
} & {
  updater: {
    onStatus: (callback: (status: unknown) => void) => () => void;
  };
  changelog: {
    onShow: (callback: () => void) => () => void;
  };
};

type MutableNamespace = Record<string, (args?: unknown) => Promise<unknown>>;

function createApi(): ExposedApi {
  const api = {} as ExposedApi;

  for (const namespace of Object.keys(IPC_CHANNELS) as IpcNamespace[]) {
    api[namespace] = {} as ApiNamespace<typeof namespace>;
    const namespaceApi = api[namespace] as MutableNamespace;
    for (const operation of IPC_CHANNELS[namespace]) {
      namespaceApi[operation] = (args?: unknown) =>
        ipcRenderer.invoke(ipcChannel(namespace, operation), args);
    }
  }

  api.updater = {
    onStatus: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, status: unknown) => {
        callback(status);
      };
      ipcRenderer.on(UPDATE_STATUS_CHANNEL, listener);
      return () => ipcRenderer.removeListener(UPDATE_STATUS_CHANNEL, listener);
    },
  };

  api.changelog = {
    onShow: (callback) => {
      const listener = () => {
        callback();
      };
      ipcRenderer.on(SHOW_CHANGELOG_CHANNEL, listener);
      return () => ipcRenderer.removeListener(SHOW_CHANGELOG_CHANNEL, listener);
    },
  };

  return api;
}

contextBridge.exposeInMainWorld('api', createApi());

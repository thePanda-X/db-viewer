import type { Connection } from '@/types/connection';
import type { Folder } from '@/types/folder';

export interface OpenFileOptions {
  filters?: Array<{ name: string; extensions: string[] }>;
}

export const api = {
  ...window.api,
  app: {
    version: (): Promise<string> => window.api.app.version(),
    checkForUpdates: (manual?: boolean): Promise<void> =>
      window.api.app.checkForUpdates(manual),
    downloadUpdate: (): Promise<void> => window.api.app.downloadUpdate(),
    installUpdate: (): Promise<void> => window.api.app.installUpdate(),
    getUpdaterStatus: () => window.api.app.getUpdaterStatus(),
  },
  connections: {
    list: (): Promise<Connection[]> =>
      window.api.connections.list() as Promise<Connection[]>,
    save: (connections: Connection[]): Promise<Connection[]> =>
      window.api.connections.save(connections) as Promise<Connection[]>,
  },
  folders: {
    list: (): Promise<Folder[]> =>
      window.api.folders.list() as Promise<Folder[]>,
    save: (folders: Folder[]): Promise<Folder[]> =>
      window.api.folders.save(folders) as Promise<Folder[]>,
  },
};

import type { Connection } from '@/types/connection';

export interface OpenFileOptions {
  filters?: Array<{ name: string; extensions: string[] }>;
}

export const api = {
  ...window.api,
  connections: {
    list: (): Promise<Connection[]> =>
      window.api.connections.list() as Promise<Connection[]>,
    save: (connections: Connection[]): Promise<Connection[]> =>
      window.api.connections.save(connections) as Promise<Connection[]>,
  },
};

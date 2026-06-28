import { create } from 'zustand';
import type { Connection, ConnectionType } from '@/types/connection';
import { api } from '@/lib/api';
import { newId } from '@/lib/id';
import { getConnectionTypeDef } from '@/data/connectionTypes';

interface ConnectionsState {
  connections: Connection[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  add: (
    type: ConnectionType,
    name: string,
    config: Connection['config'],
    folderId?: string,
  ) => Promise<Connection>;
  update: (
    id: string,
    patch: {
      name?: string;
      config?: Connection['config'];
      folderId?: string | null;
    },
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

async function persist(connections: Connection[]): Promise<Connection[]> {
  return api.connections.save(connections);
}

function disconnectConnection(conn: Connection): void {
  switch (conn.type) {
    case 'postgres':
      void api.postgres.disconnect({ connectionId: conn.id });
      break;
    case 'sqlite':
      void api.sqlite.disconnect({ connectionId: conn.id });
      break;
    case 'redis':
      void api.redis.disconnect({ connectionId: conn.id });
      break;
    case 'opensearch':
      void api.opensearch.disconnect({ connectionId: conn.id });
      break;
    case 'kafka':
      void api.kafka.disconnect({ connectionId: conn.id });
      break;
    case 'rabbitmq':
      void api.rabbitmq.disconnect({ connectionId: conn.id });
      break;
  }
}

export const useConnectionsStore = create<ConnectionsState>((set, get) => ({
  connections: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const connections = await api.connections.list();
      set({ connections, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  add: async (type, name, config, folderId) => {
    const now = new Date().toISOString();
    const conn = {
      id: newId(),
      type,
      name,
      config,
      ...(folderId ? { folderId } : null),
      createdAt: now,
      updatedAt: now,
    } as Connection;
    const next = [...get().connections, conn];
    const saved = await persist(next);
    set({ connections: saved });
    return conn;
  },

  update: async (id, patch) => {
    const previous = get().connections.find((c) => c.id === id);
    const next = get().connections.map((c) => {
      if (c.id !== id) return c;
      const merged = {
        ...c,
        ...(patch.name !== undefined ? { name: patch.name } : null),
        ...(patch.config !== undefined ? { config: patch.config } : null),
        ...(patch.folderId !== undefined
          ? { folderId: patch.folderId ?? undefined }
          : null),
        updatedAt: new Date().toISOString(),
      } as Connection;
      return merged;
    });
    const saved = await persist(next);
    set({ connections: saved });
    if (previous && patch.config !== undefined) {
      disconnectConnection(previous);
    }
  },

  remove: async (id) => {
    const previous = get().connections.find((c) => c.id === id);
    const next = get().connections.filter((c) => c.id !== id);
    const saved = await persist(next);
    set({ connections: saved });
    if (previous) disconnectConnection(previous);
  },
}));

export function getConnectionTypeLabel(id: ConnectionType): string {
  return getConnectionTypeDef(id).label;
}

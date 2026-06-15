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
  ) => Promise<Connection>;
  update: (
    id: string,
    patch: { name?: string; config?: Connection['config'] },
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

async function persist(connections: Connection[]): Promise<Connection[]> {
  return api.connections.save(connections);
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

  add: async (type, name, config) => {
    const now = new Date().toISOString();
    const conn = {
      id: newId(),
      type,
      name,
      config,
      createdAt: now,
      updatedAt: now,
    } as Connection;
    const next = [...get().connections, conn];
    const saved = await persist(next);
    set({ connections: saved });
    return conn;
  },

  update: async (id, patch) => {
    const next = get().connections.map((c) => {
      if (c.id !== id) return c;
      const merged = {
        ...c,
        ...(patch.name !== undefined ? { name: patch.name } : null),
        ...(patch.config !== undefined ? { config: patch.config } : null),
        updatedAt: new Date().toISOString(),
      } as Connection;
      return merged;
    });
    const saved = await persist(next);
    set({ connections: saved });
  },

  remove: async (id) => {
    const next = get().connections.filter((c) => c.id !== id);
    const saved = await persist(next);
    set({ connections: saved });
  },
}));

export function getConnectionTypeLabel(id: ConnectionType): string {
  return getConnectionTypeDef(id).label;
}

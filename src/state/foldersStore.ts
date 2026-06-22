import { create } from 'zustand';
import type { Folder } from '@/types/folder';
import { api } from '@/lib/api';
import { newId } from '@/lib/id';

interface FoldersState {
  folders: Folder[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  add: (name: string, color: string) => Promise<Folder>;
  update: (
    id: string,
    patch: { name?: string; color?: string },
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

async function persist(folders: Folder[]): Promise<Folder[]> {
  return api.folders.save(folders);
}

export const useFoldersStore = create<FoldersState>((set, get) => ({
  folders: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const folders = await api.folders.list();
      set({ folders, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  add: async (name, color) => {
    const now = new Date().toISOString();
    const folder: Folder = {
      id: newId(),
      name,
      color,
      createdAt: now,
      updatedAt: now,
    };
    const next = [...get().folders, folder];
    const saved = await persist(next);
    set({ folders: saved });
    return folder;
  },

  update: async (id, patch) => {
    const next = get().folders.map((f) => {
      if (f.id !== id) return f;
      return {
        ...f,
        ...(patch.name !== undefined ? { name: patch.name } : null),
        ...(patch.color !== undefined ? { color: patch.color } : null),
        updatedAt: new Date().toISOString(),
      };
    });
    const saved = await persist(next);
    set({ folders: saved });
  },

  remove: async (id) => {
    const next = get().folders.filter((f) => f.id !== id);
    const saved = await persist(next);
    set({ folders: saved });
  },
}));

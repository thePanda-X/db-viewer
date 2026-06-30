import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Folder } from '@/types/folder';

const list = vi.fn();
const save = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    folders: { list, save },
  },
}));

vi.mock('@/lib/id', () => ({
  newId: () => 'new-folder-id',
}));

const { useFoldersStore } = await import('./foldersStore');

const folderA: Folder = {
  id: 'folder-a',
  name: 'A',
  color: '#111111',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const folderB: Folder = {
  id: 'folder-b',
  name: 'B',
  color: '#222222',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function resetFoldersStore(): void {
  useFoldersStore.setState({
    folders: [],
    loading: false,
    error: null,
  });
}

describe('useFoldersStore', () => {
  beforeEach(() => {
    resetFoldersStore();
    list.mockReset();
    save.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
  });

  it('reorders folders and persists the new order', async () => {
    useFoldersStore.setState({ folders: [folderA, folderB] });
    save.mockImplementation(async (folders: Folder[]) => folders);

    await useFoldersStore.getState().reorder('folder-b', 'folder-a');

    expect(save).toHaveBeenCalledWith([
      {
        ...folderB,
        updatedAt: '2026-06-15T12:00:00.000Z',
      },
      folderA,
    ]);
    expect(
      useFoldersStore.getState().folders.map((folder) => folder.id),
    ).toEqual(['folder-b', 'folder-a']);
  });
});

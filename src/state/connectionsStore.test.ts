import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from '@/types/connection';

const list = vi.fn();
const save = vi.fn();
const sqliteDisconnect = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    connections: { list, save },
    postgres: { disconnect: vi.fn() },
    sqlite: { disconnect: sqliteDisconnect },
    redis: { disconnect: vi.fn() },
    opensearch: { disconnect: vi.fn() },
    kafka: { disconnect: vi.fn() },
    rabbitmq: { disconnect: vi.fn() },
  },
}));

vi.mock('@/lib/id', () => ({
  newId: () => 'new-connection-id',
}));

vi.mock('@/data/connectionTypes', () => ({
  getConnectionTypeDef: (id: string) => ({ label: `Label for ${id}` }),
}));

const { getConnectionTypeLabel, useConnectionsStore } =
  await import('./connectionsStore');

const existingConnection: Connection = {
  id: 'conn-1',
  type: 'sqlite',
  name: 'Local SQLite',
  config: { filePath: 'local.db' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function resetConnectionsStore(): void {
  useConnectionsStore.setState({
    connections: [],
    loading: false,
    error: null,
  });
}

describe('useConnectionsStore', () => {
  beforeEach(() => {
    resetConnectionsStore();
    list.mockReset();
    save.mockReset();
    sqliteDisconnect.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
  });

  it('loads connections from the api', async () => {
    list.mockResolvedValue([existingConnection]);

    await useConnectionsStore.getState().load();

    expect(list).toHaveBeenCalledOnce();
    expect(useConnectionsStore.getState()).toMatchObject({
      connections: [existingConnection],
      loading: false,
      error: null,
    });
  });

  it('stores load errors and clears loading', async () => {
    list.mockRejectedValue(new Error('read failed'));

    await useConnectionsStore.getState().load();

    expect(useConnectionsStore.getState()).toMatchObject({
      connections: [],
      loading: false,
      error: 'read failed',
    });
  });

  it('adds a connection and persists the full list', async () => {
    save.mockImplementation(async (connections: Connection[]) => connections);

    const added = await useConnectionsStore.getState().add('sqlite', 'New DB', {
      filePath: 'new.db',
    });

    expect(added).toEqual({
      id: 'new-connection-id',
      type: 'sqlite',
      name: 'New DB',
      config: { filePath: 'new.db' },
      createdAt: '2026-06-15T12:00:00.000Z',
      updatedAt: '2026-06-15T12:00:00.000Z',
    });
    expect(save).toHaveBeenCalledWith([added]);
    expect(useConnectionsStore.getState().connections).toEqual([added]);
  });

  it('updates an existing connection', async () => {
    useConnectionsStore.setState({ connections: [existingConnection] });
    save.mockImplementation(async (connections: Connection[]) => connections);

    await useConnectionsStore.getState().update('conn-1', {
      name: 'Updated SQLite',
      config: { filePath: 'updated.db' },
    });

    expect(save).toHaveBeenCalledWith([
      {
        ...existingConnection,
        name: 'Updated SQLite',
        config: { filePath: 'updated.db' },
        updatedAt: '2026-06-15T12:00:00.000Z',
      },
    ]);
    expect(useConnectionsStore.getState().connections[0]).toMatchObject({
      name: 'Updated SQLite',
      config: { filePath: 'updated.db' },
    });
    expect(sqliteDisconnect).toHaveBeenCalledWith({ connectionId: 'conn-1' });
  });

  it('removes a connection', async () => {
    useConnectionsStore.setState({ connections: [existingConnection] });
    save.mockResolvedValue([]);

    await useConnectionsStore.getState().remove('conn-1');

    expect(save).toHaveBeenCalledWith([]);
    expect(useConnectionsStore.getState().connections).toEqual([]);
    expect(sqliteDisconnect).toHaveBeenCalledWith({ connectionId: 'conn-1' });
  });

  it('returns connection type labels', () => {
    expect(getConnectionTypeLabel('postgres')).toBe('Label for postgres');
  });
});

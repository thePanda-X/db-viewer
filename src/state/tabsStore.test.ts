import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from '@/types/connection';
import { HOME_TAB_ID } from '@/types/tab';

vi.mock('@/data/connectionTypes', () => ({
  CONNECTION_TYPES: [
    { id: 'postgres' },
    { id: 'sqlite' },
    { id: 'opensearch' },
    { id: 'redis' },
    { id: 'kafka' },
    { id: 'rabbitmq' },
  ],
}));

const { useTabsStore } = await import('./tabsStore');

const postgresConnection: Connection = {
  id: 'conn-1',
  type: 'postgres',
  name: 'Local Postgres',
  config: {
    host: 'localhost',
    port: 5432,
    database: 'app',
    username: 'postgres',
    password: '',
    ssl: false,
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function resetTabsStore(): void {
  useTabsStore.setState({
    tabs: [{ id: HOME_TAB_ID, connectionId: HOME_TAB_ID, title: 'Connections' }],
    activeTabId: HOME_TAB_ID,
  });
}

describe('useTabsStore', () => {
  beforeEach(() => {
    resetTabsStore();
  });

  it('opens connection tabs once and activates existing tabs', () => {
    useTabsStore.getState().openConnection(postgresConnection);
    useTabsStore.getState().openHome();
    useTabsStore.getState().openConnection(postgresConnection);

    expect(useTabsStore.getState().tabs).toHaveLength(2);
    expect(useTabsStore.getState().activeTabId).toBe('conn-1');
    expect(useTabsStore.getState().tabs[1]).toMatchObject({
      id: 'conn-1',
      connectionId: 'conn-1',
      title: 'Local Postgres',
      type: 'postgres',
    });
  });

  it('opens related row tabs once with persisted view state', () => {
    const relatedRow = {
      database: 'app',
      schema: 'public',
      table: 'users',
      filterColumn: 'id',
      filterValue: 123,
      filterDisplay: '123',
    };

    useTabsStore.getState().openRelatedRow(postgresConnection, relatedRow);
    useTabsStore.getState().openHome();
    useTabsStore.getState().openRelatedRow(postgresConnection, relatedRow);

    expect(useTabsStore.getState().tabs).toHaveLength(2);
    expect(useTabsStore.getState().activeTabId).toBe(
      'conn-1::related::public.users::id=123',
    );
    expect(useTabsStore.getState().tabs[1].viewState).toEqual({
      kind: 'relatedRow',
      ...relatedRow,
    });
  });

  it('sets tab view state and clears legacy postgresView', () => {
    useTabsStore.getState().openConnection(postgresConnection);
    useTabsStore.setState({
      tabs: [
        useTabsStore.getState().tabs[0],
        { ...useTabsStore.getState().tabs[1], postgresView: { kind: 'default' } },
      ],
    });

    useTabsStore.getState().setTabViewState('conn-1', {
      kind: 'table',
      database: 'app',
      schema: 'public',
      table: 'users',
    });

    expect(useTabsStore.getState().tabs[1]).toMatchObject({
      viewState: {
        kind: 'table',
        database: 'app',
        schema: 'public',
        table: 'users',
      },
      postgresView: undefined,
    });
  });

  it('does not close home and falls back when closing the active tab', () => {
    useTabsStore.getState().closeTab(HOME_TAB_ID);
    expect(useTabsStore.getState().tabs).toHaveLength(1);

    useTabsStore.getState().openConnection(postgresConnection);
    useTabsStore.getState().closeTab('conn-1');

    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().activeTabId).toBe(HOME_TAB_ID);
  });

  it('closes all tabs for removed connections and keeps home', () => {
    useTabsStore.getState().openConnection(postgresConnection);
    useTabsStore.getState().openRelatedRow(postgresConnection, {
      database: 'app',
      schema: 'public',
      table: 'users',
      filterColumn: 'id',
      filterValue: 1,
      filterDisplay: '1',
    });

    useTabsStore.getState().closeTabsForConnections(['conn-1']);

    expect(useTabsStore.getState().tabs).toEqual([
      { id: HOME_TAB_ID, connectionId: HOME_TAB_ID, title: 'Connections' },
    ]);
    expect(useTabsStore.getState().activeTabId).toBe(HOME_TAB_ID);
  });

  it('syncs connection metadata into open tabs', () => {
    useTabsStore.getState().openConnection(postgresConnection);
    useTabsStore.getState().syncConnection({
      ...postgresConnection,
      name: 'Renamed',
      type: 'sqlite',
      config: { filePath: 'local.db' },
    });

    expect(useTabsStore.getState().tabs[1]).toMatchObject({
      title: 'Renamed',
      type: 'sqlite',
    });
  });
});

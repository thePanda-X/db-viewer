import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Connection, ConnectionType } from '@/types/connection'
import { HOME_TAB_ID, type PostgresTabView, type Tab, type TabId } from '@/types/tab'

interface OpenRelatedRowArgs {
  database: string
  schema: string
  table: string
  filterColumn: string
  filterValue: unknown
  filterDisplay: string
}

interface TabsState {
  tabs: Tab[]
  activeTabId: TabId
  openHome: () => void
  openConnection: (conn: Connection) => void
  openRelatedRow: (conn: Connection, args: OpenRelatedRowArgs) => void
  setPostgresView: (tabId: TabId, view: PostgresTabView) => void
  closeTab: (id: TabId) => void
  setActive: (id: TabId) => void
  /** Close any tab whose connectionId is in the given list */
  closeTabsForConnections: (ids: string[]) => void
  /** Update tab title/type for a connection that was edited */
  syncConnection: (conn: Connection) => void
}

function buildRelatedRowId(connectionId: string, args: OpenRelatedRowArgs): string {
  return `${connectionId}::related::${args.schema}.${args.table}::${args.filterColumn}=${String(
    args.filterValue,
  )}`
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: [{ id: HOME_TAB_ID, connectionId: HOME_TAB_ID, title: 'Connections' }],
      activeTabId: HOME_TAB_ID,

      openHome: () => {
        set({ activeTabId: HOME_TAB_ID })
      },

      openConnection: (conn) => {
        const { tabs } = get()
        const existing = tabs.find((t) => t.id === conn.id)
        if (existing) {
          set({ activeTabId: existing.id })
          return
        }
        const next: Tab = {
          id: conn.id,
          connectionId: conn.id,
          title: conn.name,
          type: conn.type as ConnectionType,
        }
        set({ tabs: [...tabs, next], activeTabId: conn.id })
      },

      openRelatedRow: (conn, args) => {
        const id = buildRelatedRowId(conn.id, args)
        const { tabs } = get()
        const existing = tabs.find((t) => t.id === id)
        if (existing) {
          set({ activeTabId: existing.id })
          return
        }
        const next: Tab = {
          id,
          connectionId: conn.id,
          title: args.table,
          type: 'postgres',
          postgresView: {
            kind: 'relatedRow',
            database: args.database,
            schema: args.schema,
            table: args.table,
            filterColumn: args.filterColumn,
            filterValue: args.filterValue,
            filterDisplay: args.filterDisplay,
          },
        }
        set({ tabs: [...tabs, next], activeTabId: id })
      },

      setPostgresView: (tabId, view) => {
        const { tabs } = get()
        const next = tabs.map((t) =>
          t.id === tabId ? { ...t, postgresView: view } : t,
        )
        set({ tabs: next })
      },

      closeTab: (id) => {
        if (id === HOME_TAB_ID) return
        const { tabs, activeTabId } = get()
        const next = tabs.filter((t) => t.id !== id)
        let nextActive = activeTabId
        if (activeTabId === id) {
          const closedIdx = tabs.findIndex((t) => t.id === id)
          const fallback = next[Math.min(closedIdx, next.length - 1)]
          nextActive = fallback?.id ?? HOME_TAB_ID
        }
        set({ tabs: next, activeTabId: nextActive })
      },

      setActive: (id) => {
        if (get().tabs.some((t) => t.id === id)) {
          set({ activeTabId: id })
        }
      },

      closeTabsForConnections: (ids) => {
        const idSet = new Set(ids)
        const { tabs, activeTabId } = get()
        const next = tabs.filter((t) => t.id === HOME_TAB_ID || !idSet.has(t.connectionId))
        if (next.length === tabs.length) return
        let nextActive = activeTabId
        if (idSet.has(activeTabId)) {
          const fallback = next[next.length - 1]
          nextActive = fallback?.id ?? HOME_TAB_ID
        }
        set({ tabs: next, activeTabId: nextActive })
      },

      syncConnection: (conn) => {
        const { tabs } = get()
        const next = tabs.map((t) =>
          t.id === conn.id
            ? { ...t, title: conn.name, type: conn.type as ConnectionType }
            : t,
        )
        set({ tabs: next })
      },
    }),
    {
      name: 'db-vwr:tabs',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ tabs: state.tabs, activeTabId: state.activeTabId }),
    },
  ),
)

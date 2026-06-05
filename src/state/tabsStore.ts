import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Connection, ConnectionType } from '@/types/connection'
import { HOME_TAB_ID, type Tab, type TabId } from '@/types/tab'

interface TabsState {
  tabs: Tab[]
  activeTabId: TabId
  openHome: () => void
  openConnection: (conn: Connection) => void
  closeTab: (id: TabId) => void
  setActive: (id: TabId) => void
  /** Close any tab whose connectionId is in the given list */
  closeTabsForConnections: (ids: string[]) => void
  /** Update tab title/type for a connection that was edited */
  syncConnection: (conn: Connection) => void
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

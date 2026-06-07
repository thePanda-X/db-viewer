import { useTabsStore } from '@/state/tabsStore'
import { useConnectionsStore } from '@/state/connectionsStore'
import { HomeTab } from '@/components/home/HomeTab'
import { ConnectionTab } from '@/components/connection-tab/ConnectionTab'
import { TabNotFound } from '@/components/connection-tab/TabNotFound'
import { HOME_TAB_ID } from '@/types/tab'

interface TabContentProps {
  onCreateClick?: () => void
}

export function TabContent({ onCreateClick }: TabContentProps) {
  const activeTabId = useTabsStore((s) => s.activeTabId)
  const tabs = useTabsStore((s) => s.tabs)
  const connections = useConnectionsStore((s) => s.connections)

  const tab = tabs.find((t) => t.id === activeTabId)

  if (!tab || tab.id === HOME_TAB_ID) {
    return <HomeTab {...(onCreateClick ? { onCreateClick } : {})} />
  }

  const conn = connections.find((c) => c.id === tab.connectionId)
  if (!conn) {
    return <TabNotFound tabId={tab.id} />
  }

  return <ConnectionTab connection={conn} tab={tab} />
}

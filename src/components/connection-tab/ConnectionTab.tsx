import type { Connection } from '@/types/connection'
import type { Tab } from '@/types/tab'
import { getConnectionTypeDef } from '@/data/connectionTypes'

interface ConnectionTabProps {
  connection: Connection
  tab: Tab
}

export function ConnectionTab({ connection, tab }: ConnectionTabProps) {
  const TabComponent = getConnectionTypeDef(connection.type).TabComponent
  return <TabComponent connection={connection} tab={tab} />
}

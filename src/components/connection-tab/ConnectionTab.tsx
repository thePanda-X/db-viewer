import type { Connection } from '@/types/connection'
import type { Tab } from '@/types/tab'
import { PostgresTab } from './postgres/PostgresTab'
import { SqliteTab } from './sqlite/SqliteTab'
import { RedisTab } from './redis/RedisTab'
import { OpenSearchTab } from './opensearch/OpenSearchTab'

interface ConnectionTabProps {
  connection: Connection
  tab: Tab
}

export function ConnectionTab({ connection, tab }: ConnectionTabProps) {
  if (connection.type === 'postgres') {
    return <PostgresTab connection={connection} tab={tab} />
  }

  if (connection.type === 'sqlite') {
    return <SqliteTab connection={connection} tab={tab} />
  }

  if (connection.type === 'redis') {
    return <RedisTab connection={connection} />
  }

  if (connection.type === 'opensearch') {
    return <OpenSearchTab connection={connection} />
  }

  return null
}

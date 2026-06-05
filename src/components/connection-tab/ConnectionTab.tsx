import { Database, FileText, Search, KeyRound, DatabaseBackup, Table2, Code2 } from 'lucide-react'
import type { Connection } from '@/types/connection'
import { getConnectionTypeDef } from '@/data/connectionTypes'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { PostgresTab } from './postgres/PostgresTab'

interface ConnectionTabProps {
  connection: Connection
}

const STUB_SECTIONS = [
  { icon: DatabaseBackup, label: 'Schema', description: 'Browse databases, schemas, and structure' },
  { icon: Table2, label: 'Tables', description: 'Inspect tables, indexes, and views' },
  { icon: Code2, label: 'Query', description: 'Run queries and view results' },
] as const

export function ConnectionTab({ connection }: ConnectionTabProps) {
  if (connection.type === 'postgres') {
    return <PostgresTab connection={connection} />
  }

  const def = getConnectionTypeDef(connection.type)
  const Icon = def.icon
  const subtitle = def.subtitle(connection.config as never)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
            <Icon className={`h-6 w-6 ${def.brandColor}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {connection.name}
              </h1>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                {def.label}
              </Badge>
            </div>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground" title={subtitle}>
              {subtitle}
            </p>
          </div>
        </div>

        <Separator />

        <div className="mt-8">
          <div className="mb-4">
            <h2 className="text-sm font-medium">Workspace</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The data view for this connection type is coming soon. These sections will live here
              once connection logic is wired up.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {STUB_SECTIONS.map(({ icon: SectionIcon, label, description }) => (
              <Card
                key={label}
                className="flex flex-col gap-2 p-4 opacity-60"
                aria-disabled
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                  <SectionIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold tracking-tight">{label}</h3>
                <p className="text-xs text-muted-foreground">{description}</p>
              </Card>
            ))}
          </div>
        </div>

        <div className="mt-10 flex items-center gap-2 text-xs text-muted-foreground">
          {connection.type === 'sqlite' ? (
            <FileText className="h-3.5 w-3.5" />
          ) : connection.type === 'opensearch' ? (
            <Search className="h-3.5 w-3.5" />
          ) : connection.type === 'redis' ? (
            <KeyRound className="h-3.5 w-3.5" />
          ) : (
            <Database className="h-3.5 w-3.5" />
          )}
          <span>Connection logic pending implementation.</span>
        </div>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Database, Loader2, RefreshCw, Table2, Eye, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DatabaseInfo, TableInfo } from '@/types/postgres'

interface PostgresSidebarProps {
  connectionId: string
  config: import('@/types/connection').PostgresConfig
  selectedDatabase: string
  onDatabaseChange: (database: string) => void
  selectedTable: { schema: string; table: string } | null
  onSelectTable: (table: { schema: string; table: string }) => void
  selectedSchema: string
  onSchemaChange: (schema: string) => void
}

function isError(value: unknown): value is { error: string } {
  return typeof value === 'object' && value !== null && 'error' in (value as Record<string, unknown>)
}

export function PostgresSidebar({
  connectionId,
  config,
  selectedDatabase,
  onDatabaseChange,
  selectedTable,
  onSelectTable,
  selectedSchema,
  onSchemaChange,
}: PostgresSidebarProps) {
  const [databases, setDatabases] = useState<DatabaseInfo[] | null>(null)
  const [databasesError, setDatabasesError] = useState<string | null>(null)
  const [tables, setTables] = useState<TableInfo[] | null>(null)
  const [tablesError, setTablesError] = useState<string | null>(null)
  const [loadingDatabases, setLoadingDatabases] = useState(false)
  const [loadingTables, setLoadingTables] = useState(false)

  const fetchDatabases = useCallback(async () => {
    setLoadingDatabases(true)
    setDatabasesError(null)
    try {
      const result = await api.postgres.listDatabases({ connectionId, config })
      if (isError(result)) {
        setDatabasesError(result.error)
        setDatabases([])
      } else {
        setDatabases(result)
      }
    } catch (err) {
      setDatabasesError(err instanceof Error ? err.message : String(err))
      setDatabases([])
    } finally {
      setLoadingDatabases(false)
    }
  }, [connectionId, config])

  const fetchTables = useCallback(
    async (database: string) => {
      setLoadingTables(true)
      setTablesError(null)
      try {
        const result = await api.postgres.listTables({ connectionId, config, database })
        if (isError(result)) {
          setTablesError(result.error)
          setTables([])
        } else {
          setTables(result)
        }
      } catch (err) {
        setTablesError(err instanceof Error ? err.message : String(err))
        setTables([])
      } finally {
        setLoadingTables(false)
      }
    },
    [connectionId, config],
  )

  useEffect(() => {
    void fetchDatabases()
  }, [fetchDatabases])

  useEffect(() => {
    if (selectedDatabase) {
      void fetchTables(selectedDatabase)
    } else {
      setTables([])
    }
  }, [selectedDatabase, fetchTables])

  const schemas = useMemo(() => {
    if (!tables) return []
    const set = new Set<string>()
    for (const t of tables) set.add(t.schema)
    return Array.from(set).sort()
  }, [tables])

  const filteredTables = useMemo(() => {
    if (!tables) return []
    return tables.filter((t) => t.schema === selectedSchema)
  }, [tables, selectedSchema])

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-muted/20">
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <span className="text-xs font-semibold tracking-tight">Explorer</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => void fetchDatabases()}
          disabled={loadingDatabases}
          title="Refresh databases"
        >
          <RefreshCw className={cn('h-3 w-3', loadingDatabases && 'animate-spin')} />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 p-3">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Database className="h-3 w-3" />
              <span>Database</span>
            </div>
            {databasesError ? (
              <div className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="break-words">{databasesError}</span>
              </div>
            ) : (
              <Select value={selectedDatabase} onValueChange={onDatabaseChange} disabled={loadingDatabases}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select database" />
                </SelectTrigger>
                <SelectContent>
                  {databases?.map((db) => (
                    <SelectItem key={db.name} value={db.name} className="text-xs">
                      {db.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Separator />

          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <ChevronRight className="h-3 w-3" />
              <span>Schema</span>
            </div>
            {schemas.length > 1 ? (
              <Select value={selectedSchema} onValueChange={onSchemaChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {schemas.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs">
                {selectedSchema}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Table2 className="h-3 w-3" />
                <span>Tables</span>
              </div>
              {loadingTables && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>

            {tablesError ? (
              <div className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="break-words">{tablesError}</span>
              </div>
            ) : filteredTables.length === 0 && !loadingTables ? (
              <div className="rounded-md border border-dashed border-border p-2 text-center text-[11px] text-muted-foreground">
                No tables in <span className="font-mono">{selectedSchema}</span>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {filteredTables.map((t) => {
                  const active =
                    selectedTable?.schema === t.schema && selectedTable?.table === t.name
                  return (
                    <li key={`${t.schema}.${t.name}`}>
                      <button
                        type="button"
                        onClick={() => onSelectTable({ schema: t.schema, table: t.name })}
                        className={cn(
                          'flex w-full items-center gap-1.5 rounded-sm px-1.5 py-1 text-left text-xs transition-colors',
                          'hover:bg-muted',
                          active && 'bg-primary/10 text-primary',
                        )}
                      >
                        {t.type === 'view' ? (
                          <Eye className="h-3 w-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <Table2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate font-mono">{t.name}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}

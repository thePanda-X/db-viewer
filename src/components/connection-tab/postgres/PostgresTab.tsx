import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Database, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useActiveRefresh } from '@/lib/hotkeys'
import { toast } from '@/state/toastStore'
import { useTabsStore } from '@/state/tabsStore'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ResizableSidebar } from '@/components/ui/resizable-sidebar'
import { PostgresSidebar, type RefreshRefHandle } from './PostgresSidebar'
import { TableView, type TableViewFilter } from './TableView'
import { QueryBar } from './QueryBar'
import { QueryResultView } from './QueryResultView'
import type { ForeignKey, QueryResult } from '@/types/postgres'
import { validateForeignKeyValue } from '@/types/postgres'
import type { Connection, PostgresConfig } from '@/types/connection'
import type { PostgresTabView, Tab } from '@/types/tab'

interface PostgresTabProps {
  connection: Connection
  tab: Tab
}

const DEFAULT_SCHEMA = 'public'

export function PostgresTab({ connection, tab }: PostgresTabProps) {
  const config = connection.config as PostgresConfig
  const view: PostgresTabView = useMemo(
    () => tab.postgresView ?? { kind: 'default' },
    [tab.postgresView],
  )
  const isPinned = view.kind === 'relatedRow'

  const [database, setDatabase] = useState<string>(config.database)
  const [schema, setSchema] = useState<string>(DEFAULT_SCHEMA)
  const [selectedTable, setSelectedTable] = useState<{ schema: string; table: string } | null>(null)
  const [pendingChanges, setPendingChanges] = useState(0)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [customResult, setCustomResult] = useState<QueryResult | null>(null)
  const [customError, setCustomError] = useState<string | null>(null)
  const [customRunning, setCustomRunning] = useState(false)
  const [lastCustomSql, setLastCustomSql] = useState<string | null>(null)
  const runSeq = useRef(0)
  const hasPendingChanges = pendingChanges > 0
  const showCustomResults = customResult !== null || customError !== null || customRunning
  const currentConfig = useMemo(() => ({ ...config, database }), [config, database])
  const setPostgresView = useTabsStore((s) => s.setPostgresView)
  const openRelatedRow = useTabsStore((s) => s.openRelatedRow)

  const sidebarRefreshRef = useRef<RefreshRefHandle>({ current: null })
  const tableRefreshRef = useRef<RefreshRefHandle>({ current: null })
  const queryRefreshRef = useRef<RefreshRefHandle>({ current: null })

  // Sync local state from the tab view when the tab or its view changes.
  useEffect(() => {
    if (view.kind === 'relatedRow') {
      setDatabase(view.database)
      setSchema(view.schema)
      setSelectedTable({ schema: view.schema, table: view.table })
    } else if (view.kind === 'table') {
      setDatabase(view.database)
      setSchema(view.schema)
      setSelectedTable({ schema: view.schema, table: view.table })
    } else {
      setSelectedTable(null)
    }
    // We intentionally only re-run this when the tab or the structural view
    // changes — not on every local state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id, view.kind, view.kind === 'relatedRow' ? view.database : null])

  // Mirror local state to the tab view for sidebar-driven changes.
  useEffect(() => {
    if (isPinned) return
    if (selectedTable) {
      setPostgresView(tab.id, {
        kind: 'table',
        database,
        schema,
        table: selectedTable.table,
      })
    } else {
      setPostgresView(tab.id, { kind: 'default' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPinned, database, schema, selectedTable?.schema, selectedTable?.table])

  const refreshAll = useCallback(() => {
    if (!isPinned) sidebarRefreshRef.current.current?.()
    tableRefreshRef.current.current?.()
    if (!isPinned && lastCustomSql) queryRefreshRef.current.current?.()
    toast({
      message: `Refreshed ${connection.name}`,
      detail: isPinned
        ? `related view of ${schema}.${view.kind === 'relatedRow' ? view.table : ''}`
        : [
            selectedTable ? `table ${selectedTable.schema}.${selectedTable.table}` : 'sidebar',
            lastCustomSql ? 'last query' : null,
          ]
            .filter(Boolean)
            .join(' · '),
    })
  }, [connection.name, isPinned, schema, view, selectedTable, lastCustomSql])

  useActiveRefresh(refreshAll, connection.name)

  const prevDatabase = useRef(database)
  useEffect(() => {
    if (prevDatabase.current !== database) {
      void api.postgres.disconnect({ connectionId: connection.id, database: prevDatabase.current })
      prevDatabase.current = database
      runSeq.current++
      if (schema !== DEFAULT_SCHEMA && database !== config.database) {
        setSchema(DEFAULT_SCHEMA)
      }
      setSelectedTable(null)
      setCustomResult(null)
      setCustomError(null)
      setCustomRunning(false)
    }
  }, [database, connection.id, config.database, schema])

  useEffect(() => {
    return () => {
      void api.postgres.disconnect({ connectionId: connection.id, database })
    }
  }, [connection.id, database])

  const prevSelectedTable = useRef(selectedTable)
  useEffect(() => {
    if (prevSelectedTable.current !== selectedTable) {
      prevSelectedTable.current = selectedTable
      setCustomResult(null)
      setCustomError(null)
      setCustomRunning(false)
    }
  }, [selectedTable])

  const guarded = useCallback(
    (action: () => void) => {
      if (hasPendingChanges) {
        setPendingAction(() => action)
      } else {
        action()
      }
    },
    [hasPendingChanges],
  )

  const handleSelectTable = useCallback(
    (t: { schema: string; table: string }) => {
      guarded(() => setSelectedTable(t))
    },
    [guarded],
  )

  const handleDatabaseChange = useCallback(
    (db: string) => {
      guarded(() => setDatabase(db))
    },
    [guarded],
  )

  const handleSchemaChange = useCallback(
    (s: string) => {
      guarded(() => setSchema(s))
    },
    [guarded],
  )

  const handlePendingChangesChange = useCallback((count: number) => {
    setPendingChanges(count)
  }, [])

  const handleNavigateRelation = useCallback(
    async (fk: ForeignKey, value: unknown) => {
      const display = value === null || value === undefined ? 'NULL' : String(value)
      const directError = validateForeignKeyValue(fk.referencedUdtName, value)
      let targetColumn = fk.referencedColumn
      let usedFallback = false

      if (directError) {
        // The FK's referenced column doesn't accept this value. This usually
        // means the FK was defined against a column of the wrong type (a real
        // schema bug). As a best-effort recovery, try the target table's
        // primary key — the user almost certainly wants the row whose PK
        // matches the value.
        const fallback = await tryPkFallback({
          connectionId: connection.id,
          config,
          database,
          schema: fk.referencedSchema,
          table: fk.referencedTable,
          value,
        })
        if (!fallback) {
          toast({
            message: `Can't open ${fk.referencedSchema}.${fk.referencedTable}`,
            detail: `FK value ${display} is incompatible with target column "${fk.referencedColumn}" (${fk.referencedUdtName}): ${directError}.`,
            variant: 'error',
          })
          return
        }
        targetColumn = fallback.column
        usedFallback = true
      }

      const filterDisplay = usedFallback
        ? `${targetColumn} = ${display} · FK fallback`
        : `${fk.referencedColumn} = ${display}`

      guarded(() => {
        openRelatedRow(connection, {
          database,
          schema: fk.referencedSchema,
          table: fk.referencedTable,
          filterColumn: targetColumn,
          filterValue: value,
          filterDisplay,
        })
      })
      if (usedFallback) {
        toast({
          message: `Filtered by primary key`,
          detail: `The foreign key points to "${fk.referencedColumn}" (${fk.referencedUdtName}), but the value is a ${typeof value}. Filtered by the target table's primary key "${targetColumn}" instead.`,
          variant: 'warning',
          durationMs: 6000,
        })
      }
    },
    [config, connection, database, guarded, openRelatedRow],
  )

  const handleNavigateAdHoc = useCallback(
    (args: {
      referencedSchema: string
      referencedTable: string
      referencedColumn: string
      value: unknown
      display: string
    }) => {
      guarded(() => {
        openRelatedRow(connection, {
          database,
          schema: args.referencedSchema,
          table: args.referencedTable,
          filterColumn: args.referencedColumn,
          filterValue: args.value,
          filterDisplay: `${args.referencedTable}.${args.referencedColumn} = ${args.display}`,
        })
      })
    },
    [connection, database, guarded, openRelatedRow],
  )

  const handleClearFilter = useCallback(() => {
    if (view.kind !== 'relatedRow') return
    setPostgresView(tab.id, {
      kind: 'table',
      database: view.database,
      schema: view.schema,
      table: view.table,
    })
  }, [setPostgresView, tab.id, view])

  const handleBackToExplorer = useCallback(() => {
    setPostgresView(tab.id, { kind: 'default' })
  }, [setPostgresView, tab.id])

  const confirmPendingAction = () => {
    if (pendingAction) {
      const fn = pendingAction
      setPendingAction(null)
      fn()
    }
  }

  const executeRun = useCallback(
    async (sql: string) => {
      const seq = ++runSeq.current
      setCustomRunning(true)
      setCustomError(null)
      setCustomResult(null)
      try {
        const res = await api.postgres.readOnlyQuery({
          connectionId: connection.id,
          config: currentConfig,
          request: { sql },
        })
        if (seq !== runSeq.current) return
        if (res.ok) {
          setCustomResult(res.result)
        } else {
          setCustomError(res.error)
        }
      } catch (err) {
        if (seq !== runSeq.current) return
        setCustomError(err instanceof Error ? err.message : String(err))
      } finally {
        if (seq === runSeq.current) setCustomRunning(false)
      }
    },
    [connection.id, currentConfig],
  )

  const runCustomQuery = useCallback(
    (sql: string) => {
      setLastCustomSql(sql)
      void executeRun(sql)
    },
    [executeRun],
  )

  const clearCustomResult = useCallback(() => {
    runSeq.current++
    setCustomResult(null)
    setCustomError(null)
    setCustomRunning(false)
  }, [])

  const headerTable = isPinned
    ? view.kind === 'relatedRow'
      ? { schema: view.schema, table: view.table }
      : null
    : selectedTable

  const activeTableViewFilter: TableViewFilter | undefined =
    view.kind === 'relatedRow'
      ? {
          column: view.filterColumn,
          value: view.filterValue,
          display: view.filterDisplay,
        }
      : undefined

  return (
    <div className="flex h-full overflow-hidden">
      {!isPinned && (
        <ResizableSidebar
          defaultWidth={256}
          minWidth={180}
          maxWidth={600}
          storageKey="postgres-sidebar-width"
        >
          <PostgresSidebar
            connectionId={connection.id}
            config={config}
            selectedDatabase={database}
            onDatabaseChange={handleDatabaseChange}
            selectedTable={selectedTable}
            onSelectTable={handleSelectTable}
            selectedSchema={schema}
            onSchemaChange={handleSchemaChange}
            refreshRef={sidebarRefreshRef.current}
          />
        </ResizableSidebar>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-9 shrink-0 items-center gap-3 border-b border-border bg-background px-3 text-xs">
          <Database className="h-3.5 w-3.5 text-sky-500" />
          <span className="font-semibold tracking-tight">{connection.name}</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
            PostgreSQL
          </Badge>
          <Separator orientation="vertical" className="h-3" />
          <span className="font-mono text-[11px] text-muted-foreground">{database}</span>
          {headerTable && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="font-mono text-[11px]">{headerTable.schema}</span>
              <span className="text-muted-foreground">.</span>
              <span className="font-mono text-[11px] font-semibold">{headerTable.table}</span>
            </>
          )}
          {isPinned && (
            <Badge
              variant="outline"
              className="border-sky-500/40 bg-sky-500/10 px-1.5 py-0 text-[10px] font-normal text-sky-700 dark:text-sky-300"
              title="This tab was opened from a foreign-key link"
            >
              Related row
            </Badge>
          )}
          {isPinned && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-1 h-6 px-2 text-[11px] text-muted-foreground"
              onClick={handleBackToExplorer}
              title="Open this table in the sidebar"
            >
              <ArrowLeft className="mr-1 h-3 w-3" />
              Open in sidebar
            </Button>
          )}
          {hasPendingChanges && (
            <Badge
              variant="outline"
              className="ml-auto border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            >
              {pendingChanges} unsaved change{pendingChanges === 1 ? '' : 's'}
            </Badge>
          )}
        </header>

        <div className="relative min-h-0 flex-1">
          {headerTable && (
            <div
              className={cn(
                'absolute inset-0',
                showCustomResults && 'invisible pointer-events-none',
              )}
            >
              <TableView
                connectionId={connection.id}
                config={config}
                database={database}
                schema={headerTable.schema}
                table={headerTable.table}
                {...(activeTableViewFilter ? { filter: activeTableViewFilter } : {})}
                {...(activeTableViewFilter ? { onClearFilter: handleClearFilter } : {})}
                onNavigateRelation={handleNavigateRelation}
                onPendingChangesChange={handlePendingChangesChange}
                onConfirmNavigationRequest={guarded}
                refreshRef={tableRefreshRef.current}
              />
            </div>
          )}
          {!isPinned && showCustomResults && (
            <div className="absolute inset-0">
              <QueryResultView
                result={customResult}
                error={customError}
                running={customRunning}
                onClose={clearCustomResult}
                {...(lastCustomSql
                  ? { onRerun: () => void executeRun(lastCustomSql) }
                  : {})}
                refreshRef={queryRefreshRef.current}
                connectionId={connection.id}
                config={config}
                database={database}
                onNavigateRelation={handleNavigateAdHoc}
              />
            </div>
          )}
          {!headerTable && !showCustomResults && (
            <div className="absolute inset-0">
              <EmptyState database={database} />
            </div>
          )}
        </div>

        {!isPinned && (
          <div className="h-44 shrink-0 border-t border-border">
            <QueryBar database={database} running={customRunning} onRun={runCustomQuery} />
          </div>
        )}
      </div>

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && setPendingAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have {pendingChanges} unsaved change{pendingChanges === 1 ? '' : 's'} on the
              current page. Continuing will discard {pendingChanges === 1 ? 'it' : 'them'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay here</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPendingAction}>Discard & continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function EmptyState({ database }: { database: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-2 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
          <Loader2 className="h-4 w-4 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold">Select a table</h3>
        <p className="text-xs text-muted-foreground">
          Pick a table from the sidebar to browse rows, or write a custom query below. Currently
          browsing <span className="font-mono">{database}</span>.
        </p>
      </div>
    </div>
  )
}

interface TryPkFallbackArgs {
  connectionId: string
  config: PostgresConfig
  database: string
  schema: string
  table: string
  value: unknown
}

interface PkFallbackResult {
  column: string
  udtName: string
}

/**
 * Best-effort fallback when an FK points at a column whose type doesn't accept
 * the value: fetch the target table's meta and return its single-column
 * primary key if the value's type matches that PK column. Returns null when
 * there's no useful single-column PK or the value still doesn't fit.
 */
async function tryPkFallback(args: TryPkFallbackArgs): Promise<PkFallbackResult | null> {
  if (args.value === null || args.value === undefined) return null
  const result = await api.postgres.getTableMeta({
    connectionId: args.connectionId,
    config: args.config,
    database: args.database,
    schema: args.schema,
    table: args.table,
  })
  if (!result.ok) return null
  const pk = result.meta.primaryKey
  if (!pk || pk.length !== 1) return null
  const pkColumn = pk[0]
  const pkMeta = result.meta.columns.find((c) => c.name === pkColumn)
  if (!pkMeta) return null
  if (validateForeignKeyValue(pkMeta.udtName, args.value) !== null) return null
  return { column: pkColumn, udtName: pkMeta.udtName }
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Database, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import { PostgresSidebar } from './PostgresSidebar'
import { TableView } from './TableView'
import { QueryBar } from './QueryBar'
import { QueryResultView } from './QueryResultView'
import type { QueryResult } from '@/types/postgres'
import type { Connection, PostgresConfig } from '@/types/connection'

interface PostgresTabProps {
  connection: Connection
}

const DEFAULT_SCHEMA = 'public'

export function PostgresTab({ connection }: PostgresTabProps) {
  const config = connection.config as PostgresConfig
  const [database, setDatabase] = useState<string>(config.database)
  const [schema, setSchema] = useState<string>(DEFAULT_SCHEMA)
  const [selectedTable, setSelectedTable] = useState<{ schema: string; table: string } | null>(null)
  const [pendingChanges, setPendingChanges] = useState(0)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [customResult, setCustomResult] = useState<QueryResult | null>(null)
  const [customError, setCustomError] = useState<string | null>(null)
  const [customRunning, setCustomRunning] = useState(false)
  const runSeq = useRef(0)
  const hasPendingChanges = pendingChanges > 0
  const showCustomResults = customResult !== null || customError !== null || customRunning
  const currentConfig = useMemo(() => ({ ...config, database }), [config, database])

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

  return (
    <div className="flex h-full overflow-hidden">
      <PostgresSidebar
        connectionId={connection.id}
        config={config}
        selectedDatabase={database}
        onDatabaseChange={handleDatabaseChange}
        selectedTable={selectedTable}
        onSelectTable={handleSelectTable}
        selectedSchema={schema}
        onSchemaChange={handleSchemaChange}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-9 shrink-0 items-center gap-3 border-b border-border bg-background px-3 text-xs">
          <Database className="h-3.5 w-3.5 text-sky-500" />
          <span className="font-semibold tracking-tight">{connection.name}</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
            PostgreSQL
          </Badge>
          <Separator orientation="vertical" className="h-3" />
          <span className="font-mono text-[11px] text-muted-foreground">{database}</span>
          {selectedTable && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="font-mono text-[11px]">{selectedTable.schema}</span>
              <span className="text-muted-foreground">.</span>
              <span className="font-mono text-[11px] font-semibold">{selectedTable.table}</span>
            </>
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
          {selectedTable && (
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
                schema={selectedTable.schema}
                table={selectedTable.table}
                onPendingChangesChange={handlePendingChangesChange}
                onConfirmNavigationRequest={guarded}
              />
            </div>
          )}
          {showCustomResults && (
            <div className="absolute inset-0">
              <QueryResultView
                result={customResult}
                error={customError}
                running={customRunning}
                onClose={clearCustomResult}
              />
            </div>
          )}
          {!selectedTable && !showCustomResults && (
            <div className="absolute inset-0">
              <EmptyState database={database} />
            </div>
          )}
        </div>

        <div className="h-44 shrink-0 border-t border-border">
          <QueryBar database={database} running={customRunning} onRun={runCustomQuery} />
        </div>
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

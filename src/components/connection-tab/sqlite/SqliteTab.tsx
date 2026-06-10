import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useActiveRefresh } from '@/lib/hotkeys'
import { toast } from '@/state/toastStore'
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
import { SqliteSidebar, type RefreshRefHandle } from './SqliteSidebar'
import { SqliteTableView } from './SqliteTableView'
import { QueryBar } from '../postgres/QueryBar'
import { QueryResultView } from '../postgres/QueryResultView'
import type { QueryResult as PostgresQueryResult, PostgresConfig } from '@/types/postgres'
import type { QueryResult } from '@/types/sqlite'
import type { Connection, SqliteConfig } from '@/types/connection'
import type { Tab } from '@/types/tab'

interface SqliteTabProps {
  connection: Connection
  tab: Tab
}

export function SqliteTab({ connection }: SqliteTabProps) {
  const config = connection.config as SqliteConfig
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [pendingChanges, setPendingChanges] = useState(0)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [customResult, setCustomResult] = useState<QueryResult | null>(null)
  const [customError, setCustomError] = useState<string | null>(null)
  const [customRunning, setCustomRunning] = useState(false)
  const [lastCustomSql, setLastCustomSql] = useState<string | null>(null)
  const runSeq = useRef(0)
  const hasPendingChanges = pendingChanges > 0
  const showCustomResults = customResult !== null || customError !== null || customRunning

  const sidebarRefreshRef = useRef<RefreshRefHandle>({ current: null })
  const tableRefreshRef = useRef<RefreshRefHandle>({ current: null })
  const queryRefreshRef = useRef<RefreshRefHandle>({ current: null })

  const refreshAll = useCallback(() => {
    sidebarRefreshRef.current.current?.()
    tableRefreshRef.current.current?.()
    if (lastCustomSql) queryRefreshRef.current.current?.()
    toast({
      message: `Refreshed ${connection.name}`,
      detail: [
        selectedTable ? `table ${selectedTable}` : 'sidebar',
        lastCustomSql ? 'last query' : null,
      ]
        .filter(Boolean)
        .join(' · '),
    })
  }, [connection.name, selectedTable, lastCustomSql])

  useActiveRefresh(refreshAll, connection.name)

  useEffect(() => {
    return () => {
      void api.sqlite.disconnect({ connectionId: connection.id })
    }
  }, [connection.id])

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
    (table: string) => {
      guarded(() => setSelectedTable(table))
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
        const res = await api.sqlite.readOnlyQuery({
          connectionId: connection.id,
          filePath: config.filePath,
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
    [connection.id, config.filePath],
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

  return (
    <div className="flex h-full overflow-hidden">
      <ResizableSidebar
        defaultWidth={256}
        minWidth={180}
        maxWidth={600}
        storageKey="sqlite-sidebar-width"
      >
        <SqliteSidebar
          connectionId={connection.id}
          filePath={config.filePath}
          selectedTable={selectedTable}
          onSelectTable={handleSelectTable}
          refreshRef={sidebarRefreshRef.current}
        />
      </ResizableSidebar>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-9 shrink-0 items-center gap-3 border-b border-border bg-background px-3 text-xs">
          <FileText className="h-3.5 w-3.5 text-amber-500" />
          <span className="font-semibold tracking-tight">{connection.name}</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
            SQLite
          </Badge>
          <Separator orientation="vertical" className="h-3" />
          <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[300px]" title={config.filePath}>
            {config.filePath}
          </span>
          {selectedTable && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="font-mono text-[11px] font-semibold">{selectedTable}</span>
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
              <SqliteTableView
                connectionId={connection.id}
                config={config}
                table={selectedTable}
                onPendingChangesChange={handlePendingChangesChange}
                onConfirmNavigationRequest={guarded}
                refreshRef={tableRefreshRef.current}
              />
            </div>
          )}
          {showCustomResults && (
            <div className="absolute inset-0">
              <QueryResultView
                result={customResult as unknown as PostgresQueryResult}
                error={customError}
                running={customRunning}
                onClose={clearCustomResult}
                {...(lastCustomSql
                  ? { onRerun: () => void executeRun(lastCustomSql) }
                  : {})}
                refreshRef={queryRefreshRef.current}
                connectionId={connection.id}
                config={config as unknown as PostgresConfig}
                database="main"
              />
            </div>
          )}
          {!selectedTable && !showCustomResults && (
            <div className="absolute inset-0">
              <EmptyState />
            </div>
          )}
        </div>

        <div className="h-44 shrink-0 border-t border-border">
          <QueryBar database="main" running={customRunning} onRun={runCustomQuery} />
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

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-2 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
          <Loader2 className="h-4 w-4 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold">Select a table</h3>
        <p className="text-xs text-muted-foreground">
          Pick a table from the sidebar to browse rows, or write a custom query below.
        </p>
      </div>
    </div>
  )
}

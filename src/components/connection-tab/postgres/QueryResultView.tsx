import { AlertCircle, Link, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import type { PostgresConfig } from '@/types/connection'
import type { QueryResult, TableInfo } from '@/types/postgres'
import type { RefreshRefHandle } from './PostgresSidebar'

interface QueryResultViewProps {
  result: QueryResult | null
  error: string | null
  running: boolean
  onClose: () => void
  onRerun?: () => void
  refreshRef?: RefreshRefHandle
  /** Connection context for heuristic FK navigation. */
  connectionId?: string
  config?: PostgresConfig
  database?: string
  /** Called when the user clicks a clickable FK-like cell. */
  onNavigateRelation?: (args: {
    referencedSchema: string
    referencedTable: string
    referencedColumn: string
    value: unknown
    display: string
  }) => void
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

/**
 * Best-effort guess at a referenced table name from a column label. Heuristics:
 *   "user_id"  → "user"
 *   "id"       → null (ambiguous)
 *   "ownerId"  → "owner"
 * Anything we can't match is left as a plain text cell.
 */
function guessReferencedTable(column: string): string | null {
  const lower = column.toLowerCase()
  if (lower === 'id' || lower.endsWith('._id')) return null
  if (lower.endsWith('_id')) {
    const stem = lower.slice(0, -3)
    // crude singularization: drop trailing 's' if present
    return stem.endsWith('s') && stem.length > 1 ? stem.slice(0, -1) : stem
  }
  return null
}

export function QueryResultView({
  result,
  error,
  running,
  onClose,
  onRerun,
  refreshRef,
  connectionId,
  config,
  database,
  onNavigateRelation,
}: QueryResultViewProps) {
  useEffect(() => {
    if (!refreshRef || !onRerun) return
    refreshRef.current = () => {
      if (!running) onRerun()
    }
    return () => {
      if (refreshRef) refreshRef.current = null
    }
  }, [refreshRef, onRerun, running])

  const canResolve = Boolean(connectionId && config && database)
  const [tables, setTables] = useState<TableInfo[] | null>(null)
  const tablesSeq = useRef(0)

  // Refresh table list whenever the database context changes.
  useEffect(() => {
    if (!canResolve || !connectionId || !config || !database) {
      setTables(null)
      return
    }
    const seq = ++tablesSeq.current
    void (async () => {
      const res = await api.postgres.listTables({ connectionId, config, database })
      if (seq !== tablesSeq.current) return
      if ('error' in res) {
        setTables([])
        return
      }
      setTables(res)
    })()
  }, [canResolve, connectionId, config, database])

  // Map: columnName -> { schema, table, column } for any guess we can resolve.
  const navigationByColumn = useMemo(() => {
    if (!result || !tables) return new Map<string, { schema: string; table: string }>()
    const byLowerName = new Map<string, TableInfo>()
    for (const t of tables) byLowerName.set(t.name.toLowerCase(), t)
    const out = new Map<string, { schema: string; table: string }>()
    for (const col of result.columns) {
      const guess = guessReferencedTable(col)
      if (!guess) continue
      const match = byLowerName.get(guess)
      if (match) {
        out.set(col, { schema: match.schema, table: match.name })
      }
    }
    return out
  }, [result, tables])

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-muted/20 px-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-tight">Custom query result</span>
          {result && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              read-only
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={onClose}
          title="Close result"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {error && (
        <div className="flex shrink-0 items-start gap-2 border-b border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="break-words font-mono">{error}</span>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {running ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : result ? (
          <>
            <div className="flex h-7 items-center gap-3 border-b border-border bg-muted/20 px-3 text-[11px] text-muted-foreground">
              <span>
                <span className="font-mono text-foreground">{result.rowCount.toLocaleString()}</span>{' '}
                {result.rowCount === 1 ? 'row' : 'rows'}
              </span>
              <span>·</span>
              <span>
                <span className="font-mono text-foreground">{result.durationMs}ms</span>
              </span>
              {result.truncated && (
                <>
                  <span>·</span>
                  <span className="text-amber-600 dark:text-amber-400">truncated to 10 000</span>
                </>
              )}
              {navigationByColumn.size > 0 && onNavigateRelation && (
                <span className="ml-auto text-[10px]">
                  click <Link className="inline h-2.5 w-2.5 align-middle" /> to open related row
                </span>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  {result.columns.map((c) => (
                    <TableHead key={c} className="whitespace-nowrap font-mono text-xs">
                      {c}
                      {navigationByColumn.has(c) && (
                        <span
                          className="ml-1 align-middle text-[10px] text-sky-600/70 dark:text-sky-400/70"
                          title="Heuristic FK link"
                        >
                          <Link className="inline h-2.5 w-2.5" />
                        </span>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row, i) => (
                  <TableRow key={i}>
                    {row.map((cell, j) => {
                      const colName = result.columns[j]
                      const nav = navigationByColumn.get(colName)
                      const isNull = cell === null || cell === undefined
                      const isEmptyString = !isNull && cell === ''
                      if (nav && !isNull && onNavigateRelation) {
                        return (
                          <TableCell
                            key={j}
                            className="max-w-[360px] truncate align-top font-mono text-xs"
                          >
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onNavigateRelation({
                                        referencedSchema: nav.schema,
                                        referencedTable: nav.table,
                                        referencedColumn: 'id',
                                        value: cell,
                                        display: formatCell(cell),
                                      })
                                    }
                                    className={cn(
                                      'flex max-w-full items-center gap-1 truncate rounded-sm px-1 py-0.5 text-left text-sky-600 hover:bg-sky-500/10 hover:underline',
                                      'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                                      'dark:text-sky-400 dark:hover:text-sky-300',
                                    )}
                                  >
                                    <Link className="h-3 w-3 shrink-0 opacity-60" />
                                    <span className="truncate">{formatCell(cell)}</span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" sideOffset={4}>
                                  Open row in <span className="font-mono">{nav.schema}.{nav.table}</span>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        )
                      }
                      return (
                        <TableCell
                          key={j}
                          className={cn(
                            'max-w-[360px] truncate align-top font-mono text-xs',
                            (isNull || isEmptyString) && 'italic text-muted-foreground',
                          )}
                          title={isNull ? 'NULL' : isEmptyString ? '(empty string)' : formatCell(cell)}
                        >
                          {isNull ? 'NULL' : isEmptyString ? '(empty)' : formatCell(cell)}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div className="max-w-md text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Run a custom query</p>
              <p className="mt-1">
                Type a query in the bar below and press{' '}
                <span className="font-mono">⌘/Ctrl + ↵</span>. Queries run inside a{' '}
                <span className="font-mono">READ ONLY</span> transaction — writes are rejected.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { AlertCircle, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useEffect } from 'react'
import type { QueryResult } from '@/types/postgres'
import type { RefreshRefHandle } from './PostgresSidebar'

interface QueryResultViewProps {
  result: QueryResult | null
  error: string | null
  running: boolean
  onClose: () => void
  onRerun?: () => void
  refreshRef?: RefreshRefHandle
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

export function QueryResultView({
  result,
  error,
  running,
  onClose,
  onRerun,
  refreshRef,
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
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  {result.columns.map((c) => (
                    <TableHead key={c} className="whitespace-nowrap font-mono text-xs">
                      {c}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row, i) => (
                  <TableRow key={i}>
                    {row.map((cell, j) => (
                      <TableCell
                        key={j}
                        className={cn(
                          'max-w-[360px] truncate align-top font-mono text-xs',
                          (cell === null || cell === undefined) && 'italic text-muted-foreground',
                        )}
                        title={formatCell(cell)}
                      >
                        {formatCell(cell)}
                      </TableCell>
                    ))}
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

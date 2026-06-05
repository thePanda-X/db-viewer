import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  Undo2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { EditableCell } from './EditableCell'
import type { TableMeta } from '@/types/postgres'
import type { PostgresConfig } from '@/types/connection'

interface TableViewProps {
  connectionId: string
  config: PostgresConfig
  database: string
  schema: string
  table: string
  onPendingChangesChange?: (count: number) => void
  onConfirmNavigationRequest?: (action: () => void) => void
}

const LIMIT_OPTIONS = [100, 250, 500, 1000] as const

type Row = Record<string, unknown>

function rowKey(row: Row, pk: string[] | null): string {
  if (pk && pk.length > 0) {
    return pk.map((k) => String(row[k] ?? '')).join('::')
  }
  return JSON.stringify(row)
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a === 'object' && typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b)
    } catch {
      return false
    }
  }
  return false
}

function columnsToRowMap(columns: string[], rows: unknown[][]): Row[] {
  return rows.map((r) => {
    const obj: Row = {}
    columns.forEach((c, i) => {
      obj[c] = r[i]
    })
    return obj
  })
}

export function TableView({
  connectionId,
  config,
  database,
  schema,
  table,
  onPendingChangesChange,
  onConfirmNavigationRequest,
}: TableViewProps) {
  const [meta, setMeta] = useState<TableMeta | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [originalRows, setOriginalRows] = useState<Row[]>([])
  const [edits, setEdits] = useState<Map<string, Map<string, unknown>>>(new Map())
  const [loading, setLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(false)
  const [limit, setLimit] = useState<number>(100)
  const [offset, setOffset] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [failedRowIndex, setFailedRowIndex] = useState<number | null>(null)
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false)
  const fetchSeq = useRef(0)

  const qualified = `${schema}.${table}`
  const currentConfig = useMemo(() => ({ ...config, database }), [config, database])

  const fetchMeta = useCallback(async () => {
    setMetaError(null)
    try {
      const result = await api.postgres.getTableMeta({
        connectionId,
        config,
        database,
        schema,
        table,
      })
      if (result.ok) {
        setMeta(result.meta)
        setEdits(new Map())
      } else {
        setMetaError(result.error)
        setMeta(null)
      }
    } catch (err) {
      setMetaError(err instanceof Error ? err.message : String(err))
      setMeta(null)
    }
  }, [connectionId, config, database, schema, table])

  const fetchData = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    setDataError(null)
    setSaveError(null)
    setFailedRowIndex(null)
    try {
      const sql = `SELECT * FROM ${quoteIdent(schema)}.${quoteIdent(table)} LIMIT $1 OFFSET $2`
      const result = await api.postgres.readOnlyQuery({
        connectionId,
        config: currentConfig,
        request: { sql, params: [limit, offset] },
      })
      if (seq !== fetchSeq.current) return
      if (result.ok) {
        setOriginalRows(columnsToRowMap(result.result.columns, result.result.rows))
        setEdits(new Map())
      } else {
        setDataError(result.error)
        setOriginalRows([])
      }
    } catch (err) {
      if (seq !== fetchSeq.current) return
      setDataError(err instanceof Error ? err.message : String(err))
      setOriginalRows([])
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [connectionId, currentConfig, schema, table, limit, offset])

  const fetchCount = useCallback(async () => {
    setCountLoading(true)
    try {
      const sql = `SELECT COUNT(*)::bigint AS n FROM ${quoteIdent(schema)}.${quoteIdent(table)}`
      const result = await api.postgres.readOnlyQuery({
        connectionId,
        config: currentConfig,
        request: { sql },
      })
      if (result.ok && result.result.rows.length > 0) {
        const n = Number(result.result.rows[0][0])
        setTotalCount(Number.isFinite(n) ? n : null)
      } else {
        setTotalCount(null)
      }
    } catch {
      setTotalCount(null)
    } finally {
      setCountLoading(false)
    }
  }, [connectionId, currentConfig, schema, table])

  useEffect(() => {
    void fetchMeta()
  }, [fetchMeta])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    void fetchCount()
  }, [fetchCount])

  const pendingCount = useMemo(() => {
    let count = 0
    for (const cols of edits.values()) {
      if (cols.size > 0) count += 1
    }
    return count
  }, [edits])

  useEffect(() => {
    onPendingChangesChange?.(pendingCount)
  }, [pendingCount, onPendingChangesChange])

  const setCellEdit = useCallback((rowIdx: number, col: string, value: unknown) => {
    const row = originalRows[rowIdx]
    if (!row) return
    const pk = meta?.primaryKey ?? null
    const key = rowKey(row, pk)
    setEdits((prev) => {
      const next = new Map(prev)
      const existing = next.get(key) ?? new Map<string, unknown>()
      const original = row[col]
      if (valuesEqual(value, original)) {
        existing.delete(col)
      } else {
        existing.set(col, value)
      }
      if (existing.size === 0) {
        next.delete(key)
      } else {
        next.set(key, new Map(existing))
      }
      return next
    })
  }, [originalRows, meta])

  const discardChanges = useCallback(() => {
    setEdits(new Map())
    setSaveError(null)
    setFailedRowIndex(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (!meta || meta.primaryKey === null) return
    if (edits.size === 0) return
    setSaving(true)
    setSaveError(null)
    setFailedRowIndex(null)
    const updates = Array.from(edits.entries()).map(([key, cols]) => {
      const original: Row = {}
      const changes: Row = {}
      for (const row of originalRows) {
        if (rowKey(row, meta.primaryKey) === key) {
          for (const c of meta.columns) original[c.name] = row[c.name]
          break
        }
      }
      for (const [col, value] of cols.entries()) changes[col] = value
      return { original, changes }
    })
    try {
      const res = await api.postgres.saveChanges({
        connectionId,
        config,
        request: {
          database,
          schema,
          table,
          primaryKey: meta.primaryKey,
          updates,
        },
      })
      if (res.ok) {
        setEdits(new Map())
        await Promise.all([fetchData(), fetchCount()])
      } else {
        setSaveError(res.error)
        setFailedRowIndex(res.failedRowIndex ?? null)
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [meta, edits, originalRows, connectionId, config, database, schema, table, fetchData, fetchCount])

  const goPage = useCallback((nextOffset: number) => {
    if (pendingCount > 0 && onConfirmNavigationRequest) {
      onConfirmNavigationRequest(() => {
        discardChanges()
        setOffset(nextOffset)
      })
    } else {
      setOffset(nextOffset)
    }
  }, [pendingCount, onConfirmNavigationRequest, discardChanges])

  const changeLimit = useCallback((next: number) => {
    if (pendingCount > 0 && onConfirmNavigationRequest) {
      onConfirmNavigationRequest(() => {
        discardChanges()
        setLimit(next)
        setOffset(0)
      })
    } else {
      setLimit(next)
      setOffset(0)
    }
  }, [pendingCount, onConfirmNavigationRequest, discardChanges])

  const hasPrimaryKey = meta?.primaryKey != null
  const showRangeStart = totalCount === 0 ? 0 : offset + 1
  const showRangeEnd = offset + originalRows.length
  const hasNextPage = originalRows.length === limit
  const hasPrevPage = offset > 0

  if (metaError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center gap-2 text-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <h3 className="text-sm font-semibold">Failed to load table metadata</h3>
          <p className="break-words text-xs text-muted-foreground">{metaError}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => void fetchMeta()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!meta) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {!hasPrimaryKey && (
        <div className="flex items-start gap-2 border-b border-border bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <span className="font-mono">{qualified}</span> has no primary key — inline editing is
            disabled. Add a primary key to enable cell edits.
          </span>
        </div>
      )}

      {saveError && (
        <div className="flex items-start gap-2 border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="flex-1">
            <div className="font-medium">Save rolled back — no changes were applied.</div>
            <div className="mt-0.5 break-words">{saveError}</div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {meta.columns.map((col) => (
                <TableHead
                  key={col.name}
                  className={cn(
                    'whitespace-nowrap',
                    col.isPrimaryKey && 'bg-primary/5',
                  )}
                >
                  <div className="flex flex-col">
                    <span className="font-mono text-xs">{col.name}</span>
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {col.dataType}
                      {col.isNullable ? '' : ' NOT NULL'}
                      {col.isPrimaryKey ? ' · PK' : ''}
                    </span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={meta.columns.length} className="h-32 text-center">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : dataError ? (
              <TableRow>
                <TableCell colSpan={meta.columns.length} className="h-32 text-center">
                  <div className="mx-auto flex max-w-md flex-col items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <p className="break-words text-xs text-destructive">{dataError}</p>
                    {describeRelationError(dataError, database, qualified) && (
                      <p className="text-[11px] text-muted-foreground">
                        {describeRelationError(dataError, database, qualified)}
                      </p>
                    )}
                    <Button size="sm" variant="outline" onClick={() => void fetchData()}>
                      Retry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : originalRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={meta.columns.length} className="h-32 text-center text-xs text-muted-foreground">
                  No rows.
                </TableCell>
              </TableRow>
            ) : (
              originalRows.map((row, rowIdx) => {
                const pk = meta.primaryKey
                const key = rowKey(row, pk)
                const rowEdits = edits.get(key)
                const rowIsDirty = rowEdits !== undefined && rowEdits.size > 0
                const isFailed = failedRowIndex !== null && failedRowIndex === rowIdx
                return (
                  <TableRow
                    key={key}
                    data-state={rowIsDirty ? 'selected' : undefined}
                    className={cn(
                      rowIsDirty && 'bg-amber-500/5 hover:bg-amber-500/10',
                      isFailed && 'border border-destructive/50 bg-destructive/10',
                    )}
                  >
                    {meta.columns.map((col) => {
                      const edited = rowEdits?.get(col.name)
                      const current = edited !== undefined ? edited : row[col.name]
                      return (
                        <TableCell
                          key={col.name}
                          className={cn(
                            'align-top',
                            col.isPrimaryKey && 'bg-primary/5',
                          )}
                        >
                          <EditableCell
                            value={current}
                            original={row[col.name]}
                            column={col}
                            disabled={!hasPrimaryKey}
                            onCommit={(next) => setCellEdit(rowIdx, col.name, next)}
                            onCancel={() => {}}
                          />
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex h-11 shrink-0 items-center justify-between border-t border-border bg-muted/20 px-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Rows</span>
          <span className="font-mono">
            {showRangeStart.toLocaleString()}–{showRangeEnd.toLocaleString()}
          </span>
          {totalCount !== null && (
            <span className="text-muted-foreground">
              of {totalCount.toLocaleString()}
              {totalCount > 10_000 ? ' (capped)' : ''}
            </span>
          )}
          {countLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Limit</span>
          <Select value={String(limit)} onValueChange={(v) => changeLimit(Number(v))}>
            <SelectTrigger className="h-7 w-[80px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)} className="text-xs">
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => goPage(Math.max(0, offset - limit))}
            disabled={!hasPrevPage || loading}
            className="h-7"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Prev</span>
          </Button>
          <span className="px-2 font-mono text-muted-foreground">
            {Math.floor(offset / limit) + 1}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => goPage(offset + limit)}
            disabled={!hasNextPage || loading}
            className="h-7"
          >
            <span>Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          {pendingCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={discardChanges}
              disabled={saving}
              className="h-7"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span>Discard</span>
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setConfirmSaveOpen(true)}
            disabled={pendingCount === 0 || saving}
            className="h-7"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>Save {pendingCount > 0 ? `${pendingCount} change${pendingCount === 1 ? '' : 's'}` : 'changes'}</span>
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save changes?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingCount === 1
                ? `Apply 1 change to ${qualified}?`
                : `Apply ${pendingCount} changes to ${qualified}?`}
              {' '}If any row fails, the entire save will be rolled back and no changes will be applied.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleSave()}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`)
  }
  return `"${name}"`
}

function describeRelationError(error: string, database: string, qualified: string): string | null {
  if (/does not exist/i.test(error)) {
    return `The table ${qualified} was not found in database "${database}". It may have been dropped, renamed, or you may be looking at a stale entry. Try selecting a different database or refreshing the sidebar.`
  }
  if (/permission denied/i.test(error)) {
    return `Your database user lacks the required permission on ${qualified}.`
  }
  return null
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Save,
  Undo2,
  X,
} from 'lucide-react'
import { cn, valuesEqual } from '@/lib/utils'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useHotkey } from '@/lib/hotkeys'
import { toast } from '@/state/toastStore'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EditableCell } from './EditableCell'
import { ForeignKeyPicker } from '../ForeignKeyPicker'
import type { ForeignKey, TableMeta } from '@/types/postgres'
import type { PostgresConfig } from '@/types/connection'
import type { RefreshRefHandle } from './PostgresSidebar'

export interface TableViewFilter {
  column: string
  value: unknown
  /** Display value (e.g. "id = 42") shown in the filter chip. */
  display?: string
}

interface TableViewProps {
  connectionId: string
  config: PostgresConfig
  database: string
  schema: string
  table: string
  /** Optional pre-applied WHERE filter. */
  filter?: TableViewFilter
  /** Called when the user clears the filter (e.g. to open the full table). */
  onClearFilter?: () => void
  /**
   * Optional callback invoked when the user clicks a clickable FK cell. The
   * parent is responsible for opening the new tab. Defaults to no-op.
   */
  onNavigateRelation?: (fk: ForeignKey, value: unknown) => void
  onNavigateIncomingRelation?: (fk: ForeignKey, value: unknown) => void
  onPendingChangesChange?: (count: number) => void
  onConfirmNavigationRequest?: (action: () => void) => void
  refreshRef?: RefreshRefHandle
}

const LIMIT_OPTIONS = [100, 250, 500, 1000] as const

type Row = Record<string, unknown>

function rowKey(row: Row, pk: string[] | null): string {
  if (pk && pk.length > 0) {
    return pk.map((k) => String(row[k] ?? '')).join('::')
  }
  return JSON.stringify(row)
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
  filter,
  onClearFilter,
  onNavigateRelation,
  onNavigateIncomingRelation,
  onPendingChangesChange,
  onConfirmNavigationRequest,
  refreshRef,
}: TableViewProps) {
  const [meta, setMeta] = useState<TableMeta | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [relations, setRelations] = useState<ForeignKey[]>([])
  const [incomingRelations, setIncomingRelations] = useState<ForeignKey[]>([])
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
  const [fkPickerState, setFkPickerState] = useState<{
    rowIdx: number
    col: string
    fk: ForeignKey
  } | null>(null)
  // Structural seq — bumped whenever the table or filter changes. Guards
  // fetchMeta/fetchRelations/fetchCount so an in-flight stale fetch can't
  // overwrite the new table's state with the old table's meta.
  const fetchSeq = useRef(0)
  // Paging seq — bumped on every fetchData call (including limit/offset).
  // Independent of fetchSeq so changing the limit doesn't invalidate
  // fetchMeta, which doesn't depend on paging.
  const dataSeq = useRef(0)

  const qualified = `${schema}.${table}`
  const currentConfig = useMemo(() => ({ ...config, database }), [config, database])

  const fetchMeta = useCallback(async () => {
    const seq = fetchSeq.current
    setMetaError(null)
    try {
      const result = await api.postgres.getTableMeta({
        connectionId,
        config,
        database,
        schema,
        table,
      })
      if (seq !== fetchSeq.current) return
      if (result.ok) {
        setMeta(result.meta)
        setEdits(new Map())
      } else {
        setMetaError(result.error)
      }
    } catch (err) {
      if (seq !== fetchSeq.current) return
      setMetaError(err instanceof Error ? err.message : String(err))
    }
  }, [connectionId, config, database, schema, table])

  const fetchRelations = useCallback(async () => {
    const seq = fetchSeq.current
    try {
      const result = await api.postgres.getTableRelations({
        connectionId,
        config,
        database,
        schema,
        table,
      })
      if (seq !== fetchSeq.current) return
      if (result.ok) {
        setRelations(result.relations)
      } else {
        // Fall back to an empty list; FK cells just won't be clickable.
        setRelations([])
      }
    } catch {
      if (seq !== fetchSeq.current) return
      setRelations([])
    }
  }, [connectionId, config, database, schema, table])

  const fetchIncomingRelations = useCallback(async () => {
    const seq = fetchSeq.current
    try {
      const result = await api.postgres.getIncomingTableRelations({
        connectionId,
        config,
        database,
        schema,
        table,
      })
      if (seq !== fetchSeq.current) return
      if (result.ok) {
        setIncomingRelations(result.relations)
      } else {
        setIncomingRelations([])
      }
    } catch {
      if (seq !== fetchSeq.current) return
      setIncomingRelations([])
    }
  }, [connectionId, config, database, schema, table])

  const buildWhereAndParams = useCallback(
    (baseParams: unknown[]): { sql: string; params: unknown[] } => {
      if (!filter) {
        return { sql: '', params: baseParams }
      }
      const paramIndex = baseParams.length + 1
      return {
        sql: ` WHERE ${quoteIdent(filter.column)} = $${paramIndex}`,
        params: [...baseParams, filter.value],
      }
    },
    [filter],
  )

  const fetchData = useCallback(async () => {
    const seq = ++dataSeq.current
    setLoading(true)
    setDataError(null)
    setSaveError(null)
    setFailedRowIndex(null)
    try {
      const limitParam = `$${1}`
      const offsetParam = `$${2}`
      const where = buildWhereAndParams([limit, offset])
      const sql = `SELECT * FROM ${quoteIdent(schema)}.${quoteIdent(table)}${where.sql} LIMIT ${limitParam} OFFSET ${offsetParam}`
      const result = await api.postgres.readOnlyQuery({
        connectionId,
        config: currentConfig,
        request: { sql, params: where.params },
      })
      if (seq !== dataSeq.current) return
      if (result.ok) {
        setOriginalRows(columnsToRowMap(result.result.columns, result.result.rows))
        setEdits(new Map())
      } else {
        setDataError(result.error)
      }
    } catch (err) {
      if (seq !== dataSeq.current) return
      setDataError(err instanceof Error ? err.message : String(err))
    } finally {
      if (seq === dataSeq.current) setLoading(false)
    }
  }, [connectionId, currentConfig, schema, table, limit, offset, buildWhereAndParams])

  const fetchCount = useCallback(async () => {
    const seq = fetchSeq.current
    setCountLoading(true)
    try {
      const where = buildWhereAndParams([])
      const sql = `SELECT COUNT(*)::bigint AS n FROM ${quoteIdent(schema)}.${quoteIdent(table)}${where.sql}`
      const result = await api.postgres.readOnlyQuery({
        connectionId,
        config: currentConfig,
        request: { sql, params: where.params },
      })
      if (seq !== fetchSeq.current) return
      if (result.ok && result.result.rows.length > 0) {
        const n = Number(result.result.rows[0][0])
        setTotalCount(Number.isFinite(n) ? n : null)
      } else {
        setTotalCount(null)
      }
    } catch {
      if (seq !== fetchSeq.current) return
      setTotalCount(null)
    } finally {
      if (seq === fetchSeq.current) setCountLoading(false)
    }
  }, [connectionId, currentConfig, schema, table, buildWhereAndParams])

  useEffect(() => {
    // Table change: invalidate in-flight meta/relations/count fetches and
    // drop ALL stale UI state (including meta/relations) so we never render
    // the new table's rows against the old table's column names. Must run
    // BEFORE the fetch useEffects below so they capture the bumped seq.
    fetchSeq.current++
    setOffset(0)
    setMeta(null)
    setMetaError(null)
    setRelations([])
    setIncomingRelations([])
    setOriginalRows([])
    setDataError(null)
    setTotalCount(null)
    setEdits(new Map())
    setSaveError(null)
    setFailedRowIndex(null)
  }, [schema, table])

  useEffect(() => {
    // Filter change (same table): meta/relations are still valid for this
    // table, so leave them alone — fetchMeta/fetchRelations aren't re-called
    // on filter change. Just invalidate any in-flight data fetch and reset
    // data/offset/edits so the new WHERE clause takes effect cleanly.
    fetchSeq.current++
    setOffset(0)
    setOriginalRows([])
    setDataError(null)
    setEdits(new Map())
    setSaveError(null)
    setFailedRowIndex(null)
  }, [filter?.column, filter?.value])

  useEffect(() => {
    void fetchMeta()
  }, [fetchMeta])

  useEffect(() => {
    void fetchRelations()
  }, [fetchRelations])

  useEffect(() => {
    void fetchIncomingRelations()
  }, [fetchIncomingRelations])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    void fetchCount()
  }, [fetchCount])

  useEffect(() => {
    if (!refreshRef) return
    refreshRef.current = () => {
      void fetchMeta()
      void fetchRelations()
      void fetchIncomingRelations()
      void fetchData()
      void fetchCount()
    }
    return () => {
      if (refreshRef) refreshRef.current = null
    }
  }, [refreshRef, fetchMeta, fetchRelations, fetchIncomingRelations, fetchData, fetchCount])

  const pendingCount = useMemo(() => {
    let count = 0
    for (const cols of edits.values()) {
      if (cols.size > 0) count += 1
    }
    return count
  }, [edits])

  const relationsByColumn = useMemo(() => {
    const map = new Map<string, ForeignKey>()
    for (const r of relations) {
      if (r.constraintColumns.length === 1) {
        map.set(r.column, r)
      }
    }
    return map
  }, [relations])

  const incomingRelationsByColumn = useMemo(() => {
    const map = new Map<string, ForeignKey[]>()
    for (const r of incomingRelations) {
      if (r.constraintColumns.length !== 1) continue
      const existing = map.get(r.referencedColumn) ?? []
      existing.push(r)
      map.set(r.referencedColumn, existing)
    }
    return map
  }, [incomingRelations])

  useHotkey('Mod+S', {
    label: 'Save changes',
    group: 'Table view',
    description: 'Save pending row edits',
    allowInInputs: true,
    handler: () => {
      if (pendingCount === 0) {
        toast({ message: 'No changes to save', variant: 'info' })
        return
      }
      setConfirmSaveOpen(true)
    },
  })

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
      const existing = new Map(next.get(key) ?? new Map<string, unknown>())
      const original = row[col]
      if (valuesEqual(value, original)) {
        existing.delete(col)
      } else {
        existing.set(col, value)
      }
      if (existing.size === 0) {
        next.delete(key)
      } else {
        next.set(key, existing)
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

  const handleOpenFkPicker = useCallback((rowIdx: number, col: string, fk: ForeignKey) => {
    setFkPickerState({ rowIdx, col, fk })
  }, [])

  const handleCloseFkPicker = useCallback(() => {
    setFkPickerState(null)
  }, [])

  const fetchFkRows = useCallback(
    async (search?: string) => {
      if (!fkPickerState) return { columns: [], rows: [] }
      const { fk } = fkPickerState
      const columns = [fk.referencedColumn]
      const result = await api.postgres.lookupRows({
        connectionId,
        config,
        database,
        schema: fk.referencedSchema,
        table: fk.referencedTable,
        columns,
        ...(search ? { search: { column: fk.referencedColumn, query: search } } : {}),
        limit: 50,
      })
      if (!result.ok) throw new Error(result.error)
      return result.result
    },
    [connectionId, config, database, fkPickerState],
  )

  const handleFkSelect = useCallback(
    (value: unknown) => {
      if (!fkPickerState) return
      setCellEdit(fkPickerState.rowIdx, fkPickerState.col, value)
    },
    [fkPickerState, setCellEdit],
  )

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
                    <span className="flex items-center gap-1 text-[10px] font-normal text-muted-foreground">
                      {col.enumValues && col.enumValues.length > 0 ? (
                        <EnumTypeTag values={col.enumValues} />
                      ) : (
                        <span>{col.dataType}</span>
                      )}
                      {!col.isNullable && <span>NOT NULL</span>}
                      {col.isPrimaryKey && <span>· PK</span>}
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
                  {filter ? (
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-1.5">
                      <span>No rows match the current filter.</span>
                      {onClearFilter && (
                        <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={onClearFilter}>
                          Show full table
                        </Button>
                      )}
                    </div>
                  ) : (
                    'No rows.'
                  )}
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
                      const fk = relationsByColumn.get(col.name)
                      const incoming = incomingRelationsByColumn.get(col.name) ?? []
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
                            {...(fk && current !== null && current !== undefined
                              ? {
                                  navigateTo: {
                                    table: `${fk.referencedSchema}.${fk.referencedTable}`,
                                    onClick: () => onNavigateRelation?.(fk, current),
                                  },
                                }
                              : {})}
                            incomingNavigateTo={incoming.map((incomingFk) => ({
                              table: `${incomingFk.sourceSchema}.${incomingFk.sourceTable}`,
                              onClick: () => onNavigateIncomingRelation?.(incomingFk, current),
                            }))}
                            onFkBrowse={fk ? () => handleOpenFkPicker(rowIdx, col.name, fk) : undefined}
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
        <div className="flex min-w-0 items-center gap-2">
          {filter && (
            <div
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-500/10 pl-2 pr-1 font-mono text-[11px] text-sky-700 dark:text-sky-300',
              )}
              title="Active filter — clear it to see all rows"
            >
              <Filter className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {filter.display ??
                  `${filter.column} = ${formatFilterValue(filter.value)}`}
              </span>
              {onClearFilter && (
                <button
                  type="button"
                  onClick={onClearFilter}
                  className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-sm text-sky-700/70 hover:bg-sky-500/20 hover:text-sky-900 dark:text-sky-300/70 dark:hover:text-sky-100"
                  aria-label="Clear filter"
                  title="Clear filter"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
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

      {fkPickerState && (
        <ForeignKeyPicker
          open
          onOpenChange={(open) => {
            if (!open) handleCloseFkPicker()
          }}
          referencedTable={`${fkPickerState.fk.referencedSchema}.${fkPickerState.fk.referencedTable}`}
          referencedColumn={fkPickerState.fk.referencedColumn}
          fetchRows={fetchFkRows}
          onSelect={handleFkSelect}
        />
      )}
    </div>
  )
}

function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`)
  }
  return `"${name}"`
}

function formatFilterValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'string') return `'${value}'`
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function describeRelationError(error: string, database: string, qualified: string): string | null {
  if (/does not exist/i.test(error)) {
    return `The table ${qualified} was not found in database "${database}". It may have been dropped, renamed, or you may be looking at a stale entry. Try selecting a different database or refreshing the sidebar.`
  }
  if (/permission denied/i.test(error)) {
    return `Your database user lacks the required permission on ${qualified}.`
  }
  if (/invalid input syntax for type/i.test(error)) {
    return `The filter value's type doesn't match the target column's type. This usually means a foreign-key in the source table points to a column whose declared type doesn't match the value being filtered on — a schema inconsistency. Clear the filter to see the full table.`
  }
  return null
}

const ENUM_TAG_PREVIEW_COUNT = 3

function EnumTypeTag({ values }: { values: string[] }) {
  const preview = values.slice(0, ENUM_TAG_PREVIEW_COUNT).join(', ')
  const overflow = values.length - ENUM_TAG_PREVIEW_COUNT
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex max-w-[180px] items-center rounded-sm bg-violet-500/10 px-1 font-mono text-violet-700',
              'dark:text-violet-300',
            )}
          >
            <span className="truncate">
              enum[{preview}
              {overflow > 0 ? `, +${overflow}` : ''}]
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4}>
          <div className="max-w-xs text-[11px]">
            <div className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">
              enum values
            </div>
            <div className="font-mono">{values.join(', ')}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

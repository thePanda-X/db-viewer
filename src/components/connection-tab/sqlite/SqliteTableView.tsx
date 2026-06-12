import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Loader2,
  Save,
  Trash2,
  Undo2,
} from 'lucide-react'
import { cn, valuesEqual } from '@/lib/utils'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EditableCell } from '../postgres/EditableCell'
import { ForeignKeyPicker } from '../ForeignKeyPicker'
import type { TableMeta, ForeignKey } from '@/types/sqlite'
import { editableKindFor as sqliteEditableKindFor } from '@/types/sqlite'
import type { ColumnMeta as PostgresColumnMeta } from '@/types/postgres'
import type { SqliteConfig } from '@/types/connection'
import type { RefreshRefHandle } from './SqliteSidebar'

interface SqliteTableViewProps {
  connectionId: string
  config: SqliteConfig
  table: string
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

export function SqliteTableView({
  connectionId,
  config,
  table,
  onPendingChangesChange,
  onConfirmNavigationRequest,
  refreshRef,
}: SqliteTableViewProps) {
  const [meta, setMeta] = useState<TableMeta | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [originalRows, setOriginalRows] = useState<Row[]>([])
  const [edits, setEdits] = useState<Map<string, Map<string, unknown>>>(new Map())
  const [loading, setLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [limit, setLimit] = useState<number>(100)
  const [offset, setOffset] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [failedRowIndex, setFailedRowIndex] = useState<number | null>(null)
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false)
  const [relations, setRelations] = useState<ForeignKey[]>([])
  const [fkPickerState, setFkPickerState] = useState<{
    rowIdx: number
    col: string
    fk: ForeignKey
  } | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const selectionAnchorRef = useRef<number | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [contextMenuState, setContextMenuState] = useState<{
    x: number
    y: number
    rowIdx: number
  } | null>(null)

  const fetchSeq = useRef(0)
  const dataSeq = useRef(0)

  const fetchMeta = useCallback(async () => {
    const seq = fetchSeq.current
    setMetaError(null)
    try {
      const result = await api.sqlite.getTableMeta({
        connectionId,
        filePath: config.filePath,
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
  }, [connectionId, config.filePath, table])

  const fetchRelations = useCallback(async () => {
    const seq = fetchSeq.current
    try {
      const result = await api.sqlite.getTableRelations({
        connectionId,
        filePath: config.filePath,
        table,
      })
      if (seq !== fetchSeq.current) return
      if (result.ok) {
        setRelations(result.relations)
      } else {
        setRelations([])
      }
    } catch {
      if (seq !== fetchSeq.current) return
      setRelations([])
    }
  }, [connectionId, config.filePath, table])

  const fetchData = useCallback(async () => {
    const seq = ++dataSeq.current
    setLoading(true)
    setDataError(null)
    setSaveError(null)
    setFailedRowIndex(null)
    try {
      const sql = `SELECT * FROM ${quoteIdent(table)} LIMIT ? OFFSET ?`
      const result = await api.sqlite.readOnlyQuery({
        connectionId,
        filePath: config.filePath,
        request: { sql, params: [limit, offset] },
      })
      if (seq !== dataSeq.current) return
      if (result.ok) {
        setOriginalRows(columnsToRowMap(result.result.columns, result.result.rows))
        setEdits(new Map())
        setSelectedRows(new Set())
        setContextMenuState(null)
      } else {
        setDataError(result.error)
      }
    } catch (err) {
      if (seq !== dataSeq.current) return
      setDataError(err instanceof Error ? err.message : String(err))
    } finally {
      if (seq === dataSeq.current) setLoading(false)
    }
  }, [connectionId, config.filePath, table, limit, offset])

  useEffect(() => {
    fetchSeq.current++
    setOffset(0)
    setMeta(null)
    setMetaError(null)
    setOriginalRows([])
    setDataError(null)
    setEdits(new Map())
    setSaveError(null)
    setFailedRowIndex(null)
    setSelectedRows(new Set())
    setContextMenuState(null)
  }, [table])

  useEffect(() => {
    void fetchMeta()
  }, [fetchMeta])

  useEffect(() => {
    void fetchRelations()
  }, [fetchRelations])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!refreshRef) return
    refreshRef.current = () => {
      void fetchMeta()
      void fetchRelations()
      void fetchData()
    }
    return () => {
      if (refreshRef) refreshRef.current = null
    }
  }, [refreshRef, fetchMeta, fetchRelations, fetchData])

  const pendingCount = useMemo(() => {
    let count = 0
    for (const cols of edits.values()) {
      if (cols.size > 0) count += 1
    }
    return count
  }, [edits])

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

  const pkColumns = meta?.primaryKey ?? null

  const toggleRowSelection = useCallback(
    (rowIdx: number) => {
      const key = rowKey(originalRows[rowIdx], pkColumns)
      setSelectedRows((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
      selectionAnchorRef.current = rowIdx
    },
    [originalRows, pkColumns],
  )

  const handleRowClick = useCallback(
    (rowIdx: number, e: React.MouseEvent) => {
      const key = rowKey(originalRows[rowIdx], pkColumns)
      if (e.shiftKey && selectionAnchorRef.current !== null) {
        const start = Math.min(selectionAnchorRef.current, rowIdx)
        const end = Math.max(selectionAnchorRef.current, rowIdx)
        setSelectedRows((prev) => {
          const next = new Set(prev)
          for (let i = start; i <= end; i++) {
            next.add(rowKey(originalRows[i], pkColumns))
          }
          return next
        })
      } else if (e.ctrlKey || e.metaKey) {
        toggleRowSelection(rowIdx)
      } else {
        setSelectedRows((prev) => {
          if (prev.size === 1 && prev.has(key)) {
            return new Set()
          }
          return new Set([key])
        })
        selectionAnchorRef.current = rowIdx
      }
    },
    [originalRows, pkColumns, toggleRowSelection],
  )

  const handleSelectAll = useCallback(() => {
    const pk = meta?.primaryKey ?? null
    if (selectedRows.size === originalRows.length && originalRows.length > 0) {
      setSelectedRows(new Set())
    } else {
      const all = new Set(originalRows.map((r) => rowKey(r, pk)))
      setSelectedRows(all)
    }
  }, [originalRows, meta?.primaryKey, selectedRows.size])

  const handleRowContextMenu = useCallback(
    (rowIdx: number, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const key = rowKey(originalRows[rowIdx], pkColumns)
      setSelectedRows((prev) => {
        if (!prev.has(key)) return new Set([key])
        return prev
      })
      setContextMenuState({ x: e.clientX, y: e.clientY, rowIdx })
    },
    [originalRows, pkColumns],
  )

  const handleCopyRowJson = useCallback(() => {
    if (!contextMenuState) return
    const row = originalRows[contextMenuState.rowIdx]
    if (!row) return
    void navigator.clipboard.writeText(JSON.stringify(row, null, 2))
    setContextMenuState(null)
  }, [contextMenuState, originalRows])

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
      const res = await api.sqlite.saveChanges({
        connectionId,
        filePath: config.filePath,
        request: {
          table,
          primaryKey: meta.primaryKey,
          updates,
        },
      })
      if (res.ok) {
        setEdits(new Map())
        await fetchData()
      } else {
        setSaveError(res.error)
        setFailedRowIndex(res.failedRowIndex ?? null)
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [meta, edits, originalRows, connectionId, config.filePath, table, fetchData])

  const handleDelete = useCallback(async () => {
    if (!meta || !meta.primaryKey) return
    setDeleting(true)
    try {
      const rowsToDelete = originalRows.filter((r) =>
        selectedRows.has(rowKey(r, meta.primaryKey)),
      )
      const res = await api.sqlite.deleteRows({
        connectionId,
        filePath: config.filePath,
        request: {
          table,
          primaryKey: meta.primaryKey,
          rows: rowsToDelete,
        },
      })
      if (res.ok) {
        setSelectedRows(new Set())
        setConfirmDeleteOpen(false)
        await fetchData()
      } else {
        toast({ message: `Delete failed: ${res.error}`, variant: 'error' })
      }
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : String(err), variant: 'error' })
    } finally {
      setDeleting(false)
    }
  }, [meta, selectedRows, originalRows, connectionId, config.filePath, table, fetchData])

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

  const relationsByColumn = useMemo(() => {
    const map = new Map<string, ForeignKey>()
    for (const r of relations) {
      map.set(r.column, r)
    }
    return map
  }, [relations])

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

      let displayCols: string[] = [fk.referencedColumn]
      try {
        const metaResult = await api.sqlite.getTableMeta({
          connectionId,
          filePath: config.filePath,
          table: fk.referencedTable,
        })
        if (metaResult.ok) {
          const meta = metaResult.meta
          const allCols = meta.columns.map((c) => c.name)
          displayCols = [
            fk.referencedColumn,
            ...allCols.filter((c) => c !== fk.referencedColumn),
          ]
        }
      } catch {
        // fall back to just the referenced column
      }

      const result = await api.sqlite.lookupRows({
        connectionId,
        filePath: config.filePath,
        table: fk.referencedTable,
        columns: displayCols,
        ...(search ? { search: { column: fk.referencedColumn, query: search } } : {}),
        limit: 50,
      })
      if (!result.ok) throw new Error(result.error)
      return result.result
    },
    [connectionId, config.filePath, fkPickerState],
  )

  const handleFkSelect = useCallback(
    (value: unknown) => {
      if (!fkPickerState) return
      setCellEdit(fkPickerState.rowIdx, fkPickerState.col, value)
    },
    [fkPickerState, setCellEdit],
  )

  const hasPrimaryKey = meta?.primaryKey != null
  const showRangeStart = offset + 1
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
            Table <span className="font-mono">{table}</span> has no primary key — inline editing is
            disabled. Add a primary key to enable cell edits.
          </span>
        </div>
      )}

      {saveError && (
        <div className="flex items-start gap-2 border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="flex-1">
            <div className="font-medium">Save failed — no changes were applied.</div>
            <div className="mt-0.5 break-words">{saveError}</div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    originalRows.length > 0 && selectedRows.size === originalRows.length
                      ? true
                      : selectedRows.size > 0
                        ? 'indeterminate'
                        : false
                  }
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all rows"
                />
              </TableHead>
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
                      <span>{col.dataType}</span>
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
                <TableCell colSpan={meta.columns.length + 1} className="h-32 text-center">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : dataError ? (
              <TableRow>
                <TableCell colSpan={meta.columns.length + 1} className="h-32 text-center">
                  <div className="mx-auto flex max-w-md flex-col items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <p className="break-words text-xs text-destructive">{dataError}</p>
                    <Button size="sm" variant="outline" onClick={() => void fetchData()}>
                      Retry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : originalRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={meta.columns.length + 1} className="h-32 text-center text-xs text-muted-foreground">
                  No rows found.
                </TableCell>
              </TableRow>
            ) : (
              originalRows.map((row, rowIdx) => {
                const pk = meta.primaryKey
                const key = rowKey(row, pk)
                const rowEdits = edits.get(key)
                const rowIsDirty = rowEdits !== undefined && rowEdits.size > 0
                const isFailed = failedRowIndex !== null && failedRowIndex === rowIdx
                const isSelected = selectedRows.has(key)
                return (
                  <TableRow
                    key={key}
                    data-state={rowIsDirty ? 'selected' : undefined}
                    data-selected={isSelected ? 'true' : undefined}
                    onClick={(e) => handleRowClick(rowIdx, e)}
                    onContextMenu={(e) => handleRowContextMenu(rowIdx, e)}
                    className={cn(
                      'cursor-pointer',
                      rowIsDirty && 'bg-amber-500/5 hover:bg-amber-500/10',
                      isSelected && 'bg-primary/5',
                      isFailed && 'border border-destructive/50 bg-destructive/10',
                    )}
                  >
                    <TableCell className="w-10 align-top" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRowSelection(rowIdx)}
                        aria-label={`Select row ${rowIdx + 1}`}
                      />
                    </TableCell>
                    {meta.columns.map((col) => {
                      const edited = rowEdits?.get(col.name)
                      const current = edited !== undefined ? edited : row[col.name]
                      const fk = relationsByColumn.get(col.name)
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
                            // Map Sqlite ColumnMeta to Postgres ColumnMeta shape for EditableCell
                            column={{
                              name: col.name,
                              dataType: col.dataType,
                              udtName: sqliteUdtNameFor(col.dataType),
                              isNullable: col.isNullable,
                              isGenerated: false,
                              isPrimaryKey: col.isPrimaryKey,
                            } as unknown as PostgresColumnMeta}
                            disabled={!hasPrimaryKey}
                            onCommit={(next) => setCellEdit(rowIdx, col.name, next)}
                            onCancel={() => {}}
                            navigateTo={fk && current !== null && current !== undefined ? {
                              table: fk.referencedTable,
                              referencedColumn: fk.referencedColumn,
                              onClick: () => {},
                            } : undefined}
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
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Rows</span>
          <span className="font-mono">
            {originalRows.length > 0 ? `${showRangeStart.toLocaleString()}–${showRangeEnd.toLocaleString()}` : '0'}
          </span>
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
          {selectedRows.size > 0 && (
            <span className="mr-1 text-muted-foreground">
              {selectedRows.size} selected
            </span>
          )}
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
          {selectedRows.size > 0 && hasPrimaryKey && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={deleting}
              className="h-7"
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              <span>Delete {selectedRows.size > 0 ? `${selectedRows.size} row${selectedRows.size === 1 ? '' : 's'}` : ''}</span>
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

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete rows?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedRows.size === 1
                ? `Delete 1 row from ${table}?`
                : `Delete ${selectedRows.size} rows from ${table}?`}
              {' '}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save changes?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingCount === 1
                ? `Apply 1 change to ${table}?`
                : `Apply ${pendingCount} changes to ${table}?`}
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
          referencedTable={fkPickerState.fk.referencedTable}
          referencedColumn={fkPickerState.fk.referencedColumn}
          fetchRows={fetchFkRows}
          onSelect={handleFkSelect}
        />
      )}

      {contextMenuState && (
        <DropdownMenu
          open={!!contextMenuState}
          onOpenChange={(open) => {
            if (!open) setContextMenuState(null)
          }}
        >
          <DropdownMenuTrigger asChild>
            <span
              style={{
                position: 'fixed',
                left: contextMenuState.x,
                top: contextMenuState.y,
                width: 0,
                height: 0,
                pointerEvents: 'none',
              }}
            />
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent
              side="bottom"
              align="start"
              sideOffset={0}
              className="min-w-[160px]"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleCopyRowJson()
                }}
              >
                <ClipboardCopy className="mr-2 h-3.5 w-3.5" />
                Copy row (JSON)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!hasPrimaryKey}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setContextMenuState(null)
                  setConfirmDeleteOpen(true)
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                {selectedRows.size > 1
                  ? `Delete ${selectedRows.size} rows`
                  : 'Delete row'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenu>
      )}
    </div>
  )
}

function sqliteUdtNameFor(dataType: string): string {
  const kind = sqliteEditableKindFor(dataType)
  switch (kind) {
    case 'number': return 'int4'
    case 'boolean': return 'bool'
    case 'datetime': return 'timestamptz'
    case 'json': return 'jsonb'
    default: return 'text'
  }
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

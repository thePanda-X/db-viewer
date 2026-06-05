import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { ColumnMeta, EditableColumnKind } from '@/types/postgres'
import { editableKindFor } from '@/types/postgres'

interface EditableCellProps {
  value: unknown
  original: unknown
  column: ColumnMeta
  disabled?: boolean
  onCommit: (next: unknown) => void
  onCancel: () => void
}

function parseInput(kind: EditableColumnKind, raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  if (raw === '') return { ok: true, value: null }
  if (kind === 'number') {
    const n = Number(raw)
    if (!Number.isFinite(n)) return { ok: false, error: 'Not a number' }
    return { ok: true, value: n }
  }
  if (kind === 'json') {
    try {
      return { ok: true, value: JSON.parse(raw) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Invalid JSON' }
    }
  }
  if (kind === 'datetime') {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'Invalid date' }
    return { ok: true, value: d.toISOString() }
  }
  return { ok: true, value: raw }
}

function formatValue(value: unknown, kind: EditableColumnKind): string {
  if (value === null || value === undefined) return ''
  if (kind === 'json') {
    if (typeof value === 'string') return value
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  if (kind === 'datetime') {
    if (value instanceof Date) return value.toISOString().slice(0, 16)
    if (typeof value === 'string') {
      const d = new Date(value)
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString().slice(0, 16)
      }
    }
    return String(value)
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
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

export function EditableCell({
  value,
  original,
  column,
  disabled,
  onCommit,
  onCancel,
}: EditableCellProps) {
  const kind = editableKindFor(column.udtName)
  const isEditable = !disabled && !column.isGenerated && kind !== 'readonly' && column.udtName !== 'uuid'
  const isNull = value === null || value === undefined
  const isDirty = !valuesEqual(value, original)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>(formatValue(value, kind))
  const [isNullDraft, setIsNullDraft] = useState<boolean>(isNull)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const taRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    setDraft(formatValue(value, kind))
    setIsNullDraft(isNull)
    setError(null)
  }, [value, kind, isNull])

  useEffect(() => {
    if (editing) {
      if (kind === 'json') {
        taRef.current?.focus()
        taRef.current?.select()
      } else {
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
  }, [editing, kind])

  if (!isEditable) {
    return (
      <span
        className={cn(
          'block truncate font-mono text-xs',
          isNull && 'italic text-muted-foreground',
        )}
        title={isNull ? 'NULL' : String(value)}
      >
        {isNull ? 'NULL' : formatValue(value, kind)}
      </span>
    )
  }

  if (kind === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <Switch
          checked={!isNull && Boolean(value)}
          onCheckedChange={(checked) => onCommit(checked)}
          disabled={disabled}
        />
        {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-label="Modified" />}
      </div>
    )
  }

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setEditing(true)}
        className={cn(
          'group/cell relative flex w-full items-center gap-1 rounded-sm px-1.5 py-0.5 text-left font-mono text-xs',
          'hover:bg-muted/60 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          isNull && 'italic text-muted-foreground',
        )}
        title={isNull ? 'NULL' : String(value)}
      >
        <span className="block truncate">{isNull ? 'NULL' : formatValue(value, kind)}</span>
        {isDirty && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-500" aria-label="Modified" />}
      </button>
    )
  }

  const commit = () => {
    if (isNullDraft) {
      if (!column.isNullable && !valuesEqual(value, null)) {
        setError('Column is NOT NULL')
        return
      }
      onCommit(null)
      setEditing(false)
      return
    }
    const parsed = parseInput(kind, draft)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    onCommit(parsed.value)
    setEditing(false)
  }

  const cancel = () => {
    setDraft(formatValue(value, kind))
    setIsNullDraft(isNull)
    setError(null)
    setEditing(false)
    onCancel()
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        {kind === 'json' ? (
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                commit()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                cancel()
              }
            }}
            className={cn(
              'min-h-[60px] w-full rounded-sm border border-input bg-background px-1.5 py-1 font-mono text-xs',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
            rows={3}
          />
        ) : (
          <Input
            ref={inputRef}
            type={kind === 'number' ? 'number' : kind === 'datetime' ? 'datetime-local' : 'text'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                cancel()
              }
            }}
            onBlur={() => commit()}
            className="h-7 px-1.5 py-0 font-mono text-xs"
          />
        )}
        <button
          type="button"
          onClick={() => {
            if (!column.isNullable || isNullDraft) {
              const nextNull = !isNullDraft
              setIsNullDraft(nextNull)
              if (nextNull) setDraft('')
            }
          }}
          title={column.isNullable ? 'Toggle NULL' : 'Column is NOT NULL'}
          className={cn(
            'rounded-sm border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider',
            isNullDraft ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted',
          )}
        >
          null
        </button>
      </div>
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  Copy,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { RedisConfig } from '@/types/connection'
import type { RedisKeyMeta, RedisKeyValue } from '@/types/redis'

interface KeyValueViewProps {
  keyName: string
  meta: RedisKeyMeta | null
  value: RedisKeyValue | null
  loading: boolean
  error: string | null
  connectionId: string
  config: RedisConfig
  onValueChanged: () => void
  onMetaChanged: (patch: Partial<RedisKeyMeta>) => void
}

export function KeyValueView({
  keyName,
  meta,
  value,
  loading,
  error,
  connectionId,
  config,
  onValueChanged,
  onMetaChanged,
}: KeyValueViewProps) {
  if (loading && !value) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Loading…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex max-w-md items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      </div>
    )
  }

  if (!meta || !value) return null

  if (value.kind === 'none') {
    return <NoneState keyName={keyName} />
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {meta.type === 'string' && value.kind === 'string' && (
        <StringView
          keyName={keyName}
          value={value.value}
          connectionId={connectionId}
          config={config}
          onSaved={onValueChanged}
        />
      )}
      {meta.type === 'list' && value.kind === 'list' && (
        <ListView
          keyName={keyName}
          values={value.value}
          connectionId={connectionId}
          config={config}
          onChanged={() => {
            onValueChanged()
            onMetaChanged({ length: null })
          }}
        />
      )}
      {meta.type === 'set' && value.kind === 'set' && (
        <SetView
          keyName={keyName}
          values={value.value}
          connectionId={connectionId}
          config={config}
          onChanged={() => {
            onValueChanged()
            onMetaChanged({ length: null })
          }}
        />
      )}
      {meta.type === 'zset' && value.kind === 'zset' && (
        <ZsetView
          keyName={keyName}
          values={value.value}
          connectionId={connectionId}
          config={config}
          onChanged={() => {
            onValueChanged()
            onMetaChanged({ length: null })
          }}
        />
      )}
      {meta.type === 'hash' && value.kind === 'hash' && (
        <HashView
          keyName={keyName}
          value={value.value}
          connectionId={connectionId}
          config={config}
          onChanged={() => {
            onValueChanged()
            onMetaChanged({ length: null })
          }}
        />
      )}
      {meta.type === 'stream' && value.kind === 'stream' && (
        <StreamView
          keyName={keyName}
          values={value.value}
          connectionId={connectionId}
          config={config}
          onChanged={() => {
            onValueChanged()
            onMetaChanged({ length: null })
          }}
        />
      )}
    </div>
  )
}

function NoneState({ keyName }: { keyName: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <div className="flex max-w-md flex-col items-center gap-2 text-xs text-muted-foreground">
        <XCircle className="h-6 w-6 text-muted-foreground/60" />
        <p>
          <span className="font-mono">{keyName}</span> does not exist.
        </p>
      </div>
    </div>
  )
}

function ValueEditDialog({
  open,
  onOpenChange,
  title,
  fields,
  onSave,
  saveLabel = 'Save',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  fields: Array<{
    name: string
    label: string
    type?: 'text' | 'number'
    placeholder?: string
    required?: boolean
    textarea?: boolean
  }>
  onSave: (values: Record<string, string>) => Promise<void> | void
  saveLabel?: string
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setValues({})
      setError(null)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    for (const f of fields) {
      if (f.required && !(values[f.name] ?? '').trim()) {
        setError(`${f.label} is required`)
        return
      }
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSave(values)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Fields marked required cannot be empty.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {fields.map((f) => (
            <div key={f.name} className="space-y-1">
              <Label htmlFor={f.name} className="text-xs">
                {f.label}
                {f.required ? ' *' : ''}
              </Label>
              {f.textarea ? (
                <textarea
                  id={f.name}
                  value={values[f.name] ?? ''}
                  onChange={(e) => setValues((p) => ({ ...p, [f.name]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  autoFocus
                />
              ) : (
                <Input
                  id={f.name}
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={values[f.name] ?? ''}
                  onChange={(e) => setValues((p) => ({ ...p, [f.name]: e.target.value }))}
                  placeholder={f.placeholder}
                  autoFocus={fields.indexOf(f) === 0}
                  className="text-xs"
                />
              )}
            </div>
          ))}
          {error && (
            <div className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {saveLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1100)
  }
  return { copied, copy }
}

function CopyButton({ text, id, copied, copy, label = 'Copy' }: {
  text: string
  id: string
  copied: string | null
  copy: (text: string, id: string) => void
  label?: string
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => copy(text, id)}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={label}
          >
            {copied === id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function StringView({
  keyName,
  value,
  connectionId,
  config,
  onSaved,
}: {
  keyName: string
  value: string | null
  connectionId: string
  config: RedisConfig
  onSaved: () => void
}) {
  const { copied, copy } = useCopy()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [pretty, setPretty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (editing) setDraft(value ?? '')
  }, [editing, value])

  const parsedJson = useMemo(() => {
    if (value == null) return null
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }, [value])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await api.redis.setString({ connectionId, config, key: keyName, value: draft })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setEditing(false)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Toolbar
        total={1}
        length={value?.length ?? 0}
        right={
          <>
            {parsedJson !== null && (
              <Button
                size="sm"
                variant={pretty ? 'secondary' : 'outline'}
                onClick={() => setPretty((p) => !p)}
                className="h-7 text-xs"
              >
                {pretty ? 'Raw' : 'Pretty JSON'}
              </Button>
            )}
            {editing ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(false)}
                  className="h-7 text-xs"
                  disabled={saving}
                >
                  <X className="mr-1 h-3 w-3" /> Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  className="h-7 text-xs"
                  disabled={saving}
                >
                  {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                  Save
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
                className="h-7 text-xs"
              >
                <Pencil className="mr-1 h-3 w-3" /> Edit
              </Button>
            )}
          </>
        }
      />

      {error && (
        <div className="mx-3 mt-2 flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      <div className="min-h-0 flex-1 p-3">
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-full w-full resize-none rounded-md border border-input bg-background p-3 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        ) : pretty && parsedJson !== null ? (
          <pre className="h-full w-full overflow-auto rounded-md border border-border bg-muted/20 p-3 font-mono text-xs leading-relaxed">
            {JSON.stringify(parsedJson, null, 2)}
          </pre>
        ) : (
          <div className="group relative h-full w-full overflow-auto rounded-md border border-border bg-muted/20 p-3 font-mono text-xs leading-relaxed">
            <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
              <CopyButton text={value ?? ''} id="string" copied={copied} copy={copy} />
            </div>
            <pre className="whitespace-pre-wrap break-all">
              {value === null ? <span className="text-muted-foreground">(nil)</span> : value}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

function ListView({
  keyName,
  values,
  connectionId,
  config,
  onChanged,
}: {
  keyName: string
  values: string[]
  connectionId: string
  config: RedisConfig
  onChanged: () => void
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { copied, copy } = useCopy()

  const handleAdd = async (vals: Record<string, string>) => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.redis.pushListElement({
        connectionId,
        config,
        key: keyName,
        value: vals.value,
        position: vals.position as 'head' | 'tail',
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (index: number) => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.redis.removeListElement({
        connectionId,
        config,
        key: keyName,
        index,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const handleSaveEdit = async () => {
    if (editing === null) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.redis.pushListElement({
        connectionId,
        config,
        key: keyName,
        value: editValue,
        position: 'head',
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      const rem = await api.redis.removeListElement({
        connectionId,
        config,
        key: keyName,
        index: editing + 1,
      })
      if (!rem.ok) {
        setError(rem.error)
        return
      }
      setEditing(null)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Toolbar
        total={values.length}
        right={
          <Button size="sm" onClick={() => setAddOpen(true)} className="h-7 text-xs">
            <Plus className="mr-1 h-3 w-3" /> Add element
          </Button>
        }
      />
      {error && (
        <div className="mx-3 mt-2 flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-0.5 p-2">
          {values.length === 0 ? (
            <EmptyList label="List is empty." />
          ) : (
            values.map((v, idx) => (
              <div
                key={idx}
                className="group flex items-start gap-2 rounded-sm border border-border bg-background px-2 py-1.5 text-xs"
              >
                <span className="w-10 shrink-0 font-mono text-[10px] text-muted-foreground">
                  [{idx}]
                </span>
                {editing === idx ? (
                  <div className="flex flex-1 items-center gap-1">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-6 text-xs"
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={handleSaveEdit}
                      disabled={busy}
                    >
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => setEditing(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <pre className="flex-1 whitespace-pre-wrap break-all font-mono text-[11px]">
                      {v}
                    </pre>
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <CopyButton text={v} id={`list-${idx}`} copied={copied} copy={copy} />
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                setEditValue(v)
                                setEditing(idx)
                              }}
                              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => void handleRemove(idx)}
                              disabled={busy}
                              className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Remove</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <ValueEditDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add list element"
        saveLabel="Add"
        onSave={handleAdd}
        fields={[
          { name: 'value', label: 'Value', required: true, textarea: true },
          { name: 'position', label: 'Position', type: 'text', placeholder: 'head or tail', required: true },
        ]}
      />
    </div>
  )
}

function SetView({
  keyName,
  values,
  connectionId,
  config,
  onChanged,
}: {
  keyName: string
  values: string[]
  connectionId: string
  config: RedisConfig
  onChanged: () => void
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { copied, copy } = useCopy()

  const handleAdd = async (vals: Record<string, string>) => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.redis.addSetMember({
        connectionId,
        config,
        key: keyName,
        member: vals.member,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (member: string) => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.redis.removeSetMember({
        connectionId,
        config,
        key: keyName,
        member,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Toolbar
        total={values.length}
        right={
          <Button size="sm" onClick={() => setAddOpen(true)} className="h-7 text-xs">
            <Plus className="mr-1 h-3 w-3" /> Add member
          </Button>
        }
      />
      {error && (
        <div className="mx-3 mt-2 flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-0.5 p-2">
          {values.length === 0 ? (
            <EmptyList label="Set is empty." />
          ) : (
            values.map((v) => (
              <div
                key={v}
                className="group flex items-start gap-2 rounded-sm border border-border bg-background px-2 py-1.5 text-xs"
              >
                <pre className="flex-1 whitespace-pre-wrap break-all font-mono text-[11px]">
                  {v}
                </pre>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <CopyButton text={v} id={`set-${v}`} copied={copied} copy={copy} />
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => void handleRemove(v)}
                          disabled={busy}
                          className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Remove</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <ValueEditDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add set member"
        saveLabel="Add"
        onSave={handleAdd}
        fields={[{ name: 'member', label: 'Member', required: true, textarea: true }]}
      />
    </div>
  )
}

function ZsetView({
  keyName,
  values,
  connectionId,
  config,
  onChanged,
}: {
  keyName: string
  values: { member: string; score: number }[]
  connectionId: string
  config: RedisConfig
  onChanged: () => void
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editScore, setEditScore] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { copied, copy } = useCopy()

  const handleAdd = async (vals: Record<string, string>) => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.redis.setZsetMember({
        connectionId,
        config,
        key: keyName,
        member: vals.member,
        score: Number(vals.score),
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (member: string) => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.redis.removeZsetMember({
        connectionId,
        config,
        key: keyName,
        member,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const handleSaveScore = async () => {
    if (!editing) return
    const score = Number(editScore)
    if (!Number.isFinite(score)) {
      setError('Score must be a number')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await api.redis.setZsetMember({
        connectionId,
        config,
        key: keyName,
        member: editing,
        score,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setEditing(null)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Toolbar
        total={values.length}
        right={
          <Button size="sm" onClick={() => setAddOpen(true)} className="h-7 text-xs">
            <Plus className="mr-1 h-3 w-3" /> Add member
          </Button>
        }
      />
      {error && (
        <div className="mx-3 mt-2 flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}
      <ScrollArea className="min-h-0 flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/2">Member</TableHead>
              <TableHead>Score</TableHead>
              <TableHead className="w-20 text-right">Ops</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {values.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-xs text-muted-foreground">
                  Sorted set is empty.
                </TableCell>
              </TableRow>
            ) : (
              values.map(({ member, score }) => (
                <TableRow key={member}>
                  <TableCell className="font-mono text-[11px]">{member}</TableCell>
                  <TableCell>
                    {editing === member ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editScore}
                          onChange={(e) => setEditScore(e.target.value)}
                          className="h-6 w-24 text-xs"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={handleSaveScore}
                          disabled={busy}
                        >
                          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => setEditing(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="font-mono text-[11px] tabular-nums">{score}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-0.5">
                      <CopyButton text={member} id={`zset-m-${member}`} copied={copied} copy={copy} />
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                setEditScore(String(score))
                                setEditing(member)
                              }}
                              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Edit score</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => void handleRemove(member)}
                              disabled={busy}
                              className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Remove</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      <ValueEditDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add zset member"
        saveLabel="Add"
        onSave={handleAdd}
        fields={[
          { name: 'member', label: 'Member', required: true, textarea: true },
          { name: 'score', label: 'Score', type: 'number', placeholder: 'e.g. 0', required: true },
        ]}
      />
    </div>
  )
}

function HashView({
  keyName,
  value,
  connectionId,
  config,
  onChanged,
}: {
  keyName: string
  value: Record<string, string>
  connectionId: string
  config: RedisConfig
  onChanged: () => void
}) {
  const [search, setSearch] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { copied, copy } = useCopy()

  const entries = useMemo(() => {
    const list = Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    if (!searchActive || !search.trim()) return list
    const q = search.trim().toLowerCase()
    return list.filter(([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q))
  }, [value, search, searchActive])

  const handleAdd = async (vals: Record<string, string>) => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.redis.setHashField({
        connectionId,
        config,
        key: keyName,
        field: vals.field,
        value: vals.value,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (field: string) => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.redis.deleteHashField({
        connectionId,
        config,
        key: keyName,
        field,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const handleSaveEdit = async () => {
    if (editing === null) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.redis.setHashField({
        connectionId,
        config,
        key: keyName,
        field: editing,
        value: editValue,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setEditing(null)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const total = Object.keys(value).length

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Toolbar
        total={total}
        right={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchActive(true)}
                placeholder="Search fields"
                className="h-7 w-44 pl-7 text-xs"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onChanged}
              className="h-7 text-xs"
              disabled={busy}
            >
              <RefreshCw className={cn('mr-1 h-3 w-3', busy && 'animate-spin')} /> Refresh
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)} className="h-7 text-xs">
              <Plus className="mr-1 h-3 w-3" /> Add field
            </Button>
          </div>
        }
      />
      {error && (
        <div className="mx-3 mt-2 flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}
      <div className="min-h-0 flex-1">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-24 text-right">Operation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-xs text-muted-foreground">
                    {searchActive && search.trim()
                      ? 'No fields match the search.'
                      : 'Hash is empty.'}
                  </TableCell>
                </TableRow>
              ) : (
                entries.map(([field, val]) => (
                  <TableRow key={field}>
                    <TableCell className="font-mono text-[11px] align-top">{field}</TableCell>
                    <TableCell className="align-top">
                      {editing === field ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-6 text-xs"
                            autoFocus
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={handleSaveEdit}
                            disabled={busy}
                          >
                            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => setEditing(null)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
                          {val}
                        </pre>
                      )}
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <div className="flex justify-end gap-0.5">
                        <CopyButton text={val} id={`hash-v-${field}`} copied={copied} copy={copy} />
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditValue(val)
                                  setEditing(field)
                                }}
                                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Edit value</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => void handleDelete(field)}
                                disabled={busy}
                                className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Delete field</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      <ValueEditDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add hash field"
        saveLabel="Add"
        onSave={handleAdd}
        fields={[
          { name: 'field', label: 'Field', required: true },
          { name: 'value', label: 'Value', required: true, textarea: true },
        ]}
      />
    </div>
  )
}

function StreamView({
  keyName,
  values,
  connectionId,
  config,
  onChanged,
}: {
  keyName: string
  values: { id: string; fields: string[] }[]
  connectionId: string
  config: RedisConfig
  onChanged: () => void
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { copied, copy } = useCopy()

  const handleAdd = async (vals: Record<string, string>) => {
    setError(null)
    try {
      const pairs = vals.fields.trim().split(/\s+/).filter(Boolean)
      if (pairs.length === 0 || pairs.length % 2 !== 0) {
        setError('Fields must be space-separated field/value pairs (e.g. name alice age 30)')
        return
      }
      const res = await api.redis.addStreamEntry({
        connectionId,
        config,
        key: keyName,
        fields: pairs,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Toolbar
        total={values.length}
        right={
          <Button size="sm" onClick={() => setAddOpen(true)} className="h-7 text-xs">
            <Plus className="mr-1 h-3 w-3" /> Add entry
          </Button>
        }
      />
      {error && (
        <div className="mx-3 mt-2 flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1.5 p-2">
          {values.length === 0 ? (
            <EmptyList label="Stream is empty." />
          ) : (
            values.map((entry) => (
              <div
                key={entry.id}
                className="rounded-md border border-border bg-background p-2"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {entry.id}
                  </span>
                  <CopyButton text={entry.id} id={`stream-${entry.id}`} copied={copied} copy={copy} />
                </div>
                <div className="space-y-0.5 font-mono text-[11px]">
                  {entry.fields.reduce<Array<[string, string]>>((acc, _, i, arr) => {
                    if (i % 2 === 0) acc.push([arr[i], arr[i + 1] ?? ''])
                    return acc
                  }, []).map(([k, v], i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="break-all">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <ValueEditDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add stream entry"
        saveLabel="Add"
        onSave={handleAdd}
        fields={[
          {
            name: 'fields',
            label: 'Field/value pairs',
            placeholder: 'field1 value1 field2 value2',
            required: true,
            textarea: true,
          },
        ]}
      />
    </div>
  )
}

function Toolbar({
  total,
  length,
  right,
}: {
  total: number
  length?: number
  right?: React.ReactNode
}) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-background px-3 text-xs">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Search className="h-3 w-3" />
        <span>Total</span>
        <span className="rounded bg-muted px-1.5 font-mono tabular-nums">{total}</span>
        {length !== undefined && length !== total && (
          <span className="font-mono text-[10px]">({length} bytes)</span>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1.5">{right}</div>
    </div>
  )
}

function EmptyList({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-border p-4 text-center text-[11px] text-muted-foreground">
      {label}
    </div>
  )
}

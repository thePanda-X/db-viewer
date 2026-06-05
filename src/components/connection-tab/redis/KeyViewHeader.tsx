import { useEffect, useState } from 'react'
import { Check, Copy, Loader2, Pencil, Trash2, X } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import type { RedisConfig } from '@/types/connection'
import type { RedisKeyMeta } from '@/types/redis'
import { KEY_TYPE_BADGE_CLASS, KEY_TYPE_LABEL, formatTtl, tryParseTtlToMs } from '@/types/redis'
import { KeyTypeIcon } from './RedisSidebar'

interface KeyViewHeaderProps {
  keyName: string
  meta: RedisKeyMeta | null
  loading: boolean
  connectionId: string
  config: RedisConfig
  onKeyDeleted: (key: string) => void
  onMetaChanged: (patch: Partial<RedisKeyMeta>) => void
}

export function KeyViewHeader({
  keyName,
  meta,
  loading,
  connectionId,
  config,
  onKeyDeleted,
  onMetaChanged,
}: KeyViewHeaderProps) {
  const [copied, setCopied] = useState(false)
  const [copiedTtl, setCopiedTtl] = useState(false)
  const [editingTtl, setEditingTtl] = useState(false)
  const [ttlDraft, setTtlDraft] = useState('')
  const [ttlError, setTtlError] = useState<string | null>(null)
  const [ttlSaving, setTtlSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setEditingTtl(false)
    setTtlDraft('')
    setTtlError(null)
  }, [keyName])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(keyName)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  const handleCopyTtl = async () => {
    if (!meta) return
    await navigator.clipboard.writeText(String(meta.ttl))
    setCopiedTtl(true)
    setTimeout(() => setCopiedTtl(false), 1200)
  }

  const startEditTtl = () => {
    if (!meta) return
    setTtlDraft(meta.ttl < 0 ? '-1' : String(meta.ttl))
    setTtlError(null)
    setEditingTtl(true)
  }

  const saveTtl = async () => {
    if (!meta) return
    const ms = tryParseTtlToMs(ttlDraft)
    if (ms === null) {
      setTtlError('Use a number with optional unit: ms, s, m, h, d (or -1 / persist)')
      return
    }
    setTtlSaving(true)
    try {
      const res = await api.redis.setTtl({ connectionId, config, key: keyName, ms })
      if (!res.ok) {
        setTtlError(res.error)
        return
      }
      onMetaChanged({ ttl: ms })
      setEditingTtl(false)
    } finally {
      setTtlSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await api.redis.deleteKeys({
        connectionId,
        config,
        keys: [keyName],
      })
      if (res.ok) {
        onKeyDeleted(keyName)
        setConfirmDelete(false)
      } else {
        setDeleting(false)
        setConfirmDelete(false)
      }
    } catch {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const typeLabel = meta ? KEY_TYPE_LABEL[meta.type] : '…'

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-background px-3 text-xs">
        {meta ? (
          <span
            className={`inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-semibold ${KEY_TYPE_BADGE_CLASS[meta.type]}`}
          >
            {typeLabel}
          </span>
        ) : (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        )}

        <KeyTypeIcon type={meta?.type ?? 'none'} />

        <span className="truncate font-mono text-[11px]" title={keyName}>
          {keyName}
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleCopy}
              className="ml-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Copy key name"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>Copy key name</TooltipContent>
        </Tooltip>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">TTL</span>
          {editingTtl ? (
            <div className="flex items-center gap-1">
              <Input
                value={ttlDraft}
                onChange={(e) => setTtlDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveTtl()
                  if (e.key === 'Escape') setEditingTtl(false)
                }}
                className="h-6 w-24 text-[11px]"
                autoFocus
                placeholder="e.g. 60s"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => void saveTtl()}
                disabled={ttlSaving}
                aria-label="Save TTL"
              >
                {ttlSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setEditingTtl(false)}
                aria-label="Cancel"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <>
              <span
                className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-[11px] tabular-nums"
                title={meta ? `PTTL ${meta.ttl}` : ''}
              >
                {meta ? formatTtl(meta.ttl) : '…'}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleCopyTtl}
                    disabled={!meta}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                    aria-label="Copy TTL"
                  >
                    {copiedTtl ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Copy TTL</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={startEditTtl}
                    disabled={!meta}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                    aria-label="Edit TTL"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Edit TTL (e.g. 60s, 5m, persist)</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={() => setConfirmDelete(true)}
          disabled={loading}
          aria-label="Delete key"
          title="Delete key"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {ttlError && (
        <div className="border-b border-destructive/30 bg-destructive/5 px-3 py-1 text-[11px] text-destructive">
          {ttlError}
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete key?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono text-foreground">{keyName}</span> will be permanently
              deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
            >
              {deleting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}

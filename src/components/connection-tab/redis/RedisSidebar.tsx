import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Folder as FolderIcon,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Type as TypeIcon,
  AlertCircle,
  Hash,
  List as ListIcon,
  Star,
  Activity,
  Braces,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { RedisKeyType } from '@/types/redis'
import { KEY_TYPE_BADGE_CLASS } from '@/types/redis'

export interface RedisKeyTree {
  folders: RedisFolder[]
  rootKeys: string[]
}

export interface RedisFolder {
  name: string
  path: string
  count: number
  folders: RedisFolder[]
  keys: string[]
}

interface RedisSidebarProps {
  connectionName: string
  host: string
  db: number
  loading: boolean
  error: string | null
  tree: RedisKeyTree
  selectedKey: string | null
  onSelectKey: (key: string) => void
  onRefresh: () => void
  separator: string
  onSeparatorChange: (sep: string) => void
  filter: string
  onFilterChange: (filter: string) => void
  onRequestDeleteKey: (key: string) => void
}

export function RedisSidebar({
  connectionName,
  host,
  db,
  loading,
  error,
  tree,
  selectedKey,
  onSelectKey,
  onRefresh,
  separator,
  onSeparatorChange,
  filter,
  onFilterChange,
  onRequestDeleteKey,
}: RedisSidebarProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const f of tree.folders) {
        if (!next.has(f.path)) next.add(f.path)
      }
      return next
    })
  }, [tree])

  const toggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const totalKeys = useMemo(() => countAllKeys(tree), [tree])

  return (
    <TooltipProvider delayDuration={300}>
      <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-muted/20">
        <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-xs font-semibold tracking-tight">Keys</span>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {totalKeys}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh keys"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          </Button>
        </div>

        <div className="space-y-2 border-b border-border p-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Connection</span>
          </div>
          <div className="rounded-md border border-border bg-background p-2 text-xs">
            <div className="flex items-center gap-2">
              <KeyRound className="h-3 w-3 text-rose-500" />
              <span className="truncate font-medium" title={connectionName}>
                {connectionName}
              </span>
            </div>
            <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground" title={host}>
              {host}
            </div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">db {db}</div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <label className="w-16 text-[10px] uppercase tracking-wider text-muted-foreground">
              Separator
            </label>
            <Input
              value={separator}
              onChange={(e) => onSeparatorChange(e.target.value)}
              className="h-7 text-xs"
              maxLength={4}
            />
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder="Filter keys (substring)"
              className="h-7 pl-7 text-xs"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {error ? (
              <div className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="break-words">{error}</span>
              </div>
            ) : loading && totalKeys === 0 ? (
              <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Scanning…</span>
              </div>
            ) : totalKeys === 0 ? (
              <div className="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
                No keys found.
              </div>
            ) : (
              <div className="space-y-0.5">
                {tree.folders.map((folder) => (
                  <FolderNode
                    key={folder.path}
                    folder={folder}
                    depth={0}
                    expanded={expanded}
                    onToggle={toggle}
                    selectedKey={selectedKey}
                    onSelectKey={onSelectKey}
                    onRequestDelete={onRequestDeleteKey}
                  />
                ))}
                {tree.rootKeys.map((key) => (
                  <KeyLeaf
                    key={key}
                    keyName={key}
                    selected={selectedKey === key}
                    onSelect={onSelectKey}
                    onRequestDelete={onRequestDeleteKey}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </aside>
    </TooltipProvider>
  )
}

function countAllKeys(tree: RedisKeyTree): number {
  let n = tree.rootKeys.length
  for (const f of tree.folders) n += countFolderLeaves(f)
  return n
}

function countFolderLeaves(f: RedisFolder): number {
  let n = f.keys.length
  for (const sub of f.folders) n += countFolderLeaves(sub)
  return n
}

interface FolderNodeProps {
  folder: RedisFolder
  depth: number
  expanded: Set<string>
  onToggle: (path: string) => void
  selectedKey: string | null
  onSelectKey: (key: string) => void
  onRequestDelete: (key: string) => void
}

function FolderNode({
  folder,
  depth,
  expanded,
  onToggle,
  selectedKey,
  onSelectKey,
  onRequestDelete,
}: FolderNodeProps) {
  const isOpen = expanded.has(folder.path)
  return (
    <>
      <div
        className={cn(
          'group flex h-6 items-center gap-1 rounded-sm px-1 text-xs transition-colors',
          'hover:bg-muted',
        )}
        style={{ paddingLeft: 4 + depth * 12 }}
      >
        <button
          type="button"
          onClick={() => onToggle(folder.path)}
          className="flex flex-1 items-center gap-1 text-left"
        >
          {isOpen ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          <FolderIcon
            className={cn(
              'h-3 w-3 shrink-0',
              isOpen ? 'text-amber-500' : 'text-amber-500/70',
            )}
          />
          <span className="truncate font-mono">{folder.name}</span>
        </button>
        <span className="rounded bg-muted px-1 font-mono text-[10px] tabular-nums text-muted-foreground">
          {folder.count}
        </span>
      </div>
      {isOpen && (
        <>
          {folder.folders.map((sub) => (
            <FolderNode
              key={sub.path}
              folder={sub}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedKey={selectedKey}
              onSelectKey={onSelectKey}
              onRequestDelete={onRequestDelete}
            />
          ))}
          {folder.keys.map((key) => (
            <KeyLeaf
              key={key}
              keyName={key}
              depth={depth + 1}
              selected={selectedKey === key}
              onSelect={onSelectKey}
              onRequestDelete={onRequestDelete}
            />
          ))}
        </>
      )}
    </>
  )
}

interface KeyLeafProps {
  keyName: string
  depth?: number
  selected: boolean
  onSelect: (key: string) => void
  onRequestDelete: (key: string) => void
}

function KeyLeaf({ keyName, depth = 0, selected, onSelect, onRequestDelete }: KeyLeafProps) {
  return (
    <div
      className={cn(
        'group flex h-6 items-center gap-1 rounded-sm px-1 text-xs transition-colors',
        'hover:bg-muted',
        selected && 'bg-primary/10 text-primary',
      )}
      style={{ paddingLeft: 4 + depth * 12 + 12 }}
    >
      <button
        type="button"
        onClick={() => onSelect(keyName)}
        className="flex flex-1 items-center gap-1.5 text-left"
        title={keyName}
      >
        <KeyRound className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="truncate font-mono">{leafName(keyName)}</span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                void navigator.clipboard.writeText(keyName)
              }}
              className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
              aria-label="Copy key name"
            >
              <Copy className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Copy key name</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRequestDelete(keyName)
              }}
              className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete key"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Delete key</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

function leafName(keyName: string): string {
  const idx = keyName.lastIndexOf(':')
  return idx === -1 ? keyName : keyName.slice(idx + 1)
}

export function KeyTypeIcon({ type }: { type: RedisKeyType }) {
  if (type === 'none') return <KeyRound className="h-3 w-3 shrink-0 text-muted-foreground" />
  const cls = KEY_TYPE_BADGE_CLASS[type]
  return (
    <span
      className={cn(
        'inline-flex h-3.5 w-5 items-center justify-center rounded-sm border text-[9px] font-semibold',
        cls,
      )}
    >
      {type === 'string' && <TypeIcon className="h-2.5 w-2.5" />}
      {type === 'list' && <ListIcon className="h-2.5 w-2.5" />}
      {type === 'set' && <Hash className="h-2.5 w-2.5" />}
      {type === 'zset' && <Star className="h-2.5 w-2.5" />}
      {type === 'hash' && <Braces className="h-2.5 w-2.5" />}
      {type === 'stream' && <Activity className="h-2.5 w-2.5" />}
    </span>
  )
}

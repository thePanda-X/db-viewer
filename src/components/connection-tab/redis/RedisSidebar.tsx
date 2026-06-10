import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/context-menu'
import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Copy,
  Folder as FolderIcon,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  Square,
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
import { useHotkey } from '@/lib/hotkeys'
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
  activeKey: string | null
  selectedKeys: Set<string>
  onToggleSelectKey: (key: string, ctrl: boolean, shift: boolean) => void
  onCheckboxToggle: (key: string) => void
  onRefresh: () => void
  separator: string
  onSeparatorChange: (sep: string) => void
  filter: string
  onFilterChange: (filter: string) => void
  onRequestDeleteKey: (key: string) => void
  onRequestDeleteSelected: () => void
}

export function RedisSidebar({
  connectionName,
  host,
  db,
  loading,
  error,
  tree,
  activeKey,
  selectedKeys,
  onToggleSelectKey,
  onCheckboxToggle,
  onRefresh,
  separator,
  onSeparatorChange,
  filter,
  onFilterChange,
  onRequestDeleteKey,
  onRequestDeleteSelected,
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

  const filterRef = useRef<HTMLInputElement | null>(null)
  const focusFilter = useCallback(() => {
    filterRef.current?.focus()
    filterRef.current?.select()
  }, [])

  useHotkey('Mod+K', {
    label: 'Focus filter',
    group: 'Redis',
    description: 'Focus the key filter input',
    handler: focusFilter,
  })

  useHotkey('Delete', {
    label: 'Delete key(s)',
    group: 'Redis',
    description: 'Delete the selected key(s)',
    handler: () => {
      if (selectedKeys.size > 0) onRequestDeleteSelected()
    },
  })

  return (
    <TooltipProvider delayDuration={300}>
      <aside className="flex h-full w-full flex-col border-r border-border bg-muted/20">
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
              ref={filterRef}
              value={filter}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder="Filter keys (substring)"
              className="h-7 pl-7 text-xs"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="flex h-full flex-col">
            <div className="flex-1 p-2">
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
                      activeKey={activeKey}
                      selectedKeys={selectedKeys}
                      onToggleSelectKey={onToggleSelectKey}
                      onCheckboxToggle={onCheckboxToggle}
                      onRequestDelete={onRequestDeleteKey}
                      onRequestDeleteSelected={onRequestDeleteSelected}
                    />
                  ))}
                  {tree.rootKeys.map((key) => (
                    <KeyLeaf
                      key={key}
                      keyName={key}
                      depth={0}
                      activeKey={activeKey}
                      selectedKeys={selectedKeys}
                      onToggleSelectKey={onToggleSelectKey}
                      onCheckboxToggle={onCheckboxToggle}
                      onRequestDelete={onRequestDeleteKey}
                      onRequestDeleteSelected={onRequestDeleteSelected}
                    />
                  ))}
                </div>
              )}
            </div>
            {selectedKeys.size > 1 && (
              <div className="flex shrink-0 items-center gap-2 border-t border-border bg-muted/40 px-3 py-2">
                <CheckSquare className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs tabular-nums text-muted-foreground">
                  {selectedKeys.size} selected
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  className="ml-auto h-7 gap-1 px-2 text-xs"
                  onClick={onRequestDeleteSelected}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
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
  activeKey: string | null
  selectedKeys: Set<string>
  onToggleSelectKey: (key: string, ctrl: boolean, shift: boolean) => void
  onCheckboxToggle: (key: string) => void
  onRequestDelete: (key: string) => void
  onRequestDeleteSelected: () => void
}

function FolderNode({
  folder,
  depth,
  expanded,
  onToggle,
  activeKey,
  selectedKeys,
  onToggleSelectKey,
  onCheckboxToggle,
  onRequestDelete,
  onRequestDeleteSelected,
}: FolderNodeProps) {
  const isOpen = expanded.has(folder.path)

  const items: ContextMenuItem[] = [
    {
      label: 'Copy Folder Path',
      icon: <FolderIcon className="h-3.5 w-3.5 text-amber-500" />,
      onClick: () => void navigator.clipboard.writeText(folder.path),
    },
  ]

  return (
    <>
      <ContextMenu items={items}>
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
      </ContextMenu>
      {isOpen && (
        <>
          {folder.folders.map((sub) => (
            <FolderNode
              key={sub.path}
              folder={sub}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              activeKey={activeKey}
              selectedKeys={selectedKeys}
              onToggleSelectKey={onToggleSelectKey}
              onCheckboxToggle={onCheckboxToggle}
              onRequestDelete={onRequestDelete}
              onRequestDeleteSelected={onRequestDeleteSelected}
            />
          ))}
          {folder.keys.map((key) => (
            <KeyLeaf
              key={key}
              keyName={key}
              depth={depth + 1}
              activeKey={activeKey}
              selectedKeys={selectedKeys}
              onToggleSelectKey={onToggleSelectKey}
              onCheckboxToggle={onCheckboxToggle}
              onRequestDelete={onRequestDelete}
              onRequestDeleteSelected={onRequestDeleteSelected}
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
  activeKey: string | null
  selectedKeys: Set<string>
  onToggleSelectKey: (key: string, ctrl: boolean, shift: boolean) => void
  onCheckboxToggle: (key: string) => void
  onRequestDelete: (key: string) => void
  onRequestDeleteSelected: () => void
}

function KeyLeaf({
  keyName,
  depth = 0,
  activeKey,
  selectedKeys,
  onToggleSelectKey,
  onCheckboxToggle,
  onRequestDelete,
  onRequestDeleteSelected,
}: KeyLeafProps) {
  const isActive = activeKey === keyName
  const isSelected = selectedKeys.has(keyName)
  const isMultiSelected = selectedKeys.size > 1 && selectedKeys.has(keyName)

  const items: ContextMenuItem[] = [
    {
      label: 'View',
      icon: <KeyRound className="h-3.5 w-3.5" />,
      onClick: () => onToggleSelectKey(keyName, false, false),
    },
    isMultiSelected
      ? {
          label: `Copy Names (${selectedKeys.size})`,
          icon: <Copy className="h-3.5 w-3.5" />,
          onClick: () => void navigator.clipboard.writeText(Array.from(selectedKeys).join('\n')),
        }
      : {
          label: 'Copy Name',
          icon: <Copy className="h-3.5 w-3.5" />,
          onClick: () => void navigator.clipboard.writeText(keyName),
        },
    { separator: true },
    isMultiSelected
      ? {
          label: `Delete (${selectedKeys.size})`,
          icon: <Trash2 className="h-3.5 w-3.5" />,
          destructive: true,
          onClick: () => onRequestDeleteSelected(),
        }
      : {
          label: 'Delete',
          icon: <Trash2 className="h-3.5 w-3.5" />,
          destructive: true,
          onClick: () => onRequestDelete(keyName),
        },
  ]

  return (
    <ContextMenu items={items}>
      <div
        className={cn(
          'group flex h-6 items-center gap-1 rounded-sm px-1 text-xs transition-colors',
          'hover:bg-muted',
          isActive && !isSelected && 'bg-primary/10 text-primary',
          isSelected && 'bg-primary/15 text-primary',
          isSelected && !isActive && 'border-l-2 border-primary/40',
        )}
        style={{ paddingLeft: 4 + depth * 12 + 12 }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onCheckboxToggle(keyName)
          }}
          className="flex items-center justify-center rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
          aria-label={isSelected ? 'Deselect key' : 'Select key'}
        >
          {isSelected ? (
            <CheckSquare className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Square className="h-3.5 w-3.5 opacity-40 hover:opacity-80" />
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            if (e.shiftKey) {
              onToggleSelectKey(keyName, false, true)
            } else if (e.ctrlKey || e.metaKey) {
              onToggleSelectKey(keyName, true, false)
            } else {
              onToggleSelectKey(keyName, false, false)
            }
          }}
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
    </ContextMenu>
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

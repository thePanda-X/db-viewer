import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useActiveRefresh } from '@/lib/hotkeys'
import { toast } from '@/state/toastStore'
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
import { cn } from '@/lib/utils'
import type { Connection, RedisConfig } from '@/types/connection'
import type { RedisKeyMeta, RedisKeyValue } from '@/types/redis'
import { ResizableSidebar } from '@/components/ui/resizable-sidebar'
import { RedisSidebar, type RedisFolder, type RedisKeyTree } from './RedisSidebar'
import { KeyViewHeader } from './KeyViewHeader'
import { KeyValueView } from './KeyValueView'
import { CommandBar } from './CommandBar'

interface RedisTabProps {
  connection: Connection
}

const DEFAULT_SEPARATOR = ':'
const SCAN_MATCH = '*'

export function RedisTab({ connection }: RedisTabProps) {
  const config = connection.config as RedisConfig
  const [separator, setSeparator] = useState<string>(DEFAULT_SEPARATOR)
  const [filter, setFilter] = useState<string>('')
  const [keys, setKeys] = useState<string[]>([])
  const [loadingKeys, setLoadingKeys] = useState(true)
  const [keysError, setKeysError] = useState<string | null>(null)
  const [scanSeq, setScanSeq] = useState(0)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [selectionAnchorKey, setSelectionAnchorKey] = useState<string | null>(null)
  const [meta, setMeta] = useState<RedisKeyMeta | null>(null)
  const [value, setValue] = useState<RedisKeyValue | null>(null)
  const [valueLoading, setValueLoading] = useState(false)
  const [valueError, setValueError] = useState<string | null>(null)
  const [pendingDeleteKeys, setPendingDeleteKeys] = useState<string[] | null>(null)
  const [deleting, setDeleting] = useState(false)

  const refresh = useCallback(() => {
    setScanSeq((s) => s + 1)
  }, [])

  const refreshValue = useCallback(async () => {
    if (!activeKey) return
    setValueLoading(true)
    setValueError(null)
    try {
      const metaRes = await api.redis.getMeta({
        connectionId: connection.id,
        config,
        key: activeKey,
      })
      if (!metaRes.ok) {
        setValueError(metaRes.error)
        setMeta(null)
        setValue(null)
        return
      }
      const m = metaRes.meta
      setMeta(m)
      if (m.type === 'none') {
        setValue({ kind: 'none' })
        return
      }
      const vRes = await api.redis.getValue({
        connectionId: connection.id,
        config,
        key: activeKey,
        type: m.type,
      })
      if (!vRes.ok) {
        setValueError(vRes.error)
        setValue(null)
      } else {
        setValue(vRes.value)
      }
    } catch (err) {
      setValueError(err instanceof Error ? err.message : String(err))
    } finally {
      setValueLoading(false)
    }
  }, [connection.id, config, activeKey])

  const refreshAll = useCallback(() => {
    refresh()
    if (activeKey) void refreshValue()
    toast({
      message: `Refreshed ${connection.name}`,
      detail: activeKey ? `key ${activeKey}` : 'keys',
    })
  }, [refresh, refreshValue, activeKey, connection.name])

  useActiveRefresh(refreshAll, connection.name)

  useEffect(() => {
    let cancelled = false
    const match = filter.trim() === '' ? SCAN_MATCH : `*${filter.trim()}*`
    setLoadingKeys(true)
    setKeysError(null)
    api.redis
      .scanAll({ connectionId: connection.id, config, match })
      .then((res) => {
        if (cancelled) return
        if (!res.ok) {
          setKeysError(res.error)
          setKeys([])
        } else {
          setKeys(res.keys)
        }
        setLoadingKeys(false)
      })
      .catch((err) => {
        if (cancelled) return
        setKeysError(err instanceof Error ? err.message : String(err))
        setKeys([])
        setLoadingKeys(false)
      })
    return () => {
      cancelled = true
    }
  }, [connection.id, config, filter, scanSeq])

  const tree = useMemo<RedisKeyTree>(
    () => buildTree(keys, separator),
    [keys, separator],
  )

  const visibleKeys = useMemo(() => getVisibleKeyOrder(tree), [tree])

  useEffect(() => {
    void refreshValue()
  }, [refreshValue])

  useEffect(() => {
    return () => {
      void api.redis.disconnect({ connectionId: connection.id, db: config.db })
    }
  }, [connection.id, config.db])

  const handleKeysDeleted = useCallback(
    (deletedKeys: string[]) => {
      const deleted = new Set(deletedKeys)
      setKeys((prev) => prev.filter((k) => !deleted.has(k)))
      setSelectedKeys((prev) => {
        const next = new Set(prev)
        for (const k of deletedKeys) next.delete(k)
        return next
      })
      if (activeKey && deleted.has(activeKey)) {
        setActiveKey(null)
        setMeta(null)
        setValue(null)
      }
    },
    [activeKey],
  )

  const handleKeyDeleted = useCallback(
    (key: string) => {
      handleKeysDeleted([key])
    },
    [handleKeysDeleted],
  )

  const handleToggleSelectKey = useCallback(
    (key: string, ctrl: boolean, shift: boolean) => {
      if (shift && selectionAnchorKey) {
        const anchorIdx = visibleKeys.indexOf(selectionAnchorKey)
        const currentIdx = visibleKeys.indexOf(key)
        if (anchorIdx !== -1 && currentIdx !== -1) {
          const start = Math.min(anchorIdx, currentIdx)
          const end = Math.max(anchorIdx, currentIdx)
          const rangeKeys = visibleKeys.slice(start, end + 1)
          setSelectedKeys(new Set(rangeKeys))
          setActiveKey(key)
          return
        }
      }

      if (!ctrl) {
        setSelectedKeys(new Set([key]))
        setActiveKey(key)
        setSelectionAnchorKey(key)
        return
      }

      setSelectedKeys((prev) => {
        const next = new Set(prev)
        if (next.has(key)) {
          next.delete(key)
          if (next.size > 0) {
            setActiveKey(next.values().next().value ?? null)
          } else {
            setActiveKey(null)
          }
        } else {
          next.add(key)
          setActiveKey(key)
        }
        return next
      })
      setSelectionAnchorKey(key)
    },
    [selectionAnchorKey, visibleKeys],
  )

  const handleCheckboxToggle = useCallback(
    (key: string) => {
      setSelectedKeys((prev) => {
        const next = new Set(prev)
        if (next.has(key)) {
          next.delete(key)
        } else {
          next.add(key)
        }
        return next
      })
      setSelectionAnchorKey(key)
    },
    [],
  )

  const handleMetaChanged = useCallback(
    (patch: Partial<RedisKeyMeta>) => {
      setMeta((prev) => (prev ? { ...prev, ...patch } : prev))
    },
    [],
  )

  const handleValueChanged = useCallback(() => {
    void refreshValue()
  }, [refreshValue])

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteKeys || pendingDeleteKeys.length === 0) return
    setDeleting(true)
    try {
      const res = await api.redis.deleteKeys({
        connectionId: connection.id,
        config,
        keys: pendingDeleteKeys,
      })
      if (res.ok) {
        handleKeysDeleted(pendingDeleteKeys)
      }
    } finally {
      setDeleting(false)
      setPendingDeleteKeys(null)
    }
  }, [pendingDeleteKeys, connection.id, config, handleKeysDeleted])

  const host = `${config.host}:${config.port}`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <ResizableSidebar
          defaultWidth={288}
          minWidth={180}
          maxWidth={600}
          storageKey="redis-sidebar-width"
        >
          <RedisSidebar
            connectionName={connection.name}
            host={host}
            db={config.db}
            loading={loadingKeys}
            error={keysError}
            tree={tree}
            activeKey={activeKey}
            selectedKeys={selectedKeys}
            onToggleSelectKey={handleToggleSelectKey}
            onCheckboxToggle={handleCheckboxToggle}
            onRefresh={refresh}
            separator={separator}
            onSeparatorChange={setSeparator}
            filter={filter}
            onFilterChange={setFilter}
            onRequestDeleteKey={(key) => setPendingDeleteKeys([key])}
            onRequestDeleteSelected={() => {
              if (selectedKeys.size > 0) {
                setPendingDeleteKeys(Array.from(selectedKeys))
              }
            }}
          />
        </ResizableSidebar>

        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-9 shrink-0 items-center gap-3 border-b border-border bg-background px-3 text-xs">
            <KeyRound className="h-3.5 w-3.5 text-rose-500" />
            <span className="font-semibold tracking-tight">{connection.name}</span>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
              Redis
            </Badge>
            <Separator orientation="vertical" className="h-3" />
            <span className="font-mono text-[11px] text-muted-foreground">{host}</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-mono text-[11px] text-muted-foreground">db {config.db}</span>
            {loadingKeys && (
              <Loader2 className="ml-auto h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </header>

          <div
            className={cn(
              'relative min-h-0 flex-1',
              !activeKey && 'flex items-center justify-center',
            )}
          >
            {activeKey ? (
              <div className="flex h-full min-h-0 flex-col">
                <KeyViewHeader
                  keyName={activeKey}
                  meta={meta}
                  loading={valueLoading}
                  connectionId={connection.id}
                  config={config}
                  onKeyDeleted={handleKeyDeleted}
                  onMetaChanged={handleMetaChanged}
                />
                <div className="min-h-0 flex-1">
                  <KeyValueView
                    keyName={activeKey}
                    meta={meta}
                    value={value}
                    loading={valueLoading}
                    error={valueError}
                    connectionId={connection.id}
                    config={config}
                    onValueChanged={handleValueChanged}
                    onMetaChanged={handleMetaChanged}
                  />
                </div>
              </div>
            ) : (
              <EmptyState />
            )}
          </div>

          <div className="h-48 shrink-0 border-t border-border">
            <CommandBar
              connectionId={connection.id}
              config={config}
              onAfterCommand={refresh}
              currentKey={activeKey}
            />
          </div>
        </div>
      </div>

      <AlertDialog
        open={pendingDeleteKeys !== null}
        onOpenChange={(o) => !o && setPendingDeleteKeys(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {pendingDeleteKeys && pendingDeleteKeys.length > 1 ? `${pendingDeleteKeys.length} keys` : 'key'}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>This cannot be undone.</p>
                {pendingDeleteKeys && pendingDeleteKeys.length > 1 && (
                  <ScrollArea className="max-h-32 rounded border border-border">
                    <div className="space-y-0.5 p-2">
                      {pendingDeleteKeys.map((k) => (
                        <div key={k} className="truncate font-mono text-[11px] text-foreground">
                          {k}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                {pendingDeleteKeys && pendingDeleteKeys.length === 1 && (
                  <p className="font-mono text-foreground">{pendingDeleteKeys[0]}</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void handleConfirmDelete()
              }}
            >
              {deleting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-2 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold">Select a key</h3>
        <p className="text-xs text-muted-foreground">
          Pick a key from the sidebar to view or edit its value, or run a raw command below.
        </p>
      </div>
    </div>
  )
}

interface TreeNode {
  name: string
  path: string
  isLeaf: boolean
  key?: string
  childFolders: Map<string, TreeNode>
  leafCount: number
  totalLeaves: number
}

function buildTree(keys: string[], separator: string): RedisKeyTree {
  const sep = separator || ':'
  const root: TreeNode = {
    name: '__root__',
    path: '',
    isLeaf: false,
    childFolders: new Map(),
    leafCount: 0,
    totalLeaves: 0,
  }

  for (const key of keys) {
    const parts = key.split(sep)
    let node = root
    let pathAcc = ''
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      pathAcc = pathAcc === '' ? part : `${pathAcc}${sep}${part}`
      if (isLast) {
        node.leafCount += 1
      } else {
        let child = node.childFolders.get(part)
        if (!child) {
          child = {
            name: part,
            path: pathAcc,
            isLeaf: false,
            childFolders: new Map(),
            leafCount: 0,
            totalLeaves: 0,
          }
          node.childFolders.set(part, child)
        }
        node = child
      }
    }
  }

  function countLeaves(node: TreeNode): number {
    let count = node.leafCount
    for (const child of node.childFolders.values()) {
      count += countLeaves(child)
    }
    node.totalLeaves = count
    return count
  }
  countLeaves(root)

  function toFolder(node: TreeNode): RedisKeyTree['folders'][number] {
    return {
      name: node.name,
      path: node.path,
      count: node.totalLeaves,
      folders: Array.from(node.childFolders.values())
        .map(toFolder)
        .sort((a, b) => a.name.localeCompare(b.name)),
      keys: node.leafCount > 0 ? keys.filter((k) => isDirectChildOf(k, node, sep)) : [],
    }
  }

  return {
    folders: Array.from(root.childFolders.values())
      .map(toFolder)
      .sort((a, b) => a.name.localeCompare(b.name)),
    rootKeys: keys.filter((k) => !k.includes(sep)),
  }
}

function isDirectChildOf(key: string, node: TreeNode, sep: string): boolean {
  if (!key.startsWith(`${node.path}${sep}`)) return false
  const remainder = key.slice(node.path.length + sep.length)
  return !remainder.includes(sep)
}

function getVisibleKeyOrder(tree: RedisKeyTree): string[] {
  const result: string[] = []
  function dfs(folders: RedisFolder[]) {
    for (const f of folders) {
      dfs(f.folders)
      result.push(...f.keys)
    }
  }
  dfs(tree.folders)
  result.push(...tree.rootKeys)
  return result
}

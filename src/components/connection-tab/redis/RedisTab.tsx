import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import { RedisSidebar, type RedisKeyTree } from './RedisSidebar'
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [meta, setMeta] = useState<RedisKeyMeta | null>(null)
  const [value, setValue] = useState<RedisKeyValue | null>(null)
  const [valueLoading, setValueLoading] = useState(false)
  const [valueError, setValueError] = useState<string | null>(null)
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const refresh = useCallback(() => {
    setScanSeq((s) => s + 1)
  }, [])

  const refreshValue = useCallback(async () => {
    if (!selectedKey) return
    setValueLoading(true)
    setValueError(null)
    try {
      const metaRes = await api.redis.getMeta({
        connectionId: connection.id,
        config,
        key: selectedKey,
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
        key: selectedKey,
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
  }, [connection.id, config, selectedKey])

  const refreshAll = useCallback(() => {
    refresh()
    if (selectedKey) void refreshValue()
    toast({
      message: `Refreshed ${connection.name}`,
      detail: selectedKey ? `key ${selectedKey}` : 'keys',
    })
  }, [refresh, refreshValue, selectedKey, connection.name])

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

  useEffect(() => {
    void refreshValue()
  }, [refreshValue])

  useEffect(() => {
    return () => {
      void api.redis.disconnect({ connectionId: connection.id, db: config.db })
    }
  }, [connection.id, config.db])

  const handleKeyDeleted = useCallback(
    (key: string) => {
      setKeys((prev) => prev.filter((k) => k !== key))
      if (selectedKey === key) {
        setSelectedKey(null)
        setMeta(null)
        setValue(null)
      }
    },
    [selectedKey],
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
    if (!pendingDeleteKey) return
    setDeleting(true)
    try {
      const res = await api.redis.deleteKeys({
        connectionId: connection.id,
        config,
        keys: [pendingDeleteKey],
      })
      if (res.ok) {
        handleKeyDeleted(pendingDeleteKey)
      }
    } finally {
      setDeleting(false)
      setPendingDeleteKey(null)
    }
  }, [pendingDeleteKey, connection.id, config, handleKeyDeleted])

  const host = `${config.host}:${config.port}`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <RedisSidebar
          connectionName={connection.name}
          host={host}
          db={config.db}
          loading={loadingKeys}
          error={keysError}
          tree={tree}
          selectedKey={selectedKey}
          onSelectKey={setSelectedKey}
          onRefresh={refresh}
          separator={separator}
          onSeparatorChange={setSeparator}
          filter={filter}
          onFilterChange={setFilter}
          onRequestDeleteKey={setPendingDeleteKey}
        />

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
              !selectedKey && 'flex items-center justify-center',
            )}
          >
            {selectedKey ? (
              <div className="flex h-full min-h-0 flex-col">
                <KeyViewHeader
                  keyName={selectedKey}
                  meta={meta}
                  loading={valueLoading}
                  connectionId={connection.id}
                  config={config}
                  onKeyDeleted={handleKeyDeleted}
                  onMetaChanged={handleMetaChanged}
                />
                <div className="min-h-0 flex-1">
                  <KeyValueView
                    keyName={selectedKey}
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
              currentKey={selectedKey}
            />
          </div>
        </div>
      </div>

      <AlertDialog
        open={pendingDeleteKey !== null}
        onOpenChange={(o) => !o && setPendingDeleteKey(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete key?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono text-foreground">{pendingDeleteKey}</span> will be
              permanently deleted. This cannot be undone.
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

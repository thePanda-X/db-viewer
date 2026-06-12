import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  Columns3,
  Loader2,
  MessageSquare,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
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
import { api } from '@/lib/api'
import { toast } from '@/state/toastStore'
import type { RabbitMQConfig } from '@/types/connection'
import type { RabbitMQMessageInfo, RabbitMQQueueInfo } from '@/types/rabbitmq'

interface QueueDetailProps {
  connectionId: string
  config: RabbitMQConfig
  queue: RabbitMQQueueInfo
}

export function QueueDetail({ connectionId, config, queue }: QueueDetailProps) {
  const [messages, setMessages] = useState<RabbitMQMessageInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [operating, setOperating] = useState(false)

  const loadMessages = useCallback(async () => {
    setLoading(true)
    setMessagesError(null)
    try {
      const res = await api.rabbitmq.getQueueMessages({
        connectionId,
        config,
        queue: queue.name,
        count: 20,
      })
      if (!res.ok) {
        setMessagesError(res.error)
        setMessages([])
      } else {
        setMessages(res.result)
      }
    } catch (err) {
      setMessagesError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [connectionId, config, queue.name])

  useEffect(() => { void loadMessages() }, [loadMessages])

  const handlePurge = async () => {
    setOperating(true)
    try {
      const res = await api.rabbitmq.purgeQueue({ connectionId, config, queue: queue.name })
      if (!res.ok) {
        toast({ message: 'Purge failed', detail: res.error, variant: 'error' })
        return
      }
      toast({ message: 'Queue purged', detail: queue.name })
      setPurgeDialogOpen(false)
      void loadMessages()
    } catch (err) {
      toast({ message: 'Purge failed', detail: err instanceof Error ? err.message : String(err), variant: 'error' })
    } finally {
      setOperating(false)
    }
  }

  const handleDelete = async () => {
    setOperating(true)
    try {
      const res = await api.rabbitmq.deleteQueue({ connectionId, config, queue: queue.name })
      if (!res.ok) {
        toast({ message: 'Delete failed', detail: res.error, variant: 'error' })
        return
      }
      toast({ message: 'Queue deleted', detail: queue.name })
      setDeleteDialogOpen(false)
    } catch (err) {
      toast({ message: 'Delete failed', detail: err instanceof Error ? err.message : String(err), variant: 'error' })
    } finally {
      setOperating(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-9 shrink-0 items-center gap-3 border-b border-border bg-background px-3 text-xs">
        <MessageSquare className="h-3.5 w-3.5 text-orange-500" />
        <span className="font-semibold tracking-tight">{queue.name}</span>
        {queue.durable && (
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            durable
          </Badge>
        )}
        <Separator orientation="vertical" className="h-3" />
        <span className="text-muted-foreground tabular-nums">
          {queue.messages} msgs · {queue.consumers} consumers
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={loadMessages}
            disabled={loading}
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-amber-600"
            onClick={() => setPurgeDialogOpen(true)}
            disabled={queue.messages === 0}
          >
            <XCircle className="h-3 w-3" />
            Purge
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3 border-b border-border bg-muted/20 p-3 text-xs">
        <div className="rounded-md border border-border bg-background p-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Ready</div>
          <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{queue.messagesReady}</div>
        </div>
        <div className="rounded-md border border-border bg-background p-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Unacknowledged</div>
          <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{queue.messagesUnacknowledged}</div>
        </div>
        <div className="rounded-md border border-border bg-background p-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Consumers</div>
          <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums">{queue.consumers}</div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Columns3 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">Messages (peek)</span>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading messages…
              </div>
            ) : messagesError ? (
              <div className="flex items-start gap-2 p-4 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{messagesError}</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground">No messages in queue</div>
            ) : (
              <div className="divide-y divide-border">
                {messages.map((msg, i) => (
                  <div key={msg.deliveryTag} className="px-3 py-2.5 hover:bg-muted/30">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded bg-muted px-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                        #{i + 1}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        tag: {msg.deliveryTag}
                      </span>
                      {msg.redelivered && (
                        <Badge variant="outline" className="px-1 py-0 text-[10px] text-amber-600">
                          redelivered
                        </Badge>
                      )}
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                        {msg.bodySize} bytes
                      </span>
                    </div>
                    <div className="mt-1 flex items-start gap-2">
                      {msg.properties.contentType && (
                        <Badge variant="outline" className="shrink-0 px-1 py-0 text-[10px]">
                          {msg.properties.contentType}
                        </Badge>
                      )}
                      {msg.exchange && (
                        <span className="truncate font-mono text-[10px] text-muted-foreground">
                          exchange: {msg.exchange}
                        </span>
                      )}
                      {msg.routingKey && (
                        <span className="truncate font-mono text-[10px] text-muted-foreground">
                          key: {msg.routingKey}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 max-h-20 overflow-auto rounded border border-border/50 bg-muted/30 p-1.5">
                      <pre className="whitespace-pre-wrap break-all font-mono text-[10px]">
                        {typeof msg.bodyDecoded === 'string'
                          ? msg.bodyDecoded
                          : JSON.stringify(msg.bodyDecoded, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <AlertDialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Purge queue?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {queue.messages} messages from{' '}
              <span className="font-mono font-medium">{queue.name}</span>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={operating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={operating}
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={(e) => { e.preventDefault(); void handlePurge() }}
            >
              {operating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Purge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete queue?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <span className="font-mono font-medium">{queue.name}</span> and all its messages.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={operating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={operating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); void handleDelete() }}
            >
              {operating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

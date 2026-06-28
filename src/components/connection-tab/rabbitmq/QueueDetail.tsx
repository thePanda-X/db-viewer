import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Columns3,
  Copy,
  Loader2,
  Maximize2,
  MessageSquare,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { JsonView } from '@/components/ui/json-view';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from '@/state/toastStore';
import type { RabbitMQConfig } from '@/types/connection';
import type { RabbitMQMessageInfo, RabbitMQQueueInfo } from '@/types/rabbitmq';

interface QueueDetailProps {
  connectionId: string;
  config: RabbitMQConfig;
  queue: RabbitMQQueueInfo;
}

export function QueueDetail({ connectionId, config, queue }: QueueDetailProps) {
  const [messages, setMessages] = useState<RabbitMQMessageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [operating, setOperating] = useState(false);
  const [inspectMsg, setInspectMsg] = useState<RabbitMQMessageInfo | null>(
    null,
  );

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setMessagesError(null);
    try {
      const res = await api.rabbitmq.getQueueMessages({
        connectionId,
        config,
        queue: queue.name,
        count: 20,
      });
      if (!res.ok) {
        setMessagesError(res.error);
        setMessages([]);
      } else {
        setMessages(res.result);
      }
    } catch (err) {
      setMessagesError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [connectionId, config, queue.name]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const handlePurge = async () => {
    setOperating(true);
    try {
      const res = await api.rabbitmq.purgeQueue({
        connectionId,
        config,
        queue: queue.name,
      });
      if (!res.ok) {
        toast({ message: 'Purge failed', detail: res.error, variant: 'error' });
        return;
      }
      toast({ message: 'Queue purged', detail: queue.name });
      setPurgeDialogOpen(false);
      void loadMessages();
    } catch (err) {
      toast({
        message: 'Purge failed',
        detail: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setOperating(false);
    }
  };

  const handleDelete = async () => {
    setOperating(true);
    try {
      const res = await api.rabbitmq.deleteQueue({
        connectionId,
        config,
        queue: queue.name,
      });
      if (!res.ok) {
        toast({
          message: 'Delete failed',
          detail: res.error,
          variant: 'error',
        });
        return;
      }
      toast({ message: 'Queue deleted', detail: queue.name });
      setDeleteDialogOpen(false);
    } catch (err) {
      toast({
        message: 'Delete failed',
        detail: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setOperating(false);
    }
  };

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
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Ready
          </div>
          <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
            {queue.messagesReady}
          </div>
        </div>
        <div className="rounded-md border border-border bg-background p-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Unacknowledged
          </div>
          <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
            {queue.messagesUnacknowledged}
          </div>
        </div>
        <div className="rounded-md border border-border bg-background p-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Consumers
          </div>
          <div className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
            {queue.consumers}
          </div>
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
              <div className="p-4 text-xs text-muted-foreground">
                No messages in queue
              </div>
            ) : (
              <div className="divide-y divide-border">
                {messages.map((msg, i) => (
                  <div
                    key={msg.deliveryTag}
                    className="px-3 py-2.5 hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded bg-muted px-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                        #{i + 1}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        tag: {msg.deliveryTag}
                      </span>
                      {msg.redelivered && (
                        <Badge
                          variant="outline"
                          className="px-1 py-0 text-[10px] text-amber-600"
                        >
                          redelivered
                        </Badge>
                      )}
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                        {msg.bodySize} bytes
                      </span>
                    </div>
                    <div className="mt-1 flex items-start gap-2">
                      {msg.properties.contentType && (
                        <Badge
                          variant="outline"
                          className="shrink-0 px-1 py-0 text-[10px]"
                        >
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
                    <div className="group relative mt-1">
                      <div className="max-h-20 overflow-auto rounded border border-border/50 bg-muted/30 p-1.5">
                        {typeof msg.bodyDecoded === 'string' ? (
                          <JsonView
                            text={msg.bodyDecoded}
                            fallback={msg.bodyDecoded}
                            preClassName="whitespace-pre-wrap break-all font-mono text-[10px]"
                          />
                        ) : (
                          <JsonView
                            value={msg.bodyDecoded}
                            preClassName="whitespace-pre-wrap break-all font-mono text-[10px]"
                          />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setInspectMsg(msg)}
                        className="absolute right-1 top-0.5 flex h-5 w-5 items-center justify-center rounded border border-border/40 bg-background/80 text-muted-foreground/50 opacity-0 transition-all hover:border-border hover:text-foreground group-hover:opacity-100"
                        title="Inspect full message"
                      >
                        <Maximize2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <Dialog
        open={inspectMsg !== null}
        onOpenChange={(o) => {
          if (!o) setInspectMsg(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-orange-500" />
              Message
              <span className="font-mono text-xs text-muted-foreground">
                tag: {inspectMsg?.deliveryTag}
              </span>
            </DialogTitle>
          </DialogHeader>
          <MessageInspectBody message={inspectMsg} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Purge queue?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {queue.messages} messages from{' '}
              <span className="font-mono font-medium">{queue.name}</span>. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={operating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={operating}
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={(e) => {
                e.preventDefault();
                void handlePurge();
              }}
            >
              {operating ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
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
              <span className="font-mono font-medium">{queue.name}</span> and
              all its messages. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={operating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={operating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {operating ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MessageInspectBody({
  message,
}: {
  message: RabbitMQMessageInfo | null;
}) {
  const [copied, setCopied] = useState(false);

  const formatted = useMemo(() => {
    if (!message) return '';
    if (typeof message.bodyDecoded === 'string') return message.bodyDecoded;
    try {
      return JSON.stringify(message.bodyDecoded, null, 2);
    } catch {
      return String(message.bodyDecoded);
    }
  }, [message]);

  const handleCopy = useCallback(() => {
    if (!message) return;
    const raw =
      typeof message.bodyDecoded === 'string'
        ? message.bodyDecoded
        : JSON.stringify(message.bodyDecoded, null, 2);
    navigator.clipboard.writeText(raw).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [message]);

  if (!message) return null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-border bg-muted/20 p-3 text-xs">
        <Row label="Exchange" value={message.exchange || '(none)'} />
        <Row label="Routing Key" value={message.routingKey || '(none)'} />
        <Row
          label="Content Type"
          value={message.properties.contentType || '—'}
        />
        <Row
          label="Delivery Mode"
          value={
            message.properties.deliveryMode === 2
              ? 'Persistent'
              : message.properties.deliveryMode === 1
                ? 'Non-persistent'
                : '—'
          }
        />
        <Row
          label="Priority"
          value={
            message.properties.priority != null
              ? String(message.properties.priority)
              : '—'
          }
        />
        <Row label="Size" value={`${message.bodySize} bytes`} />
        {message.properties.correlationId && (
          <Row
            label="Correlation ID"
            value={message.properties.correlationId}
          />
        )}
        {message.properties.replyTo && (
          <Row label="Reply To" value={message.properties.replyTo} />
        )}
        {message.properties.messageId && (
          <Row label="Message ID" value={message.properties.messageId} />
        )}
        {message.properties.timestamp && (
          <Row label="Timestamp" value={String(message.properties.timestamp)} />
        )}
        {message.properties.type && (
          <Row label="Type" value={message.properties.type} />
        )}
      </div>

      {message.properties.headers &&
        Object.keys(message.properties.headers).length > 0 && (
          <div className="rounded-md border border-border p-3">
            <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
              Headers
            </div>
            <div className="space-y-0.5">
              {Object.entries(message.properties.headers).map(([k, v]) => (
                <div key={k} className="flex gap-2 font-mono text-[11px]">
                  <span className="shrink-0 text-muted-foreground">{k}:</span>
                  <span className="break-all text-foreground">
                    {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      <div className="rounded-md border border-border">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs font-semibold text-muted-foreground">
            Body
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Copy className="h-3 w-3" />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <ScrollArea className="max-h-[50vh]">
          {typeof message.bodyDecoded === 'string' ? (
            <JsonView
              text={message.bodyDecoded}
              fallback={formatted}
              preClassName="whitespace-pre-wrap break-all p-3 font-mono text-xs leading-relaxed"
            />
          ) : (
            <JsonView
              value={message.bodyDecoded}
              preClassName="whitespace-pre-wrap break-all p-3 font-mono text-xs leading-relaxed"
            />
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="shrink-0 text-muted-foreground">{label}:</span>
      <span className="truncate font-mono text-foreground">{value}</span>
    </div>
  );
}

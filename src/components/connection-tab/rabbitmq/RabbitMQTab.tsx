import { useCallback, useEffect, useMemo, useState } from 'react';
import { GitCompare, Loader2, Trash2, XCircle } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { useActiveRefresh, useHotkey } from '@/lib/hotkeys';
import { toast } from '@/state/toastStore';
import { cn } from '@/lib/utils';
import { ResizableSidebar } from '@/components/ui/resizable-sidebar';
import type { Connection } from '@/types/connection';
import type { RabbitMQConfig } from '@/types/connection';
import type { RabbitMQExchangeInfo, RabbitMQQueueInfo } from '@/types/rabbitmq';
import { RabbitMQSidebar, type SidebarTab } from './RabbitMQSidebar';
import { ExchangeDetail } from './ExchangeDetail';
import { QueueDetail } from './QueueDetail';

interface RabbitMQTabProps {
  connection: Connection;
}

export function RabbitMQTab({ connection }: RabbitMQTabProps) {
  const config = connection.config as RabbitMQConfig;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exchanges, setExchanges] = useState<RabbitMQExchangeInfo[]>([]);
  const [queues, setQueues] = useState<RabbitMQQueueInfo[]>([]);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('exchanges');
  const [activeExchange, setActiveExchange] = useState<string | null>(null);
  const [activeQueue, setActiveQueue] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [loadSeq, setLoadSeq] = useState(0);
  const [pendingPurgeQueue, setPendingPurgeQueue] = useState<string | null>(
    null,
  );
  const [pendingDeleteQueue, setPendingDeleteQueue] = useState<string | null>(
    null,
  );
  const [operating, setOperating] = useState(false);

  const refresh = useCallback(() => {
    setLoadSeq((s) => s + 1);
  }, []);

  const handleConfirmPurge = useCallback(async () => {
    if (!pendingPurgeQueue) return;
    setOperating(true);
    try {
      const res = await api.rabbitmq.purgeQueue({
        connectionId: connection.id,
        config,
        queue: pendingPurgeQueue,
      });
      if (!res.ok) {
        toast({ message: 'Purge failed', detail: res.error, variant: 'error' });
        return;
      }
      toast({ message: 'Queue purged', detail: pendingPurgeQueue });
      setPendingPurgeQueue(null);
      refresh();
    } catch (err) {
      toast({
        message: 'Purge failed',
        detail: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setOperating(false);
    }
  }, [pendingPurgeQueue, connection.id, config, refresh]);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteQueue) return;
    setOperating(true);
    try {
      const res = await api.rabbitmq.deleteQueue({
        connectionId: connection.id,
        config,
        queue: pendingDeleteQueue,
      });
      if (!res.ok) {
        toast({
          message: 'Delete failed',
          detail: res.error,
          variant: 'error',
        });
        return;
      }
      toast({ message: 'Queue deleted', detail: pendingDeleteQueue });
      setPendingDeleteQueue(null);
      if (activeQueue === pendingDeleteQueue) setActiveQueue(null);
      refresh();
    } catch (err) {
      toast({
        message: 'Delete failed',
        detail: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setOperating(false);
    }
  }, [pendingDeleteQueue, activeQueue, connection.id, config, refresh]);

  const refreshAll = useCallback(() => {
    refresh();
    toast({
      message: `Refreshed ${connection.name}`,
      detail: 'exchanges and queues',
    });
  }, [refresh, connection.name]);

  useActiveRefresh(refreshAll, connection.name);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      api.rabbitmq.listExchanges({ connectionId: connection.id, config }),
      api.rabbitmq.listQueues({ connectionId: connection.id, config }),
    ])
      .then(([exRes, qRes]) => {
        if (cancelled) return;
        if (!exRes.ok) {
          setError(exRes.error);
          setExchanges([]);
          setQueues([]);
        } else if (!qRes.ok) {
          setError(qRes.error);
          setExchanges([]);
          setQueues([]);
        } else {
          setExchanges(exRes.result);
          setQueues(qRes.result);
          setError(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [connection.id, config, loadSeq]);

  const activeExchangeObj = useMemo(
    () => exchanges.find((e) => e.name === activeExchange) ?? null,
    [exchanges, activeExchange],
  );
  const activeQueueObj = useMemo(
    () => queues.find((q) => q.name === activeQueue) ?? null,
    [queues, activeQueue],
  );

  useEffect(() => {
    if (!activeExchange && exchanges.length > 0 && sidebarTab === 'exchanges') {
      setActiveExchange(exchanges[0].name);
    }
  }, [exchanges, activeExchange, sidebarTab]);

  useEffect(() => {
    if (!activeQueue && queues.length > 0 && sidebarTab === 'queues') {
      setActiveQueue(queues[0].name);
    }
  }, [queues, activeQueue, sidebarTab]);

  useEffect(() => {
    return () => {
      void api.rabbitmq.disconnect({ connectionId: connection.id });
    };
  }, [connection.id]);

  useEffect(() => {
    if (sidebarTab === 'exchanges' && activeQueue) setActiveQueue(null);
    if (sidebarTab === 'queues' && activeExchange) setActiveExchange(null);
  }, [sidebarTab, activeQueue, activeExchange]);

  useHotkey('Alt+1', {
    label: 'Show exchanges',
    group: 'RabbitMQ',
    description: 'Switch to the exchanges list',
    handler: () => setSidebarTab('exchanges'),
  });

  useHotkey('Alt+2', {
    label: 'Show queues',
    group: 'RabbitMQ',
    description: 'Switch to the queues list',
    handler: () => setSidebarTab('queues'),
  });

  useHotkey('Escape', {
    label: 'Clear selection',
    group: 'RabbitMQ',
    description: 'Clear the active exchange or queue',
    handler: () => {
      setActiveExchange(null);
      setActiveQueue(null);
    },
  });

  useHotkey('Delete', {
    label: 'Delete active queue',
    group: 'RabbitMQ',
    description: 'Delete the active queue after confirmation',
    handler: () => {
      if (activeQueue) setPendingDeleteQueue(activeQueue);
    },
  });

  useHotkey('Mod+Backspace', {
    label: 'Purge active queue',
    group: 'RabbitMQ',
    description: 'Purge the active queue after confirmation',
    handler: () => {
      if (activeQueue) setPendingPurgeQueue(activeQueue);
    },
  });

  const host = `${config.host}:${config.port}`;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <ResizableSidebar
          defaultWidth={288}
          minWidth={180}
          maxWidth={600}
          storageKey="rabbitmq-sidebar-width"
        >
          <RabbitMQSidebar
            connectionName={connection.name}
            host={host}
            loading={loading}
            error={error}
            exchanges={exchanges}
            queues={queues}
            activeTab={sidebarTab}
            onTabChange={setSidebarTab}
            activeExchange={activeExchange}
            activeQueue={activeQueue}
            onSelectExchange={setActiveExchange}
            onSelectQueue={setActiveQueue}
            onRefresh={refresh}
            onRequestPurgeQueue={setPendingPurgeQueue}
            onRequestDeleteQueue={setPendingDeleteQueue}
            filter={filter}
            onFilterChange={setFilter}
          />
        </ResizableSidebar>

        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-9 shrink-0 items-center gap-3 border-b border-border bg-background px-3 text-xs">
            <GitCompare className="h-3.5 w-3.5 text-orange-500" />
            <span className="font-semibold tracking-tight">
              {connection.name}
            </span>
            <Badge
              variant="secondary"
              className="px-1.5 py-0 text-[10px] font-normal"
            >
              RabbitMQ
            </Badge>
            <Separator orientation="vertical" className="h-3" />
            <span className="font-mono text-[11px] text-muted-foreground">
              {host}
            </span>
            {loading && (
              <Loader2 className="ml-auto h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </header>

          <div
            className={cn(
              'relative min-h-0 flex-1',
              !activeExchangeObj &&
                !activeQueueObj &&
                'flex items-center justify-center',
            )}
          >
            {activeExchangeObj ? (
              <ExchangeDetail
                connectionId={connection.id}
                config={config}
                exchange={activeExchangeObj}
              />
            ) : activeQueueObj ? (
              <QueueDetail
                connectionId={connection.id}
                config={config}
                queue={activeQueueObj}
              />
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      </div>

      <AlertDialog
        open={pendingPurgeQueue !== null}
        onOpenChange={(o) => {
          if (!o) setPendingPurgeQueue(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Purge queue?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all messages from{' '}
              <span className="font-mono font-medium">{pendingPurgeQueue}</span>
              . This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={operating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={operating}
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmPurge();
              }}
            >
              {operating ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <XCircle className="mr-1 h-3 w-3" />
              )}
              Purge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingDeleteQueue !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDeleteQueue(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete queue?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <span className="font-mono font-medium">
                {pendingDeleteQueue}
              </span>{' '}
              and all its messages. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={operating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={operating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {operating ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-3 w-3" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-2 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
          <GitCompare className="h-4 w-4 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold">Select an exchange or queue</h3>
        <p className="text-xs text-muted-foreground">
          Pick an item from the sidebar to view details or publish messages.
        </p>
      </div>
    </div>
  );
}

import {
  Copy,
  Eye,
  GitCompare,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  type ContextMenuItem,
} from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from '@/state/toastStore';
import type { RabbitMQExchangeInfo, RabbitMQQueueInfo } from '@/types/rabbitmq';

export type SidebarTab = 'exchanges' | 'queues';

interface RabbitMQSidebarProps {
  connectionName: string;
  host: string;
  loading: boolean;
  error: string | null;
  exchanges: RabbitMQExchangeInfo[];
  queues: RabbitMQQueueInfo[];
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  activeExchange: string | null;
  activeQueue: string | null;
  onSelectExchange: (name: string) => void;
  onSelectQueue: (name: string) => void;
  onRefresh: () => void;
  onRequestPurgeQueue: (name: string) => void;
  onRequestDeleteQueue: (name: string) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
}

export function RabbitMQSidebar({
  connectionName,
  host,
  loading,
  error,
  exchanges,
  queues,
  activeTab,
  onTabChange,
  activeExchange,
  activeQueue,
  onSelectExchange,
  onSelectQueue,
  onRefresh,
  onRequestPurgeQueue,
  onRequestDeleteQueue,
  filter,
  onFilterChange,
}: RabbitMQSidebarProps) {
  const filteredExchanges = exchanges.filter(
    (e) => !filter || e.name.toLowerCase().includes(filter.toLowerCase()),
  );
  const filteredQueues = queues.filter(
    (q) => !filter || q.name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-muted/20">
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-semibold tracking-tight">RabbitMQ</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
        </Button>
      </div>

      <div className="space-y-2 border-b border-border p-3">
        <div className="rounded-md border border-border bg-background p-2 text-xs">
          <div className="flex items-center gap-2">
            <GitCompare className="h-3 w-3 text-orange-500" />
            <span className="truncate font-medium" title={connectionName}>
              {connectionName}
            </span>
          </div>
          <div
            className="mt-1 truncate font-mono text-[10px] text-muted-foreground"
            title={host}
          >
            {host}
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="Filter…"
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      <div className="flex shrink-0 border-b border-border">
        <button
          type="button"
          onClick={() => onTabChange('exchanges')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
            activeTab === 'exchanges'
              ? 'border-b-2 border-orange-500 text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <GitCompare className="h-3 w-3" />
          Exchanges
          <span className="rounded bg-muted px-1 font-mono text-[10px] tabular-nums">
            {exchanges.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange('queues')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
            activeTab === 'queues'
              ? 'border-b-2 border-orange-500 text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <MessageSquare className="h-3 w-3" />
          Queues
          <span className="rounded bg-muted px-1 font-mono text-[10px] tabular-nums">
            {queues.length}
          </span>
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {error}
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading…
            </div>
          ) : activeTab === 'exchanges' ? (
            filteredExchanges.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
                {filter ? 'No matching exchanges' : 'No exchanges'}
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredExchanges.map((ex) => {
                  const exchangeItems: ContextMenuItem[] = [
                    {
                      label: 'Open',
                      icon: <Eye className="h-3.5 w-3.5" />,
                      onClick: () => onSelectExchange(ex.name),
                    },
                    {
                      label: 'Copy Name',
                      icon: <Copy className="h-3.5 w-3.5" />,
                      onClick: () => {
                        void navigator.clipboard.writeText(
                          ex.name || '(AMQP default)',
                        );
                        toast({ message: 'Copied exchange name' });
                      },
                    },
                    { separator: true },
                    {
                      label: 'Refresh',
                      icon: <RefreshCw className="h-3.5 w-3.5" />,
                      onClick: () => onRefresh(),
                    },
                  ];
                  return (
                    <ContextMenu key={ex.name} items={exchangeItems}>
                      <button
                        type="button"
                        onClick={() => onSelectExchange(ex.name)}
                        className={cn(
                          'flex h-7 w-full items-center gap-2 rounded-sm px-2 text-xs transition-colors hover:bg-muted',
                          activeExchange === ex.name &&
                            'bg-primary/10 text-primary',
                        )}
                      >
                        <GitCompare className="h-3 w-3 shrink-0 text-orange-500" />
                        <span className="flex-1 truncate text-left font-mono">
                          {ex.name || '(AMQP default)'}
                        </span>
                        <span className="rounded bg-muted px-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                          {ex.type}
                        </span>
                      </button>
                    </ContextMenu>
                  );
                })}
              </div>
            )
          ) : filteredQueues.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
              {filter ? 'No matching queues' : 'No queues'}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredQueues.map((q) => {
                const queueItems: ContextMenuItem[] = [
                  {
                    label: 'Open',
                    icon: <Eye className="h-3.5 w-3.5" />,
                    onClick: () => onSelectQueue(q.name),
                  },
                  {
                    label: 'Copy Name',
                    icon: <Copy className="h-3.5 w-3.5" />,
                    onClick: () => {
                      void navigator.clipboard.writeText(q.name);
                      toast({ message: 'Copied queue name' });
                    },
                  },
                  { separator: true },
                  {
                    label: 'Purge Queue',
                    icon: <XCircle className="h-3.5 w-3.5" />,
                    onClick: () => onRequestPurgeQueue(q.name),
                  },
                  {
                    label: 'Delete Queue',
                    icon: <Trash2 className="h-3.5 w-3.5" />,
                    destructive: true,
                    onClick: () => onRequestDeleteQueue(q.name),
                  },
                ];
                return (
                  <ContextMenu key={q.name} items={queueItems}>
                    <button
                      type="button"
                      onClick={() => onSelectQueue(q.name)}
                      className={cn(
                        'flex h-7 w-full items-center gap-2 rounded-sm px-2 text-xs transition-colors hover:bg-muted',
                        activeQueue === q.name && 'bg-primary/10 text-primary',
                      )}
                    >
                      <MessageSquare className="h-3 w-3 shrink-0 text-orange-500" />
                      <span className="flex-1 truncate text-left font-mono">
                        {q.name}
                      </span>
                      <span className="rounded bg-muted px-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                        {q.messages}
                      </span>
                    </button>
                  </ContextMenu>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

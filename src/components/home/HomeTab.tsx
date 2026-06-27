import { useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useConnectionsStore } from '@/state/connectionsStore';
import { useActiveRefresh } from '@/lib/hotkeys';
import { toast } from '@/state/toastStore';
import { Button } from '@/components/ui/button';
import { ConnectionGrid } from './ConnectionGrid';
import { EmptyConnections } from './EmptyConnections';
import type { FolderFilter } from '@/components/sidebar/Sidebar';

interface HomeTabProps {
  onCreateClick?: () => void;
  folderFilter?: FolderFilter;
}

export function HomeTab({ onCreateClick, folderFilter }: HomeTabProps) {
  const connections = useConnectionsStore((s) => s.connections);
  const loading = useConnectionsStore((s) => s.loading);
  const load = useConnectionsStore((s) => s.load);

  const refresh = useCallback(() => {
    void load().then(() => {
      toast({ message: 'Connections refreshed', variant: 'info' });
    });
  }, [load]);
  useActiveRefresh(refresh, 'Connections');

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-primary">
              workspace
            </p>
            <h1 className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
              Connections
            </h1>
            <p className="mt-3 max-w-prose text-sm leading-6 text-muted-foreground">
              {connections.length === 0
                ? 'Get started by creating your first connection.'
                : `${connections.length} saved ${connections.length === 1 ? 'connection' : 'connections'}.`}
            </p>
          </div>
          {connections.length > 0 && onCreateClick && (
            <Button size="sm" onClick={onCreateClick}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New connection
            </Button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl border border-border/60 bg-card/70 p-4"
              >
                <div className="h-9 w-9 rounded-lg bg-muted" />
                <div className="mt-5 h-3 w-2/3 rounded bg-muted" />
                <div className="mt-3 h-3 w-1/2 rounded bg-muted/70" />
                <div className="mt-8 h-8 w-full rounded-lg bg-muted/60" />
              </div>
            ))}
          </div>
        ) : connections.length === 0 ? (
          <EmptyConnections onCreateClick={onCreateClick} />
        ) : (
          <ConnectionGrid folderFilter={folderFilter} />
        )}
      </div>
    </div>
  );
}

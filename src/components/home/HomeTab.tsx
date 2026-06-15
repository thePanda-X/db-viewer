import { useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useConnectionsStore } from '@/state/connectionsStore';
import { useActiveRefresh } from '@/lib/hotkeys';
import { toast } from '@/state/toastStore';
import { Button } from '@/components/ui/button';
import { ConnectionGrid } from './ConnectionGrid';
import { EmptyConnections } from './EmptyConnections';

interface HomeTabProps {
  onCreateClick?: () => void;
}

export function HomeTab({ onCreateClick }: HomeTabProps) {
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
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Connections
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
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
                className="h-32 animate-pulse rounded-xl border border-border bg-card"
              />
            ))}
          </div>
        ) : connections.length === 0 ? (
          <EmptyConnections onCreateClick={onCreateClick} />
        ) : (
          <ConnectionGrid />
        )}
      </div>
    </div>
  );
}

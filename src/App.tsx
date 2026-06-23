import { useEffect } from 'react';
import { useConnectionsStore } from '@/state/connectionsStore';
import { useTabsStore } from '@/state/tabsStore';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { UpdateManager } from '@/components/layout/UpdateManager';

export default function App() {
  const load = useConnectionsStore((s) => s.load);
  const connections = useConnectionsStore((s) => s.connections);
  const cleanupStale = useTabsStore((s) => s.cleanupStale);
  const syncConnection = useTabsStore((s) => s.syncConnection);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const presentIds = new Set(connections.map((c) => c.id));
    cleanupStale(presentIds);
  }, [connections, cleanupStale]);

  useEffect(() => {
    const unsub = useConnectionsStore.subscribe((state, prev) => {
      if (state.connections === prev.connections) return;
      state.connections.forEach((c) => {
        const prevC = prev.connections.find((p) => p.id === c.id);
        if (prevC && (prevC.name !== c.name || prevC.type !== c.type)) {
          syncConnection(c);
        }
      });
    });
    return unsub;
  }, [syncConnection]);

  return (
    <ErrorBoundary>
      <AppShell />
      <UpdateManager />
    </ErrorBoundary>
  );
}

import { useConnectionsStore } from '@/state/connectionsStore';
import { ConnectionCard } from './ConnectionCard';

export function ConnectionGrid() {
  const connections = useConnectionsStore((s) => s.connections);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {connections.map((c) => (
        <ConnectionCard key={c.id} connection={c} />
      ))}
    </div>
  );
}

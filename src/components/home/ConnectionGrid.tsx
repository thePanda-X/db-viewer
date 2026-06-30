import { useMemo } from 'react';
import { useConnectionsStore } from '@/state/connectionsStore';
import { getConnectionTypeDef } from '@/data/connectionTypes';
import { ConnectionCard } from './ConnectionCard';
import type { FolderFilter } from '@/components/sidebar/Sidebar';

interface ConnectionGridProps {
  folderFilter?: FolderFilter;
  search?: string;
}

export function ConnectionGrid({
  folderFilter,
  search = '',
}: ConnectionGridProps) {
  const connections = useConnectionsStore((s) => s.connections);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const folderConnections = (() => {
      if (!folderFilter || folderFilter === 'all') return connections;
      if (folderFilter === 'unsorted') {
        return connections.filter((c) => !c.folderId);
      }
      return connections.filter((c) => c.folderId === folderFilter);
    })();

    if (!term) return folderConnections;

    return folderConnections.filter((connection) => {
      const def = getConnectionTypeDef(connection.type);
      const haystack = [
        connection.name,
        def.label,
        def.subtitle(connection.config as never),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [connections, folderFilter, search]);

  if (filtered.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-card/50 p-8 text-sm text-muted-foreground">
        {search.trim()
          ? `No connections match "${search.trim()}".`
          : 'No connections in this folder yet.'}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {filtered.map((c) => (
        <ConnectionCard key={c.id} connection={c} />
      ))}
    </div>
  );
}

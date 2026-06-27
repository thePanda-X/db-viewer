import { useMemo } from 'react';
import { useConnectionsStore } from '@/state/connectionsStore';
import { ConnectionCard } from './ConnectionCard';
import type { FolderFilter } from '@/components/sidebar/Sidebar';

interface ConnectionGridProps {
  folderFilter?: FolderFilter;
}

export function ConnectionGrid({ folderFilter }: ConnectionGridProps) {
  const connections = useConnectionsStore((s) => s.connections);

  const filtered = useMemo(() => {
    if (!folderFilter || folderFilter === 'all') return connections;
    if (folderFilter === 'unsorted') {
      return connections.filter((c) => !c.folderId);
    }
    return connections.filter((c) => c.folderId === folderFilter);
  }, [connections, folderFilter]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {filtered.map((c) => (
        <ConnectionCard key={c.id} connection={c} />
      ))}
    </div>
  );
}

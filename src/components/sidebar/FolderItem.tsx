import { Folder as FolderIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Folder } from '@/types/folder';
import { FolderContextMenu } from './FolderContextMenu';

interface FolderItemProps {
  folder: Folder;
  count: number;
  selected: boolean;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
  onConnectionDrop: (connectionId: string, folderId: string) => void;
  onFolderDrop: (activeFolderId: string, targetFolderId: string) => void;
}

export function FolderItem({
  folder,
  count,
  selected,
  onClick,
  onRename,
  onDelete,
  onConnectionDrop,
  onFolderDrop,
}: FolderItemProps) {
  return (
    <button
      draggable
      onClick={onClick}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/db-vwr-folder-id', folder.id);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        event.preventDefault();
        const connectionId = event.dataTransfer.getData(
          'application/db-vwr-connection-id',
        );
        if (connectionId) {
          onConnectionDrop(connectionId, folder.id);
          return;
        }
        const draggedFolderId = event.dataTransfer.getData(
          'application/db-vwr-folder-id',
        );
        if (draggedFolderId) onFolderDrop(draggedFolderId, folder.id);
      }}
      className={cn(
        'group flex w-full cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/50 active:cursor-grabbing',
        selected && 'bg-accent text-accent-foreground',
      )}
    >
      <FolderIcon
        className="h-3.5 w-3.5 shrink-0"
        style={{ color: folder.color }}
      />
      <span className="truncate flex-1">{folder.name}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {count}
      </span>
      <FolderContextMenu
        folder={folder}
        onRename={onRename}
        onDelete={onDelete}
      />
    </button>
  );
}

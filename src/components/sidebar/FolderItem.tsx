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
}

export function FolderItem({
  folder,
  count,
  selected,
  onClick,
  onRename,
  onDelete,
}: FolderItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/50',
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

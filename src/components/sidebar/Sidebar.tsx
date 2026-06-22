import { useCallback, useMemo, useState } from 'react';
import { FolderPlus, Database, Inbox } from 'lucide-react';
import { useConnectionsStore } from '@/state/connectionsStore';
import { useFoldersStore } from '@/state/foldersStore';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
import { FolderItem } from './FolderItem';
import { FolderDialog } from './FolderDialog';
import { toast } from '@/state/toastStore';
import type { Folder } from '@/types/folder';

export type FolderFilter = 'all' | 'unsorted' | string;

interface SidebarProps {
  selectedFilter: FolderFilter;
  onSelectFilter: (filter: FolderFilter) => void;
}

export function Sidebar({ selectedFilter, onSelectFilter }: SidebarProps) {
  const connections = useConnectionsStore((s) => s.connections);
  const updateConnection = useConnectionsStore((s) => s.update);
  const folders = useFoldersStore((s) => s.folders);
  const addFolder = useFoldersStore((s) => s.add);
  const updateFolder = useFoldersStore((s) => s.update);
  const removeFolder = useFoldersStore((s) => s.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Folder | undefined>();

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of connections) {
      const key = c.folderId ?? '__unsorted__';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [connections]);

  const handleCreate = useCallback(() => {
    setEditingFolder(undefined);
    setDialogOpen(true);
  }, []);

  const handleRename = useCallback((folder: Folder) => {
    setEditingFolder(folder);
    setDialogOpen(true);
  }, []);

  const handleDeleteRequest = useCallback((folder: Folder) => {
    setDeleteTarget(folder);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    for (const c of connections) {
      if (c.folderId === deleteTarget.id) {
        await updateConnection(c.id, { folderId: null });
      }
    }
    await removeFolder(deleteTarget.id);
    if (selectedFilter === deleteTarget.id) {
      onSelectFilter('all');
    }
    setDeleteTarget(undefined);
    toast({
      message: `Folder "${deleteTarget.name}" deleted`,
      variant: 'info',
    });
  }, [
    deleteTarget,
    connections,
    updateConnection,
    removeFolder,
    selectedFilter,
    onSelectFilter,
  ]);

  const handleSave = useCallback(
    async (name: string, color: string) => {
      if (editingFolder) {
        await updateFolder(editingFolder.id, { name, color });
        toast({ message: 'Folder updated', variant: 'info' });
      } else {
        await addFolder(name, color);
        toast({ message: 'Folder created', variant: 'info' });
      }
    },
    [editingFolder, updateFolder, addFolder],
  );

  return (
    <div className="flex h-full w-full flex-col border-r border-border bg-muted/30">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Folders
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCreate}
          title="New folder"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-0.5 px-2 pb-2">
          <button
            onClick={() => onSelectFilter('all')}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/50 ${
              selectedFilter === 'all' ? 'bg-accent text-accent-foreground' : ''
            }`}
          >
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex-1">All Connections</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {connections.length}
            </span>
          </button>

          {connections.some((c) => !c.folderId) && (
            <button
              onClick={() => onSelectFilter('unsorted')}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/50 ${
                selectedFilter === 'unsorted'
                  ? 'bg-accent text-accent-foreground'
                  : ''
              }`}
            >
              <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1">Unsorted</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {folderCounts['__unsorted__'] ?? 0}
              </span>
            </button>
          )}

          {folders.length > 0 && connections.some((c) => c.folderId) && (
            <>
              <Separator className="my-1" />
              {folders.map((folder) => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  count={folderCounts[folder.id] ?? 0}
                  selected={selectedFilter === folder.id}
                  onClick={() => onSelectFilter(folder.id)}
                  onRename={() => handleRename(folder)}
                  onDelete={() => handleDeleteRequest(folder)}
                />
              ))}
            </>
          )}
        </div>
      </ScrollArea>

      <FolderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        folder={editingFolder}
        onSave={handleSave}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>{' '}
              will be deleted. Connections in this folder will become unsorted.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

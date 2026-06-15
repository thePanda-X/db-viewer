import { useState } from 'react';
import { MoreHorizontal, Pencil, Play, Trash2 } from 'lucide-react';
import type { Connection } from '@/types/connection';
import { getConnectionTypeDef } from '@/data/connectionTypes';
import { useTabsStore } from '@/state/tabsStore';
import { useConnectionsStore } from '@/state/connectionsStore';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { ConnectionDialog } from '@/components/connection-dialog/ConnectionDialog';

interface ConnectionCardProps {
  connection: Connection;
}

export function ConnectionCard({ connection }: ConnectionCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const openConnection = useTabsStore((s) => s.openConnection);
  const remove = useConnectionsStore((s) => s.remove);

  const def = getConnectionTypeDef(connection.type);
  const Icon = def.icon;
  const subtitle = def.subtitle(connection.config as never);

  const handleConnect = () => {
    openConnection(connection);
  };

  return (
    <>
      <Card className="group flex flex-col gap-3 p-4 transition-colors hover:border-foreground/20">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
              <Icon className={`h-5 w-5 ${def.brandColor}`} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold tracking-tight">
                {connection.name}
              </h3>
              <Badge
                variant="secondary"
                className="mt-1 px-1.5 py-0 text-[10px] font-normal"
              >
                {def.label}
              </Badge>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
                <span className="sr-only">Connection actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={handleConnect}>
                <Play className="mr-2 h-3.5 w-3.5" />
                Connect
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p
          className="line-clamp-1 font-mono text-xs text-muted-foreground"
          title={subtitle}
        >
          {subtitle}
        </p>
        <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Saved
          </span>
          <Button
            size="sm"
            variant="default"
            className="h-7"
            onClick={handleConnect}
          >
            <Play className="mr-1 h-3 w-3" />
            Connect
          </Button>
        </div>
      </Card>

      <ConnectionDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        connection={connection}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete connection?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">
                {connection.name}
              </span>{' '}
              will be removed and any open tab for it will close. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => remove(connection.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

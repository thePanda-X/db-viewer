import { Database, FolderPlus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyConnectionsProps {
  onCreateClick?: () => void;
}

export function EmptyConnections({ onCreateClick }: EmptyConnectionsProps) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/70 px-6 py-16 shadow-sm backdrop-blur-sm">
      <div className="relative mx-auto flex max-w-xl flex-col items-center text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25">
          <Database className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-semibold tracking-[-0.04em]">
          No connections yet
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Add PostgreSQL, SQLite, Redis, OpenSearch, Kafka, or RabbitMQ sources
          and keep them organized by project.
        </p>
        <div className="mt-6 grid w-full max-w-md grid-cols-2 gap-3 text-left text-xs text-muted-foreground">
          <div className="rounded-xl bg-muted/60 p-3 ring-1 ring-border/60">
            <Database className="mb-2 h-4 w-4 text-primary" />
            Test connections before opening a workspace.
          </div>
          <div className="rounded-xl bg-muted/60 p-3 ring-1 ring-border/60">
            <FolderPlus className="mb-2 h-4 w-4 text-primary" />
            Group saved sources into folders.
          </div>
        </div>
        {onCreateClick && (
          <Button size="sm" className="mt-6" onClick={onCreateClick}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Create your first connection
          </Button>
        )}
      </div>
    </div>
  );
}

import { Database, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyConnectionsProps {
  onCreateClick?: () => void;
}

export function EmptyConnections({ onCreateClick }: EmptyConnectionsProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Database className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="text-base font-semibold tracking-tight">
        No connections yet
      </h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Create a connection to start browsing your databases, search indices,
        and key-value stores.
      </p>
      {onCreateClick && (
        <Button size="sm" className="mt-6" onClick={onCreateClick}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Create your first connection
        </Button>
      )}
    </div>
  );
}

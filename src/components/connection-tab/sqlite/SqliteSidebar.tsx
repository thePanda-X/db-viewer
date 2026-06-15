import { useCallback, useEffect, useState } from 'react';
import {
  Copy,
  Code2,
  FileText,
  Info,
  Loader2,
  RefreshCw,
  Table2,
  Eye,
  AlertCircle,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/state/toastStore';
import {
  ContextMenu,
  type ContextMenuItem,
} from '@/components/ui/context-menu';
import type { TableInfo } from '@/types/sqlite';

export interface RefreshRefHandle {
  current: (() => void) | null;
}

interface SqliteSidebarProps {
  connectionId: string;
  filePath: string;
  selectedTable: string | null;
  onSelectTable: (table: string) => void;
  refreshRef?: RefreshRefHandle;
  onRefresh?: () => void;
}

function isError(value: unknown): value is { error: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in (value as Record<string, unknown>)
  );
}

export function SqliteSidebar({
  connectionId,
  filePath,
  selectedTable,
  onSelectTable,
  refreshRef,
  onRefresh,
}: SqliteSidebarProps) {
  const [tables, setTables] = useState<TableInfo[] | null>(null);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [loadingTables, setLoadingTables] = useState(false);
  const [tableFilter, setTableFilter] = useState('');

  const fetchTables = useCallback(async () => {
    setLoadingTables(true);
    setTablesError(null);
    try {
      const result = await api.sqlite.listTables({ connectionId, filePath });
      if (isError(result)) {
        setTablesError(result.error);
        setTables([]);
      } else {
        setTables(result);
      }
    } catch (err) {
      setTablesError(err instanceof Error ? err.message : String(err));
      setTables([]);
    } finally {
      setLoadingTables(false);
    }
  }, [connectionId, filePath]);

  useEffect(() => {
    void fetchTables();
  }, [fetchTables]);

  useEffect(() => {
    if (!refreshRef) return;
    refreshRef.current = () => {
      void fetchTables();
    };
    return () => {
      if (refreshRef) refreshRef.current = null;
    };
  }, [refreshRef, fetchTables]);

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-muted/20">
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <span className="text-xs font-semibold tracking-tight">Explorer</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => void fetchTables()}
          disabled={loadingTables}
          title="Refresh tables"
        >
          <RefreshCw
            className={cn('h-3 w-3', loadingTables && 'animate-spin')}
          />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 p-3">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <FileText className="h-3 w-3" />
              <span>Database File</span>
            </div>
            <div className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[10px] break-all">
              {filePath}
            </div>
          </div>

          <Separator />

          <div>
            <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Table2 className="h-3 w-3" />
                <span>Tables & Views</span>
              </div>
              {loadingTables && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>

            {tables && tables.length > 0 && (
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 pl-7 text-xs"
                  placeholder="Filter tables..."
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                />
              </div>
            )}

            {tablesError ? (
              <div className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="break-words">{tablesError}</span>
              </div>
            ) : !tableFilter && tables?.length === 0 && !loadingTables ? (
              <div className="rounded-md border border-dashed border-border p-2 text-center text-[11px] text-muted-foreground">
                No tables or views found
              </div>
            ) : tableFilter &&
              tables?.filter((t) =>
                t.name.toLowerCase().includes(tableFilter.toLowerCase()),
              ).length === 0 &&
              !loadingTables ? (
              <div className="rounded-md border border-dashed border-border p-2 text-center text-[11px] text-muted-foreground">
                No matches
              </div>
            ) : (
              <ul className="space-y-0.5">
                {tables
                  ?.filter(
                    (t) =>
                      !tableFilter ||
                      t.name.toLowerCase().includes(tableFilter.toLowerCase()),
                  )
                  .map((t) => {
                    const active = selectedTable === t.name;
                    const items: ContextMenuItem[] = [
                      {
                        label: 'Open',
                        icon: <Table2 className="h-3.5 w-3.5" />,
                        onClick: () => onSelectTable(t.name),
                      },
                      {
                        label: 'Copy Name',
                        icon: <Copy className="h-3.5 w-3.5" />,
                        onClick: () => {
                          void navigator.clipboard.writeText(t.name);
                          toast({ message: 'Copied table name' });
                        },
                      },
                      {
                        label: 'Copy SELECT',
                        icon: <Code2 className="h-3.5 w-3.5" />,
                        onClick: () => {
                          void navigator.clipboard.writeText(
                            `SELECT * FROM "${t.name}"`,
                          );
                          toast({ message: 'Copied SELECT query' });
                        },
                      },
                      { separator: true },
                      {
                        label: 'Refresh',
                        icon: <RefreshCw className="h-3.5 w-3.5" />,
                        onClick: () => {
                          void fetchTables();
                          onRefresh?.();
                        },
                      },
                      {
                        label: 'Properties',
                        icon: <Info className="h-3.5 w-3.5" />,
                        onClick: () => {
                          toast({
                            message: t.name,
                            detail: `Type: ${t.type}`,
                          });
                        },
                      },
                    ];
                    return (
                      <li key={t.name}>
                        <ContextMenu items={items}>
                          <button
                            type="button"
                            onClick={() => onSelectTable(t.name)}
                            className={cn(
                              'flex w-full items-center gap-1.5 rounded-sm px-1.5 py-1 text-left text-xs transition-colors',
                              'hover:bg-muted',
                              active && 'bg-primary/10 text-primary',
                            )}
                          >
                            {t.type === 'view' ? (
                              <Eye className="h-3 w-3 shrink-0 text-muted-foreground" />
                            ) : (
                              <Table2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                            )}
                            <span className="truncate font-mono">{t.name}</span>
                          </button>
                        </ContextMenu>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}

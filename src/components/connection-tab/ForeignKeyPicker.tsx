import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ForeignKeyPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referencedTable: string;
  referencedColumn: string;
  fetchRows: (
    search?: string,
  ) => Promise<{ columns: string[]; rows: unknown[][] }>;
  onSelect: (value: unknown) => void;
}

const SEARCH_DEBOUNCE_MS = 300;

export function ForeignKeyPicker({
  open,
  onOpenChange,
  referencedTable,
  referencedColumn,
  fetchRows,
  onSelect,
}: ForeignKeyPickerProps) {
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (searchQuery?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchRows(searchQuery || undefined);
        setColumns(result.columns);
        setRows(result.rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setColumns([]);
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [fetchRows],
  );

  useEffect(() => {
    if (open) {
      setSearch('');
      void load();
    }
  }, [open, load]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      void load(value);
    }, SEARCH_DEBOUNCE_MS);
  };

  const refColIdx = columns.indexOf(referencedColumn);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            Select value from{' '}
            <span className="font-mono text-xs text-muted-foreground">
              {referencedTable}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search rows…"
            className="h-8 pl-8 pr-8 text-xs"
            autoFocus
          />
          {search && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              className="absolute right-2 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex h-32 items-center justify-center text-xs text-destructive">
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
              {search ? 'No matching rows found.' : 'No rows in table.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead
                      key={col}
                      className={cn(
                        'whitespace-nowrap font-mono text-[11px]',
                        col === referencedColumn && 'text-primary',
                      )}
                    >
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow
                    key={i}
                    className="cursor-pointer"
                    onClick={() => {
                      const val = refColIdx >= 0 ? row[refColIdx] : row[0];
                      onSelect(val);
                      onOpenChange(false);
                    }}
                  >
                    {columns.map((col) => {
                      const val = row[columns.indexOf(col)];
                      return (
                        <TableCell
                          key={col}
                          className={cn(
                            'max-w-[200px] truncate font-mono text-xs',
                            col === referencedColumn &&
                              'font-medium text-primary',
                          )}
                          title={val == null ? 'NULL' : String(val)}
                        >
                          {val == null ? (
                            <span className="italic text-muted-foreground">
                              NULL
                            </span>
                          ) : (
                            String(val)
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
          <span>
            {rows.length} row{rows.length !== 1 ? 's' : ''} loaded
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

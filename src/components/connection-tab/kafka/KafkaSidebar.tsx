import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SidebarItem {
  id: string;
  primary: string;
  secondary?: string;
  badge?: string;
}

interface KafkaSidebarProps {
  items: SidebarItem[];
  loading: boolean;
  error: string | null;
  activeId: string | null;
  onSelect: (id: string) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  placeholder?: string;
}

export function KafkaSidebar({
  items,
  loading,
  error,
  activeId,
  onSelect,
  filter,
  onFilterChange,
  placeholder = 'Filter...',
}: KafkaSidebarProps) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          className="h-8 pl-7 text-xs"
          placeholder={placeholder}
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
        />
      </div>
      {error ? (
        <div className="rounded-md border border-destructive/40 p-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="p-2 text-xs text-muted-foreground">Loading...</div>
      ) : items.length === 0 ? (
        <div className="p-2 text-xs text-muted-foreground">
          {filter ? 'No matches' : 'Nothing here yet.'}
        </div>
      ) : (
        <div className="space-y-0.5">
          {items.map((item) => (
            <button
              key={item.id}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent',
                activeId === item.id && 'bg-accent text-accent-foreground',
              )}
              onClick={() => onSelect(item.id)}
            >
              <span className="min-w-0 flex-1 truncate font-medium">
                {item.primary}
              </span>
              {item.badge ? (
                <span className="shrink-0 rounded bg-muted-foreground/10 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {item.badge}
                </span>
              ) : null}
              {item.secondary && !item.badge ? (
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {item.secondary}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { Database, Home, X } from 'lucide-react';
import { useTabsStore } from '@/state/tabsStore';
import { getConnectionTypeDef } from '@/data/connectionTypes';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HOME_TAB_ID } from '@/types/tab';

export function TabStrip() {
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const setActive = useTabsStore((s) => s.setActive);
  const closeTab = useTabsStore((s) => s.closeTab);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-9 shrink-0 border-b border-border bg-background">
        <ScrollArea className="w-full">
          <div className="flex h-9 items-end gap-0.5 px-2">
            {tabs.map((tab) => {
              const isHome = tab.id === HOME_TAB_ID;
              const isActive = tab.id === activeTabId;
              const Icon = isHome
                ? Home
                : tab.type
                  ? getConnectionTypeDef(tab.type).icon
                  : Database;
              return (
                <Tooltip key={tab.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setActive(tab.id)}
                      className={cn(
                        'group relative flex h-8 items-center gap-2 rounded-t-md border-x border-t border-transparent px-3 text-xs transition-colors',
                        'hover:bg-accent/60',
                        isActive &&
                          'border-border bg-background text-foreground shadow-[0_1px_0_0_hsl(var(--background))]',
                        !isActive && 'text-muted-foreground',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="max-w-[160px] truncate">
                        {tab.title}
                      </span>
                      {!isHome && (
                        <span
                          role="button"
                          tabIndex={-1}
                          aria-label={`Close ${tab.title}`}
                          className={cn(
                            'ml-1 flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground/60 hover:bg-muted hover:text-foreground',
                            !isActive && 'opacity-0 group-hover:opacity-100',
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            closeTab(tab.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4}>
                    {tab.title}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}

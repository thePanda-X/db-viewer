import { Database, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { TabStrip } from './TabStrip';
import { TabContent } from './TabContent';
import { ConnectionDialog } from '@/components/connection-dialog/ConnectionDialog';
import { HotkeyProvider, useHotkey, useRefreshBusStore } from '@/lib/hotkeys';
import { useTabsStore } from '@/state/tabsStore';
import { HOME_TAB_ID } from '@/types/tab';
import { ShortcutsDialog } from '@/components/help/ShortcutsDialog';
import { ChangelogDialog } from '@/components/help/ChangelogDialog';
import { ToastHost } from './ToastHost';
import { Sidebar, type FolderFilter } from '@/components/sidebar/Sidebar';
import { ResizableSidebar } from '@/components/ui/resizable-sidebar';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

function GlobalHotkeys({
  onNewConnection,
  onOpenShortcuts,
}: {
  onNewConnection: () => void;
  onOpenShortcuts: () => void;
}) {
  useHotkey('Mod+R', {
    label: 'Refresh',
    group: 'App',
    description: 'Refresh the current view (e.g. reload table, re-run query)',
    handler: () => {
      const top = useRefreshBusStore.getState().top();
      if (top) top.refresh();
    },
  });

  useHotkey('F5', {
    label: 'Refresh',
    group: 'App',
    description: 'Alias for Ctrl/Cmd+R',
    handler: () => {
      const top = useRefreshBusStore.getState().top();
      if (top) top.refresh();
    },
  });

  useHotkey('Mod+N', {
    label: 'New connection',
    group: 'App',
    description: 'Open the new connection dialog',
    handler: onNewConnection,
  });

  useHotkey('Mod+W', {
    label: 'Close tab',
    group: 'Tabs',
    description: 'Close the current tab',
    handler: () => {
      const { activeTabId, closeTab } = useTabsStore.getState();
      if (activeTabId !== HOME_TAB_ID) closeTab(activeTabId);
    },
  });

  useHotkey('Mod+Alt+ArrowRight', {
    label: 'Next tab',
    group: 'Tabs',
    description: 'Switch to the next tab',
    handler: () => {
      cycleTab(1);
    },
  });

  useHotkey('Mod+Alt+ArrowLeft', {
    label: 'Previous tab',
    group: 'Tabs',
    description: 'Switch to the previous tab',
    handler: () => {
      cycleTab(-1);
    },
  });

  useHotkey('?', {
    label: 'Show shortcuts',
    group: 'App',
    description: 'Open the keyboard shortcuts cheat sheet',
    handler: onOpenShortcuts,
  });

  return (
    <>
      {Array.from({ length: 9 }, (_, i) => (
        <TabNumberHotkey key={i} index={i} />
      ))}
    </>
  );
}

function TabNumberHotkey({ index }: { index: number }) {
  const n = index + 1;
  useHotkey(`Mod+${n}`, {
    label: `Switch to tab ${n}`,
    group: 'Tabs',
    description: `Activate the ${n}${ordinalSuffix(n)} tab`,
    handler: () => {
      const { tabs, setActive } = useTabsStore.getState();
      const tab = tabs[index];
      if (tab) setActive(tab.id);
    },
  });
  return null;
}

function cycleTab(direction: 1 | -1) {
  const { tabs, activeTabId, setActive } = useTabsStore.getState();
  if (tabs.length <= 1) return;
  const idx = tabs.findIndex((t) => t.id === activeTabId);
  const next = tabs[(idx + direction + tabs.length) % tabs.length];
  if (next) setActive(next.id);
}

function ordinalSuffix(n: number): string {
  if (n === 1) return 'st';
  if (n === 2) return 'nd';
  if (n === 3) return 'rd';
  return 'th';
}

export function AppShell() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [previousVersion, setPreviousVersion] = useState<string | null>(null);
  const [folderFilter, setFolderFilter] = useState<FolderFilter>('all');
  const [version, setVersion] = useState<string | null>(null);
  const activeTabId = useTabsStore((s) => s.activeTabId);

  const isHome = activeTabId === HOME_TAB_ID;

  useEffect(() => {
    let cancelled = false;

    api.app
      .version()
      .then((appVersion) => {
        if (cancelled) return;

        setVersion(appVersion);

        const storedVersion = localStorage.getItem('db-vwr:last-seen-version');
        if (storedVersion && storedVersion !== appVersion) {
          setPreviousVersion(storedVersion);
          setChangelogOpen(true);
        }
        localStorage.setItem('db-vwr:last-seen-version', appVersion);
      })
      .catch((err) => {
        console.error('[app] failed to load version', err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return window.api.changelog.onShow(() => {
      setPreviousVersion(null);
      setChangelogOpen(true);
    });
  }, []);

  return (
    <div className="flex h-full flex-col bg-background/95">
      <HotkeyProvider />
      <GlobalHotkeys
        onNewConnection={() => setDialogOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />
      <header className="flex h-12 shrink-0 items-center border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
            <Database className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-[-0.02em]">
            db-vwr
          </span>
          {version ? (
            <span className="text-xs text-muted-foreground">v{version}</span>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto gap-2"
          onClick={() => {
            setPreviousVersion(null);
            setChangelogOpen(true);
          }}
        >
          <FileText className="h-4 w-4" />
          Changelog
        </Button>
      </header>
      <TabStrip />
      <main className="flex-1 overflow-hidden">
        {isHome ? (
          <div className="flex h-full">
            <ResizableSidebar
              defaultWidth={200}
              minWidth={160}
              maxWidth={320}
              storageKey="db-vwr:sidebar-width"
            >
              <Sidebar
                selectedFilter={folderFilter}
                onSelectFilter={setFolderFilter}
              />
            </ResizableSidebar>
            <div className="flex-1 overflow-hidden">
              <TabContent
                onCreateClick={() => setDialogOpen(true)}
                folderFilter={folderFilter}
              />
            </div>
          </div>
        ) : (
          <TabContent onCreateClick={() => setDialogOpen(true)} />
        )}
      </main>
      <ConnectionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <ChangelogDialog
        open={changelogOpen}
        onOpenChange={setChangelogOpen}
        previousVersion={previousVersion}
        currentVersion={version}
      />
      <ToastHost />
    </div>
  );
}

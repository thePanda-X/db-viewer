import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Eye,
  FileJson,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Server,
  Settings,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ResizableSidebar } from '@/components/ui/resizable-sidebar';
import { toast } from '@/state/toastStore';
import type { Connection, OpenSearchConfig } from '@/types/connection';
import type {
  OpenSearchClusterInfo,
  OpenSearchDocumentHit,
  OpenSearchHttpMethod,
  OpenSearchIndexInfo,
  OpenSearchIndexMeta,
  OpenSearchRawResponse,
  OpenSearchSearchResult,
} from '@/types/opensearch';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  type ContextMenuItem,
} from '@/components/ui/context-menu';

interface OpenSearchTabProps {
  connection: Connection;
}

const PAGE_SIZE = 25;

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function JsonBlock({
  value,
  className,
}: {
  value: unknown;
  className?: string;
}) {
  return (
    <pre
      className={cn(
        'overflow-auto rounded-md border bg-muted/30 p-3 text-xs leading-relaxed',
        className,
      )}
    >
      {pretty(value)}
    </pre>
  );
}

export function OpenSearchTab({ connection }: OpenSearchTabProps) {
  const config = connection.config as OpenSearchConfig;
  const [cluster, setCluster] = useState<OpenSearchClusterInfo | null>(null);
  const [indices, setIndices] = useState<OpenSearchIndexInfo[]>([]);
  const [indicesError, setIndicesError] = useState<string | null>(null);
  const [loadingIndices, setLoadingIndices] = useState(true);
  const [includeSystem, setIncludeSystem] = useState(false);
  const [activeIndex, setActiveIndex] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [page, setPage] = useState(0);
  const [searchResult, setSearchResult] =
    useState<OpenSearchSearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [meta, setMeta] = useState<OpenSearchIndexMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [view, setView] = useState<
    'documents' | 'mappings' | 'settings' | 'console'
  >('documents');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<OpenSearchDocumentHit | null>(null);
  const [editText, setEditText] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<OpenSearchDocumentHit | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteIndexTarget, setDeleteIndexTarget] = useState<string | null>(
    null,
  );
  const [deletingIndex, setDeletingIndex] = useState(false);

  const refreshIndices = useCallback(async () => {
    setLoadingIndices(true);
    setIndicesError(null);
    try {
      const [pingRes, indexRes] = await Promise.all([
        api.opensearch.ping({ connectionId: connection.id, config }),
        api.opensearch.listIndices({
          connectionId: connection.id,
          config,
          includeSystem,
        }),
      ]);
      if (pingRes.ok) setCluster(pingRes.result);
      if (!indexRes.ok) {
        setIndicesError(indexRes.error);
        setIndices([]);
        return;
      }
      setIndices(indexRes.result);
      setActiveIndex((current) => current ?? indexRes.result[0]?.name ?? null);
    } catch (err) {
      setIndicesError(err instanceof Error ? err.message : String(err));
      setIndices([]);
    } finally {
      setLoadingIndices(false);
    }
  }, [connection.id, config, includeSystem]);

  const refreshDocuments = useCallback(async () => {
    if (!activeIndex) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await api.opensearch.searchDocuments({
        connectionId: connection.id,
        config,
        request: {
          index: activeIndex,
          query: submittedQuery,
          from: page * PAGE_SIZE,
          size: PAGE_SIZE,
        },
      });
      if (!res.ok) {
        setSearchError(res.error);
        setSearchResult(null);
      } else {
        setSearchResult(res.result);
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : String(err));
      setSearchResult(null);
    } finally {
      setSearching(false);
    }
  }, [activeIndex, connection.id, config, page, submittedQuery]);

  const refreshMeta = useCallback(async () => {
    if (!activeIndex) return;
    setMetaLoading(true);
    setMetaError(null);
    try {
      const res = await api.opensearch.getIndexMeta({
        connectionId: connection.id,
        config,
        index: activeIndex,
      });
      if (!res.ok) {
        setMetaError(res.error);
        setMeta(null);
      } else {
        setMeta(res.result);
      }
    } catch (err) {
      setMetaError(err instanceof Error ? err.message : String(err));
      setMeta(null);
    } finally {
      setMetaLoading(false);
    }
  }, [activeIndex, connection.id, config]);

  useEffect(() => {
    void refreshIndices();
  }, [refreshIndices]);

  useEffect(() => {
    setPage(0);
    setSubmittedQuery('');
    setQuery('');
    setExpandedId(null);
    setMeta(null);
  }, [activeIndex]);

  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  useEffect(() => {
    if (view === 'mappings' || view === 'settings') void refreshMeta();
  }, [refreshMeta, view]);

  useEffect(() => {
    return () => {
      void api.opensearch.disconnect({ connectionId: connection.id });
    };
  }, [connection.id]);

  const activeInfo = useMemo(
    () => indices.find((index) => index.name === activeIndex) ?? null,
    [activeIndex, indices],
  );
  const totalPages = Math.max(
    1,
    Math.ceil((searchResult?.total ?? 0) / PAGE_SIZE),
  );

  const submitSearch = () => {
    setPage(0);
    setSubmittedQuery(query);
  };

  const beginEdit = (hit: OpenSearchDocumentHit) => {
    setEditing(hit);
    setEditText(pretty(hit.source));
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editing || !activeIndex) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(editText);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err));
      return;
    }
    setSaving(true);
    setEditError(null);
    const res = await api.opensearch.updateDocument({
      connectionId: connection.id,
      config,
      index: activeIndex,
      id: editing.id,
      source: parsed,
    });
    setSaving(false);
    if (!res.ok) {
      setEditError(res.error);
      return;
    }
    setEditing(null);
    toast({
      message: 'Document saved',
      detail: editing.id,
      variant: 'success',
    });
    void refreshDocuments();
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !activeIndex) return;
    setDeleting(true);
    const res = await api.opensearch.deleteDocument({
      connectionId: connection.id,
      config,
      index: activeIndex,
      id: deleteTarget.id,
    });
    setDeleting(false);
    if (!res.ok) {
      toast({ message: 'Delete failed', detail: res.error, variant: 'error' });
      return;
    }
    toast({
      message: 'Document deleted',
      detail: deleteTarget.id,
      variant: 'success',
    });
    setDeleteTarget(null);
    void refreshDocuments();
  };

  const confirmDeleteIndex = async () => {
    if (!deleteIndexTarget) return;
    setDeletingIndex(true);
    const res = await api.opensearch.deleteIndex({
      connectionId: connection.id,
      config,
      index: deleteIndexTarget,
    });
    setDeletingIndex(false);
    if (!res.ok) {
      toast({
        message: 'Delete index failed',
        detail: res.error,
        variant: 'error',
      });
      return;
    }
    toast({
      message: 'Index deleted',
      detail: deleteIndexTarget,
      variant: 'success',
    });
    if (activeIndex === deleteIndexTarget) setActiveIndex(null);
    setDeleteIndexTarget(null);
    void refreshIndices();
  };

  return (
    <div className="flex h-full min-h-0 bg-background">
      <ResizableSidebar
        storageKey="db-vwr-opensearch-sidebar"
        minWidth={220}
        maxWidth={420}
        defaultWidth={290}
        className="border-r bg-muted/20"
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="space-y-3 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Server className="h-4 w-4 text-emerald-500" />
                  <span className="truncate">{connection.name}</span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {cluster
                    ? `${cluster.clusterName} / ${cluster.version}`
                    : `${config.host}:${config.port}`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void refreshIndices()}
                disabled={loadingIndices}
              >
                {loadingIndices ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <label className="flex items-center gap-2">
                <input
                  checked={includeSystem}
                  onChange={(e) => setIncludeSystem(e.target.checked)}
                  type="checkbox"
                />
                Show system indices
              </label>
              {cluster?.status ? (
                <Badge variant="secondary">{cluster.status}</Badge>
              ) : null}
            </div>
          </div>
          <Separator />
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-2">
              {indicesError ? (
                <div className="rounded-md border border-destructive/40 p-3 text-xs text-destructive">
                  {indicesError}
                </div>
              ) : null}
              {!indicesError && loadingIndices ? (
                <div className="p-3 text-xs text-muted-foreground">
                  Loading indices...
                </div>
              ) : null}
              {!loadingIndices && indices.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground">
                  No indices found.
                </div>
              ) : null}
              {indices.map((index) => {
                const menuItems: ContextMenuItem[] = [
                  {
                    label: 'Open',
                    icon: <Search className="h-3.5 w-3.5" />,
                    onClick: () => setActiveIndex(index.name),
                  },
                  {
                    label: 'Copy Index Name',
                    icon: <Copy className="h-3.5 w-3.5" />,
                    onClick: () => {
                      void navigator.clipboard.writeText(index.name);
                      toast({ message: 'Copied index name' });
                    },
                  },
                  { separator: true },
                  {
                    label: 'View Mappings',
                    icon: <Eye className="h-3.5 w-3.5" />,
                    onClick: () => {
                      setActiveIndex(index.name);
                      setView('mappings');
                    },
                  },
                  {
                    label: 'View Settings',
                    icon: <Settings className="h-3.5 w-3.5" />,
                    onClick: () => {
                      setActiveIndex(index.name);
                      setView('settings');
                    },
                  },
                  { separator: true },
                  {
                    label: 'Refresh',
                    icon: <RefreshCw className="h-3.5 w-3.5" />,
                    onClick: () => void refreshIndices(),
                  },
                  {
                    label: 'Properties',
                    icon: <Info className="h-3.5 w-3.5" />,
                    onClick: () =>
                      toast({
                        message: index.name,
                        detail: `${index.docsCount ?? 0} docs | ${index.storeSize ?? '0b'} | Health: ${index.health}`,
                      }),
                  },
                  { separator: true },
                  {
                    label: 'Delete Index',
                    icon: <Trash2 className="h-3.5 w-3.5" />,
                    destructive: true,
                    onClick: () => setDeleteIndexTarget(index.name),
                  },
                ];
                return (
                  <ContextMenu key={index.name} items={menuItems}>
                    <button
                      className={cn(
                        'mb-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent',
                        activeIndex === index.name &&
                          'bg-accent text-accent-foreground',
                      )}
                      onClick={() => setActiveIndex(index.name)}
                    >
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          healthColor(index.health),
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {index.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {index.docsCount ?? '0'}
                      </span>
                    </button>
                  </ContextMenu>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </ResizableSidebar>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-semibold">
                  {activeIndex ?? 'Select an index'}
                </h1>
                {activeInfo ? (
                  <Badge variant="outline">
                    {activeInfo.storeSize ?? '0b'}
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {activeInfo
                  ? `${activeInfo.docsCount ?? 0} docs / ${activeInfo.primaryShards ?? '?'} primary shards`
                  : 'Browse documents, mappings, settings, or run raw REST requests.'}
              </p>
            </div>
            <div className="flex gap-1 rounded-md border p-1">
              {(['documents', 'mappings', 'settings', 'console'] as const).map(
                (item) => (
                  <Button
                    key={item}
                    variant={view === item ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setView(item)}
                  >
                    {item}
                  </Button>
                ),
              )}
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          {view === 'documents' ? (
            <DocumentsView
              activeIndex={activeIndex}
              deleteIndexTarget={deleteIndexTarget}
              deleteTarget={deleteTarget}
              deleting={deleting}
              deletingIndex={deletingIndex}
              editing={editing}
              editError={editError}
              editText={editText}
              expandedId={expandedId}
              page={page}
              query={query}
              result={searchResult}
              saving={saving}
              searchError={searchError}
              searching={searching}
              totalPages={totalPages}
              onBeginEdit={beginEdit}
              onCancelDelete={() => setDeleteTarget(null)}
              onCancelDeleteIndex={() => setDeleteIndexTarget(null)}
              onCancelEdit={() => setEditing(null)}
              onConfirmDelete={confirmDelete}
              onConfirmDeleteIndex={confirmDeleteIndex}
              onDelete={setDeleteTarget}
              onEditText={setEditText}
              onPage={setPage}
              onQuery={setQuery}
              onRefresh={refreshDocuments}
              onSaveEdit={saveEdit}
              onSearch={submitSearch}
              onToggleExpand={setExpandedId}
            />
          ) : view === 'console' ? (
            <RestConsole connectionId={connection.id} config={config} />
          ) : (
            <MetaView
              error={metaError}
              loading={metaLoading}
              value={view === 'mappings' ? meta?.mappings : meta?.settings}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function healthColor(health: string): string {
  if (health === 'green') return 'bg-emerald-500';
  if (health === 'yellow') return 'bg-yellow-500';
  if (health === 'red') return 'bg-red-500';
  return 'bg-muted-foreground';
}

function DocumentsView(props: {
  activeIndex: string | null;
  deleteIndexTarget: string | null;
  deleteTarget: OpenSearchDocumentHit | null;
  deleting: boolean;
  deletingIndex: boolean;
  editing: OpenSearchDocumentHit | null;
  editError: string | null;
  editText: string;
  expandedId: string | null;
  page: number;
  query: string;
  result: OpenSearchSearchResult | null;
  saving: boolean;
  searchError: string | null;
  searching: boolean;
  totalPages: number;
  onBeginEdit: (hit: OpenSearchDocumentHit) => void;
  onCancelDelete: () => void;
  onCancelDeleteIndex: () => void;
  onCancelEdit: () => void;
  onConfirmDelete: () => void;
  onConfirmDeleteIndex: () => void;
  onDelete: (hit: OpenSearchDocumentHit) => void;
  onEditText: (text: string) => void;
  onPage: (page: number) => void;
  onQuery: (query: string) => void;
  onRefresh: () => void;
  onSaveEdit: () => void;
  onSearch: () => void;
  onToggleExpand: (id: string | null) => void;
}) {
  if (!props.activeIndex)
    return (
      <EmptyState
        title="No index selected"
        detail="Select an index from the sidebar."
      />
    );

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSearch();
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="query_string search, e.g. status:200 AND service:api"
            value={props.query}
            onChange={(event) => props.onQuery(event.target.value)}
          />
        </div>
        <Button type="submit">Search</Button>
        <Button
          type="button"
          variant="outline"
          onClick={props.onRefresh}
          disabled={props.searching}
        >
          {props.searching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </form>

      {props.searchError ? (
        <div className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
          {props.searchError}
        </div>
      ) : null}
      {props.searching && !props.result ? (
        <EmptyState title="Searching" detail="Loading documents..." />
      ) : null}
      {props.result ? (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {props.result.total} hits in {props.result.durationMs}ms
            </span>
            <span>
              Page {props.page + 1} of {props.totalPages}
            </span>
          </div>
          <div className="space-y-2">
            {props.result.hits.map((hit) => (
              <Card key={hit.id} className="overflow-hidden">
                <button
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/40"
                  onClick={() =>
                    props.onToggleExpand(
                      props.expandedId === hit.id ? null : hit.id,
                    )
                  }
                >
                  <FileJson className="h-4 w-4 text-emerald-500" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">
                    {hit.id}
                  </span>
                  {hit.score !== null ? (
                    <Badge variant="secondary">
                      score {hit.score.toFixed(3)}
                    </Badge>
                  ) : null}
                </button>
                {props.expandedId === hit.id ? (
                  <div className="border-t p-3">
                    <div className="mb-2 flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => props.onBeginEdit(hit)}
                      >
                        Edit JSON
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => props.onDelete(hit)}
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                    </div>
                    <JsonBlock value={hit.source} />
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={props.page === 0}
              onClick={() => props.onPage(props.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={props.page + 1 >= props.totalPages}
              onClick={() => props.onPage(props.page + 1)}
            >
              Next
            </Button>
          </div>
        </>
      ) : null}

      {props.editing ? (
        <Card className="fixed left-1/2 top-1/2 z-40 w-[min(800px,calc(100vw-2rem))] max-h-[70vh] -translate-x-1/2 -translate-y-1/2 overflow-auto p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-semibold">Edit document</h2>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {props.editing.id}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={props.onCancelEdit}>
                Cancel
              </Button>
              <Button onClick={props.onSaveEdit} disabled={props.saving}>
                {props.saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
          {props.editError ? (
            <div className="mb-2 rounded-md border border-destructive/40 p-2 text-xs text-destructive">
              {props.editError}
            </div>
          ) : null}
          <textarea
            className="h-96 w-full rounded-md border bg-background p-3 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
            value={props.editText}
            onChange={(event) => props.onEditText(event.target.value)}
          />
        </Card>
      ) : null}

      {props.deleteTarget ? (
        <Card className="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 p-5 shadow-2xl">
          <h2 className="text-base font-semibold">Delete document?</h2>
          <p className="mt-2 break-all text-sm text-muted-foreground">
            {props.deleteTarget.id}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={props.onCancelDelete}
              disabled={props.deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={props.onConfirmDelete}
              disabled={props.deleting}
            >
              {props.deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </Card>
      ) : null}

      {props.deleteIndexTarget ? (
        <Card className="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 p-5 shadow-2xl">
          <h2 className="text-base font-semibold">Delete index?</h2>
          <p className="mt-2 break-all text-sm text-muted-foreground">
            {props.deleteIndexTarget}
          </p>
          <p className="mt-1 text-xs text-destructive">
            All documents in this index will be permanently removed.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={props.onCancelDeleteIndex}
              disabled={props.deletingIndex}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={props.onConfirmDeleteIndex}
              disabled={props.deletingIndex}
            >
              {props.deletingIndex ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function MetaView({
  error,
  loading,
  value,
}: {
  error: string | null;
  loading: boolean;
  value: unknown;
}) {
  if (loading)
    return (
      <EmptyState
        title="Loading metadata"
        detail="Fetching index metadata..."
      />
    );
  if (error)
    return (
      <div className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
        {error}
      </div>
    );
  if (!value)
    return (
      <EmptyState
        title="No metadata"
        detail="Select an index to inspect metadata."
      />
    );
  return <JsonBlock value={value} className="max-h-none" />;
}

function RestConsole({
  connectionId,
  config,
}: {
  connectionId: string;
  config: OpenSearchConfig;
}) {
  const [method, setMethod] = useState<OpenSearchHttpMethod>('GET');
  const [path, setPath] = useState('/_cluster/health');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<OpenSearchRawResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const execute = async () => {
    let parsed: unknown = undefined;
    if (body.trim()) {
      try {
        parsed = JSON.parse(body);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return;
      }
    }
    setRunning(true);
    setError(null);
    const res = await api.opensearch.executeRequest({
      connectionId,
      config,
      request: { method, path, body: parsed },
    });
    setRunning(false);
    if (!res.ok) {
      setError(res.error);
      setResult(null);
      return;
    }
    setResult(res.result);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select
          value={method}
          onValueChange={(value) => setMethod(value as OpenSearchHttpMethod)}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(['GET', 'POST', 'PUT', 'DELETE', 'HEAD'] as const).map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={path}
          onChange={(event) => setPath(event.target.value)}
          placeholder="/_search"
        />
        <Button onClick={execute} disabled={running}>
          {running ? 'Running...' : 'Send'}
        </Button>
      </div>
      <textarea
        className="h-52 w-full rounded-md border bg-background p-3 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={'{\n  "query": { "match_all": {} }\n}'}
      />
      {error ? (
        <div className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {result ? (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            HTTP {result.statusCode} in {result.durationMs}ms
          </div>
          <JsonBlock value={result.body} />
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

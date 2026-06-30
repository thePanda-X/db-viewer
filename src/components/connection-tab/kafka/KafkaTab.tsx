import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ResizableSidebar } from '@/components/ui/resizable-sidebar';
import { useActiveRefresh, useHotkey } from '@/lib/hotkeys';
import { toast } from '@/state/toastStore';
import type { Connection, KafkaConfig } from '@/types/connection';
import type {
  KafkaTopicInfo,
  KafkaConsumerGroupInfo,
  KafkaClusterInfo,
} from '@/types/kafka';
import { KafkaSidebar } from './KafkaSidebar';
import { KafkaTopicView } from './KafkaTopicView';
import { KafkaConsumerGroupsView } from './KafkaConsumerGroupsView';

interface KafkaTabProps {
  connection: Connection;
}

export function KafkaTab({ connection }: KafkaTabProps) {
  const config = connection.config as KafkaConfig;
  const [cluster, setCluster] = useState<KafkaClusterInfo | null>(null);
  const [topics, setTopics] = useState<KafkaTopicInfo[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const [groups, setGroups] = useState<KafkaConsumerGroupInfo[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'topics' | 'groups'>('topics');
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const filterInputRef = useRef<HTMLInputElement | null>(null);

  const loadAll = useCallback(async () => {
    setTopicsLoading(true);
    setTopicsError(null);
    setGroupsLoading(true);
    setGroupsError(null);
    try {
      const [pingRes, topicRes, groupRes] = await Promise.all([
        api.kafka.ping({ connectionId: connection.id, config }),
        api.kafka.listTopics({ connectionId: connection.id, config }),
        api.kafka.listConsumerGroups({ connectionId: connection.id, config }),
      ]);
      if (pingRes.ok) setCluster(pingRes.result);
      if (!topicRes.ok) {
        setTopicsError(topicRes.error);
        setTopics([]);
      } else {
        setTopics(topicRes.result);
      }
      if (!groupRes.ok) {
        setGroupsError(groupRes.error);
        setGroups([]);
      } else {
        setGroups(groupRes.result);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTopicsError(msg);
      setTopics([]);
      setGroupsError(msg);
      setGroups([]);
    } finally {
      setTopicsLoading(false);
      setGroupsLoading(false);
    }
  }, [connection.id, config]);

  const refresh = useCallback(() => {
    void loadAll();
  }, [loadAll]);

  const refreshAndNotify = useCallback(() => {
    void loadAll();
    toast({ message: `Refreshed ${connection.name}` });
  }, [loadAll, connection.name]);

  useActiveRefresh(refreshAndNotify, connection.name);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    return () => {
      void api.kafka.disconnect({ connectionId: connection.id });
    };
  }, [connection.id]);

  const filteredTopics = useMemo(
    () =>
      topicFilter.trim() === ''
        ? topics
        : topics.filter((t) =>
            t.name.toLowerCase().includes(topicFilter.toLowerCase()),
          ),
    [topics, topicFilter],
  );

  const filteredGroups = useMemo(
    () =>
      groupFilter.trim() === ''
        ? groups
        : groups.filter((g) =>
            g.groupId.toLowerCase().includes(groupFilter.toLowerCase()),
          ),
    [groups, groupFilter],
  );

  useHotkey('Mod+K', {
    label: 'Focus filter',
    group: 'Kafka',
    description: 'Focus the active topic or group filter',
    handler: () => {
      filterInputRef.current?.focus();
      filterInputRef.current?.select();
    },
  });

  useHotkey('Alt+1', {
    label: 'Show topics',
    group: 'Kafka',
    description: 'Switch to the topics list',
    handler: () => {
      setActiveTab('topics');
      setActiveGroup(null);
    },
  });

  useHotkey('Alt+2', {
    label: 'Show groups',
    group: 'Kafka',
    description: 'Switch to the consumer groups list',
    handler: () => {
      setActiveTab('groups');
      setActiveTopic(null);
    },
  });

  useHotkey('Escape', {
    label: 'Back to Kafka list',
    group: 'Kafka',
    description: 'Close the active topic or group detail view',
    handler: () => {
      setActiveTopic(null);
      setActiveGroup(null);
    },
  });

  return (
    <div className="flex h-full min-h-0 bg-background">
      <ResizableSidebar
        storageKey="db-vwr-kafka-sidebar"
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
                  <Layers className="h-4 w-4 text-orange-500" />
                  <span className="truncate">{connection.name}</span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {cluster
                    ? `${cluster.clusterId ?? 'Kafka'} / ${cluster.brokerCount} brokers`
                    : `${config.host}:${config.port}`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={refresh}
                disabled={topicsLoading}
              >
                {topicsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex gap-1 rounded-md border p-0.5">
              <button
                className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  activeTab === 'topics'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => {
                  setActiveTab('topics');
                  setActiveGroup(null);
                }}
              >
                Topics
              </button>
              <button
                className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  activeTab === 'groups'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => {
                  setActiveTab('groups');
                  setActiveTopic(null);
                }}
              >
                Groups
              </button>
            </div>
          </div>
          <Separator />
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-2">
              {activeTab === 'topics' ? (
                <KafkaSidebar
                  items={filteredTopics.map((t) => ({
                    id: t.name,
                    primary: t.name,
                    secondary: `${t.partitionCount} partitions`,
                    badge: t.partitionCount > 0 ? undefined : '0',
                  }))}
                  loading={topicsLoading}
                  error={topicsError}
                  activeId={activeTopic}
                  onSelect={setActiveTopic}
                  filter={topicFilter}
                  onFilterChange={setTopicFilter}
                  placeholder="Filter topics..."
                  filterInputRef={filterInputRef}
                />
              ) : (
                <KafkaSidebar
                  items={filteredGroups.map((g) => ({
                    id: g.groupId,
                    primary: g.groupId,
                    secondary: g.state,
                    badge: g.members > 0 ? `${g.members} members` : 'empty',
                  }))}
                  loading={groupsLoading}
                  error={groupsError}
                  activeId={activeGroup}
                  onSelect={setActiveGroup}
                  filter={groupFilter}
                  onFilterChange={setGroupFilter}
                  placeholder="Filter groups..."
                  filterInputRef={filterInputRef}
                />
              )}
            </div>
          </ScrollArea>
        </div>
      </ResizableSidebar>

      <main className="flex min-w-0 flex-1 flex-col">
        {activeTopic ? (
          <KafkaTopicView
            key={activeTopic}
            connectionId={connection.id}
            config={config}
            topic={activeTopic}
            onBack={() => setActiveTopic(null)}
          />
        ) : activeGroup ? (
          <KafkaConsumerGroupsView
            key={activeGroup}
            connectionId={connection.id}
            config={config}
            groupId={activeGroup}
            onBack={() => setActiveGroup(null)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex max-w-md flex-col items-center gap-2 text-center">
              <Layers className="h-8 w-8 text-orange-500/50" />
              <h2 className="text-sm font-semibold text-muted-foreground">
                {activeTab === 'topics'
                  ? 'Select a topic'
                  : 'Select a consumer group'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {activeTab === 'topics'
                  ? 'Pick a topic from the sidebar to view partitions and browse messages.'
                  : 'Pick a consumer group to view offsets and lag.'}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

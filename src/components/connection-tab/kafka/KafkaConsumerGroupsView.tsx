import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, RefreshCw, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { KafkaConfig } from '@/types/connection';
import type {
  KafkaConsumerGroupDetail,
  KafkaConsumerGroupTopic,
} from '@/types/kafka';

interface KafkaConsumerGroupsViewProps {
  connectionId: string;
  config: KafkaConfig;
  groupId: string;
  onBack: () => void;
}

export function KafkaConsumerGroupsView({
  connectionId,
  config,
  groupId,
  onBack,
}: KafkaConsumerGroupsViewProps) {
  const [detail, setDetail] = useState<KafkaConsumerGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.kafka.getConsumerGroupDetail({
        connectionId,
        config,
        groupId,
      });
      if (!res.ok) {
        setError(res.error);
        setDetail(null);
      } else {
        setDetail(res.result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [connectionId, config, groupId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading && !detail) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-5">
        <div className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
          {error}
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          Retry
        </Button>
      </div>
    );
  }

  if (!detail) return null;

  const totalLag = detail.topics.reduce(
    (sum, t) =>
      sum +
      t.partitions.reduce(
        (s, p) => s + (Number(p.lag) > 0 ? Number(p.lag) : 0),
        0,
      ),
    0,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-orange-500" />
            <h1 className="truncate text-sm font-semibold">{groupId}</h1>
            <Badge
              variant={detail.state === 'Stable' ? 'secondary' : 'outline'}
            >
              {detail.state}
            </Badge>
            {totalLag > 0 ? (
              <Badge
                variant="default"
                className="bg-amber-500 hover:bg-amber-500/80"
              >
                {totalLag} lag
              </Badge>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {detail.members} consumer{detail.members !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="space-y-6">
          {detail.topics.map((topic) => (
            <TopicLagSection key={topic.topic} topic={topic} />
          ))}
          {detail.topics.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
              No topics assigned to this group.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TopicLagSection({ topic }: { topic: KafkaConsumerGroupTopic }) {
  const topicLag = topic.partitions.reduce(
    (sum, p) => sum + (Number(p.lag) > 0 ? Number(p.lag) : 0),
    0,
  );

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-xs font-semibold">{topic.topic}</h2>
        {topicLag > 0 ? (
          <Badge
            variant="default"
            className="bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] px-1.5 py-0"
          >
            {topicLag} lag
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            synced
          </Badge>
        )}
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Partition
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                Current Offset
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                End Offset
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                Lag
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Consumer
              </th>
            </tr>
          </thead>
          <tbody>
            {topic.partitions.map((p) => (
              <tr key={p.partition} className="border-t hover:bg-accent/50">
                <td className="px-3 py-2 font-mono font-medium">
                  {p.partition}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {p.currentOffset}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {p.endOffset}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono ${Number(p.lag) > 0 ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}`}
                >
                  {p.lag}
                </td>
                <td className="max-w-[200px] truncate px-3 py-2 text-muted-foreground">
                  {p.consumerId !== '-' ? p.consumerId : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

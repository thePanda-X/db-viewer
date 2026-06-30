import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { KafkaConfig } from '@/types/connection';
import type { KafkaTopicMeta, KafkaPartitionInfo } from '@/types/kafka';
import { KafkaMessageViewer } from './KafkaMessageViewer';
import { useHotkey } from '@/lib/hotkeys';

interface KafkaTopicViewProps {
  connectionId: string;
  config: KafkaConfig;
  topic: string;
  onBack: () => void;
}

export function KafkaTopicView({
  connectionId,
  config,
  topic,
  onBack,
}: KafkaTopicViewProps) {
  const [meta, setMeta] = useState<KafkaTopicMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPartition, setSelectedPartition] = useState<number | null>(
    null,
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.kafka.getTopicMeta({ connectionId, config, topic });
      if (!res.ok) {
        setError(res.error);
        setMeta(null);
      } else {
        setMeta(res.result);
        if (res.result.partitions.length > 0 && selectedPartition === null) {
          setSelectedPartition(res.result.partitions[0].partition);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [connectionId, config, topic, selectedPartition]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useHotkey('Alt+ArrowLeft', {
    label: 'Back to topics',
    group: 'Kafka topic',
    description: 'Return to the topics list',
    handler: onBack,
  });

  useHotkey('ArrowUp', {
    label: 'Previous partition',
    group: 'Kafka topic',
    description: 'Select the previous partition',
    handler: () => {
      if (!meta || selectedPartition === null) return;
      const idx = meta.partitions.findIndex(
        (p) => p.partition === selectedPartition,
      );
      const prev = meta.partitions[Math.max(0, idx - 1)];
      if (prev) setSelectedPartition(prev.partition);
    },
  });

  useHotkey('ArrowDown', {
    label: 'Next partition',
    group: 'Kafka topic',
    description: 'Select the next partition',
    handler: () => {
      if (!meta || selectedPartition === null) return;
      const idx = meta.partitions.findIndex(
        (p) => p.partition === selectedPartition,
      );
      const next =
        meta.partitions[Math.min(meta.partitions.length - 1, idx + 1)];
      if (next) setSelectedPartition(next.partition);
    },
  });

  if (loading && !meta) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !meta) {
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold">{topic}</h1>
            {meta ? (
              <Badge variant="outline">
                {meta.partitions.length} partitions
              </Badge>
            ) : null}
          </div>
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

      <div className="min-h-0 flex-1 overflow-auto">
        {meta ? (
          <>
            <div className="p-4">
              <h2 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Partitions
              </h2>
              <PartitionsTable
                partitions={meta.partitions}
                selected={selectedPartition}
                onSelect={setSelectedPartition}
              />
            </div>

            {meta.config && Object.keys(meta.config).length > 0 ? (
              <>
                <Separator />
                <div className="p-4">
                  <h2 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Topic Config
                  </h2>
                  <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
                    {Object.entries(meta.config).map(([k, v]) => (
                      <>
                        <span className="truncate font-mono text-muted-foreground">
                          {k}
                        </span>
                        <span className="truncate font-mono text-right">
                          {v}
                        </span>
                      </>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {selectedPartition !== null ? (
              <>
                <Separator />
                <div className="flex-1 p-4">
                  <h2 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Messages — Partition {selectedPartition}
                  </h2>
                  <KafkaMessageViewer
                    connectionId={connectionId}
                    config={config}
                    topic={topic}
                    partition={selectedPartition}
                  />
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function PartitionsTable({
  partitions,
  selected,
  onSelect,
}: {
  partitions: KafkaPartitionInfo[];
  selected: number | null;
  onSelect: (p: number) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/50">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              #
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              Leader
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              Replicas
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              ISR
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">
              Messages
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">
              Start Offset
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">
              End Offset
            </th>
          </tr>
        </thead>
        <tbody>
          {partitions.map((p) => (
            <tr
              key={p.partition}
              className={`cursor-pointer border-t transition-colors hover:bg-accent/50 ${
                selected === p.partition ? 'bg-accent' : ''
              }`}
              onClick={() => onSelect(p.partition)}
            >
              <td className="px-3 py-2 font-mono font-medium">{p.partition}</td>
              <td className="px-3 py-2 font-mono">{p.leader}</td>
              <td className="px-3 py-2 font-mono">
                {p.replicas.join(', ') || '—'}
              </td>
              <td className="px-3 py-2 font-mono">{p.isr.join(', ') || '—'}</td>
              <td className="px-3 py-2 text-right font-mono">
                {Number(p.messageCount).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {p.beginningOffset}
              </td>
              <td className="px-3 py-2 text-right font-mono">{p.endOffset}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

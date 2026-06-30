import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { JsonView } from '@/components/ui/json-view';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { KafkaConfig } from '@/types/connection';
import type { KafkaConsumeResult } from '@/types/kafka';
import { useHotkey } from '@/lib/hotkeys';

interface KafkaMessageViewerProps {
  connectionId: string;
  config: KafkaConfig;
  topic: string;
  partition: number;
}

const PAGE_SIZE = 20;

export function KafkaMessageViewer({
  connectionId,
  config,
  topic,
  partition,
}: KafkaMessageViewerProps) {
  const [mode, setMode] = useState<'beginning' | 'latest' | 'offset'>(
    'beginning',
  );
  const [customOffset, setCustomOffset] = useState('0');
  const [result, setResult] = useState<KafkaConsumeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [lastOffset, setLastOffset] = useState<string>('0');

  const consume = useCallback(
    async (offset: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.kafka.consumeMessages({
          connectionId,
          config,
          topic,
          partition,
          offset,
          limit: PAGE_SIZE,
        });
        if (!res.ok) {
          setError(res.error);
          setResult(null);
        } else {
          setResult(res.result);
          if (res.result.messages.length > 0) {
            setLastOffset(
              res.result.messages[res.result.messages.length - 1].offset,
            );
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [connectionId, config, topic, partition],
  );

  useEffect(() => {
    const offset =
      mode === 'beginning' ? '0' : mode === 'latest' ? '-1' : customOffset;
    void consume(offset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consume, mode]);

  const loadMore = () => {
    if (result?.hasMore) {
      void consume(lastOffset);
    }
  };

  useHotkey('Mod+Enter', {
    label: 'Fetch messages',
    group: 'Kafka messages',
    description: 'Fetch messages for the selected partition',
    allowInInputs: true,
    handler: () => {
      void consume(mode === 'offset' ? customOffset : '0');
    },
  });

  useHotkey('Mod+ArrowDown', {
    label: 'Load more messages',
    group: 'Kafka messages',
    description: 'Load the next page of messages',
    handler: loadMore,
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      void consume(customOffset);
    }
  };

  const offsetLabel =
    mode === 'beginning'
      ? 'From beginning'
      : mode === 'latest'
        ? 'Latest messages'
        : `From offset ${customOffset}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="beginning">From beginning</SelectItem>
            <SelectItem value="latest">Latest messages</SelectItem>
            <SelectItem value="offset">Custom offset</SelectItem>
          </SelectContent>
        </Select>
        {mode === 'offset' && (
          <Input
            className="h-8 w-24 font-mono text-xs"
            placeholder="0"
            value={customOffset}
            onChange={(e) => setCustomOffset(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => void consume(mode === 'offset' ? customOffset : '0')}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Fetch'}
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 p-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {loading && !result ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {result ? (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {result.messages.length} messages {offsetLabel}
            </span>
            {result.hasMore ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  'Load more'
                )}
              </Button>
            ) : (
              <span className="text-[10px]">No more messages</span>
            )}
          </div>
          <div className="space-y-1">
            {result.messages.map((msg, idx) => (
              <div
                key={`${msg.partition}-${msg.offset}`}
                className="rounded-md border bg-card text-xs transition-colors"
              >
                <button
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40"
                  onClick={() =>
                    setExpandedIdx(expandedIdx === idx ? null : idx)
                  }
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0 w-14">
                    @{msg.offset}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono">
                    {msg.key !== null ? (
                      <span className="text-foreground">{msg.key}</span>
                    ) : null}
                    {msg.key !== null && msg.value !== null ? (
                      <span className="text-muted-foreground"> → </span>
                    ) : null}
                    {msg.value !== null ? (
                      <span className="text-muted-foreground">
                        {truncateValue(msg.value)}
                      </span>
                    ) : null}
                  </span>
                </button>
                {expandedIdx === idx ? (
                  <div className="border-t px-3 py-2 space-y-2">
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                      <span className="text-muted-foreground">Offset</span>
                      <span className="font-mono">{msg.offset}</span>
                      <span className="text-muted-foreground">Partition</span>
                      <span className="font-mono">{msg.partition}</span>
                      <span className="text-muted-foreground">Timestamp</span>
                      <span className="font-mono">{msg.timestamp}</span>
                    </div>
                    {msg.key !== null ? (
                      <>
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Key
                        </div>
                        <JsonView
                          text={msg.key}
                          fallback={msg.key}
                          preClassName="overflow-auto rounded border bg-muted/30 p-2 font-mono text-xs leading-relaxed"
                        />
                      </>
                    ) : null}
                    {msg.value !== null ? (
                      <>
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Value
                        </div>
                        <JsonView
                          text={msg.value}
                          fallback={msg.value}
                          preClassName="overflow-auto max-h-48 rounded border bg-muted/30 p-2 font-mono text-xs leading-relaxed"
                        />
                      </>
                    ) : null}
                    {Object.keys(msg.headers).length > 0 ? (
                      <>
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Headers
                        </div>
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                          {Object.entries(msg.headers).map(([k, v]) => (
                            <>
                              <span className="font-mono text-muted-foreground">
                                {k}
                              </span>
                              <span className="font-mono">{v}</span>
                            </>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function truncateValue(value: string): string {
  if (value.length <= 60) return value;
  try {
    const parsed = JSON.parse(value);
    const str = JSON.stringify(parsed);
    return str.length <= 60 ? str : str.slice(0, 57) + '...';
  } catch {
    return value.slice(0, 57) + '...';
  }
}

function formatTimestamp(ts: string): string {
  const ms = Number(ts);
  if (Number.isNaN(ms) || ms <= 0) return ts;
  const d = new Date(ms);
  try {
    return d.toLocaleString();
  } catch {
    return ts;
  }
}

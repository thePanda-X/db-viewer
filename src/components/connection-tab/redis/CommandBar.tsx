import { useCallback, useRef, useState } from 'react';
import { ChevronRight, Loader2, Send, Terminal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useHotkey } from '@/lib/hotkeys';
import type { RedisConfig } from '@/types/connection';
import type { RedisCommandReply } from '@/types/redis';

interface CommandBarProps {
  connectionId: string;
  config: RedisConfig;
  onAfterCommand?: () => void;
  currentKey: string | null;
}

interface HistoryEntry {
  id: number;
  input: string;
  ok: boolean;
  reply: RedisCommandReply;
  error: string | null;
  durationMs: number;
}

const WRITE_COMMANDS = new Set([
  'set',
  'setex',
  'psetex',
  'setnx',
  'setxx',
  'append',
  'incr',
  'incrby',
  'incrbyfloat',
  'decr',
  'decrby',
  'del',
  'unlink',
  'expire',
  'pexpire',
  'expireat',
  'pexpireat',
  'persist',
  'rename',
  'renamenx',
  'rpush',
  'lpush',
  'rpushx',
  'lpushx',
  'lpop',
  'rpop',
  'lset',
  'lrem',
  'linsert',
  'ltrim',
  'sadd',
  'srem',
  'spop',
  'smove',
  'zadd',
  'zincrby',
  'zrem',
  'zremrangebyscore',
  'zremrangebyrank',
  'zremrangebylex',
  'hset',
  'hsetnx',
  'hmset',
  'hdel',
  'hincrby',
  'hincrbyfloat',
  'xadd',
  'xdel',
  'xtrim',
  'xgroup',
  'xack',
  'flushdb',
  'flushall',
]);

export function CommandBar({
  connectionId,
  config,
  onAfterCommand,
  currentKey,
}: CommandBarProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [inputHistoryIndex, setInputHistoryIndex] = useState<number | null>(
    null,
  );
  const seqRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const tokenize = useCallback((line: string): string[] => {
    const tokens: string[] = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;
    let escaped = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (escaped) {
        current += ch;
        escaped = false;
        continue;
      }
      if (ch === '\\' && (inSingle || inDouble)) {
        escaped = true;
        continue;
      }
      if (ch === "'" && !inDouble) {
        inSingle = !inSingle;
        continue;
      }
      if (ch === '"' && !inSingle) {
        inDouble = !inDouble;
        continue;
      }
      if ((ch === ' ' || ch === '\t') && !inSingle && !inDouble) {
        if (current.length > 0) {
          tokens.push(current);
          current = '';
        }
        continue;
      }
      current += ch;
    }
    if (current.length > 0) tokens.push(current);
    return tokens;
  }, []);

  const run = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed === '' || running) return;
      const args = tokenize(trimmed);
      if (args.length === 0) return;
      const id = ++seqRef.current;
      setRunning(true);
      setInputHistory((h) => {
        const next = [trimmed, ...h.filter((x) => x !== trimmed)].slice(0, 100);
        return next;
      });
      setInputHistoryIndex(null);
      try {
        const res = await api.redis.executeCommand({
          connectionId,
          config,
          command: args,
        });
        if (id !== seqRef.current) return;
        if (res.ok) {
          setHistory((h) =>
            [
              {
                id,
                input: trimmed,
                ok: true,
                reply: res.result.reply,
                error: null,
                durationMs: res.result.durationMs,
              },
              ...h,
            ].slice(0, 50),
          );
          if (WRITE_COMMANDS.has(args[0].toLowerCase())) {
            onAfterCommand?.();
          }
        } else {
          setHistory((h) =>
            [
              {
                id,
                input: trimmed,
                ok: false,
                reply: null,
                error: res.error,
                durationMs: 0,
              },
              ...h,
            ].slice(0, 50),
          );
        }
      } catch (err) {
        if (id !== seqRef.current) return;
        setHistory((h) =>
          [
            {
              id,
              input: trimmed,
              ok: false,
              reply: null,
              error: err instanceof Error ? err.message : String(err),
              durationMs: 0,
            },
            ...h,
          ].slice(0, 50),
        );
      } finally {
        setRunning(false);
      }
    },
    [connectionId, config, running, tokenize, onAfterCommand],
  );

  useHotkey('Mod+L', {
    label: 'Focus command bar',
    group: 'Redis',
    description: 'Focus the command input',
    handler: () => inputRef.current?.focus(),
  });

  useHotkey('Mod+Enter', {
    label: 'Run command',
    group: 'Redis',
    description: 'Run the command in the command bar',
    allowInInputs: true,
    handler: () => {
      if (document.activeElement !== inputRef.current) return;
      const value = input;
      setInput('');
      void run(value);
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = input;
      setInput('');
      void run(value);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (inputHistory.length === 0) return;
      const next =
        inputHistoryIndex === null
          ? 0
          : Math.min(inputHistoryIndex + 1, inputHistory.length - 1);
      setInputHistoryIndex(next);
      setInput(inputHistory[next] ?? '');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (inputHistoryIndex === null) return;
      const next = inputHistoryIndex - 1;
      if (next < 0) {
        setInputHistoryIndex(null);
        setInput('');
      } else {
        setInputHistoryIndex(next);
        setInput(inputHistory[next] ?? '');
      }
    }
  };

  const clear = () => {
    setHistory([]);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-background px-3 text-xs">
        <Terminal className="h-3 w-3 text-muted-foreground" />
        <span className="font-semibold tracking-tight">Command</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          redis-cli style
        </span>
        {currentKey && (
          <span className="ml-auto truncate font-mono text-[10px] text-muted-foreground">
            ctx: {currentKey}
          </span>
        )}
        {history.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px] text-muted-foreground"
            onClick={clear}
          >
            <X className="mr-1 h-3 w-3" /> Clear
          </Button>
        )}
      </div>

      <div className="relative flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
        <ChevronRight className="h-3 w-3 text-rose-500" />
        <span className="font-mono text-[11px] text-muted-foreground">
          redis&gt;
        </span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='GET "my key"  ·  HSET myhash field value  ·  ZRANGE key 0 -1'
          className="h-full flex-1 bg-transparent font-mono text-[11px] placeholder:text-muted-foreground/60 focus:outline-none"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => {
            const value = input;
            setInput('');
            void run(value);
          }}
          disabled={running || input.trim() === ''}
          title="Run (Enter)"
        >
          {running ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-3 w-3" />
          )}
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1.5 p-2 font-mono text-[11px]">
          {history.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-3 text-center text-[10px] text-muted-foreground">
              Run a raw command. ↑/↓ navigates history. Strings may be single-
              or double-quoted.
            </div>
          ) : (
            history.map((entry) => (
              <CommandResult key={entry.id} entry={entry} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function CommandResult({ entry }: { entry: HistoryEntry }) {
  return (
    <div
      className={cn(
        'rounded-md border bg-background p-2',
        entry.ok ? 'border-border' : 'border-destructive/40 bg-destructive/5',
      )}
    >
      <div className="flex items-center gap-1.5 text-rose-500">
        <ChevronRight className="h-3 w-3" />
        <span className="font-mono">redis&gt;</span>
        <span className="font-mono text-foreground">{entry.input}</span>
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
          {entry.ok ? `${entry.durationMs} ms` : 'error'}
        </span>
      </div>
      <div className="mt-1 pl-5">
        {entry.ok ? (
          <pre className="whitespace-pre-wrap break-all text-foreground">
            {formatReply(entry.reply)}
          </pre>
        ) : (
          <pre className="whitespace-pre-wrap break-all text-destructive">
            {entry.error}
          </pre>
        )}
      </div>
    </div>
  );
}

function formatReply(reply: RedisCommandReply, indent = 0): string {
  if (reply === null) return '(nil)';
  if (typeof reply === 'string') {
    if (reply.length > 256)
      return `"${reply.slice(0, 256)}… (${reply.length} chars)"`;
    return `"${reply}"`;
  }
  if (typeof reply === 'number') return `(${typeof reply}) ${reply}`;
  if (Array.isArray(reply)) {
    if (reply.length === 0) return '(empty array)';
    return reply
      .map((item, i) => {
        const pad = '  '.repeat(indent + 1);
        return `${pad}${i + 1}) ${formatReply(item, indent + 1)
          .split('\n')
          .join(`\n${pad}`)}`;
      })
      .join('\n');
  }
  if (typeof reply === 'object') {
    const entries = Object.entries(reply);
    if (entries.length === 0) return '(empty map)';
    return entries
      .map(([k]) => {
        const pad = '  '.repeat(indent + 1);
        return `${pad}"${k}"`;
      })
      .join('\n');
  }
  return String(reply);
}

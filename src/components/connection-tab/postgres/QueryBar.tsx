import { useCallback, useMemo, useRef, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHotkey } from '@/lib/hotkeys';

interface QueryBarProps {
  database: string;
  running: boolean;
  onRun: (sql: string) => void;
  initialSql?: string;
}

const SQL_KEYWORDS = new Set([
  'ADD',
  'ALTER',
  'AND',
  'AS',
  'ASC',
  'BEGIN',
  'BETWEEN',
  'BY',
  'CASE',
  'CAST',
  'COMMIT',
  'CREATE',
  'DELETE',
  'DESC',
  'DISTINCT',
  'DROP',
  'ELSE',
  'END',
  'EXISTS',
  'FALSE',
  'FROM',
  'FULL',
  'GROUP',
  'HAVING',
  'ILIKE',
  'IN',
  'INNER',
  'INSERT',
  'INTO',
  'IS',
  'JOIN',
  'LEFT',
  'LIKE',
  'LIMIT',
  'NOT',
  'NULL',
  'OFFSET',
  'ON',
  'OR',
  'ORDER',
  'OUTER',
  'RETURNING',
  'RIGHT',
  'ROLLBACK',
  'SELECT',
  'SET',
  'TABLE',
  'THEN',
  'TRUE',
  'TRUNCATE',
  'UNION',
  'UPDATE',
  'VALUES',
  'VIEW',
  'WHEN',
  'WHERE',
  'WITH',
]);

const TOKEN_PATTERN =
  /(--.*?$|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_$]*\b|\s+|.)/gm;

function highlightSql(sql: string) {
  return Array.from(sql.matchAll(TOKEN_PATTERN), ([token], index) => {
    let className = 'text-foreground';
    const upper = token.toUpperCase();

    if (token.startsWith('--') || token.startsWith('/*')) {
      className = 'text-muted-foreground italic';
    } else if (token.startsWith("'") || token.startsWith('"')) {
      className = 'text-emerald-600 dark:text-emerald-400';
    } else if (/^\d/.test(token)) {
      className = 'text-violet-600 dark:text-violet-400';
    } else if (SQL_KEYWORDS.has(upper)) {
      className = 'font-semibold text-sky-600 dark:text-sky-400';
    }

    return (
      <span key={index} className={className}>
        {token}
      </span>
    );
  });
}

export function QueryBar({
  database,
  running,
  onRun,
  initialSql = 'SELECT now() AS server_time;',
}: QueryBarProps) {
  const [sql, setSql] = useState<string>(initialSql);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const highlightedSql = useMemo(() => highlightSql(sql), [sql]);

  const run = useCallback(() => {
    const trimmed = sql.trim();
    if (!trimmed) return;
    onRun(trimmed);
  }, [sql, onRun]);

  useHotkey('Mod+Enter', {
    label: 'Run query',
    group: 'Custom query',
    description: 'Execute the query in the custom query bar',
    allowInInputs: true,
    handler: () => {
      const target = document.activeElement as HTMLElement | null;
      if (target?.tagName === 'TEXTAREA' && target === textareaRef.current) {
        run();
      }
    },
  });

  useHotkey('Mod+L', {
    label: 'Focus query bar',
    group: 'Custom query',
    description: 'Focus the custom query bar',
    handler: () => textareaRef.current?.focus(),
  });

  const disabled = running || !sql.trim();

  const syncHighlightScroll = useCallback(() => {
    if (!textareaRef.current || !highlightRef.current) return;
    highlightRef.current.scrollTop = textareaRef.current.scrollTop;
    highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/20 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">Custom query</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            custom SQL · {database}
          </span>
        </div>
        <Button size="sm" onClick={run} disabled={disabled} className="h-7">
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          <span>Run</span>
          <span className="ml-1 hidden font-mono text-[10px] opacity-70 sm:inline">
            ⌘↵
          </span>
        </Button>
      </div>
      <div className="relative min-h-0 flex-1 bg-background">
        <pre
          ref={highlightRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-mono text-xs leading-relaxed"
        >
          {highlightedSql}
          {sql.endsWith('\n') ? ' ' : null}
        </pre>
        <textarea
          ref={textareaRef}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onScroll={syncHighlightScroll}
          spellCheck={false}
          className="absolute inset-0 block h-full w-full resize-none bg-transparent px-3 py-2 font-mono text-xs leading-relaxed text-transparent caret-foreground selection:bg-primary/30 placeholder:text-muted-foreground focus:outline-none"
          placeholder="SELECT * FROM users LIMIT 50;"
        />
      </div>
    </div>
  );
}

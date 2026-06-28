import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type JsonViewProps = {
  value?: unknown;
  text?: string;
  className?: string;
  preClassName?: string;
  fallback?: ReactNode;
  inline?: boolean;
};

type JsonToken = {
  value: string;
  kind:
    | 'key'
    | 'string'
    | 'number'
    | 'boolean'
    | 'null'
    | 'punctuation'
    | 'plain';
};

const TOKEN_RE =
  /("(?:\\.|[^"\\])*"\s*:?)|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b|[{}[\],:]/g;

export function JsonView({
  value,
  text,
  className,
  preClassName,
  fallback,
  inline = false,
}: JsonViewProps) {
  const formatted = formatJson(value, text);

  if (formatted === null) {
    return <>{fallback ?? text ?? String(value ?? '')}</>;
  }

  const children = tokenizeJson(formatted).map((token, index) => (
    <span key={index} className={classForToken(token.kind)}>
      {token.value}
    </span>
  ));

  if (inline) {
    return (
      <code className={cn('whitespace-pre font-mono', className)}>
        {children}
      </code>
    );
  }

  return (
    <pre
      className={cn(
        'whitespace-pre-wrap break-all font-mono text-xs leading-relaxed',
        preClassName,
      )}
    >
      <code className={className}>{children}</code>
    </pre>
  );
}

export function formatJson(value?: unknown, text?: string): string | null {
  try {
    if (text !== undefined) {
      return JSON.stringify(JSON.parse(text), null, 2);
    }
    return JSON.stringify(value, null, 2);
  } catch {
    return null;
  }
}

function tokenizeJson(json: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let lastIndex = 0;

  for (const match of json.matchAll(TOKEN_RE)) {
    const value = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push({ value: json.slice(lastIndex, index), kind: 'plain' });
    }
    tokens.push({ value, kind: tokenKind(value) });
    lastIndex = index + value.length;
  }

  if (lastIndex < json.length) {
    tokens.push({ value: json.slice(lastIndex), kind: 'plain' });
  }

  return tokens;
}

function tokenKind(value: string): JsonToken['kind'] {
  if (/^"/.test(value)) return value.trimEnd().endsWith(':') ? 'key' : 'string';
  if (value === 'true' || value === 'false') return 'boolean';
  if (value === 'null') return 'null';
  if (/^-?\d/.test(value)) return 'number';
  if (/^[{}[\],:]$/.test(value)) return 'punctuation';
  return 'plain';
}

function classForToken(kind: JsonToken['kind']): string | undefined {
  switch (kind) {
    case 'key':
      return 'text-sky-700 dark:text-sky-300';
    case 'string':
      return 'text-emerald-700 dark:text-emerald-300';
    case 'number':
      return 'text-amber-700 dark:text-amber-300';
    case 'boolean':
      return 'text-violet-700 dark:text-violet-300';
    case 'null':
      return 'text-rose-700 dark:text-rose-300';
    case 'punctuation':
      return 'text-muted-foreground';
    default:
      return undefined;
  }
}

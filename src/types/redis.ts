import type { RedisKeyType } from '../../shared/types/redis';

export type {
  RedisCommandReply,
  RedisCommandResult,
  RedisKeyMeta,
  RedisKeyType,
  RedisKeyValue,
} from '../../shared/types/redis';

export const KEY_TYPE_LABEL: Record<RedisKeyType, string> = {
  string: 'String',
  list: 'List',
  set: 'Set',
  zset: 'Sorted Set',
  hash: 'Hash',
  stream: 'Stream',
  none: 'None',
};

export const KEY_TYPE_BADGE_CLASS: Record<RedisKeyType, string> = {
  string: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
  list: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  set: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  zset: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
  hash: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30',
  stream: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
  none: 'bg-muted text-muted-foreground border-border',
};

export function formatTtl(pttl: number): string {
  if (pttl === -2) return 'key missing';
  if (pttl === -1) return 'no expiry';
  if (pttl < 0) return '—';
  if (pttl < 1000) return `${pttl} ms`;
  const seconds = Math.floor(pttl / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function tryParseTtlToMs(input: string): number | null {
  const trimmed = input.trim();
  if (
    trimmed === '' ||
    trimmed === '-1' ||
    trimmed.toLowerCase() === 'persist'
  ) {
    return -1;
  }
  const match = /^(-?\d+)\s*(ms|s|m|h|d)?$/.exec(trimmed);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const unit = match[2] ?? 's';
  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
  }
  return null;
}

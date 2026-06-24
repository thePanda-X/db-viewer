export type RedisKeyType =
  | 'string'
  | 'list'
  | 'set'
  | 'zset'
  | 'hash'
  | 'stream'
  | 'none';

export interface RedisKeyMeta {
  type: RedisKeyType;
  ttl: number;
  length: number | null;
}

export type RedisKeyValue =
  | { kind: 'string'; value: string | null }
  | { kind: 'list'; value: string[] }
  | { kind: 'set'; value: string[] }
  | { kind: 'zset'; value: { member: string; score: number }[] }
  | { kind: 'hash'; value: Record<string, string> }
  | { kind: 'stream'; value: { id: string; fields: string[] }[] }
  | { kind: 'none' };

export type RedisCommandReply =
  | string
  | number
  | null
  | RedisCommandReply[]
  | { [k: string]: RedisCommandReply };

export interface RedisCommandResult {
  reply: RedisCommandReply;
  durationMs: number;
}

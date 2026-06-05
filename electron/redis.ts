import Redis from 'ioredis'
import type { RedisConfig } from '../src/types/connection'
import type { RedisKeyValue, RedisKeyMeta, RedisCommandResult, RedisCommandReply } from '../src/types/redis'

const clients = new Map<string, Redis>()

function buildKey(connectionId: string, db: number): string {
  return `${connectionId}::${db}`
}

function createClient(connectionId: string, config: RedisConfig): Redis {
  const client = new Redis({
    host: config.host,
    port: config.port,
    password: config.password || undefined,
    db: config.db,
    tls: config.tls ? {} : undefined,
    lazyConnect: false,
    maxRetriesPerRequest: 2,
    connectTimeout: 10_000,
    enableReadyCheck: true,
    retryStrategy: (times) => {
      if (times > 3) return null
      return Math.min(times * 200, 1000)
    },
  })
  client.on('error', (err) => {
    console.error(`[redis] client error for ${connectionId}@${config.db}:`, err.message)
  })
  return client
}

function getClient(connectionId: string, config: RedisConfig): Redis {
  const key = buildKey(connectionId, config.db)
  const existing = clients.get(key)
  if (existing) return existing
  const client = createClient(connectionId, config)
  clients.set(key, client)
  return client
}

function dropClient(connectionId: string, db?: number): void {
  if (db !== undefined) {
    const key = buildKey(connectionId, db)
    const client = clients.get(key)
    if (client) {
      void client.quit().catch((err) => {
        console.error(`[redis] error quitting client ${key}:`, err)
      })
      clients.delete(key)
    }
    return
  }
  for (const [key, client] of clients.entries()) {
    if (!key.startsWith(`${connectionId}::`)) continue
    void client.quit().catch((err) => {
      console.error(`[redis] error quitting client ${key}:`, err)
    })
    clients.delete(key)
  }
}

export async function scanAll(
  connectionId: string,
  config: RedisConfig,
  match: string,
): Promise<string[]> {
  const client = getClient(connectionId, config)
  const out: string[] = []
  let cursor = '0'
  do {
    const [next, keys] = await client.scan(cursor, 'MATCH', match, 'COUNT', 500)
    cursor = next
    for (const k of keys) out.push(k)
  } while (cursor !== '0')
  return out
}

export async function getMeta(
  connectionId: string,
  config: RedisConfig,
  key: string,
): Promise<RedisKeyMeta> {
  const client = getClient(connectionId, config)
  const [type, pttl] = await client.pipeline().type(key).pttl(key).exec() as [
    [Error | null, string],
    [Error | null, number],
  ]
  const t = (type[1] ?? 'none') as RedisKeyMeta['type']
  let length: number | null = null
  switch (t) {
    case 'string':
      length = await client.strlen(key)
      break
    case 'list':
      length = await client.llen(key)
      break
    case 'set':
      length = await client.scard(key)
      break
    case 'zset':
      length = await client.zcard(key)
      break
    case 'hash':
      length = await client.hlen(key)
      break
    case 'stream':
      length = await client.xlen(key)
      break
    default:
      length = null
  }
  return { type: t, ttl: pttl[1], length }
}

export async function getValue(
  connectionId: string,
  config: RedisConfig,
  key: string,
  type: RedisKeyMeta['type'],
): Promise<RedisKeyValue> {
  const client = getClient(connectionId, config)
  switch (type) {
    case 'string': {
      const v = await client.get(key)
      return { kind: 'string', value: v }
    }
    case 'list': {
      const v = await client.lrange(key, 0, -1)
      return { kind: 'list', value: v }
    }
    case 'set': {
      const v = await client.smembers(key)
      return { kind: 'set', value: v }
    }
    case 'zset': {
      const v = await client.zrange(key, 0, -1, 'WITHSCORES')
      const members: { member: string; score: number }[] = []
      for (let i = 0; i < v.length; i += 2) {
        members.push({ member: v[i], score: Number(v[i + 1]) })
      }
      return { kind: 'zset', value: members }
    }
    case 'hash': {
      const v = await client.hgetall(key)
      return { kind: 'hash', value: v }
    }
    case 'stream': {
      const v = await client.xrange(key, '-', '+')
      return {
        kind: 'stream',
        value: v.map((entry) => ({ id: entry[0], fields: entry[1] })),
      }
    }
    case 'none':
      return { kind: 'none' }
  }
}

export async function deleteKeys(
  connectionId: string,
  config: RedisConfig,
  keys: string[],
): Promise<number> {
  if (keys.length === 0) return 0
  const client = getClient(connectionId, config)
  return client.del(...keys)
}

export async function setTtl(
  connectionId: string,
  config: RedisConfig,
  key: string,
  ms: number,
): Promise<void> {
  const client = getClient(connectionId, config)
  if (ms < 0) {
    await client.persist(key)
  } else {
    await client.pexpire(key, ms)
  }
}

export async function setStringValue(
  connectionId: string,
  config: RedisConfig,
  key: string,
  value: string,
): Promise<void> {
  const client = getClient(connectionId, config)
  await client.set(key, value)
}

export async function setHashField(
  connectionId: string,
  config: RedisConfig,
  key: string,
  field: string,
  value: string,
): Promise<void> {
  const client = getClient(connectionId, config)
  await client.hset(key, field, value)
}

export async function deleteHashField(
  connectionId: string,
  config: RedisConfig,
  key: string,
  field: string,
): Promise<void> {
  const client = getClient(connectionId, config)
  await client.hdel(key, field)
}

export async function pushListElement(
  connectionId: string,
  config: RedisConfig,
  key: string,
  value: string,
  position: 'head' | 'tail',
): Promise<number> {
  const client = getClient(connectionId, config)
  if (position === 'head') return client.lpush(key, value)
  return client.rpush(key, value)
}

export async function removeListElement(
  connectionId: string,
  config: RedisConfig,
  key: string,
  index: number,
): Promise<void> {
  const client = getClient(connectionId, config)
  await client.lset(key, index, '__dbvwr_removed__')
  await client.lrem(key, 1, '__dbvwr_removed__')
}

export async function addSetMember(
  connectionId: string,
  config: RedisConfig,
  key: string,
  member: string,
): Promise<void> {
  const client = getClient(connectionId, config)
  await client.sadd(key, member)
}

export async function removeSetMember(
  connectionId: string,
  config: RedisConfig,
  key: string,
  member: string,
): Promise<void> {
  const client = getClient(connectionId, config)
  await client.srem(key, member)
}

export async function setZsetMember(
  connectionId: string,
  config: RedisConfig,
  key: string,
  member: string,
  score: number,
): Promise<void> {
  const client = getClient(connectionId, config)
  await client.zadd(key, score, member)
}

export async function removeZsetMember(
  connectionId: string,
  config: RedisConfig,
  key: string,
  member: string,
): Promise<void> {
  const client = getClient(connectionId, config)
  await client.zrem(key, member)
}

export async function addStreamEntry(
  connectionId: string,
  config: RedisConfig,
  key: string,
  fields: string[],
): Promise<string> {
  const client = getClient(connectionId, config)
  if (fields.length === 0 || fields.length % 2 !== 0) {
    throw new Error('Stream fields must be provided as field/value pairs')
  }
  const id = await client.xadd(key, '*', ...fields)
  return id ?? ''
}

export async function executeCommand(
  connectionId: string,
  config: RedisConfig,
  args: string[],
): Promise<RedisCommandResult> {
  if (args.length === 0) {
    throw new Error('Command is required')
  }
  const client = getClient(connectionId, config)
  const started = Date.now()
  const reply = (await client.call(...(args as [string, ...string[]]))) as RedisCommandReply
  return { reply, durationMs: Date.now() - started }
}

export async function ping(
  connectionId: string,
  config: RedisConfig,
): Promise<string> {
  const client = getClient(connectionId, config)
  return client.ping()
}

export function disconnect(connectionId: string, db?: number): void {
  dropClient(connectionId, db)
}

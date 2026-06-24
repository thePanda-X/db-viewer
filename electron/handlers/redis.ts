import { registerHandler } from '../handlerRegistry';
import {
  addSetMember as redisAddSetMember,
  addStreamEntry as redisAddStreamEntry,
  deleteHashField as redisDeleteHashField,
  deleteKeys as redisDeleteKeys,
  disconnect as redisDisconnect,
  executeCommand as redisExecuteCommand,
  getMeta as redisGetMeta,
  getValue as redisGetValue,
  ping as redisPing,
  pushListElement as redisPushListElement,
  removeListElement as redisRemoveListElement,
  removeSetMember as redisRemoveSetMember,
  removeZsetMember as redisRemoveZsetMember,
  scanAll as redisScanAll,
  setHashField as redisSetHashField,
  setStringValue as redisSetStringValue,
  setTtl as redisSetTtl,
  setZsetMember as redisSetZsetMember,
} from '../redis';
import type { RedisKeyType } from '../../shared/types/redis';
import type { RedisConfig } from '../../shared/types/connection';

type RedisInvokeArgs = {
  connectionId: string;
  config: RedisConfig;
};

export function registerRedisHandlers(): void {
  registerHandler({
    channel: 'redis:ping',
    handler: async (args: RedisInvokeArgs) => {
      const reply = await redisPing(args.connectionId, args.config);
      return reply;
    },
    errorMode: 'okKey',
    okKey: 'reply',
  });

  registerHandler({
    channel: 'redis:scanAll',
    handler: async (args: RedisInvokeArgs & { match: string }) => {
      const keys = await redisScanAll(
        args.connectionId,
        args.config,
        args.match,
      );
      return keys;
    },
    errorMode: 'okKey',
    okKey: 'keys',
  });

  registerHandler({
    channel: 'redis:getMeta',
    handler: async (args: RedisInvokeArgs & { key: string }) => {
      const meta = await redisGetMeta(args.connectionId, args.config, args.key);
      return meta;
    },
    errorMode: 'okKey',
    okKey: 'meta',
  });

  registerHandler({
    channel: 'redis:getValue',
    handler: async (
      args: RedisInvokeArgs & { key: string; type: RedisKeyType },
    ) => {
      const value = await redisGetValue(
        args.connectionId,
        args.config,
        args.key,
        args.type,
      );
      return value;
    },
    errorMode: 'okKey',
    okKey: 'value',
  });

  registerHandler({
    channel: 'redis:deleteKeys',
    handler: async (args: RedisInvokeArgs & { keys: string[] }) => {
      const deleted = await redisDeleteKeys(
        args.connectionId,
        args.config,
        args.keys,
      );
      return deleted;
    },
    errorMode: 'okKey',
    okKey: 'deleted',
  });

  registerHandler({
    channel: 'redis:setTtl',
    handler: (args: RedisInvokeArgs & { key: string; ms: number }) =>
      redisSetTtl(args.connectionId, args.config, args.key, args.ms),
    errorMode: 'okOnly',
  });

  registerHandler({
    channel: 'redis:setString',
    handler: (args: RedisInvokeArgs & { key: string; value: string }) =>
      redisSetStringValue(args.connectionId, args.config, args.key, args.value),
    errorMode: 'okOnly',
  });

  registerHandler({
    channel: 'redis:setHashField',
    handler: (
      args: RedisInvokeArgs & { key: string; field: string; value: string },
    ) =>
      redisSetHashField(
        args.connectionId,
        args.config,
        args.key,
        args.field,
        args.value,
      ),
    errorMode: 'okOnly',
  });

  registerHandler({
    channel: 'redis:deleteHashField',
    handler: (args: RedisInvokeArgs & { key: string; field: string }) =>
      redisDeleteHashField(
        args.connectionId,
        args.config,
        args.key,
        args.field,
      ),
    errorMode: 'okOnly',
  });

  registerHandler({
    channel: 'redis:pushListElement',
    handler: async (
      args: RedisInvokeArgs & {
        key: string;
        value: string;
        position: 'head' | 'tail';
      },
    ) => {
      const length = await redisPushListElement(
        args.connectionId,
        args.config,
        args.key,
        args.value,
        args.position,
      );
      return length;
    },
    errorMode: 'okKey',
    okKey: 'length',
  });

  registerHandler({
    channel: 'redis:removeListElement',
    handler: (args: RedisInvokeArgs & { key: string; index: number }) =>
      redisRemoveListElement(
        args.connectionId,
        args.config,
        args.key,
        args.index,
      ),
    errorMode: 'okOnly',
  });

  registerHandler({
    channel: 'redis:addSetMember',
    handler: (args: RedisInvokeArgs & { key: string; member: string }) =>
      redisAddSetMember(args.connectionId, args.config, args.key, args.member),
    errorMode: 'okOnly',
  });

  registerHandler({
    channel: 'redis:removeSetMember',
    handler: (args: RedisInvokeArgs & { key: string; member: string }) =>
      redisRemoveSetMember(
        args.connectionId,
        args.config,
        args.key,
        args.member,
      ),
    errorMode: 'okOnly',
  });

  registerHandler({
    channel: 'redis:setZsetMember',
    handler: (
      args: RedisInvokeArgs & { key: string; member: string; score: number },
    ) =>
      redisSetZsetMember(
        args.connectionId,
        args.config,
        args.key,
        args.member,
        args.score,
      ),
    errorMode: 'okOnly',
  });

  registerHandler({
    channel: 'redis:removeZsetMember',
    handler: (args: RedisInvokeArgs & { key: string; member: string }) =>
      redisRemoveZsetMember(
        args.connectionId,
        args.config,
        args.key,
        args.member,
      ),
    errorMode: 'okOnly',
  });

  registerHandler({
    channel: 'redis:addStreamEntry',
    handler: async (
      args: RedisInvokeArgs & { key: string; fields: string[] },
    ) => {
      const id = await redisAddStreamEntry(
        args.connectionId,
        args.config,
        args.key,
        args.fields,
      );
      return id;
    },
    errorMode: 'okKey',
    okKey: 'id',
  });

  registerHandler({
    channel: 'redis:executeCommand',
    handler: async (args: RedisInvokeArgs & { command: string[] }) => {
      const result = await redisExecuteCommand(
        args.connectionId,
        args.config,
        args.command,
      );
      return result;
    },
    errorMode: 'okKey',
    okKey: 'result',
  });

  registerHandler({
    channel: 'redis:disconnect',
    handler: (args: { connectionId: string; db?: number }) => {
      redisDisconnect(args.connectionId, args.db);
      return { ok: true };
    },
    errorMode: 'raw',
  });
}

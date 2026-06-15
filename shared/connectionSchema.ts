import { z } from 'zod';
import type { Connection } from '../src/types/connection';

const baseConnectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(64),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

const postgresConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string(),
  ssl: z.boolean(),
});

const sqliteConfigSchema = z.object({
  filePath: z.string().min(1),
});

const openSearchConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string(),
  password: z.string(),
  ssl: z.boolean(),
});

const redisConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  password: z.string(),
  db: z.number().int().min(0).max(15),
  tls: z.boolean(),
});

const kafkaConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string(),
  password: z.string(),
  tls: z.boolean(),
});

const rabbitMQConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  managementPort: z.number().int().min(1).max(65535),
  vhost: z.string().min(1),
  username: z.string(),
  password: z.string(),
  tls: z.boolean(),
});

export const connectionSchema = z.discriminatedUnion('type', [
  baseConnectionSchema.extend({
    type: z.literal('postgres'),
    config: postgresConfigSchema,
  }),
  baseConnectionSchema.extend({
    type: z.literal('sqlite'),
    config: sqliteConfigSchema,
  }),
  baseConnectionSchema.extend({
    type: z.literal('opensearch'),
    config: openSearchConfigSchema,
  }),
  baseConnectionSchema.extend({
    type: z.literal('redis'),
    config: redisConfigSchema,
  }),
  baseConnectionSchema.extend({
    type: z.literal('kafka'),
    config: kafkaConfigSchema,
  }),
  baseConnectionSchema.extend({
    type: z.literal('rabbitmq'),
    config: rabbitMQConfigSchema,
  }),
]) satisfies z.ZodType<Connection>;

export const connectionsSchema = z.array(connectionSchema);

export function parseConnections(value: unknown): Connection[] {
  return connectionsSchema.parse(value);
}

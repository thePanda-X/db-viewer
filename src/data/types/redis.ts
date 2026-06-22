import { z } from 'zod';
import { KeyRound } from 'lucide-react';
import type { ComponentType } from 'react';
import type { Connection, RedisConfig } from '@/types/connection';
import type { Tab } from '@/types/tab';
import { RedisTab } from '@/components/connection-tab/redis/RedisTab';
import type {
  ConnectionTypeDefinition,
  FieldDefinition,
} from './connectionTypeBase';

const redisSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.coerce.number().int().min(1).max(65535),
  password: z.string(),
  db: z.coerce.number().int().min(0).max(15),
  tls: z.boolean(),
});

const nameField = z.string().min(1, 'Name is required').max(64);

const fields: FieldDefinition[] = [
  {
    name: 'name',
    label: 'Name',
    type: 'text',
    placeholder: 'Local Redis',
    required: true,
    colSpan: 2,
  },
  {
    name: 'host',
    label: 'Host',
    type: 'text',
    placeholder: 'localhost',
    required: true,
  },
  {
    name: 'port',
    label: 'Port',
    type: 'number',
    defaultValue: 6379,
    required: true,
  },
  { name: 'password', label: 'Password', type: 'password' },
  {
    name: 'db',
    label: 'Database index',
    type: 'number',
    defaultValue: 0,
    min: 0,
    max: 15,
  },
  {
    name: 'tls',
    label: 'Use TLS',
    type: 'switch',
    defaultValue: false,
    colSpan: 2,
  },
];

export const redisDef: ConnectionTypeDefinition<RedisConfig> = {
  id: 'redis',
  label: 'Redis',
  description: 'Connect to a Redis server',
  icon: KeyRound,
  brandColor: 'text-rose-500',
  defaultConfig: {
    host: 'localhost',
    port: 6379,
    password: '',
    db: 0,
    tls: false,
  },
  fields,
  schema: redisSchema,
  fullSchema: z.object({ name: nameField, config: redisSchema }),
  subtitle: (c) => `${c.host}:${c.port}${c.db ? ` (db ${c.db})` : ''}`,
  TabComponent: RedisTab as ComponentType<{ connection: Connection; tab: Tab }>,
};

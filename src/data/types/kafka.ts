import { z } from 'zod';
import { Layers } from 'lucide-react';
import type { ComponentType } from 'react';
import type { Connection, KafkaConfig } from '@/types/connection';
import type { Tab } from '@/types/tab';
import { KafkaTab } from '@/components/connection-tab/kafka/KafkaTab';
import type {
  ConnectionTypeDefinition,
  FieldDefinition,
} from './connectionTypeBase';

const kafkaSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string(),
  password: z.string(),
  tls: z.boolean(),
});

const nameField = z.string().min(1, 'Name is required').max(64);

const fields: FieldDefinition[] = [
  {
    name: 'name',
    label: 'Name',
    type: 'text',
    placeholder: 'Local Kafka',
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
    defaultValue: 9092,
    required: true,
  },
  { name: 'username', label: 'Username', type: 'text' },
  { name: 'password', label: 'Password', type: 'password' },
  {
    name: 'tls',
    label: 'Use TLS',
    type: 'switch',
    defaultValue: false,
    colSpan: 2,
  },
];

export const kafkaDef: ConnectionTypeDefinition<KafkaConfig> = {
  id: 'kafka',
  label: 'Kafka',
  description: 'Connect to an Apache Kafka cluster',
  icon: Layers,
  brandColor: 'text-orange-500',
  defaultConfig: {
    host: 'localhost',
    port: 9092,
    username: '',
    password: '',
    tls: false,
  },
  fields,
  schema: kafkaSchema,
  fullSchema: z.object({ name: nameField, config: kafkaSchema }),
  subtitle: (c) => `${c.host}:${c.port}`,
  TabComponent: KafkaTab as ComponentType<{ connection: Connection; tab: Tab }>,
};

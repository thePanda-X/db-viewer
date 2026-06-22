import { z } from 'zod';
import { GitCompare } from 'lucide-react';
import type { ComponentType } from 'react';
import type { Connection, RabbitMQConfig } from '@/types/connection';
import type { Tab } from '@/types/tab';
import { RabbitMQTab } from '@/components/connection-tab/rabbitmq/RabbitMQTab';
import type {
  ConnectionTypeDefinition,
  FieldDefinition,
} from './connectionTypeBase';

const rabbitmqSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.coerce.number().int().min(1).max(65535),
  managementPort: z.coerce.number().int().min(1).max(65535),
  vhost: z.string().min(1, 'Virtual host is required'),
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
    placeholder: 'Local RabbitMQ',
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
    label: 'AMQP Port',
    type: 'number',
    defaultValue: 5672,
    required: true,
  },
  {
    name: 'managementPort',
    label: 'HTTP API Port',
    type: 'number',
    defaultValue: 15672,
    required: true,
    description: 'Port for the management plugin HTTP API',
  },
  {
    name: 'vhost',
    label: 'Virtual Host',
    type: 'text',
    placeholder: '/',
    defaultValue: '/',
    required: true,
  },
  { name: 'username', label: 'Username', type: 'text', placeholder: 'guest' },
  { name: 'password', label: 'Password', type: 'password' },
  {
    name: 'tls',
    label: 'Use TLS',
    type: 'switch',
    defaultValue: false,
    colSpan: 2,
  },
];

export const rabbitmqDef: ConnectionTypeDefinition<RabbitMQConfig> = {
  id: 'rabbitmq',
  label: 'RabbitMQ',
  description: 'Connect to a RabbitMQ server',
  icon: GitCompare,
  brandColor: 'text-orange-500',
  defaultConfig: {
    host: 'localhost',
    port: 5672,
    managementPort: 15672,
    vhost: '/',
    username: 'guest',
    password: 'guest',
    tls: false,
  },
  fields,
  schema: rabbitmqSchema,
  fullSchema: z.object({ name: nameField, config: rabbitmqSchema }),
  subtitle: (c) =>
    `${c.host}:${c.port}${c.vhost !== '/' ? ` (vhost: ${c.vhost})` : ''}`,
  TabComponent: RabbitMQTab as ComponentType<{
    connection: Connection;
    tab: Tab;
  }>,
};

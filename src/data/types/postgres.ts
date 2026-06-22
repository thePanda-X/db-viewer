import { z } from 'zod';
import { Database } from 'lucide-react';
import type { ComponentType } from 'react';
import type { Connection, PostgresConfig } from '@/types/connection';
import type { Tab } from '@/types/tab';
import { PostgresTab } from '@/components/connection-tab/postgres/PostgresTab';
import type {
  ConnectionTypeDefinition,
  FieldDefinition,
} from './connectionTypeBase';

const postgresSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.coerce.number().int().min(1).max(65535),
  database: z.string().min(1, 'Database is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string(),
  ssl: z.boolean(),
});

const nameField = z.string().min(1, 'Name is required').max(64);

const fields: FieldDefinition[] = [
  {
    name: 'name',
    label: 'Name',
    type: 'text',
    placeholder: 'Local Postgres',
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
    defaultValue: 5432,
    required: true,
  },
  {
    name: 'database',
    label: 'Database',
    type: 'text',
    placeholder: 'mydb',
    required: true,
  },
  {
    name: 'username',
    label: 'Username',
    type: 'text',
    placeholder: 'postgres',
    required: true,
  },
  { name: 'password', label: 'Password', type: 'password' },
  {
    name: 'ssl',
    label: 'Use SSL',
    type: 'switch',
    defaultValue: false,
    colSpan: 2,
  },
];

export const postgresDef: ConnectionTypeDefinition<PostgresConfig> = {
  id: 'postgres',
  label: 'PostgreSQL',
  description: 'Connect to a PostgreSQL server',
  icon: Database,
  brandColor: 'text-sky-500',
  defaultConfig: {
    host: 'localhost',
    port: 5432,
    database: '',
    username: 'postgres',
    password: '',
    ssl: false,
  },
  fields,
  schema: postgresSchema,
  fullSchema: z.object({ name: nameField, config: postgresSchema }),
  subtitle: (c) => `${c.host}:${c.port} / ${c.database || '—'}`,
  TabComponent: PostgresTab as ComponentType<{
    connection: Connection;
    tab: Tab;
  }>,
};

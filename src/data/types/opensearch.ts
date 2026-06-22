import { z } from 'zod';
import { Search } from 'lucide-react';
import type { ComponentType } from 'react';
import type { Connection, OpenSearchConfig } from '@/types/connection';
import type { Tab } from '@/types/tab';
import { OpenSearchTab } from '@/components/connection-tab/opensearch/OpenSearchTab';
import type {
  ConnectionTypeDefinition,
  FieldDefinition,
} from './connectionTypeBase';

const openSearchSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string(),
  password: z.string(),
  ssl: z.boolean(),
});

const nameField = z.string().min(1, 'Name is required').max(64);

const fields: FieldDefinition[] = [
  {
    name: 'name',
    label: 'Name',
    type: 'text',
    placeholder: 'Local OpenSearch',
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
    defaultValue: 9200,
    required: true,
  },
  { name: 'username', label: 'Username', type: 'text' },
  { name: 'password', label: 'Password', type: 'password' },
  {
    name: 'ssl',
    label: 'Use SSL',
    type: 'switch',
    defaultValue: false,
    colSpan: 2,
  },
];

export const openSearchDef: ConnectionTypeDefinition<OpenSearchConfig> = {
  id: 'opensearch',
  label: 'OpenSearch',
  description: 'Connect to an OpenSearch cluster',
  icon: Search,
  brandColor: 'text-emerald-500',
  defaultConfig: {
    host: 'localhost',
    port: 9200,
    username: '',
    password: '',
    ssl: false,
  },
  fields,
  schema: openSearchSchema,
  fullSchema: z.object({ name: nameField, config: openSearchSchema }),
  subtitle: (c) => `${c.host}:${c.port}`,
  TabComponent: OpenSearchTab as ComponentType<{
    connection: Connection;
    tab: Tab;
  }>,
};

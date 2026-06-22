import { z } from 'zod';
import { FileText } from 'lucide-react';
import type { ComponentType } from 'react';
import type { Connection, SqliteConfig } from '@/types/connection';
import type { Tab } from '@/types/tab';
import { SqliteTab } from '@/components/connection-tab/sqlite/SqliteTab';
import type {
  ConnectionTypeDefinition,
  FieldDefinition,
} from './connectionTypeBase';

const sqliteSchema = z.object({
  filePath: z.string().min(1, 'File path is required'),
});

const nameField = z.string().min(1, 'Name is required').max(64);

const fields: FieldDefinition[] = [
  {
    name: 'name',
    label: 'Name',
    type: 'text',
    placeholder: 'Local SQLite',
    required: true,
    colSpan: 2,
  },
  {
    name: 'filePath',
    label: 'Database file',
    type: 'file',
    placeholder: '/path/to/database.db',
    required: true,
    description: 'Path to the .db / .sqlite file on disk',
    colSpan: 2,
  },
];

export const sqliteDef: ConnectionTypeDefinition<SqliteConfig> = {
  id: 'sqlite',
  label: 'SQLite',
  description: 'Open a local SQLite database file',
  icon: FileText,
  brandColor: 'text-amber-500',
  defaultConfig: {
    filePath: '',
  },
  fields,
  schema: sqliteSchema,
  fullSchema: z.object({ name: nameField, config: sqliteSchema }),
  subtitle: (c) => c.filePath || 'No file selected',
  TabComponent: SqliteTab as ComponentType<{
    connection: Connection;
    tab: Tab;
  }>,
  fileDialogFilters: [
    { name: 'SQLite databases', extensions: ['db', 'sqlite', 'sqlite3'] },
    { name: 'All files', extensions: ['*'] },
  ],
};

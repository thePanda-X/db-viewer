import { z } from 'zod'
import { Database, FileText, Search, KeyRound, Layers, GitCompare, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import type {
  Connection,
  ConnectionType,
  PostgresConfig,
  SqliteConfig,
  OpenSearchConfig,
  RedisConfig,
  KafkaConfig,
  RabbitMQConfig,
} from '@/types/connection'
import type { Tab } from '@/types/tab'
import { OpenSearchTab } from '@/components/connection-tab/opensearch/OpenSearchTab'
import { PostgresTab } from '@/components/connection-tab/postgres/PostgresTab'
import { RedisTab } from '@/components/connection-tab/redis/RedisTab'
import { SqliteTab } from '@/components/connection-tab/sqlite/SqliteTab'
import { KafkaTab } from '@/components/connection-tab/kafka/KafkaTab'
import { RabbitMQTab } from '@/components/connection-tab/rabbitmq/RabbitMQTab'

export type FieldType = 'text' | 'password' | 'number' | 'switch' | 'file'

export interface FieldDefinition {
  name: string
  label: string
  type: FieldType
  placeholder?: string
  defaultValue?: string | number | boolean
  description?: string
  required?: boolean
  min?: number
  max?: number
  /** How many grid columns the field spans (1 = half, 2 = full). Defaults to 1. */
  colSpan?: 1 | 2
}

export interface FileDialogFilter {
  name: string
  extensions: string[]
}

export interface ConnectionTypeDefinition<CConfig> {
  id: ConnectionType
  label: string
  description: string
  icon: LucideIcon
  brandColor: string
  defaultConfig: CConfig
  fields: FieldDefinition[]
  /** Per-type zod schema for the config object */
  schema: z.ZodType<CConfig>
  /** Per-type zod schema for the whole connection (name + config) */
  fullSchema: z.ZodTypeAny
  /** A short subtitle for cards, given the config */
  subtitle: (config: CConfig) => string
  /** Renderer for an open connection tab. */
  TabComponent: ComponentType<{ connection: Connection; tab: Tab }>
  fileDialogFilters?: FileDialogFilter[]
}

const postgresSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.coerce.number().int().min(1).max(65535),
  database: z.string().min(1, 'Database is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string(),
  ssl: z.boolean(),
})

const sqliteSchema = z.object({
  filePath: z.string().min(1, 'File path is required'),
})

const openSearchSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string(),
  password: z.string(),
  ssl: z.boolean(),
})

const redisSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.coerce.number().int().min(1).max(65535),
  password: z.string(),
  db: z.coerce.number().int().min(0).max(15),
  tls: z.boolean(),
})

const kafkaSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string(),
  password: z.string(),
  tls: z.boolean(),
})

const nameField = z.string().min(1, 'Name is required').max(64)

const postgresDef: ConnectionTypeDefinition<PostgresConfig> = {
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
  fields: [
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      placeholder: 'Local Postgres',
      required: true,
      colSpan: 2,
    },
    { name: 'host', label: 'Host', type: 'text', placeholder: 'localhost', required: true },
    {
      name: 'port',
      label: 'Port',
      type: 'number',
      defaultValue: 5432,
      required: true,
    },
    { name: 'database', label: 'Database', type: 'text', placeholder: 'mydb', required: true },
    {
      name: 'username',
      label: 'Username',
      type: 'text',
      placeholder: 'postgres',
      required: true,
    },
    { name: 'password', label: 'Password', type: 'password' },
    { name: 'ssl', label: 'Use SSL', type: 'switch', defaultValue: false, colSpan: 2 },
  ],
  schema: postgresSchema,
  fullSchema: z.object({ name: nameField, config: postgresSchema }),
  subtitle: (c) => `${c.host}:${c.port} / ${c.database || '—'}`,
  TabComponent: PostgresTab as ComponentType<{ connection: Connection; tab: Tab }>,
}

const sqliteDef: ConnectionTypeDefinition<SqliteConfig> = {
  id: 'sqlite',
  label: 'SQLite',
  description: 'Open a local SQLite database file',
  icon: FileText,
  brandColor: 'text-amber-500',
  defaultConfig: {
    filePath: '',
  },
  fields: [
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
  ],
  schema: sqliteSchema,
  fullSchema: z.object({ name: nameField, config: sqliteSchema }),
  subtitle: (c) => c.filePath || 'No file selected',
  TabComponent: SqliteTab as ComponentType<{ connection: Connection; tab: Tab }>,
  fileDialogFilters: [
    { name: 'SQLite databases', extensions: ['db', 'sqlite', 'sqlite3'] },
    { name: 'All files', extensions: ['*'] },
  ],
}

const openSearchDef: ConnectionTypeDefinition<OpenSearchConfig> = {
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
  fields: [
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      placeholder: 'Local OpenSearch',
      required: true,
      colSpan: 2,
    },
    { name: 'host', label: 'Host', type: 'text', placeholder: 'localhost', required: true },
    {
      name: 'port',
      label: 'Port',
      type: 'number',
      defaultValue: 9200,
      required: true,
    },
    { name: 'username', label: 'Username', type: 'text' },
    { name: 'password', label: 'Password', type: 'password' },
    { name: 'ssl', label: 'Use SSL', type: 'switch', defaultValue: false, colSpan: 2 },
  ],
  schema: openSearchSchema,
  fullSchema: z.object({ name: nameField, config: openSearchSchema }),
  subtitle: (c) => `${c.host}:${c.port}`,
  TabComponent: OpenSearchTab as ComponentType<{ connection: Connection; tab: Tab }>,
}

const rabbitmqSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.coerce.number().int().min(1).max(65535),
  managementPort: z.coerce.number().int().min(1).max(65535),
  vhost: z.string().min(1, 'Virtual host is required'),
  username: z.string(),
  password: z.string(),
  tls: z.boolean(),
})

const rabbitmqDef: ConnectionTypeDefinition<RabbitMQConfig> = {
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
  fields: [
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      placeholder: 'Local RabbitMQ',
      required: true,
      colSpan: 2,
    },
    { name: 'host', label: 'Host', type: 'text', placeholder: 'localhost', required: true },
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
    { name: 'tls', label: 'Use TLS', type: 'switch', defaultValue: false, colSpan: 2 },
  ],
  schema: rabbitmqSchema,
  fullSchema: z.object({ name: nameField, config: rabbitmqSchema }),
  subtitle: (c) => `${c.host}:${c.port}${c.vhost !== '/' ? ` (vhost: ${c.vhost})` : ''}`,
  TabComponent: RabbitMQTab as ComponentType<{ connection: Connection; tab: Tab }>,
}

const redisDef: ConnectionTypeDefinition<RedisConfig> = {
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
  fields: [
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      placeholder: 'Local Redis',
      required: true,
      colSpan: 2,
    },
    { name: 'host', label: 'Host', type: 'text', placeholder: 'localhost', required: true },
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
    { name: 'tls', label: 'Use TLS', type: 'switch', defaultValue: false, colSpan: 2 },
  ],
  schema: redisSchema,
  fullSchema: z.object({ name: nameField, config: redisSchema }),
  subtitle: (c) => `${c.host}:${c.port}${c.db ? ` (db ${c.db})` : ''}`,
  TabComponent: RedisTab as ComponentType<{ connection: Connection; tab: Tab }>,
}

const kafkaDef: ConnectionTypeDefinition<KafkaConfig> = {
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
  fields: [
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      placeholder: 'Local Kafka',
      required: true,
      colSpan: 2,
    },
    { name: 'host', label: 'Host', type: 'text', placeholder: 'localhost', required: true },
    {
      name: 'port',
      label: 'Port',
      type: 'number',
      defaultValue: 9092,
      required: true,
    },
    { name: 'username', label: 'Username', type: 'text' },
    { name: 'password', label: 'Password', type: 'password' },
    { name: 'tls', label: 'Use TLS', type: 'switch', defaultValue: false, colSpan: 2 },
  ],
  schema: kafkaSchema,
  fullSchema: z.object({ name: nameField, config: kafkaSchema }),
  subtitle: (c) => `${c.host}:${c.port}`,
  TabComponent: KafkaTab as ComponentType<{ connection: Connection; tab: Tab }>,
}

export type AnyConnectionConfig = PostgresConfig | SqliteConfig | OpenSearchConfig | RedisConfig | KafkaConfig | RabbitMQConfig

export type AnyConnectionTypeDefinition =
  | ConnectionTypeDefinition<PostgresConfig>
  | ConnectionTypeDefinition<SqliteConfig>
  | ConnectionTypeDefinition<OpenSearchConfig>
  | ConnectionTypeDefinition<RedisConfig>
  | ConnectionTypeDefinition<KafkaConfig>
  | ConnectionTypeDefinition<RabbitMQConfig>

export const CONNECTION_TYPES: ReadonlyArray<AnyConnectionTypeDefinition> = [
  postgresDef,
  sqliteDef,
  openSearchDef,
  redisDef,
  kafkaDef,
  rabbitmqDef,
]

export function getConnectionTypeDef(id: ConnectionType): AnyConnectionTypeDefinition {
  const def = CONNECTION_TYPES.find((d) => d.id === id)
  if (!def) throw new Error(`Unknown connection type: ${id}`)
  return def
}

import type {
  PostgresConfig,
  SqliteConfig,
  OpenSearchConfig,
  RedisConfig,
  KafkaConfig,
  RabbitMQConfig,
} from '@/types/connection';
import type { ConnectionType } from '@/types/connection';

import { postgresDef } from './types/postgres';
import { sqliteDef } from './types/sqlite';
import { openSearchDef } from './types/opensearch';
import { redisDef } from './types/redis';
import { kafkaDef } from './types/kafka';
import { rabbitmqDef } from './types/rabbitmq';

export type {
  FieldType,
  FieldDefinition,
  FileDialogFilter,
  ConnectionTypeDefinition,
} from './types/connectionTypeBase';

export {
  postgresDef,
  sqliteDef,
  openSearchDef,
  redisDef,
  kafkaDef,
  rabbitmqDef,
};

export type AnyConnectionConfig =
  | PostgresConfig
  | SqliteConfig
  | OpenSearchConfig
  | RedisConfig
  | KafkaConfig
  | RabbitMQConfig;

export type AnyConnectionTypeDefinition =
  | import('./types/connectionTypeBase').ConnectionTypeDefinition<PostgresConfig>
  | import('./types/connectionTypeBase').ConnectionTypeDefinition<SqliteConfig>
  | import('./types/connectionTypeBase').ConnectionTypeDefinition<OpenSearchConfig>
  | import('./types/connectionTypeBase').ConnectionTypeDefinition<RedisConfig>
  | import('./types/connectionTypeBase').ConnectionTypeDefinition<KafkaConfig>
  | import('./types/connectionTypeBase').ConnectionTypeDefinition<RabbitMQConfig>;

export const CONNECTION_TYPES: ReadonlyArray<AnyConnectionTypeDefinition> = [
  postgresDef,
  sqliteDef,
  openSearchDef,
  redisDef,
  kafkaDef,
  rabbitmqDef,
];

export function getConnectionTypeDef(
  id: ConnectionType,
): AnyConnectionTypeDefinition {
  const def = CONNECTION_TYPES.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown connection type: ${id}`);
  return def;
}

export type ConnectionType =
  | 'postgres'
  | 'sqlite'
  | 'opensearch'
  | 'redis'
  | 'kafka'
  | 'rabbitmq';

export interface BaseConnection {
  id: string;
  type: ConnectionType;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export interface SqliteConfig {
  filePath: string;
}

export interface OpenSearchConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  ssl: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password: string;
  db: number;
  tls: boolean;
}

export interface KafkaConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
}

export interface RabbitMQConfig {
  host: string;
  port: number;
  managementPort: number;
  vhost: string;
  username: string;
  password: string;
  tls: boolean;
}

export type Connection =
  | (BaseConnection & { type: 'postgres'; config: PostgresConfig })
  | (BaseConnection & { type: 'sqlite'; config: SqliteConfig })
  | (BaseConnection & { type: 'opensearch'; config: OpenSearchConfig })
  | (BaseConnection & { type: 'redis'; config: RedisConfig })
  | (BaseConnection & { type: 'kafka'; config: KafkaConfig })
  | (BaseConnection & { type: 'rabbitmq'; config: RabbitMQConfig });

export type ConnectionConfig<C extends ConnectionType> = Extract<
  Connection,
  { type: C }
>['config'];

/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    APP_ROOT: string;
    VITE_PUBLIC: string;
  }
}

interface OpenFileOptions {
  filters?: Array<{ name: string; extensions: string[] }>;
}

interface SaveFileOptions extends OpenFileOptions {
  defaultPath?: string;
}

interface PostgresExposedConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

interface PostgresQueryRequest {
  sql: string;
  schema?: string;
  params?: unknown[];
  maxRows?: number;
}

interface PostgresQueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  affectedRows: number | null;
  durationMs: number;
  truncated: boolean;
}

type PostgresQueryResponse =
  | { ok: true; result: PostgresQueryResult }
  | { ok: false; error: string };

interface PostgresDatabaseInfo {
  name: string;
  current: boolean;
}

interface PostgresTableInfo {
  schema: string;
  name: string;
  type: 'table' | 'view';
}

interface PostgresColumnMeta {
  name: string;
  dataType: string;
  udtName: string;
  isNullable: boolean;
  isGenerated: boolean;
  isPrimaryKey: boolean;
}

interface PostgresTableMeta {
  columns: PostgresColumnMeta[];
  primaryKey: string[] | null;
}

interface PostgresForeignKey {
  constraintName: string;
  sourceSchema: string;
  sourceTable: string;
  column: string;
  referencedSchema: string;
  referencedTable: string;
  referencedColumn: string;
  referencedUdtName: string;
  constraintColumns: string[];
}

interface PostgresSaveChange {
  original: Record<string, unknown>;
  changes: Record<string, unknown>;
}

interface PostgresSaveChangesRequest {
  database: string;
  schema: string;
  table: string;
  primaryKey: string[];
  updates: PostgresSaveChange[];
}

type PostgresSaveChangesResponse =
  | { ok: true; updated: number }
  | { ok: false; error: string; failedRowIndex?: number };

interface PostgresDeleteRowsRequest {
  database: string;
  schema: string;
  table: string;
  primaryKey: string[];
  rows: Record<string, unknown>[];
}

type PostgresDeleteRowsResponse =
  | { ok: true; deleted: number }
  | { ok: false; error: string };

interface PostgresInsertRowRequest {
  database: string;
  schema: string;
  table: string;
  values: Record<string, unknown>;
}

type PostgresInsertRowResponse =
  | { ok: true; inserted: number }
  | { ok: false; error: string };

interface PostgresExportDatabaseRequest {
  database: string;
  filePath: string;
}

interface PostgresExportDatabaseResponse {
  ok: true;
  filePath: string;
  tables: number;
  rows: number;
}

interface PostgresImportDatabaseRequest {
  database: string;
  filePath: string;
}

interface PostgresImportDatabaseResponse {
  ok: true;
  database: string;
  tables: number;
  rows: number;
}

interface RedisExposedConfig {
  host: string;
  port: number;
  password: string;
  db: number;
  tls: boolean;
}

type SqliteQueryRequest = import('../shared/types/sqlite').QueryRequest;
type SqliteQueryResponse = import('../shared/types/sqlite').QueryResponse;
type SqliteTableInfo = import('../shared/types/sqlite').TableInfo;
type SqliteTableMeta = import('../shared/types/sqlite').TableMeta;
type SqliteForeignKey = import('../shared/types/sqlite').ForeignKey;
type SqliteSaveChangesRequest =
  import('../shared/types/sqlite').SaveChangesRequest;
type SqliteSaveChangesResponse =
  import('../shared/types/sqlite').SaveChangesResponse;
type SqliteDeleteRowsRequest =
  import('../shared/types/sqlite').DeleteRowsRequest;
type SqliteDeleteRowsResponse =
  import('../shared/types/sqlite').DeleteRowsResponse;
type SqliteInsertRowRequest = import('../shared/types/sqlite').InsertRowRequest;
type SqliteInsertRowResponse =
  import('../shared/types/sqlite').InsertRowResponse;

interface OpenSearchExposedConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  ssl: boolean;
}

type OpenSearchClusterInfo =
  import('../shared/types/opensearch').OpenSearchClusterInfo;
type OpenSearchIndexInfo =
  import('../shared/types/opensearch').OpenSearchIndexInfo;
type OpenSearchIndexMeta =
  import('../shared/types/opensearch').OpenSearchIndexMeta;
type OpenSearchExportIndicesRequest =
  import('../shared/types/opensearch').OpenSearchExportIndicesRequest;
type OpenSearchExportIndicesResponse =
  import('../shared/types/opensearch').OpenSearchExportIndicesResponse;
type OpenSearchImportIndicesRequest =
  import('../shared/types/opensearch').OpenSearchImportIndicesRequest;
type OpenSearchImportIndicesResponse =
  import('../shared/types/opensearch').OpenSearchImportIndicesResponse;
type OpenSearchRawRequest =
  import('../shared/types/opensearch').OpenSearchRawRequest;
type OpenSearchRawResponse =
  import('../shared/types/opensearch').OpenSearchRawResponse;
type OpenSearchSearchRequest =
  import('../shared/types/opensearch').OpenSearchSearchRequest;
type OpenSearchSearchResult =
  import('../shared/types/opensearch').OpenSearchSearchResult;

interface RabbitMQExposedConfig {
  host: string;
  port: number;
  managementPort: number;
  vhost: string;
  username: string;
  password: string;
  tls: boolean;
}

type RabbitMQExchangeInfo =
  import('../shared/types/rabbitmq').RabbitMQExchangeInfo;
type RabbitMQQueueInfo = import('../shared/types/rabbitmq').RabbitMQQueueInfo;
type RabbitMQBindingInfo =
  import('../shared/types/rabbitmq').RabbitMQBindingInfo;
type RabbitMQMessageInfo =
  import('../shared/types/rabbitmq').RabbitMQMessageInfo;
type RabbitMQPublishRequest =
  import('../shared/types/rabbitmq').RabbitMQPublishRequest;

type RedisKeyType =
  | 'string'
  | 'list'
  | 'set'
  | 'zset'
  | 'hash'
  | 'stream'
  | 'none';

interface RedisKeyMeta {
  type: RedisKeyType;
  ttl: number;
  length: number | null;
}

type RedisKeyValue =
  | { kind: 'string'; value: string | null }
  | { kind: 'list'; value: string[] }
  | { kind: 'set'; value: string[] }
  | { kind: 'zset'; value: { member: string; score: number }[] }
  | { kind: 'hash'; value: Record<string, string> }
  | { kind: 'stream'; value: { id: string; fields: string[] }[] }
  | { kind: 'none' };

type RedisCommandReply =
  | string
  | number
  | null
  | RedisCommandReply[]
  | { [k: string]: RedisCommandReply };

interface RedisCommandResult {
  reply: RedisCommandReply;
  durationMs: number;
}

type UpdaterStatus =
  | { type: 'checking'; manual: boolean }
  | { type: 'available'; currentVersion: string; version: string }
  | { type: 'not-available'; currentVersion: string; manual: boolean }
  | { type: 'downloading'; version?: string }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string; manual: boolean };

interface ExposedApi {
  app: {
    version: () => Promise<string>;
    getChangelog: () => Promise<string>;
    checkForUpdates: (manual?: boolean) => Promise<void>;
    downloadUpdate: () => Promise<void>;
    installUpdate: () => Promise<void>;
    getUpdaterStatus: () => Promise<UpdaterStatus | null>;
  };
  updater: {
    onStatus: (callback: (status: UpdaterStatus) => void) => () => void;
  };
  changelog: {
    onShow: (callback: () => void) => () => void;
  };
  connections: {
    list: () => Promise<unknown[]>;
    save: (connections: unknown[]) => Promise<unknown[]>;
  };
  folders: {
    list: () => Promise<unknown[]>;
    save: (folders: unknown[]) => Promise<unknown[]>;
  };
  settings: {
    get: () => Promise<unknown>;
    save: (settings: unknown) => Promise<unknown>;
  };
  dialog: {
    openFile: (options?: OpenFileOptions) => Promise<string | null>;
    saveFile: (options?: SaveFileOptions) => Promise<string | null>;
  };
  postgres: {
    query: (args: {
      connectionId: string;
      config: PostgresExposedConfig;
      request: PostgresQueryRequest;
    }) => Promise<PostgresQueryResponse>;
    readOnlyQuery: (args: {
      connectionId: string;
      config: PostgresExposedConfig;
      request: PostgresQueryRequest;
    }) => Promise<PostgresQueryResponse>;
    listDatabases: (args: {
      connectionId: string;
      config: PostgresExposedConfig;
    }) => Promise<PostgresDatabaseInfo[] | { error: string }>;
    listTables: (args: {
      connectionId: string;
      config: PostgresExposedConfig;
      database: string;
    }) => Promise<PostgresTableInfo[] | { error: string }>;
    getTableMeta: (args: {
      connectionId: string;
      config: PostgresExposedConfig;
      database: string;
      schema: string;
      table: string;
    }) => Promise<
      { ok: true; meta: PostgresTableMeta } | { ok: false; error: string }
    >;
    getTableRelations: (args: {
      connectionId: string;
      config: PostgresExposedConfig;
      database: string;
      schema: string;
      table: string;
    }) => Promise<
      | { ok: true; relations: PostgresForeignKey[] }
      | { ok: false; error: string }
    >;
    getIncomingTableRelations: (args: {
      connectionId: string;
      config: PostgresExposedConfig;
      database: string;
      schema: string;
      table: string;
    }) => Promise<
      | { ok: true; relations: PostgresForeignKey[] }
      | { ok: false; error: string }
    >;
    lookupRows: (args: {
      connectionId: string;
      config: PostgresExposedConfig;
      database: string;
      schema: string;
      table: string;
      columns: string[];
      search?: { column: string; query: string };
      limit?: number;
    }) => Promise<
      | { ok: true; result: { columns: string[]; rows: unknown[][] } }
      | { ok: false; error: string }
    >;
    saveChanges: (args: {
      connectionId: string;
      config: PostgresExposedConfig;
      request: PostgresSaveChangesRequest;
    }) => Promise<PostgresSaveChangesResponse>;
    insertRow: (args: {
      connectionId: string;
      config: PostgresExposedConfig;
      request: PostgresInsertRowRequest;
    }) => Promise<PostgresInsertRowResponse>;
    deleteRows: (args: {
      connectionId: string;
      config: PostgresExposedConfig;
      request: PostgresDeleteRowsRequest;
    }) => Promise<PostgresDeleteRowsResponse>;
    exportDatabase: (args: {
      connectionId: string;
      config: PostgresExposedConfig;
      request: PostgresExportDatabaseRequest;
    }) => Promise<PostgresExportDatabaseResponse>;
    importDatabase: (args: {
      connectionId: string;
      config: PostgresExposedConfig;
      request: PostgresImportDatabaseRequest;
    }) => Promise<PostgresImportDatabaseResponse>;
    disconnect: (args: {
      connectionId: string;
      database?: string;
    }) => Promise<{ ok: true }>;
  };
  sqlite: {
    query: (args: {
      connectionId: string;
      filePath: string;
      request: SqliteQueryRequest;
    }) => Promise<SqliteQueryResponse>;
    readOnlyQuery: (args: {
      connectionId: string;
      filePath: string;
      request: SqliteQueryRequest;
    }) => Promise<SqliteQueryResponse>;
    listTables: (args: {
      connectionId: string;
      filePath: string;
    }) => Promise<SqliteTableInfo[] | { error: string }>;
    getTableMeta: (args: {
      connectionId: string;
      filePath: string;
      table: string;
    }) => Promise<
      { ok: true; meta: SqliteTableMeta } | { ok: false; error: string }
    >;
    getTableRelations: (args: {
      connectionId: string;
      filePath: string;
      table: string;
    }) => Promise<
      { ok: true; relations: SqliteForeignKey[] } | { ok: false; error: string }
    >;
    lookupRows: (args: {
      connectionId: string;
      filePath: string;
      table: string;
      columns: string[];
      search?: { column: string; query: string };
      limit?: number;
    }) => Promise<
      | { ok: true; result: { columns: string[]; rows: unknown[][] } }
      | { ok: false; error: string }
    >;
    insertRow: (args: {
      connectionId: string;
      filePath: string;
      request: SqliteInsertRowRequest;
    }) => Promise<SqliteInsertRowResponse>;
    saveChanges: (args: {
      connectionId: string;
      filePath: string;
      request: SqliteSaveChangesRequest;
    }) => Promise<SqliteSaveChangesResponse>;
    deleteRows: (args: {
      connectionId: string;
      filePath: string;
      request: SqliteDeleteRowsRequest;
    }) => Promise<SqliteDeleteRowsResponse>;
    disconnect: (args: { connectionId: string }) => Promise<{ ok: true }>;
  };
  redis: {
    ping: (args: {
      connectionId: string;
      config: RedisExposedConfig;
    }) => Promise<{ ok: true; reply: string } | { ok: false; error: string }>;
    scanAll: (args: {
      connectionId: string;
      config: RedisExposedConfig;
      match: string;
    }) => Promise<{ ok: true; keys: string[] } | { ok: false; error: string }>;
    getMeta: (args: {
      connectionId: string;
      config: RedisExposedConfig;
      key: string;
    }) => Promise<
      { ok: true; meta: RedisKeyMeta } | { ok: false; error: string }
    >;
    getValue: (args: {
      connectionId: string;
      config: RedisExposedConfig;
      key: string;
      type: RedisKeyType;
    }) => Promise<
      { ok: true; value: RedisKeyValue } | { ok: false; error: string }
    >;
    deleteKeys: (args: {
      connectionId: string;
      config: RedisExposedConfig;
      keys: string[];
    }) => Promise<{ ok: true; deleted: number } | { ok: false; error: string }>;
    setTtl: (args: {
      connectionId: string;
      config: RedisExposedConfig;
      key: string;
      ms: number;
    }) => Promise<{ ok: true } | { ok: false; error: string }>;
    setString: (args: {
      connectionId: string;
      config: RedisExposedConfig;
      key: string;
      value: string;
    }) => Promise<{ ok: true } | { ok: false; error: string }>;
    setHashField: (args: {
      connectionId: string;
      config: RedisExposedConfig;
      key: string;
      field: string;
      value: string;
    }) => Promise<{ ok: true } | { ok: false; error: string }>;
    deleteHashField: (args: {
      connectionId: string;
      config: RedisExposedConfig;
      key: string;
      field: string;
    }) => Promise<{ ok: true } | { ok: false; error: string }>;
    pushListElement: (args: {
      connectionId: string;
      config: RedisExposedConfig;
      key: string;
      value: string;
      position: 'head' | 'tail';
    }) => Promise<{ ok: true; length: number } | { ok: false; error: string }>;
    removeListElement: (args: {
      connectionId: string;
      config: RedisExposedConfig;
      key: string;
      index: number;
    }) => Promise<{ ok: true } | { ok: false; error: string }>;
    addSetMember: (args: {
      connectionId: string;
      config: RedisExposedConfig;
      key: string;
      member: string;
    }) => Promise<{ ok: true } | { ok: false; error: string }>;
    removeSetMember: (args: {
      connectionId: string;
      config: RedisExposedConfig;
      key: string;
      member: string;
    }) => Promise<{ ok: true } | { ok: false; error: string }>;
    setZsetMember: (args: {
      connectionId: string;
      config: RedisExposedConfig;
      key: string;
      member: string;
      score: number;
    }) => Promise<{ ok: true } | { ok: false; error: string }>;
    removeZsetMember: (args: {
      connectionId: string;
      config: RedisExposedConfig;
      key: string;
      member: string;
    }) => Promise<{ ok: true } | { ok: false; error: string }>;
    addStreamEntry: (args: {
      connectionId: string;
      config: RedisExposedConfig;
      key: string;
      fields: string[];
    }) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
    executeCommand: (args: {
      connectionId: string;
      config: RedisExposedConfig;
      command: string[];
    }) => Promise<
      { ok: true; result: RedisCommandResult } | { ok: false; error: string }
    >;
    disconnect: (args: {
      connectionId: string;
      db?: number;
    }) => Promise<{ ok: true }>;
  };
  opensearch: {
    ping: (args: {
      connectionId: string;
      config: OpenSearchExposedConfig;
    }) => Promise<
      { ok: true; result: OpenSearchClusterInfo } | { ok: false; error: string }
    >;
    listIndices: (args: {
      connectionId: string;
      config: OpenSearchExposedConfig;
      includeSystem: boolean;
    }) => Promise<
      { ok: true; result: OpenSearchIndexInfo[] } | { ok: false; error: string }
    >;
    getIndexMeta: (args: {
      connectionId: string;
      config: OpenSearchExposedConfig;
      index: string;
    }) => Promise<
      { ok: true; result: OpenSearchIndexMeta } | { ok: false; error: string }
    >;
    searchDocuments: (args: {
      connectionId: string;
      config: OpenSearchExposedConfig;
      request: OpenSearchSearchRequest;
    }) => Promise<
      | { ok: true; result: OpenSearchSearchResult }
      | { ok: false; error: string }
    >;
    updateDocument: (args: {
      connectionId: string;
      config: OpenSearchExposedConfig;
      index: string;
      id: string;
      source: unknown;
    }) => Promise<{ ok: true } | { ok: false; error: string }>;
    deleteDocument: (args: {
      connectionId: string;
      config: OpenSearchExposedConfig;
      index: string;
      id: string;
    }) => Promise<{ ok: true } | { ok: false; error: string }>;
    deleteIndex: (args: {
      connectionId: string;
      config: OpenSearchExposedConfig;
      index: string;
    }) => Promise<{ ok: true } | { ok: false; error: string }>;
    exportIndices: (args: {
      connectionId: string;
      config: OpenSearchExposedConfig;
      request: OpenSearchExportIndicesRequest;
    }) => Promise<OpenSearchExportIndicesResponse>;
    importIndices: (args: {
      connectionId: string;
      config: OpenSearchExposedConfig;
      request: OpenSearchImportIndicesRequest;
    }) => Promise<OpenSearchImportIndicesResponse>;
    executeRequest: (args: {
      connectionId: string;
      config: OpenSearchExposedConfig;
      request: OpenSearchRawRequest;
    }) => Promise<
      { ok: true; result: OpenSearchRawResponse } | { ok: false; error: string }
    >;
    disconnect: (args: { connectionId: string }) => Promise<{ ok: true }>;
  };
  kafka: {
    ping: (args: {
      connectionId: string;
      config: KafkaExposedConfig;
    }) => Promise<
      { ok: true; result: KafkaClusterInfo } | { ok: false; error: string }
    >;
    listTopics: (args: {
      connectionId: string;
      config: KafkaExposedConfig;
    }) => Promise<
      { ok: true; result: KafkaTopicInfo[] } | { ok: false; error: string }
    >;
    getTopicMeta: (args: {
      connectionId: string;
      config: KafkaExposedConfig;
      topic: string;
    }) => Promise<
      { ok: true; result: KafkaTopicMeta } | { ok: false; error: string }
    >;
    listConsumerGroups: (args: {
      connectionId: string;
      config: KafkaExposedConfig;
    }) => Promise<
      | { ok: true; result: KafkaConsumerGroupInfo[] }
      | { ok: false; error: string }
    >;
    getConsumerGroupDetail: (args: {
      connectionId: string;
      config: KafkaExposedConfig;
      groupId: string;
    }) => Promise<
      | { ok: true; result: KafkaConsumerGroupDetail }
      | { ok: false; error: string }
    >;
    consumeMessages: (args: {
      connectionId: string;
      config: KafkaExposedConfig;
      topic: string;
      partition: number;
      offset: string;
      limit: number;
    }) => Promise<
      { ok: true; result: KafkaConsumeResult } | { ok: false; error: string }
    >;
    disconnect: (args: { connectionId: string }) => Promise<{ ok: true }>;
  };
  rabbitmq: {
    ping: (args: {
      connectionId: string;
      config: RabbitMQExposedConfig;
    }) => Promise<
      | {
          ok: true;
          result: {
            rabbitmqVersion: string;
            erlangVersion: string;
            clusterName: string;
            node: string;
          };
        }
      | { ok: false; error: string }
    >;
    listExchanges: (args: {
      connectionId: string;
      config: RabbitMQExposedConfig;
    }) => Promise<
      | { ok: true; result: RabbitMQExchangeInfo[] }
      | { ok: false; error: string }
    >;
    listQueues: (args: {
      connectionId: string;
      config: RabbitMQExposedConfig;
    }) => Promise<
      { ok: true; result: RabbitMQQueueInfo[] } | { ok: false; error: string }
    >;
    listBindings: (args: {
      connectionId: string;
      config: RabbitMQExposedConfig;
      exchange: string;
      queue?: string;
    }) => Promise<
      { ok: true; result: RabbitMQBindingInfo[] } | { ok: false; error: string }
    >;
    getQueueMessages: (args: {
      connectionId: string;
      config: RabbitMQExposedConfig;
      queue: string;
      count: number;
    }) => Promise<
      { ok: true; result: RabbitMQMessageInfo[] } | { ok: false; error: string }
    >;
    purgeQueue: (args: {
      connectionId: string;
      config: RabbitMQExposedConfig;
      queue: string;
    }) => Promise<{ ok: true } | { ok: false; error: string }>;
    deleteQueue: (args: {
      connectionId: string;
      config: RabbitMQExposedConfig;
      queue: string;
    }) => Promise<{ ok: true } | { ok: false; error: string }>;
    publishMessage: (args: {
      connectionId: string;
      config: RabbitMQExposedConfig;
      request: RabbitMQPublishRequest;
    }) => Promise<{ ok: true } | { ok: false; error: string }>;
    disconnect: (args: { connectionId: string }) => Promise<{ ok: true }>;
  };
}

interface Window {
  api: ExposedApi;
}

interface KafkaExposedConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
}

type KafkaClusterInfo = import('../shared/types/kafka').KafkaClusterInfo;
type KafkaTopicInfo = import('../shared/types/kafka').KafkaTopicInfo;
type KafkaTopicMeta = import('../shared/types/kafka').KafkaTopicMeta;
type KafkaConsumerGroupInfo =
  import('../shared/types/kafka').KafkaConsumerGroupInfo;
type KafkaConsumerGroupDetail =
  import('../shared/types/kafka').KafkaConsumerGroupDetail;
type KafkaConsumeResult = import('../shared/types/kafka').KafkaConsumeResult;

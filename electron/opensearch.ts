import { Client } from '@opensearch-project/opensearch';
import type { OpenSearchConfig } from '../src/types/connection';
import type {
  OpenSearchClusterInfo,
  OpenSearchDocumentHit,
  OpenSearchIndexInfo,
  OpenSearchIndexMeta,
  OpenSearchRawRequest,
  OpenSearchRawResponse,
  OpenSearchSearchRequest,
  OpenSearchSearchResult,
} from '../src/types/opensearch';

const clients = new Map<string, Client>();

function nodeUrl(config: OpenSearchConfig): string {
  const protocol = config.ssl ? 'https' : 'http';
  return `${protocol}://${config.host}:${config.port}`;
}

function createClient(connectionId: string, config: OpenSearchConfig): Client {
  const client = new Client({
    node: nodeUrl(config),
    auth: config.username
      ? { username: config.username, password: config.password }
      : undefined,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    maxRetries: 2,
    requestTimeout: 30_000,
  });
  client.on('response', (err) => {
    if (err)
      console.error(
        `[opensearch] client error for ${connectionId}:`,
        err.message,
      );
  });
  return client;
}

function getClient(connectionId: string, config: OpenSearchConfig): Client {
  const existing = clients.get(connectionId);
  if (existing) return existing;
  const client = createClient(connectionId, config);
  clients.set(connectionId, client);
  return client;
}

function bodyOf<T>(response: unknown): T {
  const maybe = response as { body?: T };
  return maybe.body ?? (response as T);
}

export async function ping(
  connectionId: string,
  config: OpenSearchConfig,
): Promise<OpenSearchClusterInfo> {
  const client = getClient(connectionId, config);
  const [infoRes, healthRes] = await Promise.all([
    client.info(),
    client.cluster.health().catch(() => null),
  ]);
  const info = bodyOf<{
    cluster_name?: string;
    cluster_uuid?: string;
    version?: { number?: string };
    tagline?: string;
  }>(infoRes);
  const health = healthRes ? bodyOf<{ status?: string }>(healthRes) : null;
  return {
    clusterName: info.cluster_name ?? 'OpenSearch',
    clusterUuid: info.cluster_uuid ?? '',
    version: info.version?.number ?? 'unknown',
    tagline: info.tagline,
    status: health?.status,
  };
}

export async function listIndices(
  connectionId: string,
  config: OpenSearchConfig,
  includeSystem: boolean,
): Promise<OpenSearchIndexInfo[]> {
  const client = getClient(connectionId, config);
  const res = await client.cat.indices({
    format: 'json',
    h: [
      'health',
      'status',
      'index',
      'uuid',
      'pri',
      'rep',
      'docs.count',
      'docs.deleted',
      'store.size',
      'pri.store.size',
    ],
  });
  const rows = bodyOf<Record<string, string>[]>(res);
  return rows
    .filter((row) => includeSystem || !row.index?.startsWith('.'))
    .map((row) => ({
      name: row.index ?? '',
      health: row.health ?? '',
      status: row.status ?? '',
      uuid: row.uuid,
      primaryShards: row.pri,
      replicaShards: row.rep,
      docsCount: row['docs.count'],
      docsDeleted: row['docs.deleted'],
      storeSize: row['store.size'],
      primaryStoreSize: row['pri.store.size'],
    }))
    .filter((row) => row.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getIndexMeta(
  connectionId: string,
  config: OpenSearchConfig,
  index: string,
): Promise<OpenSearchIndexMeta> {
  const client = getClient(connectionId, config);
  const [mappingRes, settingsRes] = await Promise.all([
    client.indices.getMapping({ index }),
    client.indices.getSettings({ index }),
  ]);
  return {
    mappings: bodyOf(mappingRes),
    settings: bodyOf(settingsRes),
  };
}

export async function searchDocuments(
  connectionId: string,
  config: OpenSearchConfig,
  request: OpenSearchSearchRequest,
): Promise<OpenSearchSearchResult> {
  const client = getClient(connectionId, config);
  const started = Date.now();
  const query = request.query?.trim();
  const res = await client.search({
    index: request.index,
    from: request.from ?? 0,
    size: request.size ?? 25,
    body: {
      query: query ? { query_string: { query } } : { match_all: {} },
    },
  });
  const body = bodyOf<{
    hits?: {
      total?: number | { value?: number };
      hits?: Array<{
        _id?: string;
        _index?: string;
        _score?: number | null;
        _source?: unknown;
      }>;
    };
  }>(res);
  const rawTotal = body.hits?.total;
  const total =
    typeof rawTotal === 'number' ? rawTotal : (rawTotal?.value ?? 0);
  const hits: OpenSearchDocumentHit[] = (body.hits?.hits ?? []).map((hit) => ({
    id: hit._id ?? '',
    index: hit._index ?? request.index,
    score: hit._score ?? null,
    source: hit._source ?? null,
  }));
  return { hits, total, durationMs: Date.now() - started };
}

export async function updateDocument(
  connectionId: string,
  config: OpenSearchConfig,
  index: string,
  id: string,
  source: unknown,
): Promise<void> {
  const client = getClient(connectionId, config);
  await client.index({
    index,
    id,
    body: source as Record<string, unknown>,
    refresh: 'wait_for',
  });
}

export async function deleteDocument(
  connectionId: string,
  config: OpenSearchConfig,
  index: string,
  id: string,
): Promise<void> {
  const client = getClient(connectionId, config);
  await client.delete({ index, id, refresh: 'wait_for' });
}

export async function deleteIndex(
  connectionId: string,
  config: OpenSearchConfig,
  index: string,
): Promise<void> {
  const client = getClient(connectionId, config);
  await client.indices.delete({ index });
}

export async function executeRequest(
  connectionId: string,
  config: OpenSearchConfig,
  request: OpenSearchRawRequest,
): Promise<OpenSearchRawResponse> {
  const client = getClient(connectionId, config);
  const path = request.path.startsWith('/') ? request.path : `/${request.path}`;
  const started = Date.now();
  const res = await client.transport.request({
    method: request.method,
    path,
    body: request.body as Record<string, unknown> | undefined,
  });
  const maybe = res as { statusCode?: number; body?: unknown };
  return {
    statusCode: maybe.statusCode ?? 200,
    body: maybe.body ?? res,
    durationMs: Date.now() - started,
  };
}

export function disconnect(connectionId: string): void {
  const client = clients.get(connectionId);
  if (!client) return;
  void client.close().catch((err: unknown) => {
    console.error(`[opensearch] error closing client ${connectionId}:`, err);
  });
  clients.delete(connectionId);
}

import { Client } from '@opensearch-project/opensearch';
import fs from 'node:fs/promises';
import type { OpenSearchConfig } from '../shared/types/connection';
import type {
  OpenSearchClusterInfo,
  OpenSearchDocumentHit,
  OpenSearchExportIndicesRequest,
  OpenSearchExportIndicesResponse,
  OpenSearchIndexInfo,
  OpenSearchIndexMeta,
  OpenSearchImportIndicesRequest,
  OpenSearchImportIndicesResponse,
  OpenSearchRawRequest,
  OpenSearchRawResponse,
  OpenSearchSearchRequest,
  OpenSearchSearchResult,
} from '../shared/types/opensearch';

const clients = new Map<string, Client>();
const EXPORT_FORMAT = 'db-vwr.opensearch.export';
const EXPORT_VERSION = 1;
const EXPORT_BATCH_SIZE = 500;

interface OpenSearchExportDocument {
  id: string;
  source: unknown;
  routing?: string;
}

interface OpenSearchExportIndex {
  name: string;
  settings: unknown;
  mappings: unknown;
  aliases: unknown;
  documents: OpenSearchExportDocument[];
}

interface OpenSearchIndicesExport {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  indices: OpenSearchExportIndex[];
}

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

function assertOpenSearchExport(value: unknown): OpenSearchIndicesExport {
  if (
    !value ||
    typeof value !== 'object' ||
    (value as { format?: unknown }).format !== EXPORT_FORMAT ||
    (value as { version?: unknown }).version !== EXPORT_VERSION ||
    !Array.isArray((value as { indices?: unknown }).indices)
  ) {
    throw new Error('File is not a db-vwr OpenSearch export JSON');
  }
  return value as OpenSearchIndicesExport;
}

function indexRecordValue(value: unknown, index: string): unknown {
  if (!value || typeof value !== 'object') return {};
  return (value as Record<string, unknown>)[index] ?? {};
}

function stripReadOnlySettings(settings: unknown): Record<string, unknown> {
  const indexSettings =
    settings && typeof settings === 'object'
      ? { ...(settings as Record<string, unknown>) }
      : {};
  delete indexSettings.uuid;
  delete indexSettings.version;
  delete indexSettings.provided_name;
  delete indexSettings.creation_date;
  return indexSettings;
}

function createIndexBody(
  indexExport: OpenSearchExportIndex,
): Record<string, unknown> {
  const rawSettings = indexRecordValue(
    indexExport.settings,
    indexExport.name,
  ) as {
    settings?: { index?: unknown };
  };
  const rawMappings = indexRecordValue(
    indexExport.mappings,
    indexExport.name,
  ) as {
    mappings?: unknown;
  };
  const rawAliases = indexRecordValue(
    indexExport.aliases,
    indexExport.name,
  ) as {
    aliases?: unknown;
  };
  const body: Record<string, unknown> = {};
  const settings = stripReadOnlySettings(rawSettings.settings?.index);
  if (Object.keys(settings).length > 0) body.settings = settings;
  if (rawMappings.mappings && Object.keys(rawMappings.mappings).length > 0) {
    body.mappings = rawMappings.mappings;
  }
  if (rawAliases.aliases && Object.keys(rawAliases.aliases).length > 0) {
    body.aliases = rawAliases.aliases;
  }
  return body;
}

async function indexExists(client: Client, index: string): Promise<boolean> {
  const res = await client.indices.exists({ index });
  const maybe = res as { body?: boolean; statusCode?: number };
  if (typeof maybe.body === 'boolean') return maybe.body;
  return maybe.statusCode === 200;
}

async function exportIndexDocuments(
  client: Client,
  index: string,
): Promise<OpenSearchExportDocument[]> {
  const documents: OpenSearchExportDocument[] = [];
  let searchRes = await client.search({
    index,
    scroll: '2m',
    size: EXPORT_BATCH_SIZE,
    body: { query: { match_all: {} }, sort: ['_doc'] },
  });
  let body = bodyOf<{
    _scroll_id?: string;
    hits?: {
      hits?: Array<{
        _id?: string;
        _source?: unknown;
        _routing?: string;
      }>;
    };
  }>(searchRes);
  let scrollId = body._scroll_id;
  let hits = body.hits?.hits ?? [];

  try {
    while (hits.length > 0) {
      for (const hit of hits) {
        documents.push({
          id: hit._id ?? '',
          source: hit._source ?? null,
          routing: hit._routing,
        });
      }
      if (!scrollId) break;
      searchRes = await client.scroll({ scroll_id: scrollId, scroll: '2m' });
      body = bodyOf(searchRes);
      scrollId = body._scroll_id ?? scrollId;
      hits = body.hits?.hits ?? [];
    }
  } finally {
    if (scrollId) {
      await client.clearScroll({ scroll_id: scrollId }).catch(() => undefined);
    }
  }

  return documents;
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

export async function exportIndices(
  connectionId: string,
  config: OpenSearchConfig,
  request: OpenSearchExportIndicesRequest,
): Promise<OpenSearchExportIndicesResponse> {
  const client = getClient(connectionId, config);
  const indexNames = Array.from(
    new Set(request.indices.map((item) => item.trim())),
  ).filter(Boolean);
  if (indexNames.length === 0)
    throw new Error('Select at least one index to export');

  const exported: OpenSearchExportIndex[] = [];
  let documentCount = 0;
  for (const index of indexNames) {
    const [mappingRes, settingsRes, aliasesRes] = await Promise.all([
      client.indices.getMapping({ index }),
      client.indices.getSettings({ index }),
      client.indices.getAlias({ index }).catch(() => ({ body: {} })),
    ]);
    const documents = await exportIndexDocuments(client, index);
    documentCount += documents.length;
    exported.push({
      name: index,
      mappings: bodyOf(mappingRes),
      settings: bodyOf(settingsRes),
      aliases: bodyOf(aliasesRes),
      documents,
    });
  }

  const payload: OpenSearchIndicesExport = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    indices: exported,
  };
  await fs.writeFile(
    request.filePath,
    JSON.stringify(payload, null, 2),
    'utf8',
  );
  return {
    ok: true,
    filePath: request.filePath,
    indices: exported.length,
    documents: documentCount,
  };
}

export async function importIndices(
  connectionId: string,
  config: OpenSearchConfig,
  request: OpenSearchImportIndicesRequest,
): Promise<OpenSearchImportIndicesResponse> {
  const client = getClient(connectionId, config);
  const parsed = assertOpenSearchExport(
    JSON.parse(await fs.readFile(request.filePath, 'utf8')),
  );
  let documentCount = 0;

  for (const indexExport of parsed.indices) {
    const exists = await indexExists(client, indexExport.name);
    if (exists) {
      if (!request.overwrite) {
        throw new Error(`Index already exists: ${indexExport.name}`);
      }
      await client.indices.delete({ index: indexExport.name });
    }

    await client.indices.create({
      index: indexExport.name,
      body: createIndexBody(indexExport),
    });

    for (let i = 0; i < indexExport.documents.length; i += EXPORT_BATCH_SIZE) {
      const batch = indexExport.documents.slice(i, i + EXPORT_BATCH_SIZE);
      if (batch.length === 0) continue;
      const body = batch.flatMap((doc) => [
        {
          index: {
            _index: indexExport.name,
            _id: doc.id,
            ...(doc.routing ? { routing: doc.routing } : {}),
          },
        },
        doc.source,
      ]) as Record<string, unknown>[];
      const bulkRes = await client.bulk({ refresh: false, body });
      const bulkBody = bodyOf<{ errors?: boolean; items?: unknown[] }>(bulkRes);
      if (bulkBody.errors) {
        throw new Error(`Bulk import failed for index ${indexExport.name}`);
      }
      documentCount += batch.length;
    }

    await client.indices.refresh({ index: indexExport.name });
  }

  return { ok: true, indices: parsed.indices.length, documents: documentCount };
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

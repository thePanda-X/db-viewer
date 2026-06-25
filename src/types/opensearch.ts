export interface OpenSearchClusterInfo {
  clusterName: string;
  clusterUuid: string;
  version: string;
  tagline?: string;
  status?: string;
}

export interface OpenSearchIndexInfo {
  name: string;
  health: string;
  status: string;
  uuid?: string;
  primaryShards?: string;
  replicaShards?: string;
  docsCount?: string;
  docsDeleted?: string;
  storeSize?: string;
  primaryStoreSize?: string;
}

export interface OpenSearchIndexMeta {
  mappings: unknown;
  settings: unknown;
}

export interface OpenSearchSearchRequest {
  index: string;
  query?: string;
  from?: number;
  size?: number;
}

export interface OpenSearchDocumentHit {
  id: string;
  index: string;
  score: number | null;
  source: unknown;
}

export interface OpenSearchSearchResult {
  hits: OpenSearchDocumentHit[];
  total: number;
  durationMs: number;
}

export type OpenSearchHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';

export interface OpenSearchRawRequest {
  method: OpenSearchHttpMethod;
  path: string;
  body?: unknown;
}

export interface OpenSearchRawResponse {
  statusCode: number;
  body: unknown;
  durationMs: number;
}

export interface OpenSearchExportIndicesRequest {
  indices: string[];
  filePath: string;
}

export interface OpenSearchExportIndicesResponse {
  ok: true;
  filePath: string;
  indices: number;
  documents: number;
}

export interface OpenSearchImportIndicesRequest {
  filePath: string;
  overwrite: boolean;
}

export interface OpenSearchImportIndicesResponse {
  ok: true;
  indices: number;
  documents: number;
}

export type OpenSearchResponse<T> =
  | { ok: true; result: T }
  | { ok: false; error: string };

export type OpenSearchVoidResponse =
  | { ok: true }
  | { ok: false; error: string };

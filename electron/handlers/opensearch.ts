import { registerHandler } from '../handlerRegistry';
import {
  deleteDocument as opensearchDeleteDocument,
  deleteIndex as opensearchDeleteIndex,
  disconnect as opensearchDisconnect,
  executeRequest as opensearchExecuteRequest,
  exportIndices as opensearchExportIndices,
  getIndexMeta as opensearchGetIndexMeta,
  importIndices as opensearchImportIndices,
  listIndices as opensearchListIndices,
  ping as opensearchPing,
  searchDocuments as opensearchSearchDocuments,
  updateDocument as opensearchUpdateDocument,
} from '../opensearch';
import type { OpenSearchConfig } from '../../shared/types/connection';
import type {
  OpenSearchExportIndicesRequest,
  OpenSearchImportIndicesRequest,
  OpenSearchRawRequest,
  OpenSearchSearchRequest,
} from '../../shared/types/opensearch';

type OpenSearchInvokeArgs = {
  connectionId: string;
  config: OpenSearchConfig;
};

export function registerOpensearchHandlers(): void {
  registerHandler({
    channel: 'opensearch:ping',
    handler: (args: OpenSearchInvokeArgs) =>
      opensearchPing(args.connectionId, args.config),
    errorMode: 'okResult',
  });

  registerHandler({
    channel: 'opensearch:listIndices',
    handler: async (
      args: OpenSearchInvokeArgs & { includeSystem: boolean },
    ) => {
      const result = await opensearchListIndices(
        args.connectionId,
        args.config,
        args.includeSystem,
      );
      return result;
    },
    errorMode: 'okResult',
  });

  registerHandler({
    channel: 'opensearch:getIndexMeta',
    handler: async (args: OpenSearchInvokeArgs & { index: string }) => {
      const result = await opensearchGetIndexMeta(
        args.connectionId,
        args.config,
        args.index,
      );
      return result;
    },
    errorMode: 'okResult',
  });

  registerHandler({
    channel: 'opensearch:searchDocuments',
    handler: async (
      args: OpenSearchInvokeArgs & { request: OpenSearchSearchRequest },
    ) => {
      const result = await opensearchSearchDocuments(
        args.connectionId,
        args.config,
        args.request,
      );
      return result;
    },
    errorMode: 'okResult',
  });

  registerHandler({
    channel: 'opensearch:updateDocument',
    handler: (
      args: OpenSearchInvokeArgs & {
        index: string;
        id: string;
        source: unknown;
      },
    ) =>
      opensearchUpdateDocument(
        args.connectionId,
        args.config,
        args.index,
        args.id,
        args.source,
      ),
    errorMode: 'okOnly',
  });

  registerHandler({
    channel: 'opensearch:deleteDocument',
    handler: (args: OpenSearchInvokeArgs & { index: string; id: string }) =>
      opensearchDeleteDocument(
        args.connectionId,
        args.config,
        args.index,
        args.id,
      ),
    errorMode: 'okOnly',
  });

  registerHandler({
    channel: 'opensearch:executeRequest',
    handler: async (
      args: OpenSearchInvokeArgs & { request: OpenSearchRawRequest },
    ) => {
      const result = await opensearchExecuteRequest(
        args.connectionId,
        args.config,
        args.request,
      );
      return result;
    },
    errorMode: 'okResult',
  });

  registerHandler({
    channel: 'opensearch:deleteIndex',
    handler: (args: OpenSearchInvokeArgs & { index: string }) =>
      opensearchDeleteIndex(args.connectionId, args.config, args.index),
    errorMode: 'okOnly',
  });

  registerHandler({
    channel: 'opensearch:exportIndices',
    handler: (
      args: OpenSearchInvokeArgs & { request: OpenSearchExportIndicesRequest },
    ) => opensearchExportIndices(args.connectionId, args.config, args.request),
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'opensearch:importIndices',
    handler: (
      args: OpenSearchInvokeArgs & { request: OpenSearchImportIndicesRequest },
    ) => opensearchImportIndices(args.connectionId, args.config, args.request),
    errorMode: 'raw',
  });

  registerHandler({
    channel: 'opensearch:disconnect',
    handler: (args: { connectionId: string }) => {
      opensearchDisconnect(args.connectionId);
      return { ok: true };
    },
    errorMode: 'raw',
  });
}

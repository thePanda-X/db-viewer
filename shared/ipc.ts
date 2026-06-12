export const IPC_CHANNELS = {
  connections: ['list', 'save'],
  dialog: ['openFile'],
  postgres: [
    'query',
    'readOnlyQuery',
    'listDatabases',
    'listTables',
    'getTableMeta',
    'getTableRelations',
    'getIncomingTableRelations',
    'lookupRows',
    'saveChanges',
    'disconnect',
  ],
  sqlite: [
    'query',
    'readOnlyQuery',
    'listTables',
    'getTableMeta',
    'getTableRelations',
    'lookupRows',
    'saveChanges',
    'disconnect',
  ],
  redis: [
    'ping',
    'scanAll',
    'getMeta',
    'getValue',
    'deleteKeys',
    'setTtl',
    'setString',
    'setHashField',
    'deleteHashField',
    'pushListElement',
    'removeListElement',
    'addSetMember',
    'removeSetMember',
    'setZsetMember',
    'removeZsetMember',
    'addStreamEntry',
    'executeCommand',
    'disconnect',
  ],
  opensearch: [
    'ping',
    'listIndices',
    'getIndexMeta',
    'searchDocuments',
    'updateDocument',
    'deleteDocument',
    'executeRequest',
    'disconnect',
  ],
  kafka: [
    'ping',
    'listTopics',
    'getTopicMeta',
    'listConsumerGroups',
    'getConsumerGroupDetail',
    'consumeMessages',
    'disconnect',
  ],
  rabbitmq: [
    'ping',
    'listExchanges',
    'listQueues',
    'listBindings',
    'getQueueMessages',
    'purgeQueue',
    'deleteQueue',
    'publishMessage',
    'disconnect',
  ],
} as const

export type IpcNamespace = keyof typeof IPC_CHANNELS
export type IpcOperation<TNamespace extends IpcNamespace> = (typeof IPC_CHANNELS)[TNamespace][number]
export type IpcChannel<TNamespace extends IpcNamespace = IpcNamespace> =
  TNamespace extends IpcNamespace ? `${TNamespace}:${IpcOperation<TNamespace>}` : never

export function ipcChannel<TNamespace extends IpcNamespace>(
  namespace: TNamespace,
  operation: IpcOperation<TNamespace>,
): IpcChannel<TNamespace> {
  return `${namespace}:${operation}` as IpcChannel<TNamespace>
}

export type IpcSuccess<T> = { ok: true; data: T }
export type IpcFailure = { ok: false; error: string }
export type IpcResult<T> = IpcSuccess<T> | IpcFailure

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return 'Unknown error'
  }
}

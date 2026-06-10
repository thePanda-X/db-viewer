import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, ipcChannel, type IpcNamespace } from '../shared/ipc'

type ApiNamespace<TNamespace extends IpcNamespace> = {
  [TOperation in (typeof IPC_CHANNELS)[TNamespace][number]]: (args?: unknown) => Promise<unknown>
}

type ExposedApi = {
  [TNamespace in IpcNamespace]: ApiNamespace<TNamespace>
}

type MutableNamespace = Record<string, (args?: unknown) => Promise<unknown>>

function createApi(): ExposedApi {
  const api = {} as ExposedApi

  for (const namespace of Object.keys(IPC_CHANNELS) as IpcNamespace[]) {
    api[namespace] = {} as ApiNamespace<typeof namespace>
    const namespaceApi = api[namespace] as MutableNamespace
    for (const operation of IPC_CHANNELS[namespace]) {
      namespaceApi[operation] = (args?: unknown) => ipcRenderer.invoke(ipcChannel(namespace, operation), args)
    }
  }

  return api
}

contextBridge.exposeInMainWorld('api', createApi())

contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...listenerArgs) => listener(event, ...listenerArgs))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

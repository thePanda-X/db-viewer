export const HOME_TAB_ID = 'home' as const

export type TabId = typeof HOME_TAB_ID | string

export interface Tab {
  id: TabId
  connectionId: string
  title: string
  type?: import('./connection').ConnectionType
}

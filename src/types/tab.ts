export const HOME_TAB_ID = 'home' as const

export type TabId = typeof HOME_TAB_ID | string

export type PostgresTabView =
  /** Free-form mode: sidebar visible, user picks tables. */
  | { kind: 'default' }
  /** User picked a table from the sidebar. */
  | { kind: 'table'; database: string; schema: string; table: string }
  /**
   * Pinned view opened by FK navigation. Renders the referenced table with a
   * pre-applied WHERE filter on `filterColumn = filterValue`. The user can
   * clear the filter (or paginate) to browse the table in full.
   */
  | {
      kind: 'relatedRow'
      database: string
      schema: string
      table: string
      filterColumn: string
      filterValue: unknown
      /** Display value of the source cell, used for the tab title etc. */
      filterDisplay: string
    }

export interface Tab {
  id: TabId
  connectionId: string
  title: string
  type?: import('./connection').ConnectionType
  /** When the tab belongs to a Postgres connection, this describes its current view. */
  postgresView?: PostgresTabView
}

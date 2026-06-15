import Database from 'better-sqlite3';
import type {
  ColumnMeta,
  DeleteRowsRequest,
  ForeignKey,
  InsertRowRequest,
  InsertRowResponse,
  QueryRequest,
  QueryResponse,
  SaveChangesRequest,
  SaveChangesResponse,
  TableInfo,
  TableMeta,
} from '../src/types/sqlite';
import type {
  SqlDeleteRowsResponse,
  SqlLookupRowsResponse,
} from '../shared/types/sql';

const DEFAULT_MAX_ROWS = 10_000;

const connections = new Map<string, Database.Database>();

function getDatabase(
  connectionId: string,
  filePath: string,
): Database.Database {
  const existing = connections.get(connectionId);
  if (existing) return existing;

  const db = new Database(filePath, { verbose: console.log });
  // Performance optimizations for SQLite
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  connections.set(connectionId, db);
  return db;
}

function dropDatabase(connectionId: string): void {
  const db = connections.get(connectionId);
  if (db) {
    db.close();
    connections.delete(connectionId);
  }
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error';
}

function isLimitWrappedQuery(sql: string): boolean {
  const normalized = sql.trim().replace(/^;+/, '').trimStart().toUpperCase();
  return normalized.startsWith('SELECT') || normalized.startsWith('WITH');
}

function runSqliteReadOnlyStatement(
  db: Database.Database,
  sql: string,
  params: unknown[],
  maxRows: number,
  started: number,
): QueryResponse {
  const originalStmt = db.prepare(sql);
  if (!originalStmt.readonly) {
    return {
      ok: false,
      error: 'Only read-only SQLite statements are allowed here.',
    };
  }

  if (!originalStmt.reader) {
    originalStmt.run(...params);
    return {
      ok: true,
      result: {
        columns: [],
        rows: [],
        rowCount: 0,
        affectedRows: null,
        durationMs: Date.now() - started,
        truncated: false,
      },
    };
  }

  const stmt = isLimitWrappedQuery(sql)
    ? db.prepare(`SELECT * FROM (${sql}) LIMIT ?`)
    : originalStmt;
  const rows = (
    isLimitWrappedQuery(sql)
      ? stmt.all(...params, maxRows + 1)
      : stmt.all(...params)
  ) as Record<string, unknown>[];

  const truncated = rows.length > maxRows;
  const limited = truncated ? rows.slice(0, maxRows) : rows;
  const columns =
    limited.length > 0
      ? Object.keys(limited[0])
      : originalStmt.columns().map((c) => c.name);

  return {
    ok: true,
    result: {
      columns,
      rows: limited.map((r) => columns.map((c) => r[c])),
      rowCount: rows.length,
      affectedRows: null,
      durationMs: Date.now() - started,
      truncated,
    },
  };
}

export async function runQuery(
  connectionId: string,
  filePath: string,
  req: QueryRequest,
): Promise<QueryResponse> {
  const maxRows = req.maxRows ?? DEFAULT_MAX_ROWS;
  const started = Date.now();
  try {
    const db = getDatabase(connectionId, filePath);
    const sql = req.sql.trim();
    const isSelect =
      sql.toUpperCase().startsWith('SELECT') ||
      sql.toUpperCase().startsWith('WITH');

    if (isSelect) {
      // For SELECT queries, we apply a limit in a subquery to avoid loading too many rows
      const wrapped = `SELECT * FROM (${sql}) LIMIT ?`;
      const stmt = db.prepare(wrapped);
      const rows = stmt.all(...(req.params ?? []), maxRows + 1) as Record<
        string,
        unknown
      >[];

      const truncated = rows.length > maxRows;
      const limited = truncated ? rows.slice(0, maxRows) : rows;

      if (limited.length === 0) {
        // Try to get columns from the original statement if no rows returned
        const originalStmt = db.prepare(sql);
        const columns = originalStmt.columns().map((c) => c.name);
        return {
          ok: true,
          result: {
            columns,
            rows: [],
            rowCount: 0,
            affectedRows: null,
            durationMs: Date.now() - started,
            truncated: false,
          },
        };
      }

      const columns = Object.keys(limited[0]);
      const data = limited.map((r) => columns.map((c) => r[c]));

      return {
        ok: true,
        result: {
          columns,
          rows: data,
          rowCount: rows.length,
          affectedRows: null,
          durationMs: Date.now() - started,
          truncated,
        },
      };
    } else {
      const stmt = db.prepare(sql);
      const info = stmt.run(...(req.params ?? []));
      return {
        ok: true,
        result: {
          columns: [],
          rows: [],
          rowCount: 0,
          affectedRows: info.changes,
          durationMs: Date.now() - started,
          truncated: false,
        },
      };
    }
  } catch (err) {
    return { ok: false, error: toErrorMessage(err) };
  }
}

export async function runReadOnlyQuery(
  connectionId: string,
  filePath: string,
  req: QueryRequest,
): Promise<QueryResponse> {
  const maxRows = req.maxRows ?? DEFAULT_MAX_ROWS;
  const started = Date.now();
  try {
    const db = getDatabase(connectionId, filePath);
    return runSqliteReadOnlyStatement(
      db,
      req.sql.trim(),
      req.params ?? [],
      maxRows,
      started,
    );
  } catch (err) {
    return { ok: false, error: toErrorMessage(err) };
  }
}

export async function listTables(
  connectionId: string,
  filePath: string,
): Promise<TableInfo[]> {
  const db = getDatabase(connectionId, filePath);
  const stmt = db.prepare(`
    SELECT name, type 
    FROM sqlite_master 
    WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);
  const rows = stmt.all() as { name: string; type: string }[];
  return rows.map((r) => ({
    name: r.name,
    type: r.type === 'view' ? 'view' : 'table',
  }));
}

export async function getTableMeta(
  connectionId: string,
  filePath: string,
  table: string,
): Promise<TableMeta> {
  const db = getDatabase(connectionId, filePath);

  // Get columns
  const columnsStmt = db.prepare(`PRAGMA table_info(${ident(table)})`);
  const columnsRows = columnsStmt.all() as {
    name: string;
    type: string;
    notnull: number;
    pk: number;
    dflt_value: unknown;
  }[];

  const columns: ColumnMeta[] = columnsRows.map((r) => ({
    name: r.name,
    dataType: r.type,
    isNullable: r.notnull === 0,
    isPrimaryKey: r.pk > 0,
    defaultValue: r.dflt_value,
  }));

  const primaryKey = columnsRows
    .filter((r) => r.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((r) => r.name);

  return {
    columns,
    primaryKey: primaryKey.length > 0 ? primaryKey : null,
  };
}

export async function getTableRelations(
  connectionId: string,
  filePath: string,
  table: string,
): Promise<ForeignKey[]> {
  const db = getDatabase(connectionId, filePath);
  const stmt = db.prepare(`PRAGMA foreign_key_list(${ident(table)})`);
  const rows = stmt.all() as {
    from: string;
    table: string;
    to: string;
  }[];

  return rows.map((r) => ({
    column: r.from,
    referencedTable: r.table,
    referencedColumn: r.to,
  }));
}

export async function lookupRows(
  connectionId: string,
  filePath: string,
  table: string,
  columns: string[],
  search?: { column: string; query: string },
  limit?: number,
): Promise<SqlLookupRowsResponse> {
  const maxRows = limit ?? 50;
  const colList = columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(', ');
  let whereClause = '';
  const params: unknown[] = [];
  if (search && search.query.trim()) {
    params.push(`%${search.query}%`);
    whereClause = ` WHERE "${search.column.replace(/"/g, '""')}" LIKE ?`;
  }
  const sql = `SELECT ${colList} FROM "${table.replace(/"/g, '""')}"${whereClause} LIMIT ?`;
  params.push(maxRows);
  const res = await runReadOnlyQuery(connectionId, filePath, { sql, params });
  if (!res.ok) throw new Error(res.error);
  return { columns, rows: res.result.rows };
}

export async function saveChanges(
  connectionId: string,
  filePath: string,
  req: SaveChangesRequest,
): Promise<SaveChangesResponse> {
  if (req.updates.length === 0) return { ok: true, updated: 0 };

  const db = getDatabase(connectionId, filePath);
  let updated = 0;

  try {
    const runUpdates = db.transaction(
      (updates: SaveChangesRequest['updates']) => {
        for (let i = 0; i < updates.length; i++) {
          const change = updates[i];
          const setEntries = Object.entries(change.changes);
          if (setEntries.length === 0) continue;

          const setSql = setEntries
            .map(([col]) => `${ident(col)} = ?`)
            .join(', ');

          const whereSql = req.primaryKey
            .map((pk) => `${ident(pk)} = ?`)
            .join(' AND ');

          const sql = `UPDATE ${ident(req.table)} SET ${setSql} WHERE ${whereSql}`;
          const params = [
            ...setEntries.map(([, val]) => val),
            ...req.primaryKey.map((pk) => change.original[pk]),
          ];

          const info = db.prepare(sql).run(...params);
          if (info.changes === 0) {
            throw new Error(
              `Row ${i + 1} no longer matches its original values.`,
            );
          }
          updated += info.changes;
        }
      },
    );

    runUpdates(req.updates);
    return { ok: true, updated };
  } catch (err) {
    return { ok: false, error: toErrorMessage(err) };
  }
}

export async function insertRow(
  connectionId: string,
  filePath: string,
  req: InsertRowRequest,
): Promise<InsertRowResponse> {
  const db = getDatabase(connectionId, filePath);
  const entries = Object.entries(req.values);
  try {
    const sql =
      entries.length === 0
        ? `INSERT INTO ${ident(req.table)} DEFAULT VALUES`
        : `INSERT INTO ${ident(req.table)} (${entries.map(([col]) => ident(col)).join(', ')}) VALUES (${entries.map(() => '?').join(', ')})`;
    const info = db.prepare(sql).run(...entries.map(([, value]) => value));
    return { ok: true, inserted: info.changes };
  } catch (err) {
    return { ok: false, error: toErrorMessage(err) };
  }
}

export async function deleteRows(
  connectionId: string,
  filePath: string,
  req: DeleteRowsRequest,
): Promise<SqlDeleteRowsResponse> {
  if (req.rows.length === 0) return { ok: true, deleted: 0 };
  const db = getDatabase(connectionId, filePath);
  let deleted = 0;
  try {
    const runDeletes = db.transaction((rows: Record<string, unknown>[]) => {
      for (const row of rows) {
        const whereSql = req.primaryKey
          .map((pk) => `${ident(pk)} = ?`)
          .join(' AND ');
        const sql = `DELETE FROM ${ident(req.table)} WHERE ${whereSql}`;
        const params = req.primaryKey.map((pk) => row[pk]);
        const info = db.prepare(sql).run(...params);
        if (info.changes === 0) {
          throw new Error(
            'Some rows could not be found (they may have been deleted already).',
          );
        }
        deleted += info.changes;
      }
    });
    runDeletes(req.rows);
    return { ok: true, deleted };
  } catch (err) {
    return { ok: false, error: toErrorMessage(err) };
  }
}

export function disconnect(connectionId: string): void {
  dropDatabase(connectionId);
}

function ident(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

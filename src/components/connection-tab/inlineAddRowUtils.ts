import type { AddRowColumn } from './InlineAddRowCell';

export function parseInsertDraft(
  columns: AddRowColumn[],
  draft: Record<string, string>,
):
  | { ok: true; values: Record<string, unknown> }
  | { ok: false; error: string } {
  const values: Record<string, unknown> = {};
  for (const col of columns) {
    if (col.isGenerated || col.kind === 'readonly') continue;
    const raw = draft[col.name];
    if (raw === undefined || raw === '') {
      if (col.autoGenerateUuid) values[col.name] = crypto.randomUUID();
      continue;
    }
    const parsed = parseValue(col, raw);
    if (!parsed.ok) return { ok: false, error: `${col.name}: ${parsed.error}` };
    values[col.name] = parsed.value;
  }
  return { ok: true, values };
}

function parseValue(
  column: AddRowColumn,
  raw: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (column.kind === 'boolean') return { ok: true, value: raw === 'true' };
  if (column.kind === 'number') {
    const n = Number(raw);
    if (!Number.isFinite(n)) return { ok: false, error: 'Not a number' };
    return { ok: true, value: n };
  }
  if (column.kind === 'json') {
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Invalid JSON',
      };
    }
  }
  if (column.kind === 'datetime') {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'Invalid date' };
    return { ok: true, value: d.toISOString() };
  }
  return { ok: true, value: raw };
}

import { useEffect, useRef, useState } from 'react';
import { Link, Pencil } from 'lucide-react';
import { cn, valuesEqual } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ColumnMeta, EditableColumnKind } from '@/types/postgres';
import { editableKindFor } from '@/types/postgres';

export interface CellNavigationTarget {
  /** Qualified or unqualified target table name, used in the tooltip. */
  table: string;
  /** Called when the user clicks the link icon. */
  onClick: () => void;
  /**
   * Label for the referenced column used in the FK picker.
   * Only needed for SQLite where we don't have schema info.
   */
  referencedColumn?: string;
}

interface EditableCellProps {
  value: unknown;
  original: unknown;
  column: ColumnMeta;
  disabled?: boolean;
  onCommit: (next: unknown) => void;
  onCancel: () => void;
  /**
   * When set, the cell is rendered as a clickable FK link (in addition to its
   * normal edit affordance). Only used when the cell is non-null/read-only.
   */
  navigateTo?: CellNavigationTarget;
  incomingNavigateTo?: CellNavigationTarget[];
  /**
   * When set, the cell shows a "Browse" button in edit mode that opens a FK
   * picker dialog. The parent is responsible for managing the dialog.
   */
  onFkBrowse?: () => void;
}

function parseInput(
  kind: EditableColumnKind,
  raw: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (raw === '') return { ok: true, value: null };
  if (kind === 'number') {
    const n = Number(raw);
    if (!Number.isFinite(n)) return { ok: false, error: 'Not a number' };
    return { ok: true, value: n };
  }
  if (kind === 'json') {
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Invalid JSON',
      };
    }
  }
  if (kind === 'datetime') {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'Invalid date' };
    return { ok: true, value: d.toISOString() };
  }
  return { ok: true, value: raw };
}

function formatValue(value: unknown, kind: EditableColumnKind): string {
  if (value === null || value === undefined) return '';
  if (kind === 'json') {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  if (kind === 'datetime') {
    if (value instanceof Date) return value.toISOString().slice(0, 16);
    if (typeof value === 'string') {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString().slice(0, 16);
      }
    }
    return String(value);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function EditableCell({
  value,
  original,
  column,
  disabled,
  onCommit,
  onCancel,
  navigateTo,
  incomingNavigateTo = [],
  onFkBrowse,
}: EditableCellProps) {
  const kind = editableKindFor(column.udtName);
  const isEditable =
    !disabled &&
    !column.isGenerated &&
    kind !== 'readonly' &&
    (column.udtName !== 'uuid' || onFkBrowse);
  const enumValues = column.enumValues;
  const isEnum = enumValues !== undefined && enumValues.length > 0;
  const isNull = value === null || value === undefined;
  const isEmptyString = !isNull && value === '';
  const isDirty = !valuesEqual(value, original);
  const canNavigate = !isNull && navigateTo !== undefined;
  const incomingTargets = isNull ? [] : incomingNavigateTo;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(formatValue(value, kind));
  const [isNullDraft, setIsNullDraft] = useState<boolean>(isNull);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const enumPickedRef = useRef(false);
  const enumOpenRef = useRef(true);
  const draftRef = useRef(draft);
  const isNullDraftRef = useRef(isNullDraft);
  draftRef.current = draft;
  isNullDraftRef.current = isNullDraft;

  useEffect(() => {
    const nextDraft = formatValue(value, kind);
    const nextNull = isNull;
    setDraft(nextDraft);
    setIsNullDraft(nextNull);
    draftRef.current = nextDraft;
    isNullDraftRef.current = nextNull;
    setError(null);
  }, [value, kind, isNull]);

  useEffect(() => {
    if (editing) {
      enumPickedRef.current = false;
      enumOpenRef.current = true;
      if (isEnum) {
        // Radix Select auto-opens via defaultOpen; nothing else to focus.
        return;
      }
      if (kind === 'json') {
        taRef.current?.focus();
        taRef.current?.select();
      } else {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
  }, [editing, kind, isEnum]);

  if (!isEditable) {
    if (
      (canNavigate && navigateTo) ||
      incomingTargets.length > 0 ||
      onFkBrowse
    ) {
      return (
        <div className="group/cell flex w-full min-w-0 items-center gap-1">
          {canNavigate && navigateTo ? (
            <NavigationLink
              value={formatValue(value, kind)}
              title={String(value)}
              table={navigateTo.table}
              onClick={navigateTo.onClick}
            />
          ) : (
            <span
              className={cn(
                'block min-w-0 flex-1 truncate px-1.5 py-0.5 font-mono text-xs',
                (isNull || isEmptyString) && 'italic text-muted-foreground',
              )}
              title={
                isNull
                  ? 'NULL'
                  : isEmptyString
                    ? '(empty string)'
                    : String(value)
              }
            >
              {isNull
                ? 'NULL'
                : isEmptyString
                  ? '(empty)'
                  : formatValue(value, kind)}
            </span>
          )}
          {onFkBrowse && <FkBrowseIcon onClick={onFkBrowse} />}
          {incomingTargets.map((target) => (
            <NavigationLinkIcon
              key={target.table}
              table={target.table}
              onClick={target.onClick}
              label="Open referencing rows in"
            />
          ))}
        </div>
      );
    }
    return (
      <span
        className={cn(
          'block truncate font-mono text-xs',
          (isNull || isEmptyString) && 'italic text-muted-foreground',
        )}
        title={
          isNull ? 'NULL' : isEmptyString ? '(empty string)' : String(value)
        }
      >
        {isNull ? 'NULL' : isEmptyString ? '(empty)' : formatValue(value, kind)}
      </span>
    );
  }

  if (kind === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <Switch
          checked={!isNull && Boolean(value)}
          onCheckedChange={(checked) => onCommit(checked)}
          disabled={disabled}
        />
        {isDirty && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-amber-500"
            aria-label="Modified"
          />
        )}
      </div>
    );
  }

  if (!editing) {
    return (
      <div
        className={cn(
          'group/cell relative flex w-full items-center gap-1 rounded-sm text-left font-mono text-xs',
          (isNull || isEmptyString) && 'italic text-muted-foreground',
        )}
        title={
          isNull ? 'NULL' : isEmptyString ? '(empty string)' : String(value)
        }
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => setEditing(true)}
          className={cn(
            'min-w-0 flex-1 truncate rounded-sm px-1.5 py-0.5 text-left',
            !disabled && 'hover:bg-muted/60',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
        >
          {isNull
            ? 'NULL'
            : isEmptyString
              ? '(empty)'
              : formatValue(value, kind)}
        </button>
        {canNavigate && navigateTo && (
          <NavigationLinkIcon
            table={navigateTo.table}
            onClick={navigateTo.onClick}
          />
        )}
        {incomingTargets.map((target) => (
          <NavigationLinkIcon
            key={target.table}
            table={target.table}
            onClick={target.onClick}
            label="Open referencing rows in"
          />
        ))}
        {onFkBrowse && <FkBrowseIcon onClick={onFkBrowse} />}
        {isDirty && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-amber-500"
            aria-label="Modified"
          />
        )}
      </div>
    );
  }

  const commit = () => {
    const currentDraft = draftRef.current;
    const currentIsNullDraft = isNullDraftRef.current;
    if (currentIsNullDraft) {
      if (!column.isNullable && !valuesEqual(value, null)) {
        setError('Column is NOT NULL');
        return;
      }
      onCommit(null);
      setEditing(false);
      return;
    }
    if (isEnum) {
      setEditing(false);
      return;
    }
    const parsed = parseInput(kind, currentDraft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    onCommit(parsed.value);
    setEditing(false);
  };

  const cancel = () => {
    const resetDraft = formatValue(value, kind);
    const resetNull = isNull;
    setDraft(resetDraft);
    setIsNullDraft(resetNull);
    draftRef.current = resetDraft;
    isNullDraftRef.current = resetNull;
    setError(null);
    setEditing(false);
    onCancel();
  };

  const handleEnumWrapperKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && isNullDraft) {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  const handleEnumWrapperBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (enumPickedRef.current) return;
    // The Select moves focus into its portal-rendered content as soon as it
    // opens; that triggers a blur on the trigger. Don't treat that as the
    // user leaving the cell.
    if (enumOpenRef.current) return;
    const next = e.relatedTarget as HTMLElement | null;
    // If the user is moving focus to the null toggle, let the button click
    // handle the next state change without exiting edit mode.
    if (next && next.getAttribute('data-null-toggle') === 'true') return;
    setEditing(false);
  };

  return (
    <div
      className="flex flex-col gap-1"
      onKeyDown={isEnum ? handleEnumWrapperKeyDown : undefined}
      onBlur={isEnum ? handleEnumWrapperBlur : undefined}
    >
      <div className="flex items-center gap-1">
        {isEnum ? (
          <Select
            value={
              typeof value === 'string' && enumValues!.includes(value)
                ? value
                : undefined
            }
            onValueChange={(v) => {
              enumPickedRef.current = true;
              onCommit(v);
              setEditing(false);
            }}
            onOpenChange={(open) => {
              enumOpenRef.current = open;
            }}
            defaultOpen
          >
            <SelectTrigger
              disabled={disabled || isNullDraft}
              className="h-7 px-1.5 py-0 font-mono text-xs"
            >
              <SelectValue placeholder="(select value…)" />
            </SelectTrigger>
            <SelectContent>
              {enumValues!.map((v) => (
                <SelectItem key={v} value={v} className="font-mono text-xs">
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : kind === 'json' ? (
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              draftRef.current = e.target.value;
              if (isNullDraftRef.current) {
                setIsNullDraft(false);
                isNullDraftRef.current = false;
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              }
            }}
            className={cn(
              'min-h-[60px] w-full rounded-sm border border-input bg-background px-1.5 py-1 font-mono text-xs',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
            rows={3}
          />
        ) : onFkBrowse ? (
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef}
              type={
                kind === 'number'
                  ? 'number'
                  : kind === 'datetime'
                    ? 'datetime-local'
                    : 'text'
              }
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                draftRef.current = e.target.value;
                if (isNullDraftRef.current) {
                  setIsNullDraft(false);
                  isNullDraftRef.current = false;
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancel();
                }
              }}
              onBlur={() => commit()}
              className="h-7 min-w-0 flex-1 px-1.5 py-0 font-mono text-xs"
            />
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onFkBrowse();
              }}
              className="flex h-7 shrink-0 items-center gap-1 rounded-sm border border-border px-2 text-[11px] font-medium text-muted-foreground hover:bg-muted"
              title="Browse referenced table"
            >
              Browse…
            </button>
          </div>
        ) : (
          <Input
            ref={inputRef}
            type={
              kind === 'number'
                ? 'number'
                : kind === 'datetime'
                  ? 'datetime-local'
                  : 'text'
            }
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              draftRef.current = e.target.value;
              if (isNullDraftRef.current) {
                setIsNullDraft(false);
                isNullDraftRef.current = false;
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              }
            }}
            onBlur={() => commit()}
            className="h-7 px-1.5 py-0 font-mono text-xs"
          />
        )}
        <button
          type="button"
          data-null-toggle="true"
          onClick={() => {
            if (!column.isNullable || isNullDraft) {
              const nextNull = !isNullDraft;
              setIsNullDraft(nextNull);
              isNullDraftRef.current = nextNull;
              if (nextNull) {
                setDraft('');
                draftRef.current = '';
              }
            }
          }}
          title={column.isNullable ? 'Toggle NULL' : 'Column is NOT NULL'}
          className={cn(
            'rounded-sm border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider',
            isNullDraft
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          null
        </button>
      </div>
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  );
}

function NavigationLink({
  value,
  title,
  table,
  onClick,
}: {
  value: string;
  title: string;
  table: string;
  onClick: () => void;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className={cn(
              'flex w-full min-w-0 items-center gap-1 truncate rounded-sm px-1.5 py-0.5 text-left font-mono text-xs',
              'text-sky-600 hover:bg-sky-500/10 hover:text-sky-700 hover:underline',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              'dark:text-sky-400 dark:hover:text-sky-300',
            )}
            title={title}
          >
            <Link className="h-3 w-3 shrink-0 opacity-60" />
            <span className="truncate">{value}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          Open related row in <span className="font-mono">{table}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function NavigationLinkIcon({
  table,
  onClick,
  label = 'Open related row in',
}: {
  table: string;
  onClick: () => void;
  label?: string;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground',
              'hover:bg-sky-500/15 hover:text-sky-600',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              'opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100',
            )}
            aria-label={`${label} ${table}`}
          >
            <Link className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {label} <span className="font-mono">{table}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function FkBrowseIcon({ onClick }: { onClick: () => void }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground',
              'hover:bg-amber-500/15 hover:text-amber-600',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              'opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100',
            )}
            aria-label="Change foreign key value"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          Change referenced row
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

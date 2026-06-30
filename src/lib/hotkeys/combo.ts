export interface NormalizedCombo {
  key: string;
  mod: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

export interface ComboOptions {
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
}

const MOD_ALIASES = new Set(['mod', 'cmd', 'cmdorctrl', 'meta', 'command']);
const CTRL_ALIASES = new Set(['ctrl', 'control']);
const META_ALIASES = new Set(['meta', 'cmd', 'command']);
const SHIFT_ALIASES = new Set(['shift']);
const ALT_ALIASES = new Set(['alt', 'option']);

const KEY_ALIASES: Record<string, string> = {
  esc: 'escape',
  return: 'enter',
  del: 'delete',
  space: ' ',
  spacebar: ' ',
  arrowup: 'arrowup',
  arrowdown: 'arrowdown',
  arrowleft: 'arrowleft',
  arrowright: 'arrowright',
  left: 'arrowleft',
  right: 'arrowright',
  up: 'arrowup',
  down: 'arrowdown',
};

export function normalizeKey(raw: string): string {
  const k = raw.trim().toLowerCase();
  return KEY_ALIASES[k] ?? k;
}

export function parseCombo(combo: string): NormalizedCombo {
  const parts = combo
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean);
  const result: NormalizedCombo = {
    key: '',
    mod: false,
    ctrl: false,
    shift: false,
    alt: false,
  };
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (MOD_ALIASES.has(lower)) result.mod = true;
    else if (SHIFT_ALIASES.has(lower)) result.shift = true;
    else if (ALT_ALIASES.has(lower)) result.alt = true;
    else if (CTRL_ALIASES.has(lower)) result.ctrl = true;
    else if (META_ALIASES.has(lower)) result.mod = true;
    else result.key = normalizeKey(part);
  }
  return result;
}

export const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function matches(combo: NormalizedCombo, event: KeyboardEvent): boolean {
  const platformMod = IS_MAC ? event.metaKey : event.ctrlKey;
  if (combo.mod) {
    if (!platformMod) return false;
  } else if (IS_MAC && event.metaKey) {
    return false;
  }
  if (combo.ctrl) {
    if (!event.ctrlKey) return false;
  } else if (event.ctrlKey && !(combo.mod && !IS_MAC)) {
    return false;
  }
  if (combo.alt !== event.altKey) return false;

  const eventKey = event.key.toLowerCase();
  const eventCode = event.code;

  if (combo.key === '?') {
    if (combo.shift && !event.shiftKey) return false;
    if (eventKey === '?') return true;
    if ((eventKey === '/' || eventCode === 'Slash') && event.shiftKey)
      return true;
    return false;
  }

  if (combo.shift !== event.shiftKey) return false;

  if (combo.key === 'escape') return eventKey === 'escape';
  if (combo.key === 'enter') return eventKey === 'enter';
  if (combo.key === 'delete') return eventKey === 'delete';

  if (combo.key === 'arrowup') return eventKey === 'arrowup';
  if (combo.key === 'arrowdown') return eventKey === 'arrowdown';
  if (combo.key === 'arrowleft') return eventKey === 'arrowleft';
  if (combo.key === 'arrowright') return eventKey === 'arrowright';

  if (/^f\d+$/.test(combo.key)) {
    return eventKey === combo.key;
  }

  if (combo.key.length === 1) {
    return eventKey === combo.key;
  }

  return false;
}

export function formatCombo(combo: string): string {
  const parts = combo.split('+').map((p) => p.trim());
  const labels: string[] = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'mod') labels.push(IS_MAC ? '⌘' : 'Ctrl');
    else if (lower === 'shift') labels.push(IS_MAC ? '⇧' : 'Shift');
    else if (lower === 'alt' || lower === 'option')
      labels.push(IS_MAC ? '⌥' : 'Alt');
    else if (lower === 'ctrl' || lower === 'control') labels.push('Ctrl');
    else if (lower === 'meta' || lower === 'cmd' || lower === 'command')
      labels.push('⌘');
    else if (lower === 'enter' || lower === 'return') labels.push('↵');
    else if (lower === 'escape' || lower === 'esc') labels.push('Esc');
    else if (lower === 'arrowup') labels.push('↑');
    else if (lower === 'arrowdown') labels.push('↓');
    else if (lower === 'arrowleft') labels.push('←');
    else if (lower === 'arrowright') labels.push('→');
    else if (lower === 'delete' || lower === 'del') labels.push('Del');
    else if (lower === '?') labels.push('?');
    else if (/^f\d+$/i.test(part)) labels.push(part.toUpperCase());
    else if (part.length === 1) labels.push(part.toUpperCase());
    else labels.push(part);
  }
  return labels.join(IS_MAC ? '' : '+');
}

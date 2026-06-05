import {
  IS_MAC,
  isEditableTarget,
  matches,
  parseCombo,
  type NormalizedCombo,
} from './combo'

export interface HotkeyEntry {
  combo: string
  normalized: NormalizedCombo
  label?: string
  group?: string
  description?: string
  allowInInputs: boolean
  handler: (event: KeyboardEvent) => void
}

const entries: HotkeyEntry[] = []

export function registerHotkey(entry: Omit<HotkeyEntry, 'normalized'>): () => void {
  const full: HotkeyEntry = { ...entry, normalized: parseCombo(entry.combo) }
  entries.push(full)
  return () => {
    const idx = entries.indexOf(full)
    if (idx >= 0) entries.splice(idx, 1)
  }
}

export function dispatchHotkey(event: KeyboardEvent): void {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]
    if (!matches(entry.normalized, event)) continue
    if (!entry.allowInInputs && isEditableTarget(event.target)) continue
    event.preventDefault()
    entry.handler(event)
    return
  }
}

export function listHotkeys(): HotkeyEntry[] {
  return entries
    .filter((e) => e.label)
    .map((e) => ({ ...e }))
}

export const MOD_LABEL = IS_MAC ? '⌘' : 'Ctrl'
export const SHIFT_LABEL = IS_MAC ? '⇧' : 'Shift'
export const ALT_LABEL = IS_MAC ? '⌥' : 'Alt'

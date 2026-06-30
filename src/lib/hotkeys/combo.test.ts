import { describe, expect, it } from 'vitest';
import {
  formatCombo,
  isEditableTarget,
  matches,
  normalizeKey,
  parseCombo,
} from './combo';

function keyEvent(
  key: string,
  init: Partial<KeyboardEventInit> = {},
): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, bubbles: true, ...init });
}

describe('hotkey combo helpers', () => {
  it('normalizes key aliases', () => {
    expect(normalizeKey(' Esc ')).toBe('escape');
    expect(normalizeKey('return')).toBe('enter');
    expect(normalizeKey('left')).toBe('arrowleft');
    expect(normalizeKey('spacebar')).toBe(' ');
  });

  it('parses modifiers and key aliases', () => {
    expect(parseCombo('Mod + Shift + Return')).toEqual({
      key: 'enter',
      mod: true,
      ctrl: false,
      shift: true,
      alt: false,
    });
    expect(parseCombo('Ctrl+Option+K')).toEqual({
      key: 'k',
      mod: false,
      ctrl: true,
      shift: false,
      alt: true,
    });
  });

  it('matches modifier and key combinations', () => {
    expect(matches(parseCombo('Mod+K'), keyEvent('k', { ctrlKey: true }))).toBe(
      true,
    );
    expect(matches(parseCombo('Mod+K'), keyEvent('k'))).toBe(false);
    expect(
      matches(parseCombo('Ctrl+R'), keyEvent('r', { ctrlKey: true })),
    ).toBe(true);
    expect(matches(parseCombo('R'), keyEvent('r', { ctrlKey: true }))).toBe(
      false,
    );
    expect(
      matches(
        parseCombo('Shift+ArrowUp'),
        keyEvent('ArrowUp', { shiftKey: true }),
      ),
    ).toBe(true);
  });

  it('matches question mark shortcuts from shifted slash', () => {
    expect(
      matches(
        parseCombo('Shift+?'),
        keyEvent('/', { code: 'Slash', shiftKey: true }),
      ),
    ).toBe(true);
    expect(
      matches(parseCombo('Shift+?'), keyEvent('/', { code: 'Slash' })),
    ).toBe(false);
  });

  it('detects editable targets', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true);
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true);

    const contentEditable = document.createElement('div');
    Object.defineProperty(contentEditable, 'isContentEditable', {
      value: true,
    });
    expect(isEditableTarget(contentEditable)).toBe(true);
    expect(isEditableTarget(document.createElement('button'))).toBe(false);
  });

  it('formats display labels', () => {
    expect(formatCombo('Mod+Shift+Enter')).toBe('Ctrl+Shift+↵');
    expect(formatCombo('Alt+Delete')).toBe('Alt+Del');
  });
});

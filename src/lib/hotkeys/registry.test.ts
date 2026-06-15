import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchHotkey, listHotkeys, registerHotkey } from './registry';

function keyEvent(
  key: string,
  init: Partial<KeyboardEventInit> = {},
): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
}

describe('hotkey registry', () => {
  beforeEach(() => {
    for (const entry of listHotkeys()) {
      registerHotkey({ ...entry, label: undefined })();
    }
  });

  it('dispatches matching hotkeys and prevents default', () => {
    const handler = vi.fn();
    const unregister = registerHotkey({
      combo: 'Mod+K',
      allowInInputs: false,
      handler,
    });
    const event = keyEvent('k', { ctrlKey: true });

    dispatchHotkey(event);

    expect(handler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    unregister();
  });

  it('prefers the most recently registered matching hotkey', () => {
    const first = vi.fn();
    const second = vi.fn();
    const unregisterFirst = registerHotkey({
      combo: 'Mod+K',
      allowInInputs: true,
      handler: first,
    });
    const unregisterSecond = registerHotkey({
      combo: 'Mod+K',
      allowInInputs: true,
      handler: second,
    });

    dispatchHotkey(keyEvent('k', { ctrlKey: true }));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    unregisterSecond();
    unregisterFirst();
  });

  it('skips editable targets unless allowed', () => {
    const skipped = vi.fn();
    const allowed = vi.fn();
    const input = document.createElement('input');
    const unregisterSkipped = registerHotkey({
      combo: 'Mod+K',
      allowInInputs: false,
      handler: skipped,
    });
    const event = keyEvent('k', { ctrlKey: true });
    Object.defineProperty(event, 'target', { value: input });

    dispatchHotkey(event);

    expect(skipped).not.toHaveBeenCalled();
    const unregisterAllowed = registerHotkey({
      combo: 'Mod+K',
      allowInInputs: true,
      handler: allowed,
    });
    dispatchHotkey(event);
    expect(allowed).toHaveBeenCalledOnce();
    unregisterAllowed();
    unregisterSkipped();
  });

  it('lists only labeled hotkeys and unregisters entries', () => {
    const unregisterVisible = registerHotkey({
      combo: 'Escape',
      label: 'Close',
      group: 'Global',
      description: 'Close the current overlay',
      allowInInputs: true,
      handler: vi.fn(),
    });
    const unregisterHidden = registerHotkey({
      combo: 'Enter',
      allowInInputs: true,
      handler: vi.fn(),
    });

    expect(listHotkeys()).toHaveLength(1);
    expect(listHotkeys()[0]).toMatchObject({ combo: 'Escape', label: 'Close' });
    unregisterVisible();
    unregisterHidden();
    expect(listHotkeys()).toHaveLength(0);
  });
});

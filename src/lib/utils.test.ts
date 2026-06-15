import { describe, expect, it } from 'vitest';
import { cn, valuesEqual } from './utils';

describe('cn', () => {
  it('merges conditional and conflicting tailwind classes', () => {
    expect(cn('px-2 text-sm', false && 'hidden', 'px-4')).toBe('text-sm px-4');
  });
});

describe('valuesEqual', () => {
  it('compares primitives and nullish values', () => {
    expect(valuesEqual('a', 'a')).toBe(true);
    expect(valuesEqual(null, null)).toBe(true);
    expect(valuesEqual(null, undefined)).toBe(false);
    expect(valuesEqual('a', 'b')).toBe(false);
  });

  it('treats numeric strings and numbers as equal when their string forms match', () => {
    expect(valuesEqual(42, '42')).toBe(true);
    expect(valuesEqual('42', 42)).toBe(true);
    expect(valuesEqual(42, '0042')).toBe(false);
  });

  it('compares JSON-serializable objects by value', () => {
    expect(valuesEqual({ id: 1, tags: ['a'] }, { id: 1, tags: ['a'] })).toBe(
      true,
    );
    expect(valuesEqual({ id: 1 }, { id: 2 })).toBe(false);
  });

  it('returns false for unstringifiable objects', () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(valuesEqual(a, { self: {} })).toBe(false);
  });
});

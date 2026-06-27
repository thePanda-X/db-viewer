export const THEME_NAMES = [
  'harbor',
  'monochrome',
  'rose-pine',
  'one-dark',
] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && THEME_NAMES.includes(value as ThemeName);
}

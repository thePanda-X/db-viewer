import type { Settings, ThemeName } from './types/settings';

const THEMES: ThemeName[] = ['harbor', 'monochrome', 'rose-pine', 'one-dark'];
export const DEFAULT_SETTINGS: Settings = { theme: 'monochrome' };

export function parseSettings(value: unknown): Settings {
  if (typeof value !== 'object' || value === null) return DEFAULT_SETTINGS;

  const maybeSettings = value as Partial<Settings>;
  return {
    theme: THEMES.includes(maybeSettings.theme as ThemeName)
      ? (maybeSettings.theme as ThemeName)
      : DEFAULT_SETTINGS.theme,
  };
}

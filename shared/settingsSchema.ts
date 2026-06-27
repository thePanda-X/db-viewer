import { isThemeName } from './themes';
import type { Settings } from './types/settings';

export const DEFAULT_SETTINGS: Settings = { theme: 'monochrome' };

export function parseSettings(value: unknown): Settings {
  if (typeof value !== 'object' || value === null) return DEFAULT_SETTINGS;

  const maybeSettings = value as Partial<Settings>;
  return {
    theme: isThemeName(maybeSettings.theme)
      ? maybeSettings.theme
      : DEFAULT_SETTINGS.theme,
  };
}

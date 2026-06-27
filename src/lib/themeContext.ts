import { createContext, useContext } from 'react';
import type { ThemeName } from '../../shared/types/settings';
import { themeOptions } from '@/lib/themes';

export type { ThemeName } from '../../shared/types/settings';

export const THEMES = themeOptions;

export interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

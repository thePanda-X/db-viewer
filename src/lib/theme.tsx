import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import { ThemeContext, type ThemeName } from '@/lib/themeContext';
import { themes, type ThemeColorToken } from '@/lib/themes';
import { isThemeName } from '../../shared/themes';

const DEFAULT_THEME: ThemeName = 'monochrome';

function toCssVariableName(token: ThemeColorToken): string {
  return `--${token.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(DEFAULT_THEME);
  const latestThemeRef = useRef<ThemeName>(DEFAULT_THEME);

  useEffect(() => {
    let cancelled = false;
    void api.settings.get().then((settings) => {
      if (cancelled) return;
      latestThemeRef.current = settings.theme;
      setThemeState(settings.theme);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const selectedTheme = themes[theme];

    root.classList.toggle('dark', selectedTheme.mode === 'dark');
    root.dataset.theme = theme;

    for (const [token, value] of Object.entries(selectedTheme.colors)) {
      root.style.setProperty(
        toCssVariableName(token as ThemeColorToken),
        value,
      );
    }
  }, [theme]);

  const setTheme = useCallback((nextTheme: ThemeName) => {
    if (!isThemeName(nextTheme)) return;
    latestThemeRef.current = nextTheme;
    setThemeState(nextTheme);
    void api.settings.save({ theme: nextTheme }).then((settings) => {
      if (latestThemeRef.current !== nextTheme) return;
      latestThemeRef.current = settings.theme;
      setThemeState(settings.theme);
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
    }),
    [theme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import { THEMES, ThemeContext, type ThemeName } from '@/lib/themeContext';

const DEFAULT_THEME: ThemeName = 'harbor';

function isThemeName(value: string | null): value is ThemeName {
  return THEMES.some((theme) => theme.value === value);
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
    root.classList.add('dark');
    root.dataset.theme = theme;
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

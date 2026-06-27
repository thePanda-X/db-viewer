import type { ThemeName } from '../../shared/themes';

export type ThemeColorToken =
  | 'background'
  | 'foreground'
  | 'card'
  | 'cardForeground'
  | 'popover'
  | 'popoverForeground'
  | 'primary'
  | 'primaryForeground'
  | 'secondary'
  | 'secondaryForeground'
  | 'muted'
  | 'mutedForeground'
  | 'accent'
  | 'accentForeground'
  | 'destructive'
  | 'destructiveForeground'
  | 'border'
  | 'input'
  | 'ring';

type ThemeDefinition = {
  label: string;
  mode: 'dark' | 'light';
  colors: Record<ThemeColorToken, string>;
};

export const themes = {
  harbor: {
    label: 'Harbor',
    mode: 'dark',
    colors: {
      background: '218 30% 7%',
      foreground: '38 24% 93%',
      card: '218 25% 10%',
      cardForeground: '38 24% 93%',
      popover: '218 24% 11%',
      popoverForeground: '38 24% 93%',
      primary: '174 48% 47%',
      primaryForeground: '218 32% 8%',
      secondary: '218 20% 15%',
      secondaryForeground: '38 24% 93%',
      muted: '218 20% 15%',
      mutedForeground: '218 12% 66%',
      accent: '174 28% 18%',
      accentForeground: '174 52% 78%',
      destructive: '8 58% 47%',
      destructiveForeground: '0 0% 98%',
      border: '218 17% 20%',
      input: '218 17% 20%',
      ring: '174 48% 47%',
    },
  },
  monochrome: {
    label: 'Monochrome',
    mode: 'dark',
    colors: {
      background: '0 0% 6%',
      foreground: '0 0% 94%',
      card: '0 0% 10%',
      cardForeground: '0 0% 94%',
      popover: '0 0% 10%',
      popoverForeground: '0 0% 94%',
      primary: '0 0% 92%',
      primaryForeground: '0 0% 8%',
      secondary: '0 0% 15%',
      secondaryForeground: '0 0% 92%',
      muted: '0 0% 15%',
      mutedForeground: '0 0% 64%',
      accent: '0 0% 20%',
      accentForeground: '0 0% 96%',
      destructive: '0 0% 74%',
      destructiveForeground: '0 0% 8%',
      border: '0 0% 22%',
      input: '0 0% 22%',
      ring: '0 0% 86%',
    },
  },
  'rose-pine': {
    label: 'Rosé Pine',
    mode: 'dark',
    colors: {
      background: '249 22% 12%',
      foreground: '35 31% 87%',
      card: '248 21% 15%',
      cardForeground: '35 31% 87%',
      popover: '248 21% 15%',
      popoverForeground: '35 31% 87%',
      primary: '2 55% 83%',
      primaryForeground: '249 22% 12%',
      secondary: '248 17% 22%',
      secondaryForeground: '35 31% 87%',
      muted: '248 17% 22%',
      mutedForeground: '245 16% 65%',
      accent: '267 57% 78%',
      accentForeground: '249 22% 12%',
      destructive: '343 76% 68%',
      destructiveForeground: '249 22% 12%',
      border: '248 15% 25%',
      input: '248 15% 25%',
      ring: '2 55% 83%',
    },
  },
  'one-dark': {
    label: 'One Dark',
    mode: 'dark',
    colors: {
      background: '220 13% 13%',
      foreground: '220 14% 71%',
      card: '220 13% 16%',
      cardForeground: '220 14% 71%',
      popover: '220 13% 16%',
      popoverForeground: '220 14% 71%',
      primary: '207 82% 66%',
      primaryForeground: '220 13% 13%',
      secondary: '220 13% 20%',
      secondaryForeground: '220 14% 78%',
      muted: '220 13% 20%',
      mutedForeground: '220 9% 55%',
      accent: '95 38% 62%',
      accentForeground: '220 13% 13%',
      destructive: '5 48% 62%',
      destructiveForeground: '220 13% 13%',
      border: '220 13% 24%',
      input: '220 13% 24%',
      ring: '207 82% 66%',
    },
  },
  linen: {
    label: 'Linen',
    mode: 'light',
    colors: {
      background: '38 44% 96%',
      foreground: '27 22% 17%',
      card: '36 50% 99%',
      cardForeground: '27 22% 17%',
      popover: '36 50% 99%',
      popoverForeground: '27 22% 17%',
      primary: '19 66% 43%',
      primaryForeground: '40 54% 97%',
      secondary: '36 31% 88%',
      secondaryForeground: '27 22% 22%',
      muted: '35 27% 90%',
      mutedForeground: '28 11% 43%',
      accent: '28 58% 86%',
      accentForeground: '20 52% 25%',
      destructive: '4 68% 48%',
      destructiveForeground: '40 54% 97%',
      border: '34 23% 80%',
      input: '34 23% 80%',
      ring: '19 66% 43%',
    },
  },
  sage: {
    label: 'Sage',
    mode: 'light',
    colors: {
      background: '92 28% 95%',
      foreground: '145 18% 16%',
      card: '90 33% 98%',
      cardForeground: '145 18% 16%',
      popover: '90 33% 98%',
      popoverForeground: '145 18% 16%',
      primary: '146 34% 32%',
      primaryForeground: '90 33% 98%',
      secondary: '96 22% 87%',
      secondaryForeground: '143 18% 22%',
      muted: '96 18% 89%',
      mutedForeground: '135 9% 42%',
      accent: '75 42% 83%',
      accentForeground: '145 35% 22%',
      destructive: '6 63% 47%',
      destructiveForeground: '90 33% 98%',
      border: '100 17% 78%',
      input: '100 17% 78%',
      ring: '146 34% 32%',
    },
  },
  sky: {
    label: 'Sky',
    mode: 'light',
    colors: {
      background: '210 54% 97%',
      foreground: '218 32% 17%',
      card: '0 0% 100%',
      cardForeground: '218 32% 17%',
      popover: '0 0% 100%',
      popoverForeground: '218 32% 17%',
      primary: '205 74% 42%',
      primaryForeground: '210 54% 98%',
      secondary: '212 42% 90%',
      secondaryForeground: '218 31% 24%',
      muted: '213 35% 92%',
      mutedForeground: '215 16% 45%',
      accent: '191 68% 85%',
      accentForeground: '205 63% 24%',
      destructive: '0 66% 48%',
      destructiveForeground: '210 54% 98%',
      border: '214 32% 82%',
      input: '214 32% 82%',
      ring: '205 74% 42%',
    },
  },
  dusk: {
    label: 'Dusk',
    mode: 'light',
    colors: {
      background: '260 43% 97%',
      foreground: '264 28% 18%',
      card: '0 0% 100%',
      cardForeground: '264 28% 18%',
      popover: '0 0% 100%',
      popoverForeground: '264 28% 18%',
      primary: '265 46% 45%',
      primaryForeground: '260 43% 98%',
      secondary: '264 34% 91%',
      secondaryForeground: '264 28% 24%',
      muted: '264 28% 93%',
      mutedForeground: '265 12% 45%',
      accent: '322 58% 88%',
      accentForeground: '292 42% 28%',
      destructive: '352 64% 48%',
      destructiveForeground: '260 43% 98%',
      border: '264 24% 84%',
      input: '264 24% 84%',
      ring: '265 46% 45%',
    },
  },
} satisfies Record<ThemeName, ThemeDefinition>;

export const themeOptions = Object.entries(themes).map(([value, theme]) => ({
  value: value as ThemeName,
  label: theme.label,
  mode: theme.mode,
}));

export const darkThemeOptions = themeOptions.filter(
  (theme) => theme.mode === 'dark',
);

export const lightThemeOptions = themeOptions.filter(
  (theme) => theme.mode === 'light',
);

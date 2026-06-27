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
  colors: Record<ThemeColorToken, string>;
};

export const themes = {
  harbor: {
    label: 'Harbor',
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
} satisfies Record<ThemeName, ThemeDefinition>;

export const themeOptions = Object.entries(themes).map(([value, theme]) => ({
  value: value as ThemeName,
  label: theme.label,
}));

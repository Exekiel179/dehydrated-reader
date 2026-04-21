import type { AccentPreset, ColorTheme } from '@/src/types';

export const COLOR_THEME_STORAGE_KEY = 'dehydrated-reader-color-theme';
export const ACCENT_PRESET_STORAGE_KEY = 'dehydrated-reader-accent-preset';

const THEME_TOKENS: Record<ColorTheme, Record<string, string>> = {
  rose: {
    '--color-primary': '#894854',
    '--color-primary-container': '#a6606c',
    '--color-on-primary': '#ffffff',
    '--color-secondary': '#79555c',
    '--color-secondary-container': '#fdced7',
    '--color-on-secondary-container': '#79555d',
    '--color-tertiary': '#3f6446',
    '--color-tertiary-container': '#577d5d',
    '--color-on-tertiary-container': '#f7fff3',
    '--color-background': '#fcf9f8',
    '--color-surface': '#fcf9f8',
    '--color-surface-container-low': '#f6f3f2',
    '--color-surface-container': '#f0edec',
    '--color-surface-container-high': '#eae7e7',
    '--color-surface-container-lowest': '#ffffff',
    '--color-on-surface': '#1b1c1b',
    '--color-on-surface-variant': '#514346',
    '--color-outline': '#837375',
    '--color-outline-variant': '#d5c2c4',
    '--particle-hue-base': '338',
    '--particle-hue-span': '16',
  },
  blue: {
    '--color-primary': '#3f67d7',
    '--color-primary-container': '#6884de',
    '--color-on-primary': '#ffffff',
    '--color-secondary': '#5a6fbb',
    '--color-secondary-container': '#dce5ff',
    '--color-on-secondary-container': '#3d4e8a',
    '--color-tertiary': '#3f6d86',
    '--color-tertiary-container': '#d7edf7',
    '--color-on-tertiary-container': '#173949',
    '--color-background': '#f7f9ff',
    '--color-surface': '#f8faff',
    '--color-surface-container-low': '#eff3ff',
    '--color-surface-container': '#e8eefb',
    '--color-surface-container-high': '#dde6fb',
    '--color-surface-container-lowest': '#ffffff',
    '--color-on-surface': '#171c27',
    '--color-on-surface-variant': '#556070',
    '--color-outline': '#8791a6',
    '--color-outline-variant': '#d3daea',
    '--particle-hue-base': '222',
    '--particle-hue-span': '18',
  },
};

const ACCENT_TOKENS: Record<Exclude<AccentPreset, 'theme'>, Record<string, string>> = {
  jade: {
    '--color-primary': '#00685f',
    '--color-primary-container': '#008378',
    '--particle-hue-base': '170',
    '--particle-hue-span': '18',
  },
  berry: {
    '--color-primary': '#894854',
    '--color-primary-container': '#a6606c',
    '--particle-hue-base': '338',
    '--particle-hue-span': '16',
  },
  cobalt: {
    '--color-primary': '#3f67d7',
    '--color-primary-container': '#6884de',
    '--particle-hue-base': '222',
    '--particle-hue-span': '18',
  },
  copper: {
    '--color-primary': '#924628',
    '--color-primary-container': '#b05e3d',
    '--particle-hue-base': '18',
    '--particle-hue-span': '14',
  },
};

export function resolveStoredColorTheme(storage?: Storage | null): ColorTheme {
  const savedTheme = storage?.getItem(COLOR_THEME_STORAGE_KEY);
  return savedTheme === 'blue' ? 'blue' : 'rose';
}

export function resolveStoredAccentPreset(storage?: Storage | null): AccentPreset {
  const savedAccent = storage?.getItem(ACCENT_PRESET_STORAGE_KEY);
  return savedAccent === 'jade' || savedAccent === 'berry' || savedAccent === 'cobalt' || savedAccent === 'copper'
    ? savedAccent
    : 'theme';
}

export function applyColorTheme(theme: ColorTheme, accentPreset: AccentPreset = 'theme', root: HTMLElement = document.documentElement) {
  const tokens = {
    ...THEME_TOKENS[theme],
    ...(accentPreset === 'theme' ? {} : ACCENT_TOKENS[accentPreset]),
  };
  root.dataset.theme = theme;
  root.dataset.accent = accentPreset;
  root.style.colorScheme = 'light';

  Object.entries(tokens).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });
}

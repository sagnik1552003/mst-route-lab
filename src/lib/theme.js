// Basemap per theme + the saved/OS theme preference. The map tiles are
// OpenFreeMap (free, no key); both styles ship the 'Noto Sans' glyphs the
// numbered-stop labels use.
export const MAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

const KEY = 'mst-theme';

export function getInitialTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage unavailable — fall through to the OS preference */
  }
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore — theme still applies for this visit */
  }
}

/** Reads the current theme's colour tokens off :root, for MapLibre paint. */
export function mapPalette() {
  const css = getComputedStyle(document.documentElement);
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    ink: v('--ink', '#14181f'),
    inkDim: v('--ink-dim', '#5b6270'),
    paper: v('--surface', '#ffffff'),
    dot: v('--map-dot', '#9aa1ad'),
    tree: v('--c-tree', '#2f5bea'),
    route: v('--c-route', '#e4572e'),
    walk: v('--c-walk', '#d39400'),
    optimal: v('--c-optimal', '#14a37f'),
    accent: v('--accent', '#e4572e'),
  };
}

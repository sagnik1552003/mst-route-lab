# CLAUDE.md

Single-page React + Vite app: three tabs (Held–Karp, double-tree
2-approximation, MST-Prim), each replaying one algorithm step by step on the
map. Split out of Pujo Yatra (https://github.com/sagnik1552003/PujoYatra).

## Rules of the codebase

- Keep it minimal. Dependencies are `react`, `react-dom`, `maplibre-gl`,
  `vite` — nothing else. No router, no state library, no backend. JSX is
  compiled by Vite itself (automatic runtime), no React plugin.
- maplibre-gl 6 is ESM-only: import it as a namespace (`import * as
  maplibregl`), and keep `setWorkerUrl(workerUrl)` in `App.jsx` — the
  worker is a separate file that breaks once Vite bundles the library.
- Algorithms in `src/lib/` are pure (no DOM), importable from Node; the
  benchmark (`npm run bench`) uses them directly.
- Each algorithm exports `xxxFrames(D, names)` → an array of frames. A frame
  is a full snapshot: `{ title, text, phase?, edges: [{from, to, kind}],
  nodes: [state per stop], stats?, table? }`. The `Player` only picks a
  frame (it opens on the last one — the solution — and replays from 0); `lib/map.js → setFrame` draws it. Edge kinds: tree, new,
  candidate, faded, dbl, walk, stretch, tour, partial, opt. Node states:
  pending, done, root, current, marked, skipped.
- All tours are closed cycles starting at stop 1. Held–Karp is capped at
  `MAX_EXACT` = 13.
- `npm run build` is the only automated check; verify UI in headless
  Chromium (both colour schemes, a phone viewport).

## Styling

`src/styles.css`: system fonts, tokens on `:root` (`--bg --ink --muted
--line --soft --accent --good --dot`), dark mode via
`prefers-color-scheme`. The map reads the same tokens when layers are added,
and the page re-adds them when the scheme changes.

## External services

OpenFreeMap tiles only (free, no key).
